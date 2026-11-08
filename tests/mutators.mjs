// Mutators: locked until a district is free, picked on the cell, applied on deploy, and each one's rule.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); if (!c) fails++; };
const op = (seed = 3) => { const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; return { s, c: s.char, rng }; };
const toFight = (s, rng) => { for (let i = 0; i < 80 && s.screen !== 'combat'; i++) { if (s.screen === 'route') E.enterRoom(s, 0, rng); else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng); } };
{ const { s } = op(); ok('locked before a district is free', !E.mutatorsOpen(s) && !E.toggleMutator(s, 'hardened')); s.meta.liberated.garrison = 1; ok('open after', E.toggleMutator(s, 'hardened') && s.meta.mutPick.includes('hardened')); E.toggleMutator(s, 'hardened'); ok('and toggles off', !s.meta.mutPick.length); }
// Enemy HP and ATK.
{ const a = op(5), b = op(5);
  b.s.meta.liberated.garrison = 1; for (const id of ['hardened', 'vicious']) E.toggleMutator(b.s, id);
  E.deploy(a.s, 'garrison', 1, a.rng); E.deploy(b.s, 'garrison', 1, b.rng); toFight(a.s, a.rng); toFight(b.s, b.rng);
  const ea = a.s.run.enemy, eb = b.s.run.enemy;
  ok('Hardened: +25% HP', ea && eb && ea.id === eb.id && Math.abs(eb.maxHp / ea.maxHp - 1.25) < 0.03, `${ea && ea.maxHp} -> ${eb && eb.maxHp}`);
  ok('Vicious: +20% ATK', Math.abs(eb.atk / ea.atk - 1.2) < 0.08, `${ea.atk} -> ${eb.atk}`);
  ok('the raid lists them', JSON.stringify(b.s.run.mutators) === '["hardened","vicious"]'); }
// Glass, Dry, Grounded.
{ const { s, c, rng } = op(7); s.meta.liberated.garrison = 1; const hp0 = E.stats(s).maxHp;
  for (const id of ['glass', 'dry', 'grounded']) E.toggleMutator(s, id);
  E.deploy(s, 'garrison', 1, rng); ok('Glass Jaw: -25% max HP', Math.abs(E.stats(s).maxHp / hp0 - 0.75) < 0.02, `${hp0} -> ${E.stats(s).maxHp}`);
  toFight(s, rng); c.items.stim = 2; ok('Dry Run: no stims', !E.canUse(s, 'stim'));
  E.endRun(s, 'extracted', rng); ok('max HP back after the raid', E.stats(s).maxHp === hp0); }
// One Way Out and Blackout.
{ const { s, rng } = op(8); s.meta.liberated.garrison = 1; E.toggleMutator(s, 'oneway'); E.toggleMutator(s, 'blackout');
  E.deploy(s, 'garrison', 1, rng); ok('One Way Out: no extract mid-district', !E.extractAllowed(s) && E.attemptExtract(s, rng) === false && s.run);
  s.run.sector = 5; ok('fine after a boss', E.extractAllowed(s)); ok('Blackout: no safe extract', !E.extractAllowed(s, true) && E.safeExtract(s, rng) === false && s.run); }
// Score and Resolve.
{ const a = op(9), b = op(9); b.s.meta.liberated.garrison = 1; for (const id of ['hardened', 'vicious', 'glass']) E.toggleMutator(b.s, id); a.s.meta.liberated.garrison = 1;
  for (const { s, rng } of [a, b]) { E.deploy(s, 'garrison', 1, rng); for (let k = 0; k < 4; k++) { s.run.sector = k + 1; E.clearSector(s, rng); } }
  const sa = E.careerScore(a.c), sb = E.careerScore(b.c);
  ok('mutators raise the score (+55%)', Math.abs(sb / sa - 1.55) < 0.02, `${sa} vs ${sb}`);
  const before = E.careerScore(b.c); E.deploy(b.s, 'garrison', 1, b.rng); for (let k = 0; k < 4; k++) { b.s.run.sector = k + 1; E.clearSector(b.s, b.rng); }
  ok('replaying the same ground adds nothing', E.careerScore(b.c) === before, `${before} -> ${E.careerScore(b.c)}`); }
{ const { s, rng } = op(11); s.meta.liberated.garrison = 1; for (const id of D.MUTATORS.map((x) => x.id)) E.toggleMutator(s, id); const r0 = s.meta.resolve; E.deploy(s, 'garrison', 1, rng); for (let k = 1; k <= 3; k++) { s.run.sector = k; E.clearSector(s, rng); } ok('and pay extra Resolve', s.meta.resolve - r0 > 3, `+${s.meta.resolve - r0} for 3 sectors`); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
