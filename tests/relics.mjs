// Relics: offered by bosses only, never stacked, and what each one does.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); if (!c) fails++; };
const op = (seed = 3) => { const rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; return { s, c: s.char, rng }; };
const toFight = (s, rng) => { for (let i = 0; i < 80 && s.screen !== 'combat'; i++) { if (s.screen === 'route') E.enterRoom(s, 0, rng); else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng); } };
const relics = D.PERKS.filter((p) => p.relic).map((p) => p.id);
ok('eight relics', relics.length === 8);
{ // Offers: never from normal fights; about a third of bosses.
  const { s, rng } = op(); E.deploy(s, 'garrison', 1, rng); let normal = 0, bossHits = 0;
  for (let i = 0; i < 400; i++) { s.run.perkOffer = null; const o = E.__offerPerks ? E.__offerPerks(s, rng, false) : null; if (o && o.some((id) => relics.includes(id))) normal++; }
  for (let i = 0; i < 400; i++) { const o = E.__offerPerks(s, rng, true); if (o.some((id) => relics.includes(id))) bossHits++; }
  ok('normal fights never offer a relic', normal === 0); ok('about a third of bosses do', bossHits > 100 && bossHits < 180, `${bossHits}/400`);
}
{ // Never stacked.
  const { s, c, rng } = op(4); E.deploy(s, 'garrison', 1, rng); s.run.perkOffer = ['echo', 'chit', 'hollow']; s.screen = 'perk'; E.choosePerk(s, 'echo', rng); ok('take a relic', E.hasPerk(c, 'echo') && E.perkStacks(c, 'echo') === 1);
  s.run.perkOffer = ['echo', 'chit', 'hollow']; s.screen = 'perk'; E.choosePerk(s, 'echo', rng); ok('a second copy does nothing', E.perkStacks(c, 'echo') === 1); }
{ const { s, c, rng } = op(5); const hp = E.stats(s).maxHp; c.perks.push('glassheart'); c.perkN = { glassheart: 1 }; ok('Glass Heart: -30% max HP', Math.abs(E.stats(s).maxHp / hp - 0.7) < 0.02); }
{ const { s, c, rng } = op(6); c.perks.push('thirst'); c.perkN = { thirst: 1 }; E.deploy(s, 'garrison', 1, rng); toFight(s, rng); c.items.stim = 2; ok('Red Thirst: no stims', !E.canUse(s, 'stim'));
  c.hp = 10; const before = c.hp; E.playerAct(s, 'shoot', rng); ok('and heals on hits', c.hp > before - 40, `${before} -> ${c.hp}`); }
{ const { s, c, rng } = op(7); c.perks.push('executioner'); c.perkN = { executioner: 1 }; E.deploy(s, 'garrison', 1, rng); toFight(s, rng); const e = s.run.enemy; e.hp = Math.ceil(e.maxHp * 0.2) + 1; e.def = 0;
  let killed = false; for (let i = 0; i < 4 && s.screen === 'combat'; i++) { E.playerAct(s, 'shoot', rng); if (e.hp <= 0) killed = true; } ok('Executioner: a low enemy dies', killed); }
{ // Echo: over many shots, about one in three adds a round.
  const { s, c, rng } = op(8); c.perks.push('echo'); c.perkN = { echo: 1 }; E.deploy(s, 'garrison', 1, rng); toFight(s, rng); s.run.enemy.hp = s.run.enemy.maxHp = 1e6; c.hp = 1e6;
  for (let i = 0; i < 9 && s.screen === 'combat'; i++) E.playerAct(s, 'shoot', rng);
  ok('Echo Chamber fires extra rounds', s.log.filter((l) => /Echo Chamber/.test(l.text || l)).length >= 2); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
