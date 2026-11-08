// District tactics: each of the first four districts' ordinary enemies has its own move, and Defend or a Strike answers it.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); if (!c) fails++; };
function setup(map, intent, seed = 3) {
  const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town';
  const m = D.MAPS.find((x) => x.id === map); for (const [id, n] of Object.entries(m.unlock || {})) E.mapProgress(s.char, id).deepest = n;
  E.deploy(s, map, 1, rng);
  for (let i = 0; i < 80 && s.screen !== 'combat'; i++) { if (s.screen === 'route') E.enterRoom(s, 0, rng); else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng); }
  const e = s.run.enemy; e.hp = e.maxHp = 5000; e.intent = intent; e.next = 'attack'; s.char.hp = E.stats(s).maxHp;
  return { s, rng, e, c: s.char };
}
for (const [map, t] of Object.entries(E.MAP_TACTIC)) { const { s } = setup(map, 'attack'); ok(`${map} enemies can use ${t}`, (s.run.enemy.intents[t] || 0) > 0 && !!D.INTENTS[t]); }
{ const { s, rng, e } = setup('garrison', 'radio'); const def = e.def, a0 = s.run.alert; E.playerAct(s, 'shoot', rng); ok('radio: alarm up, enemy digs in', s.run.alert > a0 && e.def === def + 1, `alert ${a0}->${s.run.alert} def ${def}->${e.def}`); }
{ const { s, rng, e } = setup('garrison', 'radio', 4); const def = e.def; E.playerAct(s, 'strike', rng); ok('a Strike knocks the radio away', e.def === def || e.def === def - 1); }
{ const { s, rng, c } = setup('foundry', 'slag'); const hp = c.hp; E.playerAct(s, 'shoot', rng); ok('slag: hurts and burns', c.hp < hp && s.run.pst.burn > 0); }
{ const { s, rng } = setup('foundry', 'slag', 5); E.playerAct(s, 'defend', rng); ok('Defend: no burn', !s.run.pst.burn); }
{ const { s, rng } = setup('detention', 'shackle'); E.playerAct(s, 'shoot', rng); ok('shackle: Shaken', s.run.pst.shaken > 0); }
{ const { s, rng } = setup('port', 'flare'); E.playerAct(s, 'shoot', rng); ok('flare: Exposed and the next sniper shot is sure', s.run.pst.exposed > 0); const before = s.log.length; E.playerAct(s, 'shoot', rng); ok('the sniper fires', s.log.slice(before).some((l) => /sniper/i.test(l.text || l))); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
