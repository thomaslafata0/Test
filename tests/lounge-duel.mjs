// The E-Girl Room (paid, permanent, once per trip home) and the barracks duel (co-op, contraband changes hands).
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0;
const ok = (name, v, extra = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!v) fails++; };
function town(seed) {
  const rng = E.seededRng(seed), s = E.newGame(rng), d = E.newDraft(s.meta, rng);
  E.createChar(s, rng, d); s.screen = 'town';
  return { s, rng, c: s.char };
}
// The room.
{ const { s, rng, c } = town(1);
  c.credits = 400; ok('needs 500 credits', !E.visitLounge(s, 'vex', rng));
  c.credits = 2000; const hp = E.stats(s).maxHp, res = E.visitLounge(s, 'vex', rng);
  ok('a visit costs 500 and leaves a mark', res && c.credits === 1500 && c.fav && Object.keys(c.fav).length > 0, JSON.stringify(res && res.fx));
  ok('once per trip home', !E.visitLounge(s, 'pixie', rng) && c.credits === 1500);
  c.booked = false;
  // Every outcome of every girl applies to stats without breaking them.
  for (const g of D.LOUNGE.girls) for (const o of g.outcomes) {
    const t = town(7); t.c.fav = { ...o.fx }; const st = E.stats(t.s);
    ok(`${g.id}: ${E.favText(o.fx)}`, Number.isFinite(st.maxHp) && st.maxHp > 0 && Number.isFinite(st.def) && Object.keys(D.ATTRS).every((k) => E.attr(t.c, k) >= 1));
  }
  { const t = town(8); const base = E.stats(t.s).maxHp; t.c.fav = { hp: 0.05 }; ok('+5% max HP is +5%', Math.abs(E.stats(t.s).maxHp - Math.round(base * 1.05)) <= 1); }
  { const t = town(9); t.c.fav = { def: -1, cha: -1 }; const b = town(9); ok('a disease takes DEF and CHA', E.stats(t.s).def === E.stats(b.s).def - 1 && E.attr(t.c, 'cha') === Math.max(1, E.attr(b.c, 'cha') - 1)); }
  // Bad nights happen: roughly one in four over many visits.
  let bad = 0; const N = 400;
  for (let i = 0; i < N; i++) { const t = town(100 + i); t.c.credits = 600; const r = E.visitLounge(t.s, D.LOUNGE.girls[i % 3].id, t.rng); if (r && r.bad) bad++; }
  ok('about one night in four goes badly', bad > N * 0.15 && bad < N * 0.33, `${bad}/${N}`);
}
// The duel.
function pair(seed) {
  const { s, rng } = town(seed), d2 = E.newDraft(s.meta, rng);
  const g = E.seededRng(seed + 50), other = E.newGame(g); E.createChar(other, g, d2);
  E.joinPartner(s, rng, JSON.parse(JSON.stringify(other.char)), null); s.coop = true;
  return { s, rng };
}
const give = (c, id, n = 1) => { c.perkN = c.perkN || {}; c.perkN[id] = n; if (!c.perks.includes(id)) c.perks.push(id); };
{ const { s, rng } = pair(3);
  ok('no contraband, no duel', !E.duelReady(s) && !E.duelChallenge(s));
  const [p1, p2] = D.PERKS.map((p) => p.id);
  give(s.char, p1, 1); give(s.char2, p2, 2);
  ok('both carrying: the ring opens', E.duelReady(s) && E.duelChallenge(s) && s.duel.phase === 'invite');
  ok('the challenger can\u2019t answer their own invite', !E.duelAnswer(s, true));
  E.withActor(s, 1, () => E.duelAnswer(s, true));
  ok('accepted', s.duel.phase === 'pick');
  E.duelPick(s, 'bruiser'); E.withActor(s, 1, () => E.duelPick(s, 'gunner'));
  ok('both picked: fight', s.duel.phase === 'fight' && s.duel.hp[0] === E.DUEL_BUILDS.bruiser.hp);
  ok('one move waits for the other', E.duelMove(s, 'strike', rng) && s.duel.round === 1 && !E.duelMove(s, 'shoot', rng));
  E.withActor(s, 1, () => E.duelMove(s, 'guard', rng));
  ok('both moved: a round resolves, Strike hurts a Guard', s.duel.round === 2 && s.duel.hp[1] < E.DUEL_BUILDS.gunner.hp && s.duel.hp[0] === E.DUEL_BUILDS.bruiser.hp);
  let n = 0;
  while (s.duel.phase === 'fight' && n++ < 20) { E.duelMove(s, 'strike', rng); E.withActor(s, 1, () => E.duelMove(s, 'shoot', rng)); }
  ok('the fight ends', s.duel.phase === 'done', `winner ${s.duel.winner} after ${s.duel.round - 1}`);
  const w = s.duel.winner;
  if (w !== null) {
    const win = w === 0 ? s.char : s.char2, lose = w === 0 ? s.char2 : s.char;
    ok('the winner takes a piece of contraband', s.duel.prize && E.perkStacks(win, s.duel.prize) >= 1, s.duel.prize);
    ok('the loser loses it', w === 0 ? E.perkStacks(lose, p2) === 1 : !lose.perks.includes(p1));
  }
  ok('closed after', E.duelClose(s) && !s.duel);
}
{ const { s, rng } = pair(4);
  give(s.char, D.PERKS[0].id); give(s.char2, D.PERKS[1].id);
  E.duelChallenge(s); E.withActor(s, 1, () => E.duelAnswer(s, false));
  ok('a decline ends it with nothing taken', s.duel.phase === 'done' && s.duel.declined && E.perkStacks(s.char, D.PERKS[0].id) === 1 && E.perkStacks(s.char2, D.PERKS[1].id) === 1);
  // Builds are close: over many random bouts no loadout wins much more than its share.
  const wins = { bruiser: 0, gunner: 0, warden: 0 }, games = { bruiser: 0, gunner: 0, warden: 0 }, ids = Object.keys(E.DUEL_BUILDS), moves = ['strike', 'shoot', 'guard', 'special'];
  for (let i = 0; i < 900; i++) {
    const t = pair(1000 + i), r = t.rng; give(t.s.char, D.PERKS[0].id); give(t.s.char2, D.PERKS[1].id);
    E.duelChallenge(t.s); E.withActor(t.s, 1, () => E.duelAnswer(t.s, true));
    const a = ids[i % 3], b = ids[Math.floor(i / 3) % 3]; E.duelPick(t.s, a); E.withActor(t.s, 1, () => E.duelPick(t.s, b));
    let k = 0;
    while (t.s.duel.phase === 'fight' && k++ < 20) for (const who of [0, 1]) E.withActor(t.s, who, () => { const m = moves.filter((x) => x !== 'special' || !t.s.duel.cd[who]); E.duelMove(t.s, m[Math.floor(r() * m.length)], r); });
    if (a !== b && t.s.duel.winner !== null) { games[a]++; games[b]++; wins[t.s.duel.winner === 0 ? a : b]++; }
  }
  const rate = ids.map((id) => wins[id] / games[id]);
  ok('random play: every loadout wins 38-62% of mixed bouts', rate.every((x) => x > 0.38 && x < 0.62), rate.map((x) => x.toFixed(2)).join(' '));
}
// The Wheel in co-op: each spin moves only the spinner's credits, even when the other one owes Marrow.
for (const who of [0, 1]) {
  const { s, rng } = pair(60 + who);
  s.char.credits = 500; s.char2.credits = 500; s.char.debt = 200; s.char2.debt = 200;
  const other = () => (who === 0 ? s.char2 : s.char), mine = () => (who === 0 ? s.char : s.char2);
  let wins = 0, spins = 0;
  for (let i = 0; i < 40 && wins < 3; i++) { const r = E.withActor(s, who, () => E.spinWheel(s, 'red', 10, 0, rng)); if (r) { spins++; if (r.win) wins++; } }
  ok(`${who ? 'friend' : 'host'} spins: the other operative's credits and debt don't move`, spins > 0 && wins > 0 && other().credits === 500 && other().debt === 200, `${spins} spins, ${wins} wins, other ${other().credits}/${other().debt}`);
  ok(`${who ? 'friend' : 'host'} spins: their own wins pay their own debt`, mine().debt < 200, `debt ${mine().debt}`);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
