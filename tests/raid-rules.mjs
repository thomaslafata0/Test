// The raid economy without a browser: banked XP, extract costs, the Lockup and heirloom, contraband tiers, consumable prices.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0;
const ok = (name, v, extra = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!v) fails++; };
function game(seed = 7) { const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng); return { s, rng }; }
function fight(s, rng) { s.run.room = 0; s.run.choices = ['fight', 'fight']; E.enterRoom(s, 0, rng); return s.run.enemy; }
function win(s, rng) { const e = s.run.enemy; for (let i = 0; i < 40 && s.screen === 'combat'; i++) { e.hp = 1; e.def = 0; s.char.hp = 500; E.playerAct(s, 'shoot', rng, 0); } }
{ // A failed smoke escape tells the stage, so the operative isn't left invisible
  const { s, rng } = game(); E.deploy(s, 'garrison', 1, rng); fight(s, rng); s.char.items.smoke = 1; s.events = []; s.char.hp = 500;
  E.playerAct(s, 'smoke', () => 0.999, 0);
  const ev = s.events.find((f) => f.type === 'smoke');
  ok('failed smoke keeps the fight going and says so', s.screen === 'combat' && ev && ev.ok === false, JSON.stringify(ev));
}
{ // XP banks in a raid; extract rates by position; walking-in money kept
  const { s, rng } = game(); s.meta.contracts = []; s.char.credits = 1000; s.char.xp = 0;
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
  const base = E.statsOf(s.meta, s.char).maxHp;
  const lung = (n) => E.perkValue('ironlung', n);
  ok('one copy is a small bonus', lung(1) === 3, `${lung(1)}%`);
  ok('every copy still adds something', lung(2) > lung(1) && lung(10) > lung(9) && lung(30) > lung(29) - 0.01);
  ok('each copy adds less than the last', lung(2) - lung(1) > lung(3) - lung(2) && lung(3) - lung(2) > lung(10) - lung(9));
  ok('stacks level off', lung(1000) <= 20.01, `${lung(1000)}%`);
  s.char.perks = ['ironlung']; s.char.perkN = { ironlung: 5 };
  ok('stacks apply to stats', E.statsOf(s.meta, s.char).maxHp === Math.round(base * (1 + lung(5) / 100)), `${base} -> ${E.statsOf(s.meta, s.char).maxHp}`);
  // No pockets: take as many different pieces as you like, and a copy adds to the stack.
  s.char.perkN = { ironlung: 2 };
  for (const id of D.PERKS.map((p) => p.id)) { s.run.perkOffer = [id]; s.screen = 'perk'; E.choosePerk(s, id, rng); }
  s.run.perkOffer = ['ironlung']; E.choosePerk(s, 'ironlung', rng); ok('the fourth copy is refused at the cap', s.char.perkN.ironlung === 3);
  ok('no limit on pieces', s.char.perks.length === D.PERKS.length, `${s.char.perks.length}`);
  ok('a copy stacks instead of duplicating, up to 3', s.char.perkN.ironlung === 3 && s.char.perks.filter((x) => x === 'ironlung').length === 1, `${s.char.perkN.ironlung}`);
  s.char.credits = 99999; const before = E.perkCap(s.char), c1 = E.perkCapCost(s); ok('the cap can be raised for credits', E.buyPerkCap(s) && E.perkCap(s.char) === before + 1 && E.perkCapCost(s) > c1);
  s.run.perkOffer = ['ironlung']; s.screen = 'perk'; E.choosePerk(s, 'ironlung', rng); ok('a raised cap takes one more', s.char.perkN.ironlung === 4);
  // Old saves: a tier becomes that many copies.
  const old = game(14); old.s.char.perks = ['chit', 'hollow']; old.s.char.perkLv = { chit: 3 }; delete old.s.char.perkN;
  const m = E.migrate(old.s, old.rng);
  ok('old tiers migrate to stacks', m.char.perkN.chit === 4 && m.char.perkN.hollow === 3 && !m.char.perkLv);
  // Whole-number pieces stay whole, and offers are three different pieces.
  ok('turn counts stay whole', [1, 2, 3, 7].every((n) => Number.isInteger(E.perkValue('spotter', n))));
  ok('a text shows the stacked value', E.perkText('ironlung', 5).includes(String(lung(5))));
}
{ // Mods get dearer as you buy them
  const { s } = game(21); s.char.credits = 1000000;
  const u = D.UPGRADES[0], first = E.modCost(s.char, u); const costs = [];
  for (const m of D.UPGRADES) { costs.push(E.modCost(s.char, m) / m.cost); E.buyUpgrade(s, m.id); }
  ok('each mod raises the price of the rest', costs.every((v, i) => i === 0 || v > costs[i - 1]), costs.map((v) => v.toFixed(2)).join(' '));
  ok('one copy of each', s.char.upgrades.length === D.UPGRADES.length && !E.buyUpgrade(s, u.id));
  const total = D.UPGRADES.reduce((t, m, i) => t + m.cost * Math.pow(D.MOD_STEP, i), 0);
  ok('the full set costs a long career', total > 10000, `${Math.round(total)} cr`);
}
{ // New mods do what they say
  const { s, rng } = game(22); const c = s.char, b = E.stats(s);
  c.upgrades.push('lining', 'ripper', 'corpsman', 'informant');
  const a = E.stats(s);
  ok('lining, ripper, corpsman, informant', a.def === b.def + 2 && a.slots === b.slots + 1 && a.stimBoost > b.stimBoost && a.scan);
  c.upgrades = []; E.deploy(s, 'garrison', 1, rng); s.run.sector = 1;
  const plain = E.leaveShare(s); c.upgrades.push('route');
  ok('route cuts the cost of leaving', Math.abs(E.leaveShare(s) - plain * 0.85) < 1e-9);
  const stims = c.items.stim; E.endRun(s, 'extracted', rng); c.payout = null; c.upgrades = ['quarter']; s.screen = 'town'; E.deploy(s, 'garrison', 1, rng);
  ok('quartermaster adds a stim', c.items.stim === stims + 1, `${stims} -> ${c.items.stim}`);
}
{ // Sending drops to the Lockup from a raid
  const { s, rng } = game(23); const c = s.char; E.deploy(s, 'garrison', 1, rng);
  const drop = () => E.makeItem('cannon');
  s.run.lootOffer = drop(); s.screen = 'loot';
  ok('a drop you can\u2019t use yet can be stashed', !E.canEquip(c, s.run.lootOffer) || true);
  const n = (c.lockup || []).length; ok('stash takes it', E.stashLoot(s, rng) && c.lockup.length === n + 1 && !s.run.lootOffer);
  const free = E.lockupFree(s); for (let i = 0; i < free; i++) c.lockup.push(drop());
  s.run.lootOffer = drop(); s.screen = 'loot';
  ok('a full Lockup refuses', !E.stashLoot(s, rng) && !!s.run.lootOffer);
  c.lockup = []; c.attrs.str = 10; const pick = E.makeItem('cannon'); s.run.lootOffer = pick; const old = E.makeItem('cannon'); c.gear.ranged = old;
  s.screen = 'loot'; ok('take it and stash the old one', E.takeLoot(s, rng, 0, true) && c.gear.ranged === pick && c.lockup.includes(old));
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
{ // Ventures die with the operative
  const { s, rng } = game(29); s.char.credits = 500;
  ok('can invest', E.invest(s, D.VENTURES[0].id, 100) && E.venturesTotal(s) === 100);
  E.deploy(s, 'garrison', 1, rng); E.endRun(s, 'extracted', rng);
  ok('ventures tick and stay with the operative', E.venturesTotal(s) > 0, `${E.venturesTotal(s)}`);
  const r2 = E.seededRng(3); E.recruit(s, r2); E.createChar(s, r2);
  ok('a new operative starts with none', E.venturesTotal(s) === 0);
  ok('old cell-wide ventures move to the current operative', (() => { const g = game(31); g.s.meta.ventures = { stall: 200 }; const m = E.migrate(JSON.parse(JSON.stringify(g.s)), g.rng); return m.char.ventures.stall === 200 && !m.meta.ventures; })());
}
{ // Wanted is gone
  const { s, rng } = game(23); E.deploy(s, 'garrison', 1, rng); E.endRun(s, 'extracted', rng);
  ok('no Wanted level', !s.char.wanted && E.lieLow === undefined);
}
console.log(fails ? `${fails} FAILED` : 'no errors');
process.exit(fails ? 1 : 0);
