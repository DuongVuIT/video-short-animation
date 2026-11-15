#!/usr/bin/env python3
"""Phụ đề .srt từ words.json của lời kể (để tải lên YouTube / Facebook, không in vào hình).
   make_srt.py <thư mục voice> <ra.srt> [số chữ tối đa một dòng = 11] [đến câu số mấy]
Ngắt dòng ở dấu câu; dòng dài hơn mức tối đa thì ngắt tiếp ở dấu phẩy gần giữa, không có thì ngắt giữa."""
import json, sys, re
src, out = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 11
LAST = int(sys.argv[4]) if len(sys.argv) > 4 else 10 ** 9
words = [w for w in json.load(open(f"{src}/words.json")) if w["line"] <= LAST]
def ts(t):
    ms = int(round(t * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
def split(ws):
    if len(ws) <= MAX: return [ws]
    cuts = [i + 1 for i, w in enumerate(ws[:-1]) if w["w"][-1] in ",;:" and 3 <= i + 1 <= len(ws) - 3]
    c = min(cuts, key=lambda i: abs(i - len(ws) / 2)) if cuts else len(ws) // 2
    return split(ws[:c]) + split(ws[c:])
cues, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    end = i + 1 == len(words) or words[i + 1]["line"] != w["line"] or re.search(r"[.!?…]$", w["w"])
    if end: cues += split(cur); cur = []
with open(out, "w") as f:
    for n, c in enumerate(cues, 1):
        e = c[-1]["e"] + 0.15
        if n < len(cues): e = min(e, cues[n][0]["s"] - 0.02)
        f.write(f"{n}\n{ts(c[0]['s'])} --> {ts(max(e, c[0]['s'] + 0.3))}\n{' '.join(w['w'] for w in c)}\n\n")
print(len(cues), "dòng phụ đề ->", out)
