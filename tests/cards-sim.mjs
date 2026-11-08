// Lantern Hearts odds: a careful player (plans the hand against sampled house hands) at each table with decks of each strength.
// node tests/cards-sim.mjs [matches]. A deck maxed for a table should edge the house there, about 52% of decided matches.
import * as C from '../cards.js';
import { seededRng } from '../engine.js';
const N = +(process.argv[2] || 1500), rng = seededRng(7);
const GIRLS = (process.env.GIRLS || 'vex,pixie,rook').split(','), DECKG = process.env.DECK ? process.env.DECK.split(',') : GIRLS;
function play(s, ids) {
  if (process.env.HOUSE) C.TABLES.forEach((t, i) => { t.house = JSON.parse(process.env.HOUSE)[i]; });
  const t = C.TABLES.find((x) => x.id === s.cardMatch.table), g = s.cardMatch;
  // Pick the order of the hand that wins most often against house hands drawn the way the table draws them.
  const samples = Array.from({ length: 120 }, () => { const h = Array.from({ length: C.HAND }, () => C.cardKey(ids[Math.floor(rng() * ids.length)], C.RARITY[t.house[Math.floor(rng() * t.house.length)]].id)); return h; });
  let best = null, bestN = -1;
  for (const p of C.perms(C.HAND)) {
    let n = 0;
    for (const h of samples) {
      const plan = [...C.perms(C.HAND)].map((q) => q.map((j) => h[j])).sort((a, b) => b.reduce((t2, k, i) => t2 + C.cardInfo(k, g.cap).stats[g.calls[i]], 0) - a.reduce((t2, k, i) => t2 + C.cardInfo(k, g.cap).stats[g.calls[i]], 0))[0];
      let me = 0, th = 0;
      p.forEach((j, r) => { const sp = [0, 1].map(() => Math.floor(rng() * (C.SPARK + 1))), w = C.fight(g.hand[j], plan[r], g.calls[r], r, g.cap, me, th, sp).won; if (w > 0) me++; if (w < 0) th++; });
      n += me > th ? 1 : me === th ? 0.5 : 0;
    }
    if (n > bestN) { bestN = n; best = p; }
  }
  const order = best.map((j) => g.hand[j]);
  for (const k of order) C.playCard(s, s.cardMatch.hand.indexOf(k));
}
function run(table, rank) {
  let w = 0, l = 0, d = 0, net = 0;
  for (let i = 0; i < N; i++) {
    const cards = {}; for (let j = 0; j < C.DECK; j++) { const k = C.cardKey(DECKG[j % DECKG.length], C.RARITY[rank].id); cards[k] = (cards[k] || 0) + 1; }
    const s = { char: { credits: 1e6 }, meta: { cards } };
    C.startMatch(s, table.id, GIRLS, rng); play(s, GIRLS);
    const g = s.cardMatch; if (g.result === 'won') w++; else if (g.result === 'lost') l++; else d++; net += g.paid - g.stake;
  }
  return { win: (100 * w / (w + l)).toFixed(1) + '%', draws: (100 * d / N).toFixed(0) + '%', ev: (100 * net / (N * table.stake)).toFixed(1) + '%' };
}
for (const t of C.TABLES) {
  const row = []; for (let r = 0; r <= t.cap; r++) row.push(`${C.RARITY[r].name}: ${JSON.stringify(run(t, r))}`);
  console.log(`${t.name} (stake ${t.stake}, cap ${C.RARITY[t.cap].name})\n  ` + row.join('\n  '));
}
