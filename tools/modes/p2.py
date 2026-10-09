import sys
F=sys.argv[1]; s=open(F).read()
if "MID-LEVEL TWISTS (twist v1)" in s: print("already"); sys.exit(0)
blk=open('/workspace/work/phase2/twist_block.js').read()
R=[
("  // ---- The API handed to level files ----", blk+"  // ---- The API handed to level files ----"),
("  const curLV = () => ((STATE.level || 1) > 1 ? LEVELS[STATE.level - 1] || null : null);", "  const curLV = () => ((STATE.level || 1) > 1 ? LEVELS[STATE.level - 1] || null : STATE.l1x && STATE.section === \"L\" ? L1X : null); // twist v1: L1X = level 1's twist + lobby"),
("    if (STATE.fadeOut > 0) { if (++STATE.fadeOut >= 45) { if (STATE.section === \"L\") enterSection(STATE.sec + 1); else startSectionB(); } return; }",
 "    if (STATE.fadeOut > 0) { if (++STATE.fadeOut >= 45) { if (STATE.section === \"L\") { if (STATE.l1x && STATE.sec + 1 >= L1X.sections.length) startSectionB(); else enterSection(STATE.sec + 1); } else if (STATE.section === \"A\" && !modeOn()) startL1X(); else startSectionB(); } return; } // twist v1: L1 hallway -> L1X -> room"),
("      else if (last) { STATE.phase = \"boss\"; STATE.ramrodOn = true; } // no boss: finish straight away", "      else if (last && !LV.cont) { STATE.phase = \"boss\"; STATE.ramrodOn = true; } // no boss: finish straight away (twist v1: LV.cont = carries on, L1X)"),
("    STATE.haz = (LV.hazards || []).concat(S.hazards || []).map((h) => ({ h, st: h.init ? safe(() => h.init(API, S), {}) || {} : {} }));\n",
 "    STATE.haz = (LV.hazards || []).concat(S.hazards || []).map((h) => ({ h, st: h.init ? safe(() => h.init(API, S), {}) || {} : {} }));\n    STATE.tw = null; if (S.twist) STATE.haz.push({ h: TW_HAZ, st: {} }); // twist v1\n"),
("    if (S.onUpdate) safe(() => S.onUpdate(API, p));\n    if (STATE.goT > 0) STATE.goT--;", "    if (S.onUpdate) safe(() => S.onUpdate(API, p));\n    if (S.twist && twGate(p, S)) return; // twist v1\n    if (STATE.goT > 0) STATE.goT--;"),
("    drawModeHUD(); if (STATE.modeT) drawModeBanner(); // modes v1", "    twHUD(); drawModeHUD(); if (STATE.modeT) drawModeBanner(); // modes v1 + twist v1"),
("    if (modeOn() && STATE.section === \"A\") {", "    STATE.l1x = false; STATE.tw = null; // twist v1\n    if (modeOn() && STATE.section === \"A\") {"),
]
for a,b in R:
  c=s.count(a)
  if c!=1: print("COUNT",c,repr(a[:90])); sys.exit(1)
  s=s.replace(a,b)
open(F,'w').write(s); print("ok",len(R))
