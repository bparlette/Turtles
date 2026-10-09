// node ent.js <case> [outdir]   case: 2..15 | 1z (Zap-Rollers) | 1s (Scorcher) | 1r (Ramrod) | 15s (Super Shredder)
// Plays into the boss, captures entrance keyframes, checks the boss ends centred + fightable. env SKIP=frame -> press skip then.
const { open, helpers } = require('./lib');
const fs = require('fs');
(async () => {
  const C = process.argv[2], out = process.argv[3] || '/workspace/work/boss_ent/shots';
  fs.mkdirSync(out, { recursive: true });
  const touch = !!process.env.TOUCH;
  const { b, pg, errs } = await open({ touch });
  const h = helpers(pg);
  const res = { case: C, ok: false };
  try {
    const lvl = parseInt(C, 10);
    await h.toStage(C === '1r' ? '&skip=boss' : '&level=' + lvl);
    const wantName = C === '15s' ? 'SUPER SHREDDER' : null;
    // drive to the entrance
    for (let i = 0; i < 80; i++) {
      const st = await h.S((wn) => { const T = __SS.STATE; return { entr: !!T.entr, name: T.entr && T.entr.e && T.entr.e.name, sec: T.sec }; }, wantName);
      if (st.entr && (!wantName || st.name === wantName)) break;
      if (st.entr) { await h.S(() => { __SS.STATE.entr.t = __SS.STATE.entr.len; }); await h.frames(5); }
      if (C === '1s') { await h.S(() => __SS.spawnMidBoss()); await h.frames(3); continue; }
      if (C === '15s' && await h.S(() => { const T = __SS.STATE; T.player.hp = 16; if (T.sec === 1 && !T.entr) { T.enemies = []; if (!T.fadeOut) T.fadeOut = 1; return true; } return T.sec === 1; })) { await h.frames(60); continue; }
      const r = await h.S(() => __SS.entrDebugWarp());
      await h.frames(r === 'fade' ? 60 : 15);
    }
    const info0 = await h.S(() => { const E = __SS.STATE.entr; return E ? { len: E.len, name: E.def.name || (E.e && E.e.name), t: E.t } : null; });
    if (!info0) throw new Error('no entrance started');
    res.len = info0.len; res.name = info0.name;
    const skipAt = +process.env.SKIP || 0;
    const marks = [0.12, 0.3, 0.5, 0.68, 0.86].map((k) => Math.round(k * info0.len));
    let mi = 0, skipped = false;
    while (true) {
      const t = await h.S(() => (__SS.STATE.entr ? __SS.STATE.entr.t : -1));
      if (t < 0) break;
      if (skipAt && !skipped && t >= skipAt) {
        skipped = true;
        if (touch) await h.tap(192, 120); else await h.key('j');
        await h.frames(2); continue;
      }
      if (mi < marks.length && t >= marks[mi]) { await h.shot(`${out}/${C}_${mi}.png`); mi++; continue; }
      await pg.waitForTimeout(15);
    }
    await h.frames(8);
    await h.shot(`${out}/${C}_end.png`);
    const end = await h.S(() => { const T = __SS.STATE, p = T.player, bs = T.enemies.filter((e) => e.boss || e.type === 'zap' || e.type === 'ramrod');
      return { cam: T.camX, bosses: bs.map((e) => ({ n: e.name || e.type, sx: Math.round(e.x - T.camX), y: Math.round(e.y), z: e.z, st: e.state, hp: e.hp, inv: e.inv })), px: Math.round(p.x - T.camX), floor: [__SS.STATE.enemies.length] }; });
    res.end = end; res.skipped = skipped;
    // fightable: stand next to the boss and attack for ~6 s
    const hp0 = end.bosses.reduce((a, e) => a + e.hp, 0);
    for (let i = 0; i < 30; i++) {
      await h.S(() => { const T = __SS.STATE, p = T.player, e = T.enemies.find((o) => o.boss || o.type === 'zap' || o.type === 'ramrod'); if (!e) return; p.hp = 16; p.inv = 30;
        if (p.downT === 0 && !p.grabbedBy) { p.x = e.x - (e.facing || -1) * -1 * 0 + (p.x < e.x ? -22 : 22); p.y = e.y; p.facing = e.x > p.x ? 1 : -1; } });
      await h.key('j');
      await pg.waitForTimeout(40);
    }
    const hp1 = await h.S(() => __SS.STATE.enemies.filter((e) => e.boss || e.type === 'zap' || e.type === 'ramrod').reduce((a, e) => a + e.hp, 0));
    res.hp = [hp0, hp1]; res.frameErrors = await h.S(() => window.__frameErrors.n);
    res.ok = hp1 < hp0 && end.bosses.length > 0 && end.bosses.every((e) => Math.abs(e.sx - 192) <= 40 && e.st === 'walk');
  } catch (e) { res.err = e.message; }
  res.pageErrors = errs.length;
  console.log('RESULT', JSON.stringify(res));
  await b.close();
})();
