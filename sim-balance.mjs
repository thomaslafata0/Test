// Balance report: solo and co-op campaigns across builds and playstyles, every item on its own, the early game and the economy.
// Usage: node sim-balance.mjs   Options by env: SECTIONS=builds,styles,coop,maps,items,early,econ  CAMP=60  OPS=300  LIVES=40  TUNE='{"coopHp":1.8}'
import * as E from './engine.js';
import * as D from './data.js';
import * as G from './sim-gear.mjs';
Object.assign(E.TUNE, JSON.parse(process.env.TUNE || '{}'));
// KIT='{"ostrane":{"rate":0.3}}' overrides a boss's numbers in D.BOSS_KIT for a test run.
for (const [id, v] of Object.entries(JSON.parse(process.env.KIT || '{}'))) Object.assign(D.BOSS_KIT[id], v);
const CAMP = +process.env.CAMP || 60, OPS = +process.env.OPS || 300, LIVES = +process.env.LIVES || 40;
const STACK = +process.env.STACK || 3;
const SECTIONS = (process.env.SECTIONS || 'builds,styles,coop,maps,items,early,econ').split(',');

const ARMOR = ['head', 'chest', 'legs'];
const BUILDS = {
  strength:   { bg: 'foundry',  attrs: ['str'], style: 'auto', implants: ['myomer', 'pain', 'dermal', 'adrenal'], drink: 'gin' },
  agility:    { bg: 'runner',   attrs: ['agi'], style: 'rangedFocus', implants: ['reflex', 'optic', 'dermal', 'adrenal'], drink: 'sour' },
  intellect:  { bg: 'clerk',    attrs: ['int'], style: 'auto', implants: ['neural', 'synapse', 'dermal', 'pain'], items: { ion: 2, thermal: 2 }, drink: 'tonic' },
  charisma:   { bg: 'preacher', attrs: ['cha'], style: 'auto', implants: ['voice', 'dermal', 'pain', 'adrenal'], drink: 'rum' },
  balanced:   { bg: 'foundry',  attrs: ['str', 'agi', 'int', 'cha'], style: 'auto', implants: ['dermal', 'reflex', 'pain', 'adrenal'], drink: 'stout' },
  strAgi:     { bg: 'foundry',  attrs: ['str', 'agi'], style: 'auto', implants: ['dermal', 'reflex', 'pain', 'adrenal'], drink: 'gin' },
  glass:      { bg: 'runner',   attrs: ['agi', 'agi', 'str'], style: 'ranged', implants: ['optic', 'reflex', 'synapse'], noArmor: true, drink: 'sour' },
  meleeOnly:  { bg: 'foundry',  attrs: ['str', 'str', 'agi'], style: 'melee', implants: ['myomer', 'dermal', 'pain', 'adrenal'], drink: 'gin' },
  rangedOnly: { bg: 'runner',   attrs: ['agi', 'agi', 'str'], style: 'ranged', implants: ['reflex', 'optic', 'dermal', 'adrenal'], drink: 'gin' },
  hybrid:     { bg: 'foundry',  attrs: ['str', 'agi'], style: 'hybrid', implants: ['dermal', 'reflex', 'pain', 'adrenal'], drink: 'gin' },
  critStack:  { bg: 'runner',   attrs: ['agi', 'agi', 'str'], style: 'rangedFocus', implants: ['optic', 'reflex', 'dermal', 'adrenal'], w: { crit: 3, human: 2 }, drink: 'sour' },
  tank:       { bg: 'foundry',  attrs: ['str', 'str', 'cha'], style: 'auto', implants: ['dermal', 'pain', 'adrenal', 'myomer'], w: { def: 2.5, hp: 2, resist: 3, healkill: 2 }, drink: 'whisky' },
  dotBuild:   { bg: 'foundry',  attrs: ['str', 'agi'], style: 'hybrid', implants: ['dermal', 'reflex', 'pain', 'adrenal'], w: { bleed: 4, droid: 1.5 }, drink: 'gin' },
};
// When to leave. hp: below this share of max HP, leave at the next sector clear. costly: the same when leaving would cost 65% or more.
// free: below this, leave when it costs nothing (just beat a boss). gate: don't walk into a boss below this. always: leave after every boss.
const STYLES = {
  standard: { hp: 0.5, costly: 0.3, free: 1.01, gate: 0.7, flee: 0.15 },
  diver:    { hp: 0.5, costly: 0.3, free: 0.5, gate: 0.7, flee: 0.15 },
  cautious: { hp: 0.65, costly: 0.65, free: 1.01, gate: 0.9, smoke: 1, smokeAt: 0.2, flee: 0.25 },
  greedy:   { hp: 0.2, costly: 0.15, free: 0.25, gate: 0.3, flee: 0.1 },
  // For testing items only: goes home after every boss and otherwise never reacts to HP, so healing can't change when it leaves.
  pusher:   { hp: 0, costly: 0, free: 1.01, gate: 0, flee: 0 },
  farmer:   { hp: 0.5, costly: 0.3, free: 1.01, gate: 0.7, flee: 0.15, farmTo: 8 },
};
const skipOf = (b) => (b.noArmor ? ARMOR : []);
function draft(s, rng, b) {
  const d = E.newDraft(s.meta, rng); d.background = b.bg; d.drone = b.drone || D.DRONE_ORDER[Math.floor(rng() * 4)];
  for (let i = 0; i < 16 && d.points > 0; i++) if (!E.draftAdjust(d, b.attrs[i % b.attrs.length], 1)) { let ok = false; for (const k of Object.keys(D.ATTRS)) if (E.draftAdjust(d, k, 1)) { ok = true; break; } if (!ok) break; }
  return d;
}
function shop(s, b, st, o = {}) {
  const c = s.char;
  E.heal(s);
  if (c.drone && c.drone.damaged) E.repairDrone(s);
  for (let i = 0; c.attrPoints > 0 && i < 60; i++) if (!E.spendAttr(s, b.attrs[i % b.attrs.length])) for (const k of Object.keys(D.ATTRS)) if (E.spendAttr(s, k)) break;
  if (s.meta.heirloom && E.equipHeirloom) E.equipHeirloom(s);
  while (c.items.stim < 2 && E.buyItem(s, 'stim'));
  G.shopGear(s, b.style, 40, skipOf(b), b.w || {});
  while (c.items.stim < 3 && E.buyItem(s, 'stim'));
  for (const [it, n] of Object.entries(b.items || {})) while (c.items[it] < n && c.credits > 60 && E.buyItem(s, it));
  while (c.items.smoke < (st.smoke || 0) && E.buyItem(s, 'smoke'));
  if (!o.noBuy) {
    for (const id of ['medic', 'drill', 'belt', 'lining', 'corpsman', 'quarter', 'fence', 'route', 'favour', 'broker', 'driver', 'ripper', 'informant', 'forger']) { const u = D.UPGRADES.find((x) => x.id === id); if (c.credits >= E.price(s, E.modCost(c, u)) + 60) E.buyUpgrade(s, id); }
    for (const id of b.implants) if (c.credits > 80) E.installImplant(s, id);
    if (c.credits > 60 && !o.noDrink) E.buyDrink(s, b.drink);
  }
  G.upgradeGear(s, b.style, 40, skipOf(b), b.w || {});
}
function act(s, st, b, who = 0) {
  const r = s.run, e = r.enemy, c = s.char, hp = E.stats(s).maxHp, free = e.stun > 0;
  if (E.canUse(s, 'revive')) return 'revive';
  if (st.smokeAt && c.hp < hp * st.smokeAt && c.items.smoke) return 'smoke';
  if (c.hp < hp * 0.35 && c.items.stim) return 'stim';
  if (r.fallen && !e.boss && E.canUse(s, 'run') && E.runChance(s) > 0.3) return 'run'; // a partner just died: get out
  if (st.flee && !e.boss && !E.isCoop(s) && c.hp < hp * st.flee && E.canUse(s, 'run') && E.runChance(s) > 0.3) return 'run';
  if (!free && E.mechanicOf(r) === 'vents' && r.vent === 1) return 'defend';
  const adv = E.sigAdvice(s), blind = E.intentHidden(s); // boss signature moves: see sigAdvice in engine.js
  if (!free && adv.act && (adv.act !== 'defend' || !E.isCoop(s) || r.lastAttacker === who)) return adv.act;
  const danger = !free && !blind && (e.intent === 'heavy' || (e.intent === 'special' && D.SPECIALS[e.id] && D.SPECIALS[e.id].status));
  if (danger && (!E.isCoop(s) || r.lastAttacker === who)) return 'defend';
  if ((e.boss || e.elite) && c.items.thermal) return 'thermal';
  if (e.tags.includes('droid') && c.items.ion && !free && e.hp > e.maxHp * 0.5) return 'ion';
  if (E.canUse(s, 'intimidate') && E.intimidateChance(s) > 0.45) return 'intimidate';
  const hit = adv.hit || G.attackChoice(s, b.style);
  if (!free && !blind && e.intent === 'guard' && hit !== 'strike') return 'defend';
  for (const k of ['overload', 'smash', 'aimed', 'blast', 'burst', 'suppress']) if (E.canUse(s, k) && G.skillAllowed(b.style, k) && !(k === 'smash' && D.MELEE_COUNTER[e.id] && !free) && !(adv.hit === 'strike' && k !== 'smash' && k !== 'overload') && !(adv.hit === 'shoot' && k === 'smash')) return k;
  return hit;
}
// Stacks what it already carries when it can, as a player chasing a build would.
function pickPerk(s, rng) {
  const c = s.char, offer = s.run.perkOffer;
  E.choosePerk(s, offer.find((id) => c.perks.includes(id)) || offer[0], rng);
}
function route(s, rng) {
  const ch = s.run.choices, low = E.livingActors(s).some((i) => E.withActor(s, i, () => s.char.hp < E.stats(s).maxHp * 0.5));
  const pref = low ? ['rest', 'supply', 'cells', 'cargo', 'event', 'locker', 'bench', 'fence', 'fight', 'elite', 'boss'] : ['bench', 'locker', 'cells', 'supply', 'event', 'cargo', 'fence', 'fight', 'rest', 'elite', 'boss'];
  const v = (k) => { const i = pref.indexOf(k); return i < 0 ? pref.indexOf('fight') : i; };
  E.enterRoom(s, ch.map(v).reduce((bi, x, i, arr) => (x < arr[bi] ? i : bi), 0), rng);
}
function leave(s, st) {
  const r = s.run, rate = E.extractRate(r.sector), next = r.sector + 1;
  const low = (t) => E.livingActors(s).some((i) => E.withActor(s, i, () => s.char.hp < E.stats(s).maxHp * t));
  if (rate === 0 && low(st.free)) return true;
  if (low(rate >= 0.65 ? st.costly : st.hp)) return true;
  return E.isBossSector(next) && low(st.gate);
}
// Plays one raid to its end. each(who) gives { b, st }.
function raid(s, rng, bots, st, map, start, hook) {
  E.deploy(s, map, start, rng);
  if (hook) hook();
  let steps = 0;
  while (s.run && s.screen !== 'death' && steps++ < 6000) {
    if (s.screen === 'combat') { const who = s.run.actor || 0; E.playerAct(s, E.withActor(s, who, () => act(s, st, bots[who], who)), rng, who); }
    else if (s.screen === 'victory') E.continueAfterVictory(s, rng);
    else if (s.screen === 'loot' || s.screen === 'perk') {
      const i = E.livingActors(s).find((n) => E.withActor(s, n, () => s.run.lootOffer || s.run.perkOffer));
      if (i === undefined) { E.continueAfterVictory(s, rng); continue; }
      E.withActor(s, i, () => { if (s.run.lootOffer) G.lootChoice(s, rng, bots[i].style, skipOf(bots[i]), bots[i].w || {}); else pickPerk(s, rng); });
    }
    else if (s.screen === 'route') route(s, rng);
    else if (s.screen === 'room') E.offerRoute(s, rng);
    else if (s.screen === 'event') {
      if (s.eventResult) { E.offerRoute(s, rng); continue; }
      const ev = E.eventById(s.event); let best = 0, bc = -1;
      ev.options.forEach((o, i) => { const ch = E.optionAvailable(s, o) ? E.checkChance(s, o.check) : -1; if (ch > bc) { bc = ch; best = i; } });
      E.resolveEvent(s, best, rng, 0); E.offerRoute(s, rng);
    }
    else if (s.screen === 'sectorClear') { if (leave(s, st)) E.attemptExtract(s, rng); else E.pushDeeper(s, rng); }
    else break;
  }
  if (steps >= 6000) throw new Error('stuck at ' + s.screen);
}
const spendResolve = (s) => { for (const u of D.CELL) E.buyCell(s, u.id); let t = true; while (t) t = Object.keys(D.TRAINING).sort((a, b) => s.meta.training[a] - s.meta.training[b]).some((x) => E.train(s, x)); };
const startOf = (s, map, st, who = 'char') => { const c = s[who]; if (st.farmTo && c.level < st.farmTo) return 1; return Math.max(...E.insertionsAt(c, map, 0)); };
// A campaign: operatives until the cell has beaten the boss on sector 5, 10 and 15 of a map. Two bots make it co-op.
function campaign(seed, bots, stName, map = 'garrison') {
  const st = STYLES[stName], rng = E.seededRng(seed), s = E.newGame(rng), coop = bots.length > 1, seen = {}, out = { 5: null, 10: null, 15: null };
  s.coop = coop;
  if (map !== 'garrison') s.meta.bestSector = 99;
  let ops = 0, raids = 0, deaths = 0, wipes = 0;
  const hire = (slot, b) => { ops++; E.createChar(s, rng, draft(s, rng, b), slot); s.screen = 'town'; };
  while (ops < LIVES * bots.length) {
    for (let w = 0; w < bots.length; w++) if (E.charAt(s, w)) E.withActor(s, w, () => E.upgradeDrone(s)); // ranks last, so they're worth buying early
    spendResolve(s);
    if (!s.char) hire('char', bots[0]);
    if (coop && !s.char2) hire('char2', bots[1]);
    for (let w = 0; w < bots.length; w++) E.withActor(s, w, () => shop(s, bots[w], st));
    raids++;
    raid(s, rng, bots, st, map, startOf(s, map, st));
    if (s.coopFallen) { deaths++; s.coopFallen = null; }
    if (s.screen === 'death') { deaths++; if (s.outcome && s.outcome.wipe) wipes++; s.screen = 'town'; s.char = null; }
    for (const b of [5, 10, 15]) if (!seen[b] && (s.meta.bestByMap[map] || 0) >= b) { seen[b] = 1; out[b] = { ops: ops / bots.length, raids }; }
    if (seen[15]) break;
  }
  return { ...out, raids, deaths, wipes, ops: ops / bots.length, kept: s.meta.resolve };
}
const pct = (a, p) => { const x = [...a].sort((m, n) => m - n); return x.length ? x[Math.floor(x.length * p)] : 0; };
const avg = (a) => a.reduce((t, v) => t + v, 0) / (a.length || 1);
function row(label, bots, stName, map, offset = 0) {
  const res = []; for (let k = 0; k < CAMP; k++) res.push(campaign(4000 + offset + k, bots, stName, map));
  const f = (b, key) => { const a = res.map((r) => r[b] && r[b][key]).filter((v) => v != null); return a.length ? pct(a, 0.5) : '-'; };
  const share = (b) => Math.round(res.filter((r) => r[b]).length / CAMP * 100);
  const cell = (b) => `${String(f(b, 'ops')).padStart(4)} ${String(f(b, 'raids')).padStart(4)}`;
  console.log(`${label.padEnd(26)} ${cell(5)} | ${cell(10)} | ${cell(15)} | ${String(share(15)).padStart(3)}%  raid death ${Math.round(avg(res.map((r) => r.deaths / Math.max(1, r.raids))) * 100)}%${bots.length > 1 ? `, wipes ${Math.round(avg(res.map((r) => r.wipes / Math.max(1, r.raids))) * 100)}%` : ''}`);
}
const header = () => console.log(`${''.padEnd(26)} ops raids ${'  '}| ops raids | ops raids | finish`);
// A short difficulty check: careful and standard play, solo and co-op. Careful play is closest to how people actually play.
if (SECTIONS.includes('check')) {
  header();
  for (const b of ['strength', 'strAgi', 'agility', 'intellect', 'charisma']) for (const st of ['cautious', 'standard']) row(`${b} / ${st}`, [BUILDS[b]], st);
  for (const [x, y] of [['strength', 'agility'], ['intellect', 'charisma']]) for (const st of ['cautious', 'standard']) row(`${x} + ${y} / ${st}`, [BUILDS[x], BUILDS[y]], st);
}
// Each drone against no drone, on the same seeds and training, at each rank. Repaired free before each raid, so this shows strength alone.
if (SECTIONS.includes('drones')) {
  const base = single((s) => { s.char.drone = null; });
  console.log(`\n=== Drones: ${OPS} operatives, mean deepest sector. No drone: ${base.toFixed(2)} ===`);
  for (const type of D.DRONE_ORDER) console.log(type.padEnd(8) + [1, 2, 3, 4, 5].map((rank) => { const v = single((s) => { s.char.drone = { type, rank, damaged: false }; }); return `R${rank} ${v.toFixed(2)} ${(v / base - 1 >= 0 ? '+' : '') + Math.round((v / base - 1) * 100)}%`; }).join('  '));
}
if (SECTIONS.includes('builds')) {
  console.log(`\n=== Solo builds, standard play: ${CAMP} campaigns, median operatives and raids to beat boss 5 | 10 | 15 (up to ${LIVES} operatives) ===`); header();
  for (const b of Object.keys(BUILDS)) row(b, [BUILDS[b]], 'standard');
}
if (SECTIONS.includes('styles')) {
  console.log(`\n=== Solo playstyles ===`); header();
  for (const b of ['strength', 'strAgi', 'agility']) for (const st of Object.keys(STYLES).filter((x) => x !== 'pusher')) row(`${b} / ${st}`, [BUILDS[b]], st);
}
if (SECTIONS.includes('coop')) {
  console.log(`\n=== Co-op: operatives per player ===`); header();
  row('solo strength (control)', [BUILDS.strength], 'standard');
  row('solo agility (control)', [BUILDS.agility], 'standard');
  for (const [x, y] of [['strength', 'agility'], ['strength', 'strength'], ['agility', 'agility'], ['tank', 'glass'], ['intellect', 'charisma'], ['meleeOnly', 'rangedOnly']]) row(`${x} + ${y}`, [BUILDS[x], BUILDS[y]], 'standard');
  for (const st of ['cautious', 'greedy', 'diver']) row(`strength + agility / ${st}`, [BUILDS.strength, BUILDS.agility], st);
}
// The whole game: one cell works through every map in order, carrying its training and achievements. Stops at 150 operatives per player.
function fullGame(seed, bots, stName) {
  const st = STYLES[stName], rng = E.seededRng(seed), s = E.newGame(rng), coop = bots.length > 1, done = {}; let ops = 0, raids = 0;
  s.coop = coop;
  const hire = (slot, b) => { ops++; E.createChar(s, rng, draft(s, rng, b), slot); s.screen = 'town'; };
  while (ops < 150 * bots.length) {
    const mp = D.MAPS.find((x) => !s.meta.liberated[x.id] && E.mapUnlocked(s, x)) || (D.MAPS.every((x) => s.meta.liberated[x.id]) ? null : D.MAPS.find((x) => E.mapUnlocked(s, x)));
    if (!mp) break;
    spendResolve(s);
    if (!s.char) hire('char', bots[0]);
    if (coop && !s.char2) hire('char2', bots[1]);
    for (let w = 0; w < bots.length; w++) E.withActor(s, w, () => shop(s, bots[w], st));
    raids++;
    raid(s, rng, bots, st, mp.id, startOf(s, mp.id, st));
    s.coopFallen = null;
    if (s.screen === 'ending') { s.meta.endingSeen = true; s.screen = 'town'; }
    if (s.screen === 'death') { s.screen = 'town'; s.char = null; }
    for (const x of D.MAPS) if (s.meta.liberated[x.id] && !done[x.id]) done[x.id] = { ops: ops / bots.length, raids };
  }
  return done;
}
if (SECTIONS.includes('maps')) {
  const camp = Math.ceil(CAMP / 2);
  console.log(`\n=== Full game (${camp} cells): median raids (operatives per player) to liberate each map in turn, and share that got there ===`);
  for (const [label, bots, st] of [['solo strength', [BUILDS.strength], 'standard'], ['solo agility', [BUILDS.agility], 'standard'], ['solo strength cautious', [BUILDS.strength], 'cautious'], ['co-op str + agi', [BUILDS.strength, BUILDS.agility], 'standard']]) {
    const res = []; for (let k = 0; k < camp; k++) res.push(fullGame(8000 + k, bots, st));
    console.log(label.padEnd(26) + D.MAPS.map((mp) => { const a = res.map((r) => r[mp.id]).filter(Boolean); return `${mp.id} ${a.length ? pct(a.map((x) => x.raids), 0.5) : '-'} (${a.length ? pct(a.map((x) => x.ops), 0.5) : '-'}) ${Math.round(a.length / camp * 100)}%`; }).join('  '));
  }
}
// One operative with one thing given free, against the same seeds without it. Same training throughout, so only the item differs.
function single(give, ranks = 8, b = BUILDS.strAgi, stName = process.env.ITEMSTYLE || 'pusher') {
  const res = [];
  for (let i = 0; i < OPS; i++) {
    const rng = E.seededRng(9000 + i), s = E.newGame(rng), st = STYLES[stName];
    s.meta.training = { hp: ranks, atk: ranks, def: ranks, spd: ranks }; s.meta.cell = ['stash', 'kit', 'cache', 'ledger', 'mentor'];
    E.createChar(s, rng, draft(s, rng, b)); s.screen = 'town';
    let n = 0;
    while (s.screen !== 'death' && s.char && n++ < 25) { shop(s, b, st, { noBuy: true }); if (give) give(s); s.char.hp = E.stats(s).maxHp; raid(s, rng, [b], st, 'garrison', Math.max(...E.insertionsAt(s.char, 'garrison', 0))); }
    res.push(s.outcome && s.screen === 'death' ? s.outcome.sector : s.char ? s.char.deepest : 0);
  }
  return avg(res);
}
if (SECTIONS.includes('items')) {
  const base = single(null), out = [];
  const tryIt = (kind, id, name, give) => out.push({ kind, id, name, v: single(give) });
  for (const p of D.PERKS) tryIt('contraband', p.id, `${p.name} x${STACK}`, (s) => { const c = s.char; if (!c.perks.includes(p.id)) c.perks.push(p.id); c.perkN = c.perkN || {}; c.perkN[p.id] = STACK; });
  for (const i of D.IMPLANTS) tryIt('implant', i.id, i.name, (s) => { if (!s.char.implants.includes(i.id)) s.char.implants.push(i.id); });
  for (const u of D.UPGRADES) tryIt('mod', u.id, u.name, (s) => { if (!s.char.upgrades.includes(u.id)) s.char.upgrades.push(u.id); });
  for (const d of D.BAR.menu) tryIt('drink', d.id, d.name, (s) => { s.char.drink = d.id; });
  for (const [id, t] of Object.entries(D.TRAITS)) {
    const slots = t.group === 'weapon' ? ['ranged', 'melee'] : t.group === 'armor' ? ['chest'] : t.group === 'gadget' ? ['gadget'] : [];
    if (slots.length) tryIt('gear trait', id, t.name, (s) => { for (const k of slots) if (s.char.gear[k]) s.char.gear[k].trait = id; });
  }
  console.log(`\n=== Items: ${OPS} operatives given one thing free (training 8). Mean deepest sector, baseline ${base.toFixed(2)} ===`);
  for (const k of ['contraband', 'implant', 'mod', 'drink', 'gear trait']) {
    console.log(`-- ${k}`);
    for (const r of out.filter((x) => x.kind === k).sort((a, b) => b.v - a.v)) console.log(`  ${r.name.padEnd(32)} ${r.v.toFixed(2).padStart(6)}  ${(r.v - base >= 0 ? '+' : '') + ((r.v / base - 1) * 100).toFixed(0)}%`);
  }
}
if (SECTIONS.includes('early')) {
  console.log(`\n=== Early game: a brand-new cell's first operative (${OPS} each). Where the first raid ended, and how the operative's life went ===`);
  for (const name of ['strength', 'agility', 'intellect', 'charisma', 'balanced']) {
    const b = BUILDS[name], ends = {}, deep = [], raidsLived = []; let firstDeaths = 0;
    for (let i = 0; i < OPS; i++) {
      const rng = E.seededRng(100 + i), s = E.newGame(rng), st = STYLES.standard;
      E.createChar(s, rng, draft(s, rng, b)); s.screen = 'town';
      let n = 0;
      while (s.screen !== 'death' && n < 25) {
        shop(s, b, st); n++;
        raid(s, rng, [b], st, 'garrison', Math.max(...E.insertionsAt(s.char, 'garrison', 0)));
        if (n === 1) { if (s.screen === 'death') { firstDeaths++; ends[s.outcome.sector] = (ends[s.outcome.sector] || 0) + 1; } }
      }
      deep.push(s.screen === 'death' ? s.outcome.sector : s.char.deepest); raidsLived.push(n);
    }
    console.log(`${name.padEnd(11)} first raid fatal ${Math.round(firstDeaths / OPS * 100)}% (sector: ${Object.entries(ends).map(([k, v]) => `${k}:${Math.round(v / OPS * 100)}%`).join(' ')})  median deepest ${pct(deep, 0.5)}, p90 ${pct(deep, 0.9)}, raids lived ${avg(raidsLived).toFixed(1)}`);
  }
}
if (SECTIONS.includes('econ')) {
  const buckets = { '1-5': [], '6-10': [], '11-15': [], '16+': [] };
  for (let k = 0; k < CAMP; k++) {
    const rng = E.seededRng(7000 + k), s = E.newGame(rng), b = BUILDS.strength, st = STYLES.standard;
    for (let life = 0; life < 25; life++) {
      spendResolve(s); E.createChar(s, rng, draft(s, rng, b)); s.screen = 'town'; s.ledger = {};
      let n = 0, maxLeft = 0;
      while (s.screen !== 'death' && n++ < 25) { shop(s, b, st); maxLeft = Math.max(maxLeft, s.char.credits); raid(s, rng, [b], st, 'garrison', Math.max(...E.insertionsAt(s.char, 'garrison', 0))); }
      const deep = s.screen === 'death' ? s.outcome.sector : s.char.deepest, earned = Object.entries(s.ledger).filter(([key, v]) => v > 0 && !key.startsWith('spend')).reduce((t, [, v]) => t + v, 0);
      const key = deep <= 5 ? '1-5' : deep <= 10 ? '6-10' : deep <= 15 ? '11-15' : '16+';
      buckets[key].push({ earned, left: maxLeft, level: s.screen === 'death' ? s.outcome.level : s.char.level });
      if (s.screen === 'death') s.char = null; s.screen = 'town'; s.run = null;
    }
  }
  console.log(`\n=== Economy: per operative, by how deep it got. "Idle" is the most cash it left town with after shopping ===`);
  for (const [k, a] of Object.entries(buckets)) console.log(`deepest ${k.padEnd(6)} ${String(a.length).padStart(4)} ops  earned ${Math.round(avg(a.map((x) => x.earned))).toString().padStart(6)}  idle ${Math.round(avg(a.map((x) => x.left))).toString().padStart(6)}  (${Math.round(avg(a.map((x) => x.left)) / Math.max(1, avg(a.map((x) => x.earned))) * 100)}%)  level ${avg(a.map((x) => x.level)).toFixed(1)}`);
}
