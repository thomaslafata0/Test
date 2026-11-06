const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  for (const W of [1200, 390]) {
    const page = await b.newPage({ viewport: { width: W, height: 900 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://localhost:8765/index.html');
    // a cell with some history, then a fight to see the strip
    await page.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(11), s = E.newGame(rng); E.createChar(s, rng); s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true }; s.notice = null;
      for (let i = 0; i < 9; i++) E.feat(s, 'kill:patrol'); for (let i = 0; i < 99; i++) E.feat(s, 'kills'); E.feat(s, 'bosses'); s.featUnlocks = null;
      E.deploy(s, 'garrison', 1, rng); s.run.enemy = E.makeEnemy(1, false, rng, 'garrison'); s.run.enemy.id = 'patrol'; s.run.enemy.name = 'Patrol Trooper'; s.run.enemy.hp = 1; s.screen = 'combat';
      localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-speed', JSON.stringify('manual')); });
    await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(900);
    await page.keyboard.press('a'); await page.waitForTimeout(2500);
    const toast = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent);
    console.log(W, 'toast:', toast);
    await page.screenshot({ path: `${OUT}/feats-strip-${W}.png` });
    const bars = await page.$$eval('.aa-feat', (els) => els.map((e) => e.textContent.trim()));
    console.log(W, 'strip bars:', bars);
    // Ordinary fights can drop contraband now: clear the pick so the header can be reached.
    await page.click('button[data-a="perk"][data-v=""]', { timeout: 500 }).catch(() => {}); await page.waitForTimeout(150);
    await page.click('button[data-a="modal"][data-v="feats"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/feats-${W}.png`, fullPage: W === 390 ? false : true });
    console.log(W, 'feat rows', await page.$$eval('.feat', (e) => e.length), 'chips', await page.$$eval('.modal.feats .chip', (e) => e.map((x) => x.textContent)));
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')).meta);
    console.log(W, 'tiers', JSON.stringify(s.feats.tiers), 'resolve', s.resolve);
    console.log(W, errors.length ? errors : 'no errors');
    await page.close();
  }
  await b.close();
})();
