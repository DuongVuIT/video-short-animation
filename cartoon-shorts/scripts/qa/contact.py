# usage: python scripts/qa/contact.py out.jpg cols w img1 img2 ...  (labels = the frame number in the file name)
import sys, re
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ims = [Image.open(p).convert("RGB") for p in sys.argv[4:]]
h = int(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "black")
d = ImageDraw.Draw(sheet)
for i, (p, im) in enumerate(zip(sys.argv[4:], ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im.resize((w, h)), (x, y))
    lab = re.findall(r"(\d+)\.jpg$", p)
    d.rectangle([x, y, x + 46, y + 16], fill="black"); d.text((x + 3, y + 2), lab[0] if lab else "", fill="yellow")
sheet.save(out, quality=88)
