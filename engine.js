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

export const FIGHTS_PER_SECTOR = 3;
// Enemy growth per sector past their first appearance: linear plus a quadratic tail.
export const growth = (lvl, lin, quad) => 1 + lin * lvl + quad * lvl * lvl;
export const TUNE = { hpLin: 0.3, hpQuad: 0.02, atkLin: 0.18, atkQuad: 0.01, bossHp: 1.8, bossAtk: 1.35 };
export const isBossSector = (n) => n % 5 === 0;
export const sectorName = (n) => {
  const len = D.SECTORS.length;
  const base = D.SECTORS[(n - 1) % len];
  return n > len ? `Sublevel ${Math.ceil(n / len) - 1}: ${base}` : base;
};
export const trainingCost = (level) => 2 + level;
export const xpToNext = (level) => Math.round(20 * Math.pow(1.35, level - 1));
// Armour scales damage down proportionally, so it never makes anyone immune.
export const mitigate = (raw, def) => Math.max(1, Math.round((raw * raw) / (raw + def)));
const has = (c, id) => c.upgrades.includes(id);

// ---------- state ----------
export function newMeta() {
  return { resolve: 0, totalResolve: 0, training: { hp: 0, atk: 0, def: 0, spd: 0 }, operatives: 0, bestSector: 0, fallen: [] };
}

export function newChar(meta, rng) {
  meta.operatives += 1;
  const c = {
    name: pick(rng, D.OPERATIVE_NAMES), number: meta.operatives,
    level: 1, xp: 0, credits: 25, weapon: 'holdout', armor: 'none',
    items: { stim: 2, thermal: 0, ion: 0, smoke: 0 }, upgrades: [],
    insertions: [1], deepest: 0, hp: 1,
  };
  c.hp = statsOf(meta, c).maxHp;
  return c;
}

export function newGame(rng) {
  const meta = newMeta();
  return { v: 1, meta, char: newChar(meta, rng), run: null, screen: 'intro', tab: 'market', log: [], notice: null, outcome: null };
}

export function statsOf(meta, c) {
  const t = meta.training, B = D.BASE_STATS;
  const w = D.WEAPONS.find((x) => x.id === c.weapon), a = D.ARMOR.find((x) => x.id === c.armor);
  return {
    maxHp: B.hp + t.hp * D.TRAINING.hp.per + (c.level - 1) * 5,
    atk: B.atk + t.atk * D.TRAINING.atk.per + (c.level - 1) + w.atk + (has(c, 'drill') ? 2 : 0),
    def: B.def + t.def * D.TRAINING.def.per + Math.floor((c.level - 1) / 2) + a.def,
    spd: B.spd + t.spd * D.TRAINING.spd.per + Math.floor((c.level - 1) / 3) + (has(c, 'reflex') ? 2 : 0) + (a.spd || 0),
    crit: 0.05 + (w.crit || 0),
    carry: 4 + (has(c, 'belt') ? 3 : 0),
  };
}
export const stats = (s) => statsOf(s.meta, s.char);

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

// ---------- town ----------
export function healCost(s) { const st = stats(s); return Math.ceil((st.maxHp - s.char.hp) * 0.5); }
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
  if (!item || c[kind] === id || c.credits < item.cost) return false;
  const current = list.find((x) => x.id === c[kind]);
  if (list.indexOf(item) < list.indexOf(current)) return false;
  const hpBefore = stats(s).maxHp;
  c.credits -= item.cost; c[kind] = id;
  c.hp = Math.min(c.hp, stats(s).maxHp, hpBefore);
  s.notice = `Bought ${item.name}.`;
  return true;
}

export function buyItem(s, id) {
  const item = D.ITEMS[id], c = s.char;
  if (!item || c.credits < item.cost || c.items[id] >= stats(s).carry) return false;
  c.credits -= item.cost; c.items[id] += 1;
  s.notice = `Bought ${item.name}.`;
  return true;
}

export function buyUpgrade(s, id) {
  const u = D.UPGRADES.find((x) => x.id === id), c = s.char;
  if (!u || has(c, id) || c.credits < u.cost) return false;
  c.credits -= u.cost; c.upgrades.push(id);
  s.notice = `${u.name} acquired.`;
  return true;
}

export function train(s, stat) {
  const m = s.meta, lvl = m.training[stat], def = D.TRAINING[stat];
  if (!def || lvl >= def.max || m.resolve < trainingCost(lvl)) return false;
  const before = stats(s).maxHp;
  m.resolve -= trainingCost(lvl); m.training[stat] += 1;
  s.char.hp += stats(s).maxHp - before;
  s.notice = `${def.label} raised to ${lvl + 1}. This one stays.`;
  return true;
}

// ---------- dungeon ----------
export function deploy(s, startSector, rng) {
  if (!s.char.insertions.includes(startSector)) startSector = 1;
  s.run = { sector: startSector, fight: 0, enemy: null, defending: false, ready: false, nextMod: null, sectorCredits: 0 };
  s.log = [];
  s.notice = null;
  log(s, `You slip through the ${D.SETTING.dungeon} perimeter. ${sectorName(startSector)}.`, 'sys');
  nextEncounter(s, rng);
}

export function makeEnemy(sector, boss, rng) {
  let base, lvl;
  if (boss) {
    const idx = sector / 5 - 1;
    base = D.BOSSES[idx % D.BOSSES.length];
    lvl = idx * 3;
  } else {
    // The four most recently unlocked enemy types, so old enemies don't get absurdly scaled.
    const pool = D.ENEMIES.filter((e) => e.min <= sector).sort((a, b) => b.min - a.min).slice(0, 4);
    base = pickWeighted(rng, pool.map((e) => [e, 1 + e.min * 0.3]));
    lvl = sector - base.min;
  }
  const hp = Math.round(base.hp * growth(lvl, TUNE.hpLin, TUNE.hpQuad) * (boss ? TUNE.bossHp : 1));
  const e = {
    id: base.id, name: base.name, tags: base.tags || [], line: base.line, portrait: base.portrait || null, boss,
    hp, maxHp: hp,
    atk: Math.round(base.atk * growth(lvl, TUNE.atkLin, TUNE.atkQuad) * (boss ? TUNE.bossAtk : 1)),
    def: base.def + Math.floor(lvl / 2),
    spd: base.spd + Math.floor(lvl / 4),
    cr: base.cr.map((v) => Math.round(v * Math.pow(1.1, lvl))),
    xp: Math.round(base.xp * Math.pow(1.12, lvl)),
    intents: base.intents, intent: 'attack', lastIntent: null, stun: 0,
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
  const e = makeEnemy(r.sector, boss, rng);
  r.enemy = e; r.defending = false; r.ready = false;
  if (r.nextMod === 'stunned') { e.stun = 1; log(s, 'The doors you sliced open early. They don\u2019t see you coming.', 'good'); }
  if (r.nextMod === 'alerted') { e.atk = Math.round(e.atk * 1.2); log(s, 'The alarm is still sounding. They\u2019re ready for you.', 'bad'); }
  r.nextMod = null;
  log(s, e.line, boss ? 'boss' : 'sys');
  s.screen = 'combat';
}

export function runChance(s) {
  const st = stats(s), e = s.run.enemy;
  const ch = clamp(0.45 + (st.spd - e.spd) * 0.06, 0.1, 0.9);
  return e.boss ? ch * 0.5 : ch;
}
export function dodgeChance(st, e) { return clamp(0.05 + (st.spd - e.spd) * 0.03, 0, 0.35); }
export function critChance(st, e) { return clamp(st.crit + (st.spd - e.spd) * 0.01, 0.02, 0.4); }

export function canUse(s, act) {
  if (['attack', 'defend', 'run'].includes(act)) return true;
  return (s.char.items[act] || 0) > 0;
}

export function playerAct(s, act, rng) {
  if (s.screen !== 'combat' || !canUse(s, act)) return;
  const r = s.run, e = r.enemy, c = s.char, st = stats(s);
  r.defending = false;
  const guarded = e.intent === 'guard' && e.stun === 0;

  switch (act) {
    case 'attack': {
      let mult = r.ready ? 1.5 : 1;
      const crit = rng() < critChance(st, e);
      if (crit) mult *= 1.6;
      let dmg = mitigate(st.atk * (0.85 + rng() * 0.3) * mult, e.def);
      if (guarded) dmg = Math.max(1, Math.round(dmg / 2));
      e.hp -= dmg;
      fx(s, { who: 'player', type: 'shoot', dmg, crit, guarded, ready: r.ready });
      log(s, `${r.ready ? 'Steadied shot. ' : ''}${crit ? 'Critical! ' : ''}You hit ${e.name} for ${dmg}${guarded ? ' through cover' : ''}.`, crit ? 'crit' : 'hit');
      r.ready = false;
      break;
    }
    case 'defend':
      r.defending = true; r.ready = true;
      fx(s, { who: 'player', type: 'defend' });
      log(s, 'You drop behind cover and steady your aim. Next shot +50%.', 'info');
      break;
    case 'stim': {
      c.items.stim -= 1;
      const amt = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.4));
      c.hp += amt;
      fx(s, { who: 'player', type: 'stim', amt });
      log(s, `You jam a stim into your thigh. +${amt} HP.`, 'good');
      break;
    }
    case 'thermal': {
      c.items.thermal -= 1;
      const dmg = 20 + r.sector * 4;
      e.hp -= dmg;
      fx(s, { who: 'player', type: 'thermal', dmg });
      log(s, `Thermal charge! ${e.name} takes ${dmg}, armour or not.`, 'crit');
      break;
    }
    case 'ion': {
      c.items.ion -= 1;
      const droid = e.tags.includes('droid');
      e.stun = droid ? 3 : 1;
      const ionDmg = droid ? 12 + r.sector * 2 : 0;
      e.hp -= ionDmg;
      fx(s, { who: 'player', type: 'ion', dmg: ionDmg, droid });
      if (droid) { const dmg = ionDmg; log(s, `The ion pulse fries ${e.name}\u2019s circuits for ${dmg}. Stunned for 3 turns.`, 'crit'); }
      else log(s, `The ion pulse leaves ${e.name} reeling. Stunned for a turn.`, 'hit');
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
    }
  } else if (e.intent === 'guard') {
    fx(s, { who: 'enemy', type: 'guard' });
    log(s, `${e.name} holds position behind cover.`, 'info');
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
    c.xp -= xpToNext(c.level); c.level += 1;
    c.hp += stats(s).maxHp - before;
    out.levelUps.push(c.level);
  }
}

function winFight(s, rng) {
  const r = s.run, e = r.enemy, c = s.char;
  const credits = Math.round(randInt(rng, e.cr[0], e.cr[1]) * (has(c, 'fence') ? 1.25 : 1));
  c.credits += credits; r.sectorCredits += credits;
  const out = { enemy: e.name, id: e.id, portrait: e.portrait, credits, xp: e.xp, levelUps: [], healed: 0, boss: e.boss, resolve: 0 };
  log(s, `${e.name} goes down. +${credits} ${D.SETTING.cur}, +${e.xp} XP.`, 'reward');
  fx(s, { who: 'enemy', type: 'down' });
  gainXp(s, e.xp, out);
  if (out.levelUps.length) fx(s, { who: 'player', type: 'levelup', level: c.level });
  if (has(c, 'medic')) {
    const st = stats(s);
    out.healed = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.15));
    c.hp += out.healed;
  }
  if (e.boss) {
    out.resolve = 3; s.meta.resolve += 3; s.meta.totalResolve += 3;
    const next = r.sector + 1;
    if (!c.insertions.includes(next)) c.insertions.push(next);
  }
  r.enemy = null;
  s.outcome = out;
  s.screen = 'victory';
}

export function continueAfterVictory(s, rng) {
  const r = s.run;
  if (r.fight < FIGHTS_PER_SECTOR && rng() < 0.3) {
    s.event = pick(rng, Object.keys(D.EVENT_TEXT));
    s.eventResult = null;
    s.screen = 'event';
    return;
  }
  nextEncounter(s, rng);
}

export const EVENT_OPTIONS = {
  cache: [
    { id: 'open', label: 'Pry it open' },
    { id: 'leave', label: 'Leave it' },
  ],
  sympathizer: [
    { id: 'accept', label: 'Follow them' },
    { id: 'leave', label: 'Keep moving' },
  ],
  console: [
    { id: 'slice', label: 'Slice the door controls (SPD check)' },
    { id: 'leave', label: 'Leave it alone' },
  ],
  prisoner: [
    { id: 'free', label: 'Free them (costs 10% HP)' },
    { id: 'leave', label: 'You can\u2019t carry anyone' },
  ],
};

export function resolveEvent(s, choice, rng) {
  const c = s.char, r = s.run, st = stats(s);
  let text = 'You move on.';
  if (s.event === 'cache' && choice === 'open') {
    if (rng() < 0.7) {
      const cr = randInt(rng, 10, 20) * r.sector; c.credits += cr; r.sectorCredits += cr;
      text = `Ration chits and a credit chip. +${cr} ${D.SETTING.cur}.`;
    } else {
      const dmg = Math.round(st.maxHp * 0.12); c.hp = Math.max(1, c.hp - dmg);
      text = `The locker was rigged. A shock arcs up your arm. \u2212${dmg} HP.`;
    }
  } else if (s.event === 'sympathizer' && choice === 'accept') {
    if (c.items.stim < st.carry && rng() < 0.5) { c.items.stim += 1; text = 'They press a stim into your hand. \u201CFor the yard.\u201D +1 Med Stim.'; }
    else { const amt = Math.min(st.maxHp - c.hp, Math.round(st.maxHp * 0.3)); c.hp += amt; text = `They clean and bind your wounds without a word. +${amt} HP.`; }
  } else if (s.event === 'console' && choice === 'slice') {
    if (rng() < clamp(0.4 + st.spd * 0.03, 0.4, 0.85)) { r.nextMod = 'stunned'; text = 'You loop the camera feed and trip the next door early. Your next target won\u2019t see you coming.'; }
    else { r.nextMod = 'alerted'; text = 'Wrong sequence. Somewhere above, an alarm starts to wail.'; }
  } else if (s.event === 'prisoner' && choice === 'free') {
    const dmg = Math.round(st.maxHp * 0.1); c.hp = Math.max(1, c.hp - dmg);
    s.meta.resolve += 2; s.meta.totalResolve += 2;
    text = `You take a graze covering their escape (\u2212${dmg} HP). Word will spread in the yard. +2 ${D.SETTING.meta}.`;
  }
  s.eventResult = text;
}

function clearSector(s) {
  const r = s.run, c = s.char;
  const bonus = 8 * r.sector;
  c.credits += bonus;
  s.meta.resolve += 1; s.meta.totalResolve += 1;
  c.deepest = Math.max(c.deepest, r.sector);
  s.meta.bestSector = Math.max(s.meta.bestSector, r.sector);
  s.outcome = { sector: r.sector, bonus, credits: r.sectorCredits + bonus };
  log(s, `${sectorName(r.sector)} cleared. +${bonus} ${D.SETTING.cur}, +1 ${D.SETTING.meta}.`, 'reward');
  s.screen = 'sectorClear';
}

export function pushDeeper(s, rng) {
  const r = s.run;
  r.sector += 1; r.fight = 0; r.sectorCredits = 0;
  log(s, `You go deeper. ${sectorName(r.sector)}.`, 'sys');
  nextEncounter(s, rng);
}

export function endRun(s, how) {
  const r = s.run;
  s.notice = how === 'extracted'
    ? `You made it out of ${sectorName(r.sector)}. Spend it before your luck runs out.`
    : `You escaped from ${sectorName(r.sector)} with what you were carrying.`;
  s.run = null;
  s.screen = 'town';
  s.tab = 'medbay';
}

function die(s, foe) {
  fx(s, { who: 'player', type: 'down' });
  const c = s.char, r = s.run;
  const record = { name: c.name, number: c.number, level: c.level, sector: r.sector, killer: foe.name, killerId: foe.id, killerPortrait: foe.portrait, credits: c.credits };
  s.meta.fallen.unshift(record);
  s.meta.fallen = s.meta.fallen.slice(0, 12);
  s.outcome = record;
  s.run = null;
  s.screen = 'death';
}

export function recruit(s, rng) {
  s.char = newChar(s.meta, rng);
  s.screen = 'town'; s.tab = 'safehouse';
  s.notice = `${s.char.name} takes the empty bunk. Spend your ${D.SETTING.meta} before deploying.`;
}
