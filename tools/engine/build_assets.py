#!/usr/bin/env python3
"""build_assets.py <site dir>: write assets.json (per-level image manifests + byte sizes + core set) and sw.js (versioned)."""
import sys, os, re, json, hashlib
D = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
idx = open(os.path.join(D, "index.html")).read()
IMG = r'\.(?:png|jpg|jpeg|webp)'
ex = lambda p: os.path.isfile(os.path.join(D, p))
core = []
for m in re.finditer(r'<img[^>]*\bsrc="([^"]+)"', idx): core.append(m.group(1))
for m in re.finditer(r'"([A-Za-z0-9_./-]+' + IMG + r')"', idx): core.append(m.group(1))
for m in re.finditer(r'href="([^"]+' + IMG + r')"', idx): core.append(m.group(1))
try:
    man = json.load(open(os.path.join(D, "manifest.webmanifest")))
    for ic in man.get("icons", []): core.append(ic["src"])
except Exception: pass
core = sorted(set(c for c in core if ex(c) and not c.startswith("http") and (not c.startswith("levels/") or c == "levels/enemies_street.png")))  # other levels/* named in index.html belong to the gallery (lazy, cached on use)
levels = {}
for f in sorted(os.listdir(os.path.join(D, "levels"))):
    m = re.match(r"level(\d+)\.js$", f)
    if not m: continue
    src = open(os.path.join(D, "levels", f)).read()
    lst = sorted(set(x for x in re.findall(r'"(levels/[A-Za-z0-9_./-]+' + IMG + r')"', src) if ex(x)))
    levels[m.group(1)] = lst
allf = set(core) | {x for l in levels.values() for x in l}
sizes = {p: os.path.getsize(os.path.join(D, p)) for p in sorted(allf)}
h = hashlib.sha1()
for p in ["index.html"] + ["levels/" + f for f in sorted(os.listdir(os.path.join(D, "levels"))) if f.endswith(".js")] + sorted(allf):
    h.update(p.encode()); h.update(open(os.path.join(D, p), "rb").read())
ver = h.hexdigest()[:12]
json.dump({"version": ver, "core": core, "levels": levels, "sizes": sizes}, open(os.path.join(D, "assets.json"), "w"), separators=(",", ":"))
pre = ["./", "index.html", "assets.json", "manifest.webmanifest"] + core
sw = open(os.path.join(HERE, "tpl", "sw.js")).read().replace("__VERSION__", ver).replace("__PRECACHE__", json.dumps(pre))
open(os.path.join(D, "sw.js"), "w").write(sw)
print("assets.json + sw.js version", ver, "core", len(core), "levels", len(levels), "images", len(allf), "bytes", sum(sizes.values()))
