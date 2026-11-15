#!/usr/bin/env python3
"""Contact sheets of review stills with the frame number and shot name on each cell.
usage: python scripts/qa/ml-sheet.py <stills dir with f_<frame>.jpg> <frames.json [[frame, name], ...]> <out prefix> [cols=4] [rows=4] [cell width=480]"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
d, fj, pre = Path(sys.argv[1]), json.load(open(sys.argv[2])), sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4; rows = int(sys.argv[5]) if len(sys.argv) > 5 else 4; cw = int(sys.argv[6]) if len(sys.argv) > 6 else 480
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
cells = [(f, n) for f, n in fj if (d / f"f_{f}.jpg").exists()]
per = cols * rows
for s in range(0, len(cells), per):
    part = cells[s:s + per]
    im0 = Image.open(d / f"f_{part[0][0]}.jpg"); ch = round(cw * im0.height / im0.width)
    sheet = Image.new("RGB", (cols * cw, rows * ch), (20, 20, 24)); dr = ImageDraw.Draw(sheet)
    for i, (f, n) in enumerate(part):
        im = Image.open(d / f"f_{f}.jpg").resize((cw, ch), Image.LANCZOS); x, y = (i % cols) * cw, (i // cols) * ch
        sheet.paste(im, (x, y)); t = f"{f} {n}"
        dr.rectangle((x, y, x + dr.textlength(t, font=font) + 8, y + 21), fill=(0, 0, 0)); dr.text((x + 4, y + 2), t, font=font, fill=(255, 235, 120))
    out = f"{pre}{s // per + 1:02d}.jpg"; sheet.save(out, quality=86); print(out)
