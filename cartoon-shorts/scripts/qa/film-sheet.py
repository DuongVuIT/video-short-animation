#!/usr/bin/env python3
"""Contact sheet of stills named <prefix><frame>.jpg, each cell labelled with its frame and shot name (from a shot table
made by scripts/qa/film-shots.sh). usage:
  .venv/bin/python scripts/qa/film-sheet.py <prefix e.g. out/cgl/x_> <shots.json> <out.jpg> [cols=4] [cell width=480] [frames a,b,c]"""
import glob, json, re, sys
from PIL import Image, ImageDraw, ImageFont
pre, shots, out = sys.argv[1], json.load(open(sys.argv[2]))["shots"], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4; cw = int(sys.argv[5]) if len(sys.argv) > 5 else 480
want = set(map(int, sys.argv[6].split(","))) if len(sys.argv) > 6 else None
fr = sorted(int(m.group(1)) for p in glob.glob(pre + "*.jpg") if (m := re.fullmatch(re.escape(pre) + r"(\d+)\.jpg", p)))
if want: fr = [f for f in fr if f in want]
name = lambda f: next((s["k"] for s in shots if s["a"] <= f < s["b"]), "?")
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
im0 = Image.open(f"{pre}{fr[0]}.jpg"); ch = round(cw * im0.height / im0.width); rows = -(-len(fr) // cols)
sheet = Image.new("RGB", (cols * cw, rows * ch), (20, 20, 24)); dr = ImageDraw.Draw(sheet)
for i, f in enumerate(fr):
    x, y = (i % cols) * cw, (i // cols) * ch
    sheet.paste(Image.open(f"{pre}{f}.jpg").resize((cw, ch), Image.LANCZOS), (x, y)); t = f"{f} {name(f)}"
    dr.rectangle((x, y, x + dr.textlength(t, font=font) + 8, y + 21), fill=(0, 0, 0)); dr.text((x + 4, y + 2), t, font=font, fill=(255, 235, 120))
sheet.save(out, quality=88); print(out, len(fr), "frames")
