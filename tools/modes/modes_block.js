  // ---------- GAME MODES (modes v1): ARCADE / SPEED RUN / BOSS RUSH ----------
  // A level is a list of tagged segments: section.seg = "zone1" | "twist" | "zone2" | "arena" (untagged: first = zone1,
  // last = arena, the rest = zone2). Each mode picks segments from the same data (modeSections):
  //   ARCADE    every segment, results screens as before (RUN = null).
  //   SPEED RUN the first zone1 cut to its first wave, then the arena segment(s) with their waves stripped; the boss KO goes
  //             straight to the next level (no outro / pizza / results / map). Timer on screen; bests per level + total.
  //   BOSS RUSH arena segment(s) only, waves stripped: entrance -> boss, chained 1 -> 15 (L15: Shredder -> Super Shredder).
  // localStorage: ssla_mode (last picked tab), ssla_mode_best = { speed: { total, lv: { n: frames } }, rush: {...} }.
  const MODES = [
    { id: "arcade", label: "ARCADE", c: "#ffe040", tip: "FULL STAGES + RESULTS" },
    { id: "speed", label: "SPEED RUN", c: "#5ae0ff", tip: "1 WAVE + BOSS, NON-STOP, TIMED" },
    { id: "rush", label: "BOSS RUSH", c: "#ff6a4a", tip: "BOSSES ONLY, BACK TO BACK" },
  ];
  const MODE_KEY = "ssla_mode", MBEST_KEY = "ssla_mode_best";
  let MODE_SEL = -1, RUN = null;
  function modeSel() { if (MODE_SEL < 0) { MODE_SEL = Math.max(0, MODES.findIndex((m) => m.id === LS.get(MODE_KEY, "arcade"))); } return MODE_SEL; }
  function setModeSel(i) { MODE_SEL = (i + MODES.length) % MODES.length; LS.set(MODE_KEY, MODES[MODE_SEL].id); }
  const curModeId = () => MODES[modeSel()].id;
  const modeOn = () => !!(RUN && RUN.mode !== "arcade");
  const runMode = () => (RUN ? RUN.mode : "arcade");
  function modeBest() {
    const b = LS.get(MBEST_KEY, null) || {};
    for (const m of ["speed", "rush"]) { b[m] = b[m] && typeof b[m] === "object" ? b[m] : {}; b[m].lv = b[m].lv && typeof b[m].lv === "object" ? b[m].lv : {}; }
    return b;
  }
  function fmtT(f) { // frames (60 Hz) -> m:ss.cc
    f = Math.max(0, f | 0); const cs = Math.floor(f * 100 / 60), m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60;
    return m + ":" + String(s).padStart(2, "0") + "." + String(cs % 100).padStart(2, "0");
  }
  function runStart(mode, from) {
    RUN = mode === "arcade" ? null : { mode, from: from | 0 || 1, n: from | 0 || 1, t: 0, lvT: 0, splits: {}, bosses: 0, done: false, lvDone: false };
  }
  function runTick() { if (modeOn() && !RUN.done && !RUN.lvDone && STATE.scene === "stage") { RUN.t++; RUN.lvT++; } }
  // segment picking for plugin levels (level 1 is built in; see the startStage / updateWaves / startSectionB hooks)
  function segOf(s, i, n) { return s.seg || (i === n - 1 ? "arena" : i === 0 ? "zone1" : "zone2"); }
  function segStrip(s) { // an arena with no waves: entrance -> boss straight away
    const o = Object.assign({}, s, { _src: s._src || s, waves: [], locks: [] });
    if (s.auto) o.length = Math.min(s.length, 260);
    else if (!s.arena && s.length > W * 1.5) o.length = W;
    return o;
  }
  function segOneWave(s) {
    const o = Object.assign({}, s, { _src: s._src || s, waves: s.waves.slice(0, 1), locks: s.locks.slice(0, 1) });
    if (!o.waves.length) return o;
    if (s.auto) o.length = Math.min(s.length, (o.locks[0] || 0) + 520);
    else o.length = Math.min(s.length, Math.max(W, (o.locks[0] || 0) + W + 200));
    return o;
  }
  function modeSections(all, mode) {
    if (mode !== "speed" && mode !== "rush") return all.slice();
    const n = all.length, tag = all.map((s, i) => segOf(s, i, n));
    const arenas = all.filter((s, i) => tag[i].indexOf("arena") === 0);
    if (!arenas.length) arenas.push(all[n - 1]);
    if (mode === "rush") return arenas.map(segStrip);
    const z = all.find((s, i) => tag[i] === "zone1") || all[0];
    if (arenas.length === 1 && arenas[0] === z) return [segOneWave(z)]; // one-strip level: one wave, then the boss at its end
    return [segOneWave(z)].concat(arenas.filter((s) => s !== z).map(segStrip));
  }
  function modeLevelDone() { // the level's last boss is down (speed / rush): split, then straight on
    if (!modeOn() || RUN.lvDone) return;
    const n = STATE.level || 1, B = modeBest(), mb = B[RUN.mode], prev = mb.lv[n];
    RUN.lvDone = true; RUN.splits[n] = RUN.lvT; RUN.bosses++;
    RUN.prevLv = prev || 0; RUN.newLv = !prev || RUN.lvT < prev;
    if (RUN.newLv) { mb.lv[n] = RUN.lvT; LS.set(MBEST_KEY, B); }
    RUN.next = LV_FINAL[n] || n >= PROG_N ? 0 : n + 1;
    if (RUN.next) injectLevel(RUN.next); // prefetch while the split banner shows
    STATE.phase = "done"; STATE.modeT = 1; STATE.stars = []; STATE.balls = [];
    const p = STATE.player; if (p) Object.assign(p, { attackT: 0, atk: null, buf: 0, grabbedBy: null });
    SFX.pickup();
  }
  function modeAdvance() {
    STATE.modeT = 0;
    const p = STATE.player, broI = Math.max(0, BROTHERS.indexOf(p && p.bro)), n1 = RUN.next;
    if (n1 && !LVMISS.has(n1)) { RUN.n = n1; RUN.lvT = 0; RUN.lvDone = false; beginLevel(broI, n1, { score: STATE.score }); }
    else modeFinish();
  }
  function modeFinish() {
    RUN.done = true; RUN.endT = 0;
    const B = modeBest(), mb = B[RUN.mode], full = RUN.from === 1 && RUN.bosses >= PROG_N;
    RUN.full = full; RUN.prevTotal = mb.total || 0;
    RUN.newTotal = full && (!mb.total || RUN.t < mb.total);
    if (RUN.newTotal) { mb.total = RUN.t; LS.set(MBEST_KEY, B); }
    STATE.scene = "modeEnd"; SFX.confirm();
  }
  function updateModeEnd() {
    if (!RUN) { toTitle(); return; }
    RUN.endT++;
    if (RUN.endT > 60 && (tapPoint || anyPressed("enter", "j", " ", "escape") || BTN_A.hit)) { tapPoint = null; SFX.confirm(); RUN = null; toTitle(); }
    tapPoint = null;
  }
  function drawModeEnd() {
    const R = RUN; rect(0, 0, W, H, "#0a0614"); if (!R) return;
    const M = MODES.find((m) => m.id === R.mode) || MODES[1];
    text(M.label + (R.full ? " COMPLETE!" : " OVER"), W / 2, 18, 16, M.c);
    text("TOTAL " + fmtT(R.t), W / 2, 40, 14, "#fff");
    const B = modeBest()[R.mode];
    ptext(R.newTotal ? "NEW BEST TOTAL!" : B.total ? "BEST TOTAL " + fmtT(B.total) : R.full ? "" : "START FROM SCENE 1 FOR A TOTAL BEST", W / 2, 56, 1, R.newTotal && Math.floor(STATE.t / 8) % 2 ? "#ffe060" : "#ffd27a");
    const ns = Object.keys(R.splits).map(Number).sort((a, b) => a - b);
    ns.forEach((n, k) => {
      const col = k < 8 ? 0 : 1, row = k % 8, x = col ? W / 2 + 8 : 14, y = 72 + row * 15, f = R.splits[n], best = B.lv[n];
      rect(x, y - 6, W / 2 - 22, 13, k % 2 ? "#160e26" : "#1e1432");
      ptext(pad2(n), x + 3, y, 1, "#ffd27a", "left");
      ptext((LV_NAMES[n] || "").slice(0, 13), x + 19, y, 1, "#c8b8e0", "left");
      ptext(fmtT(f), x + W / 2 - 26, y, 1, best && f <= best ? "#7fd85a" : "#fff", "right");
    });
    if (R.endT > 60 && Math.floor(STATE.t / 20) % 2) ptext("ATTACK, ENTER OR TAP: TITLE", W / 2, 214, 1, "#ffd27a");
  }
  function drawModeHUD() { // timer pill (speed / rush), under the top bars
    if (!modeOn()) return;
    const M = MODES.find((m) => m.id === RUN.mode), y = 36;
    const lab = RUN.mode === "rush" ? "BOSS " + Math.min(PROG_N, RUN.bosses + 1) + "/" + PROG_N : "SCENE " + (STATE.level || 1) + "/" + PROG_N;
    ctx.globalAlpha = 0.72; rect(W / 2 - 46, y - 6, 92, 20, "#05040a"); ctx.globalAlpha = 1;
    rect(W / 2 - 46, y - 6, 92, 1, M.c);
    ptext(fmtT(RUN.t), W / 2, y, 1, "#fff");
    ptext(lab, W / 2, y + 8, 1, M.c);
    if (RUN.mode === "rush") for (let i = 0; i < PROG_N; i++) rect(W / 2 - 45 + i * 6, y + 13, 5, 1, i < RUN.bosses ? M.c : "#3a2a48"); // progress pips
  }
  function drawModeBanner() { // split card while the next level loads
    const t = STATE.modeT || 0, M = MODES.find((m) => m.id === runMode()) || MODES[1], n = STATE.level || 1, k = Math.min(1, t / 10);
    ctx.globalAlpha = 0.7 * k; rect(0, 78, W, 64, "#05040a"); ctx.globalAlpha = k;
    rect(0, 78, W, 1, M.c); rect(0, 141, W, 1, M.c);
    ptext((RUN.mode === "rush" ? "BOSS DOWN!  " : "SCENE " + n + " CLEAR!  ") + RUN.bosses + "/" + PROG_N, W / 2, 90, 2, M.c);
    ptext("SPLIT " + fmtT(RUN.splits[n] || 0) + "   TOTAL " + fmtT(RUN.t), W / 2, 110, 1, "#fff");
    if (RUN.prevLv) { const d = (RUN.splits[n] || 0) - RUN.prevLv; ptext((d <= 0 ? "-" : "+") + fmtT(Math.abs(d)) + (RUN.newLv ? "  NEW SCENE BEST!" : "  VS BEST " + fmtT(RUN.prevLv)), W / 2, 124, 1, d <= 0 ? "#7fd85a" : "#ff8a7a"); }
    else ptext("FIRST TIME - SCENE BEST SET", W / 2, 124, 1, "#7fd85a");
    ctx.globalAlpha = 1;
  }
  // title menu: mode tabs above the menu panel
  const MTAB_Y = 92, MTAB_H = 16, MTAB_W = 76, MTAB_GAP = 3;
  const mtabX = (i) => Math.round(W / 2 - (MODES.length * MTAB_W + (MODES.length - 1) * MTAB_GAP) / 2 + i * (MTAB_W + MTAB_GAP));
  function mtabHit(tp) { if (!tp || tp.y < MTAB_Y - 3 || tp.y > MTAB_Y + MTAB_H + 3) return -1; for (let i = 0; i < MODES.length; i++) if (tp.x >= mtabX(i) - 1 && tp.x < mtabX(i) + MTAB_W + 1) return i; return -1; }
  function drawModeTabs(blink) {
    const sel = modeSel();
    MODES.forEach((m, i) => {
      const x = mtabX(i), on = i === sel;
      rect(x - 1, MTAB_Y - 1, MTAB_W + 2, MTAB_H + 2, on ? m.c : "#3a2458");
      rect(x, MTAB_Y, MTAB_W, MTAB_H, on ? "#2a1a40" : "#140a22");
      text(m.label, x + MTAB_W / 2, MTAB_Y + MTAB_H / 2, 10, on ? m.c : "#8a7ab0");
    });
    if (blink) { ptext("<", mtabX(0) - 7, MTAB_Y + MTAB_H / 2, 1, "#ffe040"); ptext(">", mtabX(MODES.length - 1) + MTAB_W + 7, MTAB_Y + MTAB_H / 2, 1, "#ffe040"); }
  }
  function modeBestLine(n) { // grid footer / menu sub-line
    const id = curModeId(); if (id === "arcade") return "";
    const b = modeBest()[id]; return n ? (b.lv[n] ? "BEST " + fmtT(b.lv[n]) : "NO TIME YET") : b.total ? "BEST TOTAL " + fmtT(b.total) : "NO TOTAL YET";
  }

