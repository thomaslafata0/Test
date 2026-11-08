const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage(); const errs = [];
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
  await p.goto('https://cinder-cell.thomaslafata0.workers.dev/?x=' + Date.now()); await p.waitForTimeout(3000);
  const has = () => p.locator('.name-gate').count();
  console.log('prompt on first load', await has());
  await p.fill('#player-name', 'Tester42'); await p.click('button[data-a="setname"]'); await p.waitForTimeout(800);
  console.log('after save', await has(), await p.evaluate(() => [localStorage.getItem('cinder-cell-player-set'), Object.keys(localStorage)]));
  for (let i = 0; i < 3; i++) { await p.reload(); await p.waitForTimeout(2500); console.log('reload', i, 'prompt', await has()); }
  await p.screenshot({ path: process.env.OUT + '/name.png' });
  console.log(errs.slice(0, 10)); await b.close(); })();
