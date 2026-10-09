# Targeted level edits applied to deploy + built mirror (fresh read each, unique anchors, backup once).
import sys, os, shutil
D = "/workspace/work/deploy/shell-shock-live-action/levels/"
B = "/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/levels/"
def apply(n, edits, marker="entr v1"):
    for root in (D, B):
        f = root + "level%d.js" % n
        s = open(f).read()
        if marker in s: print("already", f); continue
        for a, b in edits:
            c = s.count(a)
            if c != 1: print("ANCHOR", c, f, repr(a[:70])); sys.exit(1)
        bk = "/workspace/work/boss_ent/bak_levels/" + ("deploy" if root == D else "built") + "_level%d.js" % n
        os.makedirs(os.path.dirname(bk), exist_ok=True)
        if not os.path.exists(bk): shutil.copy(f, bk)
        s = open(f).read()
        for a, b in edits: s = s.replace(a, b, 1)
        open(f, "w").write(s); print("patched", f)
