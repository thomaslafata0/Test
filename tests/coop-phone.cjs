// Two players, each on a phone held sideways: host and friend join, ready up, deploy, vote on doors, take turns, one goes down and is
// revived. On every screen both phones are checked: nothing scrolls, no text under 11px, nothing you tap under 38px.
// SHEET=dir writes contact sheets with host on the left and friend on the right.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.env.U || 'http://localhost:8765/index.html';
const SHEET = process.env.SHEET || '', MIN_TEXT = 11, MIN_TAP = 38, W = 844, H = 390;
(async () => {
  const b = await chromium.launch(); let failed = 0; const errs = [], shots = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const open = async (n) => { const p = await ctx.newPage(); p.setDefaultTimeout(6000); p.on('pageerror', (e) => errs.push(`${n}: ${e.message}`)); await (await ctx.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } }).catch(() => {}); return p; };
  const host = await open('host'), guest = await open('friend');
  const audit = (p) => p.evaluate(({ MIN_TEXT, MIN_TAP }) => {
    const top = [...document.querySelectorAll('.modal')].pop() || document.getElementById('app'), bad = [];
    const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const de = document.documentElement; if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) bad.push(`page scrolls ${de.scrollWidth}x${de.scrollHeight}`);
    if (!document.querySelector('.modal')) for (const el of document.querySelectorAll('#app > section, #app .columns > section')) if (el.scrollHeight > el.clientHeight + 1) bad.push(`screen needs ${el.scrollHeight - el.clientHeight}px more`);
    const small = new Set(), walk = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) { const el = n.parentElement; if (!n.textContent.trim() || !el || !seen(el)) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue; const fs = parseFloat(cs.fontSize); if (fs < MIN_TEXT - 0.05) small.add(`${fs.toFixed(1)}px "${n.textContent.trim().slice(0, 16)}" .${(el.className || el.tagName).toString().split(' ')[0]}`); }
    if (small.size) bad.push(`small text: ${[...small].slice(0, 4).join(' | ')}`);
    const taps = []; for (const el of top.querySelectorAll('button, input, select')) { if (!seen(el) || el.disabled) continue; const r = el.getBoundingClientRect(); if (r.height < MIN_TAP - 0.5 || r.width < MIN_TAP - 0.5) taps.push(`${(el.textContent || el.id).trim().slice(0, 12)}(${Math.round(r.width)}x${Math.round(r.height)})`); if (!document.querySelector('.modal') && !el.closest('.emotes') && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) taps.push(`${(el.textContent || el.id).trim().slice(0, 12)} off screen`); }
    if (taps.length) bad.push(`taps: ${taps.slice(0, 5).join(' ')}`);
    return bad;
  }, { MIN_TEXT, MIN_TAP });
  const both = async (name) => { await host.waitForTimeout(350); for (const [n, p] of [['host', host], ['friend', guest]]) { const bad = await audit(p); check(`${name} (${n})`, !bad.length, bad.join('; ')); } if (SHEET) shots.push([name, (await host.screenshot()).toString('base64'), (await guest.screenshot()).toString('base64')]); };
  const game = (p, fn, arg) => p.evaluate(fn, arg);

  await host.goto(URL);
  await host.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 300; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await host.reload(); await host.tap('button[data-a="continue-title"]').catch(() => {}); await host.waitForTimeout(800);
  // Host: Menu, Settings, Host.
  await host.tap('[data-a="modal"][data-v="menu"]'); await host.waitForTimeout(200); await host.tap('.menu-grid [data-v="settings"]'); await host.waitForTimeout(250);
  await host.tap('button[data-a="coophost"]'); await host.waitForTimeout(500);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent);
  check('host has a room code', /^[A-Z0-9]{4}$/.test(code), code);
  // Friend: joins with the code, builds an operative.
  await guest.goto(URL); await guest.tap('button[data-a="continue-title"]').catch(() => {}); await guest.waitForTimeout(800);
  await guest.tap('[data-a="modal"][data-v="menu"]'); await guest.waitForTimeout(200); await guest.tap('.menu-grid [data-v="settings"]'); await guest.waitForTimeout(250);
  await guest.fill('#coop-name', 'Buddy'); await guest.fill('#coop-code', code); await guest.tap('button[data-a="coopjoin"]'); await guest.waitForTimeout(900);
  await both('hosting and joining');
  await host.tap('.modal [data-a="closemodal"]'); await guest.tap('.modal [data-a="closemodal"]').catch(() => {}); await guest.waitForTimeout(400);
  for (const v of [2, 3, 4]) { await guest.tap(`button[data-a="step"][data-v="${v}"]`); await guest.waitForTimeout(120); }
  await guest.tap('button[data-a="create"]'); await guest.waitForTimeout(900);
  await host.waitForFunction(() => !!globalThis.cinderGame.state().char2, null, { timeout: 5000 });
  await both('the yard, together');
  // Ready up and deploy.
  await guest.tap('.shortcuts [data-a="popup"][data-v="missions"]'); await host.tap('.shortcuts [data-a="popup"][data-v="missions"]'); await both('missions, waiting for ready');
  await guest.tap('.popup button[data-a="coopready"]'); await both('missions, ready');
  await host.tap('button[data-a="deploy"]'); await host.waitForTimeout(700);
  const st = () => game(host, () => { const s = globalThis.cinderGame.state(); return { screen: s.screen, actor: s.run && s.run.actor, choices: s.run && s.run.choices }; });
  check('both are in the raid', (await st()).screen === 'route' && /way in|doors|around/i.test(await guest.textContent('h2')));
  await both('doors, before voting');
  await host.tap('button[data-a="room"][data-v="0"]'); await both('doors, one vote in');
  // Make the next room a fight so the rest of the walk is the same every time.
  await game(host, () => { const g = globalThis.cinderGame, s = g.state(); s.run.choices = ['fight', 'fight']; s.run.votes = {}; g.after(); });
  await host.tap('button[data-a="room"][data-v="0"]'); await guest.tap('button[data-a="room"][data-v="0"]'); await host.waitForTimeout(1600);
  check('a fight starts', (await st()).screen === 'combat');
  await both('fight, first turn');
  // The acting player shoots; the other one's buttons are locked.
  let s = await st(); const actor = s.actor === 0 ? host : guest, waiter = s.actor === 0 ? guest : host;
  check('the waiting player cannot act', await waiter.evaluate(() => !!document.querySelector('.actions.locked')));
  await game(host, () => { const g = globalThis.cinderGame, s = g.state(); s.run.enemy.hp = s.run.enemy.maxHp = 400; s.run.enemy.atk = 1; g.after(); });
  await actor.tap('.actions button[data-v="shoot"]'); await host.waitForTimeout(3000);
  await both('fight, after a turn');
  // One of them goes down: the other sees the revive button.
  await game(host, async () => { const E = await import('./engine.js'); const g = globalThis.cinderGame, s = g.state(); const a = s.run.actor, down = E.charAt(s, 1 - a); down.hp = 0; down.downed = 3; g.after(); });
  await both('fight, partner down');
  s = await st(); const medic = s.actor === 0 ? host : guest;
  const rev = await medic.$('button[data-v="revive"]');
  check('the standing player is offered a revive', !!rev);
  if (rev) { await rev.tap(); await host.waitForTimeout(3000); check('the partner is back up', await game(host, async () => { const E = await import('./engine.js'); const s = globalThis.cinderGame.state(); return [0, 1].every((i) => !E.charAt(s, i).downed && E.charAt(s, i).hp > 0); })); }
  // Finish the fight and look at what comes after: spoils, then the sector vote.
  await game(host, () => { const g = globalThis.cinderGame, s = g.state(); s.run.enemy.hp = 1; g.after(); });
  for (let i = 0; i < 6 && (await st()).screen === 'combat'; i++) { const a = (await st()).actor === 0 ? host : guest; const btn = await a.$('.actions:not(.locked) button[data-v="shoot"]'); if (btn) await btn.tap().catch(() => {}); await host.waitForTimeout(2800); }
  check('the fight ends', (await st()).screen !== 'combat', (await st()).screen);
  await both(`after the fight (${(await st()).screen})`);
  await game(host, async () => { const E = await import('./engine.js'); const g = globalThis.cinderGame, s = g.state(), rng = g.rng(); s.run.lootOffer = null; s.run.perkOffer = ['ironlung', 'chit', 'ambush']; s.run.perkOffer2 = s.run.perkOffer2 || null; s.screen = 'perk'; g.after(); });
  await both('spoils');
  await game(host, async () => { const E = await import('./engine.js'); const g = globalThis.cinderGame, s = g.state(), rng = g.rng(); s.run.perkOffer = null; s.run.lootOffer = null; s.run.room = 99; s.run.enemy = null; E.offerRoute(s, rng); g.after(); });
  check('sector clear comes up', (await st()).screen === 'sectorClear', (await st()).screen);
  await both('sector clear, before voting');
  await host.tap('button[data-a="extract"]'); await both('sector clear, one vote in');
  await guest.tap('button[data-a="extract"]'); await host.waitForTimeout(900);
  check('both are home', (await st()).screen === 'town', (await st()).screen);
  await both('home with the payout');
  if (SHEET) {
    fs.mkdirSync(SHEET, { recursive: true }); const q = await ctx.newPage(), per = 4;
    for (let i = 0; i < shots.length; i += per) { const part = shots.slice(i, i + per); await q.setViewportSize({ width: W * 2 + 12, height: part.length * (H + 22) });
      await q.setContent(`<body style="margin:0;background:#400;display:grid;grid-template-columns:${W}px ${W}px;gap:4px 12px;font:14px monospace;color:#fff">${part.map(([n, a, c]) => `<div><div style="height:18px">${n} (host)</div><img src="data:image/png;base64,${a}" width="${W}" height="${H}" style="display:block"></div><div><div style="height:18px">(friend)</div><img src="data:image/png;base64,${c}" width="${W}" height="${H}" style="display:block"></div>`).join('')}</body>`);
      await q.waitForTimeout(150); await q.screenshot({ path: path.join(SHEET, `coop-${i / per + 1}.png`), scale: 'css' }); }
  }
  await b.close();
  console.log(errs.length ? errs : 'no errors'); console.log(failed ? `${failed} FAILED` : 'CO-OP READY ON PHONES'); process.exit(failed || errs.length ? 1 : 0);
})().catch((e) => { console.error(e.message.slice(0, 700)); process.exit(1); });
