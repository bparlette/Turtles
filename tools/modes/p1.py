import sys,re
F=sys.argv[1]; s=open(F).read()
if "GAME MODES (modes v1)" in s: print("already"); sys.exit(0)
blk=open('/workspace/work/phase2/modes_block.js').read()
blk+='''  function modeMenuItems() {
    const id = curModeId(), q = startLevelQ();
    return [
      { id: "new", label: id === "speed" ? "START RUN" : "START RUSH", sub: (q > 1 ? "FROM SCENE " + q : "SCENES 1-15") + " - " + modeBestLine(0) },
      { id: "pick", label: PROG_WORD + " SELECT", sub: id === "speed" ? "START THE RUN FROM ANY SCENE" : "START THE RUSH FROM ANY BOSS" },
      { id: "gal", label: "GALLERY", sub: "EVERY HERO, BOSS AND ENEMY" },
    ];
  }
'''
R=[
("  // ---------- LEVEL SELECT + SAVED PROGRESS (lvlsel v1) ----------", blk+"  // ---------- LEVEL SELECT + SAVED PROGRESS (lvlsel v1) ----------"),
("  function menuItems() {\n    const nx = progNext(), p = progGet(), it = [];", "  function menuItems() {\n    if (curModeId() !== \"arcade\") return modeMenuItems(); // modes v1\n    const nx = progNext(), p = progGet(), it = [];"),
("const MENU_PX = W / 2 - 116, MENU_PW = 232, MENU_Y0 = 100, MENU_RH = 26;", "const MENU_PX = W / 2 - 116, MENU_PW = 232, MENU_Y0 = 126, MENU_RH = 22; // modes v1: 126/22 (was 100/26) to fit the mode tabs"),
("ctx.fillRect(MENU_PX + 4, y - 11, MENU_PW - 8, 28); }", "ctx.fillRect(MENU_PX + 4, y - 9, MENU_PW - 8, 23); }"),
("        text(c.label, W / 2, y, 14, sel ? \"#ffe040\" : \"#c8b8e0\");\n        ptext(c.sub, W / 2, y + 12, 1,", "        text(c.label, W / 2, y, 13, sel ? \"#ffe040\" : \"#c8b8e0\");\n        ptext(c.sub, W / 2, y + 10, 1,"),
("      rect(MENU_PX, py, MENU_PW, 2, \"#3a2a6a\");\n", "      rect(MENU_PX, py, MENU_PW, 2, \"#3a2a6a\");\n      drawModeTabs(blink); // modes v1\n"),
("      ptext(\"UP/DOWN + ENTER, OR TAP\", W / 2, 212, 1, \"#ffd27a\");", "      ptext(\"MODE: LEFT/RIGHT OR TAP A TAB  -  \" + MODES[modeSel()].tip, W / 2, 219, 1, \"#ffd27a\");"),
("      if (anyPressed(\"arrowdown\", \"s\")) { M.i = (M.i + 1) % it.length; SFX.menuMove(); }\n",
 "      if (anyPressed(\"arrowdown\", \"s\")) { M.i = (M.i + 1) % it.length; SFX.menuMove(); }\n      { // modes v1: mode tabs (left/right or tap)\n        let mi = -1; if (anyPressed(\"arrowleft\", \"a\")) mi = modeSel() - 1; else if (anyPressed(\"arrowright\", \"d\")) mi = modeSel() + 1;\n        const ti = M.t > 4 ? mtabHit(tp) : -1; if (ti >= 0) mi = ti;\n        if (mi >= 0 || ti >= 0) { if (mi !== modeSel()) { setModeSel(mi); M.i = 0; SFX.menuMove(); } return; }\n      }\n"),
("    text(PROG_WORD + \" SELECT\", W / 2, 14, 15, \"#fff\");", "    text((curModeId() !== \"arcade\" ? MODES[modeSel()].label + \": \" : \"\") + PROG_WORD + \" SELECT\", W / 2, 14, 15, curModeId() !== \"arcade\" ? MODES[modeSel()].c : \"#fff\");"),
("    const st = !built ? \"COMING SOON\" : done ?", "    const st = !built ? \"COMING SOON\" : curModeId() !== \"arcade\" ? MODES[modeSel()].label + \" - \" + modeBestLine(n) : done ?"),
("    PICK_LV = n; MENU = null; STATE.scene = \"select\"; selPick = 0; selWipe = 0;", "    PICK_LV = n; MENU = null; STATE.scene = \"select\"; selPick = 0; selWipe = 0; runStart(curModeId(), n); // modes v1"),
("    if (STATE.section === \"A\") for (const o of L1_PROPS) spawnProp(o);\n", "    if (STATE.section === \"A\") for (const o of L1_PROPS) spawnProp(o);\n    if (modeOn() && STATE.section === \"A\") { if (RUN.mode === \"rush\") startSectionB(); else LOCKS = L1_LOCKS.slice(0, 1); } // modes v1: L1 segments\n    if (modeOn()) STATE.cardT = 90;\n"),
("        if (STATE.wave >= LOCKS.length) { STATE.phase = \"boss\"; spawnZaps(); }", "        if (STATE.wave >= LOCKS.length) { STATE.phase = \"boss\"; if (modeOn()) STATE.fadeOut = 1; else spawnZaps(); } // modes v1: speed run goes straight to Ramrod"),
("    resetWorldBits(); for (const o of L1B_PROPS) spawnProp(o);\n", "    resetWorldBits(); for (const o of L1B_PROPS) spawnProp(o);\n    if (modeOn()) { STATE.queue = []; STATE.bWave = 2; STATE.spawnT = 30; } // modes v1: arena = boss only\n"),
("  function startCut() {\n    const p = STATE.player;", "  function startCut() {\n    if (modeOn()) { modeLevelDone(); return; } // modes v1\n    const p = STATE.player;"),
("  function finishLevel(LV) {\n    STATE.clearT = 0; STATE.phase = \"done\";", "  function finishLevel(LV) {\n    STATE.clearT = 0; STATE.phase = \"done\";\n    if (modeOn()) { modeLevelDone(); return; } // modes v1: no outro / pizza / results"),
("  function startPizza() {\n", "  function startPizza() {\n    if (modeOn()) { modeLevelDone(); return; } // modes v1\n"),
("    STATE.section = \"L\"; enterSection(0, true);", "    if (!LV._secAll) LV._secAll = LV.sections; LV.sections = modeSections(LV._secAll, runMode()); // modes v1: pick segments\n    STATE.section = \"L\"; enterSection(0, true);"),
("(S && S === curLV().sections[0] ? LEVEL_LIGHTS", "(S && (S._src || S) === (curLV()._secAll || curLV().sections)[0] ? LEVEL_LIGHTS"),
("    if (STATE.fadeOut > 0) { if (++STATE.fadeOut >= 45) { if (STATE.section === \"L\") enterSection(STATE.sec + 1); else startSectionB(); } return; }\n",
 "    if (STATE.fadeOut > 0) { if (++STATE.fadeOut >= 45) { if (STATE.section === \"L\") enterSection(STATE.sec + 1); else startSectionB(); } return; }\n    if (STATE.modeT) { STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); if (++STATE.modeT > 110 || (STATE.modeT > 30 && (tapPoint || BTN_A.hit || anyPressed(\"enter\", \"j\", \" \")))) { tapPoint = null; modeAdvance(); } return; } // modes v1 split banner\n"),
("    if (STATE.pizza) drawPizza();\n    if (STATE.results) drawResults();", "    drawModeHUD(); if (STATE.modeT) drawModeBanner(); // modes v1\n    if (STATE.pizza) drawPizza();\n    if (STATE.results) drawResults();"),
("      SCENES[STATE.scene].update();\n", "      SCENES[STATE.scene].update();\n      runTick(); // modes v1\n"),
("    initials: { update: updateInitials, draw: drawInitials },\n", "    initials: { update: updateInitials, draw: drawInitials },\n    modeEnd: { update: updateModeEnd, draw: drawModeEnd }, // modes v1\n"),
("  function toTitle() {\n    unloadAllExcept(0);", "  function toTitle() {\n    unloadAllExcept(0); RUN = null; STATE.modeT = 0; // modes v1"),
("    if (s === \"loading\") return MUS.cur;\n", "    if (s === \"loading\") return MUS.cur;\n    if (s === \"modeEnd\" || STATE.modeT) return \"clear\"; // modes v1\n"),
]
for a,b in R:
  c=s.count(a)
  if c!=1: print("COUNT",c,repr(a[:80])); sys.exit(1)
  s=s.replace(a,b)
open(F,'w').write(s); print("ok",len(R))
