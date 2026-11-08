// Mochi: the 444483 code opens her (no dev mode, so the cell stays on the board), she can be picked, and Sugar Rush plays.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch(), errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('cinder-cell-news', 'escape'); const E = await import('./engine.js'), rng = E.seededRng(4), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(800);
  check('Mochi starts locked', await p.evaluate(async () => { const E = await import('./engine.js'), D = await import('./data.js'); return !E.bgUnlocked(cinderGame.state().meta, D.BACKGROUNDS.find((b) => b.id === 'mochi')); }));
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'dev-code'; i.value = '444483'; i.hidden = true; document.body.appendChild(i); const b = document.createElement('button'); b.dataset.a = 'devunlock'; b.id = 'dv'; document.body.appendChild(b); });
  await p.click('#dv', { force: true }); await p.waitForTimeout(300);
  const st = await p.evaluate(async () => { const E = await import('./engine.js'), D = await import('./data.js'), s = cinderGame.state(); return { open: E.bgUnlocked(s.meta, D.BACKGROUNDS.find((b) => b.id === 'mochi')), dev: !!s.meta.dev, global: localStorage.getItem('cinder-cell-unlocks') }; });
  check('the code opens her, everywhere, without dev mode', st.open && !st.dev && /mochi/.test(st.global || ''), JSON.stringify(st));
  // A Mochi in a fight.
  await p.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(9), s = E.newGame(rng); s.meta.unlockedOps = ['mochi']; const d = E.newDraft(s.meta, rng); d.background = 'mochi'; E.createChar(s, rng, d); s.screen = 'town'; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true };
    E.deploy(s, 'garrison', 1, rng); for (let i = 0; i < 30 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); if (['event', 'room'].includes(s.screen)) { s.screen = 'route'; s.run.choices = null; } } s.run.enemy.hp = s.run.enemy.maxHp = 9999; s.char.hp = 20; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(3500);
  check('her fighter is her own art', await p.evaluate(() => { const P = cinderGame.stage.player; return !!(P && P.sheet && P.sheet.anims.special && P.sheet.anims.duo); }));
  const btn = p.locator('button[data-a="act"][data-v="sugar"], button[data-v="sugar"]').first();
  check('Sugar Rush is on the action bar', await btn.count() === 1);
  await btn.click().catch(() => {}); await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/mochi-sugar.png` });
  await p.waitForTimeout(2500);
  const hp = await p.evaluate(() => cinderGame.state().char.hp);
  check('the lick heals her', hp > 20, String(hp));
  await browser.close();
  console.log(errors.length ? errors.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
