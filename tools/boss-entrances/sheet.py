# python3 sheet.py out.jpg case1 case2 ...  -> rows of entrance keyframes (0..4 + end) per case
import sys
from PIL import Image, ImageDraw
out, cases = sys.argv[1], sys.argv[2:]
cw, ch = 384, 224
sheet = Image.new('RGB', (6 * cw, len(cases) * (ch + 16)), (16, 16, 24))
d = ImageDraw.Draw(sheet)
for r, c in enumerate(cases):
    d.text((4, r * (ch + 16) + 2), c, fill=(255, 224, 96))
    for i, k in enumerate(['0', '1', '2', '3', '4', 'end']):
        try: im = Image.open(f'shots/{c}_{k}.png').convert('RGB').resize((cw, ch))
        except Exception: continue
        sheet.paste(im, (i * cw, r * (ch + 16) + 16))
sheet.save(out, quality=82); print(out, sheet.size)
