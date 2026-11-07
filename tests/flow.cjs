// Plays from a fresh save through creation, the yard, a raid, and screenshots each new screen/popup once.
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots', 'flow');
require('fs').mkdirSync(OUT, { recursive: true });
const W = +process.argv[2] || 390;
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: W, height: 844 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/town\/street\//.test(m.location().url)) errors.push(m.text()); });
  await page.goto('http://localhost:8765/index.html'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cinder-cell-speed', JSON.stringify('auto2')); localStorage.setItem('cinder-cell-ui', JSON.stringify({ autoStop: false })); }); await page.reload(); await page.waitForTimeout(700);
  const seen = new Set(); let n = 0;
  const shot = async (tag) => { if (seen.has(tag)) return; seen.add(tag); n++; await page.screenshot({ path: `${OUT}/${W}-${String(n).padStart(2, '0')}-${tag}.png`, fullPage: true }); };
  const st = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1') || '{}'); return { screen: s.screen, popup: s.popup, modal: !!document.querySelector('.modal-wrap'), title: !!document.querySelector('.title'), result: !!document.querySelector('.aa'), busy: document.getElementById('app').classList.contains('busy'), h2: (document.querySelector('h2') || {}).textContent }; });
  await shot('title');
  await page.click('button[data-a="modal"][data-v="manual"]'); await page.waitForTimeout(200); await shot('manual'); await page.keyboard.press('Escape');
  await page.click('button[data-a="modal"][data-v="settings"]'); await page.waitForTimeout(200); await shot('settings'); await page.keyboard.press('Escape');
  await page.click('button[data-a="modal"][data-v="board"]'); await page.waitForTimeout(400); await shot('board'); await page.keyboard.press('Escape');
  await page.click('button[data-a="continue-title"]'); await page.waitForTimeout(400); await shot('intro');
  const begin = await page.$('button[data-a="begin"]'); if (begin) { await begin.click(); await page.waitForTimeout(300); }
  await shot('create-body');
  await page.click('button[data-a="step"][data-v="2"]'); await page.waitForTimeout(150); await shot('create-class');
  await page.click('button[data-a="bg"][data-v="runner"]'); await page.click('button[data-a="step"][data-v="4"]'); await page.waitForTimeout(150); await shot('create-details');
  await page.click('button[data-a="create"]'); await page.waitForTimeout(150); await page.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(1500); await shot('town-first');
  for (const p of ['missions', 'market', 'clinic', 'character', 'gear']) { await page.click(`button[data-a="popup"][data-v="${p}"]`); await page.waitForTimeout(300); await shot(`pop-${p}`); await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
  await page.click('button[data-a="popup"][data-v="missions"]'); await page.waitForTimeout(200);
  await page.click('button[data-a="deploy"]'); await page.waitForTimeout(800);
  for (let i = 0; i < 400; i++) {
    const s = await st();
    if (s.busy) { await page.waitForTimeout(300); continue; }
    const tag = s.screen + (s.result ? '-result' : '');
    await shot(tag);
    if (s.screen === 'route') { if (s.result) { const d = await page.$('button[data-a="dismissresult"]'); if (d) await d.click(); } await page.keyboard.press('1'); await page.waitForTimeout(400); continue; }
    if (s.screen === 'combat') {
      // Auto battle hands back when stims run out or HP is low. Without answering, this waits for ever.
      const go = await page.$('.stim-prompt button[data-v="continue"]'); if (go) await go.click();
      else if (await page.evaluate(() => globalThis.cinderGame.stage.mode === 'manual')) await page.keyboard.press('a');
      await page.waitForTimeout(600); continue;
    }
    if (s.screen === 'event') { await shot('event'); const o = await page.$('button[data-a="event"]:not([disabled])'); if (o) { await o.click(); await page.waitForTimeout(300); await shot('event-result'); } const d = await page.$('button[data-a="eventDone"]'); if (d) await d.click(); await page.waitForTimeout(300); continue; }
    if (s.screen === 'loot') { await page.keyboard.press('1'); await page.waitForTimeout(300); continue; }
    if (s.screen === 'perk') { await page.keyboard.press('1'); await page.waitForTimeout(300); continue; }
    if (s.screen === 'sectorClear') { await page.keyboard.press('1'); await page.waitForTimeout(400); continue; }
    if (s.screen === 'death') { await shot('death'); break; }
    if (s.screen === 'town') { await shot('town-after'); break; }
    await page.waitForTimeout(200);
  }
  console.log('shots', n, errors.length ? errors : 'no errors');
  await b.close();
})();
