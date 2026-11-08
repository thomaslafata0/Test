// Cells: up to five games on one device. Switching never touches the other cell; the slot survives a reload; Main menu; Erase.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch(), p = await browser.newPage({ viewport: { width: 1100, height: 800 } }); const errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(async () => { localStorage.clear(); const E = await import('./engine.js'), rng = E.seededRng(3), s = E.newGame(rng); E.createChar(s, rng); s.char.name = 'Coop Cass'; s.char.credits = 777; s.screen = 'town'; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-news', 'escape'); });
  await p.reload(); await p.waitForTimeout(900);
  check('an old save is cell 1', /cell 1 of 5/i.test(await p.innerText('button[data-v="cells"]')));
  await p.click('.title-menu button[data-v="cells"]'); await p.waitForTimeout(250);
  check('cell 1 is playing, the rest are empty', /Coop Cass/.test(await p.innerText('.cell-row.cur')) && (await p.locator('.cell-row:not(.cur)').allInnerTexts()).every((t) => /Empty/.test(t)));
  await p.click('button[data-a="cellgo"][data-v="1"]'); await p.waitForTimeout(500);
  check('cell 2 opens on the title, fresh', await p.locator('.title-menu').count() === 1 && /cell 2 of 5/i.test(await p.innerText('button[data-v="cells"]')) && await p.evaluate(() => !cinderGame.state().char));
  const cell1 = await p.evaluate(() => localStorage.getItem('cinder-cell-save-v1'));
  check('switching saved cell 1 as it was', /Coop Cass/.test(cell1) && /"credits":777/.test(cell1));
  // Make progress in cell 2.
  await p.evaluate(async () => { const E = await import('./engine.js'), s = cinderGame.state(), rng = E.seededRng(9); E.createChar(s, rng); s.char.name = 'Solo Sam'; s.char.credits = 50; s.screen = 'town'; cinderGame.after(); });
  await p.waitForTimeout(300);
  check('cell 1 is untouched by cell 2', (await p.evaluate(() => localStorage.getItem('cinder-cell-save-v1'))) === cell1);
  check('cell 2 has its own save', /Solo Sam/.test(await p.evaluate(() => localStorage.getItem('cinder-cell-save-v1-s1') || '')));
  await p.reload(); await p.waitForTimeout(900);
  check('a reload stays in cell 2', /cell 2 of 5/i.test(await p.innerText('button[data-v="cells"]')) && await p.evaluate(() => cinderGame.state().char && cinderGame.state().char.name === 'Solo Sam'));
  // Into the game, then back out by the menu.
  await p.click('button[data-a="continue-title"]'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('button[data-a="modal"][data-v="menu"]').click()); await p.waitForTimeout(200);
  await p.click('button[data-a="mainmenu"]'); await p.waitForTimeout(400);
  check('Main menu goes back to the title', await p.locator('.title-menu').count() === 1);
  await p.click('.title-menu button[data-v="cells"]'); await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/cells.png` });
  await p.click('button[data-a="cellgo"][data-v="0"]'); await p.waitForTimeout(500);
  check('back in cell 1 with its own operative and credits', await p.evaluate(() => { const c = cinderGame.state().char; return c && c.name === 'Coop Cass' && c.credits === 777; }));
  // Erase takes two taps.
  await p.click('.title-menu button[data-v="cells"]'); await p.waitForTimeout(250);
  await p.click('button[data-a="celldel"][data-v="1"]'); await p.waitForTimeout(200);
  check('one tap only arms erase', /Solo Sam/.test(await p.evaluate(() => localStorage.getItem('cinder-cell-save-v1-s1') || '')));
  await p.click('button[data-a="celldel"][data-v="1"]'); await p.waitForTimeout(250);
  check('the second tap erases that cell only', !(await p.evaluate(() => localStorage.getItem('cinder-cell-save-v1-s1'))) && /Coop Cass/.test(await p.evaluate(() => localStorage.getItem('cinder-cell-save-v1'))));
  check('its row is empty again', /Empty/.test(await p.innerText('.cell-row:nth-child(2)')));
  // Phone.
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(300);
  const fit = await p.evaluate(() => { const m = document.querySelector('.cells-modal'), r = m.getBoundingClientRect(); return { h: r.height <= innerHeight + 1, scroll: m.scrollHeight > m.clientHeight }; });
  console.log('phone cells modal', JSON.stringify(fit));
  await p.screenshot({ path: `${OUT}/cells-phone.png` });
  await browser.close();
  console.log(errors.length ? errors.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
