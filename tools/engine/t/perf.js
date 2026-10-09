// node perf.js <dir> <tag> [levels] [query]  -> screenshots + rAF callback cost per level
const { open } = require("./lib.js");
const DIR = process.argv[2], TAG = process.argv[3] || "x", LV = (process.argv[4] || "1,7,15").split(",").map(Number), Q = process.argv[5] || "?debug";
const OUT = "/workspace/work/ss_engine/shots/" + TAG + "/"; require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const T = await open({ dir: DIR, query: Q, port: 8770 + (process.pid % 50) });
  const res = {};
  await T.goto(); await T.until("window.__SS && __SS.STATE.scene==='title'", 90000); await T.frames(240); await T.shot(OUT + "title.png");
  for (const n of LV) {
    const got = await T.startLevel(n); T.log("level", n, "started", got);
    await T.bot(true, 11); await T.p.waitForTimeout(5000);
    await T.meter(true); await T.p.waitForTimeout(12000); const m = await T.meter(false);
    const eng = await T.S(() => window.__SSENG ? __SSENG.stats() : null);
    await T.shot(OUT + "L" + n + ".png");
    await T.p.waitForTimeout(1500); await T.shot(OUT + "L" + n + "b.png");
    const st = await T.S(() => ({ t: __SS.STATE.t, en: __SS.STATE.enemies.length, an: __AN.live }));
    res["L" + n] = { meter: m, eng, st }; T.log("L" + n, JSON.stringify(res["L" + n]));
    await T.stopBot();
  }
  res.errors = T.errs; require("fs").writeFileSync(OUT + "perf.json", JSON.stringify(res, null, 1));
  T.log("ERRORS", T.errs.length); await T.close(); process.exit(0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
