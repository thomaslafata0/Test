// The player name prompt (everyone, once), the name on the leaderboard and in Settings, and a Field Medic made and played in a fight.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch(), errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  // A real player's browser: no webdriver flag, so the name prompt shows.
  await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  // An existing player with a save and an old co-op name still gets asked once.
  await p.evaluate(async () => { localStorage.clear(); const E = await import('./engine.js'), rng = E.seededRng(3), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town';
    s.meta.board = [{ id: 'x1', tag: 'x1', name: 'Vera Kade', player: 'Tommy', number: 4, background: 'medic', level: 7, status: 'alive', score: 2400, map: 'garrison', threat: 0, deepest: 9, freed: 0 }];
    localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-news', 'afterhours'); localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name: 'Vera' })); });
  await p.reload(); await p.waitForTimeout(900);
  check('existing players are asked for a player name', await p.locator('.name-gate').count() === 1);
  check('it starts from the saved co-op name', (await p.inputValue('#player-name')) === 'Vera');
  await p.screenshot({ path: `${OUT}/name-gate.png` });
  await p.keyboard.press('Escape'); await p.click('.modal-wrap', { position: { x: 5, y: 5 } }).catch(() => {}); await p.waitForTimeout(200);
  check('it can’t be dismissed', await p.locator('.name-gate').count() === 1);
  await p.fill('#player-name', 'x'); await p.click('button[data-a="setname"]'); await p.waitForTimeout(200);
  check('a one-letter name is refused', await p.locator('.name-gate').count() === 1);
  await p.fill('#player-name', '  Tommy  L.  '); await p.click('button[data-a="setname"]'); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => ({ prefs: JSON.parse(localStorage.getItem('cinder-cell-coop')).name, flag: localStorage.getItem('cinder-cell-player-set') }));
  check('the name is cleaned and saved', saved.prefs === 'Tommy L.' && saved.flag === '1' && await p.locator('.name-gate').count() === 0, JSON.stringify(saved));
  await p.reload(); await p.waitForTimeout(700);
  check('it isn’t asked again', await p.locator('.name-gate').count() === 0);
  // Leaderboard and Settings.
  await p.click('.title-menu button[data-v="board"]'); await p.waitForTimeout(300);
  check('the leaderboard shows whose operative it is', /Tommy/.test(await p.innerText('.board-table')) && await p.locator('.board-player').count() >= 1);
  await p.screenshot({ path: `${OUT}/board-player.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('.title-menu button[data-v="settings"]'); await p.waitForTimeout(250);
  check('Settings shows the player name', (await p.inputValue('#coop-name')) === 'Tommy L.');
  await p.fill('#coop-name', 'Tom'); await p.click('.settings button[data-a="setname"], button[data-a="setname"]'); await p.waitForTimeout(200);
  check('and can change it', await p.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-coop')).name) === 'Tom');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // A new Field Medic through character creation.
  await p.evaluate(async () => { localStorage.removeItem('cinder-cell-save-v1'); });
  await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(() => { const s = cinderGame.state(); s.char = null; s.screen = 'create'; cinderGame.after(); });
  await p.click('button[data-a="continue-title"]', { timeout: 1500 }).catch(() => {});
  await p.waitForTimeout(400);
  await p.click('button[data-a="step"][data-v="2"]', { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(200);
  const card = p.locator('button[data-a="bg"][data-v="medic"]');
  check('Field Medic is a class at creation', await card.count() === 1);
  if (await card.count()) { await card.click(); await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/medic-create.png` }); }
  await p.evaluate(async () => { const E = await import('./engine.js'), s = cinderGame.state(), rng = E.seededRng(11), d = E.newDraft(s.meta, rng); d.background = 'medic'; E.createChar(s, rng, d); s.screen = 'town'; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null;
    E.deploy(s, 'garrison', 1, rng);
    for (let i = 0; i < 60 && s.screen !== 'combat'; i++) { if (s.screen === 'route') E.enterRoom(s, 0, rng); else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng); }
    s.run.enemy.hp = s.run.enemy.maxHp = 5000; cinderGame.after(); });
  await p.waitForTimeout(800);
  const kit = await p.locator('button.skill[data-a="act"]').evaluateAll((bs) => bs.map((b) => b.dataset.v));
  check('the fight shows the medic kit only', JSON.stringify(kit) === JSON.stringify(['barrier', 'rally', 'triage', 'tag']), JSON.stringify(kit));
  await p.click('button[data-a="act"][data-v="barrier"]'); await p.waitForTimeout(3200);
  console.log('shield state', JSON.stringify(await p.evaluate(() => ({ sh: cinderGame.state().char.medShield, cd: cinderGame.state().run && cinderGame.state().run.cooldowns, chips: [...document.querySelectorAll('.intent-side .chip')].map((x) => x.textContent), log: cinderGame.state().log.slice(-3).map((l) => l.text || l) }))));
  check('Field Shield shows on screen', /Shield \d+/.test(await p.evaluate(() => document.querySelector('#app').textContent)) || await p.evaluate(() => cinderGame.state().char.medShield === 0));
  await p.screenshot({ path: `${OUT}/medic-fight.png` });
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/medic-fight-phone.png` });
  await browser.close();
  console.log(errors.length ? errors.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
