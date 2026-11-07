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
  const save = () => host.evaluate(() => { const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); return { screen: s.screen, run: !!s.run, sector: s.run && s.run.sector, room: s.run && s.run.room, votes: s.run && s.run.votes, ready: s.guestReady, raids: s.meta.stats.raids, kills: s.meta.stats.kills }; });
  await guest.bringToFront(); await guest.waitForTimeout(800);
  check('the guest has the button', await guest.locator('button[data-a="autoaccept"]').count() === 1);
  await host.bringToFront(); await host.waitForTimeout(300);
  check('the host has the button', await host.locator('button[data-a="autoaccept"]').count() === 1);

  // One player on: the friend readies up and follows the host's door.
  await guest.bringToFront(); await guest.click('button[data-a="autoaccept"]'); await guest.waitForTimeout(1500);
  check('auto-accept readies the friend up by itself', (await save()).ready === true, JSON.stringify(await save()));
  await host.bringToFront(); await host.waitForTimeout(150);
  check('the host still decides with one on', !(await save()).run);
  await host.evaluate(() => { document.querySelector('button[data-a="popup"][data-v="missions"]').click(); }); await host.waitForTimeout(200);
  await host.locator('button[data-a="deploy"]:not([disabled])').first().click(); await host.waitForTimeout(800);
  await host.evaluate(() => {}); let sv = await save();
  for (let i = 0; i < 6 && sv.screen !== 'route'; i++) { await host.waitForTimeout(400); sv = await save(); }
  check('the raid starts', sv.run, JSON.stringify(sv));
  if (sv.screen === 'route') {
    const r0 = sv.room;
    await host.locator('button[data-a="room"]').first().click(); await host.waitForTimeout(150);
    await guest.bringToFront(); await guest.waitForTimeout(1800);
    sv = await save(); check('the friend follows the host’s door', sv.screen !== 'route' || sv.room !== r0, JSON.stringify(sv));
  }
  // Both on: it plays itself, at half speed.
  await host.bringToFront(); await host.click('button[data-a="autoaccept"]', { force: true }).catch(() => {}); await host.waitForTimeout(600);
  const hs0 = await host.evaluate(() => ({ text: (document.querySelector('.coop-auto') || {}).textContent, slow: globalThis.cinderGame && cinderGame.stage ? cinderGame.stage.speed : null }));
  check('the button says both are on', /Both auto/.test(hs0.text || ''), hs0.text);
  const a0 = await save();
  // Background tabs throttle timers, so give each tab the front in turn while it plays.
  const seen = new Set();
  for (let i = 0; i < 26; i++) { for (const p of [host, guest]) { await p.bringToFront(); await p.waitForTimeout(1100); } const n = await save(); seen.add(`${n.sector}.${n.room}.${n.screen}`); if (n.kills > a0.kills + 1) break; }
  const a1 = await save();
  check('with both on the raid moves by itself', seen.size > 2, [...seen].join(' '));
  check('with both on the fights play by themselves', a1.kills > a0.kills || !a1.run, `${a0.kills} > ${a1.kills}`);
  // Off again: control comes back.
  await guest.bringToFront(); await guest.click('button[data-a="autoaccept"]', { force: true }).catch(() => {}); await guest.waitForTimeout(500);
  check('turning it off ends both-auto', !/Both auto/.test(await guest.locator('.coop-auto').first().textContent().catch(() => 'gone')));
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  await browser.close();
  console.log(real.length ? real.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(real.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message.slice(0, 400)); process.exit(1); });
