// Lantern Hearts: a small trading card game at the Lantern. Every E-Girl with art is a card, printed in six rarities.
// The collection belongs to the cell (meta.cards, { 'vex:holo': 2 }); packs and stakes are paid from the operative's credits.
// You build a deck of DECK cards; a match deals HAND of them. The house shows the three calls (Charm, Sass, Style) up front,
// you play one card a round, face down, against the house's card; higher number takes the round, best of three.
// Each table caps how strong a card can play, and the house there is tuned so a deck maxed for that table edges it (~52%).
// Three copies of one card fuse into one of the next rarity, so duplicates always count.
import * as D from './data.js';

export const STATS = { charm: 'Charm', sass: 'Sass', style: 'Style' };
const STAT_IDS = Object.keys(STATS);
// w: pack weight per card. Prism is about one card in a thousand.
export const RARITY = [
  { id: 'paper', name: 'Paper', w: 600, bonus: 0 },
  { id: 'foil', name: 'Foil', w: 260, bonus: 1 },
  { id: 'holo', name: 'Holo', w: 100, bonus: 2 },
  { id: 'gilded', name: 'Gilded', w: 32, bonus: 3 },
  { id: 'neon', name: 'Neon', w: 7, bonus: 4 },
  { id: 'prism', name: 'Prism', w: 1, bonus: 5 },
];
const RANK = Object.fromEntries(RARITY.map((r, i) => [r.id, i]));
// Each girl's printed stats and her signature play.
export const BASE = {
  vex: { charm: 4, sass: 9, style: 5 }, pixie: { charm: 9, sass: 4, style: 5 }, rook: { charm: 4, sass: 5, style: 9 },
  jinx: { charm: 6, sass: 7, style: 5 }, luna: { charm: 7, sass: 4, style: 5 }, nova: { charm: 3, sass: 7, style: 8 },
};
export const ABILITY = {
  vex: { name: 'Last Word', text: 'Wins ties.' },
  pixie: { name: 'Opener', text: '+2 in round 1.' },
  rook: { name: 'Closer', text: '+2 in round 3.' },
  jinx: { name: 'Hex', text: 'The card she faces gets -1.' },
  luna: { name: 'Comeback', text: '+3 while you are behind.' },
  nova: { name: 'Spotlight', text: '+2 when the call is her best stat.' },
};
// Tables: stake, the strongest rarity a card plays at, and the house's printings there (always at the cap).
// tests/cards-sim.mjs with all six girls: a deck maxed for a table wins about 52% there, one rarity short about 35%.
export const TABLES = [
  { id: 'booth', name: 'Back Booth', stake: 25, cap: 1, house: [1] },
  { id: 'floor', name: 'Main Floor', stake: 100, cap: 3, house: [3] },
  { id: 'high', name: 'High Roller', stake: 300, cap: 5, house: [5] },
];
export const SPARK = +(globalThis.process?.env?.SPARK ?? 3); // the crowd adds 0..SPARK to each card every round
export const HOUSE_TIES = (globalThis.process?.env?.TIES ?? '1') === '1';
export const PACK_BASE = 60, PACK_RISE = 0.1, PACK_MAX = 400, PACK_SIZE = 3, DECK = 6, HAND = 3, ROUNDS = 3, FUSE = 3;

const girlOf = (id) => D.LOUNGE.girls.find((g) => g.id === id);
export const cardKey = (girl, rarity) => `${girl}:${rarity}`;
export const rankOf = (key) => RANK[key.split(':')[1]] ?? 0;
// cap: the table's strongest rarity; a stronger card plays as that one.
export function cardInfo(key, cap = 5) {
  const [girl, rarity] = key.split(':'), g = girlOf(girl) || { id: girl, name: girl }, r = RARITY[RANK[rarity] ?? 0];
  const base = BASE[girl] || { charm: 6, sass: 6, style: 6 }, bonus = RARITY[Math.min(r && RANK[r.id], cap)].bonus;
  const stats = Object.fromEntries(STAT_IDS.map((k) => [k, base[k] + bonus]));
  return { key, girl, rarity: r.id, rank: RANK[r.id], rarityName: r.name, name: g.name, stats, capped: RANK[r.id] > cap, ability: ABILITY[girl] || null };
}
// What a card scores in round `round` (0-based) for `stat`, against the other card, with the score so far (me, them).
export function score(key, stat, round, cap, vs, me = 0, them = 0) {
  const k = cardInfo(key, cap); let n = k.stats[stat];
  if (k.girl === 'pixie' && round === 0) n += 2;
  if (k.girl === 'rook' && round === 2) n += 2;
  if (k.girl === 'luna' && me < them) n += 3;
  if (k.girl === 'nova') { const best = Math.max(...STAT_IDS.map((s) => k.stats[s])); if (k.stats[stat] === best) n += 2; }
  if (vs && vs.split(':')[0] === 'jinx') n -= 1;
  return n;
}
export function fight(a, b, stat, round, cap, sa, sb, spark = [0, 0]) {
  const x = score(a, stat, round, cap, b, sa, sb) + spark[0], y = score(b, stat, round, cap, a, sb, sa) + spark[1];
  let won = x > y ? 1 : x < y ? -1 : 0;
  if (!won) { const va = a.split(':')[0] === 'vex', vb = b.split(':')[0] === 'vex'; if (va && !vb) won = 1; else if (vb && !va) won = -1; }
  if (!won && HOUSE_TIES) won = -1; // the house takes ties, unless Vex settled it
  return { a: x, b: y, won };
}

// Every card the cell owns, one entry per copy.
export function collection(m) { const out = []; for (const [k, n] of Object.entries((m && m.cards) || {})) for (let i = 0; i < n; i++) out.push(k); return out; }
export const owned = (m) => collection(m).length;
const sortBest = (a, b) => rankOf(b) - rankOf(a) || a.localeCompare(b);
// The deck: until you edit it, your best DECK cards (so new pulls go straight in). Once edited, your picks that the cell still owns.
export function deckOf(m) {
  const left = { ...((m && m.cards) || {}) }, out = [];
  for (const k of (m && m.deckSet && m.deck) || []) if (out.length < DECK && left[k] > 0) { out.push(k); left[k] -= 1; }
  if (m && m.deckSet) return out;
  const rest = []; for (const [k, n] of Object.entries(left)) for (let i = 0; i < n; i++) rest.push(k);
  rest.sort(sortBest);
  while (out.length < DECK && rest.length) out.push(rest.shift());
  return out;
}
export function setDeck(s, keys) {
  const m = s.meta, left = { ...(m.cards || {}) }, out = [];
  for (const k of keys) if (out.length < DECK && left[k] > 0) { out.push(k); left[k] -= 1; }
  m.deck = out; m.deckSet = true; return out;
}
// Take a card out of the deck, or put one in (in place of the weakest when the deck is full).
export function deckOut(s, key) { const d = deckOf(s.meta), i = d.indexOf(key); if (i < 0) return null; d.splice(i, 1); return setDeck(s, d); }
export function deckIn(s, key) {
  const m = s.meta, d = deckOf(m), have = (m.cards || {})[key] || 0;
  if (d.filter((k) => k === key).length >= have) return null;
  if (d.length >= DECK) { const w = [...d].sort(sortBest).pop(); d.splice(d.lastIndexOf(w), 1); }
  d.push(key); return setDeck(s, d);
}
export const bestDeck = (s) => { s.meta.deck = []; s.meta.deckSet = false; return deckOf(s.meta); };

export const packCost = (m) => Math.min(PACK_MAX, Math.round(PACK_BASE * Math.pow(1 + PACK_RISE, (m && m.cardPacks) || 0)));
const pickRarity = (rng) => { let x = rng() * RARITY.reduce((t, r) => t + r.w, 0); for (const r of RARITY) { x -= r.w; if (x < 0) return r.id; } return 'paper'; };
function addCards(m, ids, rng) {
  const got = []; m.cards = m.cards || {};
  for (let i = 0; i < PACK_SIZE; i++) { const k = cardKey(ids[Math.floor(rng() * ids.length)], pickRarity(rng)); m.cards[k] = (m.cards[k] || 0) + 1; got.push(k); }
  return got;
}
// A pack: three cards from the girls with art (ids). Each pack the cell buys costs 10% more than the last.
export function buyPack(s, ids, rng) {
  const c = s.char, m = s.meta, cost = packCost(m);
  if (!c || !ids.length || c.credits < cost) return null;
  c.credits -= cost; m.cardPacks = (m.cardPacks || 0) + 1; m.cardSpent = (m.cardSpent || 0) + cost;
  return addCards(m, ids, rng);
}
// The first pack is on the house, so anyone can try it.
export function freePack(s, ids, rng) {
  const m = s.meta;
  if (m.cardsFree || !ids.length || !s.char) return null;
  m.cardsFree = true;
  return addCards(m, ids, rng);
}
// Three copies of a card fuse into one of the next rarity; the new card takes the old one's place in the deck.
export function fuse(s, key) {
  const m = s.meta, have = (m.cards || {})[key] || 0, r = rankOf(key);
  if (have < FUSE || r >= RARITY.length - 1) return null;
  m.cards[key] = have - FUSE; if (!m.cards[key]) delete m.cards[key];
  const up = cardKey(key.split(':')[0], RARITY[r + 1].id);
  m.cards[up] = (m.cards[up] || 0) + 1; m.cardFused = (m.cardFused || 0) + 1;
  if (m.deckSet && m.deck) { const i = m.deck.indexOf(key); if (i >= 0) m.deck[i] = up; }
  return up;
}

// The house plans its whole hand against the calls it showed you; you never see its cards until they flip.
function housePlan(hand, calls, cap) {
  let best = null, bestN = -1;
  for (const p of perms(hand.length)) { const n = p.reduce((t, j, i) => t + cardInfo(hand[j], cap).stats[calls[i]], 0); if (n > bestN) { bestN = n; best = p; } }
  return best.map((j) => hand[j]);
}
const PERMS = {};
export function perms(n) {
  if (PERMS[n]) return PERMS[n];
  const out = [], go = (a, rest) => { if (!rest.length) return out.push(a); rest.forEach((x, i) => go([...a, x], rest.filter((_, j) => j !== i))); };
  go([], [...Array(n).keys()]); return (PERMS[n] = out);
}
export function startMatch(s, tableId, ids, rng) {
  const c = s.char, t = TABLES.find((x) => x.id === tableId), deck = deckOf(s.meta);
  if (!c || !t || c.credits < t.stake || deck.length < HAND || !ids.length || s.cardMatch) return null;
  c.credits -= t.stake;
  const p = [...deck], hand = []; while (hand.length < HAND) hand.push(p.splice(Math.floor(rng() * p.length), 1)[0]);
  const house = Array.from({ length: HAND }, () => cardKey(ids[Math.floor(rng() * ids.length)], RARITY[t.house[Math.floor(rng() * t.house.length)]].id));
  const calls = Array.from({ length: ROUNDS }, () => STAT_IDS[Math.floor(rng() * STAT_IDS.length)]);
  s.cardMatch = { table: t.id, stake: t.stake, cap: t.cap, hand, house: housePlan(house, calls, t.cap), calls, sparks: calls.map(() => [0, 1].map(() => Math.floor(rng() * (SPARK + 1)))), round: 0, rounds: [], over: false, result: null };
  return s.cardMatch;
}
// Play the card at index i of your hand this round.
export function playCard(s, i) {
  const g = s.cardMatch;
  if (!g || g.over || !g.hand[i]) return null;
  const stat = g.calls[g.round], mine = g.hand.splice(i, 1)[0], theirs = g.house[g.round];
  const sa = g.rounds.filter((r) => r.won > 0).length, sb = g.rounds.filter((r) => r.won < 0).length;
  const sp = (g.sparks && g.sparks[g.round]) || [0, 0], f = fight(mine, theirs, stat, g.round, g.cap, sa, sb, sp);
  g.rounds.push({ stat, mine, theirs, ...f, spark: sp });
  g.round += 1;
  const wins = sa + (f.won > 0), losses = sb + (f.won < 0);
  if (g.round >= ROUNDS || wins >= 2 || losses >= 2) {
    g.over = true;
    g.result = wins > losses ? 'won' : wins < losses ? 'lost' : 'draw';
    const back = g.result === 'won' ? g.stake * 2 : g.result === 'draw' ? g.stake : 0;
    s.char.credits += back; g.paid = back;
    const m = s.meta; if (g.result === 'won') m.cardWins = (m.cardWins || 0) + 1;
    m.cardBest = Math.max(m.cardBest || 0, back - g.stake);
  }
  return g;
}
export function closeMatch(s) { if (s.cardMatch && s.cardMatch.over) s.cardMatch = null; }
// How strong a deck is at a table, 0-100: the average playing rarity against the table's cap.
export function deckPower(m, t) { const d = deckOf(m); if (!d.length) return 0; return Math.round(100 * d.reduce((n, k) => n + Math.min(rankOf(k), t.cap), 0) / (d.length * t.cap)); }
