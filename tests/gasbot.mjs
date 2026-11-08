// The Gas Bot gets high on its own supply: telegraphed below 60% HP, once, then bigger, harder-hitting and worth more.
import * as E from '../engine.js';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };
const rng = E.seededRng(3), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; E.deploy(s, 'garrison', 1, rng);
for (let i = 0; i < 60 && s.screen !== 'combat'; i++) { if (s.screen === 'route') E.enterRoom(s, 0, rng); else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng); }
let e; for (let i = 0; i < 400 && !(e && e.id === 'gasbot'); i++) e = E.makeEnemy(4, false, rng, 'detention');
ok('gas bots spawn able to huff', e.id === 'gasbot' && e.huff === true);
const other = E.makeEnemy(1, false, rng, 'garrison');
ok('other enemies can\u2019t', !other.huff || other.id === 'gasbot');
s.run.enemy = e; e.quirk = null; e.affix = null; e.stun = 0; s.char.hp = 9999;
e.hp = Math.round(e.maxHp * 0.7); e.intent = 'attack';
E.playerAct(s, 'defend', rng, 0);
ok('healthy, it doesn\u2019t huff', e.intent !== 'huff' && !e.huffed);
const before = { max: e.maxHp, atk: e.atk, cr: e.cr[1], xp: e.xp };
e.hp = Math.round(e.maxHp * 0.5);
E.playerAct(s, 'defend', rng, 0);
ok('below 60% it telegraphs the huff', e.intent === 'huff');
E.playerAct(s, 'defend', rng, 0);
ok('then huffs: bigger, harder, worth more', e.huffed && e.maxHp > before.max && e.atk > before.atk && e.cr[1] > before.cr && e.xp > before.xp && /Blazed/.test(e.name), JSON.stringify({ max: e.maxHp, atk: e.atk }));
ok('and gasses more', e.intents.special >= 3);
for (let i = 0; i < 6 && s.screen === 'combat'; i++) { e.hp = Math.round(e.maxHp * 0.3); E.playerAct(s, 'defend', rng, 0); ok(`never twice (${i})`, e.intent !== 'huff'); }
console.log(fails ? `${fails} failed` : 'no errors');
process.exit(fails ? 1 : 0);
