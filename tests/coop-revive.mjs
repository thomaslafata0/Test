// Co-op rules without a browser: going down, reviving, bleeding out, the last-stand rule, votes and separate rewards.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0;
const ok = (name, v, extra = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!v) fails++; };
function game(seed = 7) {
  const rng = E.seededRng(seed), s = E.newGame(rng);
  s.coop = true;
  E.createChar(s, rng); E.createChar(s, rng, E.newDraft(s.meta, rng), 'char2');
  E.deploy(s, 'garrison', 1, rng);
  return { s, rng };
}
function fight(s, rng) {
  s.run.room = 0; s.run.choices = ['fight', 'fight'];
  E.enterRoom(s, 0, rng);
  const e = s.run.enemy;
  e.hp = e.maxHp = 100000; e.atk = 0; e.quirk = null; e.affix = null; e.intent = 'attack'; e.stun = 0;
  s.run.actor = 0; s.run.acted = {};
  return e;
}
const actor = (s) => s.run.actor;
{ // Down, turn passes, revive
  const { s, rng } = game(), e = fight(s, rng);
  E.playerAct(s, 'defend', rng, 0);
  s.char2.hp = 1; e.atk = 100000; e.intent = 'attack';
  s.run.actor = 1; s.run.acted = { 0: true };
  for (let i = 0; i < 10 && !s.char2.downed && !s.char.downed; i++) { E.playerAct(s, 'defend', rng, s.run.actor); s.char.hp = 500; s.char2.hp = s.char2.downed ? 0 : 1; }
  const down = s.char2.downed ? s.char2 : s.char, idx = down === s.char2 ? 1 : 0, other = 1 - idx;
  ok('going to 0 HP in co-op downs instead of kills', down.downed > 0 && !down.dead && !!s.run, `bleed ${down.downed}`);
  ok('only the standing player acts', actor(s) === other);
  ok('standing player can revive', E.withActor(s, other, () => E.canUse(s, 'revive')));
  ok('downed player cannot act', (() => { const t = s.run.round; E.playerAct(s, 'shoot', rng, idx); return s.run.round === t && down.downed > 0; })());
  e.atk = 0; e.intent = 'attack';
  E.playerAct(s, 'revive', rng, other);
  const mx = E.statsOf(s.meta, down).maxHp;
  ok('revive restores some HP', !down.downed && down.hp === Math.round(mx * E.TUNE.reviveHp), `${down.hp}/${mx}`);
  ok('actor swap never leaks', !s.actorIdx);
}
{ // Bleeding out: the survivor still has to get out of the fight
  const { s, rng } = game(11), e = fight(s, rng);
  s.char2.hp = 0; s.char2.downed = 2; s.run.actor = 0; e.atk = 0; e.hp = e.maxHp = 100000;
  const before = e.maxHp;
  for (let i = 0; i < 6 && s.run && !s.run.fallen; i++) { s.char.hp = 500; E.playerAct(s, 'defend', rng, 0); }
  ok('a bleed-out does not end the raid by itself', !!s.run && s.run.fallen && s.run.fallen.idx === 1 && s.char2.dead && s.screen === 'combat');
  ok('the enemy drops back to one-player strength', e.maxHp < before, `${before} -> ${e.maxHp}`);
  e.hp = 1; e.def = 0; let n = 0;
  while (s.screen === 'combat' && n++ < 20) E.playerAct(s, s.run.actor === 0 ? 'shoot' : 'defend', rng, s.run.actor);
  for (let i = 0; i < 6 && s.run; i++) { if (s.screen === 'loot' || s.screen === 'perk') { E.withActor(s, 0, () => { if (s.run.lootOffer) E.leaveLoot(s, rng); else E.choosePerk(s, '', rng); }); } E.continueAfterVictory(s, rng); }
  ok('winning alone takes the survivor home', !s.run && !!s.char && !s.char2 && s.coopFallen && s.coopFallen.idx === 1, `${s.screen}`);
}
{ // Running alone
  const { s, rng } = game(12), e = fight(s, rng);
  s.char2.hp = 0; s.char2.downed = 2; s.run.actor = 0; e.atk = 0; e.boss = false; e.hp = e.maxHp = 100000; s.char.credits += 100;
  for (let i = 0; i < 40 && s.run && s.char; i++) { s.char.hp = 500; E.playerAct(s, s.run.fallen ? 'run' : 'defend', rng, 0); }
  ok('running alone gets out and clears the dead partner', !s.run && !!s.char && !s.char2 && s.coopFallen && s.coopFallen.idx === 1 && s.screen !== 'death');
}
{ // The survivor falls too
  const { s, rng } = game(14), e = fight(s, rng);
  s.char2.hp = 0; s.char2.downed = 2; s.run.actor = 0; e.atk = 0; e.hp = e.maxHp = 100000;
  for (let i = 0; i < 6 && !s.run.fallen; i++) { s.char.hp = 500; E.playerAct(s, 'defend', rng, 0); }
  e.atk = 100000; e.intent = 'attack'; e.stun = 0; s.char.hp = 1;
  for (let i = 0; i < 12 && s.run; i++) { s.char.hp = 1; e.intent = 'attack'; e.stun = 0; E.playerAct(s, 'shoot', rng, 0); }
  ok('dying after your partner is a wipe', !s.run && s.char.dead && !s.char2 && s.screen === 'death' && s.outcome.wipe && s.coopFallen.idx === 1 && s.coopFallen.record.wipe, s.screen);
}
{ // Last stand: you fall while your partner is down
  const { s, rng } = game(13), e = fight(s, rng);
  s.char2.hp = 0; s.char2.downed = 3; s.run.actor = 0; e.atk = 100000; e.intent = 'attack'; e.hp = e.maxHp = 100000; s.char.hp = 1;
  for (let i = 0; i < 6 && s.run; i++) { if (s.char) s.char.hp = 1; e.intent = 'attack'; e.stun = 0; E.playerAct(s, 'shoot', rng, 0); }
  ok('falling while your partner is down is a wipe', !s.run && s.char.dead && !s.char2 && s.screen === 'death' && s.outcome.wipe, s.screen);
}
{ // Third down in a raid is fatal
  const { s, rng } = game(17), e = fight(s, rng);
  s.run.downs = { 1: E.TUNE.downsPerRaid }; s.char2.hp = 1; s.run.actor = 0; e.atk = 100000; e.intent = 'attack';
  for (let i = 0; i < 12 && s.run && s.char2 && !s.char2.dead; i++) { s.char.hp = 100000; if (s.char2.hp > 0) s.char2.hp = 1; E.playerAct(s, 'defend', rng, s.run.actor); e.intent = 'attack'; e.stun = 0; }
  ok('out of downs: the next one is fatal', !s.char2 || s.char2.dead);
}
{ // Win revives and pays the downed partner
  const { s, rng } = game(19), e = fight(s, rng);
  s.char2.hp = 0; s.char2.downed = 2; s.run.actor = 0; e.hp = 1; e.def = 0; const cr = s.char2.credits;
  for (let i = 0; i < 12 && s.screen === 'combat'; i++) { s.char.hp = 500; e.hp = 1; E.playerAct(s, 'shoot', rng, 0); }
  ok('winning gets the partner up and paid', s.char2 && !s.char2.downed && s.char2.hp > 0 && s.char2.credits > cr, `hp ${s.char2 && s.char2.hp}`);
}
{ // Each player has their own rewards
  const { s, rng } = game(23);
  s.run.lootOffer = E.rollGear(rng, { tierMin: 1, tierMax: 1, odds: { common: 1 } });
  s.run.cb[1].lootOffer = E.rollGear(rng, { tierMin: 1, tierMax: 1, odds: { common: 1 } });
  s.run.cb[1].perkOffer = D.PERKS.slice(0, 3).map((p) => p.id);
  s.screen = 'loot';
  E.leaveLoot(s, rng);
  ok('host done, friend still choosing: raid waits', s.screen === 'loot' && E.rewardsPending(s));
  E.withActor(s, 1, () => { ok('friend sees their own loot', !!s.run.lootOffer); E.leaveLoot(s, rng); ok('then their own contraband', !!s.run.perkOffer); });
  const pk = D.PERKS[0].id;
  E.choosePerk(s, pk, rng, null, 1);
  ok('friend got the contraband, host did not', s.char2.perks.includes(pk) && !s.char.perks.includes(pk));
  ok('everyone done: raid moves on', s.screen === 'route' && !E.rewardsPending(s), s.screen);
}
{ // Votes
  const { s, rng } = game(29);
  s.run.choices = ['fight', 'fight']; s.run.room = 0; s.screen = 'route';
  ok('one vote does not move', E.voteDoor(s, 0, 1, rng) === false && s.screen === 'route');
  ok('changing your vote is allowed', E.voteDoor(s, 0, 0, rng) === false && s.run.votes[0] === 0);
  ok('second vote enters', E.voteDoor(s, 1, 1, rng) === true && s.screen !== 'route');
  const g2 = game(31);
  ok('exit needs agreement', E.voteExit(g2.s, 0, 'extract') === null && E.voteExit(g2.s, 1, 'deeper') === null);
  ok('exit agreed', E.voteExit(g2.s, 0, 'deeper') === 'deeper');
}
console.log(fails ? `${fails} FAILED` : 'no errors');
process.exit(fails ? 1 : 0);
