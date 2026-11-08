// Daily and weekly contracts: same spec for everyone in a period, the loaner build, the finish line, and how hard they are for a bot.
// node tests/contracts.mjs [runs]
import * as E from '../engine.js';
import * as D from '../data.js';
import * as C from '../contracts.js';
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); if (!c) fails++; };
const day = new Date(Date.UTC(2026, 10, 9, 15)), later = new Date(Date.UTC(2026, 10, 9, 23)), next = new Date(Date.UTC(2026, 10, 10, 1));
ok('ids by day and ISO week', C.periodId('daily', day) === 'd20261109' && C.periodId('weekly', day) === 'w202646', `${C.periodId('daily', day)} ${C.periodId('weekly', day)}`);
ok('same spec all day', JSON.stringify(C.spec('daily', day)) === JSON.stringify(C.spec('daily', later)));
ok('a new one tomorrow', C.spec('daily', next).id !== C.spec('daily', day).id);
const sp = C.spec('daily', day); console.log('  today:', JSON.stringify(sp));
{ const { s } = C.buildState(sp, 'Tom'); ok('the loaner is deployed into the contract', s.run && s.run.map === sp.map && s.char.background === sp.cls && s.char.level === sp.level && JSON.stringify(s.run.mutators) === JSON.stringify(sp.mutators) && s.run.daily && s.run.reinforced === 0, `${s.char.name} L${s.char.level}`); }
// A careful bot plays it: fights, defends heavy hits, stims low, rests when hurt; turns the contract in at the end.
function act(s) { const r = s.run, e = r.enemy, c = s.char, hp = E.stats(s).maxHp;
  if (c.hp < hp * 0.35 && E.canUse(s, 'stim') && c.items.stim) return 'stim';
  if ((E.mechanicOf(r) === 'vents' && r.vent === 1)) return 'defend';
  const med = E.medicPick(s); if (med) return med;
  const adv = E.sigAdvice(s); if (adv.act) return adv.act;
  if (e.intent === 'heavy') return 'defend';
  for (const k of ['overhaul', 'pickcard', 'wink', 'overload', 'smash', 'aimed', 'blast', 'burst', 'suppress', 'intimidate']) if (E.canUse(s, k)) return k;
  return adv.hit || (E.stats(s).atk >= E.stats(s).atkM ? 'shoot' : 'strike'); }
function play(sp) {
  const { s, rng } = C.buildState(sp); let n = 0;
  while (s.run && s.screen !== 'death' && n++ < 6000) {
    if (s.screen === 'combat') E.playerAct(s, act(s), rng);
    else if (s.screen === 'victory') E.continueAfterVictory(s, rng);
    else if (s.screen === 'loot' || s.screen === 'perk') { if (s.run.perkOffer) E.choosePerk(s, E.bestPerkPick(s), rng); else E.continueAfterVictory(s, rng); }
    else if (s.screen === 'route') { const ch = s.run.choices, low = s.char.hp < E.stats(s).maxHp * 0.5, pref = low ? ['rest', 'supply', 'event', 'fight'] : ['bench', 'locker', 'supply', 'event', 'fight', 'rest']; const v = (k) => { const i = pref.indexOf(k); return i < 0 ? 9 : i; }; E.enterRoom(s, ch.map(v).reduce((bi, x, i, a) => (x < a[bi] ? i : bi), 0), rng); }
    else if (s.screen === 'room') E.offerRoute(s, rng);
    else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); }
    else if (s.screen === 'sectorClear') { if (s.run.daily.done) E.attemptExtract(s, rng); else E.pushDeeper(s, rng); }
    else break;
  }
  return s.contractTally;
}
const N = +(process.argv[2] || 60);
for (const kind of (process.env.KIND || 'daily,weekly').split(',')) for (const map of (process.env.MAP ? process.env.MAP.split(',') : C.KINDS[kind].maps)) for (const cls of ['foundry', 'runner', 'clerk', 'medic']) {
  let done = 0, sc = 0; const base = C.spec(kind, day);
  for (let i = 0; i < N; i++) { const t = play({ ...base, map, cls, seed: 1000 + i, ...(process.env.LV ? { level: +process.env.LV } : {}), ...(process.env.TR ? { train: +process.env.TR } : {}) }); if (t && t.done) done++; sc += C.score(t); }
  console.log(`  ${kind} ${map} ${cls}: finished ${Math.round(100 * done / N)}%, avg score ${Math.round(sc / N)}`);
}
{ const t = play(sp); ok('a played contract leaves a tally and a score', t && C.score(t) > 0, JSON.stringify(t)); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
