// The raid economy without a browser: banked XP, extract costs, the Lockup and heirloom, contraband tiers, consumable prices.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0;
const ok = (name, v, extra = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!v) fails++; };
function game(seed = 7) { const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng); return { s, rng }; }
function fight(s, rng) { s.run.room = 0; s.run.choices = ['fight', 'fight']; E.enterRoom(s, 0, rng); return s.run.enemy; }
function win(s, rng) { const e = s.run.enemy; for (let i = 0; i < 40 && s.screen === 'combat'; i++) { e.hp = 1; e.def = 0; s.char.hp = 500; E.playerAct(s, 'shoot', rng, 0); } }
{ // XP banks in a raid; extract rates by position; walking-in money kept
  const { s, rng } = game(); s.char.credits = 1000; s.char.xp = 0;
  E.deploy(s, 'garrison', 1, rng); fight(s, rng);
  const lv = s.char.level; win(s, rng);
  ok('no level or XP during a raid', s.char.level === lv && s.char.xp === 0 && s.char.xpBank > 0, `bank ${s.char.xpBank}`);
  ok('the fight still pays credits', s.char.credits > 1000);
  s.char.credits = 1200; s.char.xpBank = 1000; s.run.sector = 1;
  ok('extract cost after sector 1 is 80% of the haul only', E.extractLoss(s) === 160 && E.extractXpLoss(s) === 800, `${E.extractLoss(s)} ${E.extractXpLoss(s)}`);
  E.endRun(s, 'extracted', rng);
  ok('walking-in money is kept', s.char.credits === 1040, `${s.char.credits}`);
  ok('XP loses the same share and pays out', s.char.payout && s.char.payout.xp === 200 && s.char.payout.lostXp === 800 && s.char.xpBank === 0, JSON.stringify(s.char.payout));
  ok('levels arrive on leaving', s.char.level > lv, `level ${s.char.level}`);
  ok('payout offers points', s.char.attrPoints >= s.char.payout.points && s.char.payout.points > 0);
}
for (const [sector, want] of [[1, 0.8], [2, 0.65], [3, 0.5], [4, 0.4], [5, 0], [6, 0.8], [7, 0.65], [9, 0.4], [10, 0], [11, 0.8]]) ok(`rate after sector ${sector}`, E.extractRate(sector) === want);
{ // A boss secures everything; the next stretch risks only what's new
  const { s, rng } = game(9); E.deploy(s, 'garrison', 1, rng); s.run.sector = 5;
  s.char.credits += 500; s.char.xpBank = 300; const safe = s.char.credits;
  s.run.room = 3; s.run.fightsDone = 3; E.offerRoute(s, rng);
  ok('clearing a boss sector settles', s.screen === 'sectorClear' && s.char.payout && s.char.payout.kind === 'boss' && s.char.payout.lostXp === 0 && s.char.xpBank === 0, s.screen);
  ok('boss sector leaving is free', E.extractLoss(s) === 0);
  const after = s.char.credits;
  E.pushDeeper(s, rng); s.char.credits += 100; s.run.sector = 6;
  ok('after the boss only new money is at risk', E.extractLoss(s) === 80 && after >= safe, `${E.extractLoss(s)}`);
}
{ // Lockup and heirloom
  const { s, rng } = game(11); s.meta.cell.push('heirloom');
  const it = E.makeItem('carbine', 'rare', rng); it.level = 3; it.spent = 500; s.char.lockup = [it];
  ok('lockup piece can be the heirloom', E.heirloomChoices(s).some(([k]) => k === 'lockup:0'));
  E.deploy(s, 'garrison', 1, rng); const e = fight(s, rng); e.atk = 100000; e.intent = 'attack'; s.char.hp = 1;
  for (let i = 0; i < 20 && s.run; i++) { e.intent = 'attack'; e.stun = 0; s.char.hp = 1; E.playerAct(s, 'defend', rng, 0); }
  ok('death leaves one heirloom at base level', s.screen === 'death' && s.meta.heirloom && s.meta.heirloom.level === 0 && (s.meta.heirloom.spent || 0) === 0, s.meta.heirloom && E.itemName(s.meta.heirloom));
  const r2 = E.seededRng(3); E.recruit(s, r2); E.createChar(s, r2);
  ok('new operative gets an empty Lockup', (s.char.lockup || []).length === 0);
}
{ // Contraband tiers
  const { s, rng } = game(13); E.deploy(s, 'garrison', 1, rng);
  ok('scavenger runs 10 to 30', D.PERKS.find((p) => p.id === 'scavenger').vals[0] === 10 && D.PERKS.find((p) => p.id === 'scavenger').vals[3] === 30);
  ok('iron lung runs 5 8 12 15', D.PERKS.find((p) => p.id === 'ironlung').vals.join() === '5,8,12,15');
  const base = E.statsOf(s.meta, s.char).maxHp;
  s.char.perks = ['ironlung']; s.char.perkLv = { ironlung: 3 };
  ok('tier strength applies', E.statsOf(s.meta, s.char).maxHp === Math.round(base * 1.15), `${base} -> ${E.statsOf(s.meta, s.char).maxHp}`);
  s.char.perks = ['ironlung', 'chit', 'dressing', 'hollow']; s.char.perkLv = { ironlung: 0, chit: 0, dressing: 0, hollow: 0 };
  s.run.perkOffer = ['ironlung']; s.run.perkTiers = { ironlung: 2 };
  E.choosePerk(s, 'ironlung', rng);
  ok('a better copy upgrades with full pockets', s.char.perkLv.ironlung === 2 && s.char.perks.length === 4);
  // deeper means better
  const avg = (sector) => { let n = 0, t = 0; for (let i = 0; i < 400; i++) { const g = game(100 + i); g.s.char.perks = []; E.deploy(g.s, 'garrison', 1, g.rng); g.s.run.sector = sector; const e2 = fight(g.s, g.rng); e2.boss = true; e2.tags = [...e2.tags, 'boss']; win(g.s, g.rng); const o = g.s.run && g.s.run.perkOffer; if (o) for (const id of o) { t += g.s.run.perkTiers[id]; n++; } } return t / Math.max(1, n); };
  const a1 = avg(4), a2 = avg(14); ok('deeper rolls better tiers', a2 > a1 + 0.4, `${a1.toFixed(2)} -> ${a2.toFixed(2)}`);
}
{ // Prices
  const { s } = game(17); const low = E.price(s, E.itemCost(s, 'stim')); s.char.deepest = 15; const high = E.price(s, E.itemCost(s, 'stim'));
  ok('stims cost much more deep in', high > low * 4, `${low} -> ${high}`);
}
{ // Allies take several hits
  const { s, rng } = game(19); E.deploy(s, 'garrison', 1, rng); const e = fight(s, rng); s.run.allies = 1; e.atk = 1; let hits = 0;
  for (let i = 0; i < 60 && s.run && s.run.allies && s.screen === 'combat'; i++) { const before = s.run.allyHits || 0; e.hp = e.maxHp = 100000; e.intent = 'attack'; e.stun = 0; s.char.hp = 500; E.playerAct(s, 'defend', rng, 0); if ((s.run.allyHits || 0) > before) hits++; }
  ok('an ally takes more than one hit', hits >= E.TUNE.allyGrit - 1, `hits ${hits}`);
}
{ // Wanted is gone
  const { s, rng } = game(23); E.deploy(s, 'garrison', 1, rng); E.endRun(s, 'extracted', rng);
  ok('no Wanted level', !s.char.wanted && E.lieLow === undefined);
}
console.log(fails ? `${fails} FAILED` : 'no errors');
process.exit(fails ? 1 : 0);
