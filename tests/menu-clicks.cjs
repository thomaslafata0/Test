// Buying from a menu must not move the buttons: clicking again in the same spot has to hit the same button.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch(); let failed = 0;
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
  for (const [w, h] of [[1280, 720], [390, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(5), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; s.meta.resolve = 500; s.char.credits = 50000; s.meta.tips = { town: true, gear: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
    await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500);
    const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')));
    await p.click('button[data-a="popup"][data-v="character"]'); await p.waitForTimeout(250);
    // Character: four clicks on one spot, with the popup scrolled and without.
    for (const scroll of [0, 90]) {
      await p.evaluate((y) => { document.querySelector('.modal').scrollTop = y; }, scroll); await p.waitForTimeout(60);
      const r = await p.locator('button[data-a="train"]').first().boundingBox();
      await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      const before = (await save()).meta.training.hp;
      for (let i = 0; i < 4; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(40); }
      const after = (await save()).meta.training.hp, r2 = await p.locator('button[data-a="train"]').first().boundingBox();
      check(`${w}px scrolled ${scroll}: four clicks train four times`, after - before === 4, `${before} -> ${after}`);
      check(`${w}px scrolled ${scroll}: the button did not move`, Math.abs(r2.y - r.y) < 2, `${Math.round(r.y)} -> ${Math.round(r2.y)}`);
    }
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    // Black Market: the first supply button stays put through a purchase.
    await p.click('button[data-a="popup"][data-v="market"]'); await p.waitForTimeout(250);
    const sel = 'button[data-a="buyitem"], button[data-a="item"]';
    if (await p.locator(sel).count()) {
      await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(60);
      const r = await p.locator(sel).first().boundingBox();
      await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(120);
      const r2 = await p.locator(sel).first().boundingBox();
      check(`${w}px market button did not move`, Math.abs(r2.y - r.y) < 2, `${Math.round(r.y)} -> ${Math.round(r2.y)}`);
    }
    await p.close();
  }
  await b.close();
  console.log(failed ? `${failed} FAILED` : 'no errors'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e.message.slice(0, 400)); process.exit(1); });
