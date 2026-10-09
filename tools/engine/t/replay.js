// node replay.js <tag> [dir] : replay rec/<tag>.json on the current build (?replay=...&fast) and compare the final state hash
const { open } = require("./lib.js"); const fs = require("fs");
const TAG = process.argv[2], DIR = process.argv[3] || "/workspace/work/ss_engine/site";
(async () => {
  fs.copyFileSync("/workspace/work/ss_engine/rec/" + TAG + ".json", DIR + "/rec/" + TAG + ".json");
  const T = await open({ dir: DIR, query: "?debug&fast&replay=rec/" + TAG + ".json", port: 8900 + (process.pid % 90) });
  await T.goto(); await T.until("window.__SSENG && __SSENG.result", 330000);
  const r = await T.S(() => __SSENG.result);
  T.log("REPLAY", TAG, r.ok ? "MATCH" : "MISMATCH", JSON.stringify(r).slice(0, 3000), "errors", T.errs.length);
  await T.close(); process.exit(r.ok ? 0 : 2);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
