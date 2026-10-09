  // ---------- LEVEL SELECT + SAVED PROGRESS (lvlsel v1) ----------
  // PUSH START opens a cabinet menu: CONTINUE (resume after the last cleared level) / NEW GAME / LEVEL SELECT.
  // Progress lives in localStorage[PROG_KEY] = { done: [cleared levels], last: last cleared, bro: fighter index }.
  // Saved on the results card (updateResults r.t === 1). The picked level feeds updateSelect via pickLevel().
  const PROG_KEY = "@@KEY@@", PROG_N = @@N@@, PROG_WORD = "@@WORD@@", PROG_COLS = @@COLS@@;
  const PROG_BUILT = @@BUILT@@; // null = every level has content; else { n: true } for built stages only
  const progBuilt = (n) => n >= 1 && n <= PROG_N && (!PROG_BUILT || !!PROG_BUILT[n]);
  function progGet() {
    const p = LS.get(PROG_KEY, null) || {};
    const done = Array.isArray(p.done) ? p.done.map((n) => n | 0).filter((n) => n >= 1 && n <= PROG_N) : [];
    return { done, last: Math.max(0, Math.min(PROG_N, p.last | 0)), bro: p.bro | 0 };
  }
  function progSave(n) {
    n = n | 0; if (n < 1 || n > PROG_N) return;
    const p = progGet(); if (p.done.indexOf(n) < 0) p.done.push(n);
    p.done.sort((a, b) => a - b); p.last = n;
    if (STATE.player) p.bro = Math.max(0, BROTHERS.indexOf(STATE.player.bro));
    LS.set(PROG_KEY, p);
  }
  function progNext() { const p = progGet(); if (!p.last) return 0; return LV_FINAL[p.last] || p.last >= PROG_N ? -1 : p.last + 1; } // 0 = no save, -1 = finale cleared
  let MENU = null, PICK_LV = 0;
  const pickLevel = () => PICK_LV || startLevelQ();
  const pad2 = (n) => String(n).padStart(2, "0");
  function menuItems() {
    const nx = progNext(), p = progGet(), it = [];
    if (nx) it.push({ id: "cont", label: "CONTINUE", sub: nx < 0 ? "ALL CLEAR! PICK ANY " + PROG_WORD : progBuilt(nx) ? PROG_WORD + " " + nx + " - " + (LV_NAMES[nx] || "") : "NEXT: " + PROG_WORD + " " + nx + " COMING SOON" });
    const q = startLevelQ();
    it.push({ id: "new", label: "NEW GAME", sub: PROG_WORD + " " + q + " - " + (LV_NAMES[q] || "") });
    it.push({ id: "pick", label: PROG_WORD + " SELECT", sub: p.done.length + " / " + PROG_N + " CLEAR" });
    return it;
  }
  function progProbe() { // stages not in PROG_BUILT: a HEAD probe of levels/levelN.js unlocks them once the file ships (http only)
    if (!PROG_BUILT || !window.fetch || location.protocol === "file:") return;
    for (let n = 1; n <= PROG_N; n++) if (!PROG_BUILT[n] && !progProbe.seen[n]) {
      progProbe.seen[n] = 1;
      try { fetch("levels/level" + n + ".js", { method: "HEAD", cache: "no-store" }).then((r) => { if (r.ok && /javascript/i.test(r.headers.get("content-type") || "")) PROG_BUILT[n] = true; }).catch(() => {}); } catch (_) {}
    }
  }
  progProbe.seen = {};
  function openMenu() { progProbe(); MENU = { mode: "menu", i: 0, t: 0, cur: 1, note: "", noteT: 0 }; }
  function openGrid(cur, note) { Object.assign(MENU, { mode: "grid", t: 0, cur: Math.max(1, Math.min(PROG_N, cur || 1)), note: note || "", noteT: note ? 240 : 0 }); }
  function goSelect(n, cont) {
    PICK_LV = n; MENU = null; STATE.scene = "select"; selPick = 0; selWipe = 0;
    if (cont) { const b = progGet().bro; if (b >= 0 && b < BROTHERS.length) STATE.selectIndex = b; }
  }
  const MENU_PX = W / 2 - 116, MENU_PW = 232, MENU_Y0 = 104, MENU_RH = 30;
  const GRID_ROWS = Math.ceil(PROG_N / PROG_COLS), GRID_GAP = 5, GRID_X0 = 12, GRID_Y0 = 30, GRID_BOT = 166;
  const GRID_TW = Math.floor((W - GRID_X0 * 2 - GRID_GAP * (PROG_COLS - 1)) / PROG_COLS);
  const GRID_TH = Math.floor((GRID_BOT - GRID_Y0 - GRID_GAP * (GRID_ROWS - 1)) / GRID_ROWS);
  const gridTile = (n) => ({ x: GRID_X0 + ((n - 1) % PROG_COLS) * (GRID_TW + GRID_GAP), y: GRID_Y0 + Math.floor((n - 1) / PROG_COLS) * (GRID_TH + GRID_GAP) });
  const GRID_BACK = { x: 6, y: 5, w: 52, h: 17 }, GRID_PLAY = { x: W - 82, y: 174, w: 74, h: 28 };
  const lsInBox = (t, b) => t && t.x >= b.x && t.x < b.x + b.w && t.y >= b.y && t.y < b.y + b.h;
  function updateMenu() {
    const M = MENU; M.t++; if (M.noteT > 0) M.noteT--;
    const ok = M.t > 4 && anyPressed("enter", " ", "j", "k");
    let back = M.t > 4 && anyPressed("escape", "backspace", "l");
    const tp = tapPoint; tapPoint = null;
    if (M.mode === "menu") {
      const it = menuItems(); M.i = Math.max(0, Math.min(it.length - 1, M.i));
      if (anyPressed("arrowup", "w")) { M.i = (M.i + it.length - 1) % it.length; SFX.menuMove(); }
      if (anyPressed("arrowdown", "s")) { M.i = (M.i + 1) % it.length; SFX.menuMove(); }
      let go = ok;
      if (tp && tp.x >= 0 && M.t > 4) { // taps off the screen (cabinet art) are ignored here
        const k = it.findIndex((_, j) => tp.x >= MENU_PX && tp.x < MENU_PX + MENU_PW && Math.abs(tp.y - (MENU_Y0 + j * MENU_RH + 6)) <= MENU_RH / 2);
        if (k >= 0) { M.i = k; go = true; } else if (tp.y < MENU_Y0 - 16) back = true;
      }
      if (back) { MENU = null; SFX.menuMove(); return; }
      if (!go) return;
      SFX.confirm();
      const c = it[M.i], nx = progNext();
      if (c.id === "cont") { if (nx > 0 && progBuilt(nx)) goSelect(nx, true); else openGrid(nx > 0 ? 1 : PROG_N, nx < 0 ? "ALL " + PROG_N + " CLEAR - PICK ANY " + PROG_WORD : PROG_WORD + " " + nx + " IS COMING SOON"); }
      else if (c.id === "new") goSelect(startLevelQ(), false);
      else openGrid(nx > 0 && progBuilt(nx) ? nx : 1, "");
      return;
    }
    // grid
    let n = M.cur;
    if (anyPressed("arrowleft", "a")) n = n > 1 ? n - 1 : PROG_N;
    if (anyPressed("arrowright", "d")) n = n < PROG_N ? n + 1 : 1;
    if (anyPressed("arrowup", "w")) n = n - PROG_COLS >= 1 ? n - PROG_COLS : n;
    if (anyPressed("arrowdown", "s")) n = n + PROG_COLS <= PROG_N ? n + PROG_COLS : n;
    if (n !== M.cur) { M.cur = n; SFX.menuMove(); }
    let go = ok;
    if (tp && M.t > 4) {
      if (lsInBox(tp, GRID_BACK)) back = true;
      else if (lsInBox(tp, GRID_PLAY)) go = true;
      else for (let k = 1; k <= PROG_N; k++) { const g = gridTile(k); if (tp.x >= g.x - 2 && tp.x < g.x + GRID_TW + 2 && tp.y >= g.y - 2 && tp.y < g.y + GRID_TH + 2) { if (k === M.cur) go = true; else { M.cur = k; SFX.menuMove(); } break; } }
    }
    if (back) { M.mode = "menu"; M.t = 0; M.i = menuItems().findIndex((c) => c.id === "pick"); SFX.menuMove(); return; }
    if (go) {
      if (progBuilt(M.cur)) { SFX.confirm(); goSelect(M.cur, false); }
      else { SFX.clink(); M.note = PROG_WORD + " " + M.cur + " IS COMING SOON"; M.noteT = 120; }
    }
  }
  function drawCheck(cx, cy, r) {
    ctx.fillStyle = "#0a1a0a"; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, 6.29); ctx.fill();
    ctx.fillStyle = "#3fae3a"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy + r * 0.05); ctx.lineTo(cx - r * 0.1, cy + r * 0.45); ctx.lineTo(cx + r * 0.55, cy - r * 0.4); ctx.stroke();
    ctx.lineWidth = 1; ctx.lineCap = "butt";
  }
  function wrapName(s, maxW, size) {
    ctx.font = `bold ${size}px monospace`;
    const out = []; let line = "";
    for (const w of String(s).split(" ")) { const tr = line ? line + " " + w : w; if (ctx.measureText(tr).width <= maxW || !line) line = tr; else { out.push(line); line = w; } }
    if (line) out.push(line);
    return out.slice(0, 2);
  }
  function drawMenu() {
    const M = MENU; if (!M) return;
    const blink = Math.floor(STATE.t / 8) % 2 === 0;
    if (M.mode === "menu") {
      ctx.globalAlpha = 0.78; rect(0, 84, W, H - 84, "#05040a"); ctx.globalAlpha = 1;
      const it = menuItems(), ph = it.length * MENU_RH + 10, py = MENU_Y0 - 14;
      rect(MENU_PX - 3, py - 3, MENU_PW + 6, ph + 6, "#ffe040"); rect(MENU_PX, py, MENU_PW, ph, "#1a0e2c");
      rect(MENU_PX, py, MENU_PW, 2, "#3a2a6a");
      it.forEach((c, j) => {
        const y = MENU_Y0 + j * MENU_RH, sel = j === M.i;
        if (sel) { const g = ctx.createLinearGradient(0, y - 11, 0, y + 17); g.addColorStop(0, "#3a2a6a"); g.addColorStop(1, "#6a3a5a"); ctx.fillStyle = g; ctx.fillRect(MENU_PX + 4, y - 11, MENU_PW - 8, 28); }
        if (sel && blink) { ptext(">", MENU_PX + 12, y, 2, "#ffe040", "left"); ptext("<", MENU_PX + MENU_PW - 12, y, 2, "#ffe040", "right"); }
        text(c.label, W / 2, y, 14, sel ? "#ffe040" : "#c8b8e0");
        ptext(c.sub, W / 2, y + 12, 1, sel ? "#fff" : "#8a7ab0");
      });
      ptext("UP/DOWN + ENTER, OR TAP", W / 2, 212, 1, "#ffd27a");
      return;
    }
    // grid: full-screen cabinet picker
    rect(0, 0, W, H, "#120822");
    const p = progGet();
    text(PROG_WORD + " SELECT", W / 2, 14, 15, "#fff");
    rect(GRID_BACK.x, GRID_BACK.y, GRID_BACK.w, GRID_BACK.h, "#3a2458"); rect(GRID_BACK.x + 1, GRID_BACK.y + 1, GRID_BACK.w - 2, GRID_BACK.h - 2, "#1a0e2c");
    ptext("< BACK", GRID_BACK.x + GRID_BACK.w / 2, GRID_BACK.y + GRID_BACK.h / 2, 1, "#c8ccd6");
    ptext(p.done.length + "/" + PROG_N + " CLEAR", W - 34, 14, 1, "#7fd85a", "right"); // clear of the mute icon
    for (let n = 1; n <= PROG_N; n++) {
      const { x, y } = gridTile(n), sel = n === M.cur, done = p.done.indexOf(n) >= 0, built = progBuilt(n), fin = !!LV_FINAL[n];
      const fc = sel ? (blink ? "#ffe040" : "#c89a20") : done ? "#3fae3a" : fin ? "#a8302a" : "#3a2458";
      rect(x - 2, y - 2, GRID_TW + 4, GRID_TH + 4, fc);
      const g = ctx.createLinearGradient(0, y, 0, y + GRID_TH); g.addColorStop(0, sel ? "#3a2a6a" : built ? "#24163e" : "#161020"); g.addColorStop(1, sel ? "#6a3a5a" : built ? "#1a0e2c" : "#100a18");
      ctx.fillStyle = g; ctx.fillRect(x, y, GRID_TW, GRID_TH);
      ptext(pad2(n), x + 5, y + 9, 2, built ? (sel ? "#ffe040" : "#fff") : "#5a4a70", "left");
      if (fin && !done) ptext("FINALE", x + 31, y + 9, 1, built ? "#ff8a7a" : "#6a3a40", "left");
      const lines = wrapName(LV_NAMES[n] || "???", GRID_TW - 8, 7);
      const ly = y + GRID_TH - 6 - (lines.length - 1) * 8;
      if (built) lines.forEach((ln, k) => text(ln, x + GRID_TW / 2, ly + k * 8, 7, sel ? "#fff" : "#c8b8e0"));
      else {
        lines.forEach((ln, k) => text(ln, x + GRID_TW / 2, y + 21 + k * 7, 7, "#6a5a80"));
        ctx.globalAlpha = 0.9; rect(x, y + GRID_TH - 10, GRID_TW, 10, "#000"); ctx.globalAlpha = 1;
        ptext("COMING SOON", x + GRID_TW / 2, y + GRID_TH - 5, 1, blink && sel ? "#ffe040" : "#ff8c1a");
      }
      if (done) drawCheck(x + GRID_TW - 9, y + 9, 6);
      if (!sel && built) { ctx.globalAlpha = 0.25; rect(x, y, GRID_TW, GRID_TH, "#000"); ctx.globalAlpha = 1; }
    }
    // footer: the cursor level, its status, and a PLAY button for touch
    const n = M.cur, done = p.done.indexOf(n) >= 0, built = progBuilt(n);
    rect(6, 172, W - 12, 32, "#2a1840"); rect(7, 173, W - 14, 30, "#1a0e2c");
    ptext(PROG_WORD + " " + pad2(n), 14, 181, 1, "#ffd27a", "left");
    text(LV_NAMES[n] || "", 14 + (PROG_WORD.length + 3) * 6 + 6, 181, 10, "#fff", "left");
    const st = !built ? "COMING SOON" : done ? "CLEARED" : LV_FINAL[n] ? "THE FINALE" : "NOT CLEARED YET";
    ptext(st, 14, 195, 1, !built ? "#ff8c1a" : done ? "#7fd85a" : "#8a7ab0", "left");
    if (done) drawCheck(14 + st.length * 6 + 6, 195, 5);
    const pb = GRID_PLAY, pc = built ? (blink ? "#ffe040" : "#c89a20") : "#3a2458";
    rect(pb.x, pb.y, pb.w, pb.h, pc); rect(pb.x + 2, pb.y + 2, pb.w - 4, pb.h - 4, built ? "#6a3a1a" : "#1a0e2c");
    text(built ? "PLAY" : "SOON", pb.x + pb.w / 2, pb.y + pb.h / 2, 13, built ? "#fff" : "#5a4a70");
    if (M.noteT > 0 && M.note) { ctx.globalAlpha = Math.min(1, M.noteT / 20); rect(W / 2 - 130, 92, 260, 20, "#000"); rect(W / 2 - 129, 93, 258, 18, "#a8302a"); ptext(M.note, W / 2, 102, 1, "#fff"); ctx.globalAlpha = 1; }
    ptext("ARROWS + ENTER / TAP TWICE  -  ESC: BACK", W / 2, 215, 1, "#ffd27a");
  }

