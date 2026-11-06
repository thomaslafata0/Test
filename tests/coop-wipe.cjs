// Co-op wipes in the browser: two tabs. One operative dies, the other fights on, then falls: both see their own death screen.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const c = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const host = await c.newPage(), guest = await c.newPage(); const errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  for (const [p, n] of [[host, 'host'], [guest, 'guest']]) p.on('pageerror', (e) => errors.push(`${n}: ${e.message}`));
  await host.goto(URL);
  await host.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 900; s.screen = 'town'; s.meta.tips = { town: true, combat: true, route: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await host.reload(); await host.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await host.waitForTimeout(800);
  await host.click('button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(150); await host.click('button[data-a="coophost"]'); await host.waitForTimeout(300);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent); await host.keyboard.press('Escape');
  await guest.goto(URL + '?join=' + code); await guest.waitForTimeout(1000);
  await guest.click('button[data-a="step"][data-v="2"]'); await guest.click('button[data-a="bg"][data-v="runner"]'); await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100); await guest.click('button[data-a="create"]'); await guest.waitForTimeout(1200);

  await host.bringToFront();
  await host.waitForFunction(() => !!globalThis.cinderGame.state().char2, null, { timeout: 5000 });
  // Into a fight with the friend down and a harmless enemy: they bleed out while the host survives.
  await host.evaluate(async () => {
    const E = await import('./engine.js'), g = globalThis.cinderGame, s = g.state(), rng = g.rng();
    E.deploy(s, 'garrison', 1, rng);
    for (let i = 0; i < 20 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); if (s.screen === 'event' || s.screen === 'room') { s.screen = 'route'; s.run.choices = null; } }
    const e = s.run.enemy; e.atk = 0; e.hp = e.maxHp = 100000; s.char2.hp = 0; s.char2.downed = 2; s.run.actor = 0;
    for (let i = 0; i < 8 && !s.run.fallen; i++) { s.char.hp = 500; E.playerAct(s, 'defend', rng, 0); }
    g.after();
  });
  await host.waitForTimeout(700);
  await guest.bringToFront(); await guest.waitForTimeout(500);
  check('dead friend is told so and watches', /You.re dead/.test(await guest.innerText('body')));
  await guest.screenshot({ path: `${OUT}/wipe-guest-dead.png` });
  await host.bringToFront(); await host.waitForTimeout(300);
  check('survivor is still fighting', await host.evaluate(() => globalThis.cinderGame.state().screen) === 'combat');
  await host.screenshot({ path: `${OUT}/wipe-host-alone.png` });
  await host.evaluate(async () => {
    const E = await import('./engine.js'), g = globalThis.cinderGame, s = g.state(), rng = g.rng(), e = s.run.enemy;
    e.atk = 1000000; s.char.hp = 1;
    for (let i = 0; i < 12 && s.run; i++) { s.char.hp = 1; e.intent = 'attack'; e.stun = 0; E.playerAct(s, 'shoot', rng, 0); }
    g.after();
  });
  await host.waitForTimeout(900);
  check('host gets the death screen with the wipe line', /A wipe/.test(await host.innerText('body')));
  await host.screenshot({ path: `${OUT}/wipe-host-death.png` });
  await guest.bringToFront(); await guest.waitForTimeout(800);
  check('friend gets their own death screen', /A wipe/.test(await guest.innerText('body')));
  await guest.screenshot({ path: `${OUT}/wipe-guest-death.png` });
  console.log(errors.length ? errors : 'no errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
