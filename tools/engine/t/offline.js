// node offline.js <dir> : SW install -> play level 1 briefly (caches its art) -> go offline -> reload -> title boots + level 1 starts from cache
const { open } = require("./lib.js");
const DIR = process.argv[2];
(async () => {
  const T = await open({ dir: DIR, query: "?debug", port: 8811, sw: true });
  await T.goto(); await T.until("navigator.serviceWorker.controller !== null || (location.reload(), false)", 60000).catch(() => {});
  await T.goto(); await T.until("navigator.serviceWorker.controller !== null", 60000);
  T.log("sw controlled");
  await T.startLevel(1); await T.p.waitForTimeout(3000);
  const keys = await T.S(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return { ks, n: (await c.keys()).length }; });
  T.log("cache", JSON.stringify(keys));
  await T.c.setOffline(true); await T.server.close(); T.log("offline + server stopped");
  await T.goto(); await T.until("window.__SS && __SS.STATE.scene === 'title'", 90000);
  T.log("offline reload reached title, booting=" + await T.S(() => !!__SS.STATE.booting));
  await T.shot("/workspace/work/ss_engine/shots/offline_title.png");
  const lv = await T.startLevel(1); await T.p.waitForTimeout(3000);
  const bad = await T.S(() => [...document.images].filter((i) => i.src && i.complete && !i.naturalWidth).map((i) => i.src).slice(0, 10));
  await T.shot("/workspace/work/ss_engine/shots/offline_L1.png");
  T.log("OFFLINE", lv === 1 ? "PASS" : "FAIL", "level", lv, "brokenImgs", JSON.stringify(bad), "errors", T.errs.length);
  await T.close(); process.exit(lv === 1 && !T.errs.length ? 0 : 2);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
