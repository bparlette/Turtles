const L = require("/workspace/work/ss_engine/t/lib.js");
const LV = (process.env.LVS || "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15").split(",").map(Number);
(async () => {
  const g = await L.open({ dir: "/workspace/work/deploy/shell-shock-live-action", port: 8792 + (+process.env.PO || 0) });
  const { S, until, frames, tap, shot } = g;
  for (const n of LV) {
    await g.goto("?debug&level=" + n); await until("window.__SS && __SS.STATE.t > 5 && __SS.STATE.scene === 'title'", 90000);
    await S(() => { localStorage.removeItem("ssla_progress"); localStorage.setItem("ssla_mode", '"arcade"'); }); await frames(30);
    await g.installTouch();
    await tap(192, 120); await frames(15); await tap(192, 126); await frames(15);
    await S(() => __T.tap("a"));
    await until("__SS.STATE.scene === 'stage'", 120000); await frames(60);
    await g.bot(true, 3);
    const jump = async () => { await S(() => { const s = __SS.STATE; s.enemies = s.enemies.filter((e) => e.boss); s.queue = []; s.fadeOut = 1; }); await frames(70); };
    await jump(); // -> twist
    await frames(n === 9 ? 260 : 380); await shot(`/workspace/work/phase2/shots/tw${n}_a.png`);
    await frames(700); await shot(`/workspace/work/phase2/shots/tw${n}_b.png`);
    const st = await S(() => JSON.stringify({ sec: __SS.STATE.sec, section: __SS.STATE.section, tw: __SS.STATE.tw && { t: __SS.STATE.tw.t, goal: __SS.STATE.tw.goal, kind: __SS.STATE.tw.d.kind } }));
    await jump(); await frames(160); await shot(`/workspace/work/phase2/shots/tw${n}_z2.png`);
    console.log("L" + n, st, "errs", g.errs.length);
    await g.stopBot();
  }
  await g.close();
})().catch((e) => { console.log("FAIL", e); process.exit(1); });
