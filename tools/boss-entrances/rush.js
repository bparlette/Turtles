// Boss Rush back-to-back: on L15 final section, after the first entrance ends, spawn two bosses at once -> both entrances must play in sequence and both end centred-ish in walk.
const { open, helpers } = require('./lib');
(async () => {
  const { b, pg, errs } = await open({ touch: !!process.env.TOUCH }); const h = helpers(pg); const res = { ok: false };
  try {
    await h.toStage('&level=15');
    for (let i = 0; i < 60; i++) { const s = await h.S(() => ({ sec: __SS.STATE.sec, e: !!__SS.STATE.entr })); if (s.sec === 2) break; if (s.e) await h.S(() => { __SS.STATE.entr.t = __SS.STATE.entr.len; });
      await h.S(() => { const T = __SS.STATE; T.player.hp = 16; T.player.inv = 60; if (!T.entr && !T.fadeOut) { T.enemies = []; T.fadeOut = 1; } }); await h.frames(60); }
    await h.S(() => { const T = __SS.STATE; T.enemies = []; T.entr = null; T.entrQ = null; });
    const r = await h.S(() => { const cfg = __SS.LEVELS[14].boss; const a = __SS.spawnBoss(cfg), c = __SS.spawnBoss(cfg); a.name = 'RUSH 1'; c.name = 'RUSH 2'; return { e: !!__SS.STATE.entr, q: (__SS.STATE.entrQ || []).length }; });
    res.start = r; const seen = [];
    for (let i = 0; i < 400; i++) { const s = await h.S(() => __SS.STATE.entr ? __SS.STATE.entr.e.name : null); if (s && seen[seen.length - 1] !== s) { seen.push(s); await h.shot(`/workspace/work/boss_ent/shots/rush_${seen.length}.png`); } if (!s && seen.length >= 2) break; await pg.waitForTimeout(40); }
    await h.frames(10);
    res.seen = seen; res.end = await h.S(() => __SS.STATE.enemies.filter((e) => e.boss).map((e) => ({ n: e.name, st: e.state, sx: Math.round(e.x - __SS.STATE.camX), inv: e.inv })));
    res.frameErrors = await h.S(() => window.__frameErrors.n);
    res.ok = seen.length === 2 && res.end.length === 2 && res.end.every((e) => e.st === 'walk' && e.inv === 0);
  } catch (e) { res.err = e.message.slice(0, 300); }
  res.pageErrors = errs.length; console.log('RESULT', JSON.stringify(res)); await b.close();
})();
