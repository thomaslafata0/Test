// Builds board.json: the simulator's best raids, labelled Bot #n, to seed the leaderboard until real raids replace them.
// Usage: node sim-board.mjs [campaigns=40] [lives=25] > board.json
import * as E from './engine.js';
import * as D from './data.js';
import * as G from './sim-gear.mjs';

const CAMPAIGNS = +process.argv[2] || 40, LIVES = +process.argv[3] || 25;
const STYLE = 'auto';
function createBot(s, rng) {
  const d = s.draft, bgs = ['foundry', 'runner', 'clerk', 'preacher'];
  d.background = bgs[Math.floor(rng() * bgs.length)];
  for (const k of ['str', 'agi', 'str', 'agi', 'int', 'cha']) E.draftAdjust(d, k, 1);
  E.createChar(s, rng);
}
function townBot(s) {
  const c = s.char;
  E.heal(s);
  while (c.attrPoints > 0 && E.spendAttr(s, c.attrs.str <= c.attrs.agi ? 'str' : 'agi'));
  for (const u of D.CELL) E.buyCell(s, u.id);
  let trained = true;
  while (trained) { const order = Object.keys(D.TRAINING).sort((a, b) => s.meta.training[a] - s.meta.training[b]); trained = order.some((k) => E.train(s, k)); }
  G.shopGear(s, STYLE, 60);
  while (c.items.stim < 3 && E.buyItem(s, 'stim'));
  for (const id of ['dermal', 'reflex', 'pain', 'adrenal']) if (c.credits > 150) E.installImplant(s, id);
  G.upgradeGear(s, STYLE, 150);
}
function combatBot(s) {
  const e = s.run.enemy, c = s.char, st = E.stats(s);
  if (c.hp < st.maxHp * 0.35 && c.items.stim > 0) return 'stim';
  if (c.hp < st.maxHp * 0.2 && c.items.smoke > 0) return 'smoke';
  if (e.intent === 'heavy' && e.stun === 0) return 'defend';
  if (e.intent === 'special' && e.stun === 0 && D.SPECIALS[e.id].status) return 'defend';
  for (const k of ['overload', 'smash', 'aimed', 'blast', 'burst']) if (E.canUse(s, k)) return k;
  return G.attackChoice(s, STYLE);
}
function playLife(s, rng) {
  let deployments = 0;
  while (s.screen !== 'death' && deployments++ < 30) {
    townBot(s);
    const maps = D.MAPS.filter((m) => E.mapUnlocked(s, m)), map = maps[Math.floor(rng() * maps.length)].id;
    E.deploy(s, map, Math.max(...E.mapProgress(s.char, map).insertions), rng);
    let steps = 0;
    while (s.run && s.screen !== 'death' && steps++ < 5000) {
      if (s.screen === 'combat') E.playerAct(s, combatBot(s), rng);
      else if (s.screen === 'victory') E.continueAfterVictory(s, rng);
      else if (s.screen === 'loot') G.lootChoice(s, rng, STYLE);
      else if (s.screen === 'perk') E.choosePerk(s, s.run.perkOffer[0], rng, s.char.perks[0]);
      else if (s.screen === 'event') { const ev = E.eventById(s.event); let best = 0, bestCh = -1; ev.options.forEach((o, i) => { const ch = E.optionAvailable(s, o) ? E.checkChance(s, o.check) : -1; if (ch > bestCh) { bestCh = ch; best = i; } }); E.resolveEvent(s, best, rng); E.nextEncounter(s, rng); }
      else if (s.screen === 'route') { const ch = s.run.choices, st = E.stats(s), low = s.char.hp < st.maxHp * 0.5; const pref = low ? ['rest', 'supply', 'cells', 'cargo', 'event', 'fight', 'elite', 'boss'] : ['cells', 'supply', 'cargo', 'event', 'fight', 'rest', 'elite', 'boss']; E.enterRoom(s, ch.map((k) => pref.indexOf(k)).reduce((b, v, i, arr) => (v < arr[b] ? i : b), 0), rng); }
      else if (s.screen === 'room') E.offerRoute(s, rng);
      else if (s.screen === 'sectorClear') { const st = E.stats(s), next = s.run.sector + 1; const weak = s.char.hp < st.maxHp * 0.5 && s.char.items.stim === 0; if (weak || (E.isBossSector(next) && s.char.hp < st.maxHp * 0.8)) E.endRun(s, 'extracted', rng); else E.pushDeeper(s, rng); }
    }
  }
}
// Every scored raid from every campaign, then 50 picked evenly across the ranking: the bottom rungs are beatable
// in a first evening, the top needs a sector-20 run.
const all = [];
for (let k = 0; k < CAMPAIGNS; k++) {
  const rng = E.seededRng(5000 + k), s = E.newGame(rng);
  const seen = new Set();
  for (let life = 0; life < LIVES; life++) {
    if (life > 0) E.recruit(s, rng); createBot(s, rng); playLife(s, rng);
    for (const e of s.meta.board) if (!seen.has(e)) { seen.add(e); all.push(e); }
  }
}
all.sort((a, b) => b.score - a.score);
const picks = [];
for (let i = 0; i < E.BOARD_SIZE; i++) picks.push(all[Math.min(all.length - 1, Math.round(i * (all.length - 1) / (E.BOARD_SIZE - 1) * 0.6))]);
const out = picks.map((e, i) => ({ ...e, name: `Bot #${i + 1}`, number: 0, bot: true, when: 0 }));
process.stdout.write(JSON.stringify(out) + '\n');
