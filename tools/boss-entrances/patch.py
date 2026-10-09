import sys, shutil, time
FILES = ["/workspace/work/deploy/shell-shock-live-action/index.html", "/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html"]
block = open("/workspace/work/boss_ent/block.js").read()
EDITS = [
 ("  // ---- Bosses: params on top of the Ramrod / Zap-Roller behaviours, or fully custom hooks ----\n",
  block + "  // ---- Bosses: params on top of the Ramrod / Zap-Roller behaviours, or fully custom hooks ----\n"),
 ("    if (cfg.spawn) safe(() => cfg.spawn(API, e));\n    return e;\n  }\n  function bossEnter",
  "    if (cfg.spawn) safe(() => cfg.spawn(API, e));\n    if (cfg.entrance) entrStart(e, cfg.entrance); // entr v1\n    return e;\n  }\n  function bossEnter"),
 ("state: \"walk\", t: 0, facing: -1, flash: 0, cool: 70, walkT: 0, side: y < 185 ? -1 : 1 }));\n  }",
  "state: \"walk\", t: 0, facing: -1, flash: 0, cool: 70, walkT: 0, side: y < 185 ? -1 : 1 }));\n    { const z = STATE.enemies.filter((o) => o.type === \"zap\"); if (z.length) entrStart(z[0], L1_ENTR.zaps(z)); } // entr v1\n  }"),
 ("state: \"intro\", t: 0, life: 0, facing: -1, flash: 0, cool: 90, walkT: 0, inv: 0, hits: [], entered: true });\n  }",
  "state: \"intro\", t: 0, life: 0, facing: -1, flash: 0, cool: 90, walkT: 0, inv: 0, hits: [], entered: true });\n    { const r = STATE.enemies[STATE.enemies.length - 1]; entrStart(r, L1_ENTR.ramrod(r)); } // entr v1\n  }"),
 ("    STATE.enemies.push(e); STATE.bossT = 150; SFX.rumble();\n    return e;",
  "    STATE.enemies.push(e); STATE.bossT = 150; SFX.rumble();\n    entrStart(e, L1_ENTR.scorcher(e)); // entr v1\n    return e;"),
 ("    if (STATE.cut) { STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); updateCut(p); return; }\n",
  "    if (STATE.cut) { STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); updateCut(p); return; }\n    if (STATE.entr) { STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); entrUpdate(p); return; } // entr v1: boss entrance set piece\n"),
 ("    if (STATE.section === \"L\") { drawLevelBG(cx); runHaz(\"drawBack\", cx); }\n    else if (STATE.section === \"B\") { drawRoom(); drawPod(cx); drawDebris(cx, true); drawRazor(STATE.cut, cx); } else drawHall(cx);\n",
  "    if (STATE.entr) entrCam(); // entr v1\n    if (STATE.section === \"L\") { drawLevelBG(cx); runHaz(\"drawBack\", cx); }\n    else if (STATE.section === \"B\") { drawRoom(); drawPod(cx); drawDebris(cx, true); drawRazor(STATE.cut, cx); } else drawHall(cx);\n    if (STATE.entr) entrDraw(\"back\", cx); // entr v1\n"),
 ("    vfxDraw(cx, false);\n    if (STATE.section === \"A\") drawHallFG(cx);\n",
  "    vfxDraw(cx, false);\n    if (STATE.entr) entrDraw(\"front\", cx); // entr v1\n    if (STATE.section === \"A\") drawHallFG(cx);\n"),
 ("\"WARNING: ZAP-ROLLERS!\", W / 2, 64, 2, \"#ff4a3a\");\n",
  "\"WARNING: ZAP-ROLLERS!\", W / 2, 64, 2, \"#ff4a3a\");\n    if (STATE.entr) entrHUD(); // entr v1\n"),
 ("    playerDrawOffset(dx, dy) { STATE.pOff = { x: +dx || 0, y: +dy || 0, t: STATE.t }; }, // draw-only, this frame\n",
  "    playerDrawOffset(dx, dy) { STATE.pOff = { x: +dx || 0, y: +dy || 0, t: STATE.t }; }, // draw-only, this frame\n    bossEntrance: (e, def) => entrStart(e, def), // entr v1 (normally via boss cfg.entrance)\n    entr: { debris: (x, y, z, n, o) => entrDebris(x, y, z, n, o), impact: (x, y, a, o) => entrImpact(x, y, a, o), puff: (x, y, n) => entrPuff(x, y, n), get active() { return !!STATE.entr; } },\n"),
 ("window.__SS = { STATE, ", "window.__SS = { STATE, entrDebugWarp, "),
]
for f in FILES:
    s = open(f).read()
    if "BOSS ENTRANCES (entr v1)" in s: print("already", f); continue
    for a, b in EDITS:
        n = s.count(a)
        if n != 1: print("ANCHOR COUNT", n, f, a[:80]); sys.exit(1)
    shutil.copy(f, "/workspace/work/boss_ent/bak_" + ("deploy" if "deploy" in f else "built") + "_index_pre_entr.html")
    s = open(f).read()  # re-read right before writing
    for a, b in EDITS: s = s.replace(a, b, 1)
    open(f, "w").write(s); print("patched", f)
