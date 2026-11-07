// Laptop fight fit, dialog focus, Auto's stim rules, Quick start, first-run help and progress screens.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
let fails = 0;
const ok = (c, m, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${m} ${c ? '' : x}`); if (!c) fails++; };
const seed = (mut = '') => `(async () => { const E = await import('./engine.js'); const rng = E.seededRng(5); const s = E.newGame(rng); E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town'; s.char.items.stim = 3; s.char.items.thermal = 1; s.char.items.ion = 1; s.char.items.smoke = 1; ${mut} localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-speed', JSON.stringify('manual')); })()`;
const FIGHT = `E.deploy(s, 'garrison', 1, rng); E.offerRoute(s, rng); E.enterRoom(s, 0, rng); while (s.screen !== 'combat') { if (s.screen === 'route') E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); }`;

(async () => {
  const b = await chromium.launch();
  const open = async (w, h, mut, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...opts }), p = await ctx.newPage();
    p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto(URL); await p.evaluate(seed(mut)); await p.reload();
    await p.click('button[data-a="continue-title"]'); await p.waitForTimeout(1200);
    return p;
  };

  // Every command, HP and the intent on screen, without scrolling, with and without the hint.
  for (const [w, h] of [[1366, 768], [1280, 720], [1024, 600], [1440, 900], [1920, 1080]]) {
    for (const hideTip of [false, true]) {
      const p = await open(w, h, `${FIGHT} ${hideTip ? 's.meta.tips.combat = true;' : ''} s.char.skills = undefined;`);
      const m = await p.evaluate(() => {
        const off = [...document.querySelectorAll('[data-a="act"], .intent, .hud, .status')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1; }).map((e) => e.dataset.v || e.className);
        const c = document.querySelector('.c-right');
        return { off, scroll: document.documentElement.scrollHeight - innerHeight, rightScroll: c.scrollHeight - c.clientHeight, n: document.querySelectorAll('[data-a="act"]').length, stage: Math.round(document.querySelector('.stage canvas').getBoundingClientRect().width) };
      });
      ok(!m.off.length && m.scroll <= 0 && m.rightScroll <= 0 && m.n >= 5, `${w}x${h} ${hideTip ? 'no hint' : 'hint'}: all ${m.n} commands, stage ${m.stage}px wide`, JSON.stringify(m));
      await p.context().close();
    }
  }

  // The town's side menu on every size of phone and tablet held sideways.
  for (const [w, h] of [[844, 390], [932, 430], [956, 440], [1024, 480], [1080, 512], [1000, 673], [1133, 744], [1180, 820]]) {
    const p = await open(w, h, '', { hasTouch: true, isMobile: true });
    const m = await p.evaluate(() => { const off = [...document.querySelectorAll('.shortcuts button')].filter((x) => { const r = x.getBoundingClientRect(); return !r.width || r.bottom > innerHeight + 1 || r.right > innerWidth + 1; }).map((x) => x.textContent.trim()); return { n: document.querySelectorAll('.shortcuts button').length, off, lantern: [...document.querySelectorAll('.shortcuts button')].some((x) => /Lantern/.test(x.textContent)), scroll: document.documentElement.scrollHeight - innerHeight }; });
    ok(m.n >= 8 && !m.off.length && m.lantern && m.scroll <= 0, `${w}x${h}: the whole town menu is on screen`, JSON.stringify(m));
    await p.context().close();
  }

  // Dialogs hold focus and give it back.
  {
    const p = await open(1366, 768, '');
    await p.locator('button[data-a="modal"][data-v="settings"]').first().focus();
    await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.activeElement.closest('[aria-modal="true"]') !== null), 'opening Settings moves focus into it');
    const inside = [];
    for (let i = 0; i < 40; i++) { await p.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab'); inside.push(await p.evaluate(() => !!document.activeElement.closest('[aria-modal="true"]'))); }
    ok(inside.every(Boolean), 'Tab and Shift+Tab stay inside Settings');
    { const live = await p.evaluate(() => [...document.querySelectorAll('#app > *')].filter((e) => !e.querySelector('[aria-modal="true"]') && !e.matches('[aria-modal="true"], .toast') && !e.inert).map((e) => e.className)); ok(!live.length, 'the page behind is inert', live.join(',')); }
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.activeElement.dataset.a === 'modal' && document.activeElement.dataset.v === 'settings'), 'closing returns focus to the Settings button');
    ok(await p.evaluate(() => ![...document.querySelectorAll('#app > *')].some((e) => e.inert)), 'the page is usable again');
    ok(!p.errs.length, 'no page errors in dialogs', p.errs.join(';'));
    await p.context().close();
  }

  // Auto's rules.
  {
    const p = await open(1000, 700, FIGHT);
    const r = await p.evaluate(async () => {
      const E = await import('./engine.js');
      const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1'));
      const mk = (fn) => { const x = JSON.parse(JSON.stringify(s)); x.run.enemy.stun = 0; x.run.enemy.intent = 'attack'; fn(x); return x; };
      const low = (n) => (x) => { x.char.hp = 1; x.char.items.stim = n; };
      const elite = (x) => { x.run.enemy.elite = true; x.char.items.thermal = 1; x.char.hp = 9999; };
      return { any: E.autoAction(mk(low(1))), keep1: E.autoAction(mk(low(1)), { stimReserve: 1 }), keep1two: E.autoAction(mk(low(2)), { stimReserve: 1 }), none: E.autoAction(mk(low(5)), { stimReserve: Infinity }), thermal: E.autoAction(mk(elite)), noItems: E.autoAction(mk(elite), { items: false }) };
    });
    ok(r.any === 'stim', 'Auto uses a stim by default', r.any);
    ok(r.keep1 !== 'stim' && r.keep1two === 'stim', 'Keep 1 leaves the last stim', JSON.stringify(r));
    ok(r.none !== 'stim', 'None uses no stims', r.none);
    ok(r.thermal === 'thermal' && r.noItems !== 'thermal', 'the item setting keeps thermals back', JSON.stringify(r));
    await p.context().close();
  }

  // Quick start from the very first screen.
  {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL);
    await p.waitForTimeout(800);
    await p.evaluate(`(async () => { const E = await import('./engine.js'); const rng = E.seededRng(7); const s = E.newGame(rng); s.screen = 'create'; s.draft = E.newDraft(s.meta, rng); localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); })()`);
    await p.reload(); await p.waitForTimeout(800);
    const cont = p.locator('button[data-a="continue-title"]'); if (await cont.count()) await cont.click();
    await p.waitForSelector('button[data-a="quickstart"]');
    await p.click('button[data-a="quickstart"]'); await p.waitForTimeout(600);
    const c = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); return s.char && { bg: s.char.background, drone: s.char.drone && s.char.drone.type, str: s.char.attrs.str, int: s.char.attrs.int }; });
    ok(c && c.bg === 'foundry' && c.drone === 'hornet' && c.int >= 3 && c.str >= 4, 'Quick start makes a ready operative', JSON.stringify(c));
    ok(!errs.length, 'no page errors in Quick start', errs.join(';'));
    await ctx.close();
  }

  // Coaching in the first fight, on a phone, and a reason on a greyed-out button.
  {
    const p = await open(844, 390, `${FIGHT} s.run.enemy.stun = 0; s.run.enemy.intent = 'heavy'; s.run.enemy.quirk = null; s.char.items.stim = 0;`, { hasTouch: true, isMobile: true });
    ok((await p.locator('.coach').textContent().catch(() => '')).includes('Defend'), 'a heavy strike gets a coaching line');
    const box = await p.locator('[data-a="act"][data-v="stim"]').boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(150);
    ok(await p.evaluate(() => { const h = document.getElementById('hint'); return !!h && h.classList.contains('on') && h.textContent.length > 5; }), 'tapping a greyed-out button explains it');
    await p.screenshot({ path: `${process.env.SHOTS || '.'}/audit-coach.png` }).catch(() => {});
    await p.context().close();
  }

  // Rules for a newcomer, wording, and the progress screens.
  {
    const p = await open(1366, 768, '');
    const r = await p.evaluate(async () => {
      const E = await import('./engine.js'), D = await import('./data.js');
      const out = {};
      out.reach = JSON.stringify(D).includes('Reach sector');
      const rng = E.seededRng(11), s = E.newGame(rng); E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town';
      s.char.hp = 1; s.meta.resolve = 0;
      E.deploy(s, 'garrison', 1, rng); E.offerRoute(s, rng); E.enterRoom(s, 0, rng);
      while (s.screen !== 'combat') { if (s.screen === 'route') E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); }
      s.run.enemy.atk = 9999; s.run.enemy.stun = 0; s.run.enemy.intent = 'attack'; s.run.enemy.quirk = null;
      for (let i = 0; i < 8 && s.char && s.screen === 'combat'; i++) E.playerAct(s, 'shoot', rng);
      out.resolve = s.meta.resolve; out.cost = E.trainingCost(0); out.screen = s.screen;
      return out;
    }).catch((e) => ({ err: e.message }));
    ok(r.reach === false, 'contracts say Clear, not Reach', JSON.stringify(r));
    ok(r.err === undefined && r.resolve >= r.cost, 'the first death leaves enough for a rank of training', JSON.stringify(r));
    await p.click('button[data-a="modal"][data-v="codex"]').catch(() => {}); await p.waitForTimeout(200);
    const heads = await p.locator('.codex-entry.locked h3').allTextContents();
    ok(heads.length > 3 && heads.every((t) => /Sealed . \S/.test(t)) && new Set(heads).size > 3, 'sealed Codex entries have their own labels', heads.slice(0, 5).join(' | '));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await p.click('button[data-a="modal"][data-v="feats"]').catch(() => {}); await p.waitForTimeout(200);
    const all = await p.locator('.feat').count();
    await p.click('button[data-a="featfilter"][data-v="Closest"]'); await p.waitForTimeout(150);
    const near = await p.locator('.feat').count();
    await p.click('button[data-a="featfilter"][data-v="Bosses"]'); await p.waitForTimeout(150);
    const boss = await p.locator('.feat').count();
    ok(all > 12 && near === 12 && boss > 0 && boss < all, 'achievement filters narrow the list', `${all} ${near} ${boss}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await p.click('button[data-a="modal"][data-v="settings"]'); await p.waitForTimeout(200);
    ok(!(await p.locator('#dev-code').isVisible()), 'Dev code is folded away in Settings');
    ok(await p.locator('button[data-a="autostim"]').count() === 3, 'Settings offers the stim choices');
    ok(!p.errs.length, 'no page errors on progress screens', p.errs.join(';'));
    await p.context().close();
  }

  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
