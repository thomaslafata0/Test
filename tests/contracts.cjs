// Daily contracts in the browser: the Daily tab, taking one (the cell's save untouched), resuming after a reload, the result, one attempt.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch(), errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  const p = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('cinder-cell-news', 'reach'); const E = await import('./engine.js'), rng = E.seededRng(4), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 321; s.meta.resolve = 7; s.screen = 'town'; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.click('button[data-a="popup"][data-v="missions"]'); await p.waitForTimeout(250);
  await p.click('button[data-a="missiontab"][data-v="daily"]'); await p.waitForTimeout(300);
  check('a Daily tab with the daily and weekly contracts', await p.locator('.ct-card').count() === 2);
  await p.screenshot({ path: `${OUT}/contracts-tab.png` });
  const homeName = await p.evaluate(() => cinderGame.state().char.name);
  await p.click('button[data-a="contractgo"][data-v="daily"]'); await p.waitForTimeout(800);
  let s = await p.evaluate(() => { const s = cinderGame.state(), home = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); return { contract: s.contract && s.contract.kind, run: !!s.run, name: s.char.name, cls: s.char.background, homeCr: home.char.credits, homeName: home.char.name, started: !!(home.meta.contractsDone && Object.keys(home.meta.contractsDone).length) }; });
  check('the loaner is deployed, the cell save untouched', s.contract === 'daily' && s.run && s.name !== homeName && s.homeCr === 321 && s.homeName === homeName && s.started, JSON.stringify(s));
  await p.screenshot({ path: `${OUT}/contracts-run.png` });
  await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(900);
  check('a reload carries on with the contract', await p.evaluate(() => !!(cinderGame.state().contract && cinderGame.state().run)));
  // Clear two sectors, then the loaner dies.
  await p.evaluate(async () => { const E = await import('./engine.js'), s = cinderGame.state(), rng = E.seededRng(3); for (let k = 1; k <= 2; k++) { s.run.sector = k; E.clearSector(s, rng); } s.run.kills = 6; s.screen = 'combat'; s.char.hp = 0; E.die ? E.die(s) : null; if (s.run) { s.run.enemy = s.run.enemy || E.makeEnemy(3, false, rng, 'garrison'); E.endRun(s, 'escaped', rng); } cinderGame.after(); });
  await p.waitForTimeout(600);
  s = await p.evaluate(() => { const s = cinderGame.state(); return { back: s.char.name, cr: s.char.credits, res: s.meta.resolve, rec: s.meta.contractsDone, contract: !!s.contract, saved: !!localStorage.getItem('cinder-cell-contract') }; });
  check('the cell is back, no payout for an unfinished contract', s.back === homeName && s.cr === 321 && s.res === 7 && !s.contract && !s.saved, JSON.stringify(s));
  check('the result shows the score', await p.locator('.ct-result').count() === 1 && /\d/.test(await p.locator('.ct-score b').innerText()));
  await p.screenshot({ path: `${OUT}/contracts-result.png` });
  await p.click('.ct-result button[data-a="closemodal"]'); await p.waitForTimeout(200);
  await p.click('button[data-a="popup"][data-v="missions"]'); await p.waitForTimeout(250); await p.click('button[data-a="missiontab"][data-v="daily"]'); await p.waitForTimeout(300);
  check('one attempt: the daily shows your score, no button', await p.locator('button[data-a="contractgo"][data-v="daily"]').count() === 0 && await p.locator('button[data-a="contractgo"][data-v="weekly"]').count() === 1);
  // A finished weekly pays the cell.
  await p.click('button[data-a="contractgo"][data-v="weekly"]'); await p.waitForTimeout(600);
  await p.evaluate(async () => { const E = await import('./engine.js'), s = cinderGame.state(), rng = E.seededRng(5); for (let k = 1; k <= 10; k++) { s.run.sector = k; E.clearSector(s, rng); } E.attemptExtract(s, rng); cinderGame.after(); });
  await p.waitForTimeout(600);
  s = await p.evaluate(() => { const s = cinderGame.state(); return { cr: s.char.credits, res: s.meta.resolve }; });
  check('a finished contract pays the cell', s.res === 7 + 6 && s.cr === 321 + 400, JSON.stringify(s));
  await p.screenshot({ path: `${OUT}/contracts-done.png` });
  await p.setViewportSize({ width: 844, height: 390 }); await p.click('.ct-result button[data-a="closemodal"]').catch(() => {}); await p.waitForTimeout(200);
  await p.click('button[data-a="popup"][data-v="missions"]'); await p.waitForTimeout(250); await p.click('button[data-a="missiontab"][data-v="daily"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/contracts-phone.png` });
  check('phone: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await browser.close();
  console.log(errors.length ? errors.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
