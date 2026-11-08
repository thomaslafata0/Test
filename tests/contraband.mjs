// The newer contraband pieces each do what they say.
import * as E from '../engine.js';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };
const fight = (seed, perks = {}) => {
  const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town';
  s.char.perks = Object.keys(perks); s.char.perkN = { ...perks };
  E.deploy(s, 'garrison', 1, rng);
  for (let i = 0; i < 60 && s.screen !== 'combat'; i++) { if (s.screen === 'route') E.enterRoom(s, 0, rng); else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng); }
  const e = s.run.enemy; s.startStun = e.stun; e.hp = e.maxHp = 100000; e.quirk = null; e.affix = null; e.stun = 0; e.def = 0;
  return { s, rng, e };
};
{ const a = fight(1), b = fight(1, { rangefinder: 3 }); ok('Rangefinder: more Shoot damage', E.attackRange(b.s, false)[1] > E.attackRange(a.s, false)[1]); }
{ const a = fight(2), b = fight(2, { knuckles: 3 }); ok('Brass Knuckles: more Strike damage', E.attackRange(b.s, true)[1] > E.attackRange(a.s, true)[1]); }
{ const a = fight(3), b = fight(3, { pockets: 2 }); ok('Hidden Pockets: carry more', E.stats(b.s).carry > E.stats(a.s).carry); }
{ const a = fight(4), b = fight(4, { stimsling: 2 }); ok('Stim Sling: stims heal more', E.stats(b.s).stimBoost > E.stats(a.s).stimBoost); }
{ const { s, rng } = fight(5, { siphon: 3 }); s.char.hp = 10; s.run.enemy.intent = 'guard'; s.run.enemy.intents = { guard: 1 }; const before = s.char.hp; E.playerAct(s, 'shoot', rng, 0); ok('Siphon Rounds: hitting heals', s.char.hp > before, `${before} -> ${s.char.hp}`); }
{ let stunned = 0; for (let i = 0; i < 60; i++) { const { s } = fight(100 + i, { flashbang: 3 }); if (s.startStun > 0) stunned++; } ok('Flashbang Rig: sometimes starts stunned', stunned > 5 && stunned < 55, `${stunned}/60`); }
{ const { s, rng, e } = fight(6, { riposte: 3 }); e.atk = 5; e.intent = 'attack'; e.intents = { attack: 1 }; s.char.hp = 9999; let hit = false;
  for (let i = 0; i < 12 && !hit; i++) { const hp = e.hp; E.playerAct(s, 'defend', rng, 0); if (e.hp < hp) hit = true; } ok('Riposte: defending hits back', hit); }
console.log(fails ? `${fails} failed` : 'no errors');
process.exit(fails ? 1 : 0);
