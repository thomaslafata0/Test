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

export const VERSION = 2;
export const FIGHTS_PER_SECTOR = 3;
// Enemy growth per sector past their first appearance: linear plus a quadratic tail.
export const growth = (lvl, lin, quad) => 1 + lin * lvl + quad * lvl * lvl;
export const TUNE = { hpLin: 0.34, hpQuad: 0.02, atkLin: 0.2, atkQuad: 0.01, bossHp: 1.8, bossAtk: 1.35, enemyAtk: 1.35, enemyHp: 1.3, smashStr: 1, aimed: 1.5 };
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
export const weaponOf = (c) => D.WEAPONS.find((x) => x.id === c.weapon);
export const armorOf = (c) => D.ARMOR.find((x) => x.id === c.armor);

// ---------- state ----------
export function newMeta() {
  return { resolve: 0, totalResolve: 0, training: { hp: 0, atk: 0, def: 0, spd: 0 }, cell: [], operatives: 0, bestSector: 0, bestByMap: {}, fallen: [] };
}

export function newGame(rng) {
  const meta = newMeta();
  const s = { v: VERSION, meta, char: null, run: null, screen: 'intro', tab: 'market', log: [], notice: null, outcome: null };
  s.draft = newDraft(meta, rng);
  return s;
}

// Older saves keep their permanent progress; the current operative is retired.
export function migrate(s, rng) {
  if (s && s.v === VERSION) return s;
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
    maps: {}, deepest: 0, hp: 1, history: [],
  };
  for (const k of ['smoke', 'ion']) if (bg.start[k]) c.items[k] += bg.start[k];
  if (hasCell(m, 'kit')) { c.items.stim += 1; c.items.thermal += 1; }
  c.hp = statsOf(m, c).maxHp;
  s.char = c; s.draft = null;
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
  s.run = { map: map.id, sector: startSector, fight: 0, enemy: null, defending: false, ready: false, nextMod: null, sectorCredits: 0, cooldowns: {}, adrenalUsed: false };
  s.log = [];
  s.notice = null;
  log(s, `You slip into the ${map.name}. ${sectorName(startSector, map.id)}.`, 'sys');
  nextEncounter(s, rng);
  return true;
}

export function makeEnemy(sector, boss, rng, mapId = 'garrison') {
  const map = mapById(mapId);
  let id, lvl;
  if (boss) {
    const idx = sector / 5 - 1;
    id = map.bosses[idx % map.bosses.length];
    lvl = idx * 3 + map.level;
  } else {
    // The four most recently unlocked enemy types, so old enemies don't get absurdly scaled.
    const pool = map.pool.filter(([, min]) => min <= sector).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const [pid, min] = pickWeighted(rng, pool.map((p) => [p, 1 + p[1] * 0.3]));
    id = pid; lvl = sector - min + map.level;
  }
  const base = D.ENEMIES[id];
  const hp = Math.round(base.hp * TUNE.enemyHp * growth(lvl, TUNE.hpLin, TUNE.hpQuad) * (boss ? TUNE.bossHp : 1));
  const e = {
    id, name: base.name, tags: base.tags || [], line: base.line, portrait: base.portrait || null, boss,
    hp, maxHp: hp,
    atk: Math.round(base.atk * TUNE.enemyAtk * growth(lvl, TUNE.atkLin, TUNE.atkQuad) * (boss ? TUNE.bossAtk : 1)),
    def: base.def + Math.floor(lvl / 2),
    spd: base.spd + Math.floor(lvl / 4),
    cr: base.cr.map((v) => Math.round(v * Math.pow(1.1, lvl) * map.credits)),
    xp: Math.round(base.xp * Math.pow(1.12, lvl) * map.xp),
    intents: base.intents, intent: 'attack', lastIntent: null, stun: 0, shaken: false,
  };
  e.intent = chooseIntent(e, rng);
  return e;
}

function chooseIntent(e, rng) {
  const entries = Object.entries(e.intents).filter(([k]) =>
    !(k === 'heavy' && e.lastIntent === 'heavy') &&
    !(k === 'guard' && e.lastIntent === 'guard') &&
    !(k === 'repair' && e.hp > e.maxHp * 0.6));
  const i = pickWeighted(rng, entries);
  e.lastIntent = i;
  return i;
}

export function nextEncounter(s, rng) {
  const r = s.run;
  r.fight += 1;
  if (r.fight > FIGHTS_PER_SECTOR) return clearSector(s);
  const boss = isBossSector(r.sector) && r.fight === FIGHTS_PER_SECTOR;
  const e = makeEnemy(r.sector, boss, rng, r.map);
  r.enemy = e; r.defending = false; r.ready = false; r.cooldowns = {}; r.adrenalUsed = false;
  if (r.fight === 1 && has(s.char, 'forger') && !boss) { e.stun = 1; log(s, 'Your forged papers buy you a free moment.', 'good'); }
  if (r.nextMod === 'stunned') { e.stun = Math.max(e.stun, 1); log(s, 'They don\u2019t see you coming.', 'good'); }
  if (r.nextMod === 'alerted') { e.atk = Math.round(e.atk * 1.2); log(s, 'The alarm is still sounding. They\u2019re ready for you.', 'bad'); }
  r.nextMod = null;
  log(s, e.line, boss ? 'boss' : 'sys');
  s.screen = 'combat';
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
  return clamp(0.15 + 0.07 * attr(s.char, 'cha') - (e.boss ? 0.35 : 0) + (1 - e.hp / e.maxHp) * 0.3, 0, 0.9);
}

export function canUse(s, act) {
  if (['attack', 'defend', 'run'].includes(act)) return true;
  if (D.SKILLS[act]) return skillsOf(s.char).includes(act) && !(s.run.cooldowns[act] > 0);
  return (s.char.items[act] || 0) > 0;
}

// One weapon hit on the current enemy. Returns damage dealt.
function strike(s, rng, { mult = 1, critBonus = 0, pierce = 0, unarmoredBonus = 1, flat = 0 } = {}) {
  const r = s.run, e = r.enemy, st = stats(s), w = weaponOf(s.char);
  if (r.ready) mult *= 1.5;
  const crit = rng() < critChance(st, e) + critBonus;
  if (crit) mult *= 1.6;
  if (w.type === 'tech') { pierce = Math.max(pierce, 0.5); if (e.tags.includes('droid')) mult *= 1.5; }
  if (!e.tags.includes('armored')) mult *= unarmoredBonus;
  let dmg = mitigate(st.atk * (0.85 + rng() * 0.3) * mult + flat, e.def * (1 - pierce));
  if (e.intent === 'guard' && e.stun === 0) dmg = Math.max(1, Math.round(dmg / 2));
  e.hp -= dmg;
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
      const dmg = Math.round((6 + attr(c, 'int') * 4 + r.sector * 2) * (droid ? 2 : 1));
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
      fx(s, { who: 'player', type: 'defend' });
      log(s, 'You drop behind cover and steady your aim. Next shot +50%.', 'info');
      break;
    case 'stim': {
      c.items.stim -= 1;
      const amt = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.4 * st.tech));
      c.hp += amt;
      fx(s, { who: 'player', type: 'stim', amt });
      log(s, `You jam a stim into your thigh. +${amt} HP.`, 'good');
      break;
    }
    case 'thermal': {
      c.items.thermal -= 1;
      const dmg = Math.round((20 + r.sector * 4) * st.tech);
      e.hp -= dmg;
      fx(s, { who: 'player', type: 'thermal', dmg });
      log(s, `Thermal charge! ${e.name} takes ${dmg}, armour or not.`, 'crit');
      break;
    }
    case 'ion': {
      c.items.ion -= 1;
      const droid = e.tags.includes('droid');
      e.stun = droid ? 3 : 1;
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
      break;
    }
  }
  if (e.hp <= 0) return winFight(s, rng);
  enemyTurn(s, rng);
  if (s.run) for (const k of Object.keys(r.cooldowns)) if (r.cooldowns[k] > 0 && r.cooldowns[k] < 50) r.cooldowns[k] -= 1;
}

function enemyTurn(s, rng) {
  const r = s.run, e = r.enemy, c = s.char, st = stats(s);
  if (e.stun > 0) {
    e.stun -= 1;
    fx(s, { who: 'enemy', type: 'stunned' });
    log(s, `${e.name} is stunned and can\u2019t act.`, 'good');
  } else if (e.intent === 'attack' || e.intent === 'heavy') {
    const heavy = e.intent === 'heavy';
    if (rng() < dodgeChance(st, e)) {
      fx(s, { who: 'enemy', type: e.intent, dodged: true, dmg: 0 });
      log(s, `${e.name} ${heavy ? 'unleashes a heavy strike' : 'fires'}, and you dodge.`, 'good');
    } else {
      let dmg = mitigate(e.atk * (0.85 + rng() * 0.3) * (heavy ? 2.2 : 1), st.def);
      if (r.defending) dmg = Math.max(1, Math.round(dmg * (heavy ? 0.25 : 0.5)));
      c.hp -= dmg;
      fx(s, { who: 'enemy', type: e.intent, dmg, blocked: r.defending });
      log(s, `${e.name} ${heavy ? 'lands a heavy strike' : 'hits you'} for ${dmg}${r.defending ? ' (blocked)' : ''}.`, heavy ? 'bad' : 'hurt');
      if (c.hp > 0 && c.hp < st.maxHp * 0.3 && hasImp(c, 'adrenal') && !r.adrenalUsed) {
        r.adrenalUsed = true;
        const amt = Math.round(st.maxHp * 0.25); c.hp = Math.min(st.maxHp, c.hp + amt);
        fx(s, { who: 'player', type: 'stim', amt, adrenal: true });
        log(s, `Adrenal pump kicks in. +${amt} HP.`, 'good');
      }
    }
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
  if (c.hp <= 0) return die(s, e);
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
  const r = s.run, e = r.enemy, c = s.char;
  const credits = Math.round(randInt(rng, e.cr[0], e.cr[1]) * (has(c, 'fence') ? 1.25 : 1) * (fled ? 0.5 : 1));
  const xp = fled ? Math.round(e.xp * 0.75) : e.xp;
  c.credits += credits; r.sectorCredits += credits;
  const out = { enemy: e.name, id: e.id, portrait: e.portrait, credits, xp, levelUps: [], healed: 0, boss: e.boss, resolve: 0, fled };
  log(s, `${e.name} ${fled ? 'flees, dropping a credit pouch' : 'goes down'}. +${credits} ${D.SETTING.cur}, +${xp} XP.`, 'reward');
  fx(s, { who: 'enemy', type: fled ? 'flee' : 'down' });
  gainXp(s, xp, out);
  if (out.levelUps.length) fx(s, { who: 'player', type: 'levelup', level: c.level });
  if (has(c, 'medic')) {
    const st = stats(s);
    out.healed = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.15));
    c.hp += out.healed;
  }
  if (e.boss) {
    out.resolve = 3 + (c.background === 'preacher' ? 1 : 0);
    s.meta.resolve += out.resolve; s.meta.totalResolve += out.resolve;
    const prog = mapProgress(c, r.map), next = r.sector + 1;
    if (!prog.insertions.includes(next)) prog.insertions.push(next);
  }
  r.enemy = null;
  s.outcome = out;
  s.screen = 'victory';
}

// ---------- events ----------
export function continueAfterVictory(s, rng) {
  const r = s.run, map = mapById(r.map);
  if (r.fight < FIGHTS_PER_SECTOR && rng() < map.events) {
    const pool = D.EVENTS.filter((ev) => ev.maps === 'any' || ev.maps.includes(r.map));
    s.event = pick(rng, pool).id;
    s.eventResult = null;
    s.screen = 'event';
    return;
  }
  nextEncounter(s, rng);
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
  if (fxs.credits) { const cr = randInt(rng, fxs.credits[0], fxs.credits[1]) * r.sector; c.credits += cr; r.sectorCredits += cr; notes.push(`+${cr} ${D.SETTING.cur}`); }
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
  if (fxs.next === 'alerted') notes.push('next enemy alerted');
  if (fxs.attrs) { const a = changeAttrs(s, fxs.attrs, opt.label); if (a) notes.push(a); }
  s.eventResult = { success, check: !!opt.check, text: fxs.text, notes, label: opt.label };
}

function clearSector(s) {
  const r = s.run, c = s.char, map = mapById(r.map);
  const bonus = Math.round(8 * r.sector * map.credits);
  c.credits += bonus;
  s.meta.resolve += 1; s.meta.totalResolve += 1;
  const prog = mapProgress(c, r.map);
  prog.deepest = Math.max(prog.deepest, r.sector);
  c.deepest = Math.max(c.deepest, r.sector);
  s.meta.bestSector = Math.max(s.meta.bestSector, r.sector);
  s.meta.bestByMap[r.map] = Math.max(s.meta.bestByMap[r.map] || 0, r.sector);
  s.outcome = { sector: r.sector, bonus, credits: r.sectorCredits + bonus };
  log(s, `${sectorName(r.sector, r.map)} cleared. +${bonus} ${D.SETTING.cur}, +1 ${D.SETTING.meta}.`, 'reward');
  s.screen = 'sectorClear';
}

export function pushDeeper(s, rng) {
  const r = s.run;
  r.sector += 1; r.fight = 0; r.sectorCredits = 0;
  log(s, `You go deeper. ${sectorName(r.sector, r.map)}.`, 'sys');
  nextEncounter(s, rng);
}

export function endRun(s, how) {
  const r = s.run;
  s.notice = how === 'extracted'
    ? `You made it out of ${sectorName(r.sector, r.map)}. Spend it before your luck runs out.`
    : `You escaped from ${sectorName(r.sector, r.map)} with what you were carrying.`;
  s.run = null;
  s.screen = 'town';
  s.tab = 'clinic';
}

function die(s, foe) {
  fx(s, { who: 'player', type: 'down' });
  const c = s.char, r = s.run;
  const record = { name: c.name, number: c.number, level: c.level, sector: r.sector, map: r.map, killer: foe.name, killerId: foe.id, killerPortrait: foe.portrait, credits: c.credits, background: c.background };
  s.meta.fallen.unshift(record);
  s.meta.fallen = s.meta.fallen.slice(0, 12);
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
