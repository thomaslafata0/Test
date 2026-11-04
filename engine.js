// Pure game logic. No DOM access, so the balance simulator can run it in Node.
import * as D from './data.js';

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

export const VERSION = 3;
export const FIGHTS_PER_SECTOR = 3;
export const CONTRABAND_SLOTS = 4; // pieces of contraband one operative can carry
export const ELITE_DROP = 0.4;   // chance an elite carries contraband (bosses always do)
export const MIN_FIGHTS = 2; // fights required per sector; the rest of the rooms can be anything
// Enemy growth per sector past their first appearance: linear plus a quadratic tail.
export const growth = (lvl, lin, quad) => 1 + lin * lvl + quad * lvl * lvl;
export const TUNE = { hpLin: 0.34, hpQuad: 0.02, atkLin: 0.2, atkQuad: 0.01, bossHp: 2.3, bossAtk: 1.5, enemyAtk: 1.52, enemyHp: 1.42, statusRate: 1, smashStr: 1, aimed: 1.5 };
export const isBossSector = (n) => n % 5 === 0;
export const mapById = (id) => D.MAPS.find((m) => m.id === id) || D.MAPS[0];
export const sectorName = (n, mapId = 'garrison') => {
  const list = mapById(mapId).sectors, len = list.length;
  const base = list[(n - 1) % len];
  return n > len ? `Sublevel ${Math.ceil(n / len) - 1}: ${base}` : base;
};
export const trainingCost = (level) => 2 + level;
export const xpToNext = (level) => Math.round(20 * Math.pow(1.35, level - 1));
// Armour scales damage down proportionally, so it never makes anyone immune.
export const mitigate = (raw, def) => Math.max(1, Math.round((raw * raw) / (raw + def)));
const has = (c, id) => c.upgrades.includes(id);
const hasImp = (c, id) => c.implants.includes(id);
const hasCell = (m, id) => m.cell.includes(id);
export const hasPerk = (c, id) => !!c && (c.perks || []).includes(id);
export const perkById = (id) => D.PERKS.find((p) => p.id === id);
export const weaponOf = (c) => D.WEAPONS.find((x) => x.id === c.weapon);
export const armorOf = (c) => D.ARMOR.find((x) => x.id === c.armor);

// ---------- state ----------
export function newMeta() {
  return { resolve: 0, totalResolve: 0, training: { hp: 0, atk: 0, def: 0, spd: 0 }, cell: [], operatives: 0, bestSector: 0, bestByMap: {},
    fallen: [], contracts: [], liberated: {}, threat: 0, tips: {}, endingSeen: false, stats: { kills: 0, bosses: 0, raids: 0 } };
}

export function newGame(rng) {
  const meta = newMeta();
  const s = { v: VERSION, meta, char: null, run: null, screen: 'intro', tab: 'market', log: [], notice: null, outcome: null };
  s.draft = newDraft(meta, rng);
  return s;
}

// Older saves keep their permanent progress; the current operative is retired.
export function migrate(s, rng) {
  if (s && s.v === 2 && s.meta) {
    // v2 -> v3: keep everything, add the new systems, call off any raid in progress.
    const fresh = newMeta();
    for (const k of Object.keys(fresh)) if (s.meta[k] === undefined) s.meta[k] = fresh[k];
    if (s.char) s.char.perks = s.char.perks || [];
    if (s.run) { s.run = null; s.notice = 'The cell has new intel on the Directorate. Your last raid was called off; you kept what you carried.'; }
    s.v = VERSION;
    s.screen = s.char ? 'town' : 'create';
    if (!s.char && !s.draft) s.draft = newDraft(s.meta, rng);
    s.tab = 'gate';
    refreshContracts(s, rng);
    return s;
  }
  if (s && s.v === VERSION) {
    // Recalculate open contract payouts (older saves stored inflated haul rewards).
    for (const k of (s.meta && s.meta.contracts) || []) if (!k.done) k.credits = contractCredits(k.kind, k.n);
    return s;
  }
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

// ---------- character creation ----------
export function newDraft(meta, rng) {
  return {
    name: pick(rng, D.OPERATIVE_NAMES), background: 'foundry',
    attrs: { str: D.ATTR_START, agi: D.ATTR_START, int: D.ATTR_START, cha: D.ATTR_START },
    points: D.ATTR_POINTS + (hasCell(meta, 'mentor') ? 1 : 0),
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

export function createChar(s, rng) {
  const m = s.meta, d = s.draft, bg = D.BACKGROUNDS.find((b) => b.id === d.background);
  m.operatives += 1;
  const attrs = {};
  for (const k of Object.keys(D.ATTRS)) attrs[k] = draftAttr(d, k);
  const c = {
    name: (d.name || '').trim().slice(0, 24) || pick(rng, D.OPERATIVE_NAMES), number: m.operatives, background: bg.id,
    attrs, attrPoints: d.points, level: 1, xp: 0, credits: 25 + (bg.start.credits || 0) + (hasCell(m, 'stash') ? 60 : 0),
    weapon: hasCell(m, 'cache') ? 'carbine' : 'holdout', armor: 'none',
    items: { stim: 2, thermal: 0, ion: 0, smoke: 0 }, upgrades: [], implants: [],
    maps: {}, deepest: 0, hp: 1, history: [], perks: [],
  };
  for (const k of ['smoke', 'ion']) if (bg.start[k]) c.items[k] += bg.start[k];
  if (hasCell(m, 'kit')) { c.items.stim += 1; c.items.thermal += 1; }
  c.hp = statsOf(m, c).maxHp;
  s.char = c; s.draft = null;
  refreshContracts(s, rng);
  s.screen = 'town'; s.tab = 'gate';
  s.notice = `${c.name} takes the empty bunk. Gear up, then pick a target.`;
  return c;
}

// ---------- derived stats ----------
export function attr(c, k) {
  const imp = { str: 'myomer', int: 'neural', cha: 'voice' }[k];
  return Math.min(D.ATTR_MAX + 2, c.attrs[k] + (imp && hasImp(c, imp) ? 2 : 0));
}

export function statsOf(meta, c) {
  const t = meta.training, B = D.BASE_STATS, w = weaponOf(c), a = armorOf(c);
  const str = attr(c, 'str'), agi = attr(c, 'agi');
  const strWeapon = w.type === 'melee' || w.type === 'heavy';
  return {
    maxHp: B.hp + t.hp * D.TRAINING.hp.per + (c.level - 1) * 5 + str * 3 + (c.background === 'foundry' ? 10 : 0) + (hasImp(c, 'pain') ? 20 : 0),
    atk: B.atk + t.atk * D.TRAINING.atk.per + (c.level - 1) + w.atk + (strWeapon ? Math.floor(str * 1.5) : 0) + (has(c, 'drill') ? 2 : 0),
    def: B.def + t.def * D.TRAINING.def.per + Math.floor((c.level - 1) / 2) + a.def + (hasImp(c, 'dermal') ? 3 : 0),
    spd: B.spd + t.spd * D.TRAINING.spd.per + Math.floor((c.level - 1) / 3) + agi + (hasImp(c, 'reflex') ? 2 : 0) + (a.spd || 0) + (w.spd || 0),
    crit: 0.05 + (w.crit || 0) + (hasImp(c, 'optic') ? 0.08 : 0),
    carry: 4 + (has(c, 'belt') ? 3 : 0),
    slots: 2 + (attr(c, 'int') >= 4 ? 1 : 0) + (attr(c, 'int') >= 8 ? 1 : 0),
    tech: 1 + 0.1 * attr(c, 'int'),
  };
}
export const stats = (s) => statsOf(s.meta, s.char);
export const price = (s, cost) => Math.round(cost * Math.max(0.6, 1 - 0.04 * (attr(s.char, 'cha') - 1)));
export const meetsReq = (c, req) => !req || Object.entries(req).every(([k, v]) => attr(c, k) >= v);
export const reqText = (req) => req ? Object.entries(req).map(([k, v]) => `${D.ATTRS[k].short} ${v}`).join(', ') : '';

export function skillsOf(c) {
  const out = [];
  const w = weaponOf(c), ws = D.WEAPON_SKILL[w.type];
  if (ws) out.push(ws);
  if (attr(c, 'str') >= 5 && !out.includes('smash')) out.push('smash');
  if (attr(c, 'int') >= 4 && !out.includes('overload')) out.push('overload');
  if (attr(c, 'agi') >= 4) out.push('suppress');
  if (attr(c, 'cha') >= 4) out.push('intimidate');
  return out;
}
export const skillCd = (c, id) => Math.max(1, D.SKILLS[id].cd - (hasImp(c, 'synapse') && id !== 'intimidate' ? 1 : 0));

// Battle events for the animated stage. Only recorded when the UI sets s.events = [] before a turn,
// so the balance simulator pays nothing for them.
function fx(s, ev) {
  if (!Array.isArray(s.events)) return;
  const r = s.run;
  s.events.push({ ...ev, php: s.char.hp, ehp: r && r.enemy ? r.enemy.hp : 0 });
}

function log(s, text, kind = 'info') {
  s.log.push({ text, kind });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
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
  c.hp += Math.max(0, stats(s).maxHp - before);
  s.notice = `${D.ATTRS[k].label} raised to ${c.attrs[k]}.`;
  return true;
}

// ---------- town ----------
export function healCost(s) {
  const st = stats(s);
  return Math.ceil((st.maxHp - s.char.hp) * 0.5 * (hasCell(s.meta, 'ledger') ? 0.5 : 1));
}
export function heal(s) {
  const cost = healCost(s);
  if (cost <= 0 || s.char.credits < cost) return false;
  s.char.credits -= cost; s.char.hp = stats(s).maxHp;
  s.notice = `Doc patched you up for ${cost} ${D.SETTING.cur}.`;
  return true;
}

export function buyGear(s, kind, id) {
  const list = kind === 'weapon' ? D.WEAPONS : D.ARMOR;
  const item = list.find((x) => x.id === id), c = s.char;
  if (!item || c[kind] === id || c.credits < price(s, item.cost) || !meetsReq(c, item.req)) return false;
  const hpBefore = stats(s).maxHp;
  c.credits -= price(s, item.cost); c[kind] = id;
  c.hp = Math.min(c.hp, stats(s).maxHp, hpBefore);
  s.notice = `Bought ${item.name}.`;
  return true;
}

export function buyItem(s, id) {
  const item = D.ITEMS[id], c = s.char;
  if (!item || c.credits < price(s, item.cost) || c.items[id] >= stats(s).carry) return false;
  c.credits -= price(s, item.cost); c.items[id] += 1;
  s.notice = `Bought ${item.name}.`;
  return true;
}

export function buyUpgrade(s, id) {
  const u = D.UPGRADES.find((x) => x.id === id), c = s.char;
  if (!u || has(c, id) || c.credits < price(s, u.cost)) return false;
  c.credits -= price(s, u.cost); c.upgrades.push(id);
  s.notice = `${u.name} acquired.`;
  return true;
}

export function installImplant(s, id) {
  const u = D.IMPLANTS.find((x) => x.id === id), c = s.char;
  if (!u || hasImp(c, id) || c.credits < price(s, u.cost) || c.implants.length >= stats(s).slots) return false;
  const before = stats(s).maxHp;
  c.credits -= price(s, u.cost); c.implants.push(id);
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

export function train(s, stat) {
  const m = s.meta, lvl = m.training[stat], def = D.TRAINING[stat];
  if (!def || lvl >= def.max || m.resolve < trainingCost(lvl)) return false;
  const before = s.char ? stats(s).maxHp : 0;
  m.resolve -= trainingCost(lvl); m.training[stat] += 1;
  if (s.char) s.char.hp += stats(s).maxHp - before;
  s.notice = `${def.label} raised to ${lvl + 1}. This one stays.`;
  return true;
}

export function buyCell(s, id) {
  const u = D.CELL.find((x) => x.id === id), m = s.meta;
  if (!u || hasCell(m, id) || m.resolve < u.cost) return false;
  m.resolve -= u.cost; m.cell.push(id);
  s.notice = `${u.name}: every future operative benefits.`;
  return true;
}

// Everything that scales credit income.
export function creditMult(s) {
  const c = s.char, t = s.run ? s.run.threat : s.meta.threat || 0;
  const b = s.run ? s.run.bulletin : null;
  return (has(c, 'fence') ? 1.25 : 1) * (hasPerk(c, 'chit') ? 1.2 : 1) * (1 + 0.15 * t) * (b === 'payday' ? 1.3 : b === 'lockdown' ? 1.25 : 1);
}

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
export const mapUnlocked = (s, map) => s.meta.bestSector >= map.unlock;
export function mapProgress(c, mapId) {
  if (!c.maps[mapId]) c.maps[mapId] = { insertions: [1], deepest: 0 };
  return c.maps[mapId];
}

export function deploy(s, mapId, startSector, rng) {
  const map = mapById(mapId);
  if (!mapUnlocked(s, map)) return false;
  const prog = mapProgress(s.char, map.id);
  if (!prog.insertions.includes(startSector)) startSector = 1;
  s.run = { map: map.id, sector: startSector, room: 0, choices: null, enemy: null, defending: false, ready: false, nextMod: null, sectorCredits: 0, cooldowns: {}, adrenalUsed: false,
    alert: 0, allies: 0, vent: 3, turns: 0, threat: s.meta.threat || 0, pst: {}, pfresh: [], deadmanUsed: false, perkOffer: null };
  s.meta.stats.raids += 1;
  s.run.bulletin = pickWeighted(rng, D.BULLETINS.map((b) => [b.id, b.weight]));
  refreshContracts(s, rng);
  s.log = [];
  s.notice = null;
  log(s, `You slip into the ${map.name}. ${sectorName(startSector, map.id)}.`, 'sys');
  const bl = bulletinOf(s.run);
  if (bl.id !== 'quiet') log(s, `Directorate bulletin: ${bl.name}. ${bl.desc}`, 'crit');
  beginSector(s, rng);
  return true;
}

export const mechanicOf = (r) => mapById(r.map).mechanic.id;
export const bulletinOf = (r) => D.BULLETINS.find((b) => b.id === (r && r.bulletin)) || D.BULLETINS[0];
export const quirkById = (id) => D.QUIRKS.find((q) => q.id === id);
export const roomName = (mapId, kind) => kind === 'boss' ? 'Boss' : (mapById(mapId).roomNames[kind] || kind);

function raiseAlarm(s, n, why) {
  const r = s.run;
  if (!r || mechanicOf(r) !== 'alarm' || r.alert >= 5) return;
  r.alert = Math.min(5, r.alert + n);
  log(s, `${why} Alarm level ${r.alert}.`, 'bad');
}

// New sector: cooldowns reset, then pick the first room.
function beginSector(s, rng) {
  const r = s.run;
  r.room = 0; r.fightsDone = 0; r.cooldowns = {}; r.sectorCredits = 0;
  offerRoute(s, rng);
}

// Offer two doors (or the boss). At least one door is always a fight.
export function offerRoute(s, rng) {
  const r = s.run, map = mapById(r.map);
  r.enemy = null;
  if (r.room >= FIGHTS_PER_SECTOR) return clearSector(s);
  const remaining = FIGHTS_PER_SECTOR - r.room, needed = MIN_FIGHTS - (r.fightsDone || 0);
  r.forced = false;
  if (r.room === FIGHTS_PER_SECTOR - 1 && isBossSector(r.sector)) r.choices = ['boss'];
  else if (remaining <= needed) { r.choices = ['fight', 'elite']; r.forced = true; }
  else {
    r.forced = false;
    const entries = Object.entries(map.rooms);
    const a = pickWeighted(rng, entries);
    let b = a;
    for (let i = 0; i < 20 && b === a; i++) b = pickWeighted(rng, entries);
    const choices = [a, b];
    if (!choices.some((k) => D.ROOMS[k].fight)) choices[1] = 'fight';
    if (choices[0] === choices[1]) choices[1] = choices[0] === 'fight' ? 'elite' : 'fight';
    r.choices = choices;
  }
  s.screen = 'route';
}
export const nextEncounter = offerRoute;

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
    const range = kind === 'cargo' ? [20, 30] : [8, 15];
    const cr = Math.round(randInt(rng, range[0], range[1]) * r.sector * map.credits * creditMult(s));
    c.credits += cr; r.sectorCredits += cr; notes.push(`+${cr} ${D.SETTING.cur}`);
    if (kind === 'supply' && rng() < 0.5) {
      const it = pick(rng, ['stim', 'thermal', 'ion']);
      if (c.items[it] < st.carry) { c.items[it] += 1; notes.push(`+1 ${D.ITEMS[it].name}`); }
    }
    if (kind === 'cargo') { r.nextMod = 'alerted'; notes.push('next enemy alerted'); text = 'You crack two crates of confiscated goods. Someone heard the crowbar.'; }
    else text = 'Shelves of requisitioned supplies. You take what fits in your pockets.';
  } else if (kind === 'rest') {
    const h = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.3));
    c.hp += h; notes.push(`+${h} HP`);
    text = 'Five quiet minutes. You rewrap the bandages and breathe.';
    if (r.alert > 0) { r.alert = Math.max(0, r.alert - 2); notes.push(`alarm down to ${r.alert}`); text += ' Up on the wall, the alarm lights blink back to amber.'; }
  } else if (kind === 'cells') {
    if (r.allies < 2) { r.allies += 1; notes.push(`ally joins (${r.allies}/2)`); text = 'The lock gives. A prisoner grabs a fallen guard\u2019s baton and falls in behind you.'; }
    else { s.meta.resolve += 1; s.meta.totalResolve += 1; notes.push(`+1 ${D.SETTING.meta}`); text = 'You can\u2019t take more with you. You open the doors and point them to the vents.'; }
  }
  s.roomResult = { kind, name, text, notes };
  s.screen = 'room';
}

function startFight(s, rng, kind) {
  const r = s.run, mech = mechanicOf(r), c = s.char;
  if (kind === 'fight' && r.threat >= 4 && rng() < 0.35) kind = 'elite';
  if (kind === 'fight' && r.bulletin === 'inspection' && rng() < 0.3) kind = 'elite';
  const boss = kind === 'boss';
  const e = makeEnemy(r.sector, boss, rng, r.map, r.threat);
  if (!boss) applyQuirk(r, e, rng);
  if (kind === 'elite') makeElite(e, rng);
  if (r.bulletin === 'payday') e.hp = e.maxHp = Math.round(e.maxHp * 1.1);
  if (r.bulletin === 'lockdown') e.atk = Math.round(e.atk * 1.1);
  if (r.bulletin === 'budget') e.def = Math.max(0, e.def - 1);
  if (r.bulletin === 'inspection') e.xp = Math.round(e.xp * 1.2);
  if (r.bulletin === 'shift' && r.room === 1 && !boss) e.stun = Math.max(e.stun, 1);
  if (mech === 'alarm' && r.alert) { e.atk = Math.round(e.atk * (1 + 0.06 * r.alert)); e.cr = e.cr.map((v) => Math.round(v * (1 + 0.05 * r.alert))); }
  r.enemy = e; r.defending = false; r.ready = false; r.adrenalUsed = false; r.vent = 3; r.turns = 0; r.alarmRaised = false; r.struck = false;
  if (r.room === 1 && has(c, 'forger') && !boss) { e.stun = 1; log(s, 'Your forged papers buy you a free moment.', 'good'); }
  if (r.nextMod === 'stunned') { e.stun = Math.max(e.stun, 1); log(s, 'They don\u2019t see you coming.', 'good'); }
  if (r.nextMod === 'alerted') { e.atk = Math.round(e.atk * 1.2); log(s, 'The alarm is still sounding. They\u2019re ready for you.', 'bad'); }
  r.nextMod = null;
  if (hasPerk(c, 'spotter')) addStatus(e.st, e.fresh, { exposed: 2 });
  if (hasPerk(c, 'reputation') && e.tags.includes('human')) addStatus(e.st, e.fresh, { shaken: 2 });
  e.fresh = [];
  if (hasPerk(c, 'dressing')) { const st = stats(s); c.hp = Math.min(st.maxHp, c.hp + Math.round(st.maxHp * 0.06)); }
  log(s, e.line, boss ? 'boss' : 'sys');
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
  e.hp = e.maxHp = Math.round(e.maxHp * 1.35);
  e.atk = Math.round(e.atk * 1.15); e.def += 1;
  e.cr = e.cr.map((v) => v * 2); e.xp = Math.round(e.xp * 1.5);
  const affixes = Object.keys(D.AFFIXES).filter((a) => !(a === 'relentless' && !e.intents.special));
  e.affix = pick(rng, affixes);
  if (e.affix === 'armoured') e.def += 4;
  if (e.affix === 'berserk') { e.atk = Math.round(e.atk * 1.25); e.hp = e.maxHp = Math.round(e.maxHp * 0.85); }
  if (e.affix === 'relentless') { e.intents = { ...e.intents }; delete e.intents.guard; e.intents.special = (e.intents.special || 0) * 2; }
}

export function makeEnemy(sector, boss, rng, mapId = 'garrison', threat = 0) {
  const map = mapById(mapId);
  let id, lvl;
  if (boss) {
    const idx = sector / 5 - 1;
    id = map.bosses[idx % map.bosses.length];
    lvl = idx * 2 + map.level;
  } else {
    // The four most recently unlocked enemy types, so old enemies don't get absurdly scaled.
    const pool = map.pool.filter(([, min]) => min <= sector).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const [pid, min] = pickWeighted(rng, pool.map((p) => [p, 1 + p[1] * 0.3]));
    id = pid; lvl = sector - min + map.level;
  }
  const base = D.ENEMIES[id];
  const tm = 1 + 0.12 * threat;
  const hp = Math.round(base.hp * TUNE.enemyHp * tm * growth(lvl, TUNE.hpLin, TUNE.hpQuad) * (boss ? TUNE.bossHp : 1));
  const e = {
    id, name: base.name, tags: base.tags || [], line: base.line, portrait: base.portrait || null, boss,
    hp, maxHp: hp,
    atk: Math.round(base.atk * TUNE.enemyAtk * tm * growth(lvl, TUNE.atkLin, TUNE.atkQuad) * (boss ? TUNE.bossAtk : 1)),
    def: base.def + Math.floor(lvl / 2),
    spd: base.spd + Math.floor(lvl / 4),
    cr: base.cr.map((v) => Math.round(v * Math.pow(1.1, lvl) * map.credits)),
    xp: Math.round(base.xp * Math.pow(1.12, lvl) * map.xp),
    intents: D.SPECIALS[id] ? { ...base.intents, special: Math.round(2 * TUNE.statusRate) } : base.intents,
    intent: 'attack', lastIntent: null, stun: 0, shaken: false, st: {}, fresh: [], phase2: false,
  };
  e.intent = chooseIntent(e, rng);
  return e;
}

function chooseIntent(e, rng) {
  const entries = Object.entries(e.intents).filter(([k, w]) => w > 0 &&
    !(k === 'heavy' && e.lastIntent === 'heavy') &&
    !(k === 'special' && e.lastIntent === 'special') &&
    !(k === 'guard' && e.lastIntent === 'guard') &&
    !(k === 'repair' && e.hp > e.maxHp * 0.6));
  const i = entries.length ? pickWeighted(rng, entries) : 'attack';
  e.lastIntent = i;
  return i;
}

// ---------- combat ----------
export function runChance(s) {
  const st = stats(s), e = s.run.enemy;
  const ch = clamp(0.45 + (st.spd - e.spd) * 0.06 + (s.char.background === 'runner' ? 0.15 : 0), 0.1, 0.95);
  return e.boss ? ch * 0.5 : ch;
}
export function dodgeChance(st, e) { return clamp(0.05 + (st.spd - e.spd) * 0.03, 0, 0.35); }
export function critChance(st, e) { return clamp(st.crit + (st.spd - e.spd) * 0.01, 0.02, 0.5); }
export function intimidateChance(s) {
  const e = s.run.enemy;
  if (!e.tags.includes('human')) return 0;
  const bribe = e.quirk && quirkById(e.quirk).bribable ? 0.35 : 0;
  return clamp(0.15 + 0.07 * attr(s.char, 'cha') - (e.boss ? 0.35 : 0) + (1 - e.hp / e.maxHp) * 0.3 + bribe, 0, 0.95);
}

export function canUse(s, act) {
  if (['attack', 'defend', 'run'].includes(act)) return true;
  if (D.SKILLS[act]) return skillsOf(s.char).includes(act) && !(s.run.cooldowns[act] > 0);
  return (s.char.items[act] || 0) > 0;
}

// One weapon hit on the current enemy. Returns damage dealt.
function strike(s, rng, { mult = 1, critBonus = 0, pierce = 0, unarmoredBonus = 1, flat = 0 } = {}) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), w = weaponOf(c);
  if (r.ready) mult *= hasPerk(c, 'steady') ? 2 : 1.5;
  const crit = rng() < critChance(st, e) + critBonus;
  if (crit) mult *= hasPerk(c, 'hollow') ? 2.2 : 1.6;
  if (w.type === 'tech') { pierce = Math.max(pierce, 0.5); if (e.tags.includes('droid')) mult *= 1.5; }
  if (!e.tags.includes('armored')) mult *= unarmoredBonus;
  if (hasPerk(c, 'ambush') && !r.struck) mult *= 2;
  if (hasPerk(c, 'grudge') && (e.elite || e.boss)) mult *= 1.3;
  mult *= outMult(r.pst, e.st);
  r.struck = true;
  let dmg = mitigate(st.atk * (0.85 + rng() * 0.3) * mult + flat, e.def * (1 - pierce));
  if (e.intent === 'guard' && e.stun === 0) dmg = Math.max(1, Math.round(dmg / 2));
  e.hp -= dmg;
  if (hasPerk(c, 'serrated') && e.hp > 0 && rng() < 0.3) addStatus(e.st, e.fresh, { bleed: 2 });
  return { dmg, crit };
}

export function playerAct(s, act, rng) {
  if (s.screen !== 'combat' || !canUse(s, act)) return;
  const r = s.run, e = r.enemy, c = s.char, st = stats(s);
  const wasReady = r.ready;
  r.defending = false;
  const guarded = e.intent === 'guard' && e.stun === 0;
  const skill = D.SKILLS[act];
  if (skill) r.cooldowns[act] = skillCd(c, act) + 1;

  switch (act) {
    case 'attack': {
      const { dmg, crit } = strike(s, rng);
      r.ready = false;
      fx(s, { who: 'player', type: 'shoot', dmg, crit, guarded, ready: wasReady });
      log(s, `${wasReady ? 'Steadied shot. ' : ''}${crit ? 'Critical! ' : ''}You hit ${e.name} for ${dmg}${guarded ? ' through cover' : ''}.`, crit ? 'crit' : 'hit');
      break;
    }
    case 'aimed': {
      const { dmg, crit } = strike(s, rng, { mult: TUNE.aimed, critBonus: 0.25 });
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
    case 'smash': {
      const { dmg, crit } = strike(s, rng, { mult: 1.6, pierce: 0.5, flat: attr(c, 'str') * TUNE.smashStr });
      r.ready = false;
      fx(s, { who: 'player', type: 'smash', dmg, crit, guarded });
      log(s, `Power strike${crit ? ', critical' : ''}: ${dmg} damage.`, crit ? 'crit' : 'hit');
      break;
    }
    case 'overload': {
      const droid = e.tags.includes('droid');
      const dmg = Math.round((6 + attr(c, 'int') * 4 + r.sector * 2) * (droid ? 2 : 1) * (hasPerk(c, 'capacitor') ? 1.3 : 1) * outMult(r.pst, e.st));
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
      e.atk = Math.max(1, Math.round(e.atk * 0.75)); e.shaken = true;
      log(s, `${e.name} doesn\u2019t run, but their aim is shaking. ATK \u221225%.`, 'info');
      break;
    }
    case 'defend':
      r.defending = true; r.ready = true;
      if (hasPerk(c, 'secondwind')) c.hp = Math.min(st.maxHp, c.hp + Math.round(st.maxHp * 0.05));
      fx(s, { who: 'player', type: 'defend' });
      log(s, 'You drop behind cover and steady your aim. Next shot +50%.', 'info');
      break;
    case 'stim': {
      c.items.stim -= 1;
      const amt = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.4 * st.tech));
      c.hp += amt;
      delete r.pst.bleed; delete r.pst.burn;
      fx(s, { who: 'player', type: 'stim', amt });
      log(s, `You jam a stim into your thigh. +${amt} HP.`, 'good');
      break;
    }
    case 'thermal': {
      c.items.thermal -= 1;
      const dmg = Math.round((20 + r.sector * 4) * st.tech * outMult(r.pst, e.st));
      e.hp -= dmg;
      if (hasPerk(c, 'incendiary') && e.hp > 0) addStatus(e.st, e.fresh, { burn: 3 });
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
    case 'smoke':
      c.items.smoke -= 1;
      fx(s, { who: 'player', type: 'smoke' });
      log(s, 'Smoke fills the corridor. You\u2019re gone before it clears.', 'sys');
      return endRun(s, 'escaped');
    case 'run': {
      const ok = rng() < runChance(s);
      fx(s, { who: 'player', type: 'run', ok });
      if (ok) { log(s, 'You break line of sight and run for the exit.', 'sys'); return endRun(s, 'escaped'); }
      log(s, 'You try to break away, but they cut you off.', 'bad');
      raiseAlarm(s, 1, 'Your escape attempt was spotted.');
      break;
    }
  }
  tick(r);
  if (e.hp <= 0) return winFight(s, rng);
  if (e.quirk && quirkById(e.quirk).flee && e.hp < e.maxHp * 0.4) {
    fx(s, { who: 'enemy', type: 'quirk', text: 'Nope!' });
    log(s, `${e.name} decides this isn\u2019t worth it and runs.`, 'good');
    return winFight(s, rng, true);
  }
  checkPhase(s);
  if (r.allies > 0) {
    for (let i = 0; i < r.allies && e.hp > 0; i++) {
      const dmg = mitigate(st.atk * 0.3 * (0.85 + rng() * 0.3), e.def);
      e.hp -= dmg;
      fx(s, { who: 'ally', type: 'shoot', dmg });
      log(s, `A freed prisoner hits ${e.name} for ${dmg}.`, 'hit');
    }
    if (e.hp <= 0) return winFight(s, rng);
  }
  enemyTurn(s, rng);
  if (s.screen === 'combat') envTurn(s, rng);
  if (s.screen === 'combat') statusTurn(s, rng);
}

// Bosses get angrier at half health.
function checkPhase(s) {
  const e = s.run.enemy;
  if (!e || !e.boss || e.phase2 || e.hp <= 0 || e.hp > e.maxHp * 0.5) return;
  e.phase2 = true;
  e.atk = Math.round(e.atk * 1.2);
  e.intents = { ...e.intents, heavy: (e.intents.heavy || 0) + 1, special: (e.intents.special || 0) + 1, guard: 0 };
  const line = (D.BOSS_INFO[e.id] || {}).phase2 || `${e.name} is enraged.`;
  fx(s, { who: 'enemy', type: 'phase', text: line });
  log(s, `${line} ATK +20%.`, 'boss');
}

// Survive a killing blow once per raid with Dead Man's Switch.
function lethalSave(s) {
  const r = s.run, c = s.char;
  if (c.hp > 0 || !hasPerk(c, 'deadman') || r.deadmanUsed) return false;
  r.deadmanUsed = true; c.hp = 1;
  fx(s, { who: 'player', type: 'deadman' });
  log(s, 'Dead Man\u2019s Switch: you refuse to go down. 1 HP.', 'good');
  return true;
}

// End of round: damage over time, regeneration, durations tick down.
function statusTurn(s, rng) {
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
  const ed = tickSide(e.st, e.fresh, e.maxHp);
  let regen = 0;
  if (e.affix === 'regenerating') { regen = Math.min(e.maxHp - e.hp, Math.round(e.maxHp * 0.06)); e.hp += regen; }
  const sd = e.quirk && quirkById(e.quirk).selfDamage;
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
function envTurn(s, rng) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s), mech = mechanicOf(r);
  r.turns += 1;
  if (mech === 'vents') {
    r.vent -= 1;
    if (r.vent <= 0) {
      r.vent = 3;
      const pdmg = r.defending ? 0 : Math.round(st.maxHp * 0.1);
      const edmg = Math.round(e.maxHp * (e.tags.includes('droid') ? 0.06 : 0.12));
      c.hp -= pdmg; e.hp -= edmg;
      fx(s, { who: 'env', type: 'vent', pdmg, edmg, blocked: r.defending });
      log(s, `The furnace vents blast the floor.${pdmg ? ` You take ${pdmg}.` : ' You were behind cover.'}${edmg ? ` ${e.name} takes ${edmg}.` : ''}`, 'bad');
      if (c.hp <= 0 && !lethalSave(s)) return die(s, { name: 'furnace vent', id: null });
      if (e.hp <= 0) return winFight(s, rng);
      checkPhase(s);
    }
  } else if (mech === 'snipers' && rng() < 0.2) {
    const dmg = r.defending ? 0 : Math.round(st.maxHp * 0.08);
    c.hp -= dmg;
    fx(s, { who: 'env', type: 'sniper', dmg, blocked: r.defending });
    log(s, dmg ? `A tower sniper clips you for ${dmg}.` : 'A sniper round sparks off your cover.', dmg ? 'bad' : 'info');
    if (c.hp <= 0 && !lethalSave(s)) return die(s, { name: 'tower sniper', id: null });
  } else if (mech === 'alarm' && r.turns === 5 && !r.alarmRaised) {
    r.alarmRaised = true;
    raiseAlarm(s, 1, 'The fight is dragging on. Someone hit the alarm.');
  }
}

function enemyTurn(s, rng) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s);
  const vamp = (dmg) => { if (e.affix === 'vampiric' && dmg > 0) { e.hp = Math.min(e.maxHp, e.hp + Math.round(dmg / 2)); } };
  const q = e.quirk ? quirkById(e.quirk) : null;
  if (q && q.skip && e.stun === 0 && rng() < q.skip) {
    const lines = ['freezes mid-step and reboots', 'plays a recorded safety announcement', 'spins in a slow circle', 'displays a loading bar'];
    const what = pick(rng, lines);
    fx(s, { who: 'enemy', type: 'quirk', text: 'Glitch!' });
    log(s, `${e.name} ${what}.`, 'good');
    e.intent = chooseIntent(e, rng);
    return;
  }
  if (e.stun > 0) {
    e.stun -= 1;
    fx(s, { who: 'enemy', type: 'stunned' });
    log(s, `${e.name} is stunned and can\u2019t act.`, 'good');
  } else if (e.intent === 'attack' || e.intent === 'heavy') {
    const heavy = e.intent === 'heavy';
    if (r.allies > 0 && rng() < 0.25) {
      r.allies -= 1;
      fx(s, { who: 'enemy', type: e.intent, ally: true, dmg: 0 });
      log(s, `${e.name} guns down one of the freed prisoners.`, 'bad');
    } else if (q && q.miss && rng() < q.miss) {
      fx(s, { who: 'enemy', type: e.intent, dodged: true, missed: true, dmg: 0 });
      log(s, `${e.name} ${pick(rng, q.misses)}.`, 'good');
    } else if (rng() < dodgeChance(st, e)) {
      fx(s, { who: 'enemy', type: e.intent, dodged: true, dmg: 0 });
      log(s, `${e.name} ${heavy ? 'unleashes a heavy strike' : 'fires'}, and you dodge.`, 'good');
    } else {
      const luck = q && q.gamble ? (rng() < 0.5 ? 0.5 : 1.8) : 1;
      let dmg = mitigate(e.atk * (0.85 + rng() * 0.3) * (heavy ? 2.2 : 1) * luck * outMult(e.st, r.pst), st.def);
      if (r.defending) dmg = Math.max(1, Math.round(dmg * (heavy ? 0.25 : 0.5)));
      c.hp -= dmg; vamp(dmg);
      if (q && q.bleedOnHit && !r.defending) addStatus(r.pst, r.pfresh, { bleed: 2 }, hasPerk(c, 'thick') ? 1 : 0);
      if (luck !== 1) log(s, luck > 1 ? 'The gamble pays off for them.' : 'Their gamble doesn\u2019t pay off.', 'info');
      fx(s, { who: 'enemy', type: e.intent, dmg, blocked: r.defending });
      log(s, `${e.name} ${heavy ? 'lands a heavy strike' : 'hits you'} for ${dmg}${r.defending ? ' (blocked)' : ''}.`, heavy ? 'bad' : 'hurt');
    }
  } else if (e.intent === 'special') {
    const sp = D.SPECIALS[e.id];
    let dmg = sp.mult > 0 ? mitigate(e.atk * (0.85 + rng() * 0.3) * sp.mult * outMult(e.st, r.pst), st.def) : 0;
    if (r.defending) dmg = Math.max(dmg ? 1 : 0, Math.round(dmg * 0.5));
    c.hp -= dmg; vamp(dmg);
    const added = r.defending ? [] : addStatus(r.pst, r.pfresh, sp.status, hasPerk(c, 'thick') ? 1 : 0);
    fx(s, { who: 'enemy', type: 'special', name: sp.name, dmg, blocked: r.defending, statuses: added });
    log(s, `${e.name}: ${sp.name}${dmg ? ` for ${dmg}` : ''}${r.defending ? ', mostly blocked' : ''}.${added.length ? ` You are ${added.map((k) => D.STATUSES[k].name).join(' and ')}.` : ''}`, 'bad');
  } else if (e.intent === 'guard') {
    fx(s, { who: 'enemy', type: 'guard' });
    log(s, `${e.name} ${e.suppressed ? 'stays pinned' : 'holds position'} behind cover.`, 'info');
    e.suppressed = false;
  } else if (e.intent === 'repair') {
    const amt = Math.min(e.maxHp - e.hp, Math.round(e.maxHp * 0.15));
    e.hp += amt;
    fx(s, { who: 'enemy', type: 'repair', amt });
    log(s, `${e.name} runs a repair cycle. +${amt} HP.`, 'hurt');
  }
  if (c.hp > 0 && c.hp < st.maxHp * 0.3 && hasImp(c, 'adrenal') && !r.adrenalUsed) {
    r.adrenalUsed = true;
    const amt = Math.round(st.maxHp * 0.25); c.hp = Math.min(st.maxHp, c.hp + amt);
    fx(s, { who: 'player', type: 'stim', amt, adrenal: true });
    log(s, `Adrenal pump kicks in. +${amt} HP.`, 'good');
  }
  if (c.hp <= 0 && !lethalSave(s)) return die(s, e);
  e.intent = chooseIntent(e, rng);
}

function gainXp(s, amount, out) {
  const c = s.char;
  c.xp += amount;
  while (c.xp >= xpToNext(c.level)) {
    const before = stats(s).maxHp;
    c.xp -= xpToNext(c.level); c.level += 1; c.attrPoints += 1;
    c.hp += stats(s).maxHp - before;
    out.levelUps.push(c.level);
  }
}

function winFight(s, rng, fled = false) {
  const r = s.run, e = r.enemy, c = s.char, m = s.meta;
  const credits = Math.round(randInt(rng, e.cr[0], e.cr[1]) * creditMult(s) * (fled ? 0.5 : 1));
  const xp = fled ? Math.round(e.xp * 0.75) : e.xp;
  c.credits += credits; r.sectorCredits += credits;
  const out = { enemy: e.name, id: e.id, portrait: e.portrait, credits, xp, levelUps: [], healed: 0, boss: e.boss, elite: !!e.elite, resolve: 0, fled, items: [], notes: [] };
  log(s, `${e.name} ${fled ? 'flees, dropping a credit pouch' : 'goes down'}. +${credits} ${D.SETTING.cur}, +${xp} XP.`, 'reward');
  fx(s, { who: 'enemy', type: fled ? 'flee' : 'down', boss: e.boss });
  m.stats.kills += 1;
  if (e.affix === 'volatile' && !fled) {
    const st = stats(s), dmg = r.defending ? 0 : Math.round(st.maxHp * 0.15);
    c.hp = Math.max(1, c.hp - dmg);
    fx(s, { who: 'env', type: 'explode', pdmg: dmg });
    out.notes.push(dmg ? `It exploded: \u2212${dmg} HP` : 'It exploded, but you were in cover');
  }
  gainXp(s, xp, out);
  if (out.levelUps.length) fx(s, { who: 'player', type: 'levelup', level: c.level });
  if (has(c, 'medic')) {
    const st = stats(s);
    out.healed = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.15));
    c.hp += out.healed;
  }
  if (hasPerk(c, 'scavenger') && rng() < 0.35) {
    const it = pick(rng, ['stim', 'thermal', 'ion', 'smoke']);
    if (c.items[it] < stats(s).carry) { c.items[it] += 1; out.items.push(D.ITEMS[it].name); }
  }
  if (hasPerk(c, 'quickdraw')) for (const k of Object.keys(r.cooldowns)) if (r.cooldowns[k] < 50) r.cooldowns[k] = Math.max(0, r.cooldowns[k] - 2);
  contractEvent(s, 'kill', { enemy: e });
  if (e.boss) {
    const t = r.threat;
    out.resolve = 3 + (c.background === 'preacher' ? 1 : 0) + (t >= 4 ? 2 : t >= 2 ? 1 : 0);
    m.resolve += out.resolve; m.totalResolve += out.resolve; m.stats.bosses += 1;
    const prog = mapProgress(c, r.map), next = r.sector + 1;
    if (!prog.insertions.includes(next)) prog.insertions.push(next);
    contractEvent(s, 'boss', {});
    if (r.sector >= 15 && !m.liberated[r.map]) {
      m.liberated[r.map] = true;
      out.liberated = mapById(r.map).name;
      log(s, `The ${out.liberated} is liberated.`, 'reward');
    }
  }
  if (!fled && (e.boss || (e.elite && rng() < ELITE_DROP))) r.perkOffer = offerPerks(s, rng, e.boss);
  r.enemy = null;
  s.outcome = out;
  s.screen = 'victory';
}

// ---------- contraband ----------
function offerPerks(s, rng, boss) {
  const owned = s.char.perks;
  let pool = D.PERKS.filter((p) => !owned.includes(p.id));
  const rares = pool.filter((p) => p.rare), commons = pool.filter((p) => !p.rare);
  const out = [];
  const take = (arr) => { if (!arr.length) return; const p = pick(rng, arr); out.push(p.id); arr.splice(arr.indexOf(p), 1); };
  if (boss) take(rares);
  while (out.length < 3 && (rares.length || commons.length)) take(rng() < (boss ? 0.4 : 0.2) && rares.length ? rares : commons.length ? commons : rares);
  return out.length ? out : null;
}
// Take a piece of contraband. With full pockets, dropId names the piece to leave behind.
export function choosePerk(s, id, rng, dropId = null) {
  const r = s.run, c = s.char;
  if (!r || !r.perkOffer) return false;
  if (id && r.perkOffer.includes(id)) {
    if (c.perks.length >= CONTRABAND_SLOTS) {
      if (!dropId || !c.perks.includes(dropId)) return false;
      c.perks = c.perks.filter((p) => p !== dropId);
      log(s, `You leave the ${perkById(dropId).name} behind.`, 'info');
    }
    c.perks.push(id); log(s, `Contraband: ${perkById(id).name}.`, 'reward');
  }
  r.perkOffer = null;
  offerRoute(s, rng);
  return true;
}

// ---------- events ----------
export function continueAfterVictory(s, rng) {
  if (s.run.perkOffer) { s.screen = 'perk'; return; }
  offerRoute(s, rng);
}

export const eventById = (id) => D.EVENTS.find((e) => e.id === id);
export function checkChance(s, check) {
  if (!check) return 1;
  const bonus = s.char.background === 'clerk' && check.attr === 'int' ? 0.15 : 0;
  return clamp(check.base + check.per * attr(s.char, check.attr) + bonus, 0.05, 0.95);
}
export function optionAvailable(s, opt) {
  if (!opt.cost) return true;
  if (opt.cost.credits && s.char.credits < opt.cost.credits) return false;
  if (opt.cost.stim && s.char.items.stim < opt.cost.stim) return false;
  return true;
}

export function resolveEvent(s, index, rng) {
  const ev = eventById(s.event), opt = ev && ev.options[index];
  if (!opt || s.eventResult || !optionAvailable(s, opt)) return;
  const c = s.char, r = s.run, st = stats(s);
  if (opt.cost) { if (opt.cost.credits) c.credits -= opt.cost.credits; if (opt.cost.stim) c.items.stim -= opt.cost.stim; }
  const success = !opt.check || rng() < checkChance(s, opt.check);
  const fxs = success ? opt.win : opt.lose;
  const notes = [];
  if (fxs.credits) { const cr = Math.round(randInt(rng, fxs.credits[0], fxs.credits[1]) * r.sector * creditMult(s)); c.credits += cr; r.sectorCredits += cr; notes.push(`+${cr} ${D.SETTING.cur}`); }
  if (fxs.hp) {
    const amt = Math.round(st.maxHp * Math.abs(fxs.hp));
    if (fxs.hp > 0) { const h = Math.min(st.maxHp - c.hp, amt); c.hp += h; notes.push(`+${h} HP`); }
    else { c.hp = Math.max(1, c.hp - amt); notes.push(`\u2212${amt} HP`); }
  }
  if (fxs.heal === 'full') { notes.push(`+${st.maxHp - c.hp} HP`); c.hp = st.maxHp; }
  if (fxs.items) for (const [k, n] of Object.entries(fxs.items)) { const add = Math.min(n, st.carry - c.items[k]); if (add > 0) { c.items[k] += add; notes.push(`+${add} ${D.ITEMS[k].name}`); } }
  if (fxs.resolve) { s.meta.resolve += fxs.resolve; s.meta.totalResolve += fxs.resolve; notes.push(`+${fxs.resolve} ${D.SETTING.meta}`); }
  if (fxs.next) r.nextMod = fxs.next;
  if (fxs.next === 'stunned') notes.push('next enemy surprised');
  if (fxs.next === 'alerted') { notes.push('next enemy alerted'); raiseAlarm(s, 1, 'Your cover slipped.'); }
  if (fxs.ally) {
    if (r.allies < 2) { r.allies += 1; notes.push(`ally joins (${r.allies}/2)`); }
    else { s.meta.resolve += 1; s.meta.totalResolve += 1; notes.push(`+1 ${D.SETTING.meta}`); }
  }
  if (fxs.attrs) { const a = changeAttrs(s, fxs.attrs, opt.label); if (a) notes.push(a); }
  s.eventResult = { success, check: !!opt.check, text: fxs.text, notes, label: opt.label };
}

function clearSector(s) {
  const r = s.run, c = s.char, map = mapById(r.map), m = s.meta;
  const bonus = Math.round(8 * r.sector * map.credits * creditMult(s));
  const prog = mapProgress(c, r.map);
  // Resolve only for new ground: sectors this operative hasn't cleared on this map before.
  // Repeat clears pay every other time, so farming early sectors is slow.
  const fresh = r.sector > prog.deepest;
  if (!fresh) c.repeatClears = (c.repeatClears || 0) + 1;
  const pays = fresh || c.repeatClears % 2 === 0;
  const res = pays ? 1 + (r.threat >= 3 && isBossSector(r.sector) ? 1 : 0) : 0;
  c.credits += bonus;
  m.resolve += res; m.totalResolve += res;
  prog.deepest = Math.max(prog.deepest, r.sector);
  c.deepest = Math.max(c.deepest, r.sector);
  m.bestSector = Math.max(m.bestSector, r.sector);
  m.bestByMap[r.map] = Math.max(m.bestByMap[r.map] || 0, r.sector);
  contractEvent(s, 'sector', {});
  s.outcome = { sector: r.sector, bonus, credits: r.sectorCredits + bonus, resolve: res, fresh };
  log(s, `${sectorName(r.sector, r.map)} cleared. +${bonus} ${D.SETTING.cur}${res ? `, +${res} ${D.SETTING.meta}` : ''}.`, 'reward');
  s.screen = 'sectorClear';
}

export function pushDeeper(s, rng) {
  const r = s.run;
  r.sector += 1;
  log(s, `You go deeper. ${sectorName(r.sector, r.map)}.`, 'sys');
  beginSector(s, rng);
}

export function endRun(s, how) {
  const r = s.run;
  let home = '';
  if (how === 'extracted' && r.allies > 0) {
    s.meta.resolve += r.allies; s.meta.totalResolve += r.allies;
    home = ` You brought ${r.allies} prisoner${r.allies > 1 ? 's' : ''} home: +${r.allies} ${D.SETTING.meta}.`;
  }
  if (how === 'extracted') contractEvent(s, 'extract', { credits: s.char.credits, allies: r.allies });
  s.notice = how === 'extracted'
    ? `You made it out of ${sectorName(r.sector, r.map)}.${home} Spend it before your luck runs out.`
    : `You escaped from ${sectorName(r.sector, r.map)} with what you were carrying.`;
  s.run = null;
  s.screen = allLiberated(s) && !s.meta.endingSeen ? 'ending' : 'town';
  s.tab = 'clinic';
}

export const allLiberated = (s) => D.MAPS.every((m) => s.meta.liberated[m.id]);
export const maxThreat = (s) => Math.min(D.THREAT.length - 1, Object.keys(s.meta.liberated).length);

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
    if (t.kind === 'sector') n = Math.min(15, Math.max(3, (m.bestByMap[map.id] || 0) + (t.n >= 7 ? 4 : 2)));
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
      if (s.char) s.char.credits += k.credits;
      if (r) log(s, `Contract complete: ${k.text}. +${k.resolve} ${D.SETTING.meta}, +${k.credits} ${D.SETTING.cur}.`, 'reward');
      s.contractDone = k.text;
    }
  }
}

function die(s, foe) {
  fx(s, { who: 'player', type: 'down' });
  const c = s.char, r = s.run;
  const record = { name: c.name, number: c.number, level: c.level, sector: r.sector, map: r.map, killer: foe.name, killerId: foe.id, killerPortrait: foe.portrait, credits: c.credits, background: c.background };
  s.meta.fallen.unshift(record);
  s.meta.fallen = s.meta.fallen.slice(0, 12);
  record.perks = (c.perks || []).length;
  s.outcome = record;
  s.run = null;
  s.screen = 'death';
}

export function recruit(s, rng) {
  s.char = null;
  s.draft = newDraft(s.meta, rng);
  s.screen = 'create';
  s.notice = null;
}
