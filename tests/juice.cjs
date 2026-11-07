// The presentation layer: hit-stop, shake, materials, boss intro, rare drops, level-up, transitions, count-ups, the death reveal, the raid tally, the boss audio layer, reduced motion.
// Screenshots go to tests/shots/juice-*.png at phone size and desktop.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });

let failed = 0;
const errs = [];
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
const SAVE = 'cinder-cell-save-v1';

// Writes a save built by `src`, reloads and gets past the title.
async function load(p, src) {
  await p.evaluate(async ([src, SAVE]) => {
    const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(11), s = E.newGame(rng);
    E.createChar(s, rng); s.screen = 'town'; const c = s.char;
    await eval(`(async () => { ${src} })()`);
    localStorage.setItem(SAVE, JSON.stringify(s));
  }, [src, SAVE]);
  await p.reload(); await p.waitForTimeout(350);
  await p.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {});
}
const TO_FIGHT = `E.deploy(s, 'garrison', 1, rng); for (let i = 0; i < 30 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) { const k = s.run.choices.findIndex((x) => x === 'fight' || x === 'elite'); E.enterRoom(s, Math.max(0, k), rng); } else E.offerRoute(s, rng); if (['event', 'room'].includes(s.screen)) { s.screen = 'route'; s.run.choices = null; } }`;
const TO_BOSS = `c.bossMet = { 'halvek:garrison': 1 }; E.deploy(s, 'garrison', 1, rng); s.run.sector = 5; s.run.room = 2; s.run.choices = null; E.offerRoute(s, rng); for (let i = 0; i < 6 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); }`;
const PAYOUT = `E.deploy(s, 'garrison', 1, rng); s.run.kills = 7; s.run.cleared = 2; s.run.dmgDone = 1234; c.xpBank = 900; c.credits += 300; E.endRun(s, 'extracted', rng);`;
const DEATH = `${TO_FIGHT} s.run.kills = 3; const e = s.run.enemy; e.atk = 1e6; for (let i = 0; i < 12 && s.screen === 'combat'; i++) { c.hp = 1; e.intent = 'attack'; e.stun = 0; E.playerAct(s, 'defend', rng, 0); }`;

const fxOf = (p) => p.evaluate(() => ({ ...globalThis.cinderGame.stage.fxCount }));
const shootEv = (crit, dmg = 12) => ({ who: 'player', type: 'shoot', dmg, crit, ehp: 500, php: 100, actor: 0 });

async function suite(b, label, ctxOpts) {
  const ctx = await b.newContext(ctxOpts), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${label}: ${e.message}`));
  await p.goto(URL); await p.waitForTimeout(300);
  const shot = (n) => p.screenshot({ path: `${OUT}/juice-${n}-${label}.png` });

  // --- Impact and materials.
  await load(p, TO_FIGHT + ` s.run.enemy.hp = s.run.enemy.maxHp = 5000;`);
  await p.waitForTimeout(800);
  check(`${label}: a fight loads`, await p.evaluate(() => globalThis.cinderGame.state().screen) === 'combat');
  const f0 = await fxOf(p);
  await p.evaluate(() => { globalThis.__play = globalThis.cinderGame.stage.play([{ who: 'player', type: 'shoot', dmg: 3, crit: false, ehp: 500, php: 100, actor: 0 }]); });
  await p.waitForTimeout(900);
  const f1 = await fxOf(p);
  check(`${label}: a normal hit doesn't stop the stage`, f1.stops === f0.stops, JSON.stringify(f1));
  check(`${label}: a shot throws a casing`, f1.casings > f0.casings);
  // A crit, photographed just after it lands.
  const before = await p.evaluate(() => { globalThis.cinderGame.stage.play([{ who: 'player', type: 'shoot', dmg: 88, crit: true, ehp: 500, php: 100, actor: 0 }]); return performance.now(); });
  await p.waitForFunction(() => document.querySelector('.pop.crit'), null, { timeout: 2500 });
  await p.waitForTimeout(90);
  await shot('crit');
  const f2 = await fxOf(p);
  check(`${label}: a crit stops, shakes and flashes`, f2.stops > f1.stops && f2.shakes > f1.shakes && f2.screenFlashes > f1.screenFlashes, JSON.stringify(f2));
  check(`${label}: the crit number shows`, await p.evaluate(() => { const e = document.querySelector('.pop.crit'); return !!e && parseFloat(getComputedStyle(e).fontSize) >= 24; }));
  await p.waitForTimeout(1000);
  void before;
  const stuck = await p.evaluate(() => { const s = globalThis.cinderGame.stage; return { stopUntil: s.stopUntil, tweens: s.tweens.length }; });
  check(`${label}: the stage isn't left frozen`, stuck.stopUntil === 0 && stuck.tweens === 0, JSON.stringify(stuck));
  // Materials follow the enemy's tags.
  const mats = await p.evaluate(async () => {
    const st = globalThis.cinderGame.stage, a = { ...st.fxCount };
    st.enemyTags = ['droid']; st.impact(st.enemy, {});
    const metal = st.fxCount.metal - a.metal, flesh0 = st.fxCount.flesh;
    st.enemyTags = ['beast']; st.impact(st.enemy, {});
    st.enemyTags = ['human', 'armored']; st.impact(st.enemy, {});
    return { metal, flesh: st.fxCount.flesh - flesh0, metal2: st.fxCount.metal - a.metal };
  });
  check(`${label}: droids and armour spark, beasts don't`, mats.metal === 1 && mats.flesh === 1 && mats.metal2 === 2, JSON.stringify(mats));
  const cap = await p.evaluate(() => { const st = globalThis.cinderGame.stage; for (let i = 0; i < 80; i++) { st.impact(st.enemy, { crit: true }); st.casing(st.player); } return st.particles.length; });
  check(`${label}: particles are capped`, cap <= 260, String(cap));
  // Hit-stop's budget: a run of crits adds no more than about 100ms however many land.
  const budget = await p.evaluate(() => { const st = globalThis.cinderGame.stage; st.stopBudget = 100; const t0 = st.stopBudget; for (let i = 0; i < 20; i++) st.hitStop(80); return t0 - st.stopBudget; });
  check(`${label}: hit-stop stays in budget`, budget <= 100, String(budget));
  const t2x = await p.evaluate(async () => { const st = globalThis.cinderGame.stage, m = st.mode; st.mode = 'auto2'; st.applySpeed(); const t0 = performance.now(); await st.play([{ who: 'player', type: 'shoot', dmg: 88, crit: true, ehp: 500, php: 100, actor: 0 }]); const d = performance.now() - t0; st.mode = m; st.applySpeed(); return d; });
  const t1x = await p.evaluate(async () => { const st = globalThis.cinderGame.stage; const t0 = performance.now(); await st.play([{ who: 'player', type: 'shoot', dmg: 88, crit: true, ehp: 500, php: 100, actor: 0 }]); return performance.now() - t0; });
  check(`${label}: a crit at 2x takes well under its 1x time`, t2x < t1x * 0.75, `${Math.round(t1x)}ms / ${Math.round(t2x)}ms`);

  // --- Count-ups settle on the truth, through renders in the middle.
  await p.evaluate(() => { const g = globalThis.cinderGame, c = g.state().char; c.credits += 777; g.after(); });
  const mid = await p.evaluate(() => document.querySelector('[data-cnt="credits"]').textContent);
  await p.waitForTimeout(120);
  await p.evaluate(() => { const g = globalThis.cinderGame, c = g.state().char; c.credits += 111; g.after(); });
  await p.waitForTimeout(1000);
  const settled = await p.evaluate(() => ({ shown: document.querySelector('[data-cnt="credits"]').textContent, truth: globalThis.cinderGame.state().char.credits.toLocaleString() }));
  check(`${label}: credits count, then settle on the true value`, settled.shown === settled.truth && mid !== settled.truth, `${mid} -> ${settled.shown} (${settled.truth})`);

  // --- Boss intro: close-up and line once, not again after a reload. Tap skips.
  await load(p, TO_BOSS);
  await p.waitForFunction(() => { const c = document.querySelector('.cine.say'); return c && !c.hidden; }, null, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(450);
  await shot('boss');
  const line = await p.evaluate(() => { const l = document.querySelector('.cine-line'); return { text: l.textContent, on: !document.querySelector('.cine').hidden, size: parseFloat(getComputedStyle(l).fontSize), zoom: !!globalThis.cinderGame.stage.zoom, boss: globalThis.cinderGame.state().run.enemy.boss }; });
  check(`${label}: boss fight`, line.boss);
  check(`${label}: boss intro shows a close-up and a line`, line.on && line.zoom && line.text.length > 10 && line.size >= 11, JSON.stringify(line));
  await p.click('.cine');
  await p.waitForTimeout(100);
  check(`${label}: a tap skips the intro`, await p.evaluate(() => document.querySelector('.cine').hidden && !document.getElementById('app').classList.contains('busy') && globalThis.cinderGame.stage.zoom === null));
  await p.reload(); await p.waitForTimeout(350); await p.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await p.waitForTimeout(500);
  check(`${label}: reloading mid-fight doesn't replay it`, await p.evaluate(() => document.querySelector('.cine').hidden && globalThis.cinderGame.stage.enemy.alpha === 1));

  // --- Boss audio layer: fades in with a boss, out after, follows mute and hidden.
  await p.click('.actions .btn', { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(200);
  const bs = () => p.evaluate(() => globalThis.cinderGame.audio.bossLayerState());
  const inBoss = await bs();
  check(`${label}: boss layer runs in a boss fight`, inBoss.want && inBoss.running, JSON.stringify(inBoss));
  await p.evaluate(() => globalThis.cinderGame.audio.setPref('muted', true));
  const muted = await bs();
  check(`${label}: mute silences the boss layer`, muted.level === 0 && (muted.fading || !muted.running), JSON.stringify(muted));
  await p.evaluate(() => globalThis.cinderGame.audio.setPref('muted', false));
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hid = await bs();
  check(`${label}: hiding the app stops the boss layer`, hid.level === 0 && (hid.fading || !hid.running), JSON.stringify(hid));
  await p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  check(`${label}: and it comes back`, (await bs()).level > 0);
  await p.evaluate(() => globalThis.cinderGame.audio.setBossLayer(false));
  const off = await bs();
  check(`${label}: it fades after the fight`, !off.want && off.fading, JSON.stringify(off));

  // --- Rare loot glows, common doesn't.
  for (const [rar, want] of [['legendary', true], ['common', false]]) {
    await load(p, `E.deploy(s, 'garrison', 1, rng); s.run.lootOffer = E.makeItem('cannon', '${rar}', rng); s.screen = 'loot';`);
    await p.waitForTimeout(650);
    const g = await p.evaluate(() => ({ cls: !!document.querySelector('.modal.rare-drop'), n: globalThis.cinderGame.juice.rareDrops }));
    check(`${label}: ${rar} drop ${want ? 'glows and rings' : 'stays plain'}`, g.cls === want && (g.n > 0) === want, JSON.stringify(g));
    if (want) await shot('loot');
  }

  // --- Payout: tally counts in order and lands on the numbers; tap skips.
  await load(p, PAYOUT);
  await p.waitForFunction(() => document.querySelector('.payout'), null, { timeout: 2500 });
  const p0 = await p.evaluate(() => { const c = globalThis.cinderGame.state().char.payout; return c; });
  check(`${label}: the payout carries the tally`, p0.tally && p0.tally.kills === 7 && p0.tally.sectors === 2 && p0.tally.dmg === 1234, JSON.stringify(p0.tally));
  const readTally = () => p.evaluate(() => ({ t: [...document.querySelectorAll('[data-tally]')].map((e) => e.textContent), c: [...document.querySelectorAll('.payout [data-count]')].map((e) => e.textContent) }));
  await p.waitForTimeout(250);
  await shot('tally-mid');
  const early = await readTally();
  check(`${label}: the tally starts part way through`, early.t[2] === '0', JSON.stringify(early));
  await p.waitForFunction(() => document.querySelector('.payout.settled'), null, { timeout: 12000 });
  await shot('tally');
  const fin = await readTally();
  const levelled = await p.evaluate(() => { const c = globalThis.cinderGame.state().char; return { up: c.payout.toLevel > c.payout.fromLevel, flashes: globalThis.cinderGame.juice.levelFlashes, lab: document.querySelector('.payout-level .label').textContent, lv: c.level, hidden: document.querySelector('.payout-up').hidden }; });
  check(`${label}: the tally ends on the right numbers`, fin.t.join() === '7,2,1,234' && fin.c[0] === `+${p0.credits.toLocaleString()}` && fin.c[1] === `+${p0.xp.toLocaleString()}`, JSON.stringify(fin));
  check(`${label}: levelling up flashes and shows the new level`, levelled.up && levelled.flashes > 0 && levelled.lab === `Level ${levelled.lv}` && !levelled.hidden, JSON.stringify(levelled));
  await load(p, PAYOUT);
  await p.waitForFunction(() => document.querySelector('.payout'), null, { timeout: 2500 });
  await p.waitForTimeout(60);
  await p.click('.payout .tally');
  const sk = await readTally();
  check(`${label}: a tap jumps the tally to the end`, sk.t.join() === '7,2,1,234' && await p.evaluate(() => !!document.querySelector('.payout.settled')), JSON.stringify(sk));
  await p.click('button[data-a="payoutclose"]');
  await p.waitForTimeout(100);
  check(`${label}: the payout closes`, !(await p.$('.payout')));
  // An older save's payout has no tally: nothing breaks.
  await load(p, PAYOUT + ` delete c.payout.tally;`);
  await p.waitForFunction(() => document.querySelector('.payout.settled'), null, { timeout: 12000 });
  check(`${label}: a payout with no tally still works`, !(await p.$('.tally')));
  // A raid in progress from before the counters: the tally just reads from what's there.
  const oldRun = await p.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(3), s = E.newGame(rng); E.createChar(s, rng); E.deploy(s, 'garrison', 1, rng); delete s.run.dmgDone; delete s.run.tallyMark; delete s.run.kills; s.char.xpBank = 20; s.char.credits += 5; E.endRun(s, 'extracted', rng); return s.char.payout.tally; });
  check(`${label}: an old save mid-raid settles`, oldRun && oldRun.kills === 0 && oldRun.dmg === 0, JSON.stringify(oldRun));

  // --- Death: lines arrive in order, buttons last, tap skips, heirloom still works.
  await load(p, DEATH + ` s.meta.cell.push('heirloom'); c.gear.ranged = E.makeItem('cannon', 'legendary', rng); E.setHeirloom(s, 'ranged');`);
  const buttonOn = () => p.evaluate(() => { const b = document.querySelector('button[data-a="recruit"]'); return !!b && !!b.closest('[data-dl]').hasAttribute('data-on'); });
  await p.waitForFunction(() => document.querySelector('.screen-death'), null, { timeout: 2500 });
  check(`${label}: the record starts hidden, buttons held back`, !(await buttonOn()) && await p.evaluate(() => globalThis.cinderGame.death.playing));
  await p.waitForTimeout(2400);
  await shot('death-mid');
  const midD = await p.evaluate(() => { const parts = [...document.querySelectorAll('[data-dl]')]; return { on: parts.filter((e) => e.hasAttribute('data-on')).length, all: parts.length }; });
  check(`${label}: lines reveal one by one`, midD.on > 1 && midD.on < midD.all && !(await buttonOn()), JSON.stringify(midD));
  await p.waitForFunction(() => !globalThis.cinderGame.death.playing, null, { timeout: 9000 });
  check(`${label}: the screen reaches its buttons by itself`, await buttonOn());
  await p.waitForTimeout(650);
  await shot('death');
  const rec = await p.evaluate(() => document.querySelector('.death-rec').innerText);
  check(`${label}: the record has level, deepest, kills and killer`, /Level/i.test(rec) && /Deepest/i.test(rec) && /Kills/i.test(rec) && /Killed by/i.test(rec), JSON.stringify(rec));
  const heir = await p.$('button[data-a="heirloom"]');
  check(`${label}: the heirloom pick is on the screen`, !!heir);
  if (heir) { await heir.click(); await p.waitForTimeout(100); }
  check(`${label}: picking an heirloom doesn't restart it`, !(await p.evaluate(() => globalThis.cinderGame.death.playing)) && await buttonOn());
  await load(p, DEATH);
  await p.waitForFunction(() => document.querySelector('.screen-death'), null, { timeout: 2500 });
  await p.waitForTimeout(400);
  const scr0 = await p.evaluate(() => globalThis.cinderGame.state().screen);
  await p.click('.screen-death h1', { force: true });
  await p.waitForTimeout(50);
  check(`${label}: a tap skips to the end, and only that`, await buttonOn() && scr0 === 'death' && await p.evaluate(() => globalThis.cinderGame.state().screen) === 'death');
  await p.click('button[data-a="recruit"]');
  await p.waitForTimeout(200);
  check(`${label}: recruit moves on`, await p.evaluate(() => globalThis.cinderGame.state().screen) === 'create');

  // --- Transitions: only on a real change of screen, and they take no input.
  await load(p, ``);
  await p.waitForTimeout(400);
  const w0 = await p.evaluate(() => globalThis.cinderGame.juice.wipes);
  for (let i = 0; i < 5; i++) await p.evaluate(() => globalThis.cinderGame.after());
  check(`${label}: re-rendering a screen doesn't wipe it`, await p.evaluate(() => globalThis.cinderGame.juice.wipes) === w0);
  const res = await p.evaluate(async () => {
    const g = globalThis.cinderGame, s = g.state(), E = await import('./engine.js'), rng = g.rng();
    E.deploy(s, 'garrison', 1, rng); g.after();
    const w = document.getElementById('wipe');
    return { wipes: g.juice.wipes, cls: w && w.className, pe: w && getComputedStyle(w).pointerEvents, scroll: document.documentElement.scrollHeight <= innerHeight + 1 };
  });
  check(`${label}: changing screen wipes`, res.wipes === w0 + 1 && !!res.cls && res.pe === 'none', JSON.stringify(res));
  await p.waitForTimeout(350);
  check(`${label}: the wipe clears`, await p.evaluate(() => document.getElementById('wipe').className === ''));
  await ctx.close();
}

async function calmSuite(b, label, opts, turnOn) {
  const ctx = await b.newContext(opts), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${label}: ${e.message}`));
  await p.goto(URL); await p.waitForTimeout(300);
  await p.evaluate(turnOn);
  await load(p, TO_FIGHT + ` s.run.enemy.hp = s.run.enemy.maxHp = 5000;`);
  await p.waitForTimeout(700);
  const r = await p.evaluate(async () => { const st = globalThis.cinderGame.stage, a = { ...st.fxCount }; await st.play([{ who: 'player', type: 'shoot', dmg: 88, crit: true, ehp: 500, php: 100, actor: 0 }]); return { d: Object.fromEntries(Object.keys(a).map((k) => [k, st.fxCount[k] - a[k]])), calm: document.documentElement.classList.contains('calm') }; });
  check(`${label}: no shake, stop or flash`, r.d.shakes === 0 && r.d.stops === 0 && r.d.flashes === 0 && r.d.screenFlashes === 0, JSON.stringify(r));
  // Numbers still get there, at once.
  await p.evaluate(() => { const g = globalThis.cinderGame, c = g.state().char; c.credits += 500; g.after(); });
  check(`${label}: credits jump straight to the value`, await p.evaluate(() => document.querySelector('[data-cnt="credits"]').textContent === globalThis.cinderGame.state().char.credits.toLocaleString()));
  await load(p, TO_BOSS);
  await p.waitForTimeout(600);
  check(`${label}: boss intro is a still card`, await p.evaluate(() => globalThis.cinderGame.stage.zoom === null && !!document.querySelector('.cine.say')));
  await p.click('.cine').catch(() => {});
  await load(p, PAYOUT);
  await p.waitForTimeout(150);
  const pay = await p.evaluate(() => ({ settled: !!document.querySelector('.payout.settled'), flashes: globalThis.cinderGame.juice.levelFlashes, t: [...document.querySelectorAll('[data-tally]')].map((e) => e.textContent).join() }));
  check(`${label}: tally is already done, no level flash`, pay.settled && pay.flashes === 0 && pay.t === '7,2,1,234', JSON.stringify(pay));
  await load(p, DEATH);
  await p.waitForTimeout(100);
  check(`${label}: death screen shows at once`, await p.evaluate(() => !globalThis.cinderGame.death.playing && document.querySelector('button[data-a="recruit"]').closest('[data-dl]').hasAttribute('data-on') && getComputedStyle(document.querySelector('button[data-a="recruit"]').closest('[data-dl]')).opacity === '1'));
  await p.click('button[data-a="recruit"]', { timeout: 1000 });
  await load(p, ``);
  await p.waitForTimeout(200);
  const w = await p.evaluate(async () => { const g = globalThis.cinderGame, s = g.state(), E = await import('./engine.js'), a = g.juice.wipes; E.deploy(s, 'garrison', 1, g.rng()); g.after(); return g.juice.wipes - a; });
  check(`${label}: no screen wipes`, w === 0, String(w));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  await suite(b, 'phone', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await suite(b, 'desk', { viewport: { width: 1280, height: 800 } });
  await calmSuite(b, 'calm setting', { viewport: { width: 844, height: 390 } }, () => { localStorage.setItem('cinder-cell-ui', JSON.stringify({ calm: true })); });
  await calmSuite(b, 'OS reduced motion', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, () => {});
  // Haptics: a crit is a pattern through the app's bridge, and the Vibration setting still stops it.
  const hctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await hctx.addInitScript(() => { window.__sent = []; const h = (n) => ({ postMessage: (m) => window.__sent.push([n, m]) }); window.webkit = { messageHandlers: { ready: h('ready'), haptic: h('haptic'), share: h('share') } }; });
  const hp = await hctx.newPage(); await hp.goto(URL); await hp.waitForTimeout(300);
  const buzz = await hp.evaluate(async () => { window.__sent = []; const A = globalThis.cinderGame.audio; A.play('crit'); await new Promise((r) => setTimeout(r, 400)); const on = window.__sent.filter(([n]) => n === 'haptic').map(([, m]) => m); A.setPref('haptics', false); window.__sent = []; A.play('crit'); await new Promise((r) => setTimeout(r, 400)); const off = window.__sent.length; A.setPref('haptics', true); return { on, off }; });
  check('a crit buzzes in a pattern, and the setting stops it', buzz.on.length === 3 && buzz.off === 0, JSON.stringify(buzz));
  await hctx.close();
  await b.close();
  console.log(errs.length ? errs : 'no errors');
  console.log(failed ? `${failed} FAILED` : 'ALL PASS');
  process.exit(failed || errs.length ? 1 : 0);
})().catch((e) => { console.error(e.message.slice(0, 600)); process.exit(1); });
