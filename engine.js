// Pure game logic. No DOM access, so the balance simulator can run it in Node.
import * as D from './data.js';
import { BOSS_MOVES, bossLine, bossLines, mapIntro, areaBand, CODEX, codexUnlocked } from './lore.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function pickWeighted(rng, entries) {
  const total = entries.reduce((t, [, w]) => t + w, 0);
  let roll = rng() * total;
  for (const [k, w] of entries) { roll -= w; if (roll < 0) return k; }
  return entries[entries.length - 1][0];
}

export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const VERSION = 4;
export const FIGHTS_PER_SECTOR = 3;
export const FIGHT_DROP = 0.1;  // chance an ordinary fight carries contraband
export const ELITE_DROP = 0.25;   // chance an elite carries contraband (bosses always do)
export const CARRY_CD = 2;       // minimum cooldown a skill used last fight starts the next fight with
export const MIN_FIGHTS = 2; // fights required per sector; the rest of the rooms can be anything
// Enemy growth per sector past their first appearance: linear plus a quadratic tail.
export const growth = (lvl, lin, quad) => 1 + lin * lvl + quad * lvl * lvl;
// Difficulty tiers: the Directorate tightens its grip as the cell goes deeper. Tier 0 through sector 5, tier 1 after sector 5, tier 2 after sector 10.
// hp: enemy HP multiplier; price: multiplier on every credit price.
export const HARD = [
  // hp carries an extra +8% per tier to offset the achievement buffs over a long campaign.
  { hp: 1.18, price: 1.1 },
  { hp: 1.21, price: 1.12 },
  { hp: 1.25, price: 1.15 },
  { hp: 1.3, price: 1.18 },
  { hp: 1.35, price: 1.21 },
  { hp: 1.4, price: 1.24 },
];
// Sectors 1-20 per district; a later district starts as deep as an earlier one's sector 5, 9 or 13 (`offset`).
export const MAX_SECTOR = 20;
export const effSector = (sector, mapId) => sector + ((D.MAPS.find((m) => m.id === mapId) || {}).offset || 0);
export const hardTier = (sector) => (sector > 25 ? 5 : sector > 20 ? 4 : sector > 15 ? 3 : sector > 10 ? 2 : sector > 5 ? 1 : 0);
// Money from rooms, events and sector bonuses grows slower than the sector: deep runs pay more, not five times more.
export const payDepth = (r) => 1.5 * Math.pow(effSector(r.sector, r.map), 0.65);
export const hardAt = (sector) => HARD[hardTier(sector)];
// In a raid the current sector sets the tier; in the yard, the deepest sector the cell has reached.
export const hard = (s) => hardAt(s.run ? s.run.sector : (s.meta && s.meta.bestSector) || 0);
export const TUNE = { tactic: 0.9, relicOdds: 0.35, hpLin: 0.28, hpQuad: 0.003, atkLin: 0.14, atkQuad: 0.002, bossHp: 2.1, bossAtk: 1.4, enemyAtk: 1.8, enemyHp: 2.4, statusRate: 1, smashStr: 1, aimed: 1.5, strHp: 1.5, strAtk: 0.6, agiCrit: 0.05, agiDodge: 0.035, intOverload: 5, chaHesitate: 0.055, chaCredits: 0.05, wanted: 0.025, ambush: 1.5,
  upgradeCost: 60, eliteGear: 0.3, shopLegendary: 0.06, cover: 0.5, agiAtk: 1.2,
  // Enemy strength in sectors 1-5. Nobody levels up during a raid, so a first raid has to be winnable on level-1 stats.
  earlyCurve: [1, 0.95, 0.88, 0.84, 0.85, 0.95, 0.95, 0.95, 0.95, 0.95],
  // Rewards shrink once an operative is more than overFree levels above the sector. reinforce: enemy strength by districts already freed.
  extractFail: 0.15, droneAtk: 1, droneShield: 1, droneHeal: 1, droneTech: 1, overFree: 2, overStep: 0.2, overMin: 0.25, defend: 0.6, defendHeavy: 0.42, smokeEscape: 0.7, priceAll: 1.265, trainBase: 3, trainStep: 1, fightDrop: FIGHT_DROP, eliteDrop: ELITE_DROP, coopCr: 1, repeatPay: 2, reinforce: [0, 0.5, 0.5, 0.35], bossRepeatXp: 0.5, bossRepeatResolve: 1,
  // Field Medic: shield share of max HP (team / alone), team damage buff, its length in rounds, Triage heal, Tag's Exposed, revive HP, stim bonus.
  medShield: 0.2, medShieldSolo: 0.28, rallyAtk: 0.25, rallySolo: 0.3, rallyTurns: 3, triageHeal: 0.22, tagMult: 1, tagSolo: 1.4, tagExposed: 2, medRevive: 0.35, medStim: 0.25,
  bribe: 0.25, huffAt: 0.6, huffHp: 1.3, huffHeal: 0.15, huffAtk: 1.6,
  classHp: { runner: 14, clerk: 16, ghost: 10, medic: 15 }, ghostGuard: 0.92, ghostCrack: 3, overhaulMult: 1.3, overhaulHeal: 0.06, overhaulTear: 2, overhaulTears: 99,
  rangedSpread: 0.15, meleeSpread: 0.3, shootGuard: 0.15, momentum: 0.15, strikeBonus: 0.25, foundryStrike: 0.15, coopHp: 2.1, coopAtk: 1.4, coopExtra: 3, reviveHp: 0.2, reviveAfter: 0.15, downsPerRaid: 1, bleedRounds: 3,
  // Share of unsecured credits and XP lost, by position in the five-sector run to the next boss. Beating the boss secures everything.
  // Chance an extraction falls through, by position before the next boss: safer just after a boss, riskier just before one.
  extractFails: [0.1, 0.13, 0.17, 0.2, 0],
  extractRates: [0.8, 0.65, 0.5, 0.4, 0], escapeRates: [0.9, 0.85, 0.75, 0.65, 0.6],
  itemScale: 0.3, allyGrit: 3 };
export const extractRate = (sector) => TUNE.extractRates[(sector - 1) % 5];
export const escapeRate = (sector) => TUNE.escapeRates[(sector - 1) % 5];
export const isBossSector = (n) => n % 5 === 0;
// Optional credit accounting for the simulators: set s.ledger = {} and every credit gain or spend is tallied by source.
// Credits earned in town go to a debt first. In a raid nothing is taken until the haul is secured (settle), so a debt is never
// paid with money that an extraction would have lost.
// Money earned in town pays the earner's own debt first; a partner's purse is never touched.
const ledger = (s, k, n) => { if (s.ledger && n) s.ledger[k] = (s.ledger[k] || 0) + n; if (n > 0 && !s.run && !String(k).startsWith('spend')) settleDebt(s.char); };
export const mapById = (id) => D.MAPS.find((m) => m.id === id) || D.MAPS[0];
export const sectorName = (n, mapId = 'garrison') => {
  const list = mapById(mapId).sectors, len = list.length;
  const base = list[(n - 1) % len];
  return n > len ? `Sublevel ${Math.ceil(n / len) - 1}: ${base}` : base;
};
export const trainingCost = (level) => Math.ceil((TUNE.trainBase + Math.round(TUNE.trainStep * level)) * 1.1 - 1e-9);
export const xpToNext = (level) => Math.round(20 * Math.pow(1.35, level - 1));
// Armour scales damage down proportionally, so it never makes anyone immune.
export const mitigate = (raw, def) => Math.max(1, Math.round((raw * raw) / (raw + def)));
const has = (c, id) => c.upgrades.includes(id);
const hasImp = (c, id) => c.implants.includes(id);
const hasCell = (m, id) => m.cell.includes(id);
// Levels of the cell's upgrades. Upgrades from older saves count as the level they were equal to.
export const cellLevel = (m, id) => (m.cellLv && m.cellLv[id]) || (m.cell.includes(id) ? D.CELL_LEGACY[id] || 1 : 0);
const cellV = (m, id, none) => { const u = D.CELL.find((x) => x.id === id), lv = cellLevel(m, id); return lv ? u.levels[Math.min(lv, u.levels.length) - 1].v : none; };
export const hasPerk = (c, id) => !!c && (c.perks || []).includes(id);
export const perkById = (id) => D.PERKS.find((p) => p.id === id);
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
// Contraband stacks without limit, with diminishing returns: see per and r in D.PERKS.
export const isRelic = (id) => !!(D.PERKS.find((p) => p.id === id) || {}).relic;
export const perkStacks = (c, id) => (c && c.perkN && c.perkN[id]) || 0;
export function perkValue(id, n) {
  const p = perkById(id), r = p.r || 0.85;
  if (n <= 0) return p.add || 0;
  const v = (p.add || 0) + p.per * (1 - Math.pow(r, n)) / (1 - r);
  return p.whole ? Math.round(v) : +v.toFixed(p.dp || 1);
}
const pv = (c, id) => perkValue(id, perkStacks(c, id));
export const perkName = (id, n) => `${perkById(id).name}${n > 1 ? ` x${n}` : ''}`;
export const perkText = (id, n) => perkById(id).desc.replace('{v}', perkValue(id, n));

// ---------- state ----------
export function newMeta() {
  return { resolve: 0, totalResolve: 0, training: { hp: 0, atk: 0, def: 0, spd: 0 }, cell: [], operatives: 0, bestSector: 0, bestByMap: {},
    fallen: [], contracts: [], liberated: {}, threat: 0, heirloom: null, tips: {}, endingSeen: false, stats: { kills: 0, bosses: 0, raids: 0 }, board: [], boardOut: [], boardV: 2, ship: { hull: 0, guns: 0, shields: 0, engines: 0, cell: [] }, orbitWins: 0, orbitTierWins: {}, feats: { counters: {}, tiers: {}, v: 0 } };
}

// Season 2 (the 20-sector districts) started everyone over. Older saves are set aside by the page, not migrated.
export const SEASON = 2;
// A unique operative opens once the cell has done the thing it asks.
export function bgUnlocked(meta, b) {
  if (!b || !b.unique) return true;
  if ((meta.unlockedOps || []).includes(b.id)) return true; // the balance sims and tests open them directly
  const u = b.unlock || {};
  if (u.kind === 'wheel') return ((meta.wheel || {}).best || 0) >= u.best;
  if (u.kind === 'liberated') return !!(meta.liberated || {})[u.map];
  if (u.kind === 'lounge') return (meta.loungeSpent || 0) >= u.spent;
  return false;
}
export function newGame(rng) {
  const meta = newMeta(); meta.season = SEASON;
  const s = { v: VERSION, meta, char: null, run: null, screen: 'intro', tab: 'market', log: [], notice: null, outcome: null };
  s.draft = newDraft(meta, rng);
  return s;
}

// Older saves keep their permanent progress; the current operative is retired.
export function migrate(s, rng) {
  if (s && s.v === 2 && s.meta) {
    s = migrateV2(s, rng);
  }
  if (s && s.v === 3 && s.meta) {
    // v3 -> v4: single weapon + armour become item instances in six gear slots.
    if (s.char) { migrateGear(s, rng); s.char.spent = {}; }
    s.meta.heirloom = s.meta.heirloom || null;
    if (s.run) { s.run.lootOffer = null; }
    s.v = 4;
    if (s.char) s.notice = 'The Black Market has new stock and your kit now has six slots. Check the Gear tab.';
  }
  if (s && s.v === VERSION) {
    if (s.meta) {
      // The board used to rank single raids. Those rows can't become careers, so they go; operatives appear after their next raid.
      if (s.meta.boardV !== 2) { s.meta.board = []; s.meta.boardOut = []; s.meta.boardMine = []; s.meta.boardV = 2; }
      delete s.meta.boardSeeded; delete s.meta.boardShared;
    }
    if (s.meta && !s.meta.ship) s.meta.ship = { hull: 0, guns: 0, shields: 0, engines: 0, cell: [] };
    // Ventures used to belong to the cell. They're the operative's now, and die with them.
    if (s.meta && s.meta.ventures) { if (s.char && !s.char.ventures) s.char.ventures = s.meta.ventures; delete s.meta.ventures; }
    if (s.meta && !s.meta.feats) s.meta.feats = { counters: {}, tiers: {}, v: 0 };
    // The Lockup used to belong to the cell. It belongs to the operative now: anything on the old shelf goes to the current one.
    if (s.meta && s.meta.lockup) { if (s.char) s.char.lockup = [...(s.char.lockup || []), ...s.meta.lockup]; delete s.meta.lockup; }
    s.trade = null;
    for (const c of [s.char, s.char2]) if (c && !c.uid) c.uid = newUid();
    // Drones went from 5 ranks to 8: each old rank moves to the new one of about the same strength.
    if (s.meta && s.meta.droneV !== 2) {
      const up = (r) => D.DRONE_RANK_V2[Math.max(1, Math.min(5, r || 1))];
      for (const k of Object.keys(s.meta.droneRanks || {})) s.meta.droneRanks[k] = up(s.meta.droneRanks[k]);
      for (const c of [s.char, s.char2]) if (c && c.drone) c.drone.rank = up(c.drone.rank);
      s.meta.droneV = 2;
    }
    // Contraband tiers became stacks: a tier I piece is one copy, tier IV four. Pieces from before tiers counted as tier III.
    for (const c of [s.char, s.char2]) if (c && !c.perkN) { c.perkN = {}; for (const id of c.perks || []) c.perkN[id] = ((c.perkLv && c.perkLv[id]) ?? 2) + 1; delete c.perkLv; }
    // A partner's operative left in the host's save from before characters travelled: it goes back to them when they next join.
    if (s.char2 && !s.run) s.char2Held = true;
    // Orbit wins from before tiers were tracked count as low-orbit wins, so older cells keep the blockade line open.
    if (s.meta && !s.meta.orbitTierWins) s.meta.orbitTierWins = s.meta.orbitWins ? { low: s.meta.orbitWins } : {};
    for (const k of (s.meta && s.meta.contracts) || []) if (!k.done) k.credits = contractCredits(k.kind, k.n);
    return s;
  }
  return migrateOld(s, rng);
}
function migrateGear(s, rng) {
  const c = s.char, g = starterGear(null);
  const w = D.GEAR[c.weapon], a = D.GEAR[c.armor];
  if (w && (w.slot === 'ranged' || w.slot === 'melee')) g[w.slot] = makeItem(c.weapon);
  if (a && a.slot === 'chest') g.chest = makeItem(c.armor);
  c.gear = g;
  delete c.weapon; delete c.armor;
  restockMarket(s, rng);
}
function migrateV2(s, rng) {
  {
    // v2 -> v3: keep everything, add the new systems, call off any raid in progress.
    const fresh = newMeta();
    for (const k of Object.keys(fresh)) if (s.meta[k] === undefined) s.meta[k] = fresh[k];
    if (s.char) s.char.perks = s.char.perks || [];
    if (s.run) { s.run = null; s.notice = 'The cell has new intel on the Directorate. Your last raid was called off; you kept what you carried.'; }
    s.screen = s.char ? 'town' : 'create';
    if (!s.char && !s.draft) s.draft = newDraft(s.meta, rng);
    s.tab = 'gate';
    refreshContracts(s, rng);
    s.v = 3;
    return s;
  }
}
function migrateOld(s, rng) {
  const fresh = newGame(rng);
  if (s && s.meta) {
    const m = s.meta;
    Object.assign(fresh.meta, { resolve: m.resolve || 0, totalResolve: m.totalResolve || 0, training: m.training || fresh.meta.training, operatives: m.operatives || 0, bestSector: m.bestSector || 0, fallen: m.fallen || [] });
    fresh.meta.bestByMap.garrison = m.bestSector || 0;
    fresh.draft = newDraft(fresh.meta, rng);
    fresh.screen = 'create';
    fresh.notice = 'The cell has new ways to fight. Your training and Resolve carried over. Build a new operative.';
  }
  return fresh;
}

// ---------- co-op: two operatives in one cell ----------
// s.char is the host's operative, s.char2 the friend's. The engine always acts on s.char, so to act as the
// friend we swap the two references (and the per-operative combat fields in s.run) for the duration of a call.
// Saves are always written with s.actorIdx === 0, so the swap never leaks into a save.
const BAG = ['card', 'suit', 'pst', 'pfresh', 'defending', 'ready', 'momentum', 'keepDistance', 'struck', 'cooldowns', 'usedThisFight', 'adrenalUsed', 'deadmanUsed', 'lootOffer', 'perkOffer'];
const freshBag = () => ({ card: null, suit: null, pst: {}, pfresh: [], defending: false, ready: false, momentum: false, keepDistance: false, struck: false, cooldowns: {}, usedThisFight: [], adrenalUsed: false, deadmanUsed: false, lootOffer: null, perkOffer: null });
const saveBag = (r) => { const b = {}; for (const k of BAG) b[k] = r[k]; return b; };
const loadBag = (r, b) => { for (const k of BAG) r[k] = b[k]; };
export const isCoop = (s) => !!(s.coop && s.char && s.char2);
export const charAt = (s, i) => ((s.actorIdx || 0) === i ? s.char : s.char2) || null;
const aliveAt = (s, i) => { const c = charAt(s, i); return !!c && !c.dead && !c.downed; };
export const actorIdx = (s) => s.actorIdx || 0;
export function setActor(s, i) {
  const cur = s.actorIdx || 0;
  if (cur === i) return;
  const r = s.run;
  if (r && r.cb) { r.cb[cur] = saveBag(r); loadBag(r, r.cb[i] || freshBag()); }
  const t = s.char; s.char = s.char2; s.char2 = t;
  s.actorIdx = i;
}
export function withActor(s, i, fn) {
  const prev = s.actorIdx || 0;
  if (!s.char2 || i === prev) return fn();
  setActor(s, i);
  try { return fn(); } finally { if (s.char2 !== undefined) setActor(s, prev); }
}
// Run fn as each living operative in turn (host first).
export function forEachActor(s, fn) {
  for (const i of isCoop(s) ? [0, 1] : [actorIdx(s)]) if (aliveAt(s, i)) withActor(s, i, () => fn(s.char, i));
}
export const livingActors = (s) => (isCoop(s) ? [0, 1] : [actorIdx(s)]).filter((i) => aliveAt(s, i));
// Which operative the enemy goes for: usually whoever hurt it most this round, sometimes the other one.
function pickTarget(s, rng) {
  const r = s.run, alive = livingActors(s);
  if (alive.length === 1) return alive[0];
  const d = r.dealt || {}, a = alive[0], b = alive[1];
  const hot = (d[a] || 0) === (d[b] || 0) ? pick(rng, alive) : (d[a] || 0) > (d[b] || 0) ? a : b;
  return rng() < 0.65 ? hot : alive.find((i) => i !== hot);
}

// ---------- character creation ----------
export function newDraft(meta, rng) {
  const female = rng() < 0.5;
  return {
    name: pick(rng, D.OPERATIVE_NAMES), background: 'foundry', step: 1, drone: 'hornet',
    look: { body: female ? 'body_f1' : 'body_m1', hair: female ? 'hair_long_tied' : 'hair_short', skin: randInt(rng, 0, 5), hairColor: randInt(rng, 0, 5) },
    attrs: { str: D.ATTR_START, agi: D.ATTR_START, int: D.ATTR_START, cha: D.ATTR_START },
    points: D.ATTR_POINTS + cellV(meta, 'mentor', 0),
  };
}
export const draftAttr = (draft, k) => draft.attrs[k] + (D.BACKGROUNDS.find((b) => b.id === draft.background).attrs[k] || 0);
export function draftAdjust(draft, k, delta) {
  const v = draft.attrs[k] + delta;
  if (delta > 0 && (draft.points <= 0 || draftAttr(draft, k) >= D.ATTR_CREATE_MAX)) return false;
  if (delta < 0 && v < D.ATTR_START) return false;
  draft.attrs[k] = v; draft.points -= delta;
  return true;
}

// Identifies an operative across saves, so a co-op partner's copy can be matched up with the real one.
const newUid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
export function createChar(s, rng, draft = null, slot = 'char') {
  const m = s.meta, d = draft || s.draft;
  if (!bgUnlocked(m, D.BACKGROUNDS.find((b) => b.id === d.background))) d.background = 'foundry';
  const bg = D.BACKGROUNDS.find((b) => b.id === d.background);
  m.operatives += 1;
  const attrs = {};
  for (const k of Object.keys(D.ATTRS)) attrs[k] = draftAttr(d, k);
  const c = {
    uid: newUid(), name: (d.name || '').trim().slice(0, 24) || pick(rng, D.OPERATIVE_NAMES), number: m.operatives, background: bg.id,
    attrs, attrPoints: d.points, level: 1, xp: 0, credits: 25 + (bg.start.credits || 0) + cellV(m, 'stash', 0),
    gear: starterGear(m), market: [],
    items: { stim: 2, thermal: 0, ion: 0, smoke: 0 }, upgrades: [], implants: [],
    maps: {}, deepest: 0, hp: 1, history: [], perks: [], perkN: {}, lockup: [], xpBank: 0, look: d.look || null,
    drone: { type: D.DRONES[d.drone] ? d.drone : 'hornet', rank: droneRankOf(m, d.drone), damaged: false },
  };
  for (const k of ['smoke', 'ion', 'stim']) if (bg.start[k]) c.items[k] += bg.start[k];
  c.gear = startingGear(m, bg.id);
  { const kit = cellV(m, 'kit', [0, 0]); c.items.stim += kit[0]; c.items.thermal += kit[1]; }
  c.hp = statsOf(m, c).maxHp;
  let heir = '';
  if (m.heirloom && canEquip(c, m.heirloom)) {
    // The heirloom takes its slot; whatever the background or Weapons Cache put there is not kept.
    const it = m.heirloom, sl = baseOf(it).slot, was = c.gear[sl];
    m.heirloom = null; c.gear[sl] = it; c.hp = statsOf(m, c).maxHp;
    heir = ` The heirloom ${itemName(it)} comes out of the locker with them${was ? ` (in place of the starting ${baseOf(was).name})` : ''}.`;
  }
  if (slot === 'char2') {
    // The friend's operative: created from a draft they sent, without touching the host's screen.
    s.char2 = c;
    withActor(s, 1, () => restockMarket(s, rng));
    refreshContracts(s, rng);
    journal(s, `${c.name} joins the cell.`, 'sys');
    return c;
  }
  s.char = c; if (!draft) s.draft = null;
  restockMarket(s, rng);
  refreshContracts(s, rng);
  s.screen = 'town'; s.tab = 'gate';
  s.notice = `${c.name} takes the empty bunk.${heir} Gear up, then take a mission at the freight terminal.`;
  return c;
}

// ---------- gear: item instances ----------
// An item is { base, rarity, level, bonuses: [{ k, v }], trait, spent }. Bases live in D.GEAR.
export const ELITE_GEAR_DROP = 0.3; // chance an elite drops a piece of gear (bosses always do)
export const MARKET_SIZE = 6;
export const baseOf = (it) => (it ? D.GEAR[it.base] : null);
export const gearIn = (c, slot) => (c && c.gear && c.gear[slot]) || null;
export const weaponOf = (c) => baseOf(gearIn(c, 'ranged')) || D.GEAR.holdout;
export const meleeOf = (c) => baseOf(gearIn(c, 'melee')) || D.GEAR.knife;
export const armorOf = (c) => baseOf(gearIn(c, 'chest')) || D.GEAR.none;
const traitGroup = (slot) => (slot === 'ranged' || slot === 'melee' ? 'weapon' : slot === 'gadget' ? 'gadget' : 'armor');
const isWeaponSlot = (slot) => slot === 'ranged' || slot === 'melee';

function rollBonus(k, b, rng) {
  const [lo, hi] = D.BONUSES[k].range, scale = 1 + 0.1 * Math.max(0, (b.tier || 1) - 1);
  return { k, v: Math.max(1, Math.round((lo + rng() * (hi - lo)) * scale)) };
}
function bonusPool(b, it) {
  return Object.keys(D.BONUSES).filter((k) => D.BONUSES[k].slots.includes(b.slot) && !(k === 'droid' && b.droid) && !it.bonuses.some((x) => x.k === k));
}
export function makeItem(baseId, rarity = 'common', rng = null) {
  const b = D.GEAR[baseId];
  if (b.unique) rarity = 'unique';
  const it = { base: baseId, rarity, level: 0, bonuses: (b.bonuses || []).map(([k, v]) => ({ k, v, fixed: true })), trait: null, spent: 0 };
  const R = D.RARITY[rarity];
  if (rng) {
    for (let i = 0; i < R.bonuses; i++) { const pool = bonusPool(b, it); if (!pool.length) break; it.bonuses.push(rollBonus(pick(rng, pool), b, rng)); }
    if (R.trait) it.trait = pick(rng, Object.keys(D.TRAITS).filter((t) => D.TRAITS[t].group === traitGroup(b.slot)));
  }
  return it;
}
// Starter kit plus the background's piece, which replaces a plain starter (a Weapons Cache piece is better, so it stays).
export function startingGear(meta, bgId) {
  const g = starterGear(meta), bg = D.BACKGROUNDS.find((b) => b.id === bgId);
  for (const [slot, id] of Object.entries((bg && bg.start.gear) || {})) if (!g[slot] || D.GEAR[g[slot].base].tier === 0) g[slot] = makeItem(id);
  return g;
}
export function starterGear(meta) {
  const g = {};
  for (const [slot, id] of Object.entries(D.STARTER_GEAR)) g[slot] = id ? makeItem(id) : null;
  if (meta && cellV(meta, 'cache', 0) >= 1) g.melee = makeItem('baton');
  if (meta && cellV(meta, 'cache', 0) >= 2) g.ranged = makeItem('carbine');
  return g;
}
// Main stat (ATK for weapons, DEF for armour) after rarity and upgrades. Each upgrade adds 8% (at least +1).
export const upgradeGain = (it) => { const b = baseOf(it), key = b.atk !== undefined ? 'atk' : b.def !== undefined ? 'def' : null; return key && b[key] > 0 ? Math.max(1, Math.round(b[key] * D.RARITY[it.rarity].mult * D.UPGRADE_STEP)) : 0; };
export function mainStat(it) {
  if (!it) return null;
  const b = baseOf(it), key = b.atk !== undefined ? 'atk' : b.def !== undefined ? 'def' : null;
  if (!key) return null;
  return { key, v: Math.round(b[key] * D.RARITY[it.rarity].mult) + it.level * upgradeGain(it) };
}
export const itemName = (it) => `${baseOf(it).name}${it.level ? ` +${it.level}` : ''}`;
export const itemPrice = (it) => Math.round(baseOf(it).cost * D.RARITY[it.rarity].price) + (it.premium || 0);
export const sellValue = () => 0; // gear is never sold: the fence doesn't buy, he only sells
export const canUpgrade = (it, t = 0) => !!it && upgradeGain(it) > 0 && it.level < upgradeMax(t);
export const upgradeCost = (it) => Math.round(TUNE.upgradeCost * upgradeGain(it) * (it.level + 1) * D.RARITY[it.rarity].up);
export const canReroll = (it) => !!it && it.bonuses.some((x) => !x.fixed);
export const rerollCost = (it) => Math.round((40 + baseOf(it).cost * 0.15) * D.RARITY[it.rarity].up);
export const bonusText = (x) => D.BONUSES[x.k].label.replace('{v}', x.v);

// Bonus totals. Weapon bonuses only count for attacks with that weapon (mode 'ranged' or 'melee');
// everything else (armour, gadget, and character-wide bonuses like credits) always counts.
const WIDE = new Set(['healkill', 'cooldown', 'credits', 'resist', 'hp', 'def', 'spd']);
export function gearBonus(c, k, mode = null) {
  let t = 0;
  for (const slot of D.SLOT_ORDER) {
    const it = gearIn(c, slot);
    if (!it) continue;
    if (isWeaponSlot(slot) && !WIDE.has(k) && slot !== mode) continue;
    for (const x of it.bonuses) if (x.k === k) t += x.v;
  }
  return t;
}
export const hasTrait = (c, t, slot = null) => (slot ? [slot] : D.SLOT_ORDER).some((sl) => { const it = gearIn(c, sl); return it && it.trait === t; });
export const hasUnique = (c, u) => D.SLOT_ORDER.some((sl) => { const b = baseOf(gearIn(c, sl)); return b && b.unique === u; });
const gearFlag = (c, f) => D.SLOT_ORDER.some((sl) => { const b = baseOf(gearIn(c, sl)); return b && b[f]; });
export const canEquip = (c, it) => !!it && meetsReq(c, baseOf(it).req);

// Pick a random item. tierMin/tierMax bound the base tier (higher tiers weighted up), odds is { rarity: weight }.
const SLOT_WEIGHT = { ranged: 2, melee: 1.5, head: 1, chest: 1.5, legs: 1, gadget: 0.7 };
export function rollGear(rng, { slot = null, tierMin = 1, tierMax = 6, odds, filter = null }) {
  const sl = slot || (filter ? null : pickWeighted(rng, Object.entries(SLOT_WEIGHT)));
  const ok = (b) => (!sl || b.slot === sl) && !b.unique && b.tier >= 1 && (!filter || filter(b));
  let bases = Object.keys(D.GEAR).filter((id) => { const b = D.GEAR[id]; return ok(b) && b.tier >= tierMin && b.tier <= tierMax; });
  if (!bases.length) bases = Object.keys(D.GEAR).filter((id) => ok(D.GEAR[id]) && D.GEAR[id].tier <= Math.max(tierMax, 2));
  if (!bases.length) bases = Object.keys(D.GEAR).filter((id) => D.GEAR[id].slot === (sl || 'ranged') && !D.GEAR[id].unique && D.GEAR[id].tier >= 1);
  const id = pickWeighted(rng, bases.map((x) => [x, D.GEAR[x].tier]));
  return makeItem(id, pickWeighted(rng, Object.entries(odds)), rng);
}
// Black Market rarity odds improve with the cell's deepest sector.
export function shopOdds(meta, c = null) {
  const b = c ? opDepth(c) : meta.bestSector || 0;
  const legendary = Math.min(TUNE.shopLegendary, 0.004 * b), elite = Math.min(0.16, 0.03 + 0.008 * b), rare = Math.min(0.32, 0.2 + 0.008 * b);
  return { common: 1 - legendary - elite - rare, rare, elite, legendary };
}
export const shopBand = (meta, c = null) => clamp(1 + Math.floor((c ? opDepth(c) : meta.bestSector || 0) / 3), 1, 6);
// v5 shop scaling: the floor rises with the band (no more tier-1 junk at sector 12), and past sector 5 Marrow sells
// pieces already worked on his bench (+1 per 5 sectors, up to +3), priced at 85% of what those upgrades would cost.
export const shopFloor = (meta, c = null) => Math.max(1, shopBand(meta, c) - 2);
// Past tier 6 the gear itself stops getting better, so Marrow's bench work keeps climbing: deeper ground and higher threat sell higher +levels.
export const shopLevel = (meta, c = null) => clamp(Math.floor((c ? opDepth(c) : meta.bestSector || 0) / 5), 0, upgradeMax(opThreat(c)) - 1);
function benchWork(it, lvl) {
  let premium = 0;
  for (let i = 0; i < lvl && canUpgrade(it); i++) { premium += upgradeCost(it); it.level += 1; }
  if (premium) it.premium = Math.round(premium * 0.85);
  return it;
}
export function restockMarket(s, rng) {
  const c = s.char, odds = shopOdds(s.meta, c), band = shopBand(s.meta, c), lo = shopFloor(s.meta, c), lvl = shopLevel(s.meta, c);
  const slots = ['ranged', 'melee', 'head', 'chest', 'legs'];
  c.market = slots.map((slot) => rollGear(rng, { slot, tierMin: lo, tierMax: band, odds }));
  // The sixth piece suits the operative's best attribute (Marrow knows what you like), or is a gadget.
  const top = Object.keys(D.ATTRS).sort((a, b) => attr(c, b) - attr(c, a))[0];
  c.market.push(rng() < 0.7 ? rollGear(rng, { tierMin: lo, tierMax: band, odds, filter: (b) => b.req && b.req[top] && b.req[top] <= Math.max(attr(c, top), 3) + 2 }) : rollGear(rng, { slot: 'gadget', tierMin: 1, tierMax: band, odds }));
  if (lvl) c.market = c.market.map((it) => (rng() < 0.6 ? benchWork(it, lvl - (rng() < 0.4 ? 1 : 0)) : it));
}
// Gear dropped by an elite or boss in this sector.
function rollLoot(s, rng, e) {
  const c = s.char, r = s.run, eff = effSector(r.sector, r.map) + THREAT_DEPTH * (r.threat || 0), band = clamp(Math.ceil(eff / 3), 1, 6);
  if (e.boss) {
    const u = D.BOSS_UNIQUE[e.id];
    if (u && !hasUnique(c, D.GEAR[u].unique)) return makeItem(u);
    return rollGear(rng, { tierMin: band - 1, tierMax: band, odds: { elite: 0.6, legendary: 0.4 } });
  }
  if (e.elite && rng() < TUNE.eliteGear * (r.cond === 'hunters' ? 2 : 1)) return rollGear(rng, { tierMin: band - 1, tierMax: band, odds: { rare: 0.55, elite: 0.35, legendary: 0.1 } });
  return null;
}

function equip(s, it, verb) {
  const c = s.char, slot = baseOf(it).slot, old = gearIn(c, slot), hpBefore = stats(s).maxHp;
  c.gear[slot] = it;
  const after = stats(s).maxHp;
  c.hp = after > hpBefore ? c.hp + (after - hpBefore) : Math.min(c.hp, after);
  c.hp = Math.max(1, c.hp);
  return old;
}
// Buy from the Black Market. The piece it replaces is gone: Marrow doesn't buy, he only sells.
export const netPrice = (s, it) => price(s, itemPrice(it));
export function buyGear(s, idx, stash = false) {
  const c = s.char, it = c.market && c.market[idx];
  if (!it || !canEquip(c, it) || c.credits < netPrice(s, it)) return false;
  const cost = netPrice(s, it);
  c.credits -= cost; ledger(s, 'spend:gear', cost);
  c.market.splice(idx, 1);
  const old = equip(s, it);
  if (old && stash && lockupFree(s) > 0) {
    shelf(c).push(old);
    s.notice = `Bought ${itemName(it)}. The old ${itemName(old)} goes in the Lockup.`;
    return true;
  }
  s.notice = `Bought ${itemName(it)}.${old && baseOf(old).tier > 0 ? ` The old ${itemName(old)} goes on the scrap heap.` : ''}`;
  return true;
}
export function upgradeItem(s, slot) {
  const c = s.char, it = gearIn(c, slot);
  if (!canUpgrade(it, opThreat(c))) return false;
  const cost = price(s, upgradeCost(it));
  if (c.credits < cost) return false;
  const hpBefore = stats(s).maxHp;
  c.credits -= cost; it.level += 1; it.spent = (it.spent || 0) + cost; ledger(s, 'spend:upgrades', cost); feat(s, 'upgrades');
  c.hp = Math.min(c.hp, stats(s).maxHp, Math.max(c.hp, hpBefore));
  s.notice = `${itemName(it)}: ${mainStat(it).key.toUpperCase()} now ${mainStat(it).v}.`;
  return true;
}
export function rerollBonus(s, slot, idx, rng) {
  const c = s.char, it = gearIn(c, slot), x = it && it.bonuses[idx];
  if (!x || x.fixed) return false;
  const cost = price(s, rerollCost(it));
  if (c.credits < cost) return false;
  const b = baseOf(it), pool = bonusPool(b, it);
  if (!pool.length) return false;
  c.credits -= cost; it.spent = (it.spent || 0) + cost; ledger(s, 'spend:rerolls', cost);
  const before = bonusText(x);
  it.bonuses[idx] = rollBonus(pick(rng, pool), b, rng);
  s.notice = `${before} became ${bonusText(it.bonuses[idx])}.`;
  return true;
}
// Loot drop after a fight: take it (the old piece is left behind) or leave it.
export function takeLoot(s, rng, who = actorIdx(s), stashOld = false) {
  return withActor(s, who, () => takeLootInner(s, rng, stashOld));
}
function takeLootInner(s, rng, stashOld) {
  const r = s.run, c = s.char, it = r && r.lootOffer;
  if (!it || !canEquip(c, it)) return false;
  const old = equip(s, it), keep = stashOld && old && baseOf(old).tier > 0 && lockupFree(s) > 0;
  if (keep) (c.lockup = c.lockup || []).push(old);
  r.lootOffer = null;
  log(s, `You take the ${itemName(it)}.${keep ? ` The ${itemName(old)} goes to your Lockup.` : old && baseOf(old).tier > 0 ? ` The ${itemName(old)} stays on the floor.` : ''}`, 'reward');
  afterLoot(s, rng);
  return true;
}
export function leaveLoot(s, rng) {
  const r = s.run, it = r && r.lootOffer;
  if (!it) return false;
  r.lootOffer = null;
  log(s, `You leave the ${itemName(it)} where it fell.`, 'info');
  afterLoot(s, rng);
  return true;
}
export const sellLoot = leaveLoot;
// Send a drop to the Lockup, to use later or once you meet its requirements. It's there when you get home, and it dies with you.
export function stashLoot(s, rng, who = actorIdx(s)) {
  return withActor(s, who, () => {
    const r = s.run, c = s.char, it = r && r.lootOffer;
    if (!it || lockupFree(s) <= 0) return false;
    (c.lockup = c.lockup || []).push(it);
    r.lootOffer = null;
    log(s, `The ${itemName(it)} goes to your Lockup.`, 'reward');
    afterLoot(s, rng);
    return true;
  });
}

// ---------- the Lockup and trading ----------
// The Lockup: an operative's spare gear under the safehouse floor. It dies with them: only the one heirloom passes on.
// Whatever is in it isn't helping on a raid. Drops can be sent to it from the field; taking things out is town only.
const LOCKUP_BASE = 4, LOCKUP_STEP = 2;
export const lockupCap = (m) => LOCKUP_BASE + (hasCell(m, 'lockup1') ? LOCKUP_STEP : 0) + (hasCell(m, 'lockup2') ? LOCKUP_STEP : 0);
export const lockupFree = (s, c = s.char) => lockupCap(s.meta) - ((c && c.lockup) || []).length;
const shelf = (c) => c.lockup || (c.lockup = []);
function setGear(s, slot, it) {
  const c = s.char, old = gearIn(c, slot), before = stats(s).maxHp;
  c.gear[slot] = it;
  const after = stats(s).maxHp;
  c.hp = Math.max(1, after > before ? c.hp + (after - before) : Math.min(c.hp, after));
  return old;
}
export function lockupStore(s, slot) {
  const it = gearIn(s.char, slot);
  if (s.run || !it || lockupFree(s) <= 0) return false;
  setGear(s, slot, null);
  shelf(s.char).push(it);
  s.notice = `${itemName(it)} goes in the Lockup.`;
  return true;
}
// Equip a stored piece; what it replaces takes its place on the shelf. base guards against the shelf having shifted
// since the player's screen last updated.
export function lockupTake(s, idx, base = null) {
  const list = shelf(s.char), it = list[idx];
  if (s.run || !it || (base && it.base !== base) || !canEquip(s.char, it)) return false;
  const old = equip(s, it);
  if (old) list[idx] = old; else list.splice(idx, 1);
  s.notice = `You take the ${itemName(it)}${old ? ` and shelve the ${itemName(old)}` : ''}.`;
  return true;
}
export function lockupScrap(s, idx, base = null) {
  const list = shelf(s.char), it = list[idx];
  if (s.run || !it || (base && it.base !== base)) return false;
  list.splice(idx, 1);
  s.notice = `${itemName(it)} goes on the scrap heap.`;
  return true;
}
const tradeSide = () => ({ credits: 0, slots: [], ok: false });
// Why this exchange can't happen, or null. Operatives have no bag: a piece they receive goes on, and the piece it
// replaces (or one they can't use yet) goes to the Lockup, so the shelf needs room for those.
export function tradeProblem(s, offers) {
  const c = [charAt(s, 0), charAt(s, 1)];
  if (!c[0] || !c[1]) return 'Your partner has no operative yet.';
  const shelved = [0, 0];
  for (const i of [0, 1]) {
    const o = offers[i], r = c[1 - i], other = offers[1 - i];
    if (o.credits > c[i].credits) return `${c[i].name} doesn\u2019t have ${o.credits} ${D.SETTING.cur} any more.`;
    for (const slot of o.slots) {
      const it = gearIn(c[i], slot);
      if (!it) return 'One of those pieces has moved.';
      if (!canEquip(r, it)) shelved[1 - i] += 1;
      else if (gearIn(r, slot) && !other.slots.includes(slot)) shelved[1 - i] += 1;
    }
  }
  for (const i of [0, 1]) {
    const free = lockupFree(s, c[i]);
    if (shelved[i] > free) return `That sends ${shelved[i]} replaced piece${shelved[i] > 1 ? 's' : ''} to ${c[i].name.split(' ')[0]}\u2019s Lockup, which has room for ${free}. Clear a shelf first.`;
  }
  return null;
}
function tradeApply(s, offers) {
  const c = [charAt(s, 0), charAt(s, 1)], moving = [], said = [];
  for (const i of [0, 1]) {
    const o = offers[i], give = [];
    if (o.credits > 0) { c[i].credits -= o.credits; c[1 - i].credits += o.credits; give.push(`${o.credits} ${D.SETTING.cur}`); }
    withActor(s, i, () => { for (const slot of o.slots) { const it = setGear(s, slot, null); moving.push({ to: 1 - i, slot, it }); give.push(itemName(it)); } });
    if (give.length) said.push(`${c[i].name.split(' ')[0]} hands over ${give.join(' and ')}`);
  }
  for (const m of moving) withActor(s, m.to, () => {
    if (!canEquip(s.char, m.it)) { shelf(s.char).push(m.it); return; }
    const old = setGear(s, m.slot, m.it);
    if (old) shelf(s.char).push(old);
  });
  s.sharedToast = `${said.join('. ') || 'Nothing changes hands'}.`;
}
// The friend is gone for good from this raid (they left, or the host carries on without them).
export function partnerGone(s) {
  const r = s.run, pc = charAt(s, 1);
  if (r && r.fallen) {
    // The friend left while one of them was dead. A dead host has nobody left to get them out; a dead friend just stops counting.
    if (r.fallen.idx === 0) { s.outcome = r.fallen.record; s.run = null; s.screen = 'death'; return; }
    r.fallen = null;
  }
  if (pc && pc.downed) { pc.downed = 0; pc.hp = 1; }
  if (r) { if (r.cb && r.cb[1]) { r.cb[1].lootOffer = null; r.cb[1].perkOffer = null; } r.votes = null; r.exitVotes = null; r.actor = 0; r.acted = {}; }
}
// The host skips a dropped friend's reward choice so the raid can go on.
export function skipPartnerReward(s, rng) {
  const r = s.run;
  if (!r || !r.cb || !r.cb[1]) return;
  r.cb[1].lootOffer = null; r.cb[1].perkOffer = null;
  if (['loot', 'perk'].includes(s.screen) && !rewardsPending(s)) offerRoute(s, rng);
}
// A partner's operative arrives in the host's game. Their stock comes with them, or a fresh one if they have none.
export function joinPartner(s, rng, char, home) {
  s.char2 = char; if (home) char.home = home;
  s.char2Held = false;
  if (!(char.market && char.market.length)) { const on = s.coop; s.coop = true; withActor(s, 1, () => restockMarket(s, rng)); s.coop = on; }
}
const canTrade = (s) => isCoop(s) && !s.run;
export function giveCredits(s, who, n) {
  const c = charAt(s, who);
  if (!canTrade(s) || !c) return false;
  n = Math.min(Math.floor(n), c.credits);
  if (n <= 0) return false;
  const offers = [tradeSide(), tradeSide()];
  offers[who].credits = n;
  tradeApply(s, offers);
  return true;
}
// Returns null when done, or the reason it can't happen.
export function giveGear(s, who, slot) {
  if (!canTrade(s)) return 'Not now.';
  const offers = [tradeSide(), tradeSide()];
  offers[who].slots = [slot];
  const why = tradeProblem(s, offers);
  if (why) return why;
  tradeApply(s, offers);
  return null;
}
// A trade: one asks, the other answers, both build their offer, both accept. Any change clears both acceptances.
export function tradeAsk(s, who) {
  if (!canTrade(s) || s.trade) return false;
  s.trade = { from: who, open: false, offers: [tradeSide(), tradeSide()] };
  return true;
}
export function tradeAnswer(s, who, yes) {
  const t = s.trade;
  if (!t || t.open || t.from === who) return false;
  if (yes) t.open = true;
  else { s.trade = null; s.sharedToast = `${charAt(s, who).name.split(' ')[0]} isn\u2019t trading right now.`; }
  return true;
}
export function tradeCancel(s, who) {
  if (!s.trade) return false;
  const wasOpen = s.trade.open;
  s.trade = null;
  if (wasOpen) s.sharedToast = `${charAt(s, who).name.split(' ')[0]} called off the trade.`;
  return true;
}
const tradeTouched = (t) => { t.offers[0].ok = false; t.offers[1].ok = false; };
export function tradeCredits(s, who, delta) {
  const t = s.trade, c = charAt(s, who);
  if (!t || !t.open || !c) return false;
  const o = t.offers[who];
  o.credits = delta === 'all' ? c.credits : Math.max(0, Math.min(c.credits, o.credits + Math.floor(+delta || 0)));
  tradeTouched(t);
  return true;
}
export function tradeSlot(s, who, slot) {
  const t = s.trade, c = charAt(s, who);
  if (!t || !t.open || !c || !gearIn(c, slot)) return false;
  const o = t.offers[who];
  o.slots = o.slots.includes(slot) ? o.slots.filter((x) => x !== slot) : [...o.slots, slot];
  tradeTouched(t);
  return true;
}
export function tradeAccept(s, who) {
  const t = s.trade;
  if (!t || !t.open) return false;
  if (tradeProblem(s, t.offers)) { tradeTouched(t); return false; }
  t.offers[who].ok = !t.offers[who].ok;
  if (t.offers[0].ok && t.offers[1].ok) { s.trade = null; tradeApply(s, t.offers); }
  return true;
}
// Each player chooses their own loot and contraband; the raid moves on once nobody has a choice left.
const offerOf = (s, i) => { const r = s.run, b = i === actorIdx(s) ? r : (r.cb && r.cb[i]); return !!b && !!(b.lootOffer || b.perkOffer); };
export const rewardsPending = (s) => !!s.run && (isCoop(s) ? livingActors(s).some((i) => offerOf(s, i)) : !!(s.run.lootOffer || s.run.perkOffer));
function afterLoot(s, rng) {
  if (isCoop(s)) { if (rewardsPending(s)) s.screen = 'loot'; else offerRoute(s, rng); return; }
  if (s.run.perkOffer) s.screen = 'perk'; else offerRoute(s, rng);
}

// Heirloom (cell upgrade): on death, pick one piece to leave for the next operative.
// Any piece that isn't plain stock qualifies: bought gear, and starter gear that was upgraded, rerolled or found at a
// better rarity. Stock Weapons Cache issue (a plain carbine or baton) is skipped when the cell owns the cache, since the
// next operative is handed one anyway.
export function heirloomWorthy(m, it) {
  if (!it || !baseOf(it)) return false;
  // Upgrades don't pass down, so only what the piece is underneath counts.
  const stock = (it.rarity || 'common') === 'common' && !(it.bonuses || []).length && !it.trait;
  if (stock && baseOf(it).tier === 0) return false;
  if (stock && hasCell(m, 'cache') && ['carbine', 'baton'].includes(it.base)) return false;
  return true;
}
const heirloomValue = (it) => (baseOf(it).tier || 0) * 10 + D.RARITY_ORDER.indexOf(it.rarity || 'common') * 6 + (it.bonuses || []).length * 2 + (it.trait ? 3 : 0);
// A passed-down piece keeps its rarity and bonuses but comes back to base level.
const asHeirloom = (it) => { const h = JSON.parse(JSON.stringify(it)); h.level = 0; h.spent = 0; delete h.premium; return h; };
// One piece passes on: anything worn, or anything in that operative's Lockup. Keys: a slot name, or lockup:<index>.
export function heirloomChoices(s) {
  const c = s.char;
  if (!c || !((c.home && c.home.cell) || s.meta.cell).includes('heirloom')) return [];
  return [...D.SLOT_ORDER.map((sl) => [sl, gearIn(c, sl)]), ...(c.lockup || []).map((it, i) => [`lockup:${i}`, it])].filter(([, it]) => heirloomWorthy(s.meta, it));
}
// On death the most valuable piece goes in the locker by default, so the heirloom isn't lost by forgetting to pick.
function autoHeirloom(s) {
  const ch = heirloomChoices(s);
  if (!ch.length) return;
  const [, best] = ch.reduce((a, b) => (heirloomValue(b[1]) > heirloomValue(a[1]) ? b : a));
  // A visiting partner's heirloom belongs to their own cell, not the host's.
  if (isCoop(s) && actorIdx(s) === 1) s.guestHeirloom = asHeirloom(best);
  else s.meta.heirloom = asHeirloom(best);
}
export function setHeirloom(s, key) {
  const c = s.char, it = String(key).startsWith('lockup:') ? (c.lockup || [])[+key.slice(7)] : gearIn(c, key);
  if (!hasCell(s.meta, 'heirloom') || s.screen !== 'death' || !heirloomWorthy(s.meta, it)) return false;
  s.meta.heirloom = asHeirloom(it);
  s.notice = `${itemName(s.meta.heirloom)} goes in the safehouse locker, stripped back to base.`;
  return true;
}
export function equipHeirloom(s) {
  const c = s.char, it = s.meta.heirloom;
  if (!c || !it || !canEquip(c, it)) return false;
  const old = equip(s, it);
  s.meta.heirloom = heirloomWorthy(s.meta, old) ? asHeirloom(old) : null;
  s.notice = `${itemName(it)} is yours now.`;
  return true;
}

// ---------- derived stats ----------
export function attr(c, k) {
  const imp = { str: 'myomer', int: 'neural', cha: 'voice' }[k];
  return Math.max(1, Math.min(D.ATTR_MAX + 3, c.attrs[k] + (imp && hasImp(c, imp) ? 3 : 0) + favOf(c, k)));
}
// What the E-Girl Room has left on this operative: a sum of every night's marks. Kept on the operative, gone with them.
export const favOf = (c, k) => (c && c.fav && c.fav[k]) || 0;

export function statsOf(meta, c) {
  // A visiting co-op partner keeps their own cell's training.
  const t = (c.home && c.home.training) || meta.training, B = D.BASE_STATS, w = weaponOf(c), mw = meleeOf(c);
  const str = attr(c, 'str'), agi = attr(c, 'agi');
  let def = 0, spd = 0, carry = 0, critAll = 0;
  for (const slot of D.SLOT_ORDER) {
    const it = gearIn(c, slot);
    if (!it) continue;
    const b = baseOf(it), ms = mainStat(it);
    if (ms && ms.key === 'def') def += ms.v;
    spd += b.spd || 0; carry += b.carry || 0;
    if (!isWeaponSlot(slot)) critAll += b.crit || 0;
  }
  const common = B.atk + t.atk * D.TRAINING.atk.per + (c.level - 1) + (has(c, 'drill') ? 2 : 0);
  const rMain = (mainStat(gearIn(c, 'ranged')) || { v: 0 }).v, mMain = (mainStat(gearIn(c, 'melee')) || { v: 0 }).v;
  const optic = hasImp(c, 'optic') ? 0.15 : 0, gadget = baseOf(gearIn(c, 'gadget')) || {};
  const hp = Math.round(B.hp * 1.25) + t.hp * D.TRAINING.hp.per + (c.level - 1) * 6 + Math.round(str * TUNE.strHp) + (c.background === 'foundry' ? 25 + 3 * (c.level - 1) : 0) + (TUNE.classHp[c.background] || 0) + (hasImp(c, 'pain') ? 40 : 0) + gearBonus(c, 'hp');
  const mk = markSum(c), drink = drinkOf(c) || {}, fb = featBuffs(meta), dAtk = (drink.atk || 0) + favOf(c, 'atk'), dCrit = (drink.crit || 0) + favOf(c, 'crit');
  const out = {
    maxHp: Math.round(hp * (c.mut && c.mut.includes('glass') ? 0.75 : 1) * (hasPerk(c, 'glassheart') ? 0.7 : 1) * (hasTrait(c, 'stalwart') ? 1.12 : 1) * (1 + pv(c, 'ironlung') / 100) * (1 + mk.hp + fb.hp) * (1 + (drink.hp || 0)) * Math.max(0.5, 1 + favOf(c, 'hp'))),
    atk: common + rMain + dAtk + (w.type === 'heavy' ? Math.floor(str * TUNE.strAtk) : Math.floor(agi * TUNE.agiAtk)),
    atkM: common + mMain + dAtk + Math.floor(str * TUNE.strAtk),
    def: B.def + (c.background === 'foundry' ? 2 : 0) + t.def * D.TRAINING.def.per + Math.floor((c.level - 1) / 2) + def + gearBonus(c, 'def') + (hasImp(c, 'dermal') ? 5 : 0) + (has(c, 'lining') ? 2 : 0) + mk.def + pv(c, 'padding') + (drink.def || 0) + favOf(c, 'def'),
    spd: B.spd + (c.background === 'runner' ? 2 : 0) + t.spd * D.TRAINING.spd.per + Math.floor((c.level - 1) / 3) + agi + (hasImp(c, 'reflex') ? 5 : 0) + (hasImp(c, 'synapse') ? 2 : 0) + spd + gearBonus(c, 'spd') + mk.spd + (drink.spd || 0) + favOf(c, 'spd'),
    dodge: (agi - 1) * TUNE.agiDodge + (c.background === 'runner' ? 0.1 : 0) + (c.background === 'vex' ? 0.08 : c.background === 'mochi' ? 0.05 : 0) + fb.dodge + pv(c, 'ghost') / 100 + favOf(c, 'dodge'),
    crit: 0.05 + (w.crit || 0) + critAll + optic + (agi - 1) * TUNE.agiCrit + gearBonus(c, 'crit', 'ranged') / 100 + mk.crit + dCrit + fb.crit,
    critM: 0.05 + (mw.crit || 0) + critAll + optic + gearBonus(c, 'crit', 'melee') / 100 + mk.crit + dCrit + fb.crit,
    carry: 4 + (has(c, 'belt') ? 3 : 0) + carry + pv(c, 'pockets'),
    slots: 2 + (has(c, 'ripper') ? 1 : 0) + (attr(c, 'int') >= 4 ? 1 : 0) + (attr(c, 'int') >= 8 ? 1 : 0) + (c.background === 'clerk' ? 1 : 0),
    tech: (1 + 0.1 * attr(c, 'int')) * (c.background === 'clerk' ? 1.25 : 1) * (hasImp(c, 'neural') ? 1.1 : 1) * (hasTrait(c, 'overcharge') ? 1.2 : 1) * (1 + (gadget.techBoost || 0)) * (1 + (drink.tech || 0)),
    stimBoost: (gadget.stimBoost || 0) + fb.stim + (has(c, 'corpsman') ? 0.25 : 0) + pv(c, 'stimsling') / 100,
    scan: !!gadget.scan || has(c, 'informant') || c.background === 'clerk',
  };
  return masteryStats(meta, c, out);
}
export const stats = (s) => statsOf(s.meta, s.char);
// ---------- class mastery ----------
// Each class levels up for the cell as it's played: a sector cleared +1, a boss +3, a district freed +10.
// 1: +3% max HP. 2: pick a specialisation (one of two). 3: +3% damage. 4: one more stim carried in. 5: the class's mastery dye.
export const MASTERY_XP = [8, 25, 55, 95, 150];
export const masteryOf = (m, cls) => { const x = ((m && m.mastery) || {})[cls] || 0; let l = 0; while (l < MASTERY_XP.length && x >= MASTERY_XP[l]) l++; return { xp: x, level: l, next: MASTERY_XP[l] || null, prev: l ? MASTERY_XP[l - 1] : 0 }; };
export function masteryGain(s, n) {
  forEachActor(s, (a) => {
    // A visiting partner's mastery lives on their own cell: it goes home with them (index.html syncHome), and shows on their copy now.
    if (a.home) { const g = s.guestMastery || (s.guestMastery = {}); g[a.background] = (g[a.background] || 0) + n; const hm = a.home.mastery || (a.home.mastery = {}); hm[a.background] = (hm[a.background] || 0) + n; return; }
    const m = s.meta;
    const ms = m.mastery || (m.mastery = {}), before = masteryOf(m, a.background).level;
    ms[a.background] = (ms[a.background] || 0) + n;
    const after = masteryOf(m, a.background).level;
    if (after >= 5) { const cos = cosmetics(m); if (!cos.dye.includes('master')) cos.dye.push('master'); }
    if (after > before) log(s, `${(D.BACKGROUNDS.find((b) => b.id === a.background) || {}).name} mastery ${after}: ${MASTERY_PERKS[after - 1]}`, 'reward');
  });
}
export const MASTERY_PERKS = ['+3% max HP', 'pick a specialisation', '+3% damage', '+1 stim carried into every raid', 'the mastery dye'];
export function pickSpec(s, cls, which) {
  const m = s.meta; if (masteryOf(m, cls).level < 2 || !D.SPECS[cls] || ![0, 1].includes(which) || s.run) return false;
  (m.specs || (m.specs = {}))[cls] = which; return true;
}
export const specOf = (m, c) => { const sp = D.SPECS[c.background], i = ((m && m.specs) || {})[c.background]; return sp && i !== undefined && masteryOf(m, c.background).level >= 2 ? sp[i] : null; };
function masteryStats(meta, c, out) {
  const home = c.home || meta, lv = masteryOf(home, c.background).level;
  if (!lv) return out;
  if (lv >= 1) out.maxHp = Math.round(out.maxHp * 1.03);
  if (lv >= 3) { out.atk = Math.round(out.atk * 1.03); out.atkM = Math.round(out.atkM * 1.03); }
  const sp = specOf(home, c), fx = (sp && sp.fx) || {};
  if (fx.hp) out.maxHp = Math.round(out.maxHp * (1 + fx.hp));
  if (fx.def) out.def += fx.def;
  if (fx.dodge) out.dodge += fx.dodge;
  if (fx.crit) { out.crit += fx.crit; out.critM += fx.crit; }
  if (fx.atk) out.atk = Math.round(out.atk * (1 + fx.atk));
  if (fx.atkM) out.atkM = Math.round(out.atkM * (1 + fx.atkM));
  if (fx.stim) out.stimBoost += fx.stim;
  return out;
}
// What this operative is drinking. Old saves hold `true`: that round was the gin.
export const drinkOf = (c) => (c && c.drink ? D.BAR.menu.find((x) => x.id === c.drink) || D.BAR.menu[0] : null);
// Sum of an operative's permanent Marks (won in orbit).
export function markSum(c) {
  const t = { hp: 0, crit: 0, escape: 0, credits: 0, spd: 0, def: 0 };
  for (const id of c.marks || []) { const m = D.MARKS[id]; if (m) for (const k of Object.keys(t)) t[k] += m[k] || 0; }
  return t;
}
export const price = (s, cost) => Math.ceil(cost * hard(s).price * TUNE.priceAll * Math.max(0.6, 1 - 0.04 * (attr(s.char, 'cha') - 1)) * (s.char.background === 'preacher' ? 0.85 : 1) * (has(s.char, 'favour') ? 0.9 : 1) * (hasImp(s.char, 'voice') ? 0.95 : 1));
export const meetsReq = (c, req) => !req || Object.entries(req).every(([k, v]) => attr(c, k) >= v);
export const reqText = (req) => req ? Object.entries(req).map(([k, v]) => `${D.ATTRS[k].short} ${v}`).join(', ') : '';

export const MEDIC_SKILLS = ['barrier', 'rally', 'triage', 'tag'];
export function skillsOf(c) {
  if (c.background === 'medic') return [...MEDIC_SKILLS]; // the medic kit only: no weapon or attribute skills
  const out = c.background === 'dealer' ? ['pickcard'] : c.background === 'ghost' ? ['overhaul'] : c.background === 'vex' ? ['wink'] : c.background === 'mochi' ? ['sugar'] : [];
  const w = weaponOf(c), ws = D.WEAPON_SKILL[w.type], mw = meleeOf(c), gad = baseOf(gearIn(c, 'gadget'));
  if (ws) out.push(ws);
  if ((!mw.noSkill || attr(c, 'str') >= 6) && !out.includes('smash')) out.push('smash');
  if ((attr(c, 'int') >= 3 || (gad && gad.overload)) && !out.includes('overload')) out.push('overload');
  if (attr(c, 'agi') >= 4) out.push('suppress');
  if (attr(c, 'cha') >= 3) out.push('intimidate');
  return out;
}
export const skillCd = (c, id) => Math.max(1, D.SKILLS[id].cd - (id === 'intimidate' ? 0 : (hasImp(c, 'synapse') ? 1 : 0) + (c.background === 'clerk' ? 1 : 0)));

// Battle events for the animated stage. Only recorded when the UI sets s.events = [] before a turn,
// so the balance simulator pays nothing for them.
function fx(s, ev) {
  if (!Array.isArray(s.events)) return;
  const r = s.run;
  s.events.push({ ...ev, actor: s.actorIdx || 0, php: s.char.hp, ehp: r && r.enemy ? r.enemy.hp : 0 });
}

function log(s, text, kind = 'info') {
  s.log.push({ text, kind });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
  journal(s, text, kind);
}
// Journal: a long record of what happened, for the exportable run report. Capped so saves stay small.
export function journal(s, text, kind = 'info') {
  if (!s.meta) return;
  const j = s.meta.journal || (s.meta.journal = []);
  const r = s.run, where = r ? `${mapById(r.map).name.split(' ')[0]} S${r.sector}` : 'Town';
  const hp = s.char ? `${Math.max(0, s.char.hp)}hp` : '';
  j.push(`[${where} ${hp}] ${text}`);
  if (j.length > 700) j.splice(0, j.length - 700);
}

// Save codes: the whole state as base64 text, for moving a cell between devices.
export const exportSave = (s) => { const copy = { ...s, events: undefined, report: null }; return 'CC1.' + btoa(unescape(encodeURIComponent(JSON.stringify(copy)))); };
export function importSave(text, rng) {
  const t = (text || '').trim();
  if (!t.startsWith('CC1.')) return null;
  try { const o = JSON.parse(decodeURIComponent(escape(atob(t.slice(4))))); if (!o || !o.meta) return null; return migrate(o, rng); } catch (e) { return null; }
}
// The run report: everything a tester needs to say what happened. Plain text for pasting into a chat.
export function runReport(s) {
  const m = s.meta, c = s.char, lines = [];
  lines.push(`CINDER CELL run report (save v${s.v}, ${new Date().toISOString().slice(0, 16).replace('T', ' ')})`);
  lines.push(`Cell: ${m.operatives} operatives, ${m.stats.raids} raids, ${m.stats.kills} kills, ${m.stats.bosses} bosses, Resolve ${m.resolve} banked / ${m.totalResolve} earned, deepest sector ${m.bestSector}`);
  lines.push(`Best by map: ${Object.entries(m.bestByMap).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}; liberated: ${Object.keys(m.liberated).join(', ') || 'none'}; threat ${m.threat}`);
  lines.push(`Training: ${Object.entries(m.training).map(([k, v]) => `${k} ${v}`).join(', ')}; cell upgrades: ${m.cell.join(', ') || 'none'}`);
  const F = m.feats || { counters: {}, tiers: {} }, fb = featBuffs(m);
  lines.push(`Achievements: ${Object.values(F.tiers).filter(Boolean).length} tiers across ${Object.keys(F.tiers).filter((k) => F.tiers[k]).length} feats; buffs ${Object.entries(fb).filter(([k, v]) => k !== 'vs' && v).map(([k, v]) => `${k} +${(v * 100).toFixed(1)}%`).join(', ') || 'none'}; top counters ${Object.entries(F.counters).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  if (m.ship) lines.push(`Shuttle: hull ${m.ship.hull} guns ${m.ship.guns} shields ${m.ship.shields} engines ${m.ship.engines}; fittings ${m.ship.cell.join(', ') || 'none'}; orbit wins ${m.orbitWins || 0}; ventures ${Object.entries(m.ventures || {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}; wheel ${m.wheel ? `${m.wheel.spins} spins net ${m.wheel.net}` : 'unplayed'}`);
  if (c) lines.push(`Marks: ${(c.marks || []).map((k) => D.MARKS[k].name).join(', ') || 'none'}; look ${c.look ? `${c.look.body}/${c.look.hair}` : 'default'}`);
  lines.push(`Tuning: ${JSON.stringify(TUNE)} hard ${JSON.stringify(HARD)}`);
  if (c) {
    const st = statsOf(m, c);
    lines.push('');
    lines.push(`Operative ${c.number}: ${c.name}, ${c.background}, level ${c.level}, ${c.hp}/${st.maxHp} HP, ${c.credits} cr${c.fed ? ', fed' : ''}`);
    lines.push(`Attributes: ${Object.entries(c.attrs).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' ')} (${c.attrPoints} unspent); Shoot ${st.atk} / Strike ${st.atkM}, DEF ${st.def}, SPD ${st.spd}, crit ${Math.round(st.crit * 100)}%/${Math.round(st.critM * 100)}%`);
    lines.push(`Gear: ${D.SLOT_ORDER.map((sl) => { const it = c.gear[sl]; return it ? `${sl}=${itemName(it)} [${it.rarity}${it.bonuses.length ? '; ' + it.bonuses.map(bonusText).join(', ') : ''}${it.trait ? '; ' + D.TRAITS[it.trait].name : ''}]` : `${sl}=empty`; }).join('; ')}`);
    lines.push(`Implants: ${c.implants.join(', ') || 'none'}; contacts: ${c.upgrades.join(', ') || 'none'}; contraband: ${c.perks.join(', ') || 'none'}; items: ${Object.entries(c.items).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    lines.push(`Skills: ${skillsOf(c).join(', ')}`);
  }
  if (s.run) lines.push(`In the field: ${mapById(s.run.map).name} sector ${s.run.sector}, room ${s.run.room}, bulletin ${s.run.bulletin}, ${s.run.enemy ? `fighting ${s.run.enemy.name} (${s.run.enemy.hp}/${s.run.enemy.maxHp})` : 'between rooms'}`);
  if (m.fallen.length) { lines.push(''); lines.push('The wall:'); for (const f of m.fallen.slice(0, 12)) lines.push(`  #${f.number} ${f.name} (${f.background}, lv ${f.level}) died in ${f.map} sector ${f.sector} to ${f.killer} with ${f.credits} cr`); }
  lines.push(''); lines.push(`Journal (last ${Math.min(400, (m.journal || []).length)} events):`);
  for (const l of (m.journal || []).slice(-400)) lines.push('  ' + l);
  lines.push(''); lines.push('Tester notes (fill in): too easy / too hard / what felt wrong:');
  return lines.join('\n');
}

function changeAttrs(s, delta, why) {
  const c = s.char, parts = [];
  for (const [k, v] of Object.entries(delta)) {
    const before = c.attrs[k];
    c.attrs[k] = clamp(before + v, 1, D.ATTR_MAX);
    const d = c.attrs[k] - before;
    if (d) parts.push(`${d > 0 ? '+' : '\u2212'}${Math.abs(d)} ${D.ATTRS[k].short}`);
  }
  if (parts.length) c.history.unshift({ text: `${parts.join(', ')}: ${why}`, map: s.run ? s.run.map : null });
  c.history = c.history.slice(0, 12);
  return parts.join(', ');
}

export function spendAttr(s, k) {
  const c = s.char;
  if (!c || c.attrPoints <= 0 || c.attrs[k] >= D.ATTR_MAX) return false;
  c.attrPoints -= 1;
  const before = stats(s).maxHp;
  c.attrs[k] += 1;
  c.spent = c.spent || {}; c.spent[k] = (c.spent[k] || 0) + 1;
  c.hp += Math.max(0, stats(s).maxHp - before);
  s.notice = `${D.ATTRS[k].label} raised to ${c.attrs[k]}.`;
  return true;
}

// Reset the attribute points earned from levelling. Expensive, and dearer each time and each level.
export const respecPoints = (c) => Object.values(c.spent || {}).reduce((t, v) => t + v, 0);
export const respecCost = (c) => Math.ceil(88 * c.level * (1 + 0.5 * (c.respecs || 0)));
export function respec(s) {
  const c = s.char, n = respecPoints(c), cost = price(s, respecCost(c));
  if (!n || c.credits < cost) return false;
  c.credits -= cost; ledger(s, 'spend:respec', cost);
  for (const [k, v] of Object.entries(c.spent)) c.attrs[k] = Math.max(1, c.attrs[k] - v);
  c.attrPoints += n; c.spent = {}; c.respecs = (c.respecs || 0) + 1;
  c.hp = Math.max(1, Math.min(c.hp, stats(s).maxHp));
  s.notice = `Doc talks you through it for ${cost} ${D.SETTING.cur}. ${n} attribute point${n > 1 ? 's' : ''} to spend again.`;
  return true;
}

// A neighbour in the tenement slips you a stim, once per operative.
export function tenementGift(s) {
  const c = s.char;
  if (c.gifted || c.items.stim >= stats(s).carry) return false;
  c.gifted = true; c.items.stim += 1;
  return true;
}

// ---------- town ----------
export function healCost(s) {
  const st = stats(s);
  return Math.ceil((st.maxHp - s.char.hp) * 0.5 * hard(s).price * TUNE.priceAll * (1 - cellV(s.meta, 'ledger', 0)));
}
export function heal(s) {
  const cost = healCost(s);
  if (cost <= 0 || s.char.credits < cost) return false;
  s.char.credits -= cost; s.char.hp = stats(s).maxHp; ledger(s, 'spend:clinic', cost);
  s.notice = `Doc patched you up for ${cost} ${D.SETTING.cur}.`;
  return true;
}

// Consumables cost more the deeper this operative has been: a stim has to stay a decision at sector 15.
const consumableScale = (c) => 1 + TUNE.itemScale * Math.max(0, ((c && c.deepest) || 0) - 1);
export const itemCost = (s, id) => Math.round(D.ITEMS[id].cost * consumableScale(s.char));
// ---------- drones ----------
// Ranks are bought with Resolve and belong to the cell, one set per type. Every operative who picks that type starts there.
export const droneRankOf = (m, type) => Math.max(1, (m.droneRanks && m.droneRanks[D.DRONES[type] ? type : 'hornet']) || 1);
export const droneOf = (c) => (c && c.drone && !c.drone.damaged ? c.drone : null);
export const droneValue = (d, rank = d.rank) => D.DRONES[d.type].ranks[rank - 1];
export const droneHas = (d, rank) => !!d && d.rank >= rank;
export const droneUpgradeCost = (d) => (d.rank >= D.DRONE_MAX_RANK ? 0 : D.DRONE_UPGRADE[d.rank - 1]);
// The first repair for each operative is on the house: an early drone loss shouldn't eat a first raid's haul.
export const droneRepairCost = (s) => { const c = s.char; return c && c.drone ? (c.droneFixed ? price(s, 20 + 10 * c.drone.rank + 3 * (c.deepest || 0)) : 0) : 0; };
export function pickDrone(s, type) {
  const c = s.char;
  if (!c || c.drone || !D.DRONES[type]) return false;
  c.drone = { type, rank: droneRankOf(s.meta, type), damaged: false };
  s.notice = `${D.DRONES[type].name} is yours. It stays with you for good.`;
  return true;
}
// Swapping is free in town, and each type keeps its own rank. An offline drone has to be repaired first, so swapping can't dodge the bill.
// rank: a co-op friend's rank for that type, from their own cell.
export function switchDrone(s, type, rank = null) {
  const c = s.char;
  if (!c || s.run || !c.drone || c.drone.damaged || c.drone.type === type || !D.DRONES[type]) return false;
  c.drone = { type, rank: Math.max(1, Math.min(D.DRONE_MAX_RANK, rank || droneRankOf(s.meta, type))), damaged: false };
  s.notice = `${D.DRONES[type].name} is flying with you now, at rank ${c.drone.rank}.`;
  return true;
}
// free: already paid for. A co-op friend pays from their own cell's Resolve on their own device.
export function upgradeDrone(s, free = false) {
  const c = s.char, d = c && c.drone;
  if (!d || d.rank >= D.DRONE_MAX_RANK) return false;
  const cost = droneUpgradeCost(d);
  if (!free && s.meta.resolve < cost) return false;
  d.rank += 1;
  // A co-op friend's rank is kept by their own cell, on their own device.
  if (!free) { s.meta.resolve -= cost; s.meta.droneRanks = { ...(s.meta.droneRanks || {}), [d.type]: d.rank }; }
  const ab = D.DRONES[d.type].abilities[d.rank];
  s.notice = `${D.DRONES[d.type].name} is now rank ${d.rank}, for every operative who flies one.${ab ? ` New ability: ${ab.name}.` : ''}`;
  return true;
}
export function repairDrone(s) {
  const c = s.char, cost = droneRepairCost(s);
  if (!c || !c.drone || !c.drone.damaged || c.credits < cost) return false;
  c.credits -= cost; c.drone.damaged = false; c.droneFixed = true; ledger(s, 'spend:drone', cost);
  s.notice = cost ? `${D.DRONES[c.drone.type].name} repaired for ${cost} ${D.SETTING.cur}.` : `${D.DRONES[c.drone.type].name} repaired. The first one\u2019s free.`;
  return true;
}
// Clearing a sector can knock a drone out until it's repaired in town.
function droneWear(s, rng) {
  const hit = [];
  for (const i of livingActors(s)) withActor(s, i, () => {
    const d = droneOf(s.char);
    if (!d || rng() >= D.DRONE_DAMAGE) return;
    d.damaged = true; hit.push(i);
    log(s, `${s.char.name.split(' ')[0]}\u2019s ${D.DRONES[d.type].name} takes a hit and goes offline. It needs repairing in town.`, 'bad');
  });
  return hit;
}
// The drone's move, straight after its operative's.
function droneTurn(s, rng, who) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), d = droneOf(c);
  if (!d || mutOn(r, 'grounded')) return;
  const v = droneValue(d), name = D.DRONES[d.type].name, bank = r.droneBank || (r.droneBank = {});
  if (d.type === 'hornet') {
    const pow = Math.max(st.atk, st.atkM) * v / 100 * (droneHas(d, D.DRONE_AB.mid) && e.hp < e.maxHp * 0.3 ? 2 : 1) * TUNE.droneAtk;
    bank[who] = (bank[who] || 0) + pow;
    const dmg = Math.floor(bank[who]);
    if (dmg >= 1) {
      bank[who] -= dmg; e.hp -= dmg;
      fx(s, { who: 'drone', type: 'shoot', drone: d.type, dmg });
      log(s, `${name} hits ${e.name} for ${dmg}.`, 'hit');
    }
    if (droneHas(d, D.DRONE_AB.top) && e.hp > 0 && rng() < 0.1) { addStatus(e.st, e.fresh, { exposed: 2 }); log(s, `${name} marks ${e.name}: Exposed.`, 'good'); }
  } else if (d.type === 'mender') {
    if (droneHas(d, D.DRONE_AB.mid) && (r.pst.bleed || r.pst.burn) && rng() < 0.25) { delete r.pst.bleed; delete r.pst.burn; log(s, `${name} stops the bleeding.`, 'good'); }
    const used = e.droneSaved || (e.droneSaved = {});
    let heal = 0;
    if (droneHas(d, D.DRONE_AB.top) && !used[who] && c.hp < st.maxHp * 0.25) { used[who] = true; heal = Math.round(st.maxHp * 0.15); log(s, `${name}: emergency patch.`, 'good'); }
    if (c.hp < st.maxHp) {
      bank[who] = (bank[who] || 0) + st.maxHp * v / 100 * TUNE.droneHeal;
      const n = Math.floor(bank[who]);
      bank[who] -= n; heal += n;
    }
    heal = Math.min(heal, st.maxHp - c.hp);
    if (heal > 0) { c.hp += heal; fx(s, { who: 'drone', type: 'heal', drone: d.type, amt: heal }); }
  } else if (d.type === 'magpie' && rng() < v / 100 * TUNE.droneTech) {
    const pool = ['thermal'];
    if (e.stun === 0) pool.push('ion');
    if (c.hp < st.maxHp * 0.6) pool.push('stim', 'stim');
    const it = pick(rng, pool), boost = droneHas(d, D.DRONE_AB.top) ? 1.5 : 1;
    if (it === 'thermal') {
      const dmg = Math.round((20 + r.sector * 4) * st.tech * outMult(r.pst, e.st) * boost);
      e.hp -= dmg;
      fx(s, { who: 'drone', type: 'item', item: 'thermal', drone: d.type, dmg });
      log(s, `${name} drops a thermal charge: ${dmg} damage.`, 'crit');
    } else if (it === 'ion') {
      const droid = e.tags.includes('droid'), ionDmg = droid ? Math.round((12 + r.sector * 2) * st.tech * boost) : 0;
      e.stun = droid ? 2 : 1; e.hp -= ionDmg;
      fx(s, { who: 'drone', type: 'item', item: 'ion', drone: d.type, dmg: ionDmg, droid });
      log(s, `${name} fires an ion pulse. ${e.name} is stunned.`, 'hit');
    } else {
      const amt = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.4 * st.tech));
      c.hp += amt; delete r.pst.bleed; delete r.pst.burn;
      fx(s, { who: 'drone', type: 'item', item: 'stim', drone: d.type, amt });
      log(s, `${name} jabs you with a stim. +${amt} HP.`, 'good');
    }
  }
}
// A Field Medic's shield takes the hit first.
function soak(s, c, dmg) {
  if (!(dmg > 0) || !(c.medShield > 0)) return dmg;
  const took = Math.min(c.medShield, dmg); c.medShield -= took;
  log(s, `The field shield takes ${took}${c.medShield ? '' : ' and breaks'}.`, 'good');
  return dmg - took;
}
const droneShield = (c, dmg) => { if (dmg > 0 && c.fightGuard && c.fightGuard < 1) dmg = Math.max(1, Math.round(dmg * c.fightGuard)); const d = droneOf(c); return d && d.type === 'aegis' && dmg > 0 ? Math.max(1, Math.round(dmg * (1 - droneValue(d) / 100 * TUNE.droneShield))) : dmg; };
export function restockStims(s) {
  let n = 0;
  while (buyItem(s, 'stim')) n++;
  if (n) s.notice = `Bought ${n} Med Stim${n > 1 ? 's' : ''}.`;
  return n > 0;
}
export function buyItem(s, id) {
  const item = D.ITEMS[id], c = s.char, due = item ? price(s, itemCost(s, id)) : 0;
  if (!item || c.credits < due || c.items[id] >= stats(s).carry) return false;
  c.credits -= due; c.items[id] += 1; ledger(s, 'spend:items', due);
  s.notice = `Bought ${item.name}.`;
  return true;
}

// Each mod this operative buys makes the next one dearer, so the full set takes a long career.
export const modCost = (c, u) => Math.round(u.cost * Math.pow(D.MOD_STEP, c.upgrades.length));
export function buyUpgrade(s, id) {
  const u = D.UPGRADES.find((x) => x.id === id), c = s.char;
  if (!u || has(c, id)) return false;
  const cost = price(s, modCost(c, u));
  if (c.credits < cost) return false;
  c.credits -= cost; c.upgrades.push(id); ledger(s, 'spend:contacts', cost);
  s.notice = `${u.name} acquired.`;
  return true;
}

// Each implant after the first costs a lot more: the body only takes so much hardware.
export const IMPLANT_STEP = [1, 1.75, 2.5, 3.25];
export const implantCost = (c, u) => Math.round(u.cost * IMPLANT_STEP[Math.min(IMPLANT_STEP.length - 1, (c.implants || []).length)]);
export function installImplant(s, id) {
  const u = D.IMPLANTS.find((x) => x.id === id), c = s.char, cost = u && price(s, implantCost(c, u));
  if (!u || hasImp(c, id) || c.credits < cost || c.implants.length >= stats(s).slots) return false;
  const before = stats(s).maxHp;
  c.credits -= cost; c.implants.push(id); ledger(s, 'spend:implants', cost);
  c.hp += Math.max(0, stats(s).maxHp - before);
  s.notice = `${u.name} installed. Doc says the twitching stops in a week.`;
  return true;
}
export function removeImplant(s, id) {
  const c = s.char;
  if (!hasImp(c, id)) return false;
  c.implants = c.implants.filter((x) => x !== id);
  c.hp = Math.min(c.hp, stats(s).maxHp);
  s.notice = 'Implant removed. The slot is free again; the credits are not coming back.';
  return true;
}

export const trainingMax = (m, stat) => (endgameOpen(m) ? D.TRAINING[stat].maxEnd || D.TRAINING[stat].max : D.TRAINING[stat].max);
export function train(s, stat) {
  const m = s.meta, lvl = m.training[stat], def = D.TRAINING[stat];
  if (!def || lvl >= trainingMax(m, stat) || m.resolve < trainingCost(lvl)) return false;
  const before = s.char ? stats(s).maxHp : 0;
  m.resolve -= trainingCost(lvl); m.training[stat] += 1;
  if (s.char) s.char.hp += stats(s).maxHp - before;
  s.notice = `${def.label} raised to ${lvl + 1}. This one stays.`;
  return true;
}

export function buyCell(s, id) {
  const u = D.CELL.find((x) => x.id === id), m = s.meta;
  const lv = u ? cellLevel(m, id) : 0, next = u && u.levels[lv];
  if (!next || m.resolve < next.cost || (next.endgame && !endgameOpen(m))) return false;
  m.resolve -= next.cost;
  if (!m.cell.includes(id)) m.cell.push(id);
  m.cellLv = { ...(m.cellLv || {}), [id]: lv + 1 };
  s.notice = `${u.name} level ${lv + 1}: every future operative benefits.`;
  return true;
}

// Everything that scales credit income.
export function creditMult(s) {
  const c = s.char, t = s.run ? s.run.threat : s.meta.threat || 0;
  const b = s.run ? s.run.bulletin : null;
  const cha = (1 + TUNE.chaCredits * (attr(c, 'cha') - 1)) * (c.background === 'preacher' ? 1.15 : c.background === 'vex' ? 1.1 : 1);
  return (1 + (((specOf(s.meta, c) || {}).fx || {}).credits || 0)) * (mutOn(s.run, 'broke') ? 0.6 : 1) * cha * (has(c, 'fence') ? 1.25 : 1) * (1 + pv(c, 'chit') / 100) * (1 + gearBonus(c, 'credits') / 100) * (1 + 0.15 * t) * (1 + markSum(c).credits + featBuffs(s.meta).credits) * (1 + ((drinkOf(c) || {}).credits || 0)) * (b === 'payday' ? 1.3 : b === 'lockdown' ? 1.25 : 1) * condCredits(s.run);
}
const condCredits = (r) => (!r ? 1 : r.cond === 'toxic' ? 1.25 : r.cond === 'patrol' ? 1.3 : r.cond === 'lockdown' ? 1.2 : 1);
export const condOf = (r) => D.SECTOR_CONDS.find((x) => x.id === (r && r.cond)) || D.SECTOR_CONDS[0];

// ---------- status effects ----------
// Durations count rounds. A status applied this round starts ticking next round.
export function addStatus(obj, fresh, statuses, reduce = 0) {
  const added = [];
  for (const [k, n] of Object.entries(statuses || {})) {
    const d = n - reduce;
    if (d <= 0) continue;
    obj[k] = Math.max(obj[k] || 0, d);
    if (!fresh.includes(k)) fresh.push(k);
    added.push(k);
  }
  return added;
}
const outMult = (attackerSt, defenderSt) => (attackerSt.shaken ? 0.75 : 1) * (defenderSt.exposed ? 1.25 : 1);

// ---------- maps ----------
// A district opens when this operative has cleared far enough into the earlier ones. A new operative starts again.
export const mapUnlocked = (s, map) => Object.entries(map.unlock || {}).every(([id, n]) => !!s.char && ((s.char.maps || {})[id] || {}).deepest >= n);
// How deep this operative has been anywhere, in Garrison-equivalent sectors (the shop and drops follow it).
export const opDepth = (c) => Math.max(0, ...Object.entries((c && c.maps) || {}).map(([id, p]) => (p.deepest ? effSector(p.deepest, id) : 0))) + THREAT_DEPTH * opThreat(c);
// Threat levels: an operative who frees all five districts escapes, then goes back in one level higher. Their maps start over
// from sector 1, but every sector counts as THREAT_DEPTH deeper per level (enemies, pay, the shop), so Garrison at Threat I
// opens a little past where Halcyon Reach did (tuned with SECTIONS=threatup in sim-balance.mjs). Lower levels stay shut for that operative; a new one starts at Standard.
export const THREAT_DEPTH = 30;
export const opThreat = (c) => (c && c.threat) || 0;
export const upgradeMax = (t = 0) => D.UPGRADE_MAX + 2 * t; // Standard +8, Threat I +10, Threat II +12...
export const opFreed = (c, mapId) => (((c && c.maps) || {})[mapId] || {}).deepest >= MAX_SECTOR;
export function mapProgress(c, mapId) {
  if (!c.maps[mapId]) c.maps[mapId] = { insertions: [1], deepest: 0 };
  return c.maps[mapId];
}

// Insertion points this operative has earned on a map at a threat level. Raising the threat starts again from sector 1.
export function insertionsAt(c, mapId, threat = 0) {
  const prog = mapProgress(c, mapId);
  if (!threat) return prog.insertions;
  const by = prog.byThreat || (prog.byThreat = {});
  return by[threat] || (by[threat] = [1]);
}
const earnInsertion = (c, mapId, threat, sector) => { const list = insertionsAt(c, mapId, threat); if (!list.includes(sector)) list.push(sector); };
export function deploy(s, mapId, startSector, rng, opts = {}) {
  const map = mapById(mapId);
  if (!mapUnlocked(s, map)) return false;
  s.meta.threat = s.run && s.run.contract ? 0 : opThreat(s.char); // the operative's own level: no going back down
  if (!insertionsAt(s.char, map.id, s.meta.threat || 0).includes(startSector)) startSector = 1;
  s.run = { startCredits: s.char.credits, map: map.id, sector: startSector, startSector, room: 0, choices: null, enemy: null, nextMod: null, sectorCredits: 0, kills: 0, bosses: 0, cleared: 0, elites: 0,
    alert: 0, allies: 0, vent: 3, turns: 0, threat: s.meta.threat || 0, perkOffer: null, ...freshBag(), cb: {}, actor: 0, acted: {}, round: 0, lastAttacker: 0 };
  if (isCoop(s)) s.run.cb[1] = freshBag();
  s.run.mutators = opts.contract ? [...opts.contract.mutators] : mutatorsOpen(s) ? (s.meta.mutPick || []).filter((id) => D.MUTATORS.some((x) => x.id === id)) : [];
  if (opts.contract) s.run.daily = { kind: opts.contract.kind, id: opts.contract.id, end: opts.contract.end, sectors: 0, bosses: 0, done: false };
  forEachActor(s, (c) => { c.mut = s.run.mutators.length ? [...s.run.mutators] : undefined; });
  // Every district freed brings reinforcements to the ones still held.
  // Districts freed elsewhere stiffen the rest. The endgame map is built hard (power) and isn't reinforced on top.
  s.run.reinforced = s.run.daily || s.meta.liberated[map.id] || map.power ? 0 : Math.min(TUNE.reinforce.length - 1, Object.keys(s.meta.liberated).length);
  s.meta.stats.raids += 1;
  forEachActor(s, (c) => {
    c.startCredits = c.credits; c.safeCredits = c.credits; c.xpBank = 0; c.payout = null;
    c.stimsAtDeploy = c.items.stim; // what auto battle's out-of-stims pause compares with
    if (D.BACKGROUNDS.find((b) => b.id === c.background).follower) { s.run.allies = Math.min(2, s.run.allies + 1); s.run.follower = true; }
    if (hasTrait(c, 'surplus') && c.items.stim < stats(s).carry) c.items.stim += 1;
    if (has(c, 'quarter') && c.items.stim < stats(s).carry) c.items.stim += 1;
    if (masteryOf(c.home || s.meta, c.background).level >= 4 && c.items.stim < stats(s).carry) c.items.stim += 1;
  });
  s.run.bulletin = pickWeighted(rng, D.BULLETINS.filter((b) => (b.minThreat || 0) <= (s.run.threat || 0)).map((b) => [b.id, b.weight]));
  refreshContracts(s, rng);
  s.log = [];
  s.notice = null;
  log(s, `You slip into the ${map.name}. ${sectorName(startSector, map.id)}.`, 'sys');
  if (s.run.reinforced && TUNE.reinforce[s.run.reinforced]) log(s, `The Directorate has reinforced this district: enemies +${Math.round((TUNE.reinforce[s.run.reinforced] || 0) * 100)}%, and they pay better.`, 'crit');
  if (s.run.mutators.length) log(s, `Mutators: ${s.run.mutators.map((id) => D.MUTATORS.find((x) => x.id === id).name).join(', ')} (+${Math.round(mutBonus(s.run.mutators) * 100)}% score and ${D.SETTING.meta}).`, 'crit');
  const bl = bulletinOf(s.run);
  if (bl.id !== 'quiet') log(s, `Directorate bulletin: ${bl.name}. ${bl.desc}`, 'crit');
  beginSector(s, rng);
  return true;
}

export const mechanicOf = (r) => mapById(r.map).mechanic.id;
// Mutators open once the cell has freed a district. mutOn: is this one active on the raid (or, for statsOf, on this operative).
export const mutatorsOpen = (s) => Object.keys((s.meta && s.meta.liberated) || {}).length > 0;
export const mutOn = (r, id) => !!(r && r.mutators && r.mutators.includes(id));
export const mutBonus = (ids) => (ids || []).reduce((t, id) => t + ((D.MUTATORS.find((x) => x.id === id) || {}).bonus || 0), 0);
export function toggleMutator(s, id) {
  if (!mutatorsOpen(s) || !D.MUTATORS.some((x) => x.id === id) || s.run) return false;
  const p = s.meta.mutPick || (s.meta.mutPick = []), i = p.indexOf(id);
  if (i >= 0) p.splice(i, 1); else p.push(id);
  return true;
}
export const bulletinOf = (r) => D.BULLETINS.find((b) => b.id === (r && r.bulletin)) || D.BULLETINS[0];
export const quirkById = (id) => D.QUIRKS.find((q) => q.id === id);
export const roomName = (mapId, kind) => kind === 'boss' ? 'Boss' : (mapById(mapId).roomNames[kind] || D.EXTRA_ROOM_NAMES[kind] || kind);

function raiseAlarm(s, n, why) {
  const r = s.run;
  if (!r || mechanicOf(r) !== 'alarm' || r.alert >= 5) return;
  r.alert = Math.min(5, r.alert + n);
  log(s, `${why} Alarm level ${r.alert}.`, 'bad');
}

// New sector: cooldowns reset, then pick the first room.
function beginSector(s, rng) {
  const r = s.run;
  s.meta.bestSector = Math.max(s.meta.bestSector || 0, r.sector); // reached counts for the record; cleared still drives contracts and insertions
  r.room = 0; r.fightsDone = 0; r.cooldowns = {}; r.usedThisFight = []; r.sectorCredits = 0;
  // The story of the place: a line on arrival and on reaching each of a map's three areas. Kept in the run, so both co-op screens show it.
  { const band = areaBand(r.sector), first = r.band === undefined;
    if (first || band !== r.band) {
      r.band = band;
      r.areaLine = { sector: r.sector, text: `${first ? `${mapIntro(r.map)} ` : ''}${mapIntro(r.map, r.sector)}` };
      log(s, r.areaLine.text, 'sys');
    } }
  // Boss sectors and the opening sector stay clear; everything else rolls a condition.
  // A newcomer's first raid keeps its first two sectors plain, so the first banking choice isn't decided by a bad roll.
  const newcomer = s.meta.operatives <= 1 && (s.meta.stats.raids || 0) <= 1 && r.sector <= 2;
  r.cond = r.sector === 1 || newcomer || isBossSector(r.sector) ? 'none' : pickWeighted(rng, D.SECTOR_CONDS.map((x) => [x.id, x.weight]));
  if (r.cond !== 'none') log(s, `${condOf(r).name}: ${condOf(r).desc}`, 'info');
  for (const b of Object.values(r.cb || {})) { b.cooldowns = {}; b.usedThisFight = []; }
  offerRoute(s, rng);
}

// Door weights for this sector: the map's own rooms, the v5 extras, bent by the sector condition.
function roomWeights(r, map) {
  const w = { ...map.rooms };
  for (const [k, v] of Object.entries(D.EXTRA_ROOMS)) w[k] = (w[k] || 0) + v;
  if (r.cond === 'supplies') { for (const k of ['supply', 'rest', 'medbay', 'cargo']) if (w[k]) w[k] *= 2.5; }
  if (r.cond === 'derelict' && w.event) w.event *= 2;
  if (r.cond === 'lockdown') for (const k of Object.keys(w)) if (!D.ROOMS[k].fight) delete w[k];
  if (r.sector === 1) { delete w.bounty; delete w.fence; delete w.locker; }
  return Object.entries(w);
}
// Offer two doors (or the boss). At least one door is always a fight.
export function offerRoute(s, rng) {
  const r = s.run, map = mapById(r.map);
  r.lastChoices = r.choices && r.choices.length ? r.choices.slice() : r.lastChoices;
  r.enemy = null;
  if (r.room >= FIGHTS_PER_SECTOR) return clearSector(s, rng);
  const remaining = FIGHTS_PER_SECTOR - r.room, needed = MIN_FIGHTS - (r.fightsDone || 0);
  r.forced = false; r.votes = null;
  if (r.room === FIGHTS_PER_SECTOR - 1 && isBossSector(r.sector)) r.choices = ['boss'];
  else if (remaining <= needed) { r.choices = r.sector > 1 && r.lastChoices && r.lastChoices.join() === 'fight,elite' ? ['fight', 'bounty'] : ['fight', 'elite']; r.forced = true; }
  else {
    r.forced = false;
    const entries = roomWeights(r, map);
    const a = pickWeighted(rng, entries);
    let b = a;
    for (let i = 0; i < 20 && b === a; i++) b = pickWeighted(rng, entries);
    const choices = [a, b];
    if (!choices.some((k) => D.ROOMS[k].fight)) choices[1] = 'fight';
    if (choices[0] === choices[1]) choices[1] = choices[0] === 'fight' ? 'elite' : 'fight';
    // No veteran behind an optional door in the opening sector: a fresh operative shouldn't be walled in room one.
    if (r.sector === 1) for (let i = 0; i < 2; i++) if (choices[i] === 'elite') choices[i] = choices[1 - i] === 'fight' ? 'event' : 'fight';
    r.choices = choices;
  }
  s.screen = 'route';
}
export const nextEncounter = offerRoute;
// Co-op doors: both living players vote. Change your mind until both have voted; a split vote goes to a coin.
// Returns true once a door has been entered.
export function voteDoor(s, who, idx, rng) {
  const r = s.run;
  if (!r || !r.choices || !r.choices[idx]) return false;
  r.votes = r.votes || {};
  r.votes[who] = idx;
  const alive = livingActors(s);
  if (!alive.every((i) => r.votes[i] !== undefined)) return false;
  const picks = alive.map((i) => r.votes[i]), split = new Set(picks).size > 1, door = split ? pick(rng, picks) : picks[0];
  if (split) s.sharedToast = `Split vote. The coin says door ${door + 1}.`;
  r.votes = null;
  enterRoom(s, door, rng);
  return true;
}
// Deeper or home: that one has to be unanimous. Returns the decision once you agree, otherwise null.
export function voteExit(s, who, choice) {
  const r = s.run;
  if (!r) return null;
  r.exitVotes = r.exitVotes || {};
  r.exitVotes[who] = choice;
  const alive = livingActors(s);
  if (!alive.every((i) => r.exitVotes[i] === choice)) return null;
  r.exitVotes = null;
  return choice;
}

export function enterRoom(s, idx, rng) {
  const r = s.run, kind = r.choices && r.choices[idx];
  if (!kind) return;
  r.choices = null; r.room += 1; r.roomType = kind;
  const map = mapById(r.map), st = stats(s), c = s.char, name = roomName(r.map, kind);
  if (D.ROOMS[kind].fight) { r.fightsDone = (r.fightsDone || 0) + 1; return startFight(s, rng, kind); }
  if (kind === 'event') {
    const pool = D.EVENTS.filter((ev) => ev.maps === 'any' || ev.maps.includes(r.map));
    s.event = pick(rng, pool).id; s.eventResult = null; s.screen = 'event';
    return;
  }
  const notes = [];
  let text = '';
  if (kind === 'supply' || kind === 'cargo') {
    const range = kind === 'cargo' ? [14, 22] : [6, 11];
    const cr = Math.round(randInt(rng, range[0], range[1]) * payDepth(r) * map.credits * creditMult(s));
    forEachActor(s, (a) => { a.credits += cr; });
    r.sectorCredits += cr; ledger(s, 'rooms', cr); notes.push(`+${cr} ${D.SETTING.cur}${isCoop(s) ? ' each' : ''}`);
    if (kind === 'supply' && rng() < 0.5) {
      const it = pick(rng, ['stim', 'thermal', 'ion']);
      forEachActor(s, (a) => { if (a.items[it] < stats(s).carry) { a.items[it] += 1; } });
      notes.push(`+1 ${D.ITEMS[it].name}`);
    }
    if (kind === 'cargo') { r.nextMod = 'alerted'; notes.push('next enemy alerted'); text = 'You crack two crates of confiscated goods. Someone heard the crowbar.'; }
    else text = 'Shelves of requisitioned supplies. You take what fits in your pockets.';
  } else if (kind === 'rest') {
    let h = 0; const pct = r.cond === 'supplies' ? 0.4 : 0.3;
    forEachActor(s, (a, i) => { const m2 = stats(s).maxHp, hh = Math.min(m2 - a.hp, Math.round(m2 * pct)); a.hp += hh; if (i === actorIdx(s)) h = hh; delete r.pst.bleed; delete r.pst.burn; });
    notes.push(`+${h} HP`);
    text = 'Five quiet minutes. You rewrap the bandages and breathe.';
    if (r.alert > 0) { r.alert = Math.max(0, r.alert - 2); notes.push(`alarm down to ${r.alert}`); text += ' Up on the wall, the alarm lights blink back to amber.'; }
  } else if (kind === 'cells') {
    if (r.allies < 2) { r.allies += 1; notes.push(`ally joins (${r.allies}/2)`); text = 'The lock gives. A prisoner grabs a fallen guard\u2019s baton and falls in behind you.'; }
    else { s.meta.resolve += 1; s.meta.totalResolve += 1; notes.push(`+1 ${D.SETTING.meta}`); text = 'You can\u2019t take more with you. You open the doors and point them to the vents.'; }
  }
  else if (kind === 'medbay') {
    let h = 0;
    forEachActor(s, (a, i) => { const m2 = stats(s).maxHp, hh = Math.min(m2 - a.hp, Math.round(m2 * 0.2)); a.hp += hh; if (i === actorIdx(s)) h = hh; if (a.items.stim < stats(s).carry) a.items.stim += 1; });
    notes.push(`+${h} HP`, `+1 ${D.ITEMS.stim.name}`);
    text = 'A medic station, abandoned mid-shift. Clean dressings, a full stim rack.';
  } else if (kind === 'vault') {
    const ok = rng() < clamp(0.3 + 0.1 * attr(c, 'int'), 0.3, 0.9);
    const cr = Math.round(randInt(rng, ok ? 15 : 6, ok ? 24 : 10) * payDepth(r) * map.credits * creditMult(s));
    forEachActor(s, (a) => { a.credits += cr; }); r.sectorCredits += cr; ledger(s, 'rooms', cr); notes.push(`+${cr} ${D.SETTING.cur}`);
    if (ok) text = 'The tumblers fall one by one. The strongroom is yours.';
    else { const dmg = Math.round(st.maxHp * 0.15); c.hp = Math.max(1, c.hp - dmg); notes.push(`\u2212${dmg} HP`); text = 'A dye charge goes off in your face. You grab what you can through the smoke.'; }
    notes.push(`INT check ${ok ? 'passed' : 'failed'}`);
  } else if (kind === 'locker') {
    const band = clamp(Math.ceil(r.sector / 3), 1, 6);
    forEachActor(s, () => { r.lootOffer = rollGear(rng, { tierMin: Math.max(1, band - 1), tierMax: band, odds: { rare: 0.65, elite: 0.3, legendary: 0.05 } }); });
    notes.push(isCoop(s) ? 'Something for each of you' : itemName(r.lootOffer));
    text = 'The locker\u2019s seal hisses open. Something good is racked inside.';
  } else if (kind === 'bench') {
    const opts = D.SLOT_ORDER.map((sl) => gearIn(c, sl)).filter((it) => canUpgrade(it, opThreat(c)));
    if (opts.length) { const it = pick(rng, opts); it.level += 1; notes.push(`${itemName(it)}`); text = 'Somebody left the lathe running. You make good use of it.'; }
    else { const cr = Math.round(randInt(rng, 7, 11) * payDepth(r) * creditMult(s)); c.credits += cr; r.sectorCredits += cr; notes.push(`+${cr} ${D.SETTING.cur}`); text = 'Nothing of yours needs work. You strip the bench for parts and sell them on.'; }
  } else if (kind === 'fence') {
    forEachActor(s, () => { r.perkOffer = offerPerks(s, rng, false); });
    text = 'Behind a false wall: a smuggler\u2019s stash, labelled in a hand you don\u2019t know. Take one thing.';
  }
  s.roomResult = { kind, name, text, notes };
  s.screen = 'room';
}

function startFight(s, rng, kind) {
  const r = s.run, mech = mechanicOf(r), c = s.char;
  // Threat rules (D.THREAT[].rule): Pursuers from Threat I, veterans more often from III.
  const hunt = kind !== 'boss' && r.threat >= 1 && rng() < (r.threat >= 5 ? 0.3 : 0.15) * (r.bulletin === 'manhunt' ? 2 : 1);
  if (kind === 'fight' && r.threat >= 4 && rng() < 0.35) kind = 'elite';
  else if (kind === 'fight' && r.threat === 3 && rng() < 0.25) kind = 'elite';
  if (hunt && kind === 'fight' && r.threat >= 3) kind = 'elite';
  if (kind === 'fight' && r.bulletin === 'inspection' && rng() < 0.3) kind = 'elite';
  if (kind === 'fight' && r.cond === 'hunters' && rng() < 0.25) kind = 'elite';
  if (kind === 'bounty') kind = 'elite';
  const boss = kind === 'boss';
  // The level floor comes from the strongest operative still standing, not whichever player's vote opened the door:
  // in co-op that used to make the same boss tougher or softer depending on who clicked last.
  const teamLevel = Math.max(1, ...livingActors(s).map((i) => (charAt(s, i) || {}).level || 1), isCoop(s) ? 1 : (s.char.level || 1));
  const e = makeEnemy(r.sector, boss, rng, r.map, r.threat, r.reinforced || 0, Math.max(0, teamLevel - 4), hunt && !boss ? 'pursuer' : null);
  if (!boss && !hunt) applyQuirk(r, e, rng);
  if (kind === 'elite') makeElite(e, rng);
  else if (!boss && r.threat >= 2 && rng() < 0.25) giveAffix(e, rng);
  if (boss && r.threat >= 4) giveAffix(e, rng, ['armoured', 'regenerating', 'vampiric', 'relentless']);
  if (r.bulletin === 'manhunt') e.cr = e.cr.map((v) => Math.round(v * 1.4));
  if (r.bulletin === 'payday') e.hp = e.maxHp = Math.round(e.maxHp * 1.1);
  if (mutOn(r, 'hardened')) e.hp = e.maxHp = Math.round(e.maxHp * 1.25);
  if (mutOn(r, 'vicious')) e.atk = Math.round(e.atk * 1.2);
  if (r.bulletin === 'lockdown') e.atk = Math.round(e.atk * 1.1);
  if (r.bulletin === 'budget') e.def = Math.max(0, e.def - 1);
  if (r.bulletin === 'inspection') e.xp = Math.round(e.xp * 1.2);
  if (r.bulletin === 'shift' && r.room === 1 && !boss) e.stun = Math.max(e.stun, 1);
  if (mech === 'alarm' && r.alert) { e.atk = Math.round(e.atk * (1 + 0.06 * r.alert)); e.cr = e.cr.map((v) => Math.round(v * (1 + 0.05 * r.alert))); }
  if (isCoop(s)) { e.hp = e.maxHp = Math.round(e.maxHp * TUNE.coopHp); e.atk = Math.round(e.atk * TUNE.coopAtk); e.cr = e.cr.map((v) => Math.round(v * TUNE.coopCr)); }
  r.actor = livingActors(s)[0] || 0; r.acted = {}; r.round = 0; r.lastAttacker = r.actor;
  for (const b of Object.values(r.cb || {})) { const cd = b.cooldowns || {}; for (const k of b.usedThisFight || []) if (cd[k] < 50) cd[k] = Math.max(cd[k] || 0, CARRY_CD); Object.assign(b, freshBag(), { cooldowns: cd }); }
  r.enemy = e; r.defending = false; r.ready = false; r.momentum = false; r.keepDistance = false; r.adrenalUsed = false; r.vent = 3; r.storm = 4; r.turns = 0; r.alarmRaised = false; r.struck = false;
  // Unique operatives' passives, set per fighter: the Dealer cuts the deck, the Ghost shrugs off droids.
  r.rally = 0;
  forEachActor(s, (a) => {
    a.medShield = 0;
    a.fightGuard = a.background === 'ghost' && e.tags.includes('droid') ? TUNE.ghostGuard : 1;
    if (a.background === 'dealer') {
      r.card = pick(rng, ['red', 'black', 'face']); r.suit = pick(rng, ['hearts', 'spades', 'diamonds']);
      if (r.card === 'black') a.fightGuard *= 0.85;
      log(s, `${a.name} cuts the deck: ${r.card === 'red' ? 'red, +15% damage' : r.card === 'black' ? 'black, 15% less damage taken' : 'a face card, the first hit lands critical'}.`, 'good');
    }
  });
  // Skills used last fight are still recharging when the next one starts (at least 2 turns), so you can't open every fight with them.
  for (const k of r.usedThisFight || []) if (r.cooldowns[k] < 50) r.cooldowns[k] = Math.max(r.cooldowns[k] || 0, CARRY_CD);
  r.usedThisFight = [];
  if (r.room === 1 && has(c, 'forger') && !boss) { e.stun = 1; log(s, 'Your forged papers buy you a free moment.', 'good'); }
  if (hasPerk(c, 'flashbang') && !e.stun && rng() < pv(c, 'flashbang') / 100) { e.stun = 1; log(s, 'A flashbang goes off as you come in. It reels.', 'good'); }
  if (r.nextMod === 'stunned') { e.stun = Math.max(e.stun, 1); log(s, 'They don\u2019t see you coming.', 'good'); }
  if (r.nextMod === 'alerted') { e.atk = Math.round(e.atk * 1.2); log(s, 'The alarm is still sounding. They\u2019re ready for you.', 'bad'); }
  if (r.nextMod === 'weakened') { e.hp = Math.round(e.maxHp * 0.75); log(s, 'They\u2019re already hurt. Your tip was good.', 'good'); }
  // Sector conditions (v5).
  if (r.cond === 'patrol') { e.hp = e.maxHp = Math.round(e.maxHp * 1.15); e.hp = Math.min(e.hp, e.maxHp); }
  if (r.cond === 'derelict') e.atk = Math.round(e.atk * 0.9);
  if (r.cond === 'blackout') { addStatus(e.st, e.fresh, { exposed: 1 }); e.xp = Math.round(e.xp * 1.15); }
  if (r.cond === 'lockdown') e.xp = Math.round(e.xp * 1.2);
  if (r.roomType === 'bounty') { e.cr = e.cr.map((v) => Math.round(v * 1.6)); e.bounty = true; }
  r.nextMod = null;
  if (hasPerk(c, 'spotter')) addStatus(e.st, e.fresh, { exposed: pv(c, 'spotter') });
  if (hasPerk(c, 'reputation') && e.tags.includes('human')) addStatus(e.st, e.fresh, { shaken: pv(c, 'reputation') });
  if (hasPerk(c, 'tripwire')) addStatus(e.st, e.fresh, { bleed: pv(c, 'tripwire') });
  if (hasPerk(c, 'warpaint')) addStatus(e.st, e.fresh, { shaken: pv(c, 'warpaint'), exposed: pv(c, 'warpaint') });
  e.fresh = [];
  if (hasPerk(c, 'dressing')) { const st = stats(s); c.hp = Math.min(st.maxHp, c.hp + Math.round(st.maxHp * pv(c, 'dressing') / 100)); }
  if (boss) bossMeet(s, e, rng);
  log(s, boss ? e.intro.beats[e.intro.beats.length - 1] : e.line, boss ? 'boss' : 'sys');
  if (e.quirk) log(s, `${e.bark} (${quirkById(e.quirk).name}: ${quirkById(e.quirk).desc})`, 'info');
  if (e.affix) log(s, `${D.AFFIXES[e.affix].name}: ${D.AFFIXES[e.affix].desc}`, 'bad');
  s.screen = 'combat';
}

// Random personality for a regular enemy. Bulletins can force or forbid them.
function applyQuirk(r, e, rng) {
  const kind = e.tags.includes('droid') ? 'droid' : e.tags.includes('beast') ? 'beast' : 'human';
  let pool = D.QUIRKS.filter((q) => q.tags.includes(kind)), chance = 0.4;
  if (r.bulletin === 'inspection') return;
  if (r.bulletin === 'party' && kind === 'human') { pool = pool.filter((q) => ['drunk', 'hungover', 'sleepy', 'gambler'].includes(q.id)); chance = 0.85; }
  if (r.bulletin === 'budget' && kind === 'droid') { pool = pool.filter((q) => ['rusty', 'glitchy', 'outdated'].includes(q.id)); chance = 1; }
  if (!pool.length || rng() >= chance) return;
  const q = pick(rng, pool), m = q.mods || {};
  e.quirk = q.id;
  e.name = `${q.name} ${e.name}`;
  e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * (m.hp || 1)));
  e.atk = Math.max(1, Math.round(e.atk * (m.atk || 1)));
  e.def = Math.max(0, e.def + (m.def || 0));
  e.spd = Math.max(1, e.spd + (m.spd || 0));
  e.cr = e.cr.map((v) => Math.round(v * (q.cr || 1)));
  e.xp = Math.round(e.xp * (q.xp || 1));
  e.bark = pick(rng, q.barks);
  e.intents = { ...e.intents };
  if (q.noGuard) delete e.intents.guard;
  if (q.moreGuard) e.intents.guard = (e.intents.guard || 0) + 2;
  if (q.sleepy) e.stun = Math.max(e.stun, 1);
  if (q.firstGuard) { e.intent = 'guard'; e.lastIntent = 'guard'; }
}

function makeElite(e, rng) {
  e.name = `Veteran ${e.name}`; e.elite = true;
  e.hp = e.maxHp = Math.round(e.maxHp * 1.45);
  e.atk = Math.round(e.atk * 1.22); e.def += 1;
  e.cr = e.cr.map((v) => v * 2); e.xp = Math.round(e.xp * 1.5);
  giveAffix(e, rng);
}
// A veteran's affix, on its own: elites always have one, and from Threat II ordinary enemies sometimes do.
function giveAffix(e, rng, only = null) {
  const affixes = (only || Object.keys(D.AFFIXES)).filter((a) => !(a === 'relentless' && !e.intents.special) && !(a === 'volatile' && e.boss));
  e.affix = pick(rng, affixes);
  if (e.affix === 'armoured') e.def += 4;
  if (e.affix === 'berserk') { e.atk = Math.round(e.atk * 1.25); e.hp = e.maxHp = Math.round(e.maxHp * 0.85); }
  if (e.affix === 'relentless') { e.intents = { ...e.intents }; delete e.intents.guard; e.intents.special = (e.intents.special || 0) * 2; }
}

export function makeEnemy(sector, boss, rng, mapId = 'garrison', threat = 0, reinforced = 0, floorLvl = 0, forceId = null) {
  const map = mapById(mapId), eff = effSector(sector, mapId) + THREAT_DEPTH * threat;
  let id, lvl;
  if (boss) {
    const idx = sector / 5 - 1;
    id = map.bosses[idx % map.bosses.length];
    lvl = Math.round((eff / 5 - 1) * 2);
  } else {
    // The four most recently unlocked enemy types, so old enemies don't get absurdly scaled.
    const pool = map.pool.filter(([, min]) => min <= sector).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const [pid, min] = pickWeighted(rng, pool.map((p) => [p, 1 + p[1] * 0.3]));
    id = pid; lvl = eff - min;
    if (forceId) id = forceId; // a Pursuer stands in for the regular, at the same level
  }
  // A strong operative re-clearing early ground still meets enemies that take a few hits.
  lvl = Math.max(lvl, floorLvl);
  const base = D.ENEMIES[id];
  const tm = (1 + 0.12 * threat) * (1 + (TUNE.reinforce[reinforced] || 0)) * (reinforced ? 1 : TUNE.earlyCurve[eff - 1] || 1);
  const power = map.power || 1; // the endgame map hits harder and soaks more than its depth alone says
  const hp = Math.ceil(base.hp * TUNE.enemyHp * hardAt(eff).hp * tm * growth(lvl, TUNE.hpLin, TUNE.hpQuad) * (boss ? TUNE.bossHp : 1) * power);
  const e = {
    id, name: base.name, tags: base.tags || [], line: boss ? base.line : [base.line, ...(D.ENEMY_LINES[id] || [])][Math.floor(hp * 7 + sector * 13) % (1 + (D.ENEMY_LINES[id] || []).length)], portrait: base.portrait || null, boss,
    hp, maxHp: hp,
    atk: Math.round(base.atk * TUNE.enemyAtk * tm * growth(lvl, TUNE.atkLin, TUNE.atkQuad) * (boss ? TUNE.bossAtk : 1) * power),
    def: base.def + Math.floor(lvl / 2),
    spd: base.spd + Math.floor(lvl / 4),
    cr: base.cr.map((v) => Math.round(v * Math.pow(1.07, lvl) * map.credits * (1 + (TUNE.reinforce[reinforced] || 0) / 2))),
    xp: Math.round(base.xp * Math.pow(1.12, lvl) * map.xp * (1 + (TUNE.reinforce[reinforced] || 0) / 2)),
    intents: D.SPECIALS[id] ? { ...base.intents, special: Math.round(2 * TUNE.statusRate) } : base.intents,
    intent: 'attack', lastIntent: null, stun: 0, shaken: false, st: {}, fresh: [], phase2: false,
  };
  if (base.huff && !boss) e.huff = true;
  if (!boss && MAP_TACTIC[mapId]) e.intents = { ...e.intents, [MAP_TACTIC[mapId]]: TUNE.tactic };
  const mv = !boss && D.MAP_VARIANT_IDS.includes(id) && D.MAP_VARIANT[map.id];
  if (mv) {
    e.variant = map.id; // a different look, not a different name
    if (mv.hp) e.hp = e.maxHp = Math.round(e.hp * mv.hp);
    if (mv.atk) e.atk = Math.round(e.atk * mv.atk);
    if (mv.def) e.def += mv.def;
    if (mv.spd) e.spd = Math.max(1, e.spd + mv.spd);
  }
  if (boss) e.bs = bossState(e);
  e.intent = chooseIntent(e, rng);
  return e;
}

// Each of the first four districts has a move its ordinary enemies use now and then (resolved in enemyTurn).
export const MAP_TACTIC = { garrison: 'radio', foundry: 'slag', detention: 'shackle', port: 'flare' };
const MAP_TACTIC_SET = new Set(Object.values(MAP_TACTIC));
function rollIntent(e, rng, last) {
  const entries = Object.entries(e.intents).filter(([k, w]) => w > 0 &&
    !(k === 'heavy' && last === 'heavy') &&
    !(k === 'special' && last === 'special') &&
    !(k === 'guard' && last === 'guard') &&
    !(MAP_TACTIC_SET.has(k) && MAP_TACTIC_SET.has(last)) &&
    !(k === 'repair' && e.hp > e.maxHp * 0.6));
  return entries.length ? pickWeighted(rng, entries) : 'attack';
}
// The enemy's next move is rolled one turn ahead, so a scanner can show it.
function chooseIntent(e, rng) {
  if (e.boss) return bossChoose(e, rng);
  let i = e.next || rollIntent(e, rng, e.lastIntent);
  if (!e.intents[i] && i !== 'attack') i = rollIntent(e, rng, e.lastIntent);
  if (i === 'repair' && e.hp > e.maxHp * 0.6) i = 'attack';
  if (e.huff && !e.huffed && e.hp > 0 && e.hp < e.maxHp * TUNE.huffAt) i = 'huff'; // a Gas Bot that's losing gets into its own tank
  e.lastIntent = i;
  e.next = rollIntent(e, rng, i);
  return i;
}

// ---------- combat ----------
// Shoot or Strike, whichever should hit harder right now (Strike past cover, Shoot at enemies that punish melee).
export function bestAttack(s) {
  const e = s.run.enemy, st = stats(s);
  const guard = e.intent === 'guard' && !e.stun, counter = D.MELEE_COUNTER[e.id] && !e.stun;
  const heavyNext = e.intent === 'heavy' || e.intent === 'special';
  const r = st.atk * (1 + critChance(st, e) * 0.6) * (guard ? TUNE.cover : 1) * (heavyNext ? 1.1 : 1);
  const m = st.atkM * (1 + TUNE.strikeBonus + (s.char.background === 'foundry' ? TUNE.foundryStrike : 0)) * (1 + critChance(st, e, true) * 0.6) * (counter ? 0.65 : 1) * (1 + TUNE.momentum * 0.5);
  return m > r ? 'strike' : 'shoot';
}
// What the enemy's telegraphed attack can do, by the same sums as the attack itself. Null when the next move isn't a plain attack.
export function nextBossPreview(s) {
  const r = s.run; if (!r) return null;
  const next = r.sector + 1; if (!isBossSector(next)) return null;
  const e = makeEnemy(next, true, seededRng(next * 31 + 7), r.map, r.threat || 0, r.reinforced || 0, Math.max(0, (s.char.level || 1) - 4));
  return { name: e.name, hp: e.maxHp, atk: e.atk };
}
export function dotDamage(s) {
  const r = s.run, st = stats(s); if (!r || !r.pst) return 0;
  return (r.pst.bleed > 0 ? Math.max(1, Math.round(st.maxHp * 0.06)) : 0) + (r.pst.burn > 0 ? Math.max(1, Math.round(st.maxHp * 0.08)) : 0);
}
export function incomingRange(s) {
  const r = s.run, e = r.enemy, c = s.char;
  if (!e || e.stun > 0) return null;
  if (e.boss && intentHidden(s)) return null;
  if (e.intent === 'sig') return sigRange(s);
  if (e.intent === 'special') {
    // A special move: its multiplier, halved by Defend (which also blocks its status).
    const sp = D.SPECIALS[e.id];
    if (!sp || !(sp.mult > 0)) return null;
    const st = stats(s), b = e.atk * sp.mult * outMult(e.st, r.pst), lo = mitigate(b * 0.85, st.def), hi = mitigate(b * 1.15, st.def);
    const g = (n) => droneShield(c, Math.max(1, Math.round(n * TUNE.defend * (hasTrait(c, 'bulwark') ? 0.7 : 1))));
    return { min: droneShield(c, lo), max: droneShield(c, hi), defMin: g(lo), defMax: g(hi), lethal: droneShield(c, hi) >= c.hp };
  }
  if (e.intent !== 'attack' && e.intent !== 'heavy') return null;
  const st = stats(s), heavy = e.intent === 'heavy', q = e.quirk ? quirkById(e.quirk) : null;
  const twice = !heavy && e.bs && e.bs.twice; // Vane with his coat off: two lighter shots
  const base = e.atk * (heavy ? 2.2 : twice ? TWICE_MULT : 1) * outMult(e.st, r.pst);
  if (twice) {
    const lo = mitigate(base * 0.85, st.def), hi = mitigate(base * 1.15, st.def), g = (n) => droneShield(c, Math.max(1, Math.round(n * TUNE.defend * (hasTrait(c, 'bulwark') ? 0.7 : 1))));
    const hiNow = droneShield(c, hi) * 2;
    return { min: droneShield(c, lo) * 2, max: hiNow, defMin: g(lo) * 2, defMax: g(hi) * 2, lethal: hiNow >= c.hp };
  }
  const min = mitigate(base * 0.85 * (q && q.gamble ? 0.5 : 1), st.def), max = mitigate(base * 1.15 * (q && q.gamble ? 1.8 : 1), st.def);
  const guarded = (n) => droneShield(c, Math.max(1, Math.round(n * (heavy ? TUNE.defendHeavy : TUNE.defend) * (hasTrait(c, 'bulwark') ? 0.7 : 1))));
  const hiNow = droneShield(c, max);
  // A boss over half health that your best hit could push under it gains +20% ATK before it swings.
  const reach = Math.max(attackRange(s, false)[1], attackRange(s, true)[1]);
  const phaseMax = e.boss && !e.phase2 && e.hp > e.maxHp * 0.5 && e.hp - reach <= e.maxHp * 0.5 ? droneShield(c, mitigate(base * 1.2 * 1.15 * (q && q.gamble ? 1.8 : 1), st.def)) : 0;
  return { min: droneShield(c, min), max: hiNow, defMin: guarded(min), defMax: guarded(max), phaseMax, phaseDefMax: phaseMax ? guarded(mitigate(base * 1.2 * 1.15, st.def)) : 0, lethal: Math.max(hiNow, phaseMax) >= c.hp };
}
// Auto battle: a fixed, sensible routine. Never runs or uses smoke.
// opts: stimReserve (stims it must leave alone), items (false keeps thermals and ion pulses out of it).
export function autoAction(s, { stimReserve = 0, items = true } = {}) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), free = e.stun > 0;
  if (canUse(s, 'revive')) return 'revive';
  if (c.hp < st.maxHp * 0.35 && c.items.stim > stimReserve) return 'stim';
  if (!free && ((mechanicOf(r) === 'vents' && r.vent === 1) || (mechanicOf(r) === 'storm' && r.storm === 1))) return 'defend';
  const adv = sigAdvice(s), blind = intentHidden(s);
  if (!free && adv.act) return adv.act;
  if (!free && !blind && (e.intent === 'heavy' || (e.intent === 'special' && D.SPECIALS[e.id] && D.SPECIALS[e.id].status))) return 'defend';
  if (items && (e.boss || e.elite) && c.items.thermal > 0 && e.hp > e.maxHp * 0.3) return 'thermal';
  if (items && e.tags.includes('droid') && c.items.ion > 0 && !free && e.hp > e.maxHp * 0.5) return 'ion';
  // A boss can't be scared off, but losing a quarter of its ATK is worth the turn while it's still healthy.
  if (canUse(s, 'intimidate') && e.tags.includes('human') && (e.boss ? !e.shaken && e.hp > e.maxHp * 0.3 : intimidateChance(s) > 0.5)) return 'intimidate';
  const med = medicPick(s);
  if (med) return med;
  const hit = adv.hit || bestAttack(s);
  if (!free && !blind && e.intent === 'guard' && hit === 'shoot') return 'defend';
  for (const k of ['overhaul', 'pickcard', 'wink', 'overload', 'smash', 'aimed', 'blast', 'burst', 'suppress']) {
    if (!canUse(s, k) || !skillsOf(c).includes(k)) continue;
    if (k === 'smash' && D.MELEE_COUNTER[e.id] && !free) continue;
    if (!skillFits(k, adv.hit)) continue;
    return k;
  }
  return hit;
}
// What a Field Medic does with its turn, or null to just attack. Shared by auto battle and the balance bots.
export function medicPick(s) {
  const r = s.run, e = r.enemy, c = s.char;
  if (c.background !== 'medic' || !e) return null;
  const free = e.stun > 0, blind = intentHidden(s), danger = !free && !blind && (e.intent === 'heavy' || (e.intent === 'special' && D.SPECIALS[e.id] && D.SPECIALS[e.id].status) || e.intent === 'sig');
  const team = livingActors(s).map((i) => withActor(s, i, () => ({ f: s.char.hp / stats(s).maxHp, sh: s.char.medShield || 0 })));
  if (canUse(s, 'triage') && team.some((t) => t.f < 0.5)) return 'triage';
  if (canUse(s, 'barrier') && (danger || team.some((t) => !t.sh && t.f < (team.length > 1 ? 0.8 : 0.6)))) return 'barrier';
  if (canUse(s, 'rally') && !r.rally && e.hp > e.maxHp * 0.35) return 'rally';
  if (canUse(s, 'tag') && !(e.st && e.st.exposed > 0) && e.hp > e.maxHp * 0.2) return 'tag';
  return null;
}
export function runChance(s) {
  const st = stats(s), e = s.run.enemy;
  const ch = clamp(0.45 + (st.spd - e.spd) * 0.06 + (s.char.background === 'runner' ? 0.35 : 0) + markSum(s.char).escape + featBuffs(s.meta).escape + (has(s.char, 'driver') ? 0.15 : 0), 0.1, 0.95);
  return e.boss ? ch * 0.5 : ch;
}
export function dodgeChance(st, e) { return clamp(0.05 + (st.spd - e.spd) * 0.03 + (st.dodge || 0), 0, 0.45); }
export function critChance(st, e, melee = false) { return clamp((melee ? st.critM : st.crit) + (st.spd - e.spd) * 0.01, 0.02, 0.5); }
export function intimidateChance(s) {
  const e = s.run.enemy;
  const key = hasUnique(s.char, 'kell');
  if (e.boss) return 0; // bosses never run: Intimidate only shakes their aim
  if (!e.tags.includes('human') && !(key && e.tags.includes('beast'))) return 0;
  const bribe = e.quirk && quirkById(e.quirk).bribable ? 0.25 : 0;
  return clamp(0.05 + 0.05 * attr(s.char, 'cha') + (1 - e.hp / e.maxHp) * 0.2 + bribe, 0, 0.75);
}

export const partnerDown = (s) => { const pc = isCoop(s) ? charAt(s, 1 - actorIdx(s)) : null; return pc && pc.downed > 0 ? pc : null; };
export function canUse(s, act) {
  if (act === 'stim' && (mutOn(s.run, 'dry') || hasPerk(s.char, 'thirst'))) return false;
  if (act === 'revive') return !!partnerDown(s);
  if (act === 'run') return !runBlocked(s);
  if (['attack', 'shoot', 'strike', 'defend'].includes(act)) return true;
  if (D.SKILLS[act]) return skillsOf(s.char).includes(act) && !(s.run.cooldowns[act] > 0) && !redactedSkill(s, act);
  return (s.char.items[act] || 0) > 0;
}

// One weapon hit on the current enemy. melee: uses the melee weapon (ignores cover, no AGI crit). Returns damage dealt.
// Damage multiplier from everything except crits and the random roll. Shared by hits and the damage range on the buttons.
function hitMult(s, melee, { mult = 1, unarmoredBonus = 1 } = {}) {
  const r = s.run, e = r.enemy, c = s.char, mode = melee ? 'melee' : 'ranged', w = melee ? meleeOf(c) : weaponOf(c);
  const droid = e.tags.includes('droid'), human = e.tags.includes('human');
  const fb = featBuffs(s.meta);
  mult *= 1 + fb.atk + (melee ? fb.melee : fb.ranged) + (fb.vs[e.id] || 0);
  if (r.ready) mult *= hasPerk(c, 'steady') ? 1 + pv(c, 'steady') / 100 : 1.5;
  if (r.card === 'red') mult *= 1.15;
  mult *= 1 + pv(c, melee ? 'knuckles' : 'rangefinder') / 100;
  if (r.rally > 0) mult *= 1 + (isCoop(s) ? TUNE.rallyAtk : TUNE.rallySolo); // a Field Medic's Adrenal Shot, for the whole team
  if (melee && hasImp(c, 'myomer')) mult *= 1.05;
  if (melee) mult *= 1 + TUNE.strikeBonus + (c.background === 'foundry' ? TUNE.foundryStrike : 0); // up close hits harder; Shoot is the safe option
  if (r.momentum) mult *= 1 + TUNE.momentum;
  if (w.type === 'tech' && droid) mult *= 1.5;
  if (w.droid && droid) mult *= 1 + w.droid;
  if (droid) mult *= 1 + gearBonus(c, 'droid', mode) / 100;
  if (human) mult *= 1 + gearBonus(c, 'human', mode) / 100;
  if (hasTrait(c, 'executioner', mode) && e.hp < e.maxHp * 0.3) mult *= 1.4;
  if (hasUnique(c, 'crucible') && e.st.burn) mult *= 1.25;
  if (!e.tags.includes('armored')) mult *= unarmoredBonus;
  if (hasPerk(c, 'ambush') && !r.struck) mult *= 1 + pv(c, 'ambush') / 100;
  if (hasPerk(c, 'grudge') && (e.elite || e.boss)) mult *= 1 + pv(c, 'grudge') / 100;
  if (hasPerk(c, 'adrenal') && c.hp < stats(s).maxHp * 0.35) mult *= 1 + pv(c, 'adrenal') / 100;
  if (hasPerk(c, 'coupdegrace') && e.hp < e.maxHp * 0.3) mult *= 1 + pv(c, 'coupdegrace') / 100;
  if (e.bs) mult *= bossTakes(e, melee);
  return mult * outMult(r.pst, e.st);
}
const spreadOf = (melee) => (melee ? TUNE.meleeSpread : TUNE.rangedSpread);
// Damage range of a basic Shoot or Strike against the current enemy, before crits.
export function attackRange(s, melee) {
  const r = s.run, e = r.enemy, st = stats(s), sp = spreadOf(melee), m = hitMult(s, melee, { mult: redactMult(s, melee ? 'strike' : 'shoot') });
  const pierce = !melee && weaponOf(s.char).type === 'tech' ? 0.5 : 0, cover = !melee && e.intent === 'guard' && e.stun === 0 ? TUNE.cover : 1;
  const hit = (k) => Math.max(1, Math.round(mitigate((melee ? st.atkM : st.atk) * k * m, e.def * (1 - pierce)) * cover));
  return [hit(1 - sp), hit(1 + sp)];
}
function strike(s, rng, { mult = 1, critBonus = 0, pierce = 0, unarmoredBonus = 1, flat = 0, melee = false, forceCrit = false } = {}) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), mode = melee ? 'melee' : 'ranged', w = melee ? meleeOf(c) : weaponOf(c);
  const first = !r.struck;
  mult = hitMult(s, melee, { mult, unarmoredBonus });
  if (r.sugar) { mult *= 1.3; r.sugar = false; } // Sugar Rush: the next hit after the lollipop
  r.momentum = false;
  // Lights Out: a shot in the dark can go anywhere. A swing can't.
  if (!melee && e.bs && e.bs.lights > 0 && rng() < kitOf(e).moves.lights.miss) { r.struck = true; feat(s, 'shots'); return { dmg: 0, crit: false, missed: true }; }
  const crit = forceCrit || (!melee && e.sig && e.sig.id === 'salute') || (first && (hasUnique(c, 'ostrane') || c.background === 'runner' || (c.background === 'dealer' && r.card === 'face'))) || rng() < critChance(st, e, melee) + critBonus;
  if (crit) mult *= hasPerk(c, 'hollow') ? pv(c, 'hollow') : 1.6;
  if (w.type === 'tech') pierce = Math.max(pierce, 0.5);
  r.struck = true;
  feat(s, melee ? 'strikes' : 'shots'); if (crit) feat(s, 'crits');
  const sp = spreadOf(melee);
  if (hasPerk(c, 'glassheart')) mult *= 1 + pv(c, 'glassheart') / 100;
  if (hasPerk(c, 'loaded')) mult *= rng() < 0.5 ? 0.5 : pv(c, 'loaded');
  let dmg = mitigate((melee ? st.atkM : st.atk) * (1 - sp + rng() * 2 * sp) * mult + flat, e.def * (1 - pierce));
  if (!melee && e.intent === 'guard' && e.stun === 0) dmg = Math.max(1, Math.round(dmg * TUNE.cover));
  e.hp -= dmg;
  if (!melee && hasPerk(c, 'echo') && dmg > 0 && (r.echoN = (r.echoN || 0) + 1) % 3 === 0) { const x = Math.max(1, Math.round(dmg * pv(c, 'echo') / 100)); e.hp -= x; dmg += x; log(s, `Echo Chamber: a second round for ${x}.`, 'hit'); }
  if (hasPerk(c, 'thirst') && dmg > 0) c.hp = Math.min(st.maxHp, c.hp + Math.max(1, Math.round(dmg * pv(c, 'thirst') / 100)));
  if (hasPerk(c, 'executioner') && e.hp > 0 && e.hp < e.maxHp * (e.boss ? 0.08 : pv(c, 'executioner') / 100)) { log(s, `Executioner\u2019s Mark: ${e.name} is finished.`, 'crit'); dmg += e.hp; e.hp = 0; }
  if (e.hp > 0) {
    const bleed = 1 - (1 - pv(c, 'serrated') / 100) * (1 - gearBonus(c, 'bleed', mode) / 100);
    if (bleed > 0 && rng() < bleed) addStatus(e.st, e.fresh, { bleed: 2 });
    if (melee && hasUnique(c, 'crucible')) addStatus(e.st, e.fresh, { burn: 2 });
    if (hasTrait(c, 'stunner', mode) && rng() < 0.12) e.stun = Math.max(e.stun, 1);
  }
  if (hasTrait(c, 'leech', mode)) c.hp = Math.min(st.maxHp, c.hp + Math.round(dmg * 0.08));
  if (hasPerk(c, 'siphon') && dmg > 0) c.hp = Math.min(st.maxHp, c.hp + Math.max(1, Math.round(dmg * pv(c, 'siphon') / 100)));
  if (crit && !melee && hasUnique(c, 'halvek')) for (const k of Object.keys(r.cooldowns)) if (r.cooldowns[k] > 0 && r.cooldowns[k] < 50) r.cooldowns[k] -= 1;
  return { dmg, crit };
}

// Status effects on the player: Thick Skin, gear resistance, Officer's Cap and Crawler Treads can stop them.
function addPlayerStatus(s, statuses, rng) {
  const c = s.char, r = s.run, res = Math.min(75, gearBonus(c, 'resist')) / 100, out = {};
  for (const [k, n] of Object.entries(statuses || {})) {
    if (k === 'shaken' && gearFlag(c, 'noShaken')) continue;
    if (k === 'burn' && hasUnique(c, 'crawler')) continue;
    if (res && rng() < res) continue;
    out[k] = n;
  }
  return addStatus(r.pst, r.pfresh, out, pv(c, 'thick'));
}

// Some enemies punish melee: after a Strike or Power Strike.
function meleeCounter(s, rng) {
  const r = s.run, e = r.enemy, c = s.char, mc = D.MELEE_COUNTER[e.id];
  if (!mc || e.hp <= 0 || e.stun > 0) return;
  let dmg = 0;
  if (mc.mult) { dmg = mitigate(e.atk * mc.mult, stats(s).def); c.hp -= dmg; }
  const added = mc.status ? addPlayerStatus(s, e.bs && e.bs.glow ? { burn: 3 } : mc.status, rng) : [];
  fx(s, { who: 'enemy', type: 'counter', dmg, text: mc.name, statuses: added });
  log(s, `${mc.name}: ${dmg ? `you take ${dmg}` : 'it bites back'}${added.length ? ` and you are ${added.map((k) => D.STATUSES[k].name).join(' and ')}` : ''}.`, 'bad');
}

export function playerAct(s, act, rng, who = 0) {
  if (s.screen !== 'combat' || !s.run) return;
  if (isCoop(s) && (s.run.actor !== who || !aliveAt(s, who))) return;
  acting++;
  try { withActor(s, who, () => playerActInner(s, act, rng, who)); } finally { acting--; }
  // Knocked down on their own action (a counter, say): their turn passes on.
  const r = s.run;
  if (r && !s.coopDead && s.screen === 'combat' && r.enemy && !r.over && isCoop(s) && !aliveAt(s, r.actor)) {
    r.acted[r.actor] = true;
    const other = livingActors(s).find((i) => !r.acted[i]);
    if (other !== undefined) r.actor = other;
    else { r.acted = {}; enemyRound(s, rng); }
  }
  if (s.coopDead && s.run) finishCoopDeath(s, rng);
}
function playerActInner(s, act, rng, who) {
  if (!canUse(s, act)) return;
  const r = s.run, e = r.enemy, c = s.char, st = stats(s);
  r.lastAttacker = who;
  const hpBefore = e.hp;
  r.dealt = r.dealt || {};
  const wasReady = r.ready;
  r.defending = false; r.keepDistance = false;
  const guarded = e.intent === 'guard' && e.stun === 0;
  const skill = D.SKILLS[act];
  if (skill) {
    r.cooldowns[act] = hasPerk(c, 'bloodprice') ? 0 : skillCd(c, act) + 1;
    if (hasPerk(c, 'bloodprice')) { const cost = Math.max(1, Math.round(st.maxHp * pv(c, 'bloodprice') / 100)); c.hp = Math.max(1, c.hp - cost); log(s, `Blood Price: ${cost} HP.`, 'hurt'); }
    if (act !== 'intimidate' && rng() < Math.min(60, gearBonus(c, 'cooldown')) / 100) r.cooldowns[act] -= 1;
    (r.usedThisFight = r.usedThisFight || []).includes(act) || r.usedThisFight.push(act);
    feat(s, 'skills');
  }
  if (act === 'attack') act = 'shoot';

  switch (act) {
    case 'shoot': {
      const { dmg, crit, missed } = strike(s, rng, { mult: redactMult(s, 'shoot') });
      r.ready = false; r.keepDistance = true;
      fx(s, { who: 'player', type: 'shoot', dmg, crit, guarded, ready: wasReady });
      if (missed) { log(s, 'You fire into the dark and hit nothing.', 'info'); break; }
      log(s, `${wasReady ? 'Steadied shot. ' : ''}${crit ? 'Critical! ' : ''}You hit ${e.name} for ${dmg}${guarded ? ' through cover' : ''}.`, crit ? 'crit' : 'hit');
      break;
    }
    case 'strike': {
      const { dmg, crit } = strike(s, rng, { melee: true, mult: redactMult(s, 'strike') });
      r.ready = false; r.momentum = true;
      fx(s, { who: 'player', type: 'strike', dmg, crit, ready: wasReady });
      log(s, `${wasReady ? 'Braced. ' : ''}${crit ? 'Critical! ' : ''}You strike ${e.name} with the ${meleeOf(c).name} for ${dmg}${guarded ? ', straight past their cover' : ''}.`, crit ? 'crit' : 'hit');
      if (c.background === 'ghost' && e.hp > 0 && e.def > 0 && (e.cracked || 0) < TUNE.ghostCrack) { e.def -= 1; e.cracked = (e.cracked || 0) + 1; log(s, `The loader arm cracks ${e.name}\u2019s armour: DEF \u22121.`, 'good'); }
      // A repair needs both hands: a hit up close stops it.
      if (e.intent === 'radio' && e.stun === 0 && e.hp > 0) { e.intent = 'attack'; log(s, `You knock the radio out of ${e.name}\u2019s hand. Nobody\u2019s coming.`, 'good'); }
      if (e.intent === 'repair' && e.stun === 0 && e.hp > 0) { e.intent = 'attack'; log(s, `You knock the tools out of ${e.name}\u2019s hands. No repair this turn.`, 'good'); }
      meleeCounter(s, rng);
      break;
    }
    case 'aimed': {
      const { dmg, crit } = strike(s, rng, { mult: TUNE.aimed, critBonus: 0.25, forceCrit: hasUnique(c, 'vane') });
      r.ready = false;
      fx(s, { who: 'player', type: 'shoot', skill: act, dmg, crit, guarded, ready: true });
      log(s, `Aimed shot${crit ? ', critical' : ''}: ${dmg} damage.`, crit ? 'crit' : 'hit');
      break;
    }
    case 'burst': {
      const hits = [];
      for (let i = 0; i < 3 && e.hp > 0; i++) { const h = strike(s, rng, { mult: 0.55 }); hits.push(h); r.ready = false; }
      fx(s, { who: 'player', type: 'burst', hits, guarded });
      log(s, `Burst fire: ${hits.map((h) => h.dmg).join(' + ')} = ${hits.reduce((t, h) => t + h.dmg, 0)} damage.`, 'hit');
      break;
    }
    case 'blast': {
      const { dmg, crit } = strike(s, rng, { mult: 1.4, unarmoredBonus: 2 });
      r.ready = false;
      fx(s, { who: 'player', type: 'blast', dmg, crit, guarded });
      log(s, `Scatter blast: ${dmg} damage${e.tags.includes('armored') ? ' (armour absorbs the spread)' : ''}.`, crit ? 'crit' : 'hit');
      break;
    }
    case 'wink': {
      const { dmg, crit, missed } = strike(s, rng, { mult: 1 });
      r.ready = false; r.keepDistance = true;
      let note = '';
      if (e.hp > 0 && !missed && !e.tags.includes('droid')) {
        if ((e.charmed || 0) < 2) { e.atk = Math.max(1, Math.round(e.atk * 0.9)); e.charmed = (e.charmed || 0) + 1; note = ' Charmed: ATK \u221210%.'; }
        if (!e.boss) { e.stun = Math.max(e.stun, 1); note += ' It forgets what it was doing.'; }
      } else if (e.tags.includes('droid')) note = ' The droid is not impressed.';
      fx(s, { who: 'player', type: 'shoot', skill: act, dmg, crit, guarded, ready: wasReady });
      log(s, missed ? 'The kiss goes wide.' : `Blown kiss${crit ? ', critical' : ''}: ${dmg} damage.${note}`, crit ? 'crit' : 'hit');
      break;
    }
    case 'pickcard': {
      const suit = r.suit || 'hearts', { dmg, crit } = strike(s, rng, { mult: 1.25 });
      r.ready = false;
      let note = '';
      if (e.hp > 0 && suit === 'hearts') { e.stun = Math.max(e.stun, 1); note = 'Hearts: it reels, stunned.'; }
      if (e.hp > 0 && suit === 'spades') { addStatus(e.st, e.fresh, { bleed: 3 }); note = 'Spades: it bleeds.'; }
      if (suit === 'diamonds') { const take = Math.max(3, Math.round(4 * payDepth(r) * creditMult(s))); c.credits += take; r.sectorCredits = (r.sectorCredits || 0) + take; ledger(s, 'fights', take); note = `Diamonds: you lift ${take} ${D.SETTING.cur}.`; }
      fx(s, { who: 'player', type: 'shoot', skill: act, dmg, crit, guarded, ready: wasReady });
      log(s, `Pick a card${crit ? ', critical' : ''}: ${dmg} damage. ${note}`, crit ? 'crit' : 'hit');
      r.suit = pick(rng, ['hearts', 'spades', 'diamonds']);
      break;
    }
    case 'overhaul': {
      const { dmg, crit } = strike(s, rng, { mult: TUNE.overhaulMult, melee: true });
      r.ready = false;
      const heal = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * TUNE.overhaulHeal)); c.hp += heal;
      let note = '';
      if (e.hp > 0 && e.tags.includes('droid') && (e.overhauled || 0) < 2) { e.atk = Math.max(1, Math.round(e.atk * 0.85)); e.overhauled = (e.overhauled || 0) + 1; note = ' A part comes away in the arm: ATK \u221215%.'; }
      else if (e.hp > 0 && !e.tags.includes('droid') && (e.torn || 0) < TUNE.overhaulTears) { e.def = Math.max(0, e.def - TUNE.overhaulTear); e.torn = (e.torn || 0) + 1; note = ` Their kit tears: DEF \u2212${TUNE.overhaulTear}.`; }
      fx(s, { who: 'player', type: 'smash', skill: act, dmg, crit });
      log(s, `Overhaul${crit ? ', critical' : ''}: ${dmg} damage, +${heal} HP.${note}`, crit ? 'crit' : 'hit');
      meleeCounter(s, rng);
      break;
    }
    case 'smash': {
      const { dmg, crit } = strike(s, rng, { mult: 1.6, pierce: 0.5, flat: attr(c, 'str') * TUNE.smashStr, melee: true });
      r.ready = false;
      const stun = hasUnique(c, 'brask') && e.hp > 0;
      if (stun) e.stun = Math.max(e.stun, 1);
      fx(s, { who: 'player', type: 'smash', dmg, crit });
      log(s, `Power strike${crit ? ', critical' : ''}: ${dmg} damage${stun ? ', and they\u2019re seeing stars' : ''}.`, crit ? 'crit' : 'hit');
      meleeCounter(s, rng);
      break;
    }
    case 'overload': {
      const droid = e.tags.includes('droid');
      const dmg = Math.round((6 + attr(c, 'int') * TUNE.intOverload + r.sector * 2) * (droid ? 2 : 1) * (1 + pv(c, 'capacitor') / 100) * (1 + ((baseOf(gearIn(c, 'gadget')) || {}).overload || 0)) * outMult(r.pst, e.st) * bossOpen(e));
      e.hp -= dmg;
      if (droid) e.stun = Math.max(e.stun, 1);
      fx(s, { who: 'player', type: 'overload', dmg, droid });
      log(s, `Overload! ${dmg} damage${droid ? ', circuits fried, stunned' : ''}.`, 'crit');
      break;
    }
    case 'suppress': {
      const { dmg } = strike(s, rng, { mult: 0.6 });
      r.ready = false;
      if (e.hp > 0 && e.stun === 0) { e.intent = 'guard'; e.lastIntent = 'guard'; e.suppressed = true; }
      fx(s, { who: 'player', type: 'burst', hits: [{ dmg, crit: false }], guarded, suppress: true });
      log(s, `Suppressing fire: ${dmg} damage. ${e.name} is pinned behind cover.`, 'hit');
      break;
    }
    case 'intimidate': {
      r.cooldowns.intimidate = 99;
      const ok = rng() < intimidateChance(s);
      fx(s, { who: 'player', type: 'intimidate', ok });
      if (ok) { log(s, `${e.name} breaks and runs.`, 'good'); return winFight(s, rng, true); }
      const keyed = e.boss && hasUnique(c, 'kell'); // Kell's Cell Key: a boss won't run, but it shakes them harder
      const drop = keyed ? 0.4 : Math.min(0.4, 0.25 + 0.02 * Math.max(0, attr(c, 'cha') - 3)); // the louder the voice, the worse their aim
      e.atk = Math.max(1, Math.round(e.atk * (1 - drop))); e.shaken = true;
      log(s, `${e.name} ${e.boss ? 'will never run' : 'doesn\u2019t run'}, but their aim is shaking. ATK \u2212${Math.round(drop * 100)}%.`, 'info');
      break;
    }
    case 'barrier': {
      // Field Shield: a shield on every living operative, a share of their own max HP. It soaks hits until it breaks or the fight ends.
      const share = (isCoop(s) ? TUNE.medShield : TUNE.medShieldSolo) * st.tech, got = [];
      for (const i of livingActors(s)) withActor(s, i, () => { const pc = s.char, amt = Math.round(stats(s).maxHp * share); pc.medShield = Math.max(pc.medShield || 0, amt); got.push(`${i === who ? 'you' : firstName(pc)} ${pc.medShield}`); fx(s, { who: 'player', type: 'barrier', amt: pc.medShield, actor: i }); });
      if (!isCoop(s)) r.ready = true; // alone, the medic steadies behind its own shield: next shot +50%
      log(s, `Field Shield up: ${got.join(', ')}.${isCoop(s) ? '' : ' Next shot +50%.'}`, 'good');
      break;
    }
    case 'rally': {
      r.rally = TUNE.rallyTurns;
      const pct = Math.round((isCoop(s) ? TUNE.rallyAtk : TUNE.rallySolo) * 100);
      fx(s, { who: 'player', type: 'rally', pct });
      log(s, `Adrenal shot${isCoop(s) ? 's all round' : ''}: ${isCoop(s) ? 'everyone hits' : 'you hit'} ${pct}% harder for ${TUNE.rallyTurns} rounds.`, 'good');
      break;
    }
    case 'sugar': {
      // Mochi's lollipop: a heal, a clean slate and a sugar high for the next hit.
      const mx = st.maxHp, amt = Math.min(mx - c.hp, Math.round(mx * 0.15));
      c.hp += amt; for (const k of ['shaken', 'exposed', 'bleed', 'burn']) delete r.pst[k];
      r.sugar = true;
      fx(s, { who: 'player', type: 'stim', amt, skill: 'sugar' });
      log(s, `Sugar Rush: a long lick of the lollipop. +${amt} HP, and the next hit lands harder.`, 'good');
      break;
    }
    case 'triage': {
      // Patches up whoever is worst off, and stops their bleeding and burns.
      const tech = st.tech, hurt = livingActors(s).map((i) => withActor(s, i, () => ({ i, f: s.char.hp / stats(s).maxHp }))).sort((a, b) => a.f - b.f)[0];
      const t = hurt ? hurt.i : who;
      withActor(s, t, () => { const pc = s.char, mx = stats(s).maxHp, amt = Math.min(mx - pc.hp, Math.round(mx * TUNE.triageHeal * tech)); pc.hp += amt; delete s.run.pst.bleed; delete s.run.pst.burn;
        fx(s, { who: 'player', type: 'stim', amt, actor: t, triage: true }); log(s, `Triage: ${t === who ? 'you patch yourself up' : `you patch ${firstName(pc)} up`}. +${amt} HP.`, 'good'); });
      break;
    }
    case 'tag': {
      const { dmg, crit, missed } = strike(s, rng, { mult: isCoop(s) ? TUNE.tagMult : TUNE.tagSolo });
      r.ready = false; r.keepDistance = true;
      if (e.hp > 0 && !missed) addStatus(e.st, e.fresh, { exposed: TUNE.tagExposed });
      fx(s, { who: 'player', type: 'shoot', skill: act, dmg, crit, guarded, ready: wasReady });
      log(s, missed ? 'The tag goes wide.' : `Tagged${crit ? ', critical' : ''}: ${dmg} damage, and ${e.name} is Exposed for ${TUNE.tagExposed} turns.`, crit ? 'crit' : 'hit');
      break;
    }
    case 'defend':
      r.defending = true; r.ready = true;
      if (hasPerk(c, 'secondwind')) c.hp = Math.min(st.maxHp, c.hp + Math.round(st.maxHp * pv(c, 'secondwind') / 100));
      fx(s, { who: 'player', type: 'defend' });
      log(s, 'You drop behind cover and steady your aim. Next shot +50%.', 'info');
      break;
    case 'stim': {
      c.items.stim -= 1;
      const amt = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.4 * st.tech * (1 + st.stimBoost) * (c.background === 'medic' ? 1 + TUNE.medStim : 1)));
      c.hp += amt;
      delete r.pst.bleed; delete r.pst.burn; feat(s, 'stims');
      fx(s, { who: 'player', type: 'stim', amt });
      log(s, `You jam a stim into your thigh. +${amt} HP.`, 'good');
      break;
    }
    case 'thermal': {
      c.items.thermal -= 1;
      const dmg = Math.round((20 + r.sector * 4) * st.tech * outMult(r.pst, e.st) * bossOpen(e));
      e.hp -= dmg;
      if (hasPerk(c, 'incendiary') && e.hp > 0) addStatus(e.st, e.fresh, { burn: pv(c, 'incendiary') });
      fx(s, { who: 'player', type: 'thermal', dmg });
      log(s, `Thermal charge! ${e.name} takes ${dmg}, armour or not.`, 'crit');
      break;
    }
    case 'ion': {
      c.items.ion -= 1;
      const droid = e.tags.includes('droid');
      e.stun = (droid ? 3 : 1) + (hasPerk(c, 'capacitor') ? 1 : 0);
      const ionDmg = droid ? Math.round((12 + r.sector * 2) * st.tech) : 0;
      e.hp -= ionDmg;
      fx(s, { who: 'player', type: 'ion', dmg: ionDmg, droid });
      log(s, droid ? `The ion pulse fries ${e.name}\u2019s circuits for ${ionDmg}. Stunned for 3 turns.` : `The ion pulse leaves ${e.name} reeling. Stunned for a turn.`, droid ? 'crit' : 'hit');
      break;
    }
    case 'revive': {
      const other = 1 - who, back = c.background === 'medic' ? TUNE.medRevive : TUNE.reviveHp;
      withActor(s, other, () => { const pc = s.char; pc.downed = 0; pc.hp = Math.round(stats(s).maxHp * back); });
      fx(s, { who: 'player', type: 'revived', actor: other });
      log(s, `You drag ${charAt(s, other).name} back to their feet.`, 'good');
      break;
    }
    case 'smoke':
      c.items.smoke -= 1;
      { const away = rng() < TUNE.smokeEscape; fx(s, { who: 'player', type: 'smoke', ok: away }); if (away) { log(s, 'Smoke fills the corridor. You\u2019re gone before it clears.', 'sys'); return endRun(s, 'escaped', rng); } }
      { log(s, 'The smoke thins too fast. They still have you in sight.', 'bad'); break; }
    case 'run': {
      const ok = rng() < runChance(s);
      fx(s, { who: 'player', type: 'run', ok });
      if (ok) { log(s, 'You break line of sight and run for the exit.', 'sys'); return endRun(s, 'escaped', rng); }
      log(s, 'You try to break away, but they cut you off.', 'bad');
      raiseAlarm(s, 1, 'Your escape attempt was spotted.');
      break;
    }
  }
  if (e.bs) bossAfterAct(s, act, who, rng);
  tick(r);
  r.dealt[who] = (r.dealt[who] || 0) + Math.max(0, hpBefore - e.hp);
  r.dmgDone = (r.dmgDone || 0) + Math.max(0, hpBefore - e.hp); // for the payout tally only
  if (c.hp <= 0 && !lethalSave(s)) return die(s, e);
  if (e.hp <= 0) return winFight(s, rng);
  if (!e.boss && e.quirk && quirkById(e.quirk).flee && e.hp < e.maxHp * 0.2) {
    fx(s, { who: 'enemy', type: 'quirk', text: 'Nope!' });
    log(s, `${e.name} decides this isn\u2019t worth it and runs.`, 'good');
    return winFight(s, rng, true);
  }
  droneTurn(s, rng, who);
  if (hasPerk(s.char, 'overclock') && s.run && s.run.enemy && s.run.enemy.hp > 0) droneTurn(s, rng, who);
  if (e.hp <= 0) return winFight(s, rng);
  checkPhase(s);
  // In co-op the other operative acts before the enemy does.
  if (isCoop(s)) {
    r.acted[who] = true;
    const other = livingActors(s).find((i) => i !== who && !r.acted[i]);
    if (other !== undefined) { r.actor = other; fx(s, { who: 'player', type: 'handoff', actor: other }); return; }
    r.acted = {};
  }
  if (r.allies > 0 && !(e.bs && e.bs.count > 0)) {
    for (let i = 0; i < r.allies && e.hp > 0; i++) {
      const dmg = mitigate(st.atk * (c.background === 'preacher' ? 0.5 : 0.3) * (0.85 + rng() * 0.3), e.def);
      e.hp -= dmg;
      fx(s, { who: 'ally', type: 'shoot', dmg });
      log(s, `A freed prisoner hits ${e.name} for ${dmg}.`, 'hit');
    }
    if (e.hp <= 0) return winFight(s, rng);
  }
  enemyRound(s, rng);
}
// The enemy's turn, then the room and status effects for every operative. In co-op the enemy picks a target,
// and every other round it gets a second action: there are two of you to shoot at.
const fighting = (s) => s.screen === 'combat' && s.run && s.run.enemy && !s.run.over;
function enemyRound(s, rng) {
  const r = s.run;
  r.round += 1;
  if (r.enemy && r.enemy.bs) bossTick(s);
  const coop = isCoop(s), actions = coop && !r.fallen && r.round % TUNE.coopExtra === 0 ? 2 : 1;
  for (let n = 0; n < actions && fighting(s); n++) {
    const t = coop ? pickTarget(s, rng) : 0;
    if (coop) fx(s, { who: 'enemy', type: 'target', actor: t });
    withActor(s, t, () => enemyTurn(s, rng));
  }
  let first = true;
  for (const i of livingActors(s)) { if (!fighting(s)) break; withActor(s, i, () => envTurn(s, rng, first)); first = false; }
  first = true;
  for (const i of livingActors(s)) { if (!fighting(s)) break; withActor(s, i, () => statusTurn(s, rng, first)); first = false; }
  r.dealt = {};
  if (r.rally > 0) r.rally -= 1;
  bleedTick(s);
  // Take turns going first.
  if (fighting(s) && coop) { const alive = livingActors(s); r.actor = alive[r.round % alive.length]; }
}

// A downed operative bleeds a little closer to death at the end of every round.
function bleedTick(s) {
  if (!fighting(s)) return;
  for (const i of [0, 1]) {
    const pc = charAt(s, i);
    if (!pc || !pc.downed) continue;
    pc.downed -= 1;
    if (pc.downed > 0) { log(s, `${pc.name} is bleeding out: ${pc.downed} round${pc.downed > 1 ? 's' : ''} left.`, 'bad'); continue; }
    withActor(s, i, () => reallyDie(s, { name: 'blood loss', id: null }));
  }
}

// Bosses change at 75%, 50% and 25% health: see the boss section below.
// Survive a killing blow once per raid with Dead Man's Switch.
function lethalSave(s) {
  const r = s.run, c = s.char;
  if (c.hp > 0 || !hasPerk(c, 'deadman') || r.deadmanUsed) return false;
  r.deadmanUsed = true; c.hp = Math.max(1, Math.round(stats(s).maxHp * pv(c, 'deadman') / 100));
  fx(s, { who: 'player', type: 'deadman' });
  log(s, `Dead Man\u2019s Switch: you refuse to go down. ${c.hp} HP.`, 'good');
  return true;
}

// End of round: damage over time, regeneration, durations tick down.
function statusTurn(s, rng, enemyToo = true) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s);
  const tickSide = (obj, fresh, maxHp) => {
    let dmg = 0;
    for (const k of Object.keys(obj)) {
      if (fresh.includes(k)) continue;
      if (k === 'bleed') dmg += Math.max(1, Math.round(maxHp * 0.06));
      if (k === 'burn') dmg += Math.max(1, Math.round(maxHp * 0.08));
      obj[k] -= 1;
      if (obj[k] <= 0) delete obj[k];
    }
    fresh.length = 0;
    return dmg;
  };
  const pd = tickSide(r.pst, r.pfresh, st.maxHp);
  const ed = enemyToo ? tickSide(e.st, e.fresh, e.maxHp) : 0;
  let regen = 0;
  if (enemyToo && e.affix === 'regenerating') { regen = Math.min(e.maxHp - e.hp, Math.round(e.maxHp * 0.06)); e.hp += regen; }
  const sd = enemyToo && e.quirk && quirkById(e.quirk).selfDamage;
  let selfDmg = 0;
  if (sd) { selfDmg = Math.max(1, Math.round(e.maxHp * sd)); e.hp -= selfDmg; }
  if (pd || ed || regen || selfDmg) {
    c.hp -= pd; e.hp -= ed;
    fx(s, { who: 'status', pdmg: pd, edmg: ed + selfDmg, regen });
    if (selfDmg) log(s, `${e.name} overheats for ${selfDmg}.`, 'hit');
    if (pd) log(s, `You lose ${pd} HP to your wounds.`, 'hurt');
    if (ed) log(s, `${e.name} loses ${ed} HP to its wounds.`, 'hit');
    if (regen) log(s, `${e.name} regenerates ${regen} HP.`, 'hurt');
  }
  if (c.hp <= 0 && !lethalSave(s)) return die(s, { name: pd ? 'their wounds' : e.name, id: pd ? null : e.id });
  if (e.hp <= 0) return winFight(s, rng);
  checkPhase(s);
}

// Skill cooldowns count down once per player turn and persist across fights in the same sector.
function tick(r) {
  for (const k of Object.keys(r.cooldowns)) if (r.cooldowns[k] > 0 && r.cooldowns[k] < 50) r.cooldowns[k] -= 1;
}

// Map mechanics that act at the end of each round.
function envTurn(s, rng, enemyToo = true) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), mech = mechanicOf(r);
  if (enemyToo) r.turns += 1;
  if (mech === 'vents') {
    if (enemyToo) { r.vent -= 1; r.ventNow = r.vent <= 0; if (r.ventNow) r.vent = 3; }
    if (r.ventNow) {
      const pdmg = r.defending ? 0 : Math.round(st.maxHp * 0.1 * (hasUnique(c, 'crawler') ? 0.5 : 1));
      const edmg = enemyToo ? Math.round(e.maxHp * (e.boss ? 0.04 : e.tags.includes('droid') ? 0.06 : 0.12)) : 0;
      c.hp -= pdmg; e.hp -= edmg;
      fx(s, { who: 'env', type: 'vent', pdmg, edmg, blocked: r.defending });
      log(s, `The furnace vents blast the floor.${pdmg ? ` You take ${pdmg}.` : ' You were behind cover.'}${edmg ? ` ${e.name} takes ${edmg}.` : ''}`, 'bad');
      if (c.hp <= 0 && !lethalSave(s)) return die(s, { name: 'furnace vent', id: null });
      if (e.hp <= 0) return winFight(s, rng);
      checkPhase(s);
    }
  } else if (mech === 'storm') {
    // Spore storms: every fourth round. Defend to shelter. Native beasts don't mind; everything else chokes a little.
    if (enemyToo) { r.storm = (r.storm || 4) - 1; r.stormNow = r.storm <= 0; if (r.stormNow) r.storm = 4; }
    if (r.stormNow) {
      const pdmg = r.defending ? 0 : Math.round(st.maxHp * 0.06 * (hasUnique(c, 'crawler') ? 0.5 : 1));
      const edmg = enemyToo && !e.tags.includes('beast') ? Math.round(e.maxHp * (e.boss ? 0.02 : 0.04)) : 0;
      c.hp -= pdmg; e.hp -= edmg;
      const added = r.defending ? [] : addPlayerStatus(s, { exposed: 1 }, rng);
      fx(s, { who: 'env', type: 'storm', pdmg, edmg, blocked: r.defending, statuses: added });
      log(s, `A spore storm rolls across the field.${pdmg ? ` You take ${pdmg} and can\u2019t see straight.` : ' You sit it out behind cover.'}${edmg ? ` ${e.name} takes ${edmg}.` : ''}`, 'bad');
      if (c.hp <= 0 && !lethalSave(s)) return die(s, { name: 'spore storm', id: null });
      if (e.hp <= 0) return winFight(s, rng);
      checkPhase(s);
    }
  } else if (mech === 'snipers' && (r.flared || rng() < sniperChance(r))) {
    r.flared = false; // a flare guarantees the next shot
    const dmg = r.defending ? 0 : Math.round(st.maxHp * 0.08 * (hasUnique(c, 'crawler') ? 0.5 : 1));
    c.hp -= dmg;
    fx(s, { who: 'env', type: 'sniper', dmg, blocked: r.defending });
    log(s, dmg ? `A tower sniper clips you for ${dmg}.` : 'A sniper round sparks off your cover.', dmg ? 'bad' : 'info');
    if (c.hp <= 0 && !lethalSave(s)) return die(s, { name: 'tower sniper', id: null });
  } else if (enemyToo && mech === 'alarm' && r.turns === 5 && !r.alarmRaised) {
    r.alarmRaised = true;
    raiseAlarm(s, 1, 'The fight is dragging on. Someone hit the alarm.');
  }
}

function enemyTurn(s, rng) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s);
  const vamp = (dmg) => { if (e.affix === 'vampiric' && dmg > 0) { e.hp = Math.min(e.maxHp, e.hp + Math.round(dmg / 2)); } };
  const reflect = (dmg) => { if (dmg > 0 && hasTrait(c, 'reactive')) e.hp -= Math.max(1, Math.round(dmg * 0.2)); };
  const q = e.quirk ? quirkById(e.quirk) : null;
  if (q && q.skip && e.stun === 0 && rng() < q.skip) {
    const lines = ['freezes mid-step and reboots', 'plays a recorded safety announcement', 'spins in a slow circle', 'displays a loading bar'];
    const what = pick(rng, lines);
    fx(s, { who: 'enemy', type: 'quirk', text: 'Glitch!' });
    log(s, `${e.name} ${what}.`, 'good');
    nextIntent(s, e, rng);
    return;
  }
  if (e.stun === 0 && !e.tags.includes('droid') && (e.intent === 'attack' || e.intent === 'heavy' || e.intent === 'special') && rng() < Math.min(0.35, TUNE.chaHesitate * attr(c, 'cha')) * (e.boss ? 0.5 : 1)) {
    fx(s, { who: 'enemy', type: 'quirk', text: 'Hesitates' });
    log(s, `${e.name} hesitates. Something in your voice made them think twice.`, 'good');
    nextIntent(s, e, rng);
    return;
  }
  if (e.stun > 0) {
    e.stun -= 1;
    fx(s, { who: 'enemy', type: 'stunned' });
    log(s, `${e.name} is stunned and can\u2019t act.`, 'good');
  } else if (e.intent === 'attack' || e.intent === 'heavy') {
    const heavy = e.intent === 'heavy', twice = !heavy && e.bs && e.bs.twice;
    for (let shot = 0; shot < (twice ? 2 : 1) && c.hp > 0; shot++) {
    if (e.bs && e.bs.wide && !heavy && rng() < e.bs.wide) {
      fx(s, { who: 'enemy', type: e.intent, dodged: true, missed: true, dmg: 0 });
      log(s, `The shot goes wide. Someone in there is panicking.`, 'good');
    } else if (r.allies > 0 && rng() < 0.25) {
      // A freed prisoner soaks the shot. It takes a few to put one down.
      r.allyHits = (r.allyHits || 0) + 1;
      fx(s, { who: 'enemy', type: e.intent, ally: true, allyDown: r.allyHits >= TUNE.allyGrit, dmg: 0 });
      if (r.allyHits >= TUNE.allyGrit) { r.allyHits = 0; r.allies -= 1; log(s, `${e.name} guns down one of the freed prisoners.`, 'bad'); }
      else log(s, `${e.name} hits a freed prisoner. They stay up (${TUNE.allyGrit - r.allyHits} more would do it).`, 'hurt');
    } else if (q && q.miss && rng() < q.miss) {
      fx(s, { who: 'enemy', type: e.intent, dodged: true, missed: true, dmg: 0 });
      log(s, `${e.name} ${pick(rng, q.misses)}.`, 'good');
    } else if (droneHas(droneOf(c), D.DRONE_AB.mid) && droneOf(c).type === 'aegis' && rng() < 0.08) {
      const d = droneOf(c), zap = droneHas(d, D.DRONE_AB.top) ? Math.max(1, Math.round(st.atk)) : 0;
      e.hp -= zap;
      fx(s, { who: 'drone', type: 'block', drone: d.type, dmg: zap });
      log(s, `${D.DRONES[d.type].name} stops the attack cold${zap ? ` and zaps ${e.name} for ${zap}` : ''}.`, 'good');
    } else if (rng() < dodgeChance(st, e)) {
      feat(s, 'dodges');
      fx(s, { who: 'enemy', type: e.intent, dodged: true, dmg: 0 });
      log(s, `${e.name} ${heavy ? 'unleashes a heavy strike' : 'fires'}, and you dodge.`, 'good');
    } else {
      const luck = q && q.gamble ? (rng() < 0.5 ? 0.5 : 1.8) : 1;
      let dmg = mitigate(e.atk * (0.85 + rng() * 0.3) * (heavy ? 2.2 : twice ? TWICE_MULT : 1) * luck * outMult(e.st, r.pst) * (r.keepDistance ? 1 - TUNE.shootGuard : 1), st.def);
      if (r.defending) dmg = Math.max(1, Math.round(dmg * (heavy ? TUNE.defendHeavy : TUNE.defend) * (hasTrait(c, 'bulwark') ? 0.7 : 1)));
      dmg = soak(s, c, droneShield(c, dmg));
      c.hp -= dmg; vamp(dmg); reflect(dmg);
      if (r.defending && hasPerk(c, 'mirror') && dmg > 0 && e.hp > 0) { const back = Math.max(1, Math.round(dmg * pv(c, 'mirror') / 100 / Math.max(0.2, heavy ? TUNE.defendHeavy : TUNE.defend))); e.hp -= back; log(s, `Mirror Plate: ${back} goes back at them.`, 'hit'); }
      if (r.defending && hasPerk(c, 'riposte') && e.hp > 0) { const back = Math.max(1, Math.round(st.atk * pv(c, 'riposte') / 100)); e.hp -= back; log(s, `Riposte: you hit back for ${back}.`, 'hit'); }
      if (q && q.bleedOnHit && !r.defending) addPlayerStatus(s, { bleed: 2 }, rng);
      if (luck !== 1) log(s, luck > 1 ? 'The gamble pays off for them.' : 'Their gamble doesn\u2019t pay off.', 'info');
      fx(s, { who: 'enemy', type: e.intent, dmg, blocked: r.defending });
      log(s, `${e.name} ${heavy ? 'lands a heavy strike' : 'hits you'} for ${dmg}${r.defending ? ' (blocked)' : ''}.`, heavy ? 'bad' : 'hurt');
    }
    }
  } else if (e.intent === 'sig') {
    sigTurn(s, rng, vamp, reflect);
    if (s.run !== r || r.enemy !== e) return;
  } else if (e.intent === 'special') {
    const sp = D.SPECIALS[e.id];
    let dmg = sp.mult > 0 ? mitigate(e.atk * (0.85 + rng() * 0.3) * sp.mult * outMult(e.st, r.pst) * (r.keepDistance ? 1 - TUNE.shootGuard : 1), st.def) : 0;
    if (r.defending) dmg = Math.max(dmg ? 1 : 0, Math.round(dmg * TUNE.defend * (hasTrait(c, 'bulwark') ? 0.7 : 1)));
    dmg = soak(s, c, droneShield(c, dmg));
    c.hp -= dmg; vamp(dmg); reflect(dmg);
    const added = r.defending ? [] : addPlayerStatus(s, sp.status, rng);
    fx(s, { who: 'enemy', type: 'special', name: sp.name, dmg, blocked: r.defending, statuses: added });
    log(s, `${e.name}: ${sp.name}${dmg ? ` for ${dmg}` : ''}${r.defending ? ', mostly blocked' : ''}.${added.length ? ` You are ${added.map((k) => D.STATUSES[k].name).join(' and ')}.` : ''}`, 'bad');
  } else if (e.intent === 'guard') {
    fx(s, { who: 'enemy', type: 'guard' });
    log(s, `${e.name} ${e.suppressed ? 'stays pinned' : 'holds position'} behind cover.`, 'info');
    e.suppressed = false;
  } else if (e.intent === 'radio') {
    raiseAlarm(s, 1, `${e.name} gets through on the radio.`);
    const add = Math.round(e.maxHp * 0.1); e.maxHp += add; e.hp += add; e.def += 1;
    fx(s, { who: 'enemy', type: 'special', name: 'Calling it in', dmg: 0 });
    log(s, `${e.name} digs in while backup is on the way: +${add} HP, +1 DEF.`, 'bad');
  } else if (e.intent === 'slag') {
    let dmg = mitigate(e.atk * 1.3 * (0.9 + rng() * 0.2) * outMult(e.st, r.pst), st.def);
    if (r.defending) dmg = Math.max(1, Math.round(dmg * TUNE.defend));
    dmg = soak(s, c, droneShield(c, dmg)); c.hp -= dmg;
    const added = r.defending ? [] : addPlayerStatus(s, { burn: 2 }, rng);
    fx(s, { who: 'enemy', type: 'special', name: 'Molten slag', dmg, blocked: r.defending, statuses: added });
    log(s, `${e.name} flings molten slag for ${dmg}${r.defending ? ', mostly blocked' : ''}.${added.length ? ' You\u2019re Burning.' : ''}`, 'bad');
  } else if (e.intent === 'net') {
    const added = r.defending ? [] : addPlayerStatus(s, { exposed: 2, shaken: 2 }, rng);
    fx(s, { who: 'enemy', type: 'special', name: 'Net launcher', dmg: 0, blocked: r.defending, statuses: added });
    log(s, r.defending ? `${e.name} fires a net. You roll clear.` : `${e.name} nets you. You\u2019re Exposed and Shaken.`, 'bad');
  } else if (e.intent === 'shackle' || e.intent === 'flare') {
    const shackle = e.intent === 'shackle', added = r.defending ? [] : addPlayerStatus(s, shackle ? { shaken: 2 } : { exposed: 2 }, rng);
    if (!shackle && !r.defending) r.flared = true;
    fx(s, { who: 'enemy', type: 'special', name: shackle ? 'Shackles' : 'Flare', dmg: 0, blocked: r.defending, statuses: added });
    log(s, r.defending ? `${e.name} ${shackle ? 'swings the shackles' : 'pops a flare'}, but you\u2019re braced and out of the way.` : shackle ? `${e.name} catches you with the shackles. You\u2019re Shaken.` : `${e.name} lights you up with a flare. The towers can see you: Exposed.`, 'bad');
  } else if (e.intent === 'huff') {
    // High on its own supply: it swells, heals, hits harder and starts gassing you. Worth more if you still put it down.
    const was = e.maxHp;
    e.huffed = true; e.name = `${e.name}, Blazed`;
    e.maxHp = Math.round(was * TUNE.huffHp); e.hp = Math.min(e.maxHp, e.hp + (e.maxHp - was) + Math.round(e.maxHp * TUNE.huffHeal));
    e.atk = Math.round(e.atk * TUNE.huffAtk); e.spd += 2;
    e.intents = { ...e.intents, special: (e.intents.special || 0) + 3 }; // and it's generous with the gas now
    e.cr = e.cr.map((n) => Math.round(n * 1.5)); e.xp = Math.round((e.xp || 0) * 1.5);
    fx(s, { who: 'enemy', type: 'huff', maxHp: e.maxHp, name: e.name });
    log(s, `${e.name.replace(', Blazed', '')} jams its nozzle in its own intake and takes a long pull. It swells, twitching. ATK +${Math.round((TUNE.huffAtk - 1) * 100)}%.`, 'bad');
  } else if (e.intent === 'repair') {
    const amt = Math.min(e.maxHp - e.hp, Math.round(e.maxHp * 0.15));
    e.hp += amt;
    fx(s, { who: 'enemy', type: 'repair', amt });
    log(s, `${e.name} runs a repair cycle. +${amt} HP.`, 'hurt');
  }
  if (c.hp > 0 && c.hp < st.maxHp * 0.3 && hasImp(c, 'adrenal') && !r.adrenalUsed) {
    r.adrenalUsed = true;
    const amt = Math.round(st.maxHp * 0.4); c.hp = Math.min(st.maxHp, c.hp + amt);
    fx(s, { who: 'player', type: 'stim', amt, adrenal: true });
    log(s, `Adrenal pump kicks in. +${amt} HP.`, 'good');
  }
  if (c.hp <= 0 && !lethalSave(s)) return die(s, e);
  if (e.hp <= 0) return winFight(s, rng);
  nextIntent(s, e, rng);
  if (e.bs) bossTaunt(s);
}

// ---------- bosses: signature moves, phases and lines ----------
// Everything lives on the enemy (e.bs, e.sig, e.say) or the operative (c.bossMet, c.bossBeat), so it saves and reaches a co-op friend with the rest of the state.
// Rules and numbers are D.BOSS_KIT. e.sig is a move on its way: { id, n, left, startHp }. Dialogue picks lines without touching the game's rng, so it can't shift a fight.
const TWICE_MULT = 0.7;
const firstName = (c) => String((c && c.name) || 'operative').split(' ')[0];
const bossKey = (r, e) => `${e.id}:${r.map}`;
const bossState = (e) => ({ phase: e.phase2 ? 50 : 100, cd: 1, last: null, since: 0, every: null, says: 0, shutter: 0, floor: 0, front: 0, lights: 0, count: 0, wreck: 0, redact: null, noRun: false,
  frontFired: false, frontHeld: false, taken: [], lastAtk: {}, used: {}, taunts: 0, lastTaunt: -9, wide: 0, glow: false, brittle: false, twice: false, snipers: 0, floorTurns: 3, auditCount: 2, late: false });
const kitOf = (e) => D.BOSS_KIT[e.id] || { rate: 0, cd: 99, moves: {}, notes: {} };
const bsOf = (e) => (e.bs || (e.bs = bossState(e))); // a boss fight saved before these rules existed picks them up here
// Several bosses share a move, so the engine's own lines name the boss from D.BOSS_INFO (short, he/she/it), and a move can
// bring its own words in lore.js (BOSS_MOVES[boss][move].fail, .ion, .charge, .winded, .late, .blocked, .chip, .who).
const bossWho = (e) => {
  const i = D.BOSS_INFO[e.id] || {}, he = i.he || 'it';
  return { short: i.short || e.name, he, him: { he: 'him', she: 'her' }[he] || 'it', his: { he: 'his', she: 'her' }[he] || 'its' };
};
const moveWord = (e, id, key, dflt) => { const mv = (BOSS_MOVES[e.id] || {})[id] || {}; return mv[key] || dflt; };
const moveName = (e, id) => moveWord(e, id, 'name', id);

function moveOpen(e, id) {
  const m = kitOf(e).moves[id], b = e.bs;
  if (!m || b.phase > m.from || (m.until && b.phase <= m.until)) return false;
  if (id === 'shutter') return !b.shutter && !b.noRun;
  return !(id === 'floor' ? b.floor : id === 'front' ? b.front : id === 'lights' ? b.lights : id === 'count' ? b.count : id === 'redact' ? b.redact : 0);
}
// One turn ahead, like every other intent, so a scanner can show it. 'sig:<move>' or a plain intent.
function bossPlan(e, rng) {
  const b = e.bs, kit = kitOf(e);
  if (b.every) { b.since += 1; if (b.since >= b.every.n) { b.since = 0; return b.every.act === 'special' ? 'special' : `sig:${b.every.act}`; } }
  if (b.cd > 0) b.cd -= 1;
  else {
    const open = Object.keys(kit.moves).filter((id) => moveOpen(e, id)), fresh = open.filter((id) => id !== b.last), list = fresh.length ? fresh : open;
    if (list.length && rng() < kit.rate) { const id = pick(rng, list); b.cd = kit.cd; b.last = id; return `sig:${id}`; }
  }
  return rollIntent(e, rng, e.lastIntent);
}
function bossChoose(e, rng) {
  const b = bsOf(e);
  if (e.sig) return 'sig'; // still on its way: being stunned or pinned behind cover only delays it
  let k = e.next || bossPlan(e, rng);
  if (k.startsWith('sig:') && !moveOpen(e, k.slice(4))) k = 'attack'; // the plan was overtaken by a phase
  if (k !== 'attack' && !k.startsWith('sig:') && !e.intents[k]) k = 'attack';
  if (k === 'repair' && e.hp > e.maxHp * 0.6) k = 'attack';
  e.next = null;
  if (k.startsWith('sig:')) {
    const id = k.slice(4), m = kitOf(e).moves[id], n = Object.keys(BOSS_MOVES[e.id] || {}).indexOf(id) + 1;
    e.sig = { id, n: n || 1, left: id === 'audit' ? b.auditCount : m.count, startHp: e.hp };
    k = 'sig';
  }
  e.lastIntent = k;
  e.next = bossPlan(e, rng);
  return k;
}
function nextIntent(s, e, rng) {
  e.intent = chooseIntent(e, rng);
  if (e.boss) sigAnnounce(s);
}
function sigAnnounce(s) {
  const r = s.run, e = r.enemy, g = e.sig;
  if (!g || g.said) return;
  g.said = true;
  if (g.id === 'redact') { g.who = r.lastAttacker || 0; g.act = e.bs.lastAtk[g.who] || 'shoot'; }
  const name = BOSS_MOVES[e.id][g.id].name;
  fx(s, { who: 'enemy', type: 'telegraph', sig: g.id, n: g.n, name });
  log(s, `${e.name}: ${name}.`, 'bad');
  // A phase line has just gone up, with what changed under it: leave it to be read. The intent line already names the move.
  if (r.round - (e.bs.phaseRound ?? -9) > 1) bossSay(s, `signature.${g.id}`);
}
// A boss's line goes in the saved state as well as the event stream, so a friend who misses the event still reads it.
function bossSay(s, key, kind = 'boss', note = '') {
  const r = s.run, e = r.enemy, b = e.bs, n = (b.says += 1);
  const x = n * 0.6180339887 + e.hp * 0.0137;
  const text = bossLine(e.id, key, { map: r.map, name: firstName(s.char), rng: () => x - Math.floor(x) });
  if (!text) return '';
  e.say = { n, text, kind, note };
  fx(s, { who: 'enemy', type: 'say', text, kind, note, sayN: n });
  log(s, text, kind === 'boss' ? 'boss' : 'info');
  return text;
}
// The boss when the operative is nearly gone, and then the operative's own head. Twice a fight at most.
function bossTaunt(s) {
  const r = s.run, e = r.enemy, c = s.char, b = e && e.bs;
  if (!b || e.sig || c.hp <= 0 || c.hp >= stats(s).maxHp * 0.3 || b.taunts >= 2 || r.round - b.lastTaunt < 4) return;
  b.taunts += 1; b.lastTaunt = r.round;
  if (b.taunts === 1) bossSay(s, 'taunt'); else bossSay(s, 'playerLow', 'narration');
}

function bossPhase(s, t) {
  const e = s.run.enemy, b = e.bs, kit = kitOf(e);
  if (t === 50) {
    e.phase2 = true;
    e.atk = Math.round(e.atk * 1.2);
    e.intents = { ...e.intents, heavy: (e.intents.heavy || 0) + 1, special: (e.intents.special || 0) + 1, guard: 0 };
  }
  const every = (act, n) => { b.every = { act, n }; b.since = 0; };
  if (e.id === 'halvek' && t === 25) { b.noRun = true; every('special', 3); }
  if (e.id === 'crawler') {
    if (t === 75) e.def = Math.max(0, e.def - 1);
    if (t === 50) e.intents = { ...e.intents, repair: 0 };
    if (t === 25) { e.intents = { ...e.intents, repair: 0, guard: 0 }; b.wide = 0.25; }
  }
  if (e.id === 'ostrane') {
    if (t === 50) e.spd += 2;
    if (t === 25) { b.auditCount = 1; every('audit', 3); }
  }
  if (e.id === 'brask' && t === 25) { b.late = true; every('overtime', 2); }
  if (e.id === 'crucible') {
    if (t === 75) b.glow = true;
    if (t === 50) b.floorTurns = 4;
    if (t === 25) { e.intents = { ...e.intents, repair: 0 }; b.brittle = true; every('roll', 2); }
  }
  if (e.id === 'kell' && t === 25) { b.noRun = true; e.intents = { ...e.intents, special: (e.intents.special || 0) * 2 }; }
  if (e.id === 'vane') {
    if (t === 50) b.snipers = 0.4;
    if (t === 25) { b.twice = true; every('crane', 3); }
  }
  // The nine added with twenty sectors: notes in D.BOSS_KIT say the same.
  if (e.id === 'dray' && t === 25) { b.noRun = true; every('salute', 3); }
  if (e.id === 'slagmother') {
    if (t === 50) { e.intents = { ...e.intents, repair: 0 }; b.floorTurns = 4; }
    if (t === 25) { e.intents = { ...e.intents, repair: 0 }; e.def = Math.max(0, e.def - 3); every('floor', 3); }
  }
  if (e.id === 'hale') {
    if (t === 50) e.spd += 2;
    if (t === 25) { b.brittle = true; every('siege', 3); }
  }
  if (e.id === 'restraint') {
    if (t === 50) e.intents = { ...e.intents, repair: 0 };
    if (t === 25) { e.intents = { ...e.intents, repair: 0 }; b.noRun = true; every('anchor', 3); }
  }
  if (e.id === 'voight' && t === 25) { e.intents = { ...e.intents, special: (e.intents.special || 0) * 2 }; every('redact', 3); }
  if (e.id === 'venn') {
    if (t === 50) e.def += 2;
    if (t === 25) { b.noRun = true; every('audit', 3); }
  }
  if (e.id === 'pell') {
    if (t === 50) b.snipers = 0.3;
    if (t === 25) b.snipers = 0.45;
  }
  if (e.id === 'gantry') {
    if (t === 50) e.intents = { ...e.intents, repair: 0 };
    if (t === 25) { e.intents = { ...e.intents, repair: 0 }; b.wide = 0.25; every('anchor', 3); }
  }
  if (e.id === 'imre') {
    if (t === 50) { e.spd += 2; b.snipers = 0.4; }
    if (t === 25) { b.noRun = true; b.twice = true; every('siege', 4); }
  }
  if (e.id === 'rask') { if (t === 50) e.def += 2; if (t === 25) every('siege', 3); }
  if (e.id === 'broodqueen') { if (t === 50) e.spd += 2; if (t === 25) { b.twice = true; every('roll', 3); } }
  if (e.id === 'lancer') { if (t === 50) { e.def += 3; e.intents = { ...e.intents, repair: 0 }; } if (t === 25) every('siege', 3); }
  if (e.id === 'saal') { if (t === 50) e.spd += 2; if (t === 25) { b.noRun = true; b.twice = true; every('audit', 3); } }
  // A move that has just opened comes next, so the change is felt.
  for (const [id, m] of Object.entries(kit.moves)) if (m.from === t && moveOpen(e, id)) { e.next = `sig:${id}`; b.last = id; b.cd = kit.cd; break; }
  return kit.notes[t] || '';
}
export function checkPhase(s) {
  const e = s.run && s.run.enemy;
  if (!e || !e.boss || e.hp <= 0) return;
  const b = bsOf(e), share = (e.hp / e.maxHp) * 100;
  let crossed = 0, note = '';
  for (const t of [75, 50, 25]) if (b.phase > t && share <= t) { b.phase = t; note = bossPhase(s, t); crossed = t; }
  if (!crossed) return;
  b.phaseRound = s.run.round;
  fx(s, { who: 'enemy', type: 'phase', pct: crossed, enraged: crossed === 50 });
  if (!bossSay(s, `phase.${crossed}`, 'boss', note)) { const line = (D.BOSS_INFO[e.id] || {}).phase2; if (line) log(s, line, 'boss'); }
  if (note) log(s, note, 'bad');
}

function bossTick(s) {
  const b = s.run.enemy.bs;
  for (const k of ['shutter', 'floor', 'front', 'lights', 'count', 'wreck']) if (b[k] > 0) {
    b[k] -= 1;
    if (k === 'front' && !b.front && b.frontWatch) { b.frontWatch = false; if (!b.frontFired) b.frontHeld = true; }
  }
  if (b.redact) { b.redact.t -= 1; if (b.redact.t <= 0) b.redact = null; }
}
// What the boss takes from a weapon hit right now.
function bossTakes(e, melee) {
  const b = e.bs, g = e.sig, kit = kitOf(e).moves;
  let m = bossOpen(e);
  if (!melee && (b.shutter > 0 || b.front > 0)) m *= 0.5;
  if (g && g.id === 'salute' && melee) m *= kit.salute.parry;
  if (g && g.id === 'anchor' && melee) m *= kit.anchor.belly;
  return m;
}
// The same for anything that isn't a weapon: an open core and a failing hull take it all.
function bossOpen(e) {
  const b = e.bs; if (!b) return 1;
  return (e.sig && e.sig.id === 'roll' && e.sig.left === 2 ? kitOf(e).moves.roll.open : 1) * (b.brittle ? 1.15 : 1);
}
function redactMult(s, act) {
  const e = s.run.enemy, x = e && e.bs && e.bs.redact;
  return x && x.who === actorIdx(s) && x.act === act ? kitOf(e).moves.redact.cut : 1;
}
function redactedSkill(s, act) {
  const e = s.run && s.run.enemy, x = e && e.bs && e.bs.redact;
  return !!x && x.who === actorIdx(s) && x.act === act;
}
// Null when the way out is open, or why it isn't.
export function runBlocked(s) {
  const r = s.run, e = r && r.enemy, b = e && e.bs;
  if (r && r.pst && r.pst.pinned) return 'Pinned';
  if (!b) return null;
  const shut = moveWord(e, 'shutter', 'blocked', 'The shutter is down'), nr = (D.BOSS_INFO[e.id] || {}).noRun;
  if (b.noRun) return nr ? nr[0] : shut;
  return b.shutter > 0 ? shut : null;
}
export const sniperChance = (r) => { const b = r && r.enemy && r.enemy.bs; return b && b.wreck > 0 ? 0 : (b && b.snipers) || 0.2; };
// Lights Out hides her moves, unless you have a scanner.
export function intentHidden(s) {
  const e = s.run && s.run.enemy;
  return !!(e && e.bs && e.bs.lights > 0 && !stats(s).scan);
}
const WEAPON_ACTS = new Set(['shoot', 'strike', 'aimed', 'burst', 'blast', 'smash', 'suppress', 'overload']);
const MELEE_ACTS = new Set(['strike', 'smash']);
const RANGED_ACTS = new Set(['shoot', 'aimed', 'burst', 'blast', 'suppress']);
const skillFits = (k, hit) => !hit || (hit === 'strike' ? !RANGED_ACTS.has(k) : !MELEE_ACTS.has(k));
// After each operative's action: the counters that belong to what they just did.
function bossAfterAct(s, act, who, rng) {
  const r = s.run, e = r.enemy, c = s.char, b = bsOf(e), g = e.sig, st = stats(s), kit = kitOf(e).moves;
  if (WEAPON_ACTS.has(act)) b.lastAtk[who] = act;
  if (D.ITEMS[act]) b.used[who] = (b.used[who] || 0) + 1;
  const cancel = (type, text) => { e.sig = null; fx(s, { who: 'enemy', type: 'sigfail', sig: g.id, text }); log(s, text, 'good'); };
  const w = bossWho(e);
  if (g && g.id === 'confiscate' && MELEE_ACTS.has(act)) cancel('sigfail', moveWord(e, 'confiscate', 'fail', `You knock ${w.his} hand away. No receipt today.`));
  else if (g && g.id === 'siege' && act === 'ion') cancel('sigfail', moveWord(e, 'siege', 'ion', 'The ion pulse jams the breech. The Siege Round doesn\u2019t fire.'));
  else if (g && g.id === 'count' && act === 'intimidate') cancel('sigfail', moveWord(e, 'count', 'fail', `You shout over the count. Nobody is listening to ${w.him} now.`));
  else if (g && g.id === 'crane' && act === 'smoke') { cancel('sigfail', moveWord(e, 'crane', 'fail', 'The container lands where you were, in the smoke. The wreck blocks the tower\u2019s view.')); b.wreck = kit.crane.wreck; }
  if (act === 'intimidate') { if (b.count > 0) { b.count = 0; log(s, 'The count breaks. The prisoners move.', 'good'); } if (b.front > 0) { b.front = 0; b.frontWatch = false; log(s, moveWord(e, 'front', 'fail', `The workers scatter. ${w.short} can\u2019t stop them all.`), 'good'); } }
  if (b.front > 0 && RANGED_ACTS.has(act)) b.frontFired = true;
  if (b.floor > 0 && MELEE_ACTS.has(act)) {
    const cost = Math.max(1, Math.round(st.maxHp * kit.floor.cost));
    c.hp -= cost;
    const added = addPlayerStatus(s, { burn: 1 }, rng);
    fx(s, { who: 'enemy', type: 'counter', dmg: cost, text: moveName(e, 'floor'), statuses: added });
    log(s, `The slag floor costs you ${cost}.`, 'bad');
  }
}
// Confiscated items come back when the boss goes down. Run away and they stay gone.
function bossGiveBack(s) {
  const r = s.run, b = r.enemy.bs;
  for (const t of b.taken || []) { const pc = charAt(s, t.who); if (pc && !pc.dead) { pc.items[t.item] = (pc.items[t.item] || 0) + 1; log(s, `You take back your ${D.ITEMS[t.item].name}.`, 'good'); } }
  b.taken = [];
  // Being pinned belongs to this fight: it must not block Run in the next room.
  delete r.pst.pinned;
  for (const bag of Object.values(r.cb || {})) if (bag && bag.pst) delete bag.pst.pinned;
}
// Multiplier a move will hit for, for the intent line and the hit itself.
function sigMult(s, g, e) {
  const m = kitOf(e).moves[g.id];
  if (g.id !== 'audit') return m.mult || 0;
  return Math.min(m.max, m.base + m.per * (e.bs.used[actorIdx(s)] || 0));
}
function sigRange(s) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), g = e.sig;
  if (!g || g.left !== 1) return null;
  const m = kitOf(e).moves[g.id], mult = sigMult(s, g, e);
  if (!mult || (g.id === 'confiscate' && Object.values(c.items).some((n) => n > 0))) return null;
  const hits = m.hits || 1, base = e.atk * mult * outMult(e.st, r.pst), guard = m.guard || 0.5;
  const lo = mitigate(base * 0.85, st.def), hi = mitigate(base * 1.15, st.def);
  const g2 = (n) => droneShield(c, Math.max(1, Math.round(n * guard * (hasTrait(c, 'bulwark') ? 0.7 : 1))));
  const hiNow = droneShield(c, hi) * hits;
  return { min: droneShield(c, lo) * hits, max: hiNow, defMin: g2(lo) * hits, defMax: g2(hi) * hits, lethal: hiNow >= c.hp };
}
// What the intent line says about a move on its way.
export function sigInfo(s) {
  const e = s.run.enemy, g = e.sig;
  if (!g) return null;
  const mv = BOSS_MOVES[e.id][g.id], name = g.id === 'redact' ? `${mv.name}: ${actName(g.act)}` : mv.name;
  let tip = (g.id === 'roll' && g.left === 1 && mv.tipNext) || (e.bs.late && mv.tipLate) || mv.tip;
  tip = tip.split('{t}').join(String(g.id === 'floor' ? e.bs.floorTurns : kitOf(e).moves[g.id].turns || 0))
    .split('{x}').join(sigMult(s, g, e).toFixed(1).replace(/\.0$/, ''))
    .split('{act}').join(actName(g.act));
  const label = g.id === 'roll' && g.left === 1 ? 'Heat blast' : g.left > 1 && g.id !== 'roll' ? `${name} \u00B7 ${g.left} turns` : name;
  return { label, tip, tone: 'danger', id: g.id, n: g.n, left: g.left };
}
const actName = (a) => (!a ? 'Shoot' : a === 'shoot' ? 'Shoot' : a === 'strike' ? 'Strike' : (D.SKILLS[a] && D.SKILLS[a].name) || a);
// Lasting effects, as chips beside the intent.
export function bossEffects(s) {
  const e = s.run.enemy, b = e && e.bs;
  if (!b) return [];
  const out = [], add = (label, tip) => out.push({ label, tip });
  const w = bossWho(e), chip = (id, dflt) => moveWord(e, id, 'chip', dflt), nr = (D.BOSS_INFO[e.id] || {}).noRun;
  if (b.shutter > 0) add(`${chip('shutter', 'Shutter')} ${b.shutter}`, `${moveName(e, 'shutter')}: shots deal half, and you can\u2019t Run.`);
  if (b.noRun && !(b.shutter > 0)) add('No Run', nr ? nr[1] : 'The shutter stays down. No Run for the rest of the fight.');
  if (b.floor > 0) add(`${chip('floor', 'Slag')} ${b.floor}`, `${moveName(e, 'floor')}: each Strike costs 5% of your max HP and burns. Shoot is safe.`);
  if (b.front > 0) add(`${chip('front', 'Workers')} ${b.front}`, `${moveName(e, 'front')}: shots deal half.${b.frontFired ? '' : ' Hold your fire throughout for +1 Resolve on the kill.'}${canUse(s, 'intimidate') ? ' Intimidate clears them.' : skillsOf(s.char).includes('intimidate') ? ' Intimidate is spent for this sector: Strike reaches past them.' : ' Strike reaches past them.'}`);
  if (b.frontHeld) add('+1 Resolve', `You held your fire. +1 Resolve when ${w.short} goes down.`);
  if (b.count > 0) add(`${chip('count', 'Count')} ${b.count}`, `${moveName(e, 'count')}: freed prisoners do nothing. Intimidate breaks it.`);
  if (b.lights > 0) add(`${chip('lights', 'Dark')} ${b.lights}`, `${moveName(e, 'lights')}: ${w.his} moves are hidden unless you have a scanner, and shots miss 25% of the time. Strike can\u2019t miss.`);
  if (b.wreck > 0) add(`Wreck ${b.wreck}`, 'The wrecked container blocks the tower snipers.');
  if (b.redact && b.redact.who === actorIdx(s)) add(`${actName(b.redact.act)} cut ${b.redact.t}`, `${moveName(e, 'redact')}: ${actName(b.redact.act)} ${D.SKILLS[b.redact.act] ? 'is locked' : 'deals half'} for ${b.redact.t} more turn${b.redact.t > 1 ? 's' : ''}.`);
  for (const t of b.taken || []) if (t.who === actorIdx(s)) add(`Took ${D.ITEMS[t.item].name}`, `Confiscated. You get it back when ${w.he} goes down.`);
  return out;
}
// The sensible answer to what the boss is doing: act = a specific action, hit = the weapon to use. Auto battle and the simulator bots read this.
export function sigAdvice(s) {
  const r = s.run, e = r.enemy, c = s.char, out = { act: null, hit: null };
  const b = e && e.bs;
  if (!b) return out;
  const g = e.sig, st = stats(s), low = c.hp < st.maxHp * 0.5, can = (a) => canUse(s, a), kit = kitOf(e).moves;
  if (b.shutter > 0 || b.front > 0 || b.lights > 0) out.hit = 'strike';
  if (b.floor > 0) out.hit = 'shoot';
  if (b.redact && b.redact.who === actorIdx(s)) { if (b.redact.act === 'shoot') out.hit = 'strike'; if (b.redact.act === 'strike') out.hit = 'shoot'; }
  if (b.front > 0 && can('intimidate')) out.act = 'intimidate';
  if (b.count > 0 && r.allies > 0 && can('intimidate')) out.act = 'intimidate';
  if (!g || e.stun > 0) return out;
  const needs = (share) => {
    const [a, z] = attackRange(s, out.hit === 'strike' || (!out.hit && bestAttack(s) === 'strike'));
    return g.startHp - e.hp + (a + z) / 2 >= e.maxHp * share;
  };
  switch (g.id) {
    case 'confiscate': if (!out.hit || out.hit === 'strike') out.hit = 'strike'; break;
    case 'anchor': if (low) out.act = 'defend'; else out.hit = 'strike'; break;
    case 'siege':
      if (can('ion')) out.act = 'ion'; // a pulse jams a breech, a lance coil or an uplink alike
      else if (g.left === 1 && !needs(kit.siege.jam)) out.act = 'defend';
      break;
    case 'roll': if (g.left === 1) out.act = 'defend'; break;
    case 'overtime': out.act = 'defend'; break;
    case 'count': if (can('intimidate') && r.allies > 0) out.act = 'intimidate'; else if (!r.allies) out.act = 'defend'; break;
    case 'crane': if (g.left === 1) out.act = 'defend'; break;
    case 'salute': if (low) out.act = 'defend'; else if (!out.hit) out.hit = 'shoot'; break;
    case 'audit': if (g.left === 1) out.act = 'defend'; break;
    default: break;
  }
  return out;
}
// A signature move's turn: it charges, it fails, or it goes off.
function sigTurn(s, rng, vamp, reflect) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), b = e.bs, g = e.sig;
  if (!g) return; // the operative stopped it this turn: the boss has lost its move
  const kit = kitOf(e).moves[g.id], name = BOSS_MOVES[e.id][g.id].name, dealt = g.startHp - e.hp;
  const fail = (text) => { e.sig = null; fx(s, { who: 'enemy', type: 'sigfail', sig: g.id, text }); log(s, text, 'good'); };
  if (g.id === 'siege' && dealt >= e.maxHp * kit.jam) return fail(moveWord(e, 'siege', 'fail', 'Your fire knocks the turret off its line. The Siege Round jams in the breech.'));
  if (g.id === 'roll' && g.left === 2 && dealt >= e.maxHp * kit.choke) { e.stun = Math.max(e.stun, 1); return fail(moveWord(e, 'roll', 'fail', 'You choke the open core. The blast dies and the Crucible staggers.')); }
  g.left -= 1;
  if (g.left > 0) {
    fx(s, { who: 'enemy', type: 'charging', sig: g.id, n: g.n, name, left: g.left });
    log(s, g.id === 'roll' ? moveWord(e, 'roll', 'charge', 'The core flares. A blast is coming.') : `${name}: ${g.left} more turn${g.left > 1 ? 's' : ''}.`, 'bad');
    return;
  }
  e.sig = null;
  const hit = (mult, guard = 0.5) => {
    let dmg = mitigate(e.atk * (0.85 + rng() * 0.3) * mult * outMult(e.st, r.pst) * (r.keepDistance ? 1 - TUNE.shootGuard : 1), st.def);
    if (r.defending) dmg = Math.max(1, Math.round(dmg * guard * (hasTrait(c, 'bulwark') ? 0.7 : 1)));
    dmg = soak(s, c, droneShield(c, dmg));
    c.hp -= dmg; vamp(dmg); reflect(dmg);
    return dmg;
  };
  const go = (ev) => fx(s, { who: 'enemy', type: 'sig', sig: g.id, n: g.n, name, blocked: r.defending, ...ev });
  const said = (text, kind = 'bad') => log(s, text, kind);
  switch (g.id) {
    case 'shutter': b.shutter = kit.turns; go({}); said(`${name}: for ${kit.turns} turns your shots deal half and there\u2019s no Run.`); break;
    case 'confiscate': {
      const item = c.items.stim > 0 ? 'stim' : ['thermal', 'ion', 'smoke'].find((k) => c.items[k] > 0);
      if (item) { c.items[item] -= 1; b.taken.push({ who: actorIdx(s), item }); go({ text: D.ITEMS[item].name }); said(`${e.name} takes your ${D.ITEMS[item].name}. You get it back if ${bossWho(e).he} goes down.`); }
      else { const dmg = hit(kit.mult, kit.guard); go({ dmg }); said(`Nothing to take, so ${bossWho(e).he} hits you instead: ${dmg}.`); }
      break;
    }
    case 'anchor': {
      const dmg = hit(kit.mult, kit.guard), added = r.defending ? [] : addPlayerStatus(s, { pinned: kit.pin }, rng);
      go({ dmg, statuses: added }); said(`${name} for ${dmg}${added.length ? `. You are Pinned for ${kit.pin} turns: no Run` : ''}.`);
      break;
    }
    case 'siege': { const dmg = hit(kit.mult, kit.guard); go({ dmg }); said(`${name}: ${dmg}${r.defending ? ', behind cover' : ''}.`); break; }
    case 'roll': { const dmg = hit(kit.mult, kit.guard); go({ dmg, blast: true }); said(`Heat blast: ${dmg}${r.defending ? ', behind cover' : ''}.`); break; }
    case 'floor': b.floor = b.floorTurns; go({}); said(`${name}: for ${b.floorTurns} turns each Strike costs 5% of your max HP.`); break;
    case 'overtime': {
      const a = hit(kit.mult, kit.guard); let z = 0;
      if (c.hp > 0) z = hit(kit.mult, kit.guard);
      if (b.late) e.hp -= Math.max(1, Math.round(e.maxHp * kit.self));
      else addStatus(e.st, e.fresh, { exposed: kit.winded });
      go({ dmg: a + z, hits: [a, z], winded: !b.late }); said(`${name}: ${a} and ${z}. ${b.late ? moveWord(e, 'overtime', 'late', 'It tears something in him.') : moveWord(e, 'overtime', 'winded', 'He stands there heaving: Exposed.')}`);
      break;
    }
    case 'front': b.front = kit.turns; b.frontFired = false; b.frontWatch = true; go({}); said(`${name}: for ${kit.turns} turns your shots deal half.`); break;
    case 'count': {
      let added = [];
      if (r.allies > 0) { b.count = kit.turns; said(`${name}: the freed prisoners stand to attention for ${kit.turns} turns.`); }
      else if (!r.defending) { added = addPlayerStatus(s, { shaken: kit.shaken }, rng); said(`${name}: ${added.length ? 'you are Shaken' : 'it doesn\u2019t get to you'}.`); }
      else said(`${name}: you keep your head down and don\u2019t answer.`, 'info');
      go({ statuses: added });
      break;
    }
    case 'lights': b.lights = kit.turns; go({}); said(`${name}: for ${kit.turns} turns ${bossWho(e).his} moves are hidden and shots miss 25% of the time.`); break;
    case 'crane': { const dmg = hit(kit.mult, kit.guard); b.wreck = kit.wreck; go({ dmg }); said(`${name}: ${dmg}${r.defending ? ', behind cover' : ''}. The wreck blocks the tower snipers for ${kit.wreck} turns.`); break; }
    case 'salute': { const dmg = hit(kit.mult, kit.guard); go({ dmg, crit: true }); said(`${name}: a clean hit for ${dmg}.`); break; }
    case 'redact': b.redact = { act: g.act, who: g.who || 0, t: kit.turns }; go({ text: actName(g.act) }); said(`${name}: ${actName(g.act)} ${D.SKILLS[g.act] ? 'is locked' : 'deals half'} for ${kit.turns} turns.`); break;
    case 'audit': { const x = sigMult(s, g, e), dmg = hit(x, kit.guard); go({ dmg, text: `x${x.toFixed(1)}` }); said(`${name}, x${x.toFixed(1)}: ${dmg}${r.defending ? ', behind cover' : ''}.`); break; }
    default: break;
  }
}
// First meetings: which operatives have stood in front of this boss, on this map. The opening scene is chosen here so both co-op screens get the same one.
function bossMeet(s, e, rng) {
  const r = s.run, m = s.meta, key = bossKey(r, e), who = livingActors(s).map((i) => charAt(s, i)).filter(Boolean);
  const first = who.some((c) => !(c.bossMet && c.bossMet[key]));
  for (const c of who) (c.bossMet = c.bossMet || {})[key] = 1;
  const opts = { map: r.map, name: firstName(s.char), rng }, sceneKey = `intro:${key}`;
  let beats;
  if (first) {
    beats = bossLines(e.id, 'firstIntro', opts);
    const own = bossLine(e.id, `byBackground.${s.char.background}`, opts);
    if (own) beats.splice(Math.max(0, beats.length - 1), 0, own);
    if ((m.sceneSeen || {})[sceneKey]) beats = beats.slice(-1); // the cell has watched this one through: a later operative gets its last beat
  } else {
    const one = bossLine(e.id, 'intro', opts);
    beats = one ? [one] : [];
  }
  if (!beats.length) beats = [e.line];
  e.intro = { first, key: sceneKey, beats };
}
export function markSceneSeen(s, key) { if (s.meta && key) (s.meta.sceneSeen = s.meta.sceneSeen || {})[key] = 1; }
// A boss down: the record, the Resolve for holding fire, and on a first win the scene. It goes in the state, so a co-op friend sees it too.
function bossBeaten(s, e, out, rng) {
  const r = s.run, m = s.meta, key = bossKey(r, e), b = bsOf(e), who = livingActors(s).map((i) => charAt(s, i)).filter(Boolean);
  const first = who.some((c) => !(c.bossBeat && c.bossBeat[key]));
  for (const c of who) (c.bossBeat = c.bossBeat || {})[key] = 1;
  (m.bossWins = m.bossWins || {})[key] = (m.bossWins[key] || 0) + 1;
  // Shift in Front: hold your fire and the workers go home.
  if (b.frontHeld && !out.fled) { m.resolve += 1; m.totalResolve += 1; out.resolve = (out.resolve || 0) + 1; out.notes.push(`You held your fire on ${moveWord(e, 'front', 'who', 'the workers')}: +1 Resolve`); }
  const opts = { map: r.map, name: firstName(s.char), rng }, sceneKey = `defeat:${key}`;
  if (first) {
    const seen = !!(m.sceneSeen || {})[sceneKey], all = bossLines(e.id, 'firstDefeat', opts);
    const beats = seen ? all.slice(-1) : all;
    m.sceneN = (m.sceneN || 0) + 1;
    if (beats.length) s.scene = { id: m.sceneN, kind: 'defeat', key: sceneKey, boss: e.id, name: e.name, beats, note: bossLine(e.id, 'victoryNote', opts) };
    if (s.scene) journal(s, `${e.name}: ${s.scene.note || beats[beats.length - 1]}`, 'boss');
  } else {
    const line = bossLine(e.id, 'defeat', opts);
    if (line) { out.defeatLine = line; log(s, line, 'boss'); fx(s, { who: 'enemy', type: 'say', text: line, kind: 'boss', sayN: (b.says += 1) }); }
  }
}
// Operatives dead so far. The feat counter is the real number; meta.fallen stops at 12. A cell older than the counter falls back on how many it has hired, less those still alive,
// which reads a little high for cells that had operatives retired by an old migration.
export function fallenCount(s) {
  const m = s.meta, counted = m.feats && m.feats.counters ? m.feats.counters.fallen : undefined, wall = (m.fallen || []).length;
  if (counted !== undefined) return Math.max(counted, wall);
  const living = (s.char ? 1 : 0) + (s.char2 ? 1 : 0);
  return Math.max(wall, (m.operatives || 0) - living);
}
// ---------- codex ----------
// What a cell knows. Old cells have no bossWins, so kills and liberated districts stand in.
export function codexContext(s, extra = null) {
  const out = { fallen: 0, beaten: [], bossRepeat: 0, ending: false };
  for (const m of [s.meta, extra].filter(Boolean)) {
    const c = (m.feats && m.feats.counters) || {};
    for (const [k, n] of Object.entries(m.bossWins || {})) { out.beaten.push(k); out.bossRepeat = Math.max(out.bossRepeat, n); }
    for (const id of Object.keys(D.BOSS_INFO)) if (c[`kill:${id}`] > 0) { out.beaten.push(id); out.bossRepeat = Math.max(out.bossRepeat, c[`kill:${id}`]); }
    for (const map of D.MAPS) if ((m.liberated || {})[map.id]) out.beaten.push(`${map.bosses[map.bosses.length - 1]}:${map.id}`);
    if (m.endingSeen) out.ending = true;
  }
  out.fallen = Math.max(fallenCount(s), extra ? fallenCount({ meta: extra, char: 1 }) : 0);
  return out;
}
export const codexEntries = (s, extra = null) => { const ctx = codexContext(s, extra); return CODEX.map((entry) => ({ entry, open: codexUnlocked(entry, ctx) })); };
// Entries that have just opened, marked as seen. A cell's first look stays quiet: only what opens after that gets a notice.
export function codexFresh(s) {
  const m = s.meta, open = codexEntries(s).filter((x) => x.open).map((x) => x.entry);
  if (!m.codexSeen) { m.codexSeen = open.map((x) => x.id); m.codexNew = []; return []; }
  const fresh = open.filter((x) => !m.codexSeen.includes(x.id));
  for (const x of fresh) { m.codexSeen.push(x.id); (m.codexNew = m.codexNew || []).push(x.id); }
  return fresh;
}

// XP earned on a raid waits in the bank. It turns into levels only when a boss secures it or you get out (settle).
function gainXp(s, amount) {
  const c = s.char;
  if (c.fed) amount = Math.round(amount * 1.05);
  if (c.background === 'mochi') amount = Math.round(amount * 1.1);
  amount = Math.round(amount * (1 + featBuffs(s.meta).xp));
  c.xpBank = (c.xpBank || 0) + amount;
}
// Beating a boss or leaving: what's unsecured is paid out, less rate. Credits an operative walked in with are never touched.
// Leaves c.payout for the screen that shows it. Returns credits lost by the current actor.
const ROUTE_CUT = 0.85; // Smuggler's Route
function settle(s, kind, rate, exact = false) {
  const r = s.run, me = actorIdx(s);
  let mine = 0;
  // The team's numbers since the last payout, for the tally on the payout screen. Saves from before this have no mark, so they count from the raid's start.
  const mark = r.tallyMark || {}, tally = { kills: (r.kills || 0) - (mark.kills || 0), sectors: (r.cleared || 0) - (mark.sectors || 0), dmg: (r.dmgDone || 0) - (mark.dmg || 0) };
  r.tallyMark = { kills: r.kills || 0, sectors: r.cleared || 0, dmg: r.dmgDone || 0 };
  forEachActor(s, (a, i) => {
    const safe = a.safeCredits ?? a.startCredits ?? r.startCredits ?? 0, haul = Math.max(0, a.credits - safe), bank = a.xpBank || 0;
    if (!haul && !bank) return;
    const cut = has(a, 'route') && !exact ? rate * ROUTE_CUT : rate, lostCredits = Math.round(haul * cut), lostXp = Math.round(bank * cut), gain = bank - lostXp;
    a.credits -= lostCredits; ledger(s, 'escape loss', -lostCredits);
    if (i === me) mine = lostCredits;
    const fromLevel = a.level, fromXp = a.xp, fromNext = xpToNext(a.level);
    a.xp += gain;
    let points = 0;
    while (a.xp >= xpToNext(a.level)) {
      const before = stats(s).maxHp;
      a.xp -= xpToNext(a.level); a.level += 1; a.attrPoints += 1; points += 1;
      a.hp += stats(s).maxHp - before;
    }
    const debtPaid = settleDebt(a); // the secured haul pays Marrow first
    a.xpBank = 0; a.safeCredits = a.credits;
    s.meta.payouts = (s.meta.payouts || 0) + 1;
    a.payout = { id: s.meta.payouts, kind, rate: cut, credits: haul - lostCredits, lostCredits, debtPaid, debtLeft: debtOf(a), xp: gain, lostXp, fromLevel, toLevel: a.level, fromPct: fromXp / fromNext, toPct: a.xp / xpToNext(a.level), points, tally };
  });
  return mine;
}
// Dev mode: XP straight to levels.
export function devAddXp(s, n) {
  const c = s.char;
  if (!c) return;
  c.xp += n;
  while (c.xp >= xpToNext(c.level)) { const before = stats(s).maxHp; c.xp -= xpToNext(c.level); c.level += 1; c.attrPoints += 1; c.hp += stats(s).maxHp - before; }
}
export function closePayout(s) { if (s.char) s.char.payout = null; }

function standUp(s, hpShare) {
  for (const i of [0, 1]) {
    const pc = charAt(s, i);
    if (pc && pc.downed) withActor(s, i, () => { pc.downed = 0; pc.hp = Math.max(1, Math.round(stats(s).maxHp * hpShare)); });
  }
}
// Sectors far below an operative's level pay less, so going back to farm the opening is slower than pushing on.
export const payScale = (c, sector) => { const over = c.level - sector - TUNE.overFree; return over > 0 ? Math.max(TUNE.overMin, 1 - TUNE.overStep * over) : 1; };
function winFight(s, rng, fled = false) {
  const r = s.run, e = r.enemy, c = s.char, m = s.meta;
  // The fight's over: a downed partner gets patched up and shares in it.
  standUp(s, TUNE.reviveAfter);
  for (const i of livingActors(s)) withActor(s, i, () => {
    const d = droneOf(s.char);
    if (d && d.type === 'magpie' && droneHas(d, D.DRONE_AB.mid) && rng() < 0.15) { const it = pick(rng, ['stim', 'thermal', 'ion', 'smoke']); if (s.char.items[it] < stats(s).carry) { s.char.items[it] += 1; log(s, `${D.DRONES[d.type].name} comes back with a ${D.ITEMS[it].name}.`, 'good'); } }
  });
  if (e.bs) bossGiveBack(s);
  const easy = payScale(c, r.sector);
  const credits = Math.round(randInt(rng, e.cr[0], e.cr[1]) * creditMult(s) * (fled ? 0.5 : 1) * easy);
  // A boss this operative has already beaten is worth less the second time round.
  const beaten = e.boss && r.sector <= mapProgress(c, r.map).deepest;
  const xp = Math.round((fled ? e.xp * 0.75 : e.xp) * easy * (beaten ? TUNE.bossRepeatXp : 1) * (1 + pv(c, 'fieldnotes') / 100));
  c.credits += credits; r.sectorCredits += credits; ledger(s, 'fights', credits);
  const out = { enemy: e.name, id: e.id, portrait: e.portrait, credits, xp, levelUps: [], healed: 0, boss: e.boss, elite: !!e.elite, resolve: 0, fled, items: [], notes: [] };
  log(s, `${e.name} ${fled ? 'flees, dropping a credit pouch' : 'goes down'}. +${credits} ${D.SETTING.cur}, +${xp} XP.`, 'reward');
  fx(s, { who: 'enemy', type: fled ? 'flee' : 'down', boss: e.boss });
  m.stats.kills += 1; r.kills = (r.kills || 0) + 1; if (e.boss) r.bosses = (r.bosses || 0) + 1; if (e.elite) r.elites = (r.elites || 0) + 1;
  feat(s, 'kills'); feat(s, `kill:${e.id}`); if (e.boss) feat(s, 'bosses'); if (e.elite) feat(s, 'elites'); feat(s, 'credits', credits);
  out.feats = featProgress(s, r.featTouched || []); r.featTouched = [];
  if (e.affix === 'volatile' && !fled) {
    const st = stats(s), dmg = r.defending ? 0 : Math.round(st.maxHp * 0.15);
    c.hp = Math.max(1, c.hp - dmg);
    fx(s, { who: 'env', type: 'explode', pdmg: dmg });
    out.notes.push(dmg ? `It exploded: \u2212${dmg} HP` : 'It exploded, but you were in cover');
  }
  gainXp(s, xp);
  if (has(c, 'medic')) {
    const st = stats(s);
    out.healed = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.15));
    c.hp += out.healed;
  }
  if (hasPerk(c, 'scavenger') && rng() < pv(c, 'scavenger') / 100) {
    const it = pick(rng, ['stim', 'thermal', 'ion', 'smoke']);
    if (c.items[it] < stats(s).carry) { c.items[it] += 1; out.items.push(D.ITEMS[it].name); }
  }
  if (r.cond === 'toxic' && !fled) { const st = stats(s), d = Math.round(st.maxHp * 0.04); c.hp = Math.max(1, c.hp - d); log(s, `The coolant leak burns your lungs: \u2212${d} HP.`, 'hurt'); }
  const hk = gearBonus(c, 'healkill') + pv(c, 'tithe') + (c.background === 'foundry' ? 6 : 0);
  if (hk && !fled) { const st = stats(s), h = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * hk / 100)); c.hp += h; out.healed += h; }
  if (hasPerk(c, 'quickdraw')) for (const k of Object.keys(r.cooldowns)) if (r.cooldowns[k] < 50) r.cooldowns[k] = Math.max(0, r.cooldowns[k] - pv(c, 'quickdraw'));
  // Co-op: the partner gets the same credits and XP.
  const me = actorIdx(s);
  for (const i of livingActors(s)) if (i !== me) withActor(s, i, () => {
    const c2 = s.char;
    c2.credits += credits; gainXp(s, xp);
    if (has(c2, 'medic')) { const st2 = stats(s); c2.hp = Math.min(st2.maxHp, c2.hp + Math.round(st2.maxHp * 0.15)); }
    if (e.boss) earnInsertion(c2, r.map, r.threat, r.sector + 1);
  });
  contractEvent(s, 'kill', { enemy: e });
  if (e.boss) {
    const t = r.threat;
    out.resolve = beaten ? TUNE.bossRepeatResolve : 3 + (c.background === 'preacher' ? 2 : 0) + (t >= 4 ? 2 : t >= 2 ? 1 : 0);
    m.resolve += out.resolve; m.totalResolve += out.resolve; m.stats.bosses += 1;
    earnInsertion(c, r.map, r.threat, r.sector + 1);
    contractEvent(s, 'boss', {});
    if (r.sector >= MAX_SECTOR && !mapProgress(c, r.map).freed) {
      mapProgress(c, r.map).freed = true; m.liberated[r.map] = true;
      out.liberated = mapById(r.map).name;
      log(s, `The ${out.liberated} is liberated.`, 'reward');
    }
    if (r.sector >= MAX_SECTOR && !r.contract && r.threat === opThreat(c) && escapedAt(c)) { s.escape = { threat: r.threat, name: c.name, top: r.threat >= D.THREAT.length - 1 }; out.escaped = true; }
  }
  const contraband = !fled && (e.boss || rng() < (e.elite ? TUNE.eliteDrop : TUNE.fightDrop));
  // In co-op each player gets their own roll and makes their own choice.
  forEachActor(s, () => {
    if (contraband) r.perkOffer = offerPerks(s, rng, e.boss);
    r.lootOffer = fled ? null : rollLoot(s, rng, e);
  });
  if (r.lootOffer) out.loot = itemName(r.lootOffer);
  if (e.boss) bossBeaten(s, e, out, rng);
  r.enemy = null;
  s.outcome = out;
  s.screen = 'victory';
}

// ---------- contraband ----------
// Three different pieces. What you already carry turns up more often, so a build can be chased; a boss always offers something rare.
// Contraband: up to perkCap copies of any one piece, 3 to start and up to 99. Marrow sells more room one copy at a time,
// each raise 8% dearer than the last: cheap early, a long credit sink late.
export const PERK_CAP_MAX = 99, PERK_CAP_BASE = 120, PERK_CAP_STEP = 1.13;
export const perkCap = (c) => Math.min(PERK_CAP_MAX, 3 + ((c && c.perkCapUp) || 0));
export const perkCapCost = (s) => Math.ceil(price(s, PERK_CAP_BASE * Math.pow(PERK_CAP_STEP, s.char.perkCapUp || 0)));
// Debt: an operative can borrow the shortfall on a contraband raise, up to a ceiling that grows with level. Whatever it earns
// pays the debt off first (ledger). It dies with the operative.
export const debtMax = (c) => 600 + 150 * ((c && c.level) || 1);
export const debtOf = (c) => (c && c.debt) || 0;
export function settleDebt(c) {
  if (!c || !(c.debt > 0) || !(c.credits > 0)) return 0;
  const p = Math.min(c.debt, c.credits); c.debt -= p; c.credits -= p;
  return p;
}
// Can this operative afford the next raise, by paying or by borrowing the rest?
export function capRaiseWay(s) {
  const c = s.char, cost = perkCapCost(s);
  if (perkCap(c) >= PERK_CAP_MAX) return null;
  if (c.credits >= cost) return { cost, owe: 0 };
  // One loan at a time: nothing more on credit until the last one is paid off.
  if (debtOf(c) > 0) return null;
  const owe = cost - Math.max(0, c.credits);
  return owe <= debtMax(c) ? { cost, owe } : null;
}
export function buyPerkCap(s, borrow = false) {
  const c = s.char, way = capRaiseWay(s);
  if (!way || (way.owe && !borrow)) return false;
  const paid = way.cost - way.owe;
  c.credits -= paid; c.debt = debtOf(c) + way.owe; c.perkCapUp = (c.perkCapUp || 0) + 1; ledger(s, 'spend:contraband', paid);
  s.notice = `You can carry ${perkCap(c)} of each piece of contraband now.`;
  return true;
}
export { offerPerks as __offerPerks };
function offerPerks(s, rng, boss) {
  const c = s.char, pool = D.PERKS.filter((p) => !p.relic), out = []; // pieces at the cap still turn up: the screen offers to raise it
  // A boss may put a relic on the table: one the operative doesn't have yet, about one boss in three.
  const relics = D.PERKS.filter((p) => p.relic && !hasPerk(c, p.id));
  if (boss && relics.length && rng() < TUNE.relicOdds) out.push(pick(rng, relics).id);
  const weight = (p) => (p.rare ? (boss ? 2 : 1) : 3) * (hasPerk(c, p.id) ? 3 : 1);
  const take = (list) => { const it = pickWeighted(rng, list.map((p) => [p, weight(p)])); out.push(it.id); pool.splice(pool.indexOf(it), 1); };
  if (boss && pool.some((p) => p.rare)) take(pool.filter((p) => p.rare));
  while (out.length < (has(c, 'broker') ? 4 : 3) + (out.length && D.PERKS.find((p) => p.id === out[0]).relic ? 1 : 0) && pool.length) take(pool);
  return out;
}
// For bots and auto-accept: a piece already carried if there's room for it, else any piece with room, else leave it ('').
export function bestPerkPick(s) {
  const c = s.char, offer = (s.run && s.run.perkOffer) || [], room = offer.filter((id) => perkStacks(c, id) < perkCap(c));
  return room.find((id) => c.perks.includes(id)) || room[0] || '';
}
export function choosePerk(s, id, rng, who = actorIdx(s), raise = '') {
  return withActor(s, who, () => choosePerkInner(s, id, rng, raise));
}
// raise: 'pay' or 'borrow' buys one more copy of room on the spot when the piece is at the cap.
function choosePerkInner(s, id, rng, raise = '') {
  const r = s.run, c = s.char;
  if (!r || !r.perkOffer) return false;
  if (id && isRelic(id) && hasPerk(c, id)) id = ''; // relics never stack
  if (id && r.perkOffer.includes(id) && perkStacks(c, id) >= perkCap(c) && !isRelic(id)) { if (!raise || !buyPerkCap(s, raise === 'borrow')) return false; }
  if (id && r.perkOffer.includes(id) && (perkStacks(c, id) < perkCap(c) || isRelic(id))) {
    c.perkN = c.perkN || {};
    c.perkN[id] = (c.perkN[id] || 0) + 1;
    if (!c.perks.includes(id)) c.perks.push(id);
    log(s, `Contraband: ${perkName(id, c.perkN[id])}.`, 'reward'); feat(s, 'contraband');
  }
  r.perkOffer = null;
  if (isCoop(s) && rewardsPending(s)) { s.screen = 'loot'; return true; }
  offerRoute(s, rng);
  return true;
}

// ---------- events ----------
export function continueAfterVictory(s, rng) {
  // Won the last fight alone: time to go home, with the dead.
  if (s.run.fallen && !rewardsPending(s)) { closeFallen(s, rng, 'extracted'); return; }
  if (isCoop(s)) { if (rewardsPending(s)) s.screen = 'loot'; else offerRoute(s, rng); return; }
  if (s.run.lootOffer) { s.screen = 'loot'; return; }
  if (s.run.perkOffer) { s.screen = 'perk'; return; }
  offerRoute(s, rng);
}

export const eventById = (id) => D.EVENTS.find((e) => e.id === id);
export function checkChance(s, check) {
  if (!check) return 1;
  const bonus = s.char.background === 'clerk' && check.attr === 'int' ? 0.25 : 0;
  return clamp(check.base + check.per * attr(s.char, check.attr) + bonus, 0.05, 0.95);
}
export function optionAvailable(s, opt) {
  if (!opt.cost) return true;
  if (opt.cost.credits && s.char.credits < opt.cost.credits) return false;
  if (opt.cost.stim && s.char.items.stim < opt.cost.stim) return false;
  return true;
}

export function resolveEvent(s, index, rng, who = 0) {
  feat(s, 'events');
  return withActor(s, who, () => resolveEventInner(s, index, rng));
}
function resolveEventInner(s, index, rng) {
  const ev = eventById(s.event), opt = ev && ev.options[index];
  if (!opt || s.eventResult || !optionAvailable(s, opt)) return;
  const c = s.char, r = s.run, st = stats(s);
  if (opt.cost) { if (opt.cost.credits) { c.credits -= opt.cost.credits; ledger(s, 'spend:events', opt.cost.credits); } if (opt.cost.stim) c.items.stim -= opt.cost.stim; }
  const success = !opt.check || rng() < checkChance(s, opt.check);
  const fxs = success ? opt.win : opt.lose;
  const notes = [];
  if (fxs.credits) { const cr = Math.round(randInt(rng, fxs.credits[0], fxs.credits[1]) * payDepth(r) * creditMult(s)); c.credits += cr; r.sectorCredits += cr; ledger(s, 'events', cr); notes.push(`+${cr} ${D.SETTING.cur}`); }
  if (fxs.hp) {
    const amt = Math.round(st.maxHp * Math.abs(fxs.hp));
    if (fxs.hp > 0) { const h = Math.min(st.maxHp - c.hp, amt); c.hp += h; notes.push(`+${h} HP`); }
    else { c.hp = Math.max(1, c.hp - amt); notes.push(`\u2212${amt} HP`); }
  }
  if (fxs.heal === 'full') { notes.push(`+${st.maxHp - c.hp} HP`); c.hp = st.maxHp; }
  if (fxs.items) for (const [k, n] of Object.entries(fxs.items)) { const add = Math.min(n, st.carry - c.items[k]); if (add > 0) { c.items[k] += add; notes.push(`+${add} ${D.ITEMS[k].name}`); } }
  if (fxs.resolve) { s.meta.resolve += fxs.resolve; s.meta.totalResolve += fxs.resolve; notes.push(`+${fxs.resolve} ${D.SETTING.meta}`); }
  if (fxs.next) r.nextMod = fxs.next;
  if (fxs.cash) { c.credits += fxs.cash; r.sectorCredits += fxs.cash; ledger(s, 'events', fxs.cash); notes.push(`+${fxs.cash} ${D.SETTING.cur}`); }
  if (fxs.next === 'stunned') notes.push('next enemy surprised');
  if (fxs.next === 'weakened') notes.push('next enemy starts hurt');
  if (fxs.next === 'alerted') { notes.push('next enemy alerted'); raiseAlarm(s, 1, 'Your cover slipped.'); }
  if (fxs.ally) {
    if (r.allies < 2) { r.allies += 1; notes.push(`ally joins (${r.allies}/2)`); }
    else { s.meta.resolve += 1; s.meta.totalResolve += 1; notes.push(`+1 ${D.SETTING.meta}`); }
  }
  if (fxs.attrs) { const a = changeAttrs(s, fxs.attrs, opt.label); if (a) notes.push(a); }
  s.eventResult = { success, check: !!opt.check, text: fxs.text, notes, label: opt.label };
}

export function clearSector(s, rng = Math.random) {
  const r = s.run, c = s.char, map = mapById(r.map), m = s.meta;
  r.cleared = (r.cleared || 0) + 1; feat(s, 'sectors');
  const bonus = Math.round(6 * payDepth(r) * map.credits * creditMult(s) * payScale(c, r.sector));
  const prog = mapProgress(c, r.map);
  // Resolve only for new ground: sectors this operative hasn't cleared on this map before.
  // Repeat clears pay every other time, so farming early sectors is slow.
  const fresh = r.sector > prog.deepest;
  if (!fresh) c.repeatClears = (c.repeatClears || 0) + 1;
  const pays = fresh || c.repeatClears % TUNE.repeatPay === 0;
  const res = pays ? 1 + (r.threat >= 3 && isBossSector(r.sector) ? 1 : 0) : 0;
  c.credits += bonus; ledger(s, 'sector bonus', bonus); feat(s, 'credits', bonus);
  m.resolve += res; m.totalResolve += res;
  // Mutators: their bonus share of this sector's points goes on the operative's score, and of its Resolve into a bank that pays out whole points.
  if ((r.mutators || []).length >= 3 && !r.daily) seasonTick(s, 'mutsector');
  if (!r.daily) masteryGain(s, 1 + (isBossSector(r.sector) ? 2 : 0) + (r.sector >= MAX_SECTOR ? 10 : 0));
  if (r.map === 'reach' && r.sector >= MAX_SECTOR) forEachActor(s, (a) => { if (a.background === 'medic') seasonTick(s, 'reachmedic'); });
  if (r.daily) { r.daily.sectors = Math.max(r.daily.sectors, r.sector - r.startSector + 1); if (isBossSector(r.sector)) r.daily.bosses += 1; if (r.sector >= r.daily.end) { r.daily.done = true; log(s, 'Contract complete. Turn it in.', 'reward'); } }
  const mb = r.daily ? 0 : mutBonus(r.mutators);
  if (mb > 0) {
    // Each sector counts once per district and threat, at the best bonus it was ever cleared with, so replaying easy ground can't farm it.
    forEachActor(s, (a) => { const k = a.career || (a.career = { raids: 0, kills: 0, bosses: 0 }), key = `${r.map}:${r.threat || 0}`, row = (k.mutB = k.mutB || {})[key] || (k.mutB[key] = []);
      row[r.sector - 1] = Math.max(row[r.sector - 1] || 0, Math.round(mb * 100) / 100); });
    r.mutRes = (r.mutRes || 0) + res * mb;
    const whole = Math.floor(r.mutRes); if (whole > 0) { r.mutRes -= whole; m.resolve += whole; m.totalResolve += whole; log(s, `Mutators: +${whole} ${D.SETTING.meta}.`, 'reward'); }
  }
  markBest(c, r.map, r.threat || 0, r.sector);
  prog.deepest = Math.max(prog.deepest, r.sector);
  c.deepest = Math.max(c.deepest, r.sector);
  for (const i of livingActors(s)) if (i !== actorIdx(s)) withActor(s, i, () => { const c2 = s.char, p2 = mapProgress(c2, r.map); c2.credits += bonus; markBest(c2, r.map, r.threat || 0, r.sector); p2.deepest = Math.max(p2.deepest, r.sector); c2.deepest = Math.max(c2.deepest, r.sector); });
  m.bestSector = Math.max(m.bestSector, r.sector);
  m.bestByMap[r.map] = Math.max(m.bestByMap[r.map] || 0, r.sector);
  contractEvent(s, 'sector', {});
  s.outcome = { sector: r.sector, bonus, credits: r.sectorCredits + bonus, resolve: res, fresh, droneHit: droneWear(s, rng) };
  log(s, `${sectorName(r.sector, r.map)} cleared. +${bonus} ${D.SETTING.cur}${res ? `, +${res} ${D.SETTING.meta}` : ''}.`, 'reward');
  if (isBossSector(r.sector)) { settle(s, 'boss', 0); r.allyHits = 0; }
  s.screen = 'sectorClear';
}

// Two ways out between bosses. Risky keeps part of the haul but can fail, forcing you into the next sector. Safe always works and keeps nothing.
export const extractFailChance = (s) => (s.run && extractRate(s.run.sector) > 0 ? TUNE.extractFails[(s.run.sector - 1) % 5] : 0);
export const extractAllowed = (s, safe = false) => !!(s.run && s.run.daily && s.run.daily.done) || !(s.run && ((mutOn(s.run, 'oneway') && !isBossSector(s.run.sector)) || (safe && mutOn(s.run, 'blackout'))));
export function attemptExtract(s, rng) {
  if (!extractAllowed(s)) return false;
  if (s.run.daily && s.run.daily.done) return safeExtract(s, rng); // a finished contract always gets its pickup
  if (rng() < extractFailChance(s)) {
    // A quarter of the time the guards who catch you settle for a bribe: one piece of contraband, and they look the other way.
    const bribe = [];
    forEachActor(s, (a) => { const owned = (a.perks || []).filter((id) => perkStacks(a, id) > 0); if (owned.length && rng() < TUNE.bribe) { const id = pick(rng, owned); a.perkN[id] -= 1; if (!a.perkN[id]) { delete a.perkN[id]; a.perks = a.perks.filter((x) => x !== id); } bribe.push(`${firstName(a)}: ${perkById(id).name}`); } });
    const text = bribe.length ? `The pickup was compromised. A patrol has you against the wall, and settles for a bribe instead of an arrest: they take ${bribe.length > 1 ? 'a piece of contraband from each of you' : 'a piece of your contraband'} (${bribe.join(', ')}). You\u2019re forced deeper.` : 'The pickup was compromised. You\u2019re forced deeper.';
    s.lastResult = { kind: 'note', name: bribe.length ? 'Extraction failed: bribe taken' : 'Extraction failed', text, notes: bribe };
    if (bribe.length) log(s, `The guards take a bribe: ${bribe.join(', ')}.`, 'bad');
    log(s, 'The extraction falls apart. The only way left is down.', 'bad');
    s.run.exitVotes = null;
    pushDeeper(s, rng);
    return false;
  }
  endRun(s, 'extracted', rng);
  return true;
}
export function safeExtract(s, rng) { if (!extractAllowed(s, true)) return false; s.run.safeExit = true; endRun(s, 'extracted', rng); }
export function pushDeeper(s, rng) {
  const r = s.run;
  if (r.daily && r.daily.done) return false; // the contract ends here: turn it in
  r.sector += 1;
  log(s, `You go deeper. ${sectorName(r.sector, r.map)}.`, 'sys');
  beginSector(s, rng);
}

// Leaderboard: one row per operative, for their whole life. The score is how far they have got, and nothing else: the deepest sector
// cleared on each district at each threat level, so clearing the same ground twice adds nothing. Higher threat levels count on top,
// and for more. coop/worker.js works out the same score from the same numbers: change both together.
// The row goes in meta.boardOut for the page to send after every raid; meta.board keeps this device's best BOARD_SIZE for when the board can't be reached.
export const BOARD_SIZE = 50;
export const SECTOR_POINTS = 100, BOSS_POINTS = 400, LIBERATE_POINTS = 1000, THREAT_POINTS = 0.5;
export const groundWorth = (best, threat = 0) => Math.round((best * SECTOR_POINTS + Math.floor(best / 5) * BOSS_POINTS + (best >= MAX_SECTOR ? LIBERATE_POINTS : 0)) * (1 + THREAT_POINTS * threat));
const markBest = (c, mapId, threat, sector) => { const p = mapProgress(c, mapId), b = p.best || (p.best = { 0: p.deepest || 0 }); b[threat] = Math.max(b[threat] || 0, sector); };
// Every district and threat level this operative has cleared sectors on, as { map, threat, best }.
export function careerProgress(c) {
  const out = [];
  for (const [map, p] of Object.entries(c.maps || {})) for (const [threat, best] of Object.entries(p.best || { 0: p.deepest || 0 })) if (best > 0) out.push({ map, threat: +threat, best });
  return out;
}
export const careerScore = (c) => careerProgress(c).reduce((t, x) => t + groundWorth(x.best, x.threat), 0) + mutPoints(c);
// Score from mutators: each sector's points times the best mutator bonus it was cleared with.
export function mutPoints(c) {
  let n = 0;
  for (const [key, row] of Object.entries((c.career && c.career.mutB) || {})) {
    const t = +key.split(':')[1] || 0;
    row.forEach((b, i) => { if (b) n += (SECTOR_POINTS + ((i + 1) % 5 === 0 ? BOSS_POINTS : 0)) * b * (1 + THREAT_POINTS * t); });
  }
  return Math.round(n);
}
function careerRow(s, c, status, foe = null) {
  const m = s.meta, k = c.career || (c.career = { raids: 0, kills: 0, bosses: 0 }), progress = careerProgress(c), score = careerScore(c);
  if (m.dev || score <= 0) return ''; // cells touched by dev mode stay off the leaderboard
  const top = progress.slice().sort((a, b) => b.threat - a.threat || b.best - a.best)[0];
  const entry = { id: c.uid, name: c.name, player: String(c.coopName || s.playerName || '').slice(0, 16), number: c.number, background: c.background, level: c.level, status, score, gain: score - (c.boardScore || 0), progress,
    map: top.map, threat: top.threat, deepest: top.best, freed: progress.filter((x) => x.threat === 0 && x.best >= MAX_SECTOR).length, raids: k.raids, kills: k.kills, bosses: k.bosses,
    killer: foe ? foe.name : '', when: Date.now() };
  c.boardScore = score;
  addToBoard(m, entry);
  m.boardOut = (m.boardOut || []).filter((e) => e.id !== entry.id);
  m.boardOut.push(entry);
  if (m.boardOut.length > 100) m.boardOut.splice(0, m.boardOut.length - 100);
  return entry.id;
}
export function recordCareer(s, c, status, foe = null) {
  const r = s.run;
  if (!r || !c) return '';
  const k = c.career || (c.career = { raids: 0, kills: 0, bosses: 0 });
  if (!r.orbit) { k.raids += 1; k.kills += r.kills || 0; k.bosses += r.bosses || 0; }
  return careerRow(s, c, status, foe);
}
// A living operative whose score isn't on the board yet: send it now rather than waiting for their next raid.
export function syncCareer(s) {
  const c = s.char;
  if (!c || s.run || c.dead || s.screen === 'death' || c.boardScore === careerScore(c)) return false;
  return !!careerRow(s, c, 'alive');
}
// This device's copy: one row per operative, best first.
export function addToBoard(m, entry) {
  const board = (m.board || []).filter((e) => e.id !== entry.id);
  board.push(entry);
  board.sort((a, b) => b.score - a.score || a.when - b.when);
  if (board.length > BOARD_SIZE) board.length = BOARD_SIZE;
  m.board = board;
  return board.indexOf(entry) + 1;
}

export function endRun(s, how, rngForRestock = Math.random) {
  const r = s.run, c = s.char;
  try { checkEndgame(s); } catch (e) {}
  // Leaving with a partner dead: the fallen operative's slot is cleared first (finishCoopDeath), which then calls back here.
  if (r.fallen && !r.closing) { closeFallen(s, rngForRestock, how); return; }
  standUp(s, 0); // running with a downed partner over your shoulder: they make it out, barely
  const lost = r.safeExit ? settle(s, how, 1, true) : settle(s, how, how === 'extracted' ? extractRate(r.sector) : escapeRate(r.sector));
  forEachActor(s, (a) => {
    a.boardId = recordCareer(s, a, 'alive');
    a.fed = false; a.drink = false; a.booked = false; // the E-Girl Room takes bookings again
    a.hp = Math.min(a.hp, stats(s).maxHp); // a Rivet Stout wearing off
    if (rngForRestock) restockMarket(s, rngForRestock);
  });
  let home = '';
  const freed = Math.max(0, r.allies - (r.follower ? 1 : 0)); // the Preacher's follower isn't a rescued prisoner
  if (how === 'extracted') feat(s, 'extractions');
  if (how === 'extracted' && freed > 0) { feat(s, 'freed', freed);
    s.meta.resolve += freed; s.meta.totalResolve += freed;
    home = ` You brought ${freed} prisoner${freed > 1 ? 's' : ''} home: +${freed} ${D.SETTING.meta}.`;
  }
  if (how === 'extracted') contractEvent(s, 'extract', { credits: s.char.credits, allies: freed });
  const worth = careerScore(c), rank = worth ? ` Operative score ${worth.toLocaleString()}.` : '';
  s.notice = (how === 'extracted'
    ? `You made it out of ${sectorName(r.sector, r.map)}.${lost ? ` Slipping out early cost ${lost} ${D.SETTING.cur} in bribes at the gate.` : ''}${home} Spend it before your luck runs out.`
    : `You escaped from ${sectorName(r.sector, r.map)}${lost ? `, but dropped ${lost} ${D.SETTING.cur} on the way out` : ''}.`) + rank;
  const vn = tickVentures(s, rngForRestock || Math.random);
  if (vn) s.notice += ' ' + vn;
  // One orbit run per stay in town: coming home from a raid refuels the shuttle.
  for (const k of [s.char, s.char2]) if (k) k.orbitFlown = false;
  runStat(s, how, r, c);
  for (const k of [s.char, s.char2]) if (k) delete k.mut;
  s.run = null;
  s.screen = allLiberated(s) && !s.meta.endingSeen ? 'ending' : 'town';
  s.tab = 'clinic';
}

// What extracting right now would cost.
export const unsecured = (s) => { const c = s.char; return Math.max(0, c.credits - (c.safeCredits ?? c.startCredits ?? 0)); };
// The share this operative would lose right now, counting Smuggler's Route.
export const leaveShare = (s) => (s.run ? extractRate(s.run.sector) * (has(s.char, 'route') ? ROUTE_CUT : 1) : 0);
export const runShare = (s) => (s.run ? escapeRate(s.run.sector) * (has(s.char, 'route') ? ROUTE_CUT : 1) : 0);
export const unsecuredNow = (s) => unsecured(s);
export const extractLoss = (s) => Math.round(unsecured(s) * leaveShare(s));
export const extractXpLoss = (s) => Math.round((s.char.xpBank || 0) * leaveShare(s));
export const allLiberated = (s) => D.MAPS.every((m) => s.meta.liberated[m.id]);
// Threat I opens once this operative has freed every district; each threat after that, once they've freed every district at the one below.
export const freedAt = (c, mapId, t) => (t === 0 ? opFreed(c, mapId) : ((((c && c.maps) || {})[mapId] || {}).best || {})[t] >= MAX_SECTOR);
export const maxThreat = (s) => opThreat(s && s.char);
// Every district freed at this operative's own threat level: they've escaped.
export const escapedAt = (c, t = opThreat(c)) => !!c && D.MAPS.every((mp) => freedAt(c, mp.id, t));
// Back in, one level higher: the districts lock again and every map starts over from sector 1. Best clears stay for the board.
export function returnHigher(s) {
  const c = s.char; if (!c || s.run || !escapedAt(c)) return false;
  const t = opThreat(c); if (t >= D.THREAT.length - 1) return false;
  c.threat = t + 1; c.escapes = (c.escapes || 0) + 1;
  for (const p of Object.values(c.maps || {})) { p.best = p.best || { 0: p.deepest || 0 }; p.insertions = [1]; p.deepest = 0; p.freed = false; if (p.byThreat) p.byThreat = {}; }
  c.deepest = 0;
  s.meta.threat = c.threat; s.escape = null;
  s.meta.bestThreat = Math.max(s.meta.bestThreat || 0, c.threat);
  journal(s, `${c.name} walks back into the Cell at ${D.THREAT[c.threat].name}. Everything is locked again, and harder.`, 'reward');
  return true;
}
// The endgame (more training and cell levels) opens for the whole cell once any operative reaches threat I.
export const endgameOpen = (m) => !!(m && m.endgame);
function checkEndgame(s) { if (s.meta && !s.meta.endgame && (maxThreat(s) >= 1 || escapedAt(s.char))) { s.meta.endgame = true; journal(s, 'Every district is free. The cell can train harder now: new training and cell levels are open.', 'reward'); } }

// ---------- contracts ----------
// Credit payouts per contract type. Haul targets are themselves credit amounts, so they pay a small share.
const contractCredits = (kind, n) => ({ kill: 90, sector: 30 + 15 * n, boss: 160, allies: 100, haul: Math.round(n * 0.25) }[kind] || 80);
const CONTRACT_REWARD = { kill: 3, sector: 3, boss: 4, allies: 3, haul: 3 };
export function refreshContracts(s, rng) {
  const m = s.meta;
  m.contracts = (m.contracts || []).filter((k) => !k.done);
  const open = D.MAPS.filter((mp) => mapUnlocked(s, mp));
  let guard = 0;
  while (m.contracts.length < 3 && guard++ < 50) {
    const t = pick(rng, D.CONTRACTS);
    const map = t.map ? mapById(t.map) : t.kind === 'haul' ? null : pick(rng, open);
    if (map && !mapUnlocked(s, map)) continue;
    let n = t.n;
    if (t.kind === 'sector') n = Math.min(MAX_SECTOR, Math.max(3, (m.bestByMap[map.id] || 0) + (t.n >= 7 ? 4 : 2)));
    if (t.kind === 'haul') n = Math.round(t.n * (1 + (m.bestSector || 0) / 5));
    const key = `${t.kind}-${t.tag || ''}-${map ? map.id : ''}`;
    if (m.contracts.some((k) => k.key === key)) continue;
    const resolve = CONTRACT_REWARD[t.kind] + (t.kind === 'sector' && n >= 7 ? 1 : 0);
    m.contracts.push({ key, kind: t.kind, tag: t.tag || null, n, map: map ? map.id : null, progress: 0, done: false,
      text: t.text.replace('{n}', n).replace('{map}', map ? map.name : ''), resolve, credits: contractCredits(t.kind, n) });
  }
}
function contractEvent(s, kind, data) {
  const m = s.meta, r = s.run;
  for (const k of m.contracts || []) {
    if (k.done) continue;
    if (k.map && r && k.map !== r.map && kind !== 'extract') continue;
    if (kind === 'kill' && k.kind === 'kill') {
      const e = data.enemy;
      if (k.tag === 'elite' ? e.elite : e.tags.includes(k.tag)) k.progress += 1;
    }
    if (kind === 'sector' && k.kind === 'sector') k.progress = Math.max(k.progress, r.sector);
    if (kind === 'boss' && k.kind === 'boss') k.progress += 1;
    if (kind === 'extract' && k.kind === 'haul') k.progress = Math.max(k.progress, data.credits);
    if (kind === 'extract' && k.kind === 'allies' && r && r.map === 'detention') k.progress += data.allies;
    if (k.progress >= k.n) {
      k.done = true; k.progress = k.n;
      m.resolve += k.resolve; m.totalResolve += k.resolve;
      if (s.char) { s.char.credits += k.credits; ledger(s, 'contracts', k.credits); }
      if (r) log(s, `Contract complete: ${k.text}. +${k.resolve} ${D.SETTING.meta}, +${k.credits} ${D.SETTING.cur}.`, 'reward');
      s.contractDone = k.text;
    }
  }
}

// Co-op: going down isn't dying, the first time in a raid (TUNE.downsPerRaid). Your partner has a few rounds to reach you. If they fall
// while you're down, you die and they stumble out with what they can carry, so one raid never kills both.
function die(s, foe) {
  const r = s.run;
  if (isCoop(s) && r && !r.orbit) {
    const c = s.char, me = actorIdx(s), other = 1 - me, pc = charAt(s, other);
    r.downs = r.downs || {};
    if (pc && !pc.dead && !pc.downed && (r.downs[me] || 0) < TUNE.downsPerRaid) {
      const n = r.downs[me] = (r.downs[me] || 0) + 1;
      c.hp = 0; c.downed = Math.max(1, TUNE.bleedRounds - (n - 1)) + 1; // +1: the round it happens in ticks too
      r.pst = {}; r.defending = false;
      fx(s, { who: 'player', type: 'downed', actor: me });
      log(s, `${c.name} goes down, bleeding out. ${pc.name} has ${c.downed - 1} round${c.downed > 2 ? 's' : ''} to reach them.`, 'bad');
      return;
    }
    // The last one standing falls with their partner still on the floor: nobody is left to carry anyone. A wipe.
    if (pc && pc.downed) withActor(s, other, () => reallyDie(s, { name: foe.name, id: foe.id, portrait: foe.portrait }));
  }
  reallyDie(s, foe);
}
function reallyDie(s, foe) {
  const c = s.char, r = s.run;
  fx(s, { who: 'player', type: isCoop(s) && !r.orbit ? 'downed' : 'down' });
  c.fed = false;
  const record = { uid: c.uid, name: c.name, number: c.number, level: c.level, sector: r.sector, map: r.map, killer: foe.name, killerId: foe.id, killerPortrait: foe.portrait, credits: c.credits, background: c.background, look: c.look || null, marks: [...(c.marks || [])] };
  s.meta.fallen.unshift(record); feat(s, 'fallen');
  // The first loss always leaves enough for one rank of training, so the cell's first death buys something.
  if (fallenCount(s) === 1 && s.meta.resolve < trainingCost(0)) { const gift = trainingCost(0) - s.meta.resolve; s.meta.resolve += gift; s.meta.totalResolve += gift; record.firstGift = gift; }
  s.meta.fallen = s.meta.fallen.slice(0, 12);
  record.perks = (c.perks || []).length;
  record.boardId = recordCareer(s, c, 'died', foe);
  record.score = careerScore(c);
  // The death screen's record of this operative's life.
  record.kills = (c.career && c.career.kills) || 0;
  record.deepest = Math.max(r.sector || 0, ...careerProgress(c).map((x) => x.best));
  if (isCoop(s) && !r.orbit) {
    autoHeirloom(s);
    c.dead = true; c.downed = 0;
    const me = actorIdx(s), mate = charAt(s, 1 - me);
    if (r.fallen || !mate || mate.dead) {
      // Both gone: a wipe. Everything either of them carried is lost.
      r.over = true;
      s.coopDead = { wipe: true, records: { ...(r.fallen ? { [r.fallen.idx]: r.fallen.record } : {}), [me]: record } };
      log(s, 'That\u2019s both of you. Nobody is coming back from this one.', 'bad');
      return;
    }
    // One dead: the survivor still has this fight to get out of. Win it or run; dying here wipes the team.
    r.fallen = { idx: me, record };
    r.defending = false;
    const e = r.enemy;
    if (e && TUNE.coopHp > 0) { const keep = e.hp / e.maxHp; e.maxHp = Math.max(1, Math.round(e.maxHp / TUNE.coopHp)); e.hp = Math.max(1, Math.round(e.maxHp * keep)); }
    log(s, `${c.name} is dead. ${mate.name} has to win this fight or run.`, 'bad');
    return;
  }
  s.outcome = record;
  runStat(s, 'died', r, c);
  delete c.mut;
  s.run = null;
  s.screen = 'death';
  autoHeirloom(s);
}
// Anonymous balance stats, one row per finished raid (the page posts s.runStats to /stat and clears it). No names or ids.
function runStat(s, how, r, c) {
  try {
    if (!r || !c || r.orbit) return;
    if (r.daily) s.contractTally = { ...r.daily, kills: r.kills || 0, credits: c.credits - (r.startCredits || 0), hpLeft: how === 'died' ? 0 : Math.max(0, c.hp) / statsOf(s.meta, c).maxHp, how };
    const e = r.enemy;
    (s.runStats = s.runStats || []).push({ how, cls: c.background, map: r.map, sector: r.sector, threat: r.threat || 0, level: c.level, credits: c.credits,
      killer: how === 'died' && e ? e.id : '', boss: !!(e && e.boss), coop: isCoop(s) ? 1 : 0, mut: (r.mutators || []).join(','), daily: r.daily ? r.daily.kind : '' });
    if (s.runStats.length > 10) s.runStats.splice(0, s.runStats.length - 10);
  } catch (x) {}
}
// The raid ends with one operative dead. During an action the operatives may be swapped, so playerAct finishes it once that has unwound.
let acting = 0;
function closeFallen(s, rng, how) {
  const r = s.run;
  r.over = true; s.coopDead = { ...r.fallen, how };
  if (!acting) finishCoopDeath(s, rng);
}
// Runs after the action that ended things has unwound.
function finishCoopDeath(s, rng) {
  const d = s.coopDead; s.coopDead = null;
  setActor(s, 0);
  if (d.wipe) {
    const host = d.records[0], guest = d.records[1];
    host.wipe = guest.wipe = true;
    s.char2 = null; // the host's dead operative stays for the death screen, as in solo, until they recruit
    s.coopFallen = { idx: 1, record: guest };
    s.outcome = host; s.run = null; s.screen = 'death';
    return;
  }
  s.run.closing = true;
  const how = d.how || 'escaped';
  const deadHost = s.char;
  if (d.idx === 0) { s.char = null; } else { s.char2 = null; }
  s.coopFallen = { idx: d.idx, record: d.record };
  if (d.idx === 0) {
    // The host is down: act as the friend to close the raid, then leave the host on the death screen.
    const t = s.char; s.char = s.char2; s.char2 = t; s.actorIdx = 1;
    endRun(s, how, rng);
    s.char2 = s.char; s.char = deadHost; s.actorIdx = 0;
    s.outcome = d.record; s.screen = 'death';
  } else {
    endRun(s, how, rng);
    s.notice = `${d.record.name} went down in ${sectorName(d.record.sector, d.record.map)}. You got out with what you could carry.`;
  }
}

export function recruit(s, rng, slot = 'char') {
  if (slot === 'char2') { s.char2 = null; return; }
  s.char = null;
  s.draft = newDraft(s.meta, rng);
  s.screen = 'create';
  s.notice = null;
}


// ---------- Downtime: the Lantern, the Wheel, orbit runs and ventures ----------
export const inTown = (s) => !s.run && !!s.char && s.screen === 'town';

// The Lantern: order one drink before a raid. It wears off when you come home.
export function buyDrink(s, id) {
  const c = s.char, d = D.BAR.menu.find((x) => x.id === id);
  if (!d || !inTown(s) || c.drink) return false;
  const cost = drinkCost(s, id), before = stats(s).maxHp;
  if (c.credits < cost) return false;
  c.credits -= cost; c.drink = id; ledger(s, 'spend:bar', cost); feat(s, 'drinks');
  c.hp += stats(s).maxHp - before;
  journal(s, `${c.name} orders a ${d.name} at the Lantern.`);
  return true;
}
// The E-Girl Room: 500 credits, one hostess, one permanent mark (about one night in four goes badly). Once per trip home.
export const FAV_LABEL = { hp: ['max HP', true], crit: ['crit', true], dodge: ['dodge', true], atk: ['ATK'], def: ['DEF'], spd: ['SPD'], str: ['STR'], agi: ['AGI'], int: ['INT'], cha: ['CHA'] };
export const favText = (fx) => Object.entries(fx || {}).filter(([, v]) => v).map(([k, v]) => { const [n, pct] = FAV_LABEL[k] || [k]; const x = pct ? Math.round(v * 100) : v; return `${x > 0 ? '+' : '\u2212'}${Math.abs(x)}${pct ? '%' : ''} ${n}`; }).join(', ');
// Tonight's girls: a few of those whose art is in, changing every trip home. Same answer on every screen for the same night.
export function loungeTonight(s, ids = D.LOUNGE.girls.map((g) => g.id)) {
  const pool = [...ids], rng = seededRng(((s.meta.stats && s.meta.stats.raids) || 0) * 7919 + ((s.char && s.char.number) || 0) * 31 + 17), out = [];
  while (pool.length && out.length < D.LOUNGE.tonight) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return D.LOUNGE.girls.filter((g) => out.includes(g.id));
}
// Each night costs 10% more than the last for this operative.
export const loungeCost = (s) => Math.round(D.LOUNGE.cost * Math.pow(1 + D.LOUNGE.rise, (s && s.char && s.char.loungeVisits) || 0));
export function visitLounge(s, id, rng) {
  const c = s.char, girl = D.LOUNGE.girls.find((x) => x.id === id), cost = loungeCost(s);
  if (!girl || !inTown(s) || c.booked || c.credits < cost) return null;
  // 55% a good night, 45% a bad one; within each, the outcomes keep their own weights.
  const bad = rng() < D.LOUNGE.badOdds, pool = girl.outcomes.filter((o) => !!o.bad === bad);
  let roll = rng() * pool.reduce((a, o) => a + o.w, 0), out = pool[0];
  for (const o of pool) { roll -= o.w; if (roll < 0) { out = o; break; } }
  const before = stats(s).maxHp;
  c.credits -= cost; c.booked = id; ledger(s, 'spend:lounge', cost);
  c.loungeVisits = (c.loungeVisits || 0) + 1; c.loungeSpent = (c.loungeSpent || 0) + cost;
  // The cell's own total opens Vex as an operative. A co-op friend's nights count toward their own cell, not this one.
  if (!s.actorIdx) {
    const was = s.meta.loungeSpent || 0, vb = D.BACKGROUNDS.find((b) => b.id === 'vex');
    s.meta.loungeSpent = was + cost;
    if (vb && was < vb.unlock.spent && s.meta.loungeSpent >= vb.unlock.spent) journal(s, 'Vex has had enough of the back room. She wants in. She can be your next operative.', 'reward');
  }
  c.fav = c.fav || {};
  for (const [k, v] of Object.entries(out.fx)) c.fav[k] = Math.round(((c.fav[k] || 0) + v) * 1000) / 1000;
  // A good night sometimes undoes an old bad one, so marks like -CHA don't pile up forever.
  let cured = null;
  if (!out.bad && rng() < D.LOUNGE.cure) {
    const worst = Object.entries(c.fav).filter(([k, v]) => v < 0 && !(k in out.fx)).sort((a, b) => a[1] / (Math.abs(b[1]) || 1) - b[1] / (Math.abs(a[1]) || 1))[0];
    if (worst) { cured = { [worst[0]]: -worst[1] }; delete c.fav[worst[0]]; }
  }
  c.hp = Math.max(1, Math.min(stats(s).maxHp, c.hp + stats(s).maxHp - before));
  const text = cured ? `${out.text} She also sorts out something an old night left you with (${favText(cured)}).` : out.text;
  c.favLog = [{ girl: girl.name, text, fx: out.fx, bad: !!out.bad, cured }, ...(c.favLog || [])].slice(0, 8);
  journal(s, `${c.name} spends a night with ${girl.name} at the Lantern. ${favText(out.fx)}.`, out.bad ? 'bad' : 'reward');
  return { girl: girl.id, name: girl.name, text, fx: out.fx, bad: !!out.bad, cured };
}

// ---------- The barracks ring: a co-op duel ----------
// Both partners pick one of three ready-made loadouts (their own gear doesn't come in), then choose a move each round at
// the same time. Strike beats Guard, Guard beats Shoot, Shoot catches a Strike on the way in. The winner takes one piece
// of the loser's contraband; each needs at least one piece to step in. Runs on the host; the friend's moves arrive as acts.
export const DUEL_BUILDS = {
  bruiser: { name: 'Bruiser', desc: 'Big, slow, hits like a forklift. Haymaker: a huge Strike that ignores Guard.', hp: 138, shoot: 8, strike: 16, def: 3, crit: 0.08, special: 'Haymaker' },
  gunner: { name: 'Gunslinger', desc: 'Glass and lead. Fan the Hammer: three quick shots.', hp: 118, shoot: 19, strike: 10, def: 3, crit: 0.2, special: 'Fan the Hammer' },
  warden: { name: 'Warden', desc: 'Armour and patience. Second Wind: heals a fifth and guards the same turn.', hp: 132, shoot: 13, strike: 13, def: 6, crit: 0.06, special: 'Second Wind' },
};
export const DUEL_MOVES = { strike: 'Strike', shoot: 'Shoot', guard: 'Guard', special: 'Special' };
const DUEL_HIT = { strike: { strike: 1, shoot: 0.7, guard: 1.15, special: 1 }, shoot: { strike: 1.15, shoot: 1, guard: 0.3, special: 1 } };
const duelChar = (s, i) => (i === actorIdx(s) ? s.char : s.char2);
export const duelReady = (s) => !s.run && isCoop(s) && [0, 1].every((i) => { const c = duelChar(s, i); return c && (c.perks || []).length > 0; });
export function duelChallenge(s) {
  if (!duelReady(s) || (s.duel && s.duel.phase !== 'done')) return false;
  const me = actorIdx(s);
  s.duel = { id: Date.now(), by: me, phase: 'invite', build: [null, null], hp: [0, 0], max: [0, 0], cd: [0, 0], move: [null, null], round: 1, log: [], winner: null, prize: null, names: [0, 1].map((i) => duelChar(s, i).name.split(' ')[0]) };
  return true;
}
export function duelAnswer(s, yes) {
  const d = s.duel;
  if (!d || d.phase !== 'invite' || d.by === actorIdx(s)) return false;
  if (!yes || !duelReady(s)) { s.duel = { ...d, phase: 'done', declined: true, winner: null }; return true; }
  d.phase = 'pick'; return true;
}
export function duelPick(s, id) {
  const d = s.duel, b = DUEL_BUILDS[id], me = actorIdx(s);
  if (!d || d.phase !== 'pick' || !b || d.build[me]) return false;
  d.build[me] = id;
  if (d.build[0] && d.build[1]) { d.phase = 'fight'; d.max = d.build.map((k) => DUEL_BUILDS[k].hp); d.hp = [...d.max]; d.log.push('The ring clears. Somebody bangs a mess tin. Fight.'); }
  return true;
}
export function duelMove(s, move, rng) {
  const d = s.duel, me = actorIdx(s);
  if (!d || d.phase !== 'fight' || !DUEL_MOVES[move] || d.move[me] || (move === 'special' && d.cd[me] > 0)) return false;
  d.move[me] = move;
  if (d.move[0] && d.move[1]) duelResolve(s, rng);
  return true;
}
function duelResolve(s, rng) {
  const d = s.duel, B = d.build.map((k) => DUEL_BUILDS[k]), M = [...d.move], dmg = [0, 0], line = [], pre = [...d.hp], fx = [{ hits: [], heal: 0 }, { hits: [], heal: 0 }];
  const guarding = (j) => M[j] === 'guard' || (M[j] === 'special' && d.build[j] === 'warden');
  for (const i of [0, 1]) {
    const j = 1 - i, b = B[i], mv = M[i], foe = guarding(j) ? 'guard' : M[j] === 'special' ? 'special' : M[j];
    const one = (kind, mult) => { const crit = rng() < b.crit, raw = b[kind] * mult * (crit ? 1.6 : 1) * (0.9 + rng() * 0.2); return { n: Math.max(1, Math.round(raw - B[j].def * (foe === 'guard' && kind === 'shoot' ? 1 : 0.5))), crit }; };
    let hits = [];
    if (mv === 'strike' || mv === 'shoot') hits = [one(mv, DUEL_HIT[mv][foe])];
    else if (mv === 'special' && d.build[i] === 'bruiser') hits = [one('strike', 1.9 * (M[j] === 'shoot' ? 0.8 : 1))];
    else if (mv === 'special' && d.build[i] === 'gunner') hits = [0, 1, 2].map(() => one('shoot', 0.7 * DUEL_HIT.shoot[foe]));
    else if (mv === 'special' && d.build[i] === 'warden') { const h = Math.round(d.max[i] * 0.2); d.hp[i] = Math.min(d.max[i], d.hp[i] + h); fx[i].heal = h; line.push(`${d.names[i]} catches a second wind (+${h}).`); }
    const total = hits.reduce((a, h) => a + h.n, 0);
    fx[i].hits = hits; fx[i].guarded = foe === 'guard';
    dmg[j] += total;
    if (hits.length) line.push(`${d.names[i]} ${mv === 'special' ? `uses ${b.special}` : mv === 'strike' ? 'swings' : 'shoots'}${foe === 'guard' && mv !== 'special' ? ' into a guard' : ''}: ${total}${hits.some((h) => h.crit) ? ' (crit)' : ''}.`);
    else if (mv === 'guard') line.push(`${d.names[i]} guards.`);
    if (mv === 'special') d.cd[i] = 3; else if (d.cd[i] > 0) d.cd[i]--;
  }
  for (const i of [0, 1]) d.hp[i] = Math.max(0, d.hp[i] - dmg[i]);
  d.log.push(`Round ${d.round}: ${line.join(' ')}`);
  d.log = d.log.slice(-6);
  d.last = { round: d.round, moves: M, builds: [...d.build], dmg, pre, fx, hp: [...d.hp] };
  d.move = [null, null]; d.round++;
  const out = d.hp.map((h) => h <= 0);
  if (out[0] || out[1] || d.round > 12) {
    const pct = d.hp.map((h, i) => h / d.max[i]);
    d.winner = out[0] && out[1] ? null : out[0] ? 1 : out[1] ? 0 : pct[0] === pct[1] ? null : pct[0] > pct[1] ? 0 : 1;
    if (d.round > 12 && !out[0] && !out[1]) d.log.push('The bell. Nobody\u2019s down, so it goes to points.');
    d.phase = 'done';
    if (d.winner !== null) d.prize = duelTakePrize(s, d.winner, rng);
  }
}
// One piece of the loser's contraband changes hands: one the winner has room for, if there is one.
function duelTakePrize(s, w, rng) {
  const win = duelChar(s, w), lose = duelChar(s, 1 - w), pool = (lose.perks || []).filter((id) => perkStacks(lose, id) > 0);
  if (!pool.length) return null;
  const fits = pool.filter((id) => perkStacks(win, id) < perkCap(win)), from = fits.length ? fits : pool;
  const id = from[Math.floor(rng() * from.length)];
  lose.perkN[id] = perkStacks(lose, id) - 1;
  if (lose.perkN[id] <= 0) { delete lose.perkN[id]; lose.perks = lose.perks.filter((x) => x !== id); }
  win.perkN = win.perkN || {}; win.perkN[id] = perkStacks(win, id) + 1;
  if (!win.perks.includes(id)) win.perks.push(id);
  journal(s, `${win.name} wins a bout in the barracks ring and takes ${lose.name.split(' ')[0]}\u2019s ${perkById(id).name}.`, 'reward');
  return id;
}
export const duelClose = (s) => { if (s.duel && (s.duel.phase === 'done' || (s.duel.phase === 'invite' && s.duel.by === actorIdx(s)))) { s.duel = null; return true; } return false; };

export const drinkCost = (s, id) => Math.ceil(((D.BAR.menu.find((x) => x.id === id) || D.BAR.menu[0]).cost) * 1.1 * hard(s).price * consumableScale(s.char));
// The Wheel: European roulette, one bet per spin.
export const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const BETS = {
  red: { name: 'Red', pays: 1, test: (n) => n > 0 && ROULETTE_RED.has(n) }, black: { name: 'Black', pays: 1, test: (n) => n > 0 && !ROULETTE_RED.has(n) },
  odd: { name: 'Odd', pays: 1, test: (n) => n > 0 && n % 2 === 1 }, even: { name: 'Even', pays: 1, test: (n) => n > 0 && n % 2 === 0 },
  low: { name: '1\u201318', pays: 1, test: (n) => n >= 1 && n <= 18 }, high: { name: '19\u201336', pays: 1, test: (n) => n >= 19 },
  d1: { name: '1st dozen', pays: 2, test: (n) => n >= 1 && n <= 12 }, d2: { name: '2nd dozen', pays: 2, test: (n) => n >= 13 && n <= 24 }, d3: { name: '3rd dozen', pays: 2, test: (n) => n >= 25 },
  straight: { name: 'Single number', pays: 35, test: (n, pick) => n === pick },
};
export const STAKES = [10, 25, 50, 100, 250];
export function spinWheel(s, bet, stake, pick, rng) {
  const c = s.char, b = BETS[bet];
  if (!inTown(s) || !b || !STAKES.includes(stake) || c.credits < stake) return null;
  if (bet === 'straight' && !(pick >= 0 && pick <= 36)) return null;
  const n = Math.floor(rng() * 37), win = b.test(n, pick);
  const delta = win ? stake * b.pays : -stake;
  c.credits += delta; ledger(s, win ? 'wheel' : 'spend:wheel', Math.abs(delta));
  s.meta.wheel = s.meta.wheel || { spins: 0, net: 0, best: 0 };
  feat(s, 'spins'); s.meta.wheel.spins += 1; s.meta.wheel.net += delta; s.meta.wheel.best = Math.max(s.meta.wheel.best, delta);
  journal(s, `${c.name} ${win ? 'wins' : 'loses'} ${Math.abs(delta)} ${D.SETTING.cur} on the Wheel (${n}).`);
  return { n, red: ROULETTE_RED.has(n), win, delta, bet, stake, pick };
}

// Ventures: this operative's money at work, ticked once per raid. Lost with them, like their gear.
// Ventures open as the cell proves itself (deepest sector cleared anywhere) and each holds a capped balance.
const NO_VENTURES = {};
export const vent = (s) => (s.char ? s.char.ventures || (s.char.ventures = {}) : NO_VENTURES);
export const ventureOpen = (s, v) => (s.meta.bestSector || 0) >= (v.unlock || 0);
export const ventureRoom = (s, v) => Math.max(0, (v.cap || Infinity) - Math.round(vent(s)[v.id] || 0));
export function invest(s, id, amount) {
  const v = D.VENTURES.find((x) => x.id === id), c = s.char;
  if (!v || !inTown(s) || !ventureOpen(s, v)) return false;
  amount = Math.min(amount, ventureRoom(s, v));
  if (amount < Math.min(v.min, ventureRoom(s, v)) || amount <= 0 || c.credits < amount) return false;
  c.credits -= amount; ledger(s, 'spend:ventures', amount);
  vent(s)[id] = Math.round((vent(s)[id] || 0) + amount);
  journal(s, `${c.name} puts ${amount} ${D.SETTING.cur} into ${v.name}.`);
  return true;
}
export function withdraw(s, id) {
  const amt = Math.round(vent(s)[id] || 0);
  if (!inTown(s) || amt <= 0) return false;
  vent(s)[id] = 0; s.char.credits += amt; ledger(s, 'ventures', amt);
  journal(s, `${s.char.name} pulls ${amt} ${D.SETTING.cur} out of ${D.VENTURES.find((x) => x.id === id).name}.`);
  return true;
}
// Returns a sentence about anything notable, or ''.
export function tickVentures(s, rng) {
  const notes = [];
  for (const v of D.VENTURES) {
    const amt = vent(s)[v.id] || 0;
    if (amt <= 0) continue;
    if (rng() < v.bust) {
      const lost = Math.round(amt * v.loss);
      vent(s)[v.id] = amt - lost;
      notes.push(v.loss >= 1 ? `${v.name}: the run never came back. ${lost} ${D.SETTING.cur} gone.` : `${v.name} took a hit: \u2212${lost} ${D.SETTING.cur}.`);
      journal(s, `${v.name} loses ${lost} ${D.SETTING.cur}.`, 'bad');
    } else {
      // Growth stops at the cap: a full venture earns nothing until some of it is withdrawn.
      const gain = Math.max(0, Math.min(Math.round(amt * v.rate), (v.cap || Infinity) - amt));
      if (!gain) continue;
      vent(s)[v.id] = amt + gain;
      journal(s, `${v.name} grows by ${gain} ${D.SETTING.cur}.`, 'good');
    }
  }
  return notes.join(' ');
}
export const venturesTotal = (s) => Object.values(vent(s)).reduce((t, v) => t + (v || 0), 0);

// The shuttle.
export function shipStats(m) {
  const sh = m.ship, P = D.SHIP_PARTS;
  return { hull: P.hull.base + P.hull.per * sh.hull, atk: P.guns.base + P.guns.per * sh.guns, shield: P.shields.base + P.shields.per * sh.shields, evade: P.engines.base + P.engines.per * sh.engines, crit: sh.cell.includes('targeting') ? 0.2 : 0 };
}
export const shipPartCost = (s, part) => { const lvl = s.meta.ship[part]; return lvl >= 3 ? 0 : Math.ceil(D.SHIP_PARTS[part].cost[lvl] * 1.1 * hard(s).price); };
export function buyShipPart(s, part) {
  const cost = shipPartCost(s, part);
  if (!inTown(s) || !cost || s.char.credits < cost) return false;
  s.char.credits -= cost; s.meta.ship[part] += 1; ledger(s, 'spend:ship', cost);
  return true;
}
export function buyShipCell(s, id) {
  const u = D.SHIP_CELL.find((x) => x.id === id), m = s.meta;
  if (!u || m.ship.cell.includes(id) || m.resolve < u.cost) return false;
  m.resolve -= u.cost; m.ship.cell.push(id);
  return true;
}
export const marksLeft = (c) => Object.keys(D.MARKS).filter((k) => !(c.marks || []).includes(k));

// An orbit run: a turn-based ship fight kept in s.orbit. Losing the shuttle kills the operative.
// Orbit gating. The cell's first flight is a shakedown: a lighter cutter, and a lost shuttle is towed home instead of
// killing the pilot. After that, every run is permadeath and the harder lines need a refitted shuttle and a win below.
export const shipRefit = (m) => ['hull', 'guns', 'shields', 'engines'].reduce((a, k) => a + (m.ship[k] || 0), 0);
export const orbitShakedown = (m, tierId) => tierId === 'low' && !(m.orbitWins || 0);
export function orbitLock(m, tierId) {
  const t = D.ORBIT_TIERS.find((x) => x.id === tierId), wins = m.orbitTierWins || {};
  if (!t || orbitShakedown(m, tierId)) return null;
  const need = [];
  if (shipRefit(m) < t.refit) need.push(`${t.refit} refit level${t.refit > 1 ? 's' : ''} (have ${shipRefit(m)})`);
  if (t.after && !(wins[t.after] || 0)) need.push(`a win on ${D.ORBIT_TIERS.find((x) => x.id === t.after).name.toLowerCase()}`);
  return need.length ? `Needs ${need.join(' and ')}.` : null;
}
export function orbitFoe(m, tierId) {
  const t = D.ORBIT_TIERS.find((x) => x.id === tierId);
  return orbitShakedown(m, tierId) ? { ...t, ...D.ORBIT_SHAKEDOWN } : t;
}
export function orbitStart(s, tierId, rng) {
  const t0 = D.ORBIT_TIERS.find((x) => x.id === tierId);
  if (!t0 || !inTown(s) || s.orbit || orbitLock(s.meta, tierId) || s.char.orbitFlown) return false;
  s.char.orbitFlown = true;
  const t = orbitFoe(s.meta, tierId), me = shipStats(s.meta);
  s.orbit = { tier: t.id, shakedown: orbitShakedown(s.meta, tierId), hull: me.hull, maxHull: me.hull, eHull: t.hull, eMaxHull: t.hull, step: 0, intent: t.fx[0], evading: false, aimed: false, locked: false, round: 1, log: [], over: null, events: [] };
  s.orbit.log.push(`${t.shipName} on an intercept course. ${D.ORBIT_INTENTS[s.orbit.intent].label}.`);
  journal(s, `${s.char.name} takes the shuttle up: ${t.name}.`);
  return true;
}
const olog = (o, text, kind = 'info') => o.log.push(kind === 'info' ? text : `${kind}:${text}`);
export function orbitAct(s, act, rng) {
  const o = s.orbit, c = s.char;
  if (!o || o.over) return false;
  const t = o.shakedown ? { ...D.ORBIT_TIERS.find((x) => x.id === o.tier), ...D.ORBIT_SHAKEDOWN } : D.ORBIT_TIERS.find((x) => x.id === o.tier), me = shipStats(s.meta);
  o.events = [];
  const hitEnemy = (mult, label) => {
    if (rng() < t.evade) { olog(o, `${label}: the ${t.shipName} rolls clear.`); o.events.push({ t: 'miss', who: 'enemy' }); return; }
    const crit = rng() < me.crit;
    const dmg = Math.max(1, Math.round(me.atk * mult * (o.aimed ? 1.5 : 1) * (crit ? 1.6 : 1) * (0.85 + rng() * 0.3)) - t.shield);
    o.eHull = Math.max(0, o.eHull - dmg); o.aimed = false;
    olog(o, `${label}: ${crit ? 'critical, ' : ''}${dmg} to its hull.`, crit ? 'crit' : 'hit'); o.events.push({ t: 'hit', who: 'enemy', dmg, crit });
  };
  if (act === 'fire') hitEnemy(1, 'Rail cannons');
  else if (act === 'overcharge') { hitEnemy(2, 'Overcharged cannons'); const self = 5; o.hull = Math.max(0, o.hull - self); olog(o, `The capacitors scorch the hull: \u2212${self}.`, 'bad'); o.events.push({ t: 'hit', who: 'me', dmg: self }); }
  else if (act === 'evade') { o.evading = true; o.aimed = true; olog(o, 'You bank hard and line up the next shot.'); o.events.push({ t: 'evade' }); }
  else if (act === 'jump') {
    const ch = clamp(0.4 + me.evade + (c.background === 'runner' ? 0.1 : 0), 0.2, 0.9);
    if (rng() < ch) { o.over = 'jumped'; olog(o, 'The drive catches. Stars smear. You are gone.', 'good'); o.events.push({ t: 'jump' }); finishOrbit(s, rng); return true; }
    olog(o, 'The drive stutters. Not yet.', 'bad'); o.events.push({ t: 'miss', who: 'me' });
  } else return false;
  if (o.eHull <= 0) { o.over = 'won'; olog(o, `The ${t.shipName} breaks apart.`, 'good'); o.events.push({ t: 'kill' }); finishOrbit(s, rng); return true; }
  // Enemy turn.
  const it = o.intent;
  if (it === 'repair') { const h = Math.round(t.hull * 0.15); o.eHull = Math.min(t.hull, o.eHull + h); olog(o, `Damage control: it patches ${h} hull.`); o.events.push({ t: 'repair' }); }
  else if (it === 'lock') { o.locked = true; olog(o, 'Target lock. Its next shot will not miss.', 'bad'); o.events.push({ t: 'lock' }); }
  else {
    const mult = it === 'volley' ? 1.8 : 1;
    const dodge = o.locked ? 0 : (o.evading ? 0.7 : 0) + me.evade;
    if (rng() < dodge) { olog(o, `${D.ORBIT_INTENTS[it].label}: it misses.`, 'good'); o.events.push({ t: 'miss', who: 'me' }); }
    else {
      const shield = o.locked ? Math.floor(me.shield / 2) : me.shield;
      const dmg = Math.max(1, Math.round(t.atk * mult * (0.85 + rng() * 0.3)) - shield);
      o.hull = Math.max(0, o.hull - dmg); olog(o, `${D.ORBIT_INTENTS[it].label}: ${dmg} to your hull.`, 'bad'); o.events.push({ t: 'hit', who: 'me', dmg });
    }
    o.locked = false;
  }
  o.evading = false;
  o.step += 1; o.round += 1; o.intent = t.fx[o.step % t.fx.length];
  if (o.hull <= 0) { o.over = 'lost'; finishOrbit(s, rng); return true; }
  olog(o, `${D.ORBIT_INTENTS[o.intent].label}.`);
  return true;
}
function finishOrbit(s, rng) {
  const o = s.orbit, c = s.char, m = s.meta, t = o.shakedown ? { ...D.ORBIT_TIERS.find((x) => x.id === o.tier), ...D.ORBIT_SHAKEDOWN } : D.ORBIT_TIERS.find((x) => x.id === o.tier);
  o.result = { credits: 0, mark: null, survived: true };
  if (o.over === 'won') { m.orbitTierWins = m.orbitTierWins || {}; m.orbitTierWins[o.tier] = (m.orbitTierWins[o.tier] || 0) + 1; }
  if (o.over === 'won') {
    const cr = Math.round(randInt(rng, t.credits[0], t.credits[1]) * (m.ship.cell.includes('salvager') ? 1.25 : 1) * (1 + markSum(c).credits));
    c.credits += cr; ledger(s, 'orbit', cr); o.result.credits = cr; m.orbitWins = (m.orbitWins || 0) + 1; feat(s, 'orbit'); feat(s, 'credits', cr);
    const left = marksLeft(c);
    if (left.length && rng() < t.mark) { const id = pick(rng, left); c.marks = [...(c.marks || []), id]; o.result.mark = id; journal(s, `${c.name} earns the Mark: ${D.MARKS[id].name}.`, 'good'); }
    else if (!left.length && t.mark >= 1) { c.credits += 150; o.result.credits += 150; }
    olog(o, `Salvage: +${o.result.credits} ${D.SETTING.cur}.${o.result.mark ? ` The Mark of ${D.MARKS[o.result.mark].name}.` : ''}`, 'good');
    journal(s, `${c.name} wins in orbit (${t.name}): +${o.result.credits} ${D.SETTING.cur}.`, 'reward');
  } else if (o.over === 'lost') {
    if (o.shakedown) {
      o.over = 'towed';
      olog(o, 'The shuttle goes dead in the water. Sable\u2019s tug hauls it home. That was the practice run: the next one is for real.', 'bad');
      journal(s, `${c.name}'s shakedown flight ends on a tow line.`, 'bad');
    } else if (m.ship.cell.includes('ejector') && !c.ejected && rng() < 0.5) {
      c.ejected = true; o.result.survived = true; o.over = 'ejected';
      olog(o, 'The shuttle comes apart. The pod fires. You drift home with nothing.', 'bad');
      journal(s, `${c.name}'s shuttle is destroyed; the pod brings them home.`, 'bad');
    } else {
      o.result.survived = false;
      journal(s, `${c.name} is lost in orbit to the ${t.shipName}.`, 'bad');
    }
  }
}
// Closes the orbit screen; the pilot's death is applied here so the result is read first.
export function orbitClose(s) {
  const o = s.orbit;
  if (!o || !o.over) return false;
  s.orbit = null;
  if (!o.result.survived) {
    const t = D.ORBIT_TIERS.find((x) => x.id === o.tier);
    s.run = { map: 'garrison', sector: Math.max(1, s.meta.bestSector || 1), orbit: true, startSector: 1 };
    die(s, { name: t.shipName, id: 'ship:' + t.ship, portrait: null });
    s.outcome.orbit = true; s.outcome.map = 'garrison';
  }
  return true;
}


// ---------- Feats: cell-wide achievements ----------
// FEAT_DEFS: the general feats from data plus one per enemy type (kill:<id>), each with four tiers.
export const FEAT_DEFS = {};
for (const f of D.FEATS) FEAT_DEFS[f.id] = f;
for (const [id, e] of Object.entries(D.ENEMIES)) {
  FEAT_DEFS[`kill:${id}`] = { id: `kill:${id}`, group: e.tags.includes('boss') ? 'Bosses' : 'Enemies', name: e.name, desc: `${e.name}s put down.`, tiers: e.tags.includes('boss') ? D.BOSS_FEAT_TIERS : D.ENEMY_FEAT_TIERS, buff: 'vs', vs: id, per: e.tags.includes('boss') ? 0.03 : 0.02 };
}
export const BUFF_NAMES = { atk: 'damage', ranged: 'ranged damage', melee: 'melee damage', hp: 'max HP', crit: 'crit chance', dodge: 'dodge', escape: 'escape chance', credits: 'credits', xp: 'XP', stim: 'stim healing', vs: 'damage vs' };
export const featTierBuff = (def, i) => def.per * D.FEAT_FALLOFF[i];
export const featTotal = (def, tier) => { let t = 0; for (let i = 0; i < tier; i++) t += featTierBuff(def, i); return t; };
const fbCache = new WeakMap();
// All active feat buffs for a cell, cached until a tier changes.
// ---------- season goals ----------
// Counts from the start of the season. Feat counters feed it (feat() calls this), and a few season-only events call it directly.
export function seasonGoals(m) {
  if (!m.seasonGoals || m.seasonGoals.season !== SEASON) m.seasonGoals = { season: SEASON, c: {}, claimed: [] };
  return m.seasonGoals;
}
export function seasonTick(s, key, n = 1) {
  if (!s || !s.meta || !D.SEASON_GOALS.some((g) => g.key === key)) return;
  if (isCoop(s) && actorIdx(s) === 1) return; // a visiting partner's progress counts on their own cell
  const g = seasonGoals(s.meta); g.c[key] = (g.c[key] || 0) + n;
}
export const goalProgress = (m, goal) => Math.min(goal.n, (seasonGoals(m).c[goal.key] || 0));
export function claimGoal(s, id) {
  const m = s.meta, goal = D.SEASON_GOALS.find((x) => x.id === id), g = seasonGoals(m);
  if (!goal || g.claimed.includes(id) || goalProgress(m, goal) < goal.n) return null;
  g.claimed.push(id);
  const r = goal.reward, cos = cosmetics(m);
  if (r.resolve) { m.resolve += r.resolve; m.totalResolve += r.resolve; }
  if (r.dye && !cos.dye.includes(r.dye)) cos.dye.push(r.dye);
  if (r.back && !cos.back.includes(r.back)) cos.back.push(r.back);
  if (r.felt && !cos.felt.includes(r.felt)) cos.felt.push(r.felt);
  return goal;
}

// ---------- cosmetics ----------
// Owned by the cell: dyes, card backs, felts and hideout pieces (decor: { id: tier }). Paid from the operative's credits.
export function cosmetics(m) {
  const c = m.cosmetics || (m.cosmetics = {});
  for (const k of ['dye', 'back', 'felt']) c[k] = c[k] || [];
  c.decor = c.decor || {};
  return c;
}
const COS = { dye: () => D.DYES, back: () => D.CARD_BACKS, felt: () => D.FELTS };
export function buyCosmetic(s, kind, id) {
  const ch = s.char, list = COS[kind] && COS[kind](), it = list && list.find((x) => x.id === id), cos = cosmetics(s.meta);
  if (!ch || !it || it.season || cos[kind].includes(id) || ch.credits < it.cost) return false;
  ch.credits -= it.cost; cos[kind].push(id); feat(s, 'upgrades');
  ledger(s, 'cosmetic', -it.cost);
  return true;
}
export const ownsCosmetic = (m, kind, id) => { const it = COS[kind]().find((x) => x.id === id); return !!it && (it.cost === 0 && !it.season || cosmetics(m)[kind].includes(id)); };
// Wear a dye (or none) on the current operative.
export function wearDye(s, id) {
  const c = s.char; if (!c || !c.look) return false;
  if (id && !ownsCosmetic(s.meta, 'dye', id)) return false;
  if (id) c.look = { ...c.look, dye: id }; else { const { dye, ...rest } = c.look; c.look = rest; }
  return true;
}
export function useTableStyle(s, kind, id) { if (!ownsCosmetic(s.meta, kind, id)) return false; s.meta[kind === 'back' ? 'cardBack' : 'felt'] = id; return true; }
// Hideout pieces: buying the next tier of a piece.
export function buyDecor(s, id) {
  const ch = s.char, d = D.DECOR.find((x) => x.id === id), cos = cosmetics(s.meta), t = cos.decor[id] || 0;
  if (!ch || !d || t >= d.tiers.length || ch.credits < d.cost[t]) return false;
  ch.credits -= d.cost[t]; cos.decor[id] = t + 1; ledger(s, 'hideout', -d.cost[t]);
  return true;
}
export const hideoutWorth = (m) => Object.entries(cosmetics(m).decor).reduce((n, [id, t]) => { const d = D.DECOR.find((x) => x.id === id); return n + (d ? d.cost.slice(0, t).reduce((a, b) => a + b, 0) : 0); }, 0);

export function featBuffs(m) {
  const F = m.feats || { counters: {}, tiers: {}, v: 0 };
  const hit = fbCache.get(m);
  if (hit && hit.v === (F.v || 0)) return hit.b;
  const b = { atk: 0, ranged: 0, melee: 0, hp: 0, crit: 0, dodge: 0, escape: 0, credits: 0, xp: 0, stim: 0, vs: {} };
  for (const [key, tier] of Object.entries(F.tiers || {})) {
    const def = FEAT_DEFS[key]; if (!def || !tier) continue;
    const v = featTotal(def, tier);
    if (def.buff === 'vs') b.vs[def.vs] = (b.vs[def.vs] || 0) + v; else b[def.buff] += v;
  }
  fbCache.set(m, { v: F.v || 0, b });
  return b;
}
// Counts progress; unlocks tiers; pays Resolve on the top tiers; queues a notice for the UI (s.featUnlocks).
export function feat(s, key, n = 1) {
  seasonTick(s, key, n);
  const def = FEAT_DEFS[key]; if (!def || !s.meta) return;
  const m = s.meta, F = m.feats || (m.feats = { counters: {}, tiers: {}, v: 0 });
  F.counters[key] = (F.counters[key] || 0) + n;
  // A visiting partner's achievements count on their own cell too: the host passes these along.
  if (isCoop(s) && actorIdx(s) === 1) { const g = s.guestFeats || (s.guestFeats = {}); g[key] = (g[key] || 0) + n; }
  const old = F.tiers[key] || 0; let t = old;
  while (t < def.tiers.length && F.counters[key] >= def.tiers[t]) t++;
  if (t > old) {
    F.tiers[key] = t; F.v = (F.v || 0) + 1;
    for (let i = old; i < t; i++) {
      const res = def.resolve ? def.resolve[i] : 0;
      if (res) { m.resolve += res; m.totalResolve += res; }
      (s.featUnlocks = s.featUnlocks || []).push({ key, tier: i + 1, name: def.name, text: featBuffText(def, i), resolve: res });
      journal(s, `Achievement: ${def.name} ${ROMAN[i]} (${featBuffText(def, i)}${res ? `, +${res} ${D.SETTING.meta}` : ''}).`, 'good');
    }
  }
  if (s.run) { const l = s.run.featTouched || (s.run.featTouched = []); if (!l.includes(key)) l.push(key); }
}
export function featBuffText(def, i) {
  const v = featTierBuff(def, i), pct = `+${(v * 100).toFixed(v * 100 < 1 ? 1 : v * 100 % 1 ? 1 : 0)}%`;
  return def.buff === 'vs' ? `${pct} damage vs ${D.ENEMIES[def.vs].name}` : `${pct} ${BUFF_NAMES[def.buff]}`;
}
// Progress rows for the after-action strip: the feats touched this fight, enemy types first.
export function featProgress(s, keys) {
  const F = s.meta.feats || { counters: {}, tiers: {} };
  return keys.map((key) => { const def = FEAT_DEFS[key]; const c = F.counters[key] || 0, t = F.tiers[key] || 0, next = def.tiers[Math.min(t, def.tiers.length - 1)], prev = t ? def.tiers[t - 1] : 0;
    return { key, name: def.name, count: c, tier: t, max: def.tiers.length, next, pct: t >= def.tiers.length ? 1 : Math.min(1, (c - prev) / (next - prev)), done: t >= def.tiers.length }; })
    .sort((a, b) => (a.key.startsWith('kill:') ? 0 : 1) - (b.key.startsWith('kill:') ? 0 : 1));
}
