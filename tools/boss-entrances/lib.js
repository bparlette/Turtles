// Shared Playwright helpers for the boss-entrance harness.
const PW = require('/workspace/work/freeze_test/node_modules/playwright'); const { devices } = PW;
const chromium = process.env.CHROME ? require('/workspace/work/sstest/node_modules/playwright').chromium : PW.webkit;
const BASE = process.env.BASE || 'file:///workspace/work/deploy/shell-shock-live-action';
async function open(opts = {}) {
  const b = await chromium.launch(process.env.CHROME ? { args: ['--autoplay-policy=no-user-gesture-required'] } : {});
  const ctx = opts.touch
    ? await b.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })
    : await b.newContext({ viewport: { width: 1152, height: 672 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
  return { b, ctx, pg, errs };
}
function helpers(pg) {
  const S = (fn, a) => pg.evaluate(fn, a);
  const until = async (cond, ms = 60000) => { await pg.waitForFunction(cond, null, { timeout: ms, polling: 50 }); };
  const frames = async (n) => { const t0 = await S(() => __SS.STATE.t); await until(`__SS.STATE.t >= ${t0 + n}`); };
  const shot = async (path) => { await (await pg.$('#game')).screenshot({ path }); };
  const tap = async (x, y) => { const r = await S(() => { const q = document.getElementById('game').getBoundingClientRect(); return { l: q.left, t: q.top, w: q.width, h: q.height }; });
    await pg.touchscreen.tap(r.l + (x / 384) * r.w, r.t + (y / 224) * r.h); };
  const key = async (k) => { await pg.keyboard.down(k); await pg.waitForTimeout(60); await pg.keyboard.up(k); };
  // title -> menu (NEW GAME) -> select -> (map) -> card -> stage
  const toStage = async (q) => {
    await pg.goto(BASE + '/index.html?debug&nocache' + q);
    await until('window.__SS && __SS.STATE.t > 5');
    await S(() => { try { localStorage.removeItem('ssla_progress'); } catch (e) {} });
    for (let i = 0; i < 80; i++) {
      const sc = await S(() => __SS.STATE.scene);
      if (sc === 'stage') break;
      if (sc === 'title' || sc === 'select' || sc === 'map') await key('Enter');
      await pg.waitForTimeout(250);
    }
    await until("__SS.STATE.scene === 'stage' && (!(__SS.STATE.cardT > 0) || /skip=boss/.test(location.search))", 60000);
    if (!/skip=boss/.test(q)) await frames(20);
  };
  // Jump to the boss of the current plugin level (last section, waves cleared).
  const warpBoss = async () => S(() => {
    const T = __SS.STATE, LV = __SS.LEVELS[T.level - 1];
    if (!LV) return 'nolv';
    const last = LV.sections.length - 1;
    if (T.sec < last) { T.fadeOut = 1; return 'fade'; }
    const Sx = LV.sections[last];
    T.enemies.length = 0; T.queue = [];
    T.player.inv = 600;
    if (Sx.auto) { T.scroll = Sx.length + 1; T.wave = Sx.waves.length; return 'auto'; }
    T.wave = (Sx.locks || []).length; T.locked = false; T.player.x = Math.max(60, Sx.length - 120);
    return 'walk';
  });
  return { S, until, frames, shot, tap, key, toStage, warpBoss };
}
module.exports = { open, helpers, BASE };
