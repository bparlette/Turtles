const { chromium, devices } = require('/workspace/work/sstest/node_modules/playwright');
const base = process.argv[2], out = process.argv[3], W = 384, H = 224;
const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const d = devices['iPhone 13 landscape'];
  const ctx = await b.newContext({ ...d, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errs = [], miss = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') miss.push(m.text()); });
  page.on('requestfailed', (r) => miss.push('FAIL ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) miss.push(r.status() + ' ' + r.url()); });
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  const cv = page.locator('canvas').first();
  const tap = async (x, y) => { const r = await cv.boundingBox(); await page.touchscreen.tap(r.x + x / W * r.width, r.y + y / H * r.height); await page.waitForTimeout(350); };
  const shot = async (n) => { await cv.screenshot({ path: out + '/' + n + '.png' }); };
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const mem = async () => { const m = await cdp.send('Performance.getMetrics'); const g = (k) => (m.metrics.find((x) => x.name === k) || {}).value; return { heapMB: +(g('JSHeapUsedSize') / 1048576).toFixed(1), nodes: g('Nodes') }; };
  await page.waitForTimeout(9000); await shot('01_title_parade_a');
  await page.waitForTimeout(6000); await shot('02_title_parade_b');
  console.log('title mem', JSON.stringify(await mem()));
  await page.waitForTimeout(12000); await shot('03_title_parade_c');
  await tap(W / 2, 150); await page.waitForTimeout(600); await shot('04_menu');
  // GALLERY is the last row: find it by y = MENU_Y0 + j*RH + 6
  const rows = await page.evaluate(() => 0);
  for (const y of [152 + 6]) { await tap(W / 2, y); await page.waitForTimeout(600); const s = await cv.screenshot(); fs.writeFileSync(out + '/05_after_tap_' + y + '.png', s); break; }
  await page.waitForTimeout(5000); await shot('06_gallery_grid');
  console.log('gallery mem', JSON.stringify(await mem()));
  await tap(103, 12); await page.waitForTimeout(2500); await shot('07_gallery_scrolled');
  await tap(103, 12); await page.waitForTimeout(2500); await shot('07b_gallery_scrolled2');
  await tap(73, 12); await tap(73, 12); await tap(73, 12); await page.waitForTimeout(800);
  await tap(W - 40, 110); await page.waitForTimeout(2000); await shot('07c_zoom_lastcol'); await tap(20, 10); await page.waitForTimeout(600);
  // tap first boss-row tile (second header row)
  await tap(30, 100); await page.waitForTimeout(2500); await shot('08_zoom_a');
  await tap(W - 40, 110); await page.waitForTimeout(1200); await shot('09_zoom_b');
  for (let i = 0; i < 6; i++) await tap(W - 40, 110);
  await page.waitForTimeout(900); await shot('10_zoom_c');
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(2500); await shot('11_zoom_next_char');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400); }
  await page.waitForTimeout(2500); await shot('12_zoom_later_char');
  await tap(20, 10); await page.waitForTimeout(600); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(3000); await shot('13_grid_keys');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500); await shot('14_back_menu');
  await page.keyboard.press('Escape'); await page.waitForTimeout(3000);
  console.log('end mem', JSON.stringify(await mem()));
  console.log('pageerrors', errs.length, errs.slice(0, 5).join(' | '));
  console.log('missing', [...new Set(miss)].slice(0, 15).join('\n'));
  await b.close();
})();
