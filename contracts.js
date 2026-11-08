// Daily and weekly contracts: one seeded raid that everyone plays the same way. Same district, same class, same mutators,
// a loaner operative built to the contract (your own cell is never touched), one attempt per period, its own leaderboard.
// The page runs the contract in a separate state (see startContract in index.html) and posts the score to /contract/<id>.
import * as E from './engine.js';
import * as D from './data.js';
import { shopGear } from './sim-gear.mjs';

export const KINDS = {
  daily: { name: 'Daily Contract', maps: ['garrison'], end: 5, level: 4, train: 5, gearDepth: 4, budget: 500, mutators: 2, reward: 2, credits: 150 },
  weekly: { name: 'Weekly Contract', maps: ['garrison'], end: 10, level: 4, train: 14, gearDepth: 10, budget: 3500, mutators: 3, reward: 6, credits: 400 },
};
// The loaner's level stays low on purpose: enemies scale to the operative's level, training and gear don't move them.
// Training, gear budget and depth are tuned with tests/contracts.mjs (a careful bot finishes the daily about 2 in 3).
const CLASSES = ['foundry', 'runner', 'clerk', 'preacher', 'medic'];

// Contract ids: d20261109 for a day (UTC), w202645 for an ISO week.
export function periodId(kind, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (kind === 'daily') return `d${d.toISOString().slice(0, 10).replace(/-/g, '')}`;
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear(), wk = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `w${y}${String(wk).padStart(2, '0')}`;
}
// When the current period ends, for the countdown.
export function endsAt(kind, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (kind === 'weekly') { const day = now.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + (7 - day)); }
  return d.getTime();
}
const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function spec(kind, now = new Date()) {
  const k = KINDS[kind], id = periodId(kind, now), rng = E.seededRng(hash(id));
  const map = k.maps[Math.floor(rng() * k.maps.length)], cls = CLASSES[Math.floor(rng() * CLASSES.length)];
  const pool = D.MUTATORS.map((x) => x.id).filter((x) => x !== 'blackout' && x !== 'oneway'), mutators = [];
  while (mutators.length < k.mutators) { const x = pool.splice(Math.floor(rng() * pool.length), 1)[0]; mutators.push(x); }
  return { kind, id, name: k.name, map, cls, mutators, end: k.end, level: k.level, reward: k.reward, credits: k.credits, seed: hash(id + ':run') };
}

// A fresh game holding the loaner operative, already deployed into the contract.
export function buildState(sp, playerName = '') {
  const rng = E.seededRng(sp.seed), s = E.newGame(rng);
  s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true };
  const k = KINDS[sp.kind], t = sp.train ?? k.train; for (const k of Object.keys(s.meta.training)) s.meta.training[k] = t;
  const d = E.newDraft(s.meta, rng); d.background = sp.cls; d.name = playerName ? `${playerName.slice(0, 12)}'s loaner` : '';
  const keys = Object.keys(D.ATTRS); for (let i = 0; i < 20 && d.points > 0; i++) E.draftAdjust(d, keys[i % keys.length], 1);
  E.createChar(s, rng, d);
  const c = s.char;
  for (let l = 1; l < sp.level; l++) { c.level += 1; c.attrPoints += 1; }
  for (let i = 0; c.attrPoints > 0 && i < 40; i++) E.spendAttr(s, keys[i % keys.length]);
  // Gear for the depth of the contract, bought by the same rule the balance bot uses: best gain per credit.
  E.mapProgress(c, sp.map).deepest = sp.gearDepth ?? k.gearDepth;
  c.credits = sp.budget ?? k.budget;
  for (let i = 0; i < 3; i++) { E.restockMarket(s, rng); shopGear(s, 'auto', 0); }
  E.mapProgress(c, sp.map).deepest = 0; c.credits = 0; c.market = [];
  c.items.stim = Math.max(c.items.stim, 3); c.hp = E.stats(s).maxHp;
  // The contract district counts as open for the loaner.
  const map = D.MAPS.find((m) => m.id === sp.map);
  for (const [id, n] of Object.entries(map.unlock || {})) E.mapProgress(c, id).deepest = n;
  s.meta.dev = true; // keeps the loaner off the main leaderboard
  s.contract = { kind: sp.kind, id: sp.id, end: sp.end, map: sp.map, cls: sp.cls, mutators: sp.mutators, reward: sp.reward, credits: sp.credits, startedAt: Date.now() };
  s.screen = 'town';
  E.deploy(s, sp.map, 1, rng, { contract: s.contract });
  return { s, rng };
}

// The score: sectors and bosses, kills, credits picked up, and a finishing bonus for HP left.
export function score(t) {
  if (!t) return 0;
  return Math.max(0, Math.round(t.sectors * 100 + t.bosses * 400 + t.kills * 15 + Math.max(0, t.credits) / 2 + (t.done ? 1000 + 5 * Math.round(100 * t.hpLeft) : 0)));
}
export const MAX_SCORE = 10 * 100 + 2 * 400 + 200 * 15 + 20000 / 2 + 1500;
