// The escape screen and going back in, on a phone held sideways: the card fits, the button works, Deploy shows the new level.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch(), errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('cinder-cell-news', 'escape'); const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(5), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; s.meta.tips = { town: true, combat: true, route: true };
    for (const m of D.MAPS) { const q = E.mapProgress(s.char, m.id); q.deepest = 20; q.best = { 0: 20 }; q.freed = true; } s.escape = { threat: 0, name: s.char.name }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);
  check('the escape screen shows at home', await p.locator('.escape-card').count() === 1);
  await p.screenshot({ path: `${OUT}/threat-escape.png` });
  const fit = await p.evaluate(() => { const b = document.querySelector('button[data-a="returnhigher"]'); b.scrollIntoView(); const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1; });
  check('phone: the button can be reached', fit);
  await p.click('button[data-a="returnhigher"]'); await p.waitForTimeout(400);
  const st = await p.evaluate(() => { const s = cinderGame.state(); return { t: s.char.threat, esc: s.escape, g: s.char.maps.garrison.deepest }; });
  check('back in at Threat I, maps reset', st.t === 1 && !st.esc && st.g === 0 && await p.locator('.escape-card').count() === 0, JSON.stringify(st));
  await p.click('.shortcuts button[data-v="missions"]').catch(() => {}); await p.waitForTimeout(400);
  check('Deploy shows Threat I and its rule', await p.evaluate(() => [...document.querySelectorAll('.threat')].some((x) => x.textContent.includes('Hunted'))));
  await p.screenshot({ path: `${OUT}/threat-gate.png` });
  await browser.close();
  console.log(errors.length ? errors.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
