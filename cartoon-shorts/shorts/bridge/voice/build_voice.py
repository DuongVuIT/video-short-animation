# Stand-in narration for the bridge short from a macOS voice (no original voice.wav / words.json ship with the skill).
# Each sentence is synthesized on its own (tts.swift, which also reports where each word starts), then cut at a few
# anchor words and time-stretched piece by piece (ffmpeg atempo, pitch kept) so the words land on the frames the
# picture was cut to (anchors taken from the comments in story.ts / cast.ts / mix.py). Writes <out>/voice.wav
# (48 kHz) + <out>/words.json ({w, s, e} per word) + <out>/report.txt.
# usage: python build_voice.py <voice identifier> <out dir> [tts rate 0..1]
import sys
sys.dont_write_bytecode = True   # no __pycache__ next to the code
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "audio"))
from dsp import integrated, st, write_wav  # noqa: E402

SR = 48000
DUR = 67.5
RMIN, RMAX = 0.85, 1.45      # atempo limits: slower than RMIN -> pad a pause before the anchor word; faster than RMAX -> drift
TARGET_LUFS = -16.6          # original voice level before the mix gain (cues.md: voice stem -15.4 LUFS at +1.2 dB)
XF = int(0.006 * SR)         # crossfade between stretched pieces

# (text, start s, latest end s, [(anchor word, time s)]) - anchors = the word's start, i.e. the frame of the
# matching cut / punch / reaction + ~2 frames (reactions land 0-3 frames before their word)
LINES = [
    ("Seventy-four soldiers knocked down an iron bridge just by walking across it.", 0.07, 4.28, [("knocked", 1.35), ("just", 2.95)]),
    ("It's eighteen thirty-one, and the brand new bridge over the river is the pride of the whole town.", 4.45, 9.38, [("pride", 8.01)]),
    ("The men are marching home four across, every boot hitting the planks at the exact same moment.", 9.5, 14.75, [("every", 11.8)]),
    ("Halfway over, the bridge starts bouncing under their feet.", 14.87, 17.75, [("bouncing", 16.62)]),
    ("A normal person would slow down, but these guys think it's hilarious.", 17.87, 21.38, [("these", 19.27), ("think", 20.07)]),
    ("Somebody starts whistling a marching tune, and the whole column stomps along to it, a little harder every step.", 21.5, 27.38, [("whole", 23.97)]),
    ("The bounce gets bigger, the chains start groaning, and nobody wants to be the one who breaks step.", 27.5, 32.85, [("chains", 29.1), ("nobody", 30.9)]),
    ("Then a single bolt snaps, and the whole end of the bridge drops into the river.", 33.0, 37.75, [("snaps", 34.62), ("drops", 36.7)]),
    ("Luckily, the river was only two feet deep.", 37.87, 40.35, []),
    ("Unluckily, the river was only two feet deep.", 40.5, 43.38, []),
    ("You see, every bridge has a rhythm it naturally likes to sway at.", 43.5, 47.0, []),
    ("Ever pushed a kid on a swing? Each push is tiny, but if they all land at just the right moment, the swing goes higher and higher.", 47.1, 53.98, []),
    ("Seventy-four men stepping together were pushing that bridge like a swing.", 54.07, 57.78, [("pushing", 56.23)]),
    ("Nobody died, but the army made a rule: never cross a bridge in step.", 57.9, 62.0, [("in", 61.25)]),
    ("So now, the best-drilled soldiers in the world cross every bridge like a crowd of tourists.", 62.15, 67.4, [("best", 63.55), ("like", 65.96)]),
]


def run(*a, data=None):
    p = subprocess.run(a, input=data, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors="replace")[-800:])
    return p.stdout


def decode(path):
    raw = run("ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-")
    return np.frombuffer(raw, "<f4").astype(np.float64)


def atempo(x, r):
    if abs(r - 1) < 0.005 or len(x) < 64:
        return x.copy()
    raw = run("ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
              "-af", f"atempo={r:.5f}", "-f", "f32le", "-", data=x.astype("<f4").tobytes())
    return np.frombuffer(raw, "<f4").astype(np.float64)


def fit(x, n):
    """exact length n (atempo is off by a few ms)"""
    return x[:n] if len(x) >= n else np.concatenate([x, np.zeros(n - len(x))])


def speech_bounds(x):
    w = int(0.01 * SR)
    rms = np.sqrt(np.convolve(x * x, np.ones(w) / w, "same"))
    on = np.nonzero(rms > rms.max() * 10 ** (-42 / 20))[0]
    return max(0, on[0] - int(0.01 * SR)), min(len(x), on[-1] + int(0.03 * SR))


def norm(w):
    return "".join(c for c in w.lower() if c.isalnum() or c == "-")


def main():
    voice, out = sys.argv[1], sys.argv[2]
    rate = sys.argv[3] if len(sys.argv) > 3 else "0.5"
    # per-line TTS cache in the project's temporary area (out/cache), not next to the result
    cache = os.path.join(HERE, "..", "..", "..", "out", "cache", "bridge-tts", os.path.basename(os.path.abspath(out)))
    os.makedirs(cache, exist_ok=True)
    track = np.zeros(int(DUR * SR))
    words_out, report = [], []
    t_free = 0.0                                   # end of the previous line (no overlaps)
    for li, (text, start, latest, anchors) in enumerate(LINES, 1):
        caf, js = os.path.join(cache, f"l{li:02d}.caf"), os.path.join(cache, f"l{li:02d}.json")
        if not os.path.exists(js):
            run("swift", os.path.join(HERE, "tts.swift"), voice, rate, text, caf, js)
        meta = json.load(open(js))
        x = decode(caf)
        k = SR / meta["sr"] / (meta["bytesPerFrame"] or 4)
        ws = [(m["w"], int(round(m["offset"] * k))) for m in meta["words"]]
        a, b = speech_bounds(x)
        ws[0] = (ws[0][0], a)
        # cut points: speech onset -> each anchor word -> speech end
        pts, wi = [(a, max(start, t_free + 0.04))], 1
        for word, t in anchors:
            j = next(i for i in range(wi, len(ws)) if norm(ws[i][0]).startswith(norm(word)))
            pts.append((ws[j][1], t))
            wi = j + 1
        pieces, t_cur, warp, notes = [], pts[0][1], [], []
        for i in range(len(pts)):
            s0 = pts[i][0]
            s1 = pts[i + 1][0] if i + 1 < len(pts) else b
            dn = (s1 - s0) / SR
            if i + 1 < len(pts):
                dt = pts[i + 1][1] - t_cur
                r = dn / dt if dt > 0 else RMAX
            else:                                  # tail: natural pace, faster only if it would run past `latest`
                r = max(1.0, dn / max(1e-3, latest - t_cur))
            pad = 0.0
            if r < RMIN:
                pad, r = dt - dn / RMIN, RMIN
            elif r > RMAX:
                notes.append(f"piece {i} needs x{r:.2f}, capped at x{RMAX}")
                r = RMAX
            y = fit(atempo(x[s0:s1], r), int(round(dn / r * SR)))
            warp.append((s0, s1, t_cur, r))
            pieces.append((t_cur, y))
            t_cur += dn / r + pad
        line_end = t_cur
        # lay the pieces down with short crossfades
        for t0, y in pieces:
            i0 = int(round(t0 * SR))
            y = y.copy()
            n = min(XF, len(y) // 4)
            if n:
                y[:n] *= np.linspace(0, 1, n)
                y[-n:] *= np.linspace(1, 0, n)
            seg = track[i0:i0 + len(y)]
            seg += y[:len(seg)]
        # word times through the warp
        def tmap(s):
            for s0, s1, t0, r in warp:
                if s < s1 or (s0, s1, t0, r) == warp[-1]:
                    return t0 + max(0, s - s0) / SR / r
        starts = [tmap(s) for _, s in ws]
        for i, (w, _) in enumerate(ws):
            e = (starts[i + 1] - 0.02) if i + 1 < len(ws) else line_end
            words_out.append({"w": w, "s": round(starts[i], 3), "e": round(max(e, starts[i] + 0.05), 3)})
        errs = [f"{w}: {tmap(ws[next(i for i in range(len(ws)) if norm(ws[i][0]).startswith(norm(w)))][1]) - t:+.2f}s" for w, t in anchors]
        rates = ", ".join(f"x{r:.2f}" for *_, r in warp)
        report.append(f"L{li:02d} {pts[0][1]:6.2f}-{line_end:6.2f} (latest {latest:5.2f}) tempo {rates}"
                      + (f" | anchors {', '.join(errs)}" if errs else "") + (f" | {'; '.join(notes)}" if notes else "")
                      + (" | OVERRUN" if line_end > latest + 0.02 else ""))
        t_free = line_end
    track *= 10 ** ((TARGET_LUFS - integrated(st(track))) / 20)
    write_wav(os.path.join(out, "voice.wav"), track)
    json.dump(words_out, open(os.path.join(out, "words.json"), "w"), indent=1)
    open(os.path.join(out, "report.txt"), "w").write("\n".join(report) + "\n")
    print("\n".join(report))
    print(f"voice.wav {integrated(st(track)):.1f} LUFS, peak {20 * np.log10(np.abs(track).max()):.1f} dBFS, {len(words_out)} words")


if __name__ == "__main__":
    main()
