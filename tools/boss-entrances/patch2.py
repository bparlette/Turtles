# entr v1.1: queue back-to-back entrances (Boss Rush), clear entrance state on stage/section/title resets. Targeted, idempotent.
import sys, shutil
FILES = ["/workspace/work/deploy/shell-shock-live-action/index.html", "/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html"]
EDITS = [
 ("  function entrStart(e, def) {\n    if (STATE.entr) return null;\n",
  "  function entrStart(e, def) {\n    if (STATE.entr) { if (e && def) (STATE.entrQ = STATE.entrQ || []).push([e, def]); return null; } // entr v1.1: Boss Rush - play back to back\n"),
 ("    for (const q of en.parts) q.t = q.life; // debris settles away with the cut\n",
  "    for (const q of en.parts) q.t = q.life; // debris settles away with the cut\n    while (STATE.entrQ && STATE.entrQ.length) { const nq = STATE.entrQ.shift(); if (STATE.enemies.includes(nq[0]) && nq[0].hp > 0) { entrStart(nq[0], nq[1]); break; } } // entr v1.1\n"),
 ("    Object.assign(STATE, { camX: 0, enemies: [], ", "    Object.assign(STATE, { entr: null, entrQ: null, camX: 0, enemies: [], "),
 ("    Object.assign(STATE, { section: \"B\", phase: \"waves\", camX: 0, enemies: [], ", "    Object.assign(STATE, { entr: null, entrQ: null, section: \"B\", phase: \"waves\", camX: 0, enemies: [], "),
 ("    Object.assign(STATE, { scene: \"title\", player: null, enemies: [], ", "    Object.assign(STATE, { entr: null, entrQ: null, scene: \"title\", player: null, enemies: [], "),
 ("    Object.assign(STATE, { sec: i, camX: 0, enemies: [], ", "    Object.assign(STATE, { entr: null, entrQ: null, sec: i, camX: 0, enemies: [], "),
]
for f in FILES:
    s = open(f).read()
    if "entr v1.1" in s: print("already", f); continue
    for a, b in EDITS:
        if s.count(a) != 1: print("ANCHOR", s.count(a), f, a[:70]); sys.exit(1)
    shutil.copy(f, "/workspace/work/boss_ent/bak_" + ("deploy" if "deploy" in f else "built") + "_index_pre_v11.html")
    s = open(f).read()
    for a, b in EDITS: s = s.replace(a, b, 1)
    open(f, "w").write(s); print("patched", f)
