const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  for (const W of [1200, 390]) {
    const page = await b.newPage({ viewport: { width: W, height: 900 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://localhost:8765/index.html');
    await page.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(5), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 1500; s.meta.resolve = 30; s.meta.tips = { town: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
    await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1000);
    const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')));
    // bar
    await page.click('button[data-a="modal"][data-v="bar"]'); await page.waitForTimeout(200);
    await page.click('button[data-a="barchat"][data-v="keg7"]'); await page.click('button[data-a="barchat"][data-v="vess"]'); await page.click('button[data-a="drink"]'); await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/dt-bar-${W}.png`, fullPage: true });
    let s = await save(); console.log(W, 'bar: drink', s.char.drink, 'credits', s.char.credits, 'say', Object.keys(s.barSay || {}));
    // wheel
    await page.click('.modal .tab[data-v="wheel"]'); await page.waitForTimeout(200);
    await page.click('button[data-a="bet"][data-v="d2"]'); await page.click('button[data-a="stake"][data-v="50"]'); await page.click('button[data-a="spin"]'); await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/dt-wheel-spin-${W}.png` });
    await page.waitForTimeout(3200); await page.screenshot({ path: `${OUT}/dt-wheel-${W}.png`, fullPage: true });
    s = await save(); console.log(W, 'wheel:', JSON.stringify(s.wheelResult), 'credits', s.char.credits);
    // ventures
    await page.click('.modal .tab[data-v="ventures"]'); await page.waitForTimeout(200);
    await page.fill('#inv-stall', '200'); await page.click('button[data-a="invest"][data-v="stall"]'); await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/dt-ventures-${W}.png`, fullPage: true });
    s = await save(); console.log(W, 'ventures:', JSON.stringify(s.meta.ventures), 'credits', s.char.credits);
    // orbit: buy parts, launch low, fight with keys
    await page.click('.modal .tab[data-v="orbit"]'); await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/dt-orbit-${W}.png`, fullPage: true });
    await page.click('button[data-a="shippart"][data-v="guns"]'); await page.click('button[data-a="shipcell"][data-v="ejector"]'); await page.waitForTimeout(300);
    await page.click('button[data-a="orbitgo"][data-v="low"]'); await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/dt-orbit-fight-${W}.png` });
    for (let i = 0; i < 20; i++) { s = await save(); if (!s.orbit || s.orbit.over) break; const busy = await page.$('.actions.locked'); if (busy) { await page.waitForTimeout(300); continue; } await page.keyboard.press(s.orbit.intent === 'volley' ? '2' : '1'); await page.waitForTimeout(900); }
    s = await save(); console.log(W, 'orbit:', s.orbit && s.orbit.over, JSON.stringify(s.orbit && s.orbit.result), 'ship', JSON.stringify(s.meta.ship));
    await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/dt-orbit-end-${W}.png`, fullPage: true });
    const cl = await page.$('button[data-a="orbitclose"]'); if (cl) await cl.click(); await page.waitForTimeout(300);
    s = await save(); console.log(W, 'after close: screen', s.screen, 'orbit', s.orbit, 'marks', s.char && s.char.marks);
    console.log(W, errors.length ? errors : 'no errors');
    await page.close();
  }
  await b.close();
})();
