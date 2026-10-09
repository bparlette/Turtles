// node before.js N outdir  -> screenshots of the current boss arrival
const { open, helpers } = require('./lib');
(async () => {
  const N = +process.argv[2], out = process.argv[3] || '/workspace/work/boss_ent/before';
  require('fs').mkdirSync(out, { recursive: true });
  const { b, pg, errs } = await open();
  const h = helpers(pg);
  try {
    await h.toStage('&level=' + N);
    for (let i = 0; i < 40; i++) {
      const has = await h.S(() => __SS.STATE.enemies.some((e) => e.boss));
      if (has) break;
      const r = await h.warpBoss();
      await h.frames(r === 'fade' ? 60 : 20);
    }
    for (const f of [2, 60, 140, 240]) {
      await h.frames(f === 2 ? 2 : 60);
      await h.shot(`${out}/L${N}_${f}.png`);
    }
    const info = await h.S(() => { const T = __SS.STATE, e = T.enemies.find((o) => o.boss); return e ? { st: e.state, x: Math.round(e.x - T.camX), y: e.y, cam: T.camX, sec: T.sec } : null; });
    console.log('L' + N, JSON.stringify(info), 'errs', errs.length);
  } catch (e) { console.log('FAIL', N, e.message); }
  await b.close();
})();
