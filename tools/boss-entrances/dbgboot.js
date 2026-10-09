const { open, helpers } = require('./lib');
(async () => { const { b, pg } = await open({ touch: !!process.env.TOUCH }); const h = helpers(pg);
  await pg.goto(require('./lib').BASE + '/index.html?debug&nocache&level=8');
  for (let i = 0; i < 20; i++) { const s = await pg.evaluate(() => window.__SS ? { sc: __SS.STATE.scene, t: __SS.STATE.t, boot: __SS.STATE.booting, card: __SS.STATE.cardT } : 'noSS'); console.log(i, JSON.stringify(s)); if (s && s.sc) await h.key('Enter'); await pg.waitForTimeout(700); }
  await h.shot('/tmp/boot.png'); await b.close(); })();
