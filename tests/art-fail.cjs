// One body's art fails to download: the game must still draw a figure and throw nothing.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  let blocked = 0; await p.route(/chars2\/.*body_f2.*\.png/, (r) => { blocked++; r.abort(); });
  await p.goto(process.env.U || 'http://localhost:8765/index.html'); await p.waitForTimeout(500);
  await p.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(9), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; s.char.look = { body: 'body_f2', hair: 'hair_mohawk', skin: 2, hairColor: 3 }; s.meta.tips = { town: true, combat: true, route: true, perk: true, loot: true, gear: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(600); await p.click('button[data-a="continue-title"]').catch(() => {}); await p.waitForTimeout(1500);
  console.log('blocked files', blocked, '| errors', JSON.stringify(errs)); await b.close(); process.exit(errs.length || !blocked ? 1 : 0); })();
