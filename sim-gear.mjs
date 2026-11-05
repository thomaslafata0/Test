// Shared gear and attack logic for the simulator bots (sim.mjs, sim-builds.mjs).
// style: 'auto' (whatever hits hardest), 'ranged' (only shoots), 'melee' (only strikes), 'hybrid' (values both equally),
// 'rangedFocus' (shoots, but strikes past cover and gears mostly for ranged).
import * as E from './engine.js';
import * as D from './data.js';

export function attackValue(st, style) {
  const r = st.atk * (1 + st.crit * 0.6), m = st.atkM * (1 + st.critM * 0.6) * 1.05;
  if (style === 'ranged') return r;
  if (style === 'melee') return m;
  if (style === 'hybrid') return (r + m) / 2;
  if (style === 'rangedFocus') return r * 0.85 + m * 0.15;
  return Math.max(r, m) + 0.15 * Math.min(r, m);
}

// How good the current loadout is for this bot.
// w: optional weights for an item-driven playstyle, e.g. { crit: 3, def: 2 }.
export function score(s, style, w = {}) {
  const st = E.stats(s), c = s.char, g = (k) => E.gearBonus(c, k) * (w[k] || 1);
  const critW = w.crit || 1, defW = w.def || 1, hpW = w.hp || 1;
  return attackValue(st, style) * (1 + (critW - 1) * 0.3 * (st.crit + st.critM)) + st.def * 1.4 * defW + st.spd * 0.5 + st.maxHp * 0.06 * hpW
    + st.stimBoost * 10 + (st.carry - 4) * 1.5 + (st.scan ? 1.5 : 0)
    + g('healkill') * 0.8 + g('credits') * 0.15 + g('resist') * 0.05 + g('cooldown') * 0.08
    + (g('crit') + g('droid') * 0.3 + g('human') * 0.4 + g('bleed') * 0.3) * 0.05 * attackValue(st, style) / 10
    + (c.gear.gadget ? 1 : 0);
}

function withItem(s, it, fn) {
  const c = s.char, slot = E.baseOf(it).slot, old = c.gear[slot];
  c.gear[slot] = it;
  try { return fn(); } finally { c.gear[slot] = old; }
}

// Buy the best value-for-money upgrades from the Black Market, keeping a cash reserve.
// LOCKUP=1: the bot keeps replaced gear in the Lockup and reuses it, the most a sensible player would get from it.
const LOCKUP = !!(typeof process !== 'undefined' && process.env.LOCKUP);
function useLockup(s, style, skip, w) {
  const list = s.char.lockup || [];
  for (let guard = 0; guard < 8; guard++) {
    const base = score(s, style, w);
    let best = -1, bestGain = 0.4;
    list.forEach((it, i) => {
      if (!E.canEquip(s.char, it) || skip.includes(E.baseOf(it).slot)) return;
      const gain = withItem(s, it, () => score(s, style, w)) - base;
      if (gain > bestGain) { bestGain = gain; best = i; }
    });
    if (best < 0) return;
    E.lockupTake(s, best);
  }
}
function makeRoom(s) {
  if (E.lockupFree(s) > 0) return;
  const list = s.char.lockup;
  let low = 0;
  list.forEach((it, i) => { const v = (E.baseOf(it).tier || 0) * 10 + (it.level || 0) * 3, u = (E.baseOf(list[low]).tier || 0) * 10 + (list[low].level || 0) * 3; if (v < u) low = i; });
  E.lockupScrap(s, low);
}
export function shopGear(s, style, reserve = 60, skip = [], w = {}) {
  const c = s.char;
  if (LOCKUP) useLockup(s, style, skip, w);
  for (let guard = 0; guard < 6; guard++) {
    const base = score(s, style, w);
    let best = -1, bestV = 0;
    c.market.forEach((it, i) => {
      if (!E.canEquip(c, it) || skip.includes(E.baseOf(it).slot)) return;
      const cost = E.netPrice(s, it);
      if (cost > c.credits - reserve) return;
      const gain = withItem(s, it, () => score(s, style, w)) - base;
      const v = gain / Math.max(25, cost);
      if (gain > 0.4 && v > bestV) { bestV = v; best = i; }
    });
    if (best < 0) break;
    const spent = c.credits;
    if (LOCKUP) makeRoom(s);
    E.buyGear(s, best, LOCKUP);
    if (s.spend) s.spend.gear = (s.spend.gear || 0) + spent - c.credits;
  }
}

// Spend spare credits on +1 upgrades, best gain per credit first.
export function upgradeGear(s, style, reserve = 150, skip = [], w = {}) {
  const c = s.char;
  for (let guard = 0; guard < 12; guard++) {
    const base = score(s, style, w);
    let best = null, bestV = 0;
    for (const slot of D.SLOT_ORDER) {
      const it = c.gear[slot];
      if (!E.canUpgrade(it) || skip.includes(slot)) continue;
      const cost = E.price(s, E.upgradeCost(it));
      if (cost > c.credits - reserve) continue;
      it.level += 1; const gain = score(s, style, w) - base; it.level -= 1;
      if (gain > 0.3 && gain / cost > bestV) { bestV = gain / cost; best = slot; }
    }
    if (!best) break;
    const spent = c.credits;
    E.upgradeItem(s, best);
    if (s.spend) s.spend.upgrades = (s.spend.upgrades || 0) + spent - c.credits;
  }
}

// After a drop: take it if it beats what's equipped (counting the credits from selling it), else sell.
export function lootChoice(s, rng, style, skip = [], w = {}) {
  const c = s.char, it = s.run.lootOffer;
  if (s.lootStats) s.lootStats.drops = (s.lootStats.drops || 0) + 1;
  if (E.canEquip(c, it) && !skip.includes(E.baseOf(it).slot)) {
    const gain = withItem(s, it, () => score(s, style, w)) - score(s, style, w);
    if (gain > 0.5) { if (s.lootStats) s.lootStats.taken = (s.lootStats.taken || 0) + 1; return E.takeLoot(s, rng); }
  }
  return E.leaveLoot(s, rng);
}

// Shoot or Strike: Strike past cover, avoid riot shields, otherwise the harder hitter.
export function attackChoice(s, style) {
  if (style === 'ranged') return 'shoot';
  if (style === 'melee') return 'strike';
  const e = s.run.enemy, st = E.stats(s);
  if (style === 'rangedFocus') return e.intent === 'guard' && !e.stun && !D.MELEE_COUNTER[e.id] ? 'strike' : 'shoot';
  const guard = e.intent === 'guard' && !e.stun, counter = D.MELEE_COUNTER[e.id] && !e.stun;
  const r = st.atk * (1 + E.critChance(st, e) * 0.6) * (guard ? 0.5 : 1);
  const m = st.atkM * (1 + E.critChance(st, e, true) * 0.6) * (counter ? 0.65 : 1);
  return m > r ? 'strike' : 'shoot';
}
// Which skills a style is willing to use.
export const MELEE_SKILLS = new Set(['smash', 'overload', 'intimidate']);
export const RANGED_SKILLS = new Set(['aimed', 'burst', 'blast', 'suppress', 'overload', 'intimidate']);
export const skillAllowed = (style, k) => style === 'melee' ? MELEE_SKILLS.has(k) : style === 'ranged' ? RANGED_SKILLS.has(k) : true;
