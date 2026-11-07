// A phone held sideways: every play screen fits with no scrolling, at a big iPhone's size and at the smallest.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
const toFight = `for (let i = 0; i < 30 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) { const k = s.run.choices.findIndex((x) => x === 'fight' || x === 'elite'); E.enterRoom(s, Math.max(0, k), rng); } else E.offerRoute(s, rng); if (['event', 'room'].includes(s.screen)) { s.screen = 'route'; s.run.choices = null; } }`;
const SCREENS = {
  town: ``,
  body: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 1; s.screen = 'create';`,
  class: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 2; s.screen = 'create';`,
  drone: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 3; s.screen = 'create';`,
  stats: `s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 4; s.screen = 'create';`,
  missions: `s.popup = 'missions';`,
  heirloomDeath: `s.meta.cell.push('heirloom'); c.gear.ranged = E.makeItem('cannon', 'elite', rng); c.gear.melee = E.makeItem('cannon', 'rare', rng); E.deploy(s, 'garrison', 1, rng); ${toFight} s.run.enemy.atk = 1e6; s.run.enemy.intent = 'attack'; for (let i = 0; i < 12 && s.screen === 'combat'; i++) { c.hp = 1; s.run.enemy.intent = 'attack'; s.run.enemy.stun = 0; E.playerAct(s, 'defend', rng); }`,
  eventDone: `E.deploy(s, 'garrison', 1, rng); s.event = D.EVENTS[0].id; s.screen = 'event'; E.resolveEvent(s, 0, rng);`,
  route_crowded: `E.deploy(s, 'garrison', 8, rng); E.offerRoute(s, rng); s.run.bulletin = 'lockdown'; s.run.cond = 'hunters'; s.run.choices = ['rest', 'bounty']; s.run.cooldowns = { burst: 1, overload: 2, suppress: 3 }; s.lastResult = { kind: 'fight', enemy: 'Veteran Gambling Riot Enforcer', credits: 91, xp: 15, notes: ['It exploded: \\u221210 HP'], feats: [] };`,
  combat_crowded: `c.items.thermal = 2; c.items.smoke = 2; E.deploy(s, 'garrison', 3, rng); ${toFight} s.run.enemy.id = 'hound'; s.run.enemy.quirk = D.QUIRKS[0].id; s.run.enemy.affix = Object.keys(D.AFFIXES)[0];`,
  route: `E.deploy(s, 'garrison', 6, rng); E.offerRoute(s, rng); s.lastResult = { kind: 'fight', enemy: 'Patrol Trooper', credits: 20, xp: 9, feats: [] };`,
  combat: `c.attrs.int = 5; c.attrs.agi = 5; c.attrs.cha = 5; c.items.thermal = 2; c.items.ion = 2; c.items.smoke = 2; E.deploy(s, 'garrison', 1, rng); ${toFight}`,
  perk: `c.upgrades.push('broker'); E.deploy(s, 'garrison', 1, rng); s.run.perkOffer = ['ironlung', 'chit', 'ambush', 'grudge']; s.screen = 'perk';`,
  loot: `E.deploy(s, 'garrison', 1, rng); s.run.lootOffer = E.makeItem('cannon', 'elite', rng); s.screen = 'loot';`,
  sectorClear: `E.deploy(s, 'garrison', 1, rng); s.run.room = 99; s.run.enemy = null; E.offerRoute(s, rng);`,
  event: `E.deploy(s, 'garrison', 1, rng); s.event = D.EVENTS[0].id; s.screen = 'event';`,
  payout: `E.deploy(s, 'garrison', 1, rng); c.xpBank = 500; c.credits += 300; E.endRun(s, 'extracted', rng);`,
  death: `E.deploy(s, 'garrison', 1, rng); ${toFight} s.run.enemy.atk = 1e6; s.run.enemy.intent = 'attack'; for (let i = 0; i < 12 && s.screen === 'combat'; i++) { c.hp = 1; s.run.enemy.intent = 'attack'; s.run.enemy.stun = 0; E.playerAct(s, 'defend', rng); }`,
};
(async () => {
  const b = await chromium.launch(); let failed = 0; const errs = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
  // The first size is an iPhone with a notch: the page keeps clear of 47px each side and 21px at the bottom.
  for (const [w, h, notch] of [[844, 390, true], [844, 390], [667, 375]]) {
    const ctx = await b.newContext({ viewport: { width: notch ? w : w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    if (notch && !(await (await ctx.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } }).then(() => true, () => false))) await p.setViewportSize({ width: w - 94, height: h - 8 });
    p.on('pageerror', (e) => errs.push(`${w}: ${e.message}`));
    await p.goto(URL); await p.waitForTimeout(500);
    const fits = () => p.evaluate(() => { const bad = []; const de = document.documentElement; for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && !el.matches('.head-tabs, .emotes')) bad.push(`sideways scroll ${el.className}`); if (['auto', 'scroll'].includes(cs.overflowY) && cs.overflowX === 'auto' && !el.matches('.head-tabs, .emotes')) bad.push(`free scroll ${el.className}`); } for (const dr of document.querySelectorAll('.screen-route .door')) { const l = dr.querySelector('.label'); if (l && l.getBoundingClientRect().top < dr.getBoundingClientRect().top) bad.push('door label above its door'); } if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) bad.push(`page ${de.scrollWidth}x${de.scrollHeight}`); for (const el of document.querySelectorAll('.panel, .modal')) { const r = el.getBoundingClientRect(); if (!r.width) continue; if (el.scrollHeight > el.clientHeight + 1) bad.push(`${el.className.split(' ').slice(0, 2).join('.')} needs ${el.scrollHeight - el.clientHeight}px more`); if (r.bottom > innerHeight + 1) bad.push(`${el.className.split(' ')[0]} runs ${Math.round(r.bottom - innerHeight)}px off`); } return bad; });
    let bad = await fits(); check(`${w}x${h}${notch ? ' notch' : ''} title`, !bad.length, bad.join('; ')); if (w === 844) await p.screenshot({ path: `${OUT}/ph-title.png` });
    for (const [name, setup] of Object.entries(SCREENS)) {
      await p.evaluate(async (src) => { const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(7), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; const c = s.char; c.name = 'Tamsin Rook'; c.credits = 900; c.level = 6; c.attrPoints = 3; s.meta.resolve = 12; E.mapProgress(c, 'garrison').insertions.push(6); eval(src); localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); }, setup);
      await p.reload(); await p.waitForTimeout(350); await p.tap('button[data-a="continue-title"]', { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(650);
      bad = await fits(); check(`${w}x${h}${notch ? ' notch' : ''} ${name}`, !bad.length, bad.join('; '));
      // The way forward has to be on screen without scrolling.
      // The death screen holds its buttons back while the record reveals; a tap skips to the end. Measure the finished screen.
      await p.evaluate(() => { const g = globalThis.cinderGame; if (g && g.death.playing) document.querySelector('.screen-death').click(); });
      await p.waitForTimeout(650);
      const hidden = await p.evaluate(() => [...document.querySelectorAll('.btn.big, .btn.primary')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width || e.closest('.rows')) return false; const x = r.x + r.width / 2, y = r.y + r.height / 2; if (y > innerHeight || y < 0) return true; const hit = document.elementFromPoint(x, y); return !hit || !(hit === e || e.contains(hit)); }).map((e) => e.textContent.trim().slice(0, 24)));
      check(`${w}x${h}${notch ? ' notch' : ''} ${name} buttons on screen`, !hidden.length, hidden.join(', '));
      await p.screenshot({ path: `${OUT}/ph-${name}-${w}${notch ? 'n' : ''}.png` });
    }
    // Upright on a phone asks you to turn it.
    await ctx.close();
  }
  const up = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const q = await up.newPage(); await q.goto(URL); await q.waitForTimeout(300);
  check('upright phone is asked to turn sideways', await q.isVisible('.rotate-note'));
  await q.tap('.rotate-note button'); check('and can dismiss it', !(await q.isVisible('.rotate-note')));
  await b.close();
  console.log(errs.length ? errs : 'no errors'); console.log(failed ? `${failed} FAILED` : 'ALL FIT'); process.exit(failed || errs.length ? 1 : 0);
})().catch((e) => { console.error(e.message.slice(0, 400)); process.exit(1); });
