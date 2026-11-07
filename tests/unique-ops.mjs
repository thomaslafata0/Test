// The two unique operatives: unlocks, the Dealer's deck and Pick a Card, the Ghost's armour and Overhaul.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0;
const ok = (name, v, extra = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!v) fails++; };
const bg = (id) => D.BACKGROUNDS.find((b) => b.id === id);
function fightAs(id, seed, enemyTag) {
  const rng = E.seededRng(seed), s = E.newGame(rng), d = E.newDraft(s.meta, rng);
  s.meta.wheel = { best: 250 }; s.meta.liberated = { foundry: true };
  d.background = id; E.createChar(s, rng, d); s.screen = 'town';
  E.deploy(s, 'garrison', 1, rng); E.offerRoute(s, rng);
  for (let i = 0; i < 40 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, Math.max(0, s.run.choices.indexOf('fight')), rng); else E.offerRoute(s, rng); }
  const e = s.run.enemy; e.hp = e.maxHp = 5000; e.stun = 0; e.intent = 'attack'; e.quirk = null;
  if (enemyTag && !e.tags.includes(enemyTag)) e.tags = [...e.tags.filter((t) => t !== 'human' && t !== 'beast'), enemyTag];
  s.char.hp = 9999;
  return { s, rng, e, c: s.char };
}
// Unlocks.
{ const rng = E.seededRng(1), s = E.newGame(rng);
  ok('both start locked', !E.bgUnlocked(s.meta, bg('dealer')) && !E.bgUnlocked(s.meta, bg('ghost')));
  const d = E.newDraft(s.meta, rng); d.background = 'dealer'; E.createChar(s, rng, d);
  ok('a locked pick falls back to a regular class', s.char.background === 'foundry');
  s.meta.wheel = { best: 100 }; ok('a big wheel win opens the Dealer', E.bgUnlocked(s.meta, bg('dealer')));
  s.meta.liberated = { foundry: true }; ok('freeing the Foundry opens the Ghost', E.bgUnlocked(s.meta, bg('ghost'))); }
// The Dealer.
{ const { s, rng, e, c } = fightAs('dealer', 3);
  ok('the Dealer starts with the deck', c.gear.ranged && c.gear.ranged.base === 'deck' && E.skillsOf(c)[0] === 'pickcard');
  ok('a fight starts with a cut and a showing suit', ['red', 'black', 'face'].includes(s.run.card) && ['hearts', 'spades', 'diamonds'].includes(s.run.suit), `${s.run.card} ${s.run.suit}`);
  for (const suit of ['hearts', 'spades', 'diamonds']) {
    s.run.cooldowns.pickcard = 0; s.run.suit = suit; e.stun = 0; e.intent = 'attack'; const cr = c.credits, hp = e.hp;
    E.playerAct(s, 'pickcard', rng, 0);
    const said = s.log.map((l) => l.text).join(' '), okSuit = suit === 'hearts' ? /stunned/.test(said) : suit === 'spades' ? (e.st.bleed || 0) > 0 : c.credits > cr;
    ok(`Pick a Card, ${suit}`, e.hp < hp && okSuit && ['hearts', 'spades', 'diamonds'].includes(s.run.suit));
    e.stun = 0;
  }
}
{ const { s, c } = fightAs('dealer', 9); s.run.card = 'black'; c.fightGuard = 0.85;
  ok('a black card cuts the damage taken', c.fightGuard < 1); }
// The Ghost.
{ const { s, rng, e, c } = fightAs('ghost', 4, 'droid');
  ok('the Ghost takes less from droids', c.fightGuard === 0.8 || (s.run.enemy.tags.includes('droid') === false));
  e.def = 6; const atk = e.atk;
  E.playerAct(s, 'strike', rng, 0); ok('a Strike cracks armour', e.def === 5, `${e.def}`);
  s.run.cooldowns.overhaul = 0; c.hp = 10; e.intent = 'attack';
  E.playerAct(s, 'overhaul', rng, 0); const healed = /Overhaul.*\+[1-9][0-9]* HP/.test(s.log.map((l) => l.text).join(' '));
  ok('Overhaul heals and rips ATK from a droid', healed && e.atk < atk, `${atk}>${e.atk}`);
  ok('auto battle uses the signature skill', E.autoAction(s) !== undefined); }
console.log(fails ? `${fails} failed` : 'no errors');
process.exit(fails ? 1 : 0);
