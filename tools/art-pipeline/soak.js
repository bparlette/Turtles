const { chromium } = require('playwright');
const LV = +process.argv[2] || 1, SECS = +process.argv[3] || 35, SITE = process.env.SITE || '/workspace/work/shared_art/site';
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  let errs = 0; pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.goto(`file://${SITE}/index.html?debug&nocache&level=${LV}`); await pg.waitForTimeout(1200);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3500);
  const keys = ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'j', 'j', 'k', 'l'];
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < SECS * 1000) {
    const k = keys[Math.random() * keys.length | 0]; await pg.keyboard.down(k); await pg.waitForTimeout(60 + Math.random() * 200); await pg.keyboard.up(k);
    if (++n % 25 === 0) await pg.evaluate(() => { const S = __SS.STATE, p = S.player; if (!p) return; p.hp = 16; if (S.scene === 'stage') { __SS.spawnProp({ kind: ['barrel', 'crate', 'trash', 'cone'][Math.random() * 4 | 0], x: p.x + 30, y: p.y }); __SS.spawnItem({ kind: 'slice', x: p.x + 60, y: p.y }); ['tire','rock','brick','snowball','sludge'].forEach((k,i)=>S.stars.push({x:p.x+200+i*10,y:p.y,vx:-2,kind:k})); S.stars.push({x:p.x+260,y:p.y,vx:-2}); if (!p.atk) __SS.startSpecial(p); } });
  }
  const st = await pg.evaluate(() => ({ scene: __SS.STATE.scene, level: __SS.STATE.level, t: __SS.STATE.t }));
  console.log('LEVEL', LV, 'keys', n, JSON.stringify(st), 'ERRORS', errs); await b.close();
})();
