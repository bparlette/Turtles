const L = require("/workspace/work/ss_engine/t/lib.js");
(async () => {
  const g = await L.open({ dir: "/workspace/work/deploy/shell-shock-live-action", port: 8791 });
  const { S, until, frames, tap, shot } = g;
  await g.goto(); await until("window.__SS && __SS.STATE.t > 5 && __SS.STATE.scene === 'title'", 90000);
  await S(() => { localStorage.removeItem("ssla_progress"); localStorage.removeItem("ssla_mode"); }); await frames(40);
  await g.installTouch();
  await tap(192, 120); await frames(20);
  await shot("/workspace/work/phase2/shots/menu_arcade.png");
  await tap(192, 100); await frames(10); await shot("/workspace/work/phase2/shots/menu_speed.png");
  await tap(270, 100); await frames(10); await shot("/workspace/work/phase2/shots/menu_rush.png");
  await tap(192, 148); await frames(10); await shot("/workspace/work/phase2/shots/grid_rush.png");
  // back, speed, START RUN
  await tap(30, 12); await frames(10); await tap(192, 100); await frames(10);
  await tap(192, 128); await frames(20);
  await S(() => __T.tap("a"));
  await until("__SS.STATE.scene === 'stage'", 120000); await frames(240);
  await shot("/workspace/work/phase2/shots/speed_hud.png");
  console.log("mode", await S(() => JSON.stringify({ lv: __SS.STATE.level, sec: __SS.STATE.section })), "errs", g.errs.length);
  await g.close();
})().catch((e) => { console.log("FAIL", e); process.exit(1); });
