// node soak.js <dir> <secs> : WebKit iPhone touch soak, bot with assist cycling levels 1 -> 8 -> 15, counts page/console/frame errors
const { open } = require("./lib.js");
const DIR = process.argv[2], SECS = +process.argv[3] || 300;
(async () => {
  const T = await open({ dir: DIR, query: "?debug", port: 8790 + (process.pid % 9) });
  const t0 = Date.now(); const lv = [1, 8, 15]; let i = 0;
  while (Date.now() - t0 < SECS * 1000) {
    const n = lv[i++ % 3]; await T.startLevel(n); await T.bot(true, 20 + i);
    const t1 = Date.now();
    while (Date.now() - t1 < 95000 && Date.now() - t0 < SECS * 1000) {
      await T.p.waitForTimeout(10000);
      const s = await T.S(() => ({ t: __SS.STATE.t, sc: __SS.STATE.scene, lvl: __SS.STATE.level, en: __SS.STATE.enemies.length, an: __AN.live, fe: (window.__frameErrors || {}).n || 0, eng: __SSENG.stats(), heap: performance.memory ? performance.memory.usedJSHeapSize : 0 }));
      T.log(Math.round((Date.now() - t0) / 1000) + "s", JSON.stringify(s));
    }
    await T.stopBot();
  }
  const fe = await T.S(() => { const F = window.__frameErrors || {}; return F.n ? [F.n, String(F.last)] : []; });
  T.log("SOAK DONE secs", Math.round((Date.now() - t0) / 1000), "pageErrors", T.errs.length, "frameErrors", fe.length, JSON.stringify(fe));
  await T.close(); process.exit(T.errs.length || fe.length ? 2 : 0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
