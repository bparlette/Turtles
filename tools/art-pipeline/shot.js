// node shot.js plan.json  -> plan: {level, bro, title:[shots...], steps:[{until?,js?,wait?,shot?}]}
// Serves file:///workspace/work/shared_art/site/index.html (SITE env overrides)
const { chromium } = require('playwright');
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const SITE = process.env.SITE || '/workspace/work/shared_art/site';
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.type(), m.text()); } });
  await pg.goto(`file://${SITE}/index.html?debug&nocache&level=${plan.level || 1}`);
  const shot = async (f) => { const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); console.log('shot', f); };
  const run = async (steps) => {
    for (const s of steps) {
      if (s.until) { for (let i = 0; i < 300; i++) { if (await pg.evaluate(s.until)) break; await pg.waitForTimeout(5); } }
      if (s.key) await pg.keyboard.press(s.key);
      if (s.js) { const r = await pg.evaluate(s.js); if (r !== undefined) console.log('js->', JSON.stringify(r)); }
      if (s.wait) await pg.waitForTimeout(s.wait);
      if (s.shot) await shot(s.shot);
    }
  };
  await pg.waitForTimeout(1500);
  await run(plan.title || []);
  if (plan.stage !== false) {
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
    for (let i = 0; i < (plan.bro || 0); i++) { await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(120); }
    if (plan.selectShot) await shot(plan.selectShot);
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(3000);
  }
  await run(plan.steps || []);
  console.log('ERRORS', errs);
  await b.close();
})();
