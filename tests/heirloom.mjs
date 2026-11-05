// Heirloom after an orbit death: what qualifies, the auto-pick, and how it meets the Weapons Cache. Run: node tests/heirloom.mjs
import * as E from '../engine.js';
function run(label, setup) {
  const rng = E.seededRng(7), s = E.newGame(rng); s.meta.cell.push('heirloom'); setup(s);
  Object.assign(s.meta, { orbitWins: 2, orbitTierWins: { low: 1, mid: 1 } }); Object.assign(s.meta.ship, { hull: 2, guns: 2, shields: 2, engines: 2 }); E.createChar(s, rng);
  if (label.includes('upg')) s.char.gear.ranged = { ...s.char.gear.ranged, level: 2 };
  E.orbitStart(s, 'high', rng); let n = 0; while (s.orbit && !s.orbit.over && n++ < 80) E.orbitAct(s, 'fire', rng);
  E.orbitClose(s);
  console.log(label, s.screen, 'choices', E.heirloomChoices(s).map(([sl, it]) => sl + ':' + it.base + '+' + (it.level||0)).join(','), 'auto', s.meta.heirloom && E.itemName(s.meta.heirloom));
  const r2 = E.seededRng(9); const d = E.newDraft(s.meta, r2); s.draft = d; E.createChar(s, r2); console.log('  next:', s.notice, '| ranged', E.itemName(s.char.gear.ranged));
}
run('stock', () => {});
run('stock+cache', (s) => s.meta.cell.push('cache'));
run('upg+cache', (s) => s.meta.cell.push('cache'));
run('upg', () => {});
