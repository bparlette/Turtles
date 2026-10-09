const { chromium, devices } = require('/workspace/work/sstest/node_modules/playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 });
const p = await ctx.newPage(); await p.goto(process.argv[2]); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => [...document.querySelectorAll('canvas')].map(c => { const r = c.getBoundingClientRect(); return [c.id, c.width, c.height, r.x, r.y, r.width, r.height, getComputedStyle(c).transform]; })));
await b.close(); })();
