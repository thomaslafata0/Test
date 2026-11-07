// The E-Girl Room on both screens, and a full barracks duel between host and friend, contraband changing hands.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const c = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const host = await c.newPage(), guest = await c.newPage(); const errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  for (const [p, n] of [[host, 'host'], [guest, 'guest']]) { p.on('pageerror', (e) => errors.push(`${n}: ${e.message} ${(e.stack || '').slice(0, 300)}`)); p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/WebSocket|net::|AudioContext/.test(m.text())) errors.push(`${n} console: ${m.text()}`); }); }
  await host.goto(URL);
  await host.evaluate(async () => { const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 1400; const id = D.PERKS[0].id; s.char.perks = [id]; s.char.perkN = { [id]: 2 }; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name: 'Hosty' })); localStorage.setItem('cinder-cell-news', 'afterhours'); });
  await host.reload(); await host.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await host.waitForTimeout(800);
  await host.keyboard.press('Escape').catch(() => {});
  // The room, solo first. It only opens once the hostess art is installed.
  await host.click('.shortcuts button[data-v="bar"]'); await host.waitForTimeout(250);
  const room = await host.locator('.pop-tabs [data-v="lounge"]').count();
  console.log(room ? 'E-Girl Room open' : 'E-Girl Room hidden: no hostess art yet');
  if (room) {
  await host.click('.pop-tabs [data-v="lounge"]'); await host.waitForTimeout(300);
  check('three hostesses', await host.locator('.hostess-card').count() === 3 && await host.locator('.hostess.ph').count() === 0);
  await host.click('button[data-a="lounge"][data-v="vex"]'); await host.waitForTimeout(400);
  const st = await host.evaluate(() => { const s = cinderGame.state(); return { cr: s.char.credits, fav: s.char.fav, booked: s.char.booked }; });
  check('a night costs 500 and leaves a mark', st.cr === 900 && st.booked === 'vex' && st.fav && Object.keys(st.fav).length, JSON.stringify(st));
  check('the result shows, and the room is booked', await host.locator('.lounge-res').count() === 1 && await host.locator('button[data-a="lounge"]:not([disabled])').count() === 0);
  await host.screenshot({ path: `${OUT}/lounge.png` });
  await host.keyboard.press('Escape'); await host.waitForTimeout(150);
  }
  // Solo, the ring explains itself.
  await host.evaluate(() => { const r = cinderTown.onAction('barracks'); globalThis.__knock = r && r.text; });
  check('solo: the barracks door just knocks', await host.evaluate(() => !!globalThis.__knock) && await host.locator('.modal.duel').count() === 0);
  await host.keyboard.press('Escape'); await host.waitForTimeout(150);
  // Co-op.
  await host.click('button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(150); await host.click('button[data-a="coophost"]'); await host.waitForTimeout(300);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent); await host.keyboard.press('Escape');
  await guest.goto(URL + '?join=' + code); await guest.waitForTimeout(1000);
  await guest.click('button[data-a="step"][data-v="2"]'); await guest.click('button[data-a="bg"][data-v="runner"]'); await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100); await guest.click('button[data-a="create"]'); await guest.waitForTimeout(150); await guest.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await guest.waitForTimeout(1200);
  await host.evaluate(async () => { const D = await import('./data.js'), s = cinderGame.state(), id = D.PERKS[1].id; s.char2.perks = [id]; s.char2.perkN = { [id]: 1 }; s.char2.credits = 700; cinderGame.after(); });
  await guest.waitForTimeout(600);
  if (room) {
  // The host opening and closing menus doesn't rebuild the friend's page (that rebuild was a visible flash).
  await guest.bringToFront(); await guest.waitForTimeout(300);
  await guest.evaluate(() => { globalThis.__mark = document.querySelector('#app .status'); });
  for (const v of ['missions', 'market', 'character']) { await host.evaluate((x) => document.querySelector(`button[data-a="popup"][data-v="${x}"]`).click(), v); await host.waitForTimeout(350); await host.keyboard.press('Escape'); await host.waitForTimeout(350); }
  await guest.waitForTimeout(400);
  check('the host\u2019s menus don\u2019t flash the friend\u2019s screen', await guest.evaluate(() => globalThis.__mark === document.querySelector('#app .status')));
  // The friend's own night out runs on the host and lands on the friend's operative only.
  await guest.click('.shortcuts button[data-v="bar"]'); await guest.waitForTimeout(250); await guest.click('.pop-tabs [data-v="lounge"]'); await guest.waitForTimeout(300);
  await guest.click('button[data-a="lounge"][data-v="rook"]'); await guest.waitForTimeout(700);
  const gs = await host.evaluate(() => { const s = cinderGame.state(); return { cr: s.char2.credits, booked: s.char2.booked, me: s.char.booked }; });
  check('the friend books Rook on their own credits', gs.cr === 200 && gs.booked === 'rook' && gs.me === 'vex', JSON.stringify(gs));
  check('the friend sees their result', await guest.locator('.lounge-res').count() === 1);
  await guest.keyboard.press('Escape'); await guest.waitForTimeout(150);
  }
  // The duel. The friend plays it at phone size.
  await guest.setViewportSize({ width: 844, height: 390 }); await guest.waitForTimeout(300);
  await host.evaluate(() => cinderTown.onAction('barracks')); await host.waitForTimeout(300);
  await host.click('button[data-a="duel"][data-v="challenge"]'); await host.waitForTimeout(700);
  check('the challenge opens the ring on the friend’s screen', await guest.locator('.modal.duel button[data-v="yes"]').count() === 1);
  await guest.screenshot({ path: `${OUT}/duel-invite.png` });
  await guest.click('button[data-a="duel"][data-v="yes"]'); await guest.waitForTimeout(600);
  await host.click('button[data-a="duel"][data-v="pick"][data-k="bruiser"]'); await host.waitForTimeout(400);
  await guest.click('button[data-a="duel"][data-v="pick"][data-k="gunner"]'); await guest.waitForTimeout(700);
  await host.waitForSelector('.duel-fight .actions', { timeout: 8000 }); await guest.waitForSelector('.duel-fight .actions', { timeout: 8000 });
  check('both screens are in the fight', true);
  await host.screenshot({ path: `${OUT}/duel-fight.png` });
  check('both fighters are on the battle stage, laid out like a raid fight', await host.locator('#app > .columns.fight.duel-fight .stage canvas').count() === 1 && await guest.locator('#app > .columns.fight.duel-fight .stage canvas').count() === 1);
  for (let i = 0; i < 16; i++) {
    await host.waitForSelector('.duel-fight button[data-k="strike"]:not([disabled]), .duel-fight .notice', { timeout: 20000 });
    if (await host.locator('.duel-fight .notice').count()) break;
    await host.keyboard.press('f');
    await guest.waitForSelector('.duel-fight button[data-k="shoot"]:not([disabled])', { timeout: 8000 }).catch(async (e) => { for (const [n, pg] of [['host', host], ['guest', guest]]) console.log(n, await pg.evaluate(() => { const d = cinderGame.state().duel; return JSON.stringify({ phase: d && d.phase, round: d && d.round, move: d && d.move, busy: cinderGame.stage.duelBusy, btns: [...document.querySelectorAll('.duel-fight button')].map((b) => b.dataset.k + (b.disabled ? '-off' : '-on')).join(' '), screen: !!document.querySelector('.duel-fight') }); })); throw e; });
    await guest.click('button[data-a="duel"][data-k="shoot"]');
    if (i === 1) { await host.waitForTimeout(900); await host.screenshot({ path: `${OUT}/duel-anim.png` }); await guest.screenshot({ path: `${OUT}/duel-phone-mid.png` }); }
  }
  await host.waitForSelector('.duel-fight .notice', { timeout: 20000 }).catch(() => {});
  await host.screenshot({ path: `${OUT}/duel-done-host.png` });
  // On a phone the moves sit beside the stage, no scrolling.
  const fit = await guest.evaluate(() => ({ scroll: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight, notice: (() => { const r = document.querySelector('.duel-fight .notice, .duel-fight .actions').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; })() }));
  check('phone: the ring fits on one screen', fit.scroll <= 1 && fit.notice, JSON.stringify(fit));
  await guest.screenshot({ path: `${OUT}/duel-phone.png` });
  const end = await host.evaluate(() => { const s = cinderGame.state(), d = s.duel; return d && { phase: d.phase, winner: d.winner, prize: d.prize, a: s.char.perkN, b: s.char2.perkN }; });
  check('the bout ends', end && end.phase === 'done', JSON.stringify(end));
  if (end && end.winner !== null) {
    const total = (o) => Object.values(o || {}).reduce((x, y) => x + y, 0);
    check('one piece changes hands', end.prize && total(end.a) + total(end.b) === 3 && (end.winner === 0 ? total(end.a) === 3 : total(end.b) === 2), JSON.stringify(end));
  }
  await guest.waitForTimeout(400);
  await guest.waitForSelector('.duel-fight .notice', { timeout: 20000 }).catch(() => {});
  check('the friend sees the result', /You (win|lose)|Draw/.test(await guest.innerText('.duel-fight')));
  await guest.screenshot({ path: `${OUT}/duel-done-guest.png` });
  await host.click('button[data-a="duel"][data-v="close"]'); await host.waitForTimeout(500);
  check('closing clears the ring', await host.evaluate(() => !cinderGame.state().duel));
  await browser.close();
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  console.log(real.length ? real.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(real.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
