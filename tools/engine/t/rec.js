// node rec.js <level> <secs> [tag] [dir]: record a touch-bot session (?record), then replay it from file (?replay=rec/<tag>.json&fast) and compare hashes.
const { open } = require("./lib.js"); const fs = require("fs");
const N = +process.argv[2] || 1, SECS = +process.argv[3] || 40, TAG = process.argv[4] || "L" + N, DIR = process.argv[5] || "/workspace/work/ss_engine/site";
(async () => {
  const T = await open({ dir: DIR, query: "?debug&record&turbo=3", port: 8840 + N });
  const lv = await T.startLevel(N); T.log("recording level", lv);
  await T.bot(false, 1000 + N);
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) { await T.p.waitForTimeout(2000); const m = await T.S(() => __SSENG.rec.mode); if (m !== "rec") break; }
  await T.stopBot();
  let d = await T.S(() => (__SSENG.rec.mode === "rec" ? __SSENG.stop() : __SSENG.last));
  T.log("recorded steps", d.steps, "hash", d.hash, "end", d.end, "runs", d.runs.length, "checks", d.checks.length, "score", await T.S(() => __SS.STATE.score));
  fs.writeFileSync(DIR + "/rec/" + TAG + ".json", JSON.stringify(d)); fs.writeFileSync("/workspace/work/ss_engine/rec/" + TAG + ".json", JSON.stringify(d));
  await T.shot("/workspace/work/ss_engine/rec/" + TAG + "_rec_end.png");
  await T.goto("?debug&fast&replay=rec/" + TAG + ".json");
  await T.until("window.__SSENG && __SSENG.result", 110000 * 3);
  const r = await T.S(() => __SSENG.result);
  T.log("REPLAY", r.ok ? "MATCH" : "MISMATCH", JSON.stringify(r));
  await T.shot("/workspace/work/ss_engine/rec/" + TAG + "_replay_end.png");
  fs.writeFileSync("/workspace/work/ss_engine/rec/" + TAG + "_result.json", JSON.stringify({ rec: { steps: d.steps, hash: d.hash, end: d.end }, replay: r, errors: T.errs }, null, 1));
  T.log("ERRORS", T.errs.length); await T.close(); process.exit(r.ok ? 0 : 2);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
