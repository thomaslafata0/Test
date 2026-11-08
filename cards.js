// Lantern Hearts: a small trading card game at the Lantern. Every E-Girl with art is a card in three printings.
// The collection belongs to the cell (meta.cards, { 'vex:holo': 2 }); packs and stakes are paid from the operative's credits.
// A match against the house: three rounds, each calls a stat, you play one card from a hand of three, higher wins the round.
// Win two rounds and the house pays your stake again; lose two and it keeps it. Ties go nowhere.
import * as D from './data.js';

export const STATS = { charm: 'Charm', sass: 'Sass', style: 'Style' };
export const RARITY = [
  { id: 'paper', name: 'Paper', w: 70, bonus: 0 },
  { id: 'foil', name: 'Foil', w: 24, bonus: 1 },
  { id: 'holo', name: 'Holo', w: 6, bonus: 2 },
];
// Each girl's printed stats (1-9). Girls without an entry get an even spread.
export const BASE = {
  vex: { charm: 5, sass: 8, style: 6 }, pixie: { charm: 8, sass: 4, style: 6 }, rook: { charm: 5, sass: 6, style: 8 },
  jinx: { charm: 6, sass: 7, style: 6 }, luna: { charm: 8, sass: 5, style: 5 }, nova: { charm: 4, sass: 8, style: 7 },
};
export const PACK_COST = 60, PACK_SIZE = 3, STAKES = [25, 75, 150], HAND = 3, ROUNDS = 3;

const girlOf = (id) => D.LOUNGE.girls.find((g) => g.id === id);
export const cardKey = (girl, rarity) => `${girl}:${rarity}`;
export function cardInfo(key) {
  const [girl, rarity] = key.split(':'), g = girlOf(girl) || { id: girl, name: girl }, r = RARITY.find((x) => x.id === rarity) || RARITY[0];
  const base = BASE[girl] || { charm: 6, sass: 6, style: 6 };
  const stats = Object.fromEntries(Object.keys(STATS).map((k) => [k, Math.min(9, base[k] + r.bonus)]));
  return { key, girl, rarity: r.id, rarityName: r.name, name: g.name, tag: g.tag || '', stats };
}
// The house plays a better-stocked deck than the packs sell.
const HOUSE_W = { paper: 45, foil: 38, holo: 17 };
const pickRarity = (rng, house = false) => { const w = (r) => (house ? HOUSE_W[r.id] : r.w); let x = rng() * RARITY.reduce((t, r) => t + w(r), 0); for (const r of RARITY) { x -= w(r); if (x < 0) return r.id; } return 'paper'; };
// Every card the cell owns, one entry per copy.
export function collection(m) { const out = []; for (const [k, n] of Object.entries((m && m.cards) || {})) for (let i = 0; i < n; i++) out.push(k); return out; }
export const owned = (m) => collection(m).length;

// A pack: three cards from the girls with art (ids), paid from the operative's credits.
export function buyPack(s, ids, rng) {
  const c = s.char;
  if (!c || !ids.length || c.credits < PACK_COST) return null;
  c.credits -= PACK_COST;
  const m = s.meta, got = [];
  m.cards = m.cards || {};
  for (let i = 0; i < PACK_SIZE; i++) { const k = cardKey(ids[Math.floor(rng() * ids.length)], pickRarity(rng)); m.cards[k] = (m.cards[k] || 0) + 1; got.push(k); }
  return got;
}
// The first pack is on the house, so anyone can try it.
export function freePack(s, ids, rng) {
  const m = s.meta;
  if (m.cardsFree || !ids.length) return null;
  m.cardsFree = true;
  const c = s.char, was = c.credits; c.credits += PACK_COST;
  const got = buyPack(s, ids, rng);
  if (!got) { c.credits = was; m.cardsFree = false; }
  return got;
}

export function startMatch(s, stake, ids, rng) {
  const c = s.char, mine = collection(s.meta);
  if (!c || !STAKES.includes(stake) || c.credits < stake || mine.length < HAND || !ids.length || s.cardMatch) return null;
  c.credits -= stake;
  const deal = (pool) => { const p = [...pool], out = []; while (out.length < HAND && p.length) out.push(p.splice(Math.floor(rng() * p.length), 1)[0]); return out; };
  const house = Array.from({ length: HAND }, () => cardKey(ids[Math.floor(rng() * ids.length)], pickRarity(rng, true)));
  const calls = Array.from({ length: ROUNDS }, () => Object.keys(STATS)[Math.floor(rng() * 3)]);
  s.cardMatch = { stake, hand: deal(mine), house, calls, round: 0, rounds: [], over: false, result: null };
  return s.cardMatch;
}
// Play the card at index i of your hand for this round's stat. The house answers with its best card for that stat,
// except now and then it misreads the table and plays a random one.
export function playCard(s, i, rng) {
  const g = s.cardMatch;
  if (!g || g.over || !g.hand[i]) return null;
  const stat = g.calls[g.round], mineKey = g.hand.splice(i, 1)[0];
  let hi = 0;
  g.house.forEach((k, j) => { if (cardInfo(k).stats[stat] > cardInfo(g.house[hi]).stats[stat]) hi = j; });
  const j = rng() < 0.1 ? Math.floor(rng() * g.house.length) : hi, theirKey = g.house.splice(j, 1)[0];
  const a = cardInfo(mineKey).stats[stat], b = cardInfo(theirKey).stats[stat];
  g.rounds.push({ stat, mine: mineKey, theirs: theirKey, a, b, won: a > b ? 1 : a < b ? -1 : 0 });
  g.round += 1;
  const wins = g.rounds.filter((r) => r.won > 0).length, losses = g.rounds.filter((r) => r.won < 0).length;
  if (g.round >= ROUNDS || wins >= 2 || losses >= 2) {
    g.over = true;
    g.result = wins > losses ? 'won' : wins < losses ? 'lost' : 'draw';
    const back = g.result === 'won' ? g.stake * 2 : g.result === 'draw' ? g.stake : 0;
    s.char.credits += back;
    g.paid = back;
    const m = s.meta; m.cardWins = (m.cardWins || 0) + (g.result === 'won' ? 1 : 0);
  }
  return g;
}
export function closeMatch(s) { if (s.cardMatch && s.cardMatch.over) s.cardMatch = null; }
