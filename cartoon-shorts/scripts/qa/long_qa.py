#!/usr/bin/env python3
"""Light frame-by-frame QA for a LONG render (every frame, streamed, small memory): loudness, black / white frames,
frozen runs (>= 12 identical frames), pops (one frame unlike both neighbours inside a shot), and each shot's mean luma.
usage: .venv/bin/python scripts/qa/long_qa.py <video.mp4> <out/ml/shots.json> <report.md>"""
import json, subprocess, sys
import numpy as np
vid, tab, rep = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
W, H = 192, 108
shots = tab["shots"]; total = tab["total"]
cuts = set(); planned = set()
for s in shots:
    cuts.update((s["a"] - 1, s["a"], s["a"] + 1))
    for k in s["keys"]: cuts.update((k - 1, k, k + 1))            # camera cuts inside a shot
    for f0, _ in s["kicks"]: planned.update(range(f0 - 1, f0 + 9))  # impact shakes
    if s["x"]: planned.update(range(s["a"] - s["x"] // 2 - 1, s["a"] + s["x"] // 2 + 2))
planned.update(range(total - 60, total))                           # the fade-out
R = []
e = subprocess.run(["ffmpeg", "-i", vid, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
tail = e[e.rfind("Summary:"):]
R.append("LOUDNESS " + " | ".join(l.strip() for l in tail.splitlines() if l.strip().startswith(("I:", "LRA:", "Peak:"))))
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", vid, "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
luma, diff, prev = [], [], None
while True:
    b = p.stdout.read(W * H)
    if len(b) < W * H: break
    f = np.frombuffer(b, np.uint8).astype(np.float32) / 255
    luma.append(float(f.mean())); diff.append(0.0 if prev is None else float(np.abs(f - prev).mean())); prev = f
luma, diff = np.array(luma), np.array(diff); n = len(luma)
R.append(f"FRAMES {n} (expected {total})")
ok = np.array([i not in planned for i in range(n)])
black = [i for i in range(n) if luma[i] < 0.012 and ok[i]]
white = [i for i in range(n) if luma[i] > 0.93 and ok[i] and i not in cuts]
R.append(f"BLACK frames outside fades: {len(black)} {black[:20]}")
R.append(f"WHITE frames outside flashes: {len(white)} {white[:20]}")
# frozen runs
runs, i = [], 1
while i < n:
    j = i
    while j < n and diff[j] < 2e-4: j += 1
    if j - i >= 12: runs.append((i - 1, j - 1))
    i = max(j, i + 1)
R.append(f"FROZEN runs >= 12 frames: {len(runs)} {runs[:20]}")
# pops: a frame that differs a lot from both neighbours while the neighbours agree (not at cuts / kicks / fades)
pops = []
for i in range(2, n - 2):
    if i in cuts or i in planned or (i + 1) in cuts: continue
    base = np.median(diff[max(1, i - 6): i + 7])
    if diff[i] > 0.03 and diff[i] > 8 * max(base, 1e-3) and diff[i + 1] > 0.03 and diff[i + 1] > 8 * max(base, 1e-3): pops.append(i)
R.append(f"POP frames (single-frame jumps inside a shot): {len(pops)} {pops[:30]}")
jumps = [i for i in range(2, n - 1) if diff[i] > 0.06 and i not in cuts and i not in planned]
R.append(f"UNPLANNED hard jumps (diff > 0.06 away from cuts): {len(jumps)} {jumps[:40]}")
dark = [(s["k"], round(float(luma[s['a']:s['b']].mean()), 3)) for s in shots if s["b"] <= n and luma[s["a"]:s["b"]].mean() < 0.07]
R.append(f"VERY DARK shots (mean luma < 0.07): {dark}")
R.append("PER-SHOT mean luma: " + ", ".join(f"{s['k']} {luma[s['a']:min(n, s['b'])].mean():.2f}" for s in shots))
open(rep, "w").write("# long_qa: " + vid + "\n\n" + "\n\n".join(R) + "\n")
print("\n".join(R[:8]))
