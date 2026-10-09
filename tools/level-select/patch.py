import sys,re
path, game = sys.argv[1], sys.argv[2]
cfg = {"ss": dict(KEY="ssla_progress", N="15", WORD="SCENE", COLS="5", BUILT="null"),
       "sf": dict(KEY="sfwb_progress", N="12", WORD="STAGE", COLS="4", BUILT="{ 1: true } /* add N here when levels/levelN.js ships */")}[game]
blk = open('/workspace/work/lvlsel/block.js').read()
for k,v in cfg.items(): blk = blk.replace("@@%s@@"%k, v)
s = open(path).read()
if "lvlsel v1" in s: print("already patched", path); sys.exit(0)
def rep(old, new, cnt=1):
    global s
    n = s.count(old); assert n == cnt, (old[:60], n)
    s = s.replace(old, new)
rep("  // ---------- Select ----------", blk + "  // ---------- Select ----------")
rep("    titleT++; if (titleT > 480) titleScoresFirst = false;\n", "    titleT++; if (titleT > 480) titleScoresFirst = false;\n    if (titleT === 1) MENU = null;\n    if (MENU) return updateMenu(); // lvlsel\n")
rep('tapPoint = null; STATE.scene = "select"; selPick = 0; selWipe = 0; SFX.confirm();', 'tapPoint = null; SFX.confirm(); if (SKIP_BOSS) { STATE.scene = "select"; selPick = 0; selWipe = 0; } else openMenu(); // lvlsel')
rep("    drawRotateHint();\n  }", "    drawRotateHint();\n    if (MENU) drawMenu(); // lvlsel\n  }")
if game == "ss":
    rep("if (++selWipe > 22) beginLevel(STATE.selectIndex, startLevelQ()); return; }", "if (++selWipe > 22) beginLevel(STATE.selectIndex, pickLevel()); return; } // lvlsel: picked level")
else:
    rep("if (++selWipe > 22) { if (startLevelQ() === 1 && !/[?&]nomap\\b/.test(location.search)) startMap(STATE.selectIndex, 1, null); else beginLevel(STATE.selectIndex, startLevelQ()); } return; }",
        "if (++selWipe > 22) { if (pickLevel() === 1 && !/[?&]nomap\\b/.test(location.search)) startMap(STATE.selectIndex, 1, null); else beginLevel(STATE.selectIndex, pickLevel()); } return; } // lvlsel: picked level")
rep("    const LVc = curLV(); if (r.t === 1) LV_NAMES[STATE.level || 1]", "    const LVc = curLV(); if (r.t === 1) progSave(STATE.level || 1); // lvlsel: level cleared -> saved\n    if (r.t === 1) LV_NAMES[STATE.level || 1]")
open(path,'w').write(s); print("patched", path)
