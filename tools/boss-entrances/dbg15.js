const { open, helpers } = require('./lib');
(async () => { const { b, pg } = await open({}); const h = helpers(pg);
  await h.toStage('&level=15');
  for (let i = 0; i < 40; i++) {
    const s = await h.S(() => { const T = __SS.STATE; return { sec: T.sec, entr: T.entr && T.entr.e.name, boss: T.enemies.filter(e=>e.boss).map(e=>e.name+':'+e.state+':'+e.hp), wave: T.wave, locked: T.locked, scroll: T.scroll, camX: Math.round(T.camX), px: Math.round(T.player.x), fade: T.fadeOut, n: T.enemies.length, ko: !!T.outro }; });
    console.log(i, JSON.stringify(s));
    if (s.entr) await h.S(() => { __SS.STATE.entr.t = __SS.STATE.entr.len; });
    await h.S(() => { const T = __SS.STATE, e = T.enemies.find((o) => o.boss && o.name === 'SHREDDER'); if (e && e.state === 'walk') e.hp = 0; T.player.hp = 16; T.player.inv = 60; });
    if (!s.boss.length) { const r = await h.S(() => __SS.entrDebugWarp()); console.log('warp', r); }
    await h.frames(40);
  }
  await b.close(); })();
