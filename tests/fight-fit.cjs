// A fight on a phone held sideways: the stage never changes size, no label is cut, the console fits the panel, and art that
// fails or comes late recovers. SHEET=1 keeps screenshots of the states in tests/shots/fit-*.png.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
const SAVE = 'cinder-cell-save-v1';
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : extra}`); if (!ok) failed++; };
const TO_FIGHT = `for (let i = 0; i < 30 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) { const k = s.run.choices.findIndex((x) => x === 'fight' || x === 'elite'); E.enterRoom(s, Math.max(0, k), rng); } else E.offerRoute(s, rng); }`;
const FIGHT = (map, extra = '') => `s.meta.bestSector = 99; for (const k of ['garrison', 'foundry', 'detention', 'port']) E.mapProgress(s.char, k).deepest = 20; E.deploy(s, '${map}', 1, rng); s.run.sector = 3; s.run.room = 0; s.run.choices = null; s.run.bulletin = 'quiet'; E.offerRoute(s, rng); ${TO_FIGHT} s.char.hp = E.stats(s).maxHp; ${extra}`;
const BOSS = (map, sector, id, extra = '') => `s.meta.bestSector = 99; for (const k of ['garrison', 'foundry', 'detention', 'port']) E.mapProgress(s.char, k).deepest = 20; E.deploy(s, '${map}', 1, rng); s.run.sector = ${sector}; s.run.room = 2; s.run.choices = null; s.run.bulletin = 'quiet'; E.offerRoute(s, rng); for (let i = 0; i < 8 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); } s.char.hp = E.stats(s).maxHp; ${extra}`;
const BUILD = 'c.attrs = { str: 12, agi: 10, int: 8, cha: 8 }; c.gear.ranged = E.makeItem("carbine", "common", rng) || c.gear.ranged; c.items.thermal = 3; c.items.ion = 3; c.items.smoke = 3;';

const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function page(b, w, h, notch) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...PHONE }), p = await ctx.newPage();
  if (notch) await (await ctx.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } });
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  return { ctx, p };
}
async function load(p, body, wait = 700) {
  if (!p.url().startsWith('http')) { await p.goto(URL); await p.waitForTimeout(300); }
  await p.evaluate(async ([body, SAVE]) => {
    localStorage.clear();
    const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(11), s = E.newGame(rng);
    E.createChar(s, rng); s.screen = 'town'; const c = s.char; s.meta.tips = { town: 1, combat: 1, route: 1, loot: 1, perk: 1 }; s.notice = null;
    await eval(`(async () => { ${body} })()`);
    localStorage.setItem(SAVE, JSON.stringify(s)); localStorage.setItem('cinder-cell-speed', '"manual"');
  }, [body, SAVE]);
  await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 20000 });
  await p.tap('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(wait);
}
const skipCine = async (p) => { for (let i = 0; i < 8 && await p.evaluate(() => { const c = document.querySelector('.cine'); return c && !c.hidden; }); i++) { await p.tap('.stage canvas', { force: true }).catch(() => {}); await p.waitForTimeout(250); } };

// Everything measurable about the fight at once. Nothing is judged here.
const measure = (p) => p.evaluate(() => {
  const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const stage = rect(document.querySelector('.stage')), canvas = rect(document.querySelector('.stage canvas')), intent = rect(document.querySelector('.intent')), row = rect(document.querySelector('.statline'));
  const bad = [];
  const seen = (e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; };
  for (const e of document.querySelectorAll('.hud-name, .hud-hp, .intent b, .intent .tip, .sk-name, .sk-note, .items .bt, .actions .bt, .actions .bs, .items .btn.confirm .bs')) {
    if (!seen(e)) continue;
    if (e.scrollWidth > e.clientWidth + 1) bad.push(`wide "${e.textContent.trim().slice(0, 30)}" ${e.scrollWidth}/${e.clientWidth}`);
    if (e.matches('.intent .tip, .intent b') && e.scrollHeight > e.clientHeight + 1) bad.push(`tall "${e.textContent.trim().slice(0, 30)}" ${e.scrollHeight}/${e.clientHeight}`);
    const box = e.closest('.btn') || e.closest('.intent') || e.closest('.hud');
    if (box) { const a = e.getBoundingClientRect(), o = box.getBoundingClientRect(); if (a.right > o.right + 1 || a.bottom > o.bottom + 1 || a.top < o.top - 1) bad.push(`out of box "${e.textContent.trim().slice(0, 30)}"`); }
  }
  // The chip row: each item is either wholly in the row or wholly on the hidden second line.
  const rowEl = document.querySelector('.statline'), rr = rowEl.getBoundingClientRect(), shown = [], dropped = [];
  for (const e of rowEl.children) { if (!seen(e)) continue; const a = e.getBoundingClientRect(); if (a.top >= rr.bottom - 1) { dropped.push(e.textContent.trim()); continue; } shown.push(e.textContent.trim()); if (a.right > rr.right + 1) bad.push(`row cut "${e.textContent.trim()}"`); if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline') bad.push(`row wide "${e.textContent.trim()}"`); }
  // The console.
  const panel = rect(document.querySelector('.c-right')), buttons = [...document.querySelectorAll('.c-right .btn')].filter(seen).map((e) => ({ t: e.textContent.trim().slice(0, 20), ...rect(e) }));
  const out = buttons.filter((x) => x.b > panel.b + 0.5 || x.r > panel.r + 0.5 || x.y < panel.y - 0.5 || x.x < panel.x - 0.5).map((x) => x.t), small = buttons.filter((x) => x.h < 37.5 || x.w < 37.5).map((x) => `${x.t} ${Math.round(x.w)}x${Math.round(x.h)}`);
  const tiny = [...document.querySelectorAll('.c-left *, .c-right *')].filter((e) => seen(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.textContent.trim().slice(0, 20));
  const headEl = document.querySelector('.head-stats'), hr = headEl.getBoundingClientRect(), stats = [...headEl.children].filter(seen), head = [];
  for (const e of stats) { const a = e.getBoundingClientRect(); if (a.top >= hr.bottom - 1) continue; if (a.right > hr.right + 1) head.push(`cut ${e.textContent.trim().slice(0, 16)}`); const v = e.querySelector('.v'); if (v && v.getBoundingClientRect().right > a.right + 1) head.push(`spills ${e.textContent.trim().slice(0, 16)}`); }
  const headSeen = stats.filter((e) => e.getBoundingClientRect().top < hr.bottom - 1).sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left), overlaps = [];
  for (let i = 1; i < headSeen.length; i++) { const a = headSeen[i - 1].getBoundingClientRect(), z = headSeen[i].getBoundingClientRect(); if (a.right > z.left + 0.5) overlaps.push(`${headSeen[i - 1].textContent.trim().slice(0, 12)} / ${headSeen[i].textContent.trim().slice(0, 12)}`); }
  const name = document.querySelector('.hud-enemy .hud-name');
  return { stage, canvas, intent, row, bad, shown, dropped, out, small, tiny, head, overlaps, headLabels: headSeen.map((e) => (e.querySelector('.label') || e).textContent.trim()), enemyName: name.textContent, pageScroll: document.documentElement.scrollHeight > innerHeight + 1 };
});
const sized = (m) => `${Math.round(m.stage.w)}x${Math.round(m.stage.h)}`;

(async () => {
  const b = await chromium.launch();
  const KIT = await (async () => { const { ctx, p } = await page(b, 844, 390); await p.goto(URL); const k = await p.evaluate(async () => { const D = await import('./data.js'); return Object.fromEntries(Object.entries(D.BOSS_KIT).map(([k, v]) => [k, Object.keys(v.moves)])); }); await ctx.close(); return k; })();

  for (const [w, h, notch] of [[844, 390, false], [844, 390, true], [667, 375, false]]) {
    const tag = `${w}x${h}${notch ? ' notch' : ''}`;
    const { ctx, p } = await page(b, w, h, notch);
    // --- 1 and 2. The boss at its busiest, every move, every lasting effect, every counter-tip.
    const HOME = { halvek: ['garrison', 5], crawler: ['garrison', 10], ostrane: ['garrison', 15], brask: ['foundry', 5], crucible: ['foundry', 10], kell: ['detention', 5], vane: ['port', 5] };
    await load(p, BOSS('foundry', 5, 'brask', BUILD), 500);
    await skipCine(p);
    await p.waitForFunction(() => !document.getElementById('app').classList.contains('busy'), null, { timeout: 15000 });
    const base = await measure(p);
    check(`${tag} boss: starting size is sane`, base.canvas.w >= (w > 700 ? 400 : 300), sized(base));
    const sizes = new Set([sized(base)]), bad = [];
    const force = async (id, mv, busy) => p.evaluate(async ([id, mv, busy]) => {
      const g = globalThis.cinderGame, s = g.state(), r = s.run, e = r.enemy, c = s.char;
      e.id = id; e.boss = true; e.stun = 0; e.intent = 'sig'; e.sig = { id: mv, n: 1, left: 2, startHp: e.hp, act: 'shoot' };
      e.bs = e.bs || {}; e.name = { halvek: 'Warden Halvek', crawler: 'Crawler', ostrane: 'Ostrane', brask: 'Overseer Brask', crucible: 'The Crucible', kell: 'Warden Kell', vane: 'Harbourmaster Vane' }[id] || e.name;
      Object.assign(e.bs, busy ? { shutter: 2, noRun: true, floor: 2, front: 2, frontHeld: true, count: 2, lights: 2, wreck: 2, redact: id === 'ostrane' ? { who: 0, act: 'shoot', t: 2 } : null, floorTurns: 2, taken: [{ who: 0, item: 'thermal' }] } : { shutter: 0, noRun: false, floor: 0, front: 0, frontHeld: false, count: 0, lights: 0, wreck: 0, redact: null, taken: [] });
      r.ready = busy; r.momentum = busy; c.hp = 1; g.after();
    }, [id, mv, busy]);
    for (const [id, moves] of Object.entries(KIT)) for (const mv of moves) for (const busy of [false, true]) {
      await force(id, mv, busy); await p.waitForTimeout(40);
      const m = await measure(p);
      sizes.add(sized(m));
      if (m.bad.length) bad.push(`${id}.${mv}${busy ? '+' : ''}: ${m.bad.join(', ')}`);
      if (m.pageScroll) bad.push(`${id}.${mv} scrolls`);
      if (process.env.SHEET && busy && moves.indexOf(mv) === 0 && w === 844 && !notch) await p.screenshot({ path: `${OUT}/fit-${id}-${mv}.png` });
    }
    check(`${tag} boss: stage size never changes`, sizes.size === 1, [...sizes].join(' '));
    check(`${tag} boss: no name, tip or chip cut in any state`, !bad.length, bad.slice(0, 6).join(' | '));
    // Tap for the detail.
    await p.tap('.intent'); await p.waitForTimeout(120);
    const hint = await p.evaluate(() => { const e = document.getElementById('hint'); return e && e.classList.contains('on') ? e.textContent : ''; });
    check(`${tag} boss: tapping the intent line explains it in full`, hint.length > 30, hint);
    // Normal intents across the same fight.
    for (const it of ['attack', 'heavy', 'guard', 'aim']) {
      await p.evaluate((it) => { const g = globalThis.cinderGame, e = g.state().run.enemy; e.sig = null; e.intent = it; g.after(); }, it); await p.waitForTimeout(30);
      sizes.add(sized(await measure(p)));
    }
    check(`${tag} boss: same size with an ordinary intent`, sizes.size === 1, [...sizes].join(' '));
    // The speech card stays off the operative's feet.
    await p.evaluate(() => { const g = globalThis.cinderGame; g.stage.speak({ n: 999, text: 'Clock in. Everybody does in the end, one way or another, down here.', note: 'Shots deal half for 2 turns.' }); });
    await p.waitForTimeout(260);
    const feet = await p.evaluate(() => { const g = globalThis.cinderGame.stage, c = document.querySelector('.bsay'), cv = document.querySelector('.stage canvas').getBoundingClientRect(), r = c.getBoundingClientRect(), a = g.anchor('player', g.player), k = cv.width / 384; return { hidden: c.hidden, cardBottom: r.bottom, cardLeft: r.left, cardRight: r.right, feetY: cv.top + a.y * k, headY: cv.top + (a.y - g.player.tall) * k }; });
    check(`${tag} speech card clears the feet`, !feet.hidden && feet.cardBottom < feet.feetY - 40, JSON.stringify(feet));

    // --- 2. An enemy's name and tip beside the most chips an ordinary fight can have.
    const fightBad = [];
    for (const map of ['garrison', 'foundry', 'detention', 'port']) {
      await load(p, FIGHT(map, BUILD), 600);
      await p.waitForFunction(() => !document.getElementById('app').classList.contains('busy'), null, { timeout: 15000 });
      await p.evaluate(async () => { const D = await import('./data.js'), g = globalThis.cinderGame, r = g.state().run, e = r.enemy; e.quirk = D.QUIRKS[0].id; e.affix = Object.keys(D.AFFIXES)[0]; e.id = 'hound'; r.ready = true; r.momentum = true; e.intent = 'heavy'; g.after(); });
      await p.waitForTimeout(40);
      const m = await measure(p);
      if (m.bad.length) fightBad.push(`${map}: ${m.bad.join(', ')}`);
      if (!m.shown.some((x) => /^(Hits|Lethal)/i.test(x))) fightBad.push(`${map}: the damage chip dropped`);
      if (process.env.SHEET && w === 844 && !notch) await p.screenshot({ path: `${OUT}/fit-fight-${map}.png` });
      // --- 3. Four skills and all three items.
      const skills = await p.evaluate(() => document.querySelectorAll('.skills .btn').length), items = await p.evaluate(() => document.querySelectorAll('.items .btn').length);
      check(`${tag} ${map}: ${skills} skills, ${items} items: everything inside the panel at 38px`, !m.out.length && !m.small.length && !m.tiny.length, JSON.stringify({ out: m.out, small: m.small, tiny: m.tiny }));
      if (map === 'garrison') check(`${tag} the crowded console really is crowded`, skills === 4 && items === 3, `${skills}/${items}`);
    }
    check(`${tag} fights: nothing cut with every chip showing`, !fightBad.length, fightBad.join(' | '));

    // --- 4. Every long name the game can make.
    const names = await p.evaluate(async () => { const D = await import('./data.js'), base = Object.values(D.ENEMIES).map((x) => x.name), pre = Object.values(D.MAP_VARIANT).flatMap((v) => Object.values(v).map((x) => x.prefix).filter(Boolean)), q = D.QUIRKS.map((x) => x.name); const longest = (a, n) => [...new Set(a)].sort((x, y) => y.length - x.length).slice(0, n); return longest(base, 5).flatMap((n) => longest(pre, 3).flatMap((v) => longest(q, 3).map((k) => `${k} ${v} ${n}`))); });
    const nameBad = [];
    for (const name of names) {
      const r = await p.evaluate((name) => { const g = globalThis.cinderGame, e = g.state().run.enemy; e.name = name; e.hp = 1234; e.maxHp = 1234; g.after(); const n = document.querySelector('.hud-enemy .hud-name'); return { text: n.textContent, sw: n.scrollWidth, cw: n.clientWidth, tip: document.querySelector('.hud-enemy').dataset.tip, size: getComputedStyle(n).fontSize }; }, name);
      if (r.sw > r.cw + 1) nameBad.push(`${name}: cut ${r.sw}/${r.cw}`);
      if (!name.endsWith(r.text)) nameBad.push(`${name}: reads "${r.text}"`);
      if (r.tip !== name) nameBad.push(`${name}: tap gives "${r.tip}"`);
      if (parseFloat(r.size) < 11) nameBad.push(`${name}: ${r.size}`);
    }
    check(`${tag} ${names.length} long enemy names: none cut, whole on tap`, !nameBad.length, nameBad.slice(0, 4).join(' | '));
    const lastWord = await p.evaluate(() => document.querySelector('.hud-enemy .hud-name').textContent);
    console.log(`  (longest name reads "${lastWord}")`);

    // --- 9. Creation: the whole figure in the box.
    await p.evaluate(async () => { localStorage.clear(); }); await p.reload(); await p.waitForSelector('button[data-a="continue-title"], button[data-a="begin"]', { timeout: 15000 });
    await p.evaluate(async (SAVE) => { const E = await import('./engine.js'), rng = E.seededRng(3), s = E.newGame(rng); s.draft = E.newDraft(s.meta, rng); s.draft.step = 1; s.screen = 'create'; localStorage.setItem(SAVE, JSON.stringify(s)); }, SAVE);
    await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 15000 }); await p.tap('button[data-a="continue-title"]').catch(() => {}); await p.waitForTimeout(700);
    const look = await p.evaluate(() => { const i = document.querySelector('.look-big img'), box = document.querySelector('.look-big').getBoundingClientRect(), r = i.getBoundingClientRect(); return { top: r.top - box.top, bot: box.bottom - r.bottom, left: r.left - box.left, right: box.right - r.right, h: r.height, boxH: box.height }; });
    check(`${tag} creation: preview sits inside its box`, look.top >= 0 && look.bot >= 0 && look.left >= 0 && look.right >= 0 && look.h > 100, JSON.stringify(look));
    if (w === 844 && !notch) await p.screenshot({ path: `${OUT}/fit-create.png` });
    check(`${tag} no page errors`, !p.errs.length, p.errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // --- 6. hd.json fails, then works: real art at the right scale, and never a giant while it's missing.
  {
    const { ctx, p } = await page(b, 844, 390);
    await load(p, FIGHT('garrison'));
    let aborts = 0;
    await ctx.route(/sprites\/hd\.json/, (r) => { if (aborts++ < 2) r.abort(); else r.continue(); });
    await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 20000 });
    await p.tap('button[data-a="continue-title"]').catch(() => {}); await p.waitForTimeout(250);
    const state = () => p.evaluate(() => { const g = globalThis.cinderGame.stage, f = (a) => a && { hd: !!(a.sheet && a.sheet.hd), tall: a.tall, sheet: !!a.sheet, id: a.id }; return { E: f(g.enemy), P: f(g.player), hold: !document.querySelector('.art-wait').hidden }; });
    const early = await state();
    check('hd.json aborted: the fight holds rather than draw a stand-in', early.hold, JSON.stringify(early));
    await p.waitForFunction(() => { const g = globalThis.cinderGame.stage; return g.enemy && g.enemy.sheet && g.enemy.sheet.hd && g.player.sheet && g.player.sheet.hd; }, null, { timeout: 12000 }).catch(() => {});
    const late = await state();
    check('hd.json retried: real art swapped in', aborts >= 3 && late.E.hd && late.P.hd && late.E.tall < 170 && late.P.tall < 170, JSON.stringify({ aborts, late }));
    await ctx.close();
  }
  // hd.json never comes: no giant, in any fighter.
  {
    const { ctx, p } = await page(b, 844, 390);
    await load(p, FIGHT('garrison'));
    await ctx.route(/sprites\/hd\.json/, (r) => r.abort());
    await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 20000 });
    await p.tap('button[data-a="continue-title"]').catch(() => {}); await p.waitForTimeout(5200);
    const s = await p.evaluate(() => { const g = globalThis.cinderGame.stage; return { ep: g.enemy.size, pp: g.player.size, hold: !document.querySelector('.art-wait').hidden, busy: document.getElementById('app').classList.contains('busy'), scale: g.enemy.scale }; });
    check('hd.json gone: stand-ins at their own scale, and the fight is playable', s.ep < 130 && s.pp <= 200 && !s.hold && !s.busy, JSON.stringify(s));
    await p.screenshot({ path: `${OUT}/fit-nohd.png` });
    check('hd.json gone: no page errors', !p.errs.length, p.errs.join(' | '));
    await ctx.close();
  }
  // --- 7. One sprite and one backdrop fail first time.
  {
    const { ctx, p } = await page(b, 844, 390);
    await load(p, FIGHT('garrison', 's.run.enemy.id = "riot"; s.run.enemy.name = "Riot Enforcer"; s.run.enemy.intent = "attack";'));
    const fails = {};
    const once = (re, tag, times = 1) => ctx.route(re, (r) => { fails[tag] = (fails[tag] || 0) + 1; if (fails[tag] <= times) r.abort(); else r.continue(); });
    await once(/sprites\/riot\/idle\.png/, 'riot'); await once(/sprites\/op_[mf]\/idle\.png/, 'op', 2); await once(/sprites\/riot\/hit\.png/, 'hit'); await once(/bg\/garrison_1\.png/, 'bg');
    await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 20000 });
    await p.tap('button[data-a="continue-title"]').catch(() => {});
    await p.waitForFunction(() => { const g = globalThis.cinderGame.stage; return g.enemy && g.enemy.sheet && g.enemy.sheet.hd && g.player && g.player.sheet && g.player.sheet.hd && g.player.sheet.anims.idle; }, null, { timeout: 15000 }).catch(() => {});
    const s = await p.evaluate(() => { const g = globalThis.cinderGame.stage; return { E: !!(g.enemy.sheet && g.enemy.sheet.hd), P: !!(g.player.sheet && g.player.sheet.hd && g.player.sheet.look), alphaE: g.enemy.alpha }; });
    check('sprite idle retried: enemy and composited operative get real art', s.E && s.P && fails.riot >= 2 && fails.op >= 3, JSON.stringify({ s, fails }));
    await p.waitForFunction(() => { const g = globalThis.cinderGame.stage; return g.enemy.sheet.anims.hit; }, null, { timeout: 8000 }).catch(() => {});
    check('a later animation retried: it joins the sheet the actor holds', await p.evaluate(() => !!globalThis.cinderGame.stage.enemy.sheet.anims.hit), JSON.stringify(fails));
    await p.waitForTimeout(2500);
    const bgReq = fails.bg || 0;
    const painted = await p.evaluate(() => { const c = document.querySelector('.stage canvas'), g = c.getContext('2d').getImageData(10, 10, 1, 1).data; return [...g]; });
    check('backdrop retried after a failure', bgReq >= 2, JSON.stringify({ bgReq, painted }));
    await p.screenshot({ path: `${OUT}/fit-retry.png` });
    check('retries: no page errors', !p.errs.length, p.errs.join(' | '));
    await ctx.close();
  }
  // --- 8. Slow first load: no wrong art, a loading line, the boss intro waits, the wait ends.
  {
    const { ctx, p } = await page(b, 844, 390);
    await load(p, BOSS('foundry', 5, 'brask'), 300);
    await p.evaluate(() => localStorage.removeItem('cinder-cell-boss-seen'));
    await ctx.route(/sprites\/(op_[mf]|brask)\//, async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); r.continue(); });
    await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 20000 });
    const titleOk = await p.isEnabled('button[data-a="continue-title"]');
    await p.tap('button[data-a="continue-title"]').catch(() => {}); await p.waitForTimeout(200);
    const log = [];
    const snap = () => p.evaluate(() => { const g = globalThis.cinderGame.stage, c = document.querySelector('.cine'); return { wait: !document.querySelector('.art-wait').hidden, cine: !c.hidden, EHd: !!(g.enemy && g.enemy.sheet && g.enemy.sheet.hd), PHd: !!(g.player && g.player.sheet && g.player.sheet.hd), busy: document.getElementById('app').classList.contains('busy') }; });
    const t0 = Date.now(); let badIntro = false, sawWait = false;
    while (Date.now() - t0 < 6000) { const s = await snap(); log.push(s); if (s.wait) sawWait = true; if (s.cine && !s.EHd) badIntro = true; if (s.cine && s.EHd) break; await p.waitForTimeout(80); }
    check('slow art: Continue was usable and the loading line showed', titleOk && sawWait, JSON.stringify(log[0]));
    check('slow art: the boss intro waited for the boss', !badIntro && log[log.length - 1].cine, JSON.stringify(log[log.length - 1]));
    await p.screenshot({ path: `${OUT}/fit-boss-intro.png` });
    await ctx.close();
  }
  {
    // Nothing at all: the wait runs out, and the fight goes on.
    const { ctx, p } = await page(b, 844, 390);
    await load(p, FIGHT('garrison'), 300);
    await ctx.route(/\/sprites\/.*\.png/, (r) => r.abort());
    await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 20000 });
    const t0 = Date.now();
    await p.tap('button[data-a="continue-title"]').catch(() => {});
    await p.waitForFunction(() => !document.getElementById('app').classList.contains('busy') && document.querySelector('.art-wait').hidden && globalThis.cinderGame.stage.enemy, null, { timeout: 9000 }).catch(() => {});
    const dt = Date.now() - t0;
    check('no art at all: the hold ends by about 4s', dt < 5500, `${dt}ms`);
    await p.tap('button[data-a="act"][data-v="defend"]', { timeout: 3000 }).catch((e) => { p.errs.push(e.message); });
    await p.waitForTimeout(800);
    check('no art at all: the fight plays', !p.errs.length, p.errs.join(' | '));
    await ctx.close();
  }

  // --- 10. Co-op header: nothing collides or is cut, host and friend.
  {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, ...PHONE });
    for (const notch of [false, true]) {
      const p = await ctx.newPage();
      if (notch) await (await ctx.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } });
      await p.goto(URL); await p.waitForTimeout(200);
      await p.evaluate(async ([SAVE]) => {
        localStorage.clear();
        const E = await import('./engine.js'), rng = E.seededRng(11), s = E.newGame(rng); E.createChar(s, rng); const c = s.char; s.meta.tips = { town: 1, combat: 1, route: 1, loot: 1, perk: 1 }; c.name = 'Tamsin Rook'; c.attrs = { str: 12, agi: 10, int: 8, cha: 8 }; c.items.thermal = 3; c.items.ion = 3; c.items.smoke = 3; c.credits = 12345; c.xpBank = 480; s.meta.resolve = 137;
        E.deploy(s, 'garrison', 1, rng); for (let i = 0; i < 30 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) { const k = s.run.choices.findIndex((x) => x === 'fight'); E.enterRoom(s, Math.max(0, k), rng); } else E.offerRoute(s, rng); }
        localStorage.setItem(SAVE, JSON.stringify(s)); localStorage.setItem('cinder-cell-speed', '"manual"');
      }, [SAVE]);
      await p.reload(); await p.waitForSelector('button[data-a="continue-title"]', { timeout: 15000 }); await p.tap('button[data-a="continue-title"]').catch(() => {}); await p.waitForTimeout(500);
      // A partner in the save, as the header sees one.
      await p.evaluate(async () => { const g = globalThis.cinderGame, s = g.state(); const c2 = JSON.parse(JSON.stringify(s.char)); c2.name = 'Rhea Okonedo'; c2.hp = 1200; c2.items.stim = 12; s.coop = true; s.char2 = c2; s.char.hp = 1200; g.after(); });
      await p.waitForTimeout(150);
      const m = await measure(p);
      check(`co-op header${notch ? ' notch' : ''}: nothing cut or colliding`, !m.head.length && !m.overlaps.length, JSON.stringify({ head: m.head, overlaps: m.overlaps }));
      check(`co-op header${notch ? ' notch' : ''}: Resolve whole, Shoot and Strike there`, m.headLabels.some((x) => /^Resolve$/i.test(x)) && m.headLabels.some((x) => /^Shoot$/i.test(x)) && m.headLabels.some((x) => /^Strike$/i.test(x)), m.headLabels.join(','));
      check(`co-op console${notch ? ' notch' : ''}: party row, 4 skills and items inside the panel`, !m.out.length && !m.small.length && !m.bad.length, JSON.stringify({ out: m.out, small: m.small, bad: m.bad }));
      if (!notch) await p.screenshot({ path: `${OUT}/fit-coop-header.png` });
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  console.log(failed ? `${failed} FAILED` : 'fight-fit: all passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
