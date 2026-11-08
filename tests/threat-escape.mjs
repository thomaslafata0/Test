// Escaping: free all five districts with one operative, the escape is flagged, then back in one threat level higher.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0; const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); if (!ok) fails++; };
export function escapedCell(seed = 5) {
  const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; const c = s.char;
  for (const m of D.MAPS) { const p = E.mapProgress(c, m.id); p.deepest = m.id === 'reach' ? 19 : 20; p.best = { 0: p.deepest }; p.insertions = [1, 5, 10, 15, 20]; if (m.id !== 'reach') p.freed = true; }
  c.level = 30; c.hp = E.stats(s).maxHp = E.stats(s).maxHp;
  return { s, rng };
}
const { s, rng } = escapedCell();
E.deploy(s, 'reach', 20, rng);
for (let n = 0; n < 400 && s.run && !s.escape; n++) {
  const sc = s.screen;
  if (sc === 'combat') { s.char.hp = 99999; s.run.enemy.hp = Math.min(s.run.enemy.hp, 1); s.run.enemy.phase2 = true; E.playerAct(s, 'shoot', rng, 0); }
  else if (sc === 'victory' || sc === 'loot' || sc === 'perk') { s.run.lootOffer = null; s.run.perkOffer = null; E.continueAfterVictory(s, rng); }
  else if (sc === 'sectorClear') E.pushDeeper(s, rng);
  else if (sc === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); }
  else if (sc === 'room') E.offerRoute(s, rng);
  else if (sc === 'route') { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); }
  else break;
}
check('beating the last boss with every district free flags the escape', !!s.escape && s.escape.threat === 0, JSON.stringify({ esc: s.escape, scr: s.screen, sec: s.run && s.run.sector }));
check('no going back in mid-raid', !E.returnHigher(s));
s.run = null; s.screen = 'town';
check('back in at Threat I', E.returnHigher(s) && s.char.threat === 1 && !s.escape);
check('every district starts over from sector 1', D.MAPS.every((m) => s.char.maps[m.id].deepest === 0 && E.insertionsAt(s.char, m.id, 1).join() === '1'));
check('only the Garrison is open again', D.MAPS.filter((m) => E.mapUnlocked(s, m)).map((m) => m.id).join() === 'garrison');
check('the old clears still count on the board', E.careerScore(s.char) > 0 && s.char.maps.reach.best[0] >= 20, JSON.stringify(s.char.maps.reach.best) + ' ' + E.careerScore(s.char));
check('gear goes to +10 now', E.upgradeMax(E.opThreat(s.char)) === 10);
E.deploy(s, 'garrison', 1, rng);
check('the raid runs at Threat I', s.run.threat === 1 && s.meta.threat === 1);
const e0 = E.makeEnemy(1, false, E.seededRng(2), 'garrison', 0), e1 = E.makeEnemy(1, false, E.seededRng(2), 'garrison', 1);
check('Threat I enemies are much tougher', e1.hp > e0.hp * 8, `${e0.hp} -> ${e1.hp}`);
let p = 0; for (let i = 0; i < 400; i++) { const r2 = E.seededRng(i), g = E.newGame(r2); E.createChar(g, r2); g.char.threat = 1; E.deploy(g, 'garrison', 1, r2); for (let k = 0; k < 30 && g.screen !== 'combat'; k++) { if (g.run.choices && g.run.choices.length) { const j = g.run.choices.findIndex((x) => x === 'fight'); E.enterRoom(g, Math.max(0, j), r2); } else E.offerRoute(g, r2); if (['event', 'room'].includes(g.screen)) { g.screen = 'route'; g.run.choices = null; } } if (g.run && g.run.enemy && g.run.enemy.id === 'pursuer') p++; }
check('Pursuers turn up at Threat I', p > 10 && p < 160, `${p}/400`);
check('Manhunt only comes up at Threat I and above', !D.BULLETINS.find((b) => b.id === 'manhunt').minThreat === false);
console.log(fails ? 'FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
