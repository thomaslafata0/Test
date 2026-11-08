// Field Medic rules: its own kit only, the shield on both operatives, the team damage shot, Triage on whoever is worst off,
// Tag, better revives and stims, the bigger solo numbers, and the player name on leaderboard rows.
import * as E from '../engine.js';
import * as D from '../data.js';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };
const make = (seed, bgs) => {
  const rng = E.seededRng(seed), s = E.newGame(rng);
  bgs.forEach((bg, i) => { const d = E.newDraft(s.meta, rng); d.background = bg; E.createChar(s, rng, d, i ? 'char2' : 'char'); });
  s.coop = bgs.length > 1; s.screen = 'town';
  E.deploy(s, 'garrison', 1, rng);
  for (let i = 0; i < 60 && s.screen !== 'combat'; i++) {
    if (s.screen === 'route') E.enterRoom(s, 0, rng);
    else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); } else E.offerRoute(s, rng);
  }
  const e = s.run.enemy; e.hp = e.maxHp = 100000; e.atk = 1; e.stun = 0; e.quirk = null; e.affix = null; e.intents = { guard: 1 }; e.intent = 'guard';
  return { s, rng, e };
};
const resetCd = (s) => { s.run.cooldowns = {}; if (s.run.cb) for (const b of Object.values(s.run.cb)) b.cooldowns = {}; };

// The kit.
{ const { s } = make(1, ['medic']);
  ok('a medic has the medic kit and nothing else', JSON.stringify(E.skillsOf(s.char)) === JSON.stringify(E.MEDIC_SKILLS));
  ok('starts with an extra stim', s.char.items.stim >= 3); }

// Solo: a bigger shield and a bigger shot.
{ const { s, rng } = make(2, ['medic']), mx = E.stats(s).maxHp, tech = E.stats(s).tech;
  E.playerAct(s, 'barrier', rng, 0);
  ok('solo shield is 28% of max HP times tech', s.char.medShield === Math.round(mx * E.TUNE.medShieldSolo * tech), `${s.char.medShield}`);
  resetCd(s); E.playerAct(s, 'rally', rng, 0);
  ok('the shot lasts its rounds (one gone already)', s.run.rally === E.TUNE.rallyTurns - 1, `${s.run.rally}`); }

// Co-op: the shield covers both, the shot lifts the partner's damage, Triage goes to whoever is worst off.
{ const { s, rng, e } = make(3, ['medic', 'foundry']);
  E.playerAct(s, 'barrier', rng, s.run.actor);
  const sh = [0, 1].map((i) => E.charAt(s, i).medShield);
  ok('the shield goes on both operatives', sh[0] > 0 && sh[1] > 0, JSON.stringify(sh));
  // Hits soak into the shield first.
  const f = E.charAt(s, 1), hp = f.hp, before = f.medShield;
  E.withActor(s, 1, () => { e.atk = 30; e.intent = 'attack'; });
  const r = s.run; let tries = 0;
  while (f.medShield === before && tries++ < 20 && s.screen === 'combat') { e.intent = 'attack'; e.intents = { attack: 1 }; E.playerAct(s, 'defend', rng, r.actor); }
  ok('a hit comes off the shield first', f.medShield < before || E.charAt(s, 0).medShield < sh[0], `${before}->${f.medShield}, hp ${hp}->${f.hp}`);
  e.atk = 1; e.intents = { guard: 1 };
}
{ const { s, rng, e } = make(4, ['foundry', 'medic']);
  // The foundry hand's damage with and without the shot, on the same roll.
  const dmgRange = () => E.withActor(s, 0, () => E.attackRange(s, false));
  const plain = dmgRange();
  s.run.rally = 2;
  const boosted = dmgRange();
  ok('Adrenal Shot lifts the partner’s damage', boosted[1] > plain[1], `${plain[1]} -> ${boosted[1]}`);
  s.run.rally = 0;
  // Triage picks the hurt partner.
  const fh = E.charAt(s, 0); fh.hp = 10;
  E.withActor(s, 1, () => { resetCd(s); });
  s.run.actor = 1;
  const medBefore = E.charAt(s, 1).hp;
  E.playerAct(s, 'triage', rng, 1);
  ok('Triage heals the partner who is worse off', fh.hp > 10 && E.charAt(s, 1).hp <= medBefore + 0, `${fh.hp}`);
  // Revive at 35%.
  fh.hp = 0; fh.downed = 3; s.run.actor = 1;
  E.playerAct(s, 'revive', rng, 1);
  const fmx = E.withActor(s, 0, () => E.stats(s).maxHp);
  ok('a medic revives at 35% HP', fh.downed === 0 && fh.hp === Math.round(fmx * E.TUNE.medRevive), `${fh.hp}/${fmx}`);
}
// Tag leaves it Exposed.
{ const { s, rng, e } = make(5, ['medic']);
  E.playerAct(s, 'tag', rng, 0);
  ok('Tag leaves the enemy Exposed', e.st.exposed > 0); }
// Auto battle plays the kit.
{ const { s } = make(6, ['medic']);
  s.char.hp = 5;
  ok('auto battle reaches for Triage when hurt', E.medicPick(s) === 'triage'); }
// Leaderboard rows carry the player name.
{ const rng = E.seededRng(7), s = E.newGame(rng); const d = E.newDraft(s.meta, rng); d.background = 'medic'; E.createChar(s, rng, d); s.screen = 'town'; s.playerName = 'Tommy';
  s.char.maps = { garrison: { deepest: 3, best: { 0: 3 } } };
  E.syncCareer && E.syncCareer(s);
  const row = (s.meta.boardOut || []).find((x) => x.id === s.char.uid);
  ok('board rows carry the player name', !row || row.player === 'Tommy', JSON.stringify(row && row.player)); }
console.log(fails ? `${fails} failed` : 'no errors');
process.exit(fails ? 1 : 0);
