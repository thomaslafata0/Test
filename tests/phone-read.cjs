// Can a person read and tap it? On a phone held sideways: no text under a readable size, no tap target too small, and no screen left half empty.
// SHEET=dir also writes contact sheets of every screen there.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.env.U || 'http://localhost:8765/index.html';
const MIN_TEXT = +process.env.MIN_TEXT || 11, MIN_TAP = +process.env.MIN_TAP || 36, MIN_FILL = +process.env.MIN_FILL || 0.72;
const SHEET = process.env.SHEET || '';
const toFight = `for (let i = 0; i < 30 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) { const k = s.run.choices.findIndex((x) => x === 'fight' || x === 'elite'); E.enterRoom(s, Math.max(0, k), rng); } else E.offerRoute(s, rng); if (['event', 'room'].includes(s.screen)) { s.screen = 'route'; s.run.choices = null; } }`;
const die = `${toFight} s.run.enemy.atk = 1e6; for (let i = 0; i < 12 && s.screen === 'combat'; i++) { c.hp = 1; s.run.enemy.intent = 'attack'; s.run.enemy.stun = 0; E.playerAct(s, 'defend', rng); }`;
const SCREENS = {
  title: `__title = true;`,
  town: ``,
  body: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 1; s.screen = 'create';`,
  class: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 2; s.screen = 'create';`,
  drone: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 3; s.screen = 'create';`,
  stats: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 4; s.screen = 'create';`,
  missions: `s.popup = 'missions';`,
  contracts: `s.popup = 'missions'; s.missionTab = 'contracts';`,
  market: `s.popup = 'market';`,
  supplies: `s.popup = 'market'; s.marketTab = 'supplies';`,
  mods: `s.popup = 'market'; s.marketTab = 'mods';`,
  clinic: `s.popup = 'clinic';`,
  resolve: `s.popup = 'character';`,
  operative: `s.popup = 'character'; s.charTab = 'operative';`,
  record: `s.popup = 'character'; s.charTab = 'record';`,
  gear: `s.popup = 'gear';`,
  lockup: `s.popup = 'lockup';`,
  route: `E.deploy(s, 'garrison', 6, rng); E.offerRoute(s, rng); s.lastResult = { kind: 'fight', enemy: 'Patrol Trooper', credits: 20, xp: 9, feats: [] };`,
  combat: `c.attrs.int = 5; c.attrs.agi = 5; c.attrs.cha = 5; c.items.thermal = 2; c.items.ion = 2; c.items.smoke = 2; E.deploy(s, 'garrison', 1, rng); ${toFight}`,
  perk: `E.deploy(s, 'garrison', 1, rng); s.run.perkOffer = ['ironlung', 'chit', 'ambush']; s.screen = 'perk';`,
  loot: `E.deploy(s, 'garrison', 1, rng); s.run.lootOffer = E.makeItem('cannon', 'elite', rng); s.screen = 'loot';`,
  sectorClear: `E.deploy(s, 'garrison', 1, rng); s.run.room = 99; s.run.enemy = null; E.offerRoute(s, rng);`,
  event: `E.deploy(s, 'garrison', 1, rng); s.event = D.EVENTS[0].id; s.screen = 'event';`,
  eventDone: `E.deploy(s, 'garrison', 1, rng); s.event = D.EVENTS[0].id; s.screen = 'event'; E.resolveEvent(s, 0, rng);`,
  payout: `E.deploy(s, 'garrison', 1, rng); c.xpBank = 500; c.credits += 300; E.endRun(s, 'extracted', rng);`,
  death: `E.deploy(s, 'garrison', 1, rng); ${die}`,
  heirloom: `s.meta.cell.push('heirloom'); c.gear.ranged = E.makeItem('cannon', 'elite', rng); c.gear.melee = E.makeItem('cannon', 'rare', rng); E.deploy(s, 'garrison', 1, rng); ${die}`,
};
const MODALS = ['menu', 'manual', 'board', 'feats', 'settings', 'bar', 'wheel', 'orbit', 'ventures'];
(async () => {
  const b = await chromium.launch(); let failed = 0; const errs = [];
  // "+notch" is an iPhone with a notch: the page keeps clear of 47px each side and 21px at the bottom.
  const sizes = (process.env.SIZES || '844x390+notch,844x390,667x375').split(',').map((x) => { const [w, h] = x.replace('+notch', '').split('x').map(Number); return [w, h, x.includes('+notch')]; });
  for (let [w, h, notch] of sizes) {
    let ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); let p = await ctx.newPage();
    if (notch) {
      const ok = await (await ctx.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } }).then(() => true, () => false);
      if (!ok) { await ctx.close(); w -= 94; h -= 8; ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); p = await ctx.newPage(); console.log('(no inset emulation here: using a smaller screen instead)'); }
    }
    p.setDefaultTimeout(5000);
    p.on('pageerror', (e) => errs.push(`${w}: ${e.message}`));
    await p.goto(URL); await p.waitForTimeout(500);
    const shots = [];
    const audit = (name) => p.evaluate(({ MIN_TEXT, MIN_TAP }) => {
      const top = [...document.querySelectorAll('.modal')].pop() || document.getElementById('app'), small = new Map(), taps = [];
      const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
      const walk = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { const t = n.textContent.trim(), el = n.parentElement; if (!t || !el || !seen(el) || el.closest('[hidden], .sr-only')) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue; const fs = parseFloat(cs.fontSize); if (fs < MIN_TEXT - 0.05) { const key = `${fs.toFixed(1)} ${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()}<${(el.parentElement.className || '').toString().split(' ')[0]}`; if (!small.has(key)) small.set(key, t.slice(0, 18)); } }
      for (const el of top.querySelectorAll('button, input, select, a, [data-a]')) { if (!seen(el) || el.disabled || el.classList.contains('modal-wrap') || el.classList.contains('popup-wrap')) continue; const r = el.getBoundingClientRect(); if (r.height < MIN_TAP - 0.5 || r.width < MIN_TAP - 0.5) taps.push(`${(el.textContent || el.id || el.className).trim().slice(0, 14)}(${Math.round(r.width)}x${Math.round(r.height)})`); }
      // How much of the screen does the content reach? The lowest thing drawn, against the bottom of the screen.
      let low = 0; for (const el of top.querySelectorAll('button, p, h2, h3, li, img, canvas, .row, .door, .choice, .item, .stat, .label, span, b')) { if (!seen(el)) continue; low = Math.max(low, Math.min(innerHeight, el.getBoundingClientRect().bottom)); }
      return { small: [...small].map(([k, v]) => `${k} "${v}"`), taps, fill: low / innerHeight };
    }, { MIN_TEXT, MIN_TAP });
    const report = async (name) => {
      const r = await audit(name); const bad = [];
      if (r.small.length) bad.push(`TEXT<${MIN_TEXT}: ${r.small.slice(0, 6).join(' | ')}${r.small.length > 6 ? ` +${r.small.length - 6}` : ''}`);
      if (r.taps.length) bad.push(`TAP<${MIN_TAP}: ${r.taps.slice(0, 6).join(' ')}${r.taps.length > 6 ? ` +${r.taps.length - 6}` : ''}`);
      if (r.fill < MIN_FILL && !['contracts', 'board', 'supplies', 'lockup'].includes(name)) bad.push(`EMPTY: content stops at ${Math.round(r.fill * 100)}%`);
      console.log(`${bad.length ? 'FAIL' : 'PASS'} ${w}${notch ? 'n' : ' '} ${name.padEnd(11)} ${bad.join('\n      ')}`); if (bad.length) failed++;
      if (SHEET) shots.push([name, (await p.screenshot()).toString('base64')]);
    };
    for (const [name, setup] of Object.entries(SCREENS)) {
      await p.evaluate(async (src) => { const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(7), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; const c = s.char; c.name = 'Tamsin Rook'; c.credits = 900; c.level = 6; c.attrPoints = 3; s.meta.resolve = 12; E.mapProgress(c, 'garrison').insertions.push(6); for (const [id, n] of [['ironlung', 5], ['grudge', 3]]) { c.perks.push(id); c.perkN[id] = n; } s.meta.tips = { town: true, combat: true, route: true, perk: true, loot: true, gear: true }; let __title = false; eval(src); localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); window.__title = __title; }, setup);
      const stay = await p.evaluate(() => window.__title);
      await p.reload(); await p.waitForTimeout(350); if (!stay) await p.tap('button[data-a="continue-title"]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(600);
      await report(name);
    }
    // Menus opened from town.
    await p.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(7), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; s.char.credits = 2500; s.meta.resolve = 12; s.meta.tips = { town: true, combat: true, route: true, perk: true, loot: true, gear: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
    await p.reload(); await p.waitForTimeout(350); await p.tap('button[data-a="continue-title"]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(500);
    for (const v of MODALS) {
      if (v === 'menu' || ['manual', 'board', 'feats', 'settings'].includes(v)) { await p.tap('[data-a="modal"][data-v="menu"]'); await p.waitForTimeout(200); if (v !== 'menu') { await p.tap(`.menu-grid button[data-v="${v}"]`); await p.waitForTimeout(300); } }
      else { await p.tap(`.shortcuts button[data-a="modal"][data-v="${v}"]`); await p.waitForTimeout(300); }
      await report(v);
      await p.tap('.modal [data-a="closemodal"]').catch(() => {}); await p.waitForTimeout(200);
    }
    if (SHEET) {
      fs.mkdirSync(SHEET, { recursive: true });
      const q = await ctx.newPage(); const per = 8;
      for (let i = 0; i < shots.length; i += per) {
        const part = shots.slice(i, i + per);
        await q.setViewportSize({ width: w * 2 + 12, height: Math.ceil(part.length / 2) * (h + 22) });
        await q.setContent(`<body style="margin:0;background:#400;display:grid;grid-template-columns:${w}px ${w}px;gap:4px 12px;font:14px monospace;color:#fff">${part.map(([n, d]) => `<div><div style="height:18px">${n}</div><img src="data:image/png;base64,${d}" width="${w}" height="${h}" style="display:block"></div>`).join('')}</body>`);
        await q.waitForTimeout(150); await q.screenshot({ path: path.join(SHEET, `sheet-${w}${notch ? 'n' : ''}-${i / per + 1}.png`), scale: 'css' });
      }
      await q.close();
    }
    await ctx.close();
  }
  await b.close();
  console.log(errs.length ? errs : 'no errors'); console.log(failed ? `${failed} FAILED` : 'ALL READABLE'); process.exit(failed || errs.length ? 1 : 0);
})().catch((e) => { console.error(e.message.slice(0, 600)); process.exit(1); });
