// Balance simulator: plays many full campaigns with a simple bot and reports the progression curve.
// Usage: node sim.mjs [campaigns=200] [livesPerCampaign=40]
import * as E from './engine.js';
import * as D from './data.js';

const CAMPAIGNS = +process.argv[2] || 200;
const LIVES = +process.argv[3] || 40;

const MAP = process.env.MAP || 'garrison';

function createBot(s, rng) {
  const d = s.draft;
  d.background = 'foundry';
  const order = ['str', 'agi', 'str', 'agi', 'int', 'cha'];
  for (const k of order) E.draftAdjust(d, k, 1);
  E.createChar(s, rng);
}

function townBot(s) {
  const c = s.char;
  E.heal(s);
  while (c.attrPoints > 0 && E.spendAttr(s, c.attrs.str <= c.attrs.agi ? 'str' : 'agi'));
  // Spend Resolve: cell upgrades first, then cheapest training.
  for (const u of D.CELL) E.buyCell(s, u.id);
  let trained = true;
  while (trained) {
    const order = Object.keys(D.TRAINING).sort((a, b) => s.meta.training[a] - s.meta.training[b]);
    trained = order.some((k) => E.train(s, k));
  }
  for (let i = D.WEAPONS.length - 1; i > 0; i--) if (D.WEAPONS[i].atk > E.weaponOf(c).atk && E.buyGear(s, 'weapon', D.WEAPONS[i].id)) break;
  for (let i = D.ARMOR.length - 1; i > 0; i--) if (D.ARMOR[i].def > E.armorOf(c).def && E.buyGear(s, 'armor', D.ARMOR[i].id)) break;
  while (c.items.stim < 3 && E.buyItem(s, 'stim'));
  for (const id of ['dermal', 'reflex', 'pain', 'adrenal']) if (c.credits > 150) E.installImplant(s, id);
  for (const u of D.UPGRADES) if (c.credits > u.cost + 60) E.buyUpgrade(s, u.id);
  if (c.credits > 120 && c.items.thermal < 1) E.buyItem(s, 'thermal');
}

function combatBot(s) {
  const e = s.run.enemy, c = s.char, st = E.stats(s);
  if (c.hp < st.maxHp * 0.35 && c.items.stim > 0) return 'stim';
  if (c.hp < st.maxHp * 0.2 && c.items.smoke > 0) return 'smoke';
  if (e.boss && c.items.thermal > 0) return 'thermal';
  if (e.intent === 'heavy' && e.stun === 0) return 'defend';
  if (e.intent === 'guard' && e.stun === 0) return 'defend';
  for (const k of ['overload', 'smash', 'aimed', 'blast', 'burst']) if (E.canUse(s, k)) return k;
  return 'attack';
}

function playLife(s, rng, stats) {
  let deployments = 0;
  while (s.screen !== 'death' && deployments < 30) {
    townBot(s);
    deployments++;
    const map = E.mapUnlocked(s, E.mapById(MAP)) ? MAP : 'garrison';
    const start = Math.max(...E.mapProgress(s.char, map).insertions);
    E.deploy(s, map, start, rng);
    let steps = 0;
    while (s.run && s.screen !== 'death' && steps++ < 5000) {
      if (s.screen === 'combat') E.playerAct(s, combatBot(s), rng);
      else if (s.screen === 'victory') E.continueAfterVictory(s, rng);
      else if (s.screen === 'event') {
        const ev = E.eventById(s.event);
        let best = 0, bestCh = -1;
        ev.options.forEach((o, i) => { const ch = E.optionAvailable(s, o) ? E.checkChance(s, o.check) : -1; if (ch > bestCh) { bestCh = ch; best = i; } });
        E.resolveEvent(s, best, rng); E.nextEncounter(s, rng);
      }
      else if (s.screen === 'sectorClear') {
        const st = E.stats(s), next = s.run.sector + 1;
        const weak = s.char.hp < st.maxHp * 0.5 && s.char.items.stim === 0;
        const bossNext = E.isBossSector(next) && s.char.hp < st.maxHp * 0.8;
        if (weak || bossNext) E.endRun(s, 'extracted'); else E.pushDeeper(s, rng);
      }
    }
  }
  stats.deathSectors.push(s.outcome?.sector ?? 0);
  stats.deployments.push(deployments);
}

const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length * p)] ?? 0; };
const avg = (arr) => (arr.reduce((t, v) => t + v, 0) / arr.length).toFixed(1);

const byLife = Array.from({ length: LIVES }, () => ({ deathSectors: [], deployments: [] }));
const firstBoss = { 5: [], 10: [], 15: [] };
for (let k = 0; k < CAMPAIGNS; k++) {
  const rng = E.seededRng(1000 + k);
  const s = E.newGame(rng);
  const seen = {};
  for (let life = 0; life < LIVES; life++) {
    if (life > 0) E.recruit(s, rng);
    createBot(s, rng);
    playLife(s, rng, byLife[life]);
    for (const b of [5, 10, 15]) if (!seen[b] && s.meta.bestSector >= b) { seen[b] = 1; firstBoss[b].push(life + 1); }
  }
}

console.log(`${CAMPAIGNS} campaigns x ${LIVES} lives\n`);
console.log('life  median death sector  p90  avg deployments');
for (const i of [0, 1, 2, 4, 9, 14, 19, 29, 39].filter((i) => i < LIVES)) {
  const L = byLife[i];
  console.log(`${String(i + 1).padStart(4)}  ${String(pct(L.deathSectors, 0.5)).padStart(19)}  ${String(pct(L.deathSectors, 0.9)).padStart(3)}  ${avg(L.deployments).padStart(15)}`);
}
for (const b of [5, 10, 15]) {
  const arr = firstBoss[b];
  console.log(`Boss sector ${b}: beaten in ${((arr.length / CAMPAIGNS) * 100).toFixed(0)}% of campaigns, median at life ${pct(arr, 0.5) || '-'}`);
}
