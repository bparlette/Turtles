#!/usr/bin/env python3
"""genesis_sprite.py - user-supplied converter (from Brad's other AI)."""
import argparse
import sys
from PIL import Image

LEVELS = [0, 36, 73, 109, 146, 182, 219, 255]


def snap(v):
    return min(range(8), key=lambda i: abs(LEVELS[i] - v))


def snap_rgb(rgb):
    return tuple(LEVELS[snap(c)] for c in rgb)


def crop_to_alpha(img):
    bbox = img.getchannel("A").point(lambda a: 255 if a > 127 else 0).getbbox()
    if not bbox:
        sys.exit("Image has no visible pixels.")
    return img.crop(bbox)


def add_outline(img, color):
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(img, (1, 1))
    src = out.copy().load()
    px = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src[nx, ny][3] > 0:
                        px[x, y] = color + (255,)
                        break
    return out


def pad_to_tiles(img):
    w, h = img.size
    nw, nh = (w + 7) // 8 * 8, (h + 7) // 8 * 8
    out = Image.new("P", (nw, nh), 0)
    out.paste(img, ((nw - w) // 2, nh - h))
    return out


def convert(path, height, outline, dither, out_base):
    img = Image.open(path).convert("RGBA")
    img = crop_to_alpha(img)
    w, h = img.size
    new_w = max(1, round(w * height / h))
    img = img.resize((new_w, height), Image.LANCZOS)
    a = img.getchannel("A").point(lambda v: 255 if v > 127 else 0)
    img.putalpha(a)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, al = px[x, y]
            if al:
                px[x, y] = snap_rgb((r, g, b)) + (255,)
    outline_color = (0, 0, 0)
    n_colors = 15
    if outline:
        img = add_outline(img, outline_color)
        n_colors = 14
    rgb = Image.new("RGB", img.size, (0, 0, 0))
    rgb.paste(img.convert("RGB"), mask=img.getchannel("A"))
    q = rgb.quantize(colors=n_colors, method=Image.MEDIANCUT,
                     dither=Image.FLOYDSTEINBERG if dither else Image.NONE)
    qpal = q.getpalette()[: n_colors * 3]
    colors = []
    remap = {}
    for i in range(n_colors):
        c = snap_rgb(tuple(qpal[i * 3: i * 3 + 3]))
        if c not in colors:
            colors.append(c)
        remap[i] = colors.index(c)
    if outline and outline_color not in colors:
        colors.append(outline_color)
    out_idx = {c: i + 1 for i, c in enumerate(colors)}
    result = Image.new("P", img.size, 0)
    rp, qp, ap = result.load(), q.load(), img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, al = ap[x, y]
            if not al:
                continue
            if outline and (r, g, b) == outline_color:
                rp[x, y] = out_idx[outline_color]
            else:
                rp[x, y] = remap[qp[x, y]] + 1
    final = pad_to_tiles(result)
    fp = final.load()
    flat = [255, 0, 255]
    for c in colors:
        flat += list(c)
    flat += [0] * (768 - len(flat))
    final.putpalette(flat)
    final.save(out_base + ".png", transparency=0)
    prev = final.convert("RGBA")
    pp = prev.load()
    for y in range(prev.height):
        for x in range(prev.width):
            if fp[x, y] == 0:
                pp[x, y] = (0, 0, 0, 0)
    prev.resize((prev.width * 4, prev.height * 4), Image.NEAREST).save(out_base + "_preview.png")
    lines = [f"Size: {final.width}x{final.height} px ({final.width // 8}x{final.height // 8} tiles)",
             f"Colors used: {len(colors)} + transparent", "", "CRAM words (0x0BGR):"]
    words = ["0x0000"]
    for c in colors:
        r, g, b = (LEVELS.index(v) for v in c)
        words.append(f"0x0{b * 2:X}{g * 2:X}{r * 2:X}")
    lines.append(", ".join(words))
    lines += ["", "Suggested hardware sprites (max 32x32 each):"]
    n = 0
    for y in range(0, final.height, 32):
        for x in range(0, final.width, 32):
            cw, ch = min(32, final.width - x), min(32, final.height - y)
            region = final.crop((x, y, x + cw, y + ch))
            if region.getbbox():
                n += 1
                lines.append(f"  #{n}: at ({x},{y}) size {cw}x{ch} = {cw // 8}x{ch // 8} tiles")
    lines.append(f"Total hardware sprites for this frame: {n}")
    report = "\n".join(lines)
    with open(out_base + "_report.txt", "w") as f:
        f.write(report + "\n")
    print(report)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--height", type=int, default=64)
    ap.add_argument("--outline", action="store_true")
    ap.add_argument("--dither", action="store_true")
    ap.add_argument("--out", default="sprite")
    a = ap.parse_args()
    convert(a.input, a.height, a.outline, a.dither, a.out)
