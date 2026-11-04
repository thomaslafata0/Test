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
export function score(s, style) {
  const st = E.stats(s), c = s.char, g = (k) => E.gearBonus(c, k);
  return attackValue(st, style) + st.def * 1.4 + st.spd * 0.5 + st.maxHp * 0.06
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
export function shopGear(s, style, reserve = 60, skip = []) {
  const c = s.char;
  for (let guard = 0; guard < 6; guard++) {
    const base = score(s, style);
    let best = -1, bestV = 0;
    c.market.forEach((it, i) => {
      if (!E.canEquip(c, it) || skip.includes(E.baseOf(it).slot)) return;
      const cost = E.netPrice(s, it);
      if (cost > c.credits - reserve) return;
      const gain = withItem(s, it, () => score(s, style)) - base;
      const v = gain / Math.max(25, cost);
      if (gain > 0.4 && v > bestV) { bestV = v; best = i; }
    });
    if (best < 0) break;
    const spent = c.credits;
    E.buyGear(s, best);
    if (s.spend) s.spend.gear = (s.spend.gear || 0) + spent - c.credits;
  }
}

// Spend spare credits on +1 upgrades, best gain per credit first.
export function upgradeGear(s, style, reserve = 150, skip = []) {
  const c = s.char;
  for (let guard = 0; guard < 12; guard++) {
    const base = score(s, style);
    let best = null, bestV = 0;
    for (const slot of D.SLOT_ORDER) {
      const it = c.gear[slot];
      if (!E.canUpgrade(it) || skip.includes(slot)) continue;
      const cost = E.price(s, E.upgradeCost(it));
      if (cost > c.credits - reserve) continue;
      it.level += 1; const gain = score(s, style) - base; it.level -= 1;
      if (gain > 0.3 && gain / cost > bestV) { bestV = gain / cost; best = slot; }
    }
    if (!best) break;
    const spent = c.credits;
    E.upgradeItem(s, best);
    if (s.spend) s.spend.upgrades = (s.spend.upgrades || 0) + spent - c.credits;
  }
}

// After a drop: take it if it beats what's equipped (counting the credits from selling it), else sell.
export function lootChoice(s, rng, style, skip = []) {
  const c = s.char, it = s.run.lootOffer;
  if (s.lootStats) s.lootStats.drops = (s.lootStats.drops || 0) + 1;
  if (E.canEquip(c, it) && !skip.includes(E.baseOf(it).slot)) {
    const gain = withItem(s, it, () => score(s, style)) - score(s, style);
    const old = c.gear[E.baseOf(it).slot];
    const v = (E.sellValue(it) - E.sellValue(old)) / 40; // a sale is worth something too
    if (gain > Math.max(0.5, v)) { if (s.lootStats) s.lootStats.taken = (s.lootStats.taken || 0) + 1; return E.takeLoot(s, rng); }
  }
  return E.sellLoot(s, rng);
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
