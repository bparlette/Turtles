// Level select + saved progress test. GAME=ss|sf  PART=touch|keys|cont
const { chromium, devices } = require("playwright");
const GAME = process.env.GAME || "ss", PART = process.env.PART || "touch";
const URL = GAME === "ss" ? "file:///workspace/work/deploy/shell-shock-live-action/index.html" : "file:///workspace/work/sf_brawler/game/index.html";
const OUT = "/workspace/work/lvlsel/shots/" + GAME + "_";
(async () => {
  require("fs").mkdirSync("/workspace/work/lvlsel/shots", { recursive: true });
  const b = await chromium.launch();
  const ctxt = await b.newContext({ ...devices["iPhone 13"], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }); // iPhone 13 landscape
  const pg = await ctxt.newPage();
  let errs = 0; const log = (...a) => console.log(...a);
  pg.on("pageerror", (e) => { errs++; log("PAGEERROR", e.message); });
  pg.on("console", (m) => { if (m.type() === "error" && !/level2\.js|Failed to load resource/.test(m.text())) log("CONSOLE", m.text()); });
  const S = (fn, a) => pg.evaluate(fn, a);
  const until = async (cond, ms = 60000) => { await pg.waitForFunction(cond, null, { timeout: ms, polling: 100 }); };
  const frames = async (n) => { const t0 = await S(() => __SS.STATE.t); await until(`__SS.STATE.t >= ${t0 + n}`); };
  const key = async (k) => { await pg.keyboard.down(k); await pg.waitForTimeout(90); await pg.keyboard.up(k); await frames(2); };
  const shot = async (n) => { await (await pg.$("#game")).screenshot({ path: OUT + n + ".png" }); log("shot", OUT + n + ".png"); };
  const tap = async (x, y) => { const r = await S(() => { const q = document.getElementById("game").getBoundingClientRect(); return { l: q.left, t: q.top, w: q.width, h: q.height }; });
    await pg.touchscreen.tap(r.l + (x / 384) * r.w, r.t + (y / 224) * r.h); await frames(3); };
  const load = async (clear) => {
    await pg.goto(URL + "?debug&nocache"); await until("window.__SS && __SS.STATE.t > 5");
    if (clear) await S((g) => localStorage.removeItem(g === "ss" ? "ssla_progress" : "sfwb_progress"), GAME);
    await frames(60);
  };
  const prog = () => S((g) => localStorage.getItem(g === "ss" ? "ssla_progress" : "sfwb_progress"), GAME);
  // grid geometry (mirrors block.js)
  const N = GAME === "ss" ? 15 : 12, COLS = GAME === "ss" ? 5 : 4, ROWS = Math.ceil(N / COLS);
  const TW = Math.floor((384 - 24 - 5 * (COLS - 1)) / COLS), TH = Math.floor((166 - 30 - 5 * (ROWS - 1)) / ROWS);
  const tile = (n) => ({ x: 12 + ((n - 1) % COLS) * (TW + 5) + TW / 2, y: 30 + Math.floor((n - 1) / COLS) * (TH + 5) + TH / 2 });
  const menuRow = (j) => ({ x: 192, y: 104 + j * 30 + 6 });
  const pickFighterTouch = async () => { if (GAME === "ss") await tap(150, 100); else await tap(310, 110); };
  const waitStage = async (lvl) => {
    await until("['card','stage'].includes(__SS.STATE.scene) || __SS.STATE.scene === 'map'", 90000);
    if (await S(() => __SS.STATE.scene === "map")) { await frames(30); await tap(192, 112); await until("['card','stage'].includes(__SS.STATE.scene)", 90000); }
    const L = await S(() => __SS.STATE.level); log("started level", L, "expected", lvl, L === lvl ? "OK" : "FAIL");
    await until("__SS.STATE.scene === 'stage'", 90000); await frames(30);
  };
  const clearLevel = async () => { await S(() => { const T = __SS.STATE; T.enemies = []; T.queue = []; T.player.inv = 900; __SS.startPizza(); }); await until("!!__SS.STATE.results", 60000); await frames(70); };

  if (PART === "touch") {
    await load(true);
    await (await pg.screenshot({ path: OUT + "00_iphone_title.png" })); log("shot", OUT + "00_iphone_title.png");
    await tap(192, 120); await frames(20); await shot("01_menu_fresh");
    const pickRow = 1; // no save: NEW GAME, LEVEL SELECT
    await tap(menuRow(pickRow).x, menuRow(pickRow).y); await frames(20); await shot("02_grid_fresh");
    const levels = GAME === "ss" ? [1, 7, 15] : [1];
    if (GAME === "sf") { // stages 7 and 12 are COMING SOON: tapping twice must not start them
      await tap(tile(7).x, tile(7).y); await tap(tile(7).x, tile(7).y); await frames(10); await shot("03_grid_comingsoon");
      log("tap SF stage 7 twice -> scene", await S(() => __SS.STATE.scene), (await S(() => __SS.STATE.scene)) === "title" ? "OK (refused)" : "FAIL");
      await key("ArrowRight"); await key("ArrowRight"); await key("ArrowRight"); await key("ArrowRight"); await key("ArrowRight"); await key("Enter"); // cursor 12 -> enter
      log("Enter on SF stage 12 -> scene", await S(() => __SS.STATE.scene));
    }
    for (const n of levels) {
      if (n !== levels[0]) { await load(false); await tap(192, 120); await frames(10); const rows = await S((g) => localStorage.getItem(g === "ss" ? "ssla_progress" : "sfwb_progress") ? 3 : 2, GAME); await tap(menuRow(rows - 1).x, menuRow(rows - 1).y); await frames(10); }
      await tap(tile(n).x, tile(n).y); await tap(tile(n).x, tile(n).y); await frames(5);
      log("after tile", n, "scene", await S(() => __SS.STATE.scene));
      await pickFighterTouch(); await waitStage(n); await shot("04_stage_" + n);
      if (n === levels[levels.length - 1] || n === 7) { await clearLevel(); log("progress after clearing", n, await prog()); }
    }
    await load(false); await tap(192, 120); await frames(20); await shot("05_menu_saved");
    await tap(menuRow(2).x, menuRow(2).y); await frames(20); await shot("06_grid_checks");
  }
  if (PART === "cont") { // keyboard/gamepad-style flow: clear level 3 (SS) / 1 (SF), reload, CONTINUE -> next
    await load(true);
    const L0 = GAME === "ss" ? 3 : 1;
    await key("Enter"); await frames(5); await key("ArrowDown"); await key("Enter"); await frames(5); // NEW GAME is row 0 w/o save -> down = LEVEL SELECT
    for (let i = 1; i < L0; i++) await key("ArrowRight");
    await key("Enter"); log("scene after grid Enter", await S(() => __SS.STATE.scene));
    await key("Enter"); await waitStage(L0); await clearLevel(); await shot("07_results_L" + L0); log("progress", await prog());
    await load(false); await key("Enter"); await frames(20); await shot("08_menu_continue");
    await key("Enter"); await frames(10); log("CONTINUE -> scene", await S(() => __SS.STATE.scene));
    if (GAME === "ss") { await shot("09_select_after_continue"); await key("Enter"); await waitStage(L0 + 1); await shot("10_continue_stage_" + (L0 + 1)); }
    else { await shot("09_continue_comingsoon_grid"); }
    // finale: mark last level cleared, CONTINUE -> grid
    await S((a) => localStorage.setItem(a.k, JSON.stringify({ done: [1, a.n], last: a.n, bro: 0 })), { k: GAME === "ss" ? "ssla_progress" : "sfwb_progress", n: N });
    await load(false); await key("Enter"); await frames(10); await shot("11_menu_finale"); await key("Enter"); await frames(10);
    log("CONTINUE after finale -> scene", await S(() => __SS.STATE.scene)); await shot("12_finale_grid");
    await key("Escape"); await frames(5); await key("ArrowUp"); await key("Enter"); await frames(5); log("NEW GAME -> scene", await S(() => __SS.STATE.scene));
  }
  log("PAGE ERRORS:", errs); await b.close();
})().catch((e) => { console.log("FAIL", e.message); process.exit(1); });
