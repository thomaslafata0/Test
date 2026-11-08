const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const c = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const host = await c.newPage(), guest = await c.newPage(); const errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  for (const [p, n] of [[host, 'host'], [guest, 'guest']]) { p.on('pageerror', (e) => errors.push(`${n}: ${e.message} ${(e.stack || '').slice(0, 300)}`)); p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/town\/street\//.test(m.location().url) && !/WebSocket|net::|AudioContext/.test(m.text())) errors.push(`${n} console: ${m.text()}`); }); }
  await host.goto(URL);
  await host.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 900; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name: 'Hosty' })); });
  await host.reload(); await host.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await host.waitForTimeout(800);
  await host.click('button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(150); await host.click('button[data-a="coophost"]'); await host.waitForTimeout(300);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent); await host.keyboard.press('Escape');
  await guest.goto(URL + '?join=' + code); await guest.waitForTimeout(1000);
  await guest.click('button[data-a="step"][data-v="2"]'); await guest.click('button[data-a="bg"][data-v="runner"]'); await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100); await guest.click('button[data-a="create"]'); await guest.waitForTimeout(150); await guest.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await guest.waitForTimeout(1200);
  // The friend gets the same Lantern, Wheel and Ventures as the host; the shuttle stays home.
  await guest.bringToFront(); await guest.waitForTimeout(500);
  const labels = await guest.evaluate(() => [...document.querySelectorAll('.shortcuts button')].map((b) => b.textContent.trim()));
  for (const w of ['Lantern', 'Orbit', 'Ventures']) check(`friend sees ${w}`, labels.some((x) => x.startsWith(w)), labels.join(','));
  const cr = async () => host.evaluate(() => { const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); return { me: s.char.credits, friend: s.char2.credits, drink: s.char2.drink, hostDrink: s.char.drink, vent: s.char2.ventures }; });
  await host.evaluate(() => { const g = globalThis.cinderGame && cinderGame.state(); if (g && g.char2) { g.char2.credits = 800; } });
  await host.click('button[data-a="dismissresult"]', { timeout: 200 }).catch(() => {});
  await guest.click('.shortcuts button[data-v="bar"]'); await guest.waitForTimeout(300);
  await guest.locator('button[data-a="drink"]:not([disabled])').first().click({ timeout: 3000 }); await guest.waitForTimeout(600);
  let a = await cr(); check('friend orders a drink on their own tab', !!a.drink && !a.hostDrink, JSON.stringify(a));
  await guest.click('.pop-tabs [data-v="wheel"]', { timeout: 2000 }).catch(() => guest.keyboard.press('Escape'));
  await guest.waitForTimeout(250);
  if (!(await guest.locator('.dtm-wheel').count())) { await guest.keyboard.press('Escape'); await guest.click('.shortcuts button[data-v="wheel"]'); await guest.waitForTimeout(250); }
  await guest.click('button[data-a="bet"][data-v="black"]'); await guest.waitForTimeout(300);
  check('the bet sticks on the friend’s screen', await guest.locator('button[data-a="bet"][data-v="black"].primary').count() === 1);
  const before = (await cr()).friend, hostBefore = (await cr()).me;
  await guest.click('button[data-a="spin"]');
  const seen = []; for (let i = 0; i < 40; i++) { await guest.waitForTimeout(100); seen.push(await guest.evaluate(() => { const b = document.querySelector('button[data-a="spin"]'); return (b ? b.textContent.slice(0, 8) : 'none') + (document.querySelector('.dt-result') ? '+R' : ''); })); if (seen[i].includes('+R') && i > 5) break; }
  console.log(seen.join(' '));
  check('the wheel spins on the friend screen', seen.some((x) => /Spinning/.test(x)), seen.slice(0, 8).join(' '));
  await guest.waitForFunction(() => document.querySelector('.dt-result'), null, { timeout: 15000 });
  a = await cr(); check('the spin changes only the friend’s credits', a.friend !== before && a.me === hostBefore, `${before} > ${a.friend}, host ${a.me}`);
  await guest.screenshot({ path: `${OUT}/coop-guest-wheel.png` });
  await guest.keyboard.press('Escape'); await guest.waitForTimeout(150);
  await guest.click('.shortcuts button[data-v="orbit"]'); await guest.waitForTimeout(250);
  check('Orbit explains itself to the friend', /own cell/.test(await guest.innerText('.dtm-orbit')));
  await guest.keyboard.press('Escape'); await guest.waitForTimeout(150);
  await guest.click('.shortcuts button[data-v="ventures"]'); await guest.waitForTimeout(250);
  check('the friend can open Ventures', await guest.locator('.dtm-ventures').count() === 1);
  await guest.keyboard.press('Escape'); await guest.waitForTimeout(150);
  // Through the door: the croupier and the barman work for the friend as well.
  await guest.evaluate(() => { const t = cinderTown; t.enter(t.doors.find((d) => d.id === 'lantern')); t.player.x = 300; }); await guest.waitForTimeout(150);
  await guest.keyboard.press('e'); await guest.waitForTimeout(300);
  check('the croupier opens the wheel for the friend', await guest.locator('.dtm-wheel').count() === 1);
  await browser.close();
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  console.log(real.length ? real.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(real.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
