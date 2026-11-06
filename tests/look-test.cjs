const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8765/index.html');
  // grid of composites straight from look.js
  const grid = await page.evaluate(async () => {
    const L = await import('./look.js'); await L.loadLayers();
    const bodies = ['body_m1', 'body_m2', 'body_f1', 'body_f2'], cls = ['foundry', 'runner', 'clerk', 'preacher'], hairs = ['hair_short', 'hair_bob', 'hair_mohawk', 'hair_long_tied'];
    const c = document.createElement('canvas'); c.width = 4 * 4 * 70 + 20; c.height = 4 * 170; const g = c.getContext('2d'); g.fillStyle = '#2a2e36'; g.fillRect(0, 0, c.width, c.height);
    bodies.forEach((bd, bi) => cls.forEach((cl, ci) => {
      const look = { body: bd, hair: hairs[ci], skin: (bi + ci) % 6, hairColor: ci };
      const t = L.townSheets(look, cl), bt = L.battleSheet(look, cl, ['wpn_pistol', 'wpn_rifle', 'wpn_cannon', 'wpn_carbine'][ci], 'wpn_maul');
      const x = (bi * 4 + ci) * 70 + 10, y = bi * 170;
      if (t) { g.drawImage(t.idle_down.img, 0, 0, 64, 64, x, y, 64, 64); g.drawImage(t.walk_right.img, 64, 0, 64, 64, x, y + 60, 64, 64); }
      if (bt) g.drawImage(bt.anims.attack.img, 96, 0, 96, 96, x - 16, y + 90, 96, 96);
    }));
    return c.toDataURL();
  });
  require('fs').writeFileSync(`${OUT}/look-grid.png`, Buffer.from(grid.split(',')[1], 'base64'));
  // in-game screens
  await page.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(5), s = E.newGame(rng); s.screen = 'create'; s.draft = E.newDraft(s.meta, rng); s.draft.look = { body: 'body_f2', hair: 'hair_bob', skin: 0, hairColor: 2 }; s.draft.background = 'runner'; s.meta.tips = { town: true, combat: true, route: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-speed', JSON.stringify('manual')); });
  await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1200);
  const begin = await page.$('button[data-a="begin"]'); if (begin) { await begin.click(); await page.waitForTimeout(300); }
  await page.screenshot({ path: `${OUT}/look-create1.png` });
  await page.click('button[data-a="step"][data-v="3"]'); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/look-create3.png` });
  await page.click('button[data-a="step"][data-v="4"]'); await page.waitForTimeout(300); // Start is on the last step, Stats
  await page.click('button[data-a="create"]'); await page.waitForTimeout(1500);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/look-town.png`, clip: { x: 0, y: 250, width: 1100, height: 520 } });
  await page.click('button[data-a="popup"][data-v="gear"]'); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/look-gear.png`, clip: { x: 0, y: 0, width: 1100, height: 700 } }); await page.keyboard.press('Escape');
  await page.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(7); const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); E.deploy(s, 'garrison', 1, rng); s.run.enemy = E.makeEnemy(1, false, rng, 'garrison'); s.screen = 'combat'; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/look-combat.png`, clip: { x: 0, y: 200, width: 1100, height: 420 } });
  await page.keyboard.press('a'); await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/look-shoot.png`, clip: { x: 0, y: 200, width: 1100, height: 420 } });
  await page.waitForTimeout(2200); await page.keyboard.press('f'); await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/look-strike.png`, clip: { x: 0, y: 200, width: 1100, height: 420 } });
  console.log(errors.length ? errors : 'no errors');
  await b.close();
})();
