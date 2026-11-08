// Co-op enemy scaling: the same fight is the same size whichever player casts the deciding vote, and it scales with the
// stronger operative. One death mid-fight drops it back to solo size.
import * as E from '../engine.js';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };
function enemyFor(lastVoter, levels = [2, 14], seed = 9) {
  const rng = E.seededRng(seed), s = E.newGame(rng);
  for (const slot of ['char', 'char2']) E.createChar(s, rng, E.newDraft(s.meta, rng), slot);
  s.coop = true; s.char.level = levels[0]; s.char2.level = levels[1]; s.screen = 'town';
  E.deploy(s, 'garrison', 1, rng);
  for (let i = 0; i < 80 && s.screen !== 'combat'; i++) {
    if (s.screen === 'route') { const order = lastVoter === 0 ? [1, 0] : [0, 1]; for (const w of order) E.withActor(s, w, () => E.voteDoor(s, w, 0, rng)); }
    else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng);
  }
  return { s, e: s.run.enemy };
}
const a = enemyFor(0), b = enemyFor(1);
ok('same fight, same size, whoever votes last', a.e.maxHp === b.e.maxHp && a.e.atk === b.e.atk, `${a.e.maxHp}/${a.e.atk} vs ${b.e.maxHp}/${b.e.atk}`);
const lo = enemyFor(0, [2, 2]), hi = enemyFor(0, [2, 14]);
ok('a stronger partner makes it tougher', hi.e.maxHp >= lo.e.maxHp, `${lo.e.maxHp} -> ${hi.e.maxHp}`);
// One dies: the fight drops back to solo size.
{ const { s, e } = enemyFor(0); const full = e.maxHp, rng = E.seededRng(4);
  E.withActor(s, 0, () => { s.char.hp = 1; }); e.atk = 99999; e.intent = 'attack'; e.intents = { attack: 1 };
  let dropped = false;
  for (let i = 0; i < 30 && s.run && s.screen === 'combat'; i++) { E.charAt(s, 1).hp = 99999; if (E.charAt(s, 0).downed) E.charAt(s, 0).downed = 1; E.playerAct(s, 'defend', rng, s.run.actor); if (s.run && s.run.fallen) { dropped = e.maxHp < full; break; } }
  ok('a death drops the fight back to solo size', dropped || e.maxHp < full, `${full} -> ${e.maxHp}`); }
console.log(fails ? `${fails} failed` : 'no errors');
process.exit(fails ? 1 : 0);
