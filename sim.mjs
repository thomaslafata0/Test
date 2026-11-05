// Balance simulator: plays many full campaigns with a simple bot and reports the progression curve.
// Usage: node sim.mjs [campaigns=200] [livesPerCampaign=40]
import * as E from './engine.js';
import * as D from './data.js';
import * as G from './sim-gear.mjs';
// TUNE='{"enemyHp":1.5}' overrides engine tuning for a test run.
Object.assign(E.TUNE, JSON.parse(process.env.TUNE || '{}'));

const CAMPAIGNS = +process.argv[2] || 200;
const LIVES = +process.argv[3] || 40;

const MAP = process.env.MAP || 'garrison';
const STYLE = 'auto';
const SEED = +(process.env.SEED || 0);
const ECON = !!process.env.ECON;
// ABLATE=bonus:healkill,unique:halvek,trait:leech,base:cannon removes those from the loot tables (outlier check).
for (const a of (process.env.ABLATE || '').split(',').filter(Boolean)) {
  const [kind, id] = a.split(':');
  if (kind === 'bonus') delete D.BONUSES[id];
  else if (kind === 'trait') delete D.TRAITS[id];
  else if (kind === 'unique') { for (const [b, u] of Object.entries(D.BOSS_UNIQUE)) if (u === id || b === id) delete D.BOSS_UNIQUE[b]; }
  else if (kind === 'base') D.GEAR[id].tier = 99;
  else if (kind === 'perk') D.PERKS.splice(D.PERKS.findIndex((p) => p.id === id), 1);
  else if (kind === 'loot') E.TUNE.eliteGear = 0, Object.keys(D.BOSS_UNIQUE).forEach((b) => delete D.BOSS_UNIQUE[b]);
}

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
  G.shopGear(s, STYLE, 60);
  while (c.items.stim < 3 && E.buyItem(s, 'stim'));
  for (const id of ['dermal', 'reflex', 'pain', 'adrenal']) if (c.credits > 150) E.installImplant(s, id);
  for (const u of D.UPGRADES) if (c.credits > u.cost + 60) E.buyUpgrade(s, u.id);
  if (c.credits > 120 && c.items.thermal < 1) E.buyItem(s, 'thermal');
  G.upgradeGear(s, STYLE, 150);
}

function combatBot(s) {
  const e = s.run.enemy, c = s.char, st = E.stats(s);
  if (c.hp < st.maxHp * 0.35 && c.items.stim > 0) return 'stim';
  if (c.hp < st.maxHp * 0.2 && c.items.smoke > 0) return 'smoke';
  if (e.boss && c.items.thermal > 0) return 'thermal';
  if (E.mechanicOf(s.run) === 'vents' && s.run.vent === 1 && !e.tags.includes('droid')) return 'defend';
  if (e.intent === 'heavy' && e.stun === 0) return 'defend';
  if (e.intent === 'special' && e.stun === 0 && D.SPECIALS[e.id].status) return 'defend';
  if (e.intent === 'guard' && e.stun === 0 && G.attackChoice(s, STYLE) !== 'strike') return 'defend';
  for (const k of ['overload', 'smash', 'aimed', 'blast', 'burst']) if (E.canUse(s, k)) return k;
  return G.attackChoice(s, STYLE);
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
      else if (s.screen === 'loot') G.lootChoice(s, rng, STYLE);
      else if (s.screen === 'perk') E.choosePerk(s, s.run.perkOffer[0], rng, s.char.perks[0]);
      else if (s.screen === 'event') {
        const ev = E.eventById(s.event);
        let best = 0, bestCh = -1;
        ev.options.forEach((o, i) => { const ch = E.optionAvailable(s, o) ? E.checkChance(s, o.check) : -1; if (ch > bestCh) { bestCh = ch; best = i; } });
        E.resolveEvent(s, best, rng); E.nextEncounter(s, rng);
      }
      else if (s.screen === 'route') {
        const ch = s.run.choices, st = E.stats(s), low = s.char.hp < st.maxHp * 0.5;
        const pref = low ? ['rest', 'supply', 'cells', 'cargo', 'event', 'fight', 'elite', 'boss'] : ['cells', 'supply', 'cargo', 'event', 'fight', 'rest', 'elite', 'boss'];
        const idx = ch.map((k) => pref.indexOf(k)).reduce((best, v, i, arr) => (v < arr[best] ? i : best), 0);
        E.enterRoom(s, idx, rng);
      }
      else if (s.screen === 'room') E.offerRoute(s, rng);
      else if (s.screen === 'sectorClear') {
        const st = E.stats(s), next = s.run.sector + 1;
        const weak = s.char.hp < st.maxHp * 0.5 && s.char.items.stim === 0;
        const bossNext = E.isBossSector(next) && s.char.hp < st.maxHp * 0.8;
        if (weak || bossNext) E.endRun(s, 'extracted', rng); else E.pushDeeper(s, rng);
      }
    }
  }
  stats.deathSectors.push(s.outcome?.sector ?? 0);
  if (ECON && s.char) {
    const g = Object.values(s.char.gear).filter(Boolean);
    gearAtDeath.push({ raids: deployments, credits: s.char.credits, lvl: g.reduce((t, it) => t + it.level, 0) / g.length,
      maxed: g.filter((it) => !E.canUpgrade(it) && E.upgradeGain(it) > 0).length, rar: g.map((it) => it.rarity), deep: s.char.deepest });
  }
  stats.deployments.push(deployments);
}

const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length * p)] ?? 0; };
const avg = (arr) => (arr.reduce((t, v) => t + v, 0) / arr.length).toFixed(1);

const byLife = Array.from({ length: LIVES }, () => ({ deathSectors: [], deployments: [] }));
const firstBoss = { 5: [], 10: [], 15: [] };
const ledger = {}, lootStats = {}, gearAtDeath = [];
let raidsTotal = 0;
for (let k = 0; k < CAMPAIGNS; k++) {
  const rng = E.seededRng(1000 + k + SEED);
  const s = E.newGame(rng);
  if (ECON) { s.ledger = ledger; s.lootStats = lootStats; }
  const seen = {};
  for (let life = 0; life < LIVES; life++) {
    if (life > 0) E.recruit(s, rng);
    createBot(s, rng);
    playLife(s, rng, byLife[life]);
    for (const b of [5, 10, 15]) if (!seen[b] && s.meta.bestSector >= b) { seen[b] = 1; firstBoss[b].push(life + 1); }
  }
  raidsTotal += s.meta.stats.raids;
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

if (ECON) {
  console.log(`\nCredits per raid by source (${raidsTotal} raids):`);
  const rows = Object.entries(ledger).sort((a, b) => b[1] - a[1]);
  const inc = rows.filter(([k]) => !k.startsWith('spend:')), out = rows.filter(([k]) => k.startsWith('spend:'));
  const tot = (r) => r.reduce((t, [, v]) => t + v, 0);
  for (const [k, v] of inc) console.log(`  ${k.padEnd(16)} ${(v / raidsTotal).toFixed(1).padStart(7)}  ${((v / tot(inc)) * 100).toFixed(0).padStart(3)}%`);
  console.log(`  ${'total income'.padEnd(16)} ${(tot(inc) / raidsTotal).toFixed(1).padStart(7)}`);
  for (const [k, v] of out) console.log(`  ${k.padEnd(16)} ${(v / raidsTotal).toFixed(1).padStart(7)}  ${((v / tot(out)) * 100).toFixed(0).padStart(3)}% of spending`);
  for (const [lo, hi] of [[1, 3], [4, 8], [9, 15], [16, 99]]) {
    const g = gearAtDeath.filter((x) => x.raids >= lo && x.raids <= hi);
    if (!g.length) continue;
    const r = {}; g.forEach((x) => x.rar.forEach((k) => (r[k] = (r[k] || 0) + 1)));
    const n = g.reduce((t, x) => t + x.rar.length, 0);
    console.log(`  operatives lasting ${lo}-${hi} raids (${g.length}): avg upgrade +${avg(g.map((x) => x.lvl))}, maxed ${avg(g.map((x) => x.maxed))}/slot-set, credits held ${avg(g.map((x) => x.credits))}, deepest ${avg(g.map((x) => x.deep))}, rarity ${Object.entries(r).map(([k, v]) => `${k} ${Math.round(v / n * 100)}%`).join(' ')}`);
  }
  console.log(`  loot drops: ${lootStats.drops || 0} (${((lootStats.drops || 0) / raidsTotal).toFixed(2)} per raid), taken ${lootStats.taken || 0}`);
}
