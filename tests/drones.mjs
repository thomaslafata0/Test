// Drone rules: what each type does, wear, repair, upgrades, old saves, and the damage preview with a shield.
import assert from 'node:assert';
import * as E from '../engine.js';
import * as D from '../data.js';
const start = (seed, type, rank = 1) => {
  const rng = E.seededRng(seed), s = E.newGame(rng), d = E.newDraft(s.meta, rng);
  d.drone = type; E.createChar(s, rng, d); s.screen = 'town'; s.char.drone.rank = rank;
  E.deploy(s, 'garrison', 1, rng);
  return { s, rng };
};
const toFight = ({ s, rng }) => {
  for (let i = 0; i < 40 && s.screen !== 'combat'; i++) {
    if (s.screen === 'route') E.enterRoom(s, 0, rng);
    else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng);
  }
  assert.strictEqual(s.screen, 'combat');
  const e = s.run.enemy; e.hp = e.maxHp = 100000; e.atk = 1; e.stun = 0; e.quirk = null; e.intents = { attack: 1 };
};
const turns = ({ s, rng }, n, act = 'defend') => { for (let i = 0; i < n && s.screen === 'combat'; i++) { s.char.hp = Math.max(s.char.hp, 5); E.playerAct(s, act, rng, 0); } };

// Hornet: small shots add up to the stated share of ATK.
{
  const g = start(1, 'hornet', 2); toFight(g);
  const e = g.s.run.enemy, atk = Math.max(E.stats(g.s).atk, E.stats(g.s).atkM);
  turns(g, 50);
  const dealt = e.maxHp - e.hp, want = atk * 0.18 * 50;
  assert(Math.abs(dealt - want) <= want * 0.05 + 2, `hornet dealt ${dealt}, wanted about ${want}`);
  console.log('PASS hornet adds up to its share of ATK');
}
// Aegis: blocks its share of a hit, and the preview agrees.
{
  const g = start(2, 'aegis', 5); toFight(g);
  const c = g.s.char, plain = { ...c.drone }, e = g.s.run.enemy;
  e.atk = 200; e.intent = 'attack';
  const withDrone = E.incomingRange(g.s);
  c.drone.damaged = true;
  const without = E.incomingRange(g.s);
  c.drone = plain;
  assert(withDrone.max < without.max * 0.7, `aegis ${withDrone.max} vs ${without.max}`);
  console.log('PASS aegis blocks, and the preview shows it');
}
// Mender: heals, and never overheals.
{
  const g = start(3, 'mender', 3); toFight(g);
  const c = g.s.char, mx = E.stats(g.s).maxHp;
  c.hp = 10; E.playerAct(g.s, 'defend', g.rng, 0); E.playerAct(g.s, 'defend', g.rng, 0);
  assert(c.hp >= 10, 'mender should heal');
  turns(g, 200);
  assert(c.hp <= mx, 'never over max HP');
  console.log('PASS mender heals up to max');
}
// Magpie: at rank 5 it acts roughly as often as stated and doesn't spend your items.
{
  const g = start(4, 'magpie', 5); toFight(g);
  const c = g.s.char, items = JSON.stringify(c.items);
  g.s.run.enemy.hp = g.s.run.enemy.maxHp = 10000000;
  g.s.events = [];
  turns(g, 400);
  const used = g.s.events.filter((ev) => ev.who === 'drone' && ev.type === 'item').length;
  assert(used > 20 && used < 90, `magpie acted ${used} times in 400`);
  assert.strictEqual(JSON.stringify(c.items), items, 'free means free');
  console.log(`PASS magpie used free items ${used} times in 400 turns`);
}
// An offline drone does nothing.
{
  const g = start(5, 'hornet', 5); toFight(g);
  g.s.char.drone.damaged = true;
  const e = g.s.run.enemy; turns(g, 30);
  assert.strictEqual(e.hp, e.maxHp, 'offline drones do not fire');
  console.log('PASS offline drones do nothing');
}
// Upgrades and repairs.
{
  const rng = E.seededRng(6), s = E.newGame(rng); E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town';
  const c = s.char;
  s.meta.resolve = 3;
  assert.strictEqual(E.upgradeDrone(s), false, 'needs Resolve');
  s.meta.resolve = 4;
  assert.strictEqual(E.upgradeDrone(s), true); assert.strictEqual(c.drone.rank, 2); assert.strictEqual(s.meta.resolve, 0);
  c.drone.rank = 5; s.meta.resolve = 99;
  assert.strictEqual(E.upgradeDrone(s), false, 'rank 5 is the top');
  assert.strictEqual(E.repairDrone(s), false, 'nothing to repair');
  c.drone.damaged = true; c.credits = 0;
  assert.strictEqual(E.repairDrone(s), false, 'repairs cost credits');
  c.credits = 1000; const before = c.credits, cost = E.droneRepairCost(s);
  assert(cost > 0); assert.strictEqual(E.repairDrone(s), true);
  assert.strictEqual(c.credits, before - cost); assert.strictEqual(c.drone.damaged, false);
  assert.strictEqual(s.meta.droneRanks.hornet, 2, 'the rank is kept by the cell');
  const d2 = E.newDraft(s.meta, rng); d2.drone = 'hornet'; E.createChar(s, rng, d2); assert.strictEqual(s.char.drone.rank, 2, 'the next operative keeps it');
  const d3 = E.newDraft(s.meta, rng); d3.drone = 'aegis'; E.createChar(s, rng, d3); assert.strictEqual(s.char.drone.rank, 1, 'other types start from their own rank');
  assert.strictEqual(s.char.drone.damaged, false);
  console.log('PASS upgrades last across operatives, and repairs cost credits');
}
// Old operatives have no drone: nothing breaks, and they get one free pick.
{
  const g = start(7, 'hornet'); g.s.char.drone = null; toFight(g);
  turns(g, 5);
  assert.strictEqual(E.incomingRange(g.s) === undefined, false);
  const rng = E.seededRng(8), s = E.newGame(rng); E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town';
  delete s.char.drone;
  assert.strictEqual(E.pickDrone(s, 'nonsense'), false);
  assert.strictEqual(E.pickDrone(s, 'aegis'), true);
  assert.strictEqual(E.pickDrone(s, 'hornet'), false, 'only one pick');
  assert.strictEqual(s.char.drone.type, 'aegis');
  console.log('PASS old operatives keep working and pick once');
}
// Wear: about one sector clear in ten knocks a drone out.
{
  let hits = 0, clears = 0;
  for (let i = 0; i < 400; i++) {
    const g = start(1000 + i, 'hornet');
    const c = g.s.char;
    g.s.run.sector = 1;
    // Win the first fight quickly until the sector clears, or give up.
    for (let n = 0; n < 200 && g.s.run && g.s.screen !== 'sectorClear' && g.s.screen !== 'death'; n++) {
      if (g.s.screen === 'combat') { g.s.run.enemy.hp = 1; c.hp = 999; E.playerAct(g.s, 'strike', g.rng, 0); }
      else if (g.s.screen === 'victory' || g.s.screen === 'loot' || g.s.screen === 'perk') { g.s.run.lootOffer = null; g.s.run.perkOffer = null; E.continueAfterVictory(g.s, g.rng); }
      else if (g.s.screen === 'route') E.enterRoom(g.s, 0, g.rng);
      else if (g.s.screen === 'event') { if (!g.s.eventResult) E.resolveEvent(g.s, 0, g.rng, 0); E.offerRoute(g.s, g.rng); }
      else E.offerRoute(g.s, g.rng);
    }
    if (g.s.screen === 'sectorClear') { clears++; if (c.drone.damaged) hits++; }
  }
  assert(clears > 300, `only ${clears} clears`);
  const share = hits / clears;
  assert(share > 0.05 && share < 0.16, `wear ${share}`);
  console.log(`PASS wear ${Math.round(share * 100)}% over ${clears} sector clears`);
}
assert.strictEqual(D.DRONE_ORDER.length, 4);
