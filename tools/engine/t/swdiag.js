const { open } = require("./lib.js");
(async () => {
  const T = await open({ dir: process.argv[2], query: "", port: 8812, sw: true });
  await T.goto(); await T.p.waitForTimeout(8000); await T.goto();
  for (let i = 0; i < 12; i++) { await T.p.waitForTimeout(5000);
    T.log(JSON.stringify(await T.S(() => ({ ctl: !!navigator.serviceWorker.controller, sc: window.__SS && __SS.STATE.scene, t: window.__SS && __SS.STATE.t, booting: window.__SS && __SS.STATE.booting,
      imgs: [...document.images].filter((i) => !i.complete).map((i) => i.src.split("/").pop()).slice(0, 8), n: document.images.length })))); }
  await T.close(); process.exit(0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
