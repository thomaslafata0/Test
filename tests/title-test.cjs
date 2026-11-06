const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  for (const width of [1200, 390]) {
    const page = await b.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const ov = async (t) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 0) errors.push(`${t} overflow ${o}`); };
    await page.goto('http://localhost:8765/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(600);
    await ov('title'); await page.screenshot({ path: `${OUT}/title-${width}.png` });
    await page.click('button[data-a="continue-title"]'); await page.waitForTimeout(200);
    await page.click('button[data-a="begin"]'); await page.waitForTimeout(300);
    await ov('create1'); await page.screenshot({ path: `${OUT}/create1-${width}.png` });
    await page.click('button[data-a="look"][data-k="body_f2"]'); await page.click('button[data-a="step"][data-v="2"]'); await page.waitForTimeout(150);
    await page.click('button[data-a="bg"][data-v="clerk"]'); await page.click('button[data-a="step"][data-v="3"]'); await page.waitForTimeout(150);
    await ov('create3'); await page.screenshot({ path: `${OUT}/create3-${width}.png`, fullPage: true });
    await page.click('button[data-a="look"][data-v="hair"][data-k="hair_mohawk"]'); await page.click('.swatches .swatch:nth-child(4)');
    await page.click('button[data-a="step"][data-v="4"]'); await page.waitForTimeout(100); await page.click('button[data-a="create"]'); await page.waitForTimeout(500);
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')));
    console.log(width, 'look saved:', JSON.stringify(s.char.look), s.char.background);
    // save code round trip
    await page.click('button[data-a="modal"][data-v="settings"]'); await page.waitForTimeout(150);
    await page.click('button[data-a="savecode"]'); await page.waitForTimeout(200);
    const code = await page.$eval('textarea.report', (t) => t.value);
    await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(500);
    await page.click('button[data-a="modal"][data-v="settings"]'); await page.waitForTimeout(150);
    await page.fill('#load-code', code); await page.click('button[data-a="loadcode"]'); await page.waitForTimeout(400);
    const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')));
    console.log(width, 'after load:', s2.char && s2.char.name, s2.char && s2.char.look && s2.char.look.hair, 'screen', s2.screen);
    await page.reload(); await page.waitForTimeout(500); await ov('title2'); await page.screenshot({ path: `${OUT}/title-return-${width}.png` });
    console.log(width, errors.length ? errors : 'no errors');
    await page.close();
  }
  await b.close();
})();
