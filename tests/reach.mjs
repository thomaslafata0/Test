// Halcyon Reach, the endgame map: unlocks after the other four, gates Threat I behind it, and every new boss plays out.
// Also the endgame Resolve tiers, E-Girl cures and the extraction bribe.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };
const op = (seed = 1) => { const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town'; return { s, rng, c: s.char }; };
const free = (c, maps, t = 0) => { for (const m of maps) { const p = E.mapProgress(c, m); if (t === 0) p.deepest = 20; p.best = { ...(p.best || {}), [t]: 20 }; } };
const reach = D.MAPS.find((m) => m.id === 'reach');
{ const { s, c } = op();
  ok('Halcyon Reach is locked at first', !E.mapUnlocked(s, reach));
  free(c, ['garrison', 'foundry', 'detention']);
  ok('still locked with three districts free', !E.mapUnlocked(s, reach));
  free(c, ['port']);
  ok('opens once the other four are free', E.mapUnlocked(s, reach));
  ok('no Threat I with four free', E.maxThreat(s) === 0);
  free(c, ['reach']);
  ok('all five free: escaped, and back in at Threat I', E.escapedAt(c) && E.maxThreat(s) === 0 && E.returnHigher(s) && E.maxThreat(s) === 1);
  free(c, D.MAPS.map((m) => m.id), 1);
  ok('all five free at Threat I: back in at Threat II', E.escapedAt(c) && E.returnHigher(s) && E.maxThreat(s) === 2); }
// Endgame Resolve tiers.
{ const { s } = op(2); const m = s.meta; m.resolve = 9999; m.training.hp = 20;
  ok('training stops at 20 before the endgame', !E.train(s, 'hp'));
  m.cellLv = { stash: 4 }; m.cell = ['stash'];
  ok('endgame cell levels are locked before', !E.buyCell(s, 'stash'));
  m.endgame = true;
  ok('and open after: training past 20', E.train(s, 'hp') && m.training.hp === 21);
  ok('and the fifth stash level', E.buyCell(s, 'stash') && E.cellLevel(m, 'stash') === 5); }
// The endgame flag is set when someone reaches Threat I.
{ const { s, c, rng } = op(3); free(c, D.MAPS.map((x) => x.id)); E.deploy(s, 'garrison', 1, rng); E.endRun(s, 'extracted', rng); ok('reaching Threat I opens the endgame for the cell', s.meta.endgame === true); }
// Enemies are tougher than the Port at the same sector, and the bosses play out without errors.
{ const rng = E.seededRng(4);
  const port = E.makeEnemy(10, true, rng, 'port'), here = E.makeEnemy(10, true, rng, 'reach');
  ok('a Reach boss is tougher than the Port\u2019s at the same sector', here.maxHp > port.maxHp && here.atk > port.atk, `${port.maxHp}/${port.atk} vs ${here.maxHp}/${here.atk}`);
  for (const [i, sec] of [[0, 5], [1, 10], [2, 15], [3, 20]]) {
    const { s, c } = op(10 + i); free(c, ['garrison', 'foundry', 'detention', 'port']);
    const L = E.insertionsAt(c, 'reach', 0); if (!L.includes(sec)) L.push(sec);
    const r2 = E.seededRng(20 + i); E.deploy(s, 'reach', sec, r2);
    for (let k = 0; k < 80 && s.screen !== 'combat'; k++) { if (s.screen === 'route') { const b = s.run.choices.indexOf('boss'); E.enterRoom(s, b >= 0 ? b : 0, r2); } else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, r2, 0); E.offerRoute(s, r2); } else E.offerRoute(s, r2); }
    const want = reach.bosses[i];
    if (!s.run.enemy || !s.run.enemy.boss) { const e = E.makeEnemy(sec, true, r2, 'reach'); s.run.enemy = e; }
    const e = s.run.enemy; e.hp = e.maxHp = 900; e.def = 0; let threw = null, turns = 0, sigs = new Set(), storms = 0;
    try { for (; turns < 400 && s.screen === 'combat' && s.run && s.run.enemy === e; turns++) { c.hp = 1e6; if (e.sig) sigs.add(e.sig.id); const before = (s.log || []).length; E.playerAct(s, E.autoAction(s, {}), r2, 0); if ((s.log || []).slice(before).some((l) => /spore storm/.test(l.text))) storms++; } } catch (x) { threw = x; }
    ok(`${e.name} (${e.id === want ? 'right boss' : 'boss ' + e.id}) plays out`, !threw && e.hp <= 0 && sigs.size >= 1, threw ? threw.stack.split('\n').slice(0, 3).join(' ') : `${turns} turns, moves ${[...sigs].join(',')}, storms ${storms}`);
  } }
// E-Girl: a good night can cure an old bad mark.
{ let cured = 0;
  for (let i = 0; i < 300; i++) { const { s, c, rng } = op(100 + i); c.credits = 9999; c.fav = { cha: -2, def: -1 }; const r = E.visitLounge(s, 'vex', rng); if (r && r.cured) cured++; }
  ok('about a quarter of good nights cure a bad mark', cured > 25 && cured < 110, `${cured}/300 visits`); }
// Extraction bribe.
{ let took = 0, failed = 0;
  for (let i = 0; i < 400; i++) { const { s, c, rng } = op(500 + i); c.perks = ['chit']; c.perkN = { chit: 2 }; E.deploy(s, 'garrison', 1, rng); s.run.sector = 4;
    const before = c.perkN.chit; E.attemptExtract(s, rng); if (s.lastResult && /Extraction failed/.test(s.lastResult.name)) { failed++; if ((c.perkN.chit || 0) < before) took++; } }
  ok('a failed extraction sometimes costs a contraband bribe', failed > 20 && took > 0 && took < failed, `${took} bribes in ${failed} failures`); }
console.log(fails ? `${fails} failed` : 'no errors');
process.exit(fails ? 1 : 0);
