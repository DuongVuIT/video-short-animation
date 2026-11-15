#!/usr/bin/env python3
"""Xưởng phim: ghi tiến trình làm một tập vào shorts/<tập>/progress.json để AutoVideo Studio hiện realtime.

Mọi bước của pipeline (Claude, script giọng, script âm thanh, render, QA) gọi lệnh này. Chỉ dùng thư viện chuẩn.

  xuong.py init <tập> --title "..." [--series <series-id>] [--number 1] [--reset]
  xuong.py start|done|fail|skip <tập> <bước> [lời nhắn]
  xuong.py log <tập> <bước> <lời nhắn> [--level info|ok|warn|error]
  xuong.py progress <tập> <bước> <0..1 | a/b> [lời nhắn]
  xuong.py metric <tập> <bước> khoá=giá_trị ...
  xuong.py frame|unframe <tập> <ảnh> ...          (thêm / bỏ ảnh trên dải khung hình)
  xuong.py reset <tập> <bước> ...                 (đưa bước về chưa làm)
  xuong.py artifact <tập> <nhãn> <đường dẫn>
  xuong.py render <tập> --frame F --total T [--where local|modal] [--workers N] [--chunk i:xong/tổng]
  xuong.py show <tập>
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
SHORTS = ROOT / "shorts"

STAGES = [
    ("nguon", "Nguồn truyện", "BookOpen", "chọn tích, đối chiếu bản gốc"),
    ("kich-ban", "Kịch bản", "PenTool", "lời kể, nhịp, câu mở"),
    ("giong", "Giọng đọc", "Mic", "đọc, căn từng chữ, soát chữ thiếu"),
    ("phan-canh", "Phân cảnh", "Clapperboard", "shot, máy quay, mốc chữ"),
    ("boi-canh", "Bối cảnh 3D", "Mountain", "làng, sông, cây, ánh sáng"),
    ("nhan-vat", "Nhân vật", "Ghost", "diễn xuất, nét mặt, hiệu ứng"),
    ("am-thanh", "Âm thanh", "AudioWaveform", "nhạc, tiếng động, trộn"),
    ("xem-thu", "Duyệt khung", "ScanEye", "ảnh thử từng shot"),
    ("render", "Render 2K", "Cpu", "vẽ từng khung hình"),
    ("qa", "Kiểm tra", "ShieldCheck", "soi từng khung, đo âm lượng"),
    ("dang", "Gói đăng bài", "Send", "caption, hashtag, ảnh bìa, giờ đăng"),  # posting itself is tracked in series.json
]
MAX_EVENTS = 400
OUTPUTS = ("render", "qa", "dang")  # stages whose result depends on everything before them
MAX_FRAMES = 24


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def ep_dir(ep: str) -> Path:
    d = SHORTS / ep
    if not d.is_dir():
        sys.exit(f"xuong: không có thư mục tập {d}")
    return d


@contextmanager
def state(ep: str):
    """Khoá file, đọc progress.json, cho sửa, rồi ghi nguyên tử (app đọc không bao giờ gặp file viết dở)."""
    d = ep_dir(ep)
    path = d / "progress.json"
    with open(d / ".progress.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = json.loads(path.read_text()) if path.exists() else blank(ep)
        merge_stages(data)
        yield data
        data["updatedAt"] = now()
        data["status"] = overall(data)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1))
        os.replace(tmp, path)


def blank(ep: str) -> dict:
    return {"version": 1, "episode": ep, "series": "", "number": 0, "title": ep, "createdAt": now(), "updatedAt": now(),
            "status": "idle", "current": None, "stages": [], "render": None, "frames": [], "artifacts": [], "events": []}


def merge_stages(data: dict) -> None:
    have = {s["id"]: s for s in data.get("stages", [])}
    data["stages"] = [have.get(i) or {"id": i, "status": "pending", "progress": 0} for i, *_ in STAGES]
    for s, (i, label, icon, hint) in zip(data["stages"], STAGES):
        s.update(label=label, icon=icon, hint=hint)


def overall(data: dict) -> str:
    st = [s["status"] for s in data["stages"]]
    if "failed" in st:
        return "failed"
    if "running" in st:
        return "running"
    if all(x in ("done", "skipped") for x in st):
        return "done"
    return "idle" if all(x == "pending" for x in st) else "paused"


def stage(data: dict, sid: str) -> dict:
    for s in data["stages"]:
        if s["id"] == sid:
            return s
    sys.exit(f"xuong: không có bước '{sid}'. Các bước: {', '.join(i for i, *_ in STAGES)}")


def event(data: dict, sid: str | None, msg: str, level: str = "info") -> None:
    if not msg:
        return
    data["events"].append({"t": now(), "stage": sid, "level": level, "msg": msg})
    del data["events"][:-MAX_EVENTS]
    print(f"[xưởng] {data['episode']} · {sid or '-'} · {msg}", file=sys.stderr)


def rel(p: str) -> str:
    path = Path(p).resolve()
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def parse_fraction(v: str) -> float:
    if "/" in v:
        a, b = v.split("/", 1)
        return max(0.0, min(1.0, float(a) / max(1.0, float(b))))
    return max(0.0, min(1.0, float(v)))


def main(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(prog="xuong.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("init"); p.add_argument("ep"); p.add_argument("--title", required=True); p.add_argument("--series", default="")
    p.add_argument("--number", type=int, default=0); p.add_argument("--reset", action="store_true")
    for c in ("start", "done", "fail", "skip"):
        p = sub.add_parser(c); p.add_argument("ep"); p.add_argument("stage"); p.add_argument("msg", nargs="*")
    p = sub.add_parser("log"); p.add_argument("ep"); p.add_argument("stage"); p.add_argument("msg", nargs="+"); p.add_argument("--level", default="info")
    p = sub.add_parser("progress"); p.add_argument("ep"); p.add_argument("stage"); p.add_argument("value"); p.add_argument("msg", nargs="*")
    p = sub.add_parser("metric"); p.add_argument("ep"); p.add_argument("stage"); p.add_argument("pairs", nargs="+")
    p = sub.add_parser("frame"); p.add_argument("ep"); p.add_argument("paths", nargs="+")
    p = sub.add_parser("unframe"); p.add_argument("ep"); p.add_argument("paths", nargs="+")
    p = sub.add_parser("reset"); p.add_argument("ep"); p.add_argument("stages", nargs="+")
    p = sub.add_parser("artifact"); p.add_argument("ep"); p.add_argument("label"); p.add_argument("path")
    p = sub.add_parser("render"); p.add_argument("ep"); p.add_argument("--frame", type=int, required=True); p.add_argument("--total", type=int, required=True)
    p.add_argument("--where", default="local"); p.add_argument("--workers", type=int, default=1); p.add_argument("--chunk", action="append", default=[])
    p.add_argument("--msg", default="")
    p = sub.add_parser("show"); p.add_argument("ep")
    a = ap.parse_args(argv)

    if a.cmd == "show":
        data = json.loads((ep_dir(a.ep) / "progress.json").read_text())
        for s in data["stages"]:
            print(f"{s['status']:>8}  {s['label']:<14} {round(100 * s.get('progress', 0)):>3}%  {s.get('detail', '')}")
        return

    with state(a.ep) as data:
        t = now()
        if a.cmd == "init":
            if a.reset:
                data.update({k: v for k, v in blank(a.ep).items() if k not in ("createdAt",)})
                merge_stages(data)
            data.update(title=a.title, series=a.series, number=a.number)
            event(data, None, f"Mở hồ sơ tập: {a.title}", "ok")
        elif a.cmd in ("start", "done", "fail", "skip"):
            s = stage(data, a.stage)
            msg = " ".join(a.msg)
            if a.cmd == "start":
                # anything that changes before the render makes the render, its check and the post out of date
                idx = [o["id"] for o in data["stages"]].index(s["id"])
                for o in data["stages"][idx + 1:]:
                    if o["id"] in OUTPUTS and o["status"] in ("done", "skipped", "failed"):
                        o.update(status="pending", progress=0, startedAt=None, endedAt=None, seconds=None, detail="")
                        event(data, o["id"], f"{o['label']} cần làm lại", "warn")
                for o in data["stages"]:  # chỉ một bước chạy tại một thời điểm, trừ khi bước kia đang render song song
                    if o["status"] == "running" and o["id"] != s["id"] and a.stage != "render" and o["id"] != "render":
                        o["status"] = "paused"
                s.update(status="running", startedAt=t, endedAt=None, progress=0, detail=msg)
                data["current"] = s["id"]
                event(data, s["id"], f"Bắt đầu {s['label'].lower()}" + (f": {msg}" if msg else ""), "info")
            else:
                status = {"done": "done", "fail": "failed", "skip": "skipped"}[a.cmd]
                s.update(status=status, endedAt=t, detail=msg or s.get("detail", ""))
                if status == "done":
                    s["progress"] = 1
                if s.get("startedAt") and status == "done":
                    dt = (datetime.fromisoformat(t.replace("Z", "+00:00")) - datetime.fromisoformat(s["startedAt"].replace("Z", "+00:00"))).total_seconds()
                    s["seconds"] = round(dt, 1)
                level = {"done": "ok", "failed": "error", "skipped": "warn"}[status]
                verb = {"done": "Xong", "failed": "Lỗi", "skipped": "Bỏ qua"}[status]
                event(data, s["id"], f"{verb} {s['label'].lower()}" + (f": {msg}" if msg else ""), level)
                running = [o["id"] for o in data["stages"] if o["status"] == "running"]
                data["current"] = running[0] if running else (s["id"] if status == "failed" else None)
        elif a.cmd == "log":
            stage(data, a.stage)
            event(data, a.stage, " ".join(a.msg), a.level)
        elif a.cmd == "progress":
            s = stage(data, a.stage)
            s["progress"] = parse_fraction(a.value)
            if s["status"] in ("pending", "paused"):
                s.update(status="running", startedAt=s.get("startedAt") or t)
                data["current"] = s["id"]
            if a.msg:
                s["detail"] = " ".join(a.msg)
                event(data, s["id"], s["detail"])
        elif a.cmd == "metric":
            s = stage(data, a.stage)
            m = s.setdefault("metrics", {})
            for pair in a.pairs:
                k, _, v = pair.partition("=")
                m[k] = v
        elif a.cmd == "frame":
            for p in a.paths:
                r = rel(p)
                data["frames"] = [f for f in data["frames"] if f["path"] != r] + [{"path": r, "t": t}]
            del data["frames"][:-MAX_FRAMES]
        elif a.cmd == "unframe":
            drop = {rel(p) for p in a.paths}
            data["frames"] = [f for f in data["frames"] if f["path"] not in drop]
        elif a.cmd == "reset":
            for sid in a.stages:
                o = stage(data, sid)
                o.update(status="pending", progress=0, startedAt=None, endedAt=None, seconds=None, detail="")
                event(data, sid, f"{o['label']} cần làm lại", "warn")
        elif a.cmd == "artifact":
            r = rel(a.path)
            data["artifacts"] = [x for x in data["artifacts"] if x["label"] != a.label] + [{"label": a.label, "path": r, "t": t}]
            event(data, None, f"Có file mới: {a.label} → {r}", "ok")
        elif a.cmd == "render":
            s = stage(data, "render")
            r = data.get("render") or {}
            if not r or r.get("total") != a.total or a.frame < r.get("frame", 0) or s["status"] != "running":
                r = {"startedAt": t, "samples": []}
                if s["status"] != "running":
                    s.update(status="running", startedAt=t, endedAt=None)
                    event(data, "render", f"Bắt đầu render {a.total} khung ({a.where}, {a.workers} máy)")
            r.update(frame=a.frame, total=a.total, where=a.where, workers=a.workers)
            r["samples"] = (r.get("samples", []) + [[time.time(), a.frame]])[-30:]
            first, last = r["samples"][0], r["samples"][-1]
            fps = (last[1] - first[1]) / (last[0] - first[0]) if last[0] - first[0] > 2 else 0
            r["fps"] = round(fps, 2)
            r["eta"] = round((a.total - a.frame) / fps) if fps > 0 else None
            if a.chunk:
                chunks = {c["i"]: c for c in r.get("chunks", [])}
                for c in a.chunk:
                    i, _, frac = c.partition(":")
                    done_, _, tot = frac.partition("/")
                    chunks[int(i)] = {"i": int(i), "done": int(done_), "total": int(tot)}
                r["chunks"] = [chunks[k] for k in sorted(chunks)]
            data["render"] = r
            s["progress"] = a.frame / max(1, a.total)
            s["detail"] = a.msg or f"{a.frame}/{a.total} khung" + (f" · {r['fps']} khung/giây" if fps else "")
            data["current"] = "render"


if __name__ == "__main__":
    main(sys.argv[1:])
