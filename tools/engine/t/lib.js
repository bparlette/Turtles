// Shared Playwright (WebKit, iPhone 13 landscape, touch) helpers for the SHELL SHOCK engine-upgrade tests.
const pw = require("/workspace/work/freeze_test/node_modules/playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".css": "text/css", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
function serve(dir, port) {
  const stats = { n: 0, urls: [] };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]); let f = path.join(dir, u === "/" ? "/index.html" : u);
    stats.n++; stats.urls.push(u);
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); res.end("nf"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" }); res.end(buf);
    });
  });
  return new Promise((r) => srv.listen(port, "127.0.0.1", () => r({ srv, stats, close: () => new Promise((q) => srv.close(q)) })));
}
// rAF callback cost meter (wall ms spent inside each frame callback)
const INIT = () => {
  const M = (window.__M = { n: 0, sum: 0, arr: [], on: false });
  const raf = (cb) => setTimeout(() => cb(performance.now()), 16); // headless WebKit does not tick rAF reliably: 16 ms timer shim (like freeze_test FAST=1)
  window.requestAnimationFrame = (f) => raf((t) => { const a = performance.now(); f(t); const d = performance.now() - a; if (M.on) { M.n++; M.sum += d; M.arr.push(d); } });
  const spc = Element.prototype.setPointerCapture; Element.prototype.setPointerCapture = function (id) { try { return spc.call(this, id); } catch (_) {} };
  const AC = window.AudioContext || window.webkitAudioContext; window.__AN = { live: 0, started: 0 };
  if (AC) for (const m of ["createOscillator", "createBufferSource"]) { const o = AC.prototype[m]; AC.prototype[m] = function () { const n = o.apply(this, arguments); const s = n.start;
    n.start = function () { __AN.started++; __AN.live++; n.addEventListener("ended", () => __AN.live--); return s.apply(n, arguments); }; return n; }; }
};
async function open(opts) {
  const o = Object.assign({ dir: "/workspace/work/ss_engine/site", port: 8765, query: "?debug", sw: false }, opts || {});
  const server = o.noServer ? null : await serve(o.dir, o.port);
  const env = Object.assign({}, process.env); for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY"]) delete env[k]; env.NO_PROXY = "*";
  const b = await pw.webkit.launch({ env });
  const c = await b.newContext({ ...pw.devices["iPhone 13 landscape"], hasTouch: true, isMobile: true, serviceWorkers: o.sw ? "allow" : "block" });
  await c.addInitScript(INIT);
  const p = await c.newPage();
  const errs = []; const log = (...a) => console.log(...a);
  p.on("pageerror", (e) => { errs.push(e.message); log("PAGEERROR", e.message); });
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|level16|favicon/.test(m.text())) { errs.push("console:" + m.text()); log("CONSOLE", m.text().slice(0, 300)); } });
  const S = (fn, a) => p.evaluate(fn, a);
  const until = (cond, ms = 60000) => p.waitForFunction(cond, null, { timeout: ms, polling: 100 });
  const frames = async (n) => { const t0 = await S(() => __SS.STATE.t); await until(`__SS.STATE.t >= ${t0 + n}`, 120000); };
  const url = `http://127.0.0.1:${o.port}/index.html${o.query}`;
  const goto = async (q) => { await p.goto(q ? `http://127.0.0.1:${o.port}/index.html${q}` : url, { waitUntil: "load" }); };
  const rect = () => S(() => { const q = document.getElementById("game").getBoundingClientRect(); return { l: q.left, t: q.top, w: q.width, h: q.height }; });
  const tap = async (x, y) => { const r = await rect(); await p.touchscreen.tap(r.l + (x / 384) * r.w, r.t + (y / 224) * r.h); await frames(3); };
  const shot = async (file, full) => { if (full) await p.screenshot({ path: file }); else await (await p.$("#game")).screenshot({ path: file }); log("shot", file); };
  const installTouch = () => S(() => {
    const cab = document.getElementById("cab");
    const at = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const ev = (t, id, x, y) => cab.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 11 }));
    window.__T = {
      down(btn) { const [x, y] = at("cap-" + btn); ev("pointerdown", { a: 21, b: 22, p: 23 }[btn], x, y); },
      up(btn) { const [x, y] = at("cap-" + btn); ev("pointerup", { a: 21, b: 22, p: 23 }[btn], x, y); },
      tap(btn) { this.down(btn); setTimeout(() => this.up(btn), 60); },
      stick(dx, dy) { const r = cab.getBoundingClientRect(); const sx = r.left + 0.31 * r.width, sy = r.top + 0.62 * r.height;
        if (this.sid) ev("pointerup", 11, sx, sy); this.sid = 0; if (!dx && !dy) return;
        ev("pointerdown", 11, sx, sy); ev("pointermove", 11, sx + dx * r.width * 0.06, sy + dy * r.width * 0.06); this.sid = 1; },
    };
  });
  // In-page touch bot (no state cheats unless assist): seek nearest foe, attack in range, walk right otherwise.
  const bot = (assist, seed) => S(([assist, seed]) => {
    if (window.__BOT) clearInterval(window.__BOT);
    let s = seed >>> 0 || 1; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    let last = "";
    window.__BOT = setInterval(() => {
      const st = window.__SS && __SS.STATE; if (!st) return;
      if (st.scene === "map") { __T.tap("a"); return; }
      if (st.scene !== "stage" || !st.player) return;
      const p = st.player;
      if (assist && p.hp < 6 && !(p.deadT > 0)) p.hp = 12;
      if (st.results || st.pizza) { if (r() < 0.3) __T.tap("a"); return; }
      const foes = st.enemies.filter((e) => !["dying", "fly", "intro", "down"].includes(e.state) && e.x > st.camX - 4 && e.x < st.camX + 388);
      let dx = 1, dy = 0, act = false;
      if (foes.length) {
        foes.sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y));
        const e = foes[0], ex = e.x - p.x, ey = e.y - p.y, want = e.boss || e.type === "ramrod" || e.type === "zap" ? 26 : 20;
        dx = Math.abs(ex) > want + 6 ? Math.sign(ex) : Math.abs(ex) < want - 8 ? -Math.sign(ex) : 0;
        dy = Math.abs(ey) > 3 ? Math.sign(ey) : 0;
        if (dx === 0 && p.facing !== Math.sign(ex || 1)) dx = Math.sign(ex);
        act = Math.abs(ex) < want + 14 && Math.abs(ey) < 9;
      } else if (st.locked) { dx = 0; dy = 0; }
      const k = dx + "," + dy; if (k !== last) { __T.stick(dx, dy); last = k; }
      if (act) { const q = r(); if (q < 0.06 && p.hp > 4) __T.tap("p"); else if (q < 0.12) __T.tap("b"); else __T.tap("a"); }
    }, 70);
  }, [!!assist, seed || 7]);
  const stopBot = () => S(() => { if (window.__BOT) clearInterval(window.__BOT); window.__BOT = 0; if (window.__T) __T.stick(0, 0); });
  // title -> menu -> SCENE SELECT -> level n -> fighter (touch only). Clears saved progress so the menu has no CONTINUE row.
  const startLevel = async (n, bro) => {
    await goto(); await until("window.__SS && __SS.STATE.t > 5 && __SS.STATE.scene === 'title'", 90000);
    await S(() => localStorage.removeItem("ssla_progress")); await frames(40);
    await installTouch();
    await tap(192, 120); await frames(20); // PUSH START -> menu
    await tap(192, 100 + 1 * 26 + 6); await frames(20); // SCENE SELECT
    const COLS = 5, ROWS = 3, TW = Math.floor((384 - 24 - 5 * (COLS - 1)) / COLS), TH = Math.floor((166 - 30 - 5 * (ROWS - 1)) / ROWS);
    const tx = 12 + ((n - 1) % COLS) * (TW + 5) + TW / 2, ty = 30 + Math.floor((n - 1) / COLS) * (TH + 5) + TH / 2;
    await tap(tx, ty); await tap(tx, ty); await frames(10);
    if (bro) { for (let i = 0; i < bro; i++) { await S(() => __T.stick(1, 0)); await p.waitForTimeout(200); await S(() => __T.stick(0, 0)); await p.waitForTimeout(200); } }
    await S(() => __T.tap("a")); // pick the highlighted fighter
    await until("['loading','card','stage','map'].includes(__SS.STATE.scene)", 90000);
    if (await S(() => __SS.STATE.scene === "map")) { await frames(30); await S(() => __T.tap("a")); }
    await until("__SS.STATE.scene === 'stage'", 120000);
    return S(() => __SS.STATE.level);
  };
  const meter = async (on) => S((on) => { if (on) { __M.n = 0; __M.sum = 0; __M.arr = []; } __M.on = on; if (!on) { const a = __M.arr.slice().sort((x, y) => x - y); return { n: a.length, avg: +(__M.sum / Math.max(1, a.length)).toFixed(2), p50: +(a[a.length >> 1] || 0).toFixed(2), p95: +(a[Math.floor(a.length * 0.95)] || 0).toFixed(2), max: +(a[a.length - 1] || 0).toFixed(2) }; } }, on);
  const close = async () => { try { await b.close(); } catch (_) {} if (server) await server.close(); };
  return { b, c, p, S, until, frames, tap, shot, goto, installTouch, bot, stopBot, startLevel, meter, close, errs, server, log };
}
module.exports = { open, serve, pw };
