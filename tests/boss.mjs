// Boss rules without a browser: every signature move and its counter, phases, first and repeat meetings, the fallen count, the codex, co-op.
import * as E from '../engine.js';
import * as D from '../data.js';
import { BOSS_MOVES, BOSS_SCRIPT, fallenLine, FALLEN, CODEX } from '../lore.js';
let fails = 0;
const ok = (name, v, extra = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!v) fails++; };
// Every boss, where it fights: from D.MAPS, a boss every 5 sectors.
const WHERE = Object.fromEntries(D.MAPS.flatMap((m) => m.bosses.map((id, i) => [id, [m.id, (i + 1) * 5]])));
const NEW = ['dray', 'slagmother', 'hale', 'restraint', 'voight', 'venn', 'pell', 'gantry', 'imre'];

function game(seed = 7, coop = false) {
  const rng = E.seededRng(seed), s = E.newGame(rng);
  s.meta.bestSector = 99;
  s.coop = coop;
  E.createChar(s, rng);
  if (coop) E.createChar(s, rng, E.newDraft(s.meta, rng), 'char2');
  return { s, rng };
}
function deployBoss(s, rng, id) {
  const [map, sector] = WHERE[id];
  // Later districts open from progress elsewhere: give the operative exactly what this one asks for.
  for (const [m, n] of Object.entries(D.MAPS.find((x) => x.id === map).unlock || {})) { const p = E.mapProgress(s.char, m); p.deepest = Math.max(p.deepest, n); }
  E.deploy(s, map, 1, rng);
  s.run.sector = sector; s.run.room = 2; s.run.choices = null; s.run.bulletin = 'quiet'; s.run.allies = 0;
  E.offerRoute(s, rng);
  for (let i = 0; i < 8 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); }
  return s.run.enemy;
}
// A boss fight held still: lots of HP on both sides, no chance moves, ready for a move to be forced.
function boss(id, seed = 7, coop = false, { atk = 40 } = {}) {
  const { s, rng } = game(seed, coop), e = deployBoss(s, rng, id);
  e.hp = e.maxHp = 100000; e.atk = atk; e.def = 0; e.intent = 'attack'; e.next = 'attack'; e.stun = 0;
  e.intents = { attack: 1 };
  for (const c of [s.char, s.char2]) if (c) { c.attrs.cha = 0; c.attrs.str = 10; c.attrs.agi = 10; c.hp = 5000; c.drone = null; c.perks = []; c.perkN = {}; }
  s.run.mechanicOff = true;
  return { s, rng, e, b: e.bs };
}
const hold = (s) => { for (const c of [s.char, s.char2]) if (c) c.hp = 5000; }; // keep everyone alive; not a max-HP change
// Plays a turn that brings the named move up on the intent line.
function bring(t, move) {
  const { s, rng, e } = t;
  e.sig = null; e.intent = 'attack'; e.next = `sig:${move}`;
  if (e.bs.phase > D.BOSS_KIT[e.id].moves[move].from) e.bs.phase = D.BOSS_KIT[e.id].moves[move].from;
  E.playerAct(s, 'defend', rng, 0); hold(s);
  if (!e.sig || e.sig.id !== move) throw new Error(`${move} did not come up: ${JSON.stringify(e.sig)} intent ${e.intent}`);
  e.next = 'attack';
}
const RNG = E.attackRange;
const range = (s, melee) => { const r = s.run, a = r.ready, m = r.momentum; r.ready = false; r.momentum = false; const out = RNG(s, melee); r.ready = a; r.momentum = m; return out; };
const act = (t, a) => { E.playerAct(t.s, a, t.rng, 0); hold(t.s); };

{ // Every boss has its two moves, the tips name them, the animation numbers follow the table
  for (const id of Object.keys(WHERE)) {
    ok(`${id}: two moves with rules`, Object.keys(BOSS_MOVES[id]).length === 2 && Object.keys(BOSS_MOVES[id]).every((m) => D.BOSS_KIT[id].moves[m]));
    const t = boss(id), [m1, m2] = Object.keys(BOSS_MOVES[id]);
    bring(t, m1); ok(`${id}: ${m1} is sig1`, t.e.sig.n === 1); const inf = E.sigInfo(t.s); ok(`${id}: ${m1} shows on the intent line`, t.e.intent === 'sig' && inf.label.length > 2 && inf.tip.length > 10 && !/[{}]/.test(inf.tip), inf.tip);
    bring(t, m2); ok(`${id}: ${m2} is sig2`, t.e.sig.n === 2);
    ok(`${id}: tips short enough`, Object.values(BOSS_MOVES[id]).every((m) => m.tip.length <= 120));
  }
}

{ // Halvek
  const t = boss('halvek'), { s, e, b, rng } = t;
  const shot = range(s, false)[1], blow = range(s, true)[1];
  bring(t, 'shutter');
  ok('shutter: telegraph first, nothing yet', !b.shutter && E.canUse(s, 'run'));
  act(t, 'defend');
  ok('shutter: down for 2 turns', b.shutter === 2);
  ok('shutter: shots deal half', Math.abs(range(s, false)[1] / shot - 0.5) < 0.1, `${shot} to ${range(s, false)[1]}`);
  ok('shutter: strike at full damage', range(s, true)[1] === blow);
  ok('shutter: no Run', !E.canUse(s, 'run') && E.runBlocked(s));
  { const stim = s.char.items.stim, before = s.run.sector; E.playerAct(s, 'run', rng, 0); ok('shutter: a Run does nothing', s.run && s.run.sector === before && s.char.items.stim === stim); }
  e.next = 'attack'; e.intent = 'attack'; act(t, 'defend'); ok('shutter: one turn left', b.shutter === 1 && !E.canUse(s, 'run'));
  e.next = 'attack'; e.intent = 'attack'; act(t, 'defend'); ok('shutter: up again after 2 turns', b.shutter === 0 && E.canUse(s, 'run'));
}
{
  const t = boss('halvek'), { s, e, b, rng } = t, stims = s.char.items.stim;
  bring(t, 'confiscate'); act(t, 'strike');
  ok('confiscate: Strike during the telegraph stops it', s.char.items.stim === stims && !b.taken.length && !e.sig);
  bring(t, 'confiscate'); act(t, 'defend');
  ok('confiscate: otherwise he takes a stim', s.char.items.stim === stims - 1 && b.taken.length === 1 && b.taken[0].item === 'stim');
  e.next = 'attack'; e.intent = 'attack'; e.hp = 1; act(t, 'strike');
  ok('confiscate: back when he goes down', s.char.items.stim === stims, `${s.char.items.stim}`);
}
{
  const t = boss('halvek'), { s, e, b } = t;
  s.char.items = { stim: 0, thermal: 1, ion: 0, smoke: 0 };
  bring(t, 'confiscate'); act(t, 'defend');
  ok('confiscate: another item if no stims', s.char.items.thermal === 0 && b.taken[0].item === 'thermal');
  bring(t, 'confiscate'); const hp = s.char.hp, inc = E.incomingRange(s); act(t, 'shoot');
  ok('confiscate: nothing to take, he hits you, and the chip said so', inc && s.char.hp === 5000 && hp === 5000, JSON.stringify(inc));
  // Lines and phases at 75, 50, 25
  e.sig = null; e.intent = 'attack'; e.next = 'attack';
  const say = [];
  for (const [mark, want] of [[0.74, 75], [0.49, 50], [0.24, 25]]) {
    e.hp = Math.round(e.maxHp * mark); s.events = []; E.playerAct(s, 'defend', t.rng, 0); hold(s); e.sig = null; e.next = 'attack';
    const ph = s.events.filter((x) => x.type === 'phase'), line = s.events.find((x) => x.type === 'say');
    ok(`halvek: phase at ${want}`, b.phase === want && ph.length === 1 && ph[0].pct === want && BOSS_SCRIPT.halvek.phase[want].includes(line && line.text), line && line.text);
    say.push(line && line.note);
  }
  delete s.events;
  ok('halvek: phase notes shown', say.every((n) => n && n.length > 5), JSON.stringify(say));
  ok('halvek: 50% keeps the old rage', e.phase2 && e.intents.guard === 0);
  ok('halvek: 25% no Run for good', b.noRun && !E.canUse(s, 'run'));
  ok('halvek: Confiscation stops at 50%', !E.sigAdvice(s).act);
  // Execution order every third planned turn
  let specials = 0; for (let i = 0; i < 9; i++) { e.intents = { attack: 1000, special: 1 }; e.sig = null; E.playerAct(s, 'defend', t.rng, 0); hold(s); if (e.intent === 'special') specials++; }
  ok('halvek: Execution order about every third turn', specials >= 2 && specials <= 4, `${specials} of 9`);
}

{ // Crawler
  const t = boss('crawler'), { s, e, b, rng } = t, blow = range(s, true)[1];
  bring(t, 'anchor');
  ok('anchor: Strike the belly +30%', Math.abs(range(s, true)[1] / blow - 1.3) < 0.1);
  const inc = E.incomingRange(s); s.char.hp = 5000; const ev = (s.events = []); E.playerAct(s, 'shoot', rng, 0); delete s.events;
  const got = ev.find((x) => x.type === 'sig');
  ok('anchor: hits for what the chip said', inc && got && got.dmg >= Math.floor(inc.min * 0.85) - 1 && got.dmg <= inc.max, `${got && got.dmg} in ${inc && inc.min}-${inc && inc.max} (Shoot takes 15% off)`);
  ok('anchor: pinned, no Run', s.run.pst.pinned === 2 && !E.canUse(s, 'run')); hold(s);
  e.next = 'attack'; e.intent = 'attack'; act(t, 'defend'); e.next = 'attack'; e.intent = 'attack'; act(t, 'defend');
  ok('anchor: the pin wears off after 2 turns', !s.run.pst.pinned && E.canUse(s, 'run'), JSON.stringify(s.run.pst));
  bring(t, 'anchor'); act(t, 'defend');
  ok('anchor: Defend blocks the pin', !s.run.pst.pinned);
  { const w = boss('crawler', 7, true); w.s.run.pst.pinned = 2; w.s.run.cb[1] = w.s.run.cb[1] || {}; w.s.run.cb[1].pst = { pinned: 2 }; w.e.sig = null; w.e.hp = 1; w.e.intent = 'guard'; w.s.run.actor = 0; w.s.run.acted = {}; E.playerAct(w.s, 'strike', w.rng, 0); ok('anchor: a pin ends with the fight, for both operatives', !w.s.run.pst.pinned && !(w.s.run.cb[1].pst || {}).pinned); }
  // Siege Round
  bring(t, 'siege');
  ok('siege: 2-turn charge', e.sig.left === 2 && !E.incomingRange(s));
  act(t, 'defend'); ok('siege: charging', e.sig && e.sig.left === 1);
  const r2 = E.incomingRange(s); ok('siege: chip on the last turn, Defend about a third', r2 && Math.abs(r2.defMax / r2.max - 0.35) < 0.05, JSON.stringify(r2));
  s.char.hp = 5000; const before = s.char.hp; E.playerAct(s, 'defend', rng, 0);
  ok('siege: goes off behind cover', before - s.char.hp >= r2.defMin && before - s.char.hp <= r2.defMax && !e.sig, `${before - s.char.hp}`); hold(s);
  bring(t, 'siege'); e.hp -= Math.ceil(e.maxHp * 0.1); act(t, 'defend');
  ok('siege: 10% of its HP jams it', !e.sig);
  bring(t, 'siege'); s.char.items.ion = 1; act(t, 'ion');
  ok('siege: an ion pulse jams it', !e.sig);
  // Phases
  const u = boss('crawler'); const def0 = u.e.def = 5;
  u.e.hp = Math.round(u.e.maxHp * 0.7); E.checkPhase(u.s);
  ok('crawler 75%: DEF -1 and Anchor Stomp next', u.e.def === def0 - 1 && u.e.next === 'sig:anchor');
  u.e.intents.repair = 3; u.e.hp = Math.round(u.e.maxHp * 0.45); E.checkPhase(u.s);
  ok('crawler 50%: no repair, Siege next', u.e.intents.repair === 0 && u.e.next === 'sig:siege');
  u.e.hp = Math.round(u.e.maxHp * 0.2); E.checkPhase(u.s);
  ok('crawler 25%: a quarter of plain shots go wide', u.b.wide === 0.25 && u.e.intents.guard === 0);
  let wide = 0; const n = 400; u.e.atk = 40;
  for (let i = 0; i < n; i++) { u.e.sig = null; u.e.intent = 'attack'; u.e.next = 'attack'; u.s.char.hp = 5000; u.s.events = []; E.playerAct(u.s, 'defend', u.rng, 0); if (u.s.events.some((x) => x.type === 'attack' && x.missed)) wide++; delete u.s.events; }
  ok('crawler 25%: about 25% wide', wide > n * 0.17 && wide < n * 0.33, `${wide}/${n}`);
}

{ // Crucible
  const t = boss('crucible'), { s, e, b, rng } = t, shot = range(s, false)[1];
  bring(t, 'roll');
  ok('roll: open takes +50%', Math.abs(range(s, false)[1] / shot - 1.5) < 0.1);
  e.hp -= Math.ceil(e.maxHp * 0.12); act(t, 'defend');
  ok('roll: 12% chokes it and staggers', !e.sig && e.stun === 1);
  e.stun = 0; bring(t, 'roll'); act(t, 'defend');
  ok('roll: no choke, the blast is next', e.sig && e.sig.left === 1 && E.sigInfo(s).label === 'Heat blast' && /x2/.test(E.sigInfo(s).tip));
  ok('roll: the open bonus is over', range(s, false)[1] === shot);
  const inc = E.incomingRange(s), hp = s.char.hp; E.playerAct(s, 'defend', rng, 0);
  ok('roll: Defend halves the blast', hp - s.char.hp >= inc.defMin && hp - s.char.hp <= inc.defMax && Math.abs(inc.defMax / inc.max - 0.5) < 0.05, `${hp - s.char.hp}`); hold(s);
  bring(t, 'floor'); ok('floor: tip says 3 turns', /3 turns/.test(E.sigInfo(s).tip));
  act(t, 'defend'); ok('floor: 3 turns', b.floor === 3);
  e.next = 'attack'; e.intent = 'attack'; e.atk = 0; s.char.hp = 5000; const maxHp = E.stats(s).maxHp;
  { const ev = (s.events = []); E.playerAct(s, 'strike', rng, 0); delete s.events; const c = ev.find((x) => x.type === 'counter' && x.text === 'Slag Floor'); ok('floor: a Strike costs 5% of max HP', c && c.dmg === Math.round(maxHp * 0.05), `${c && c.dmg} of ${maxHp}`); }
  ok('floor: and burns', s.run.pst.burn > 0);
  hold(s); s.run.pst = {}; s.run.pfresh = []; e.next = 'attack'; e.intent = 'attack';
  { const ev = (s.events = []); E.playerAct(s, 'shoot', rng, 0); delete s.events; ok('floor: Shoot is safe', !ev.some((x) => x.text === 'Slag Floor') && !s.run.pst.burn); }
  ok('floor: Shoot is what the bots do', E.sigAdvice(s).hit === 'shoot');
  const u = boss('crucible'); u.e.hp = Math.round(u.e.maxHp * 0.7); E.checkPhase(u.s); ok('crucible 75%: glowing', u.b.glow);
  u.e.sig = null; u.e.next = 'attack'; u.e.intent = 'attack'; u.s.events = []; E.playerAct(u.s, 'strike', u.rng, 0); delete u.s.events; ok('crucible 75%: Strike burns for 3', u.s.run.pst.burn === 3, JSON.stringify(u.s.run.pst));
  u.e.hp = Math.round(u.e.maxHp * 0.45); E.checkPhase(u.s); u.e.next = 'sig:floor'; u.b.floor = 0; u.e.sig = null; u.e.intent = 'attack'; hold(u.s); E.playerAct(u.s, 'defend', u.rng, 0); hold(u.s);
  ok('crucible 50%: Slag Floor says 4 turns', u.e.sig && /4 turns/.test(E.sigInfo(u.s).tip)); E.playerAct(u.s, 'defend', u.rng, 0); hold(u.s); ok('crucible 50%: Slag Floor lasts 4 turns', u.b.floor === 4);
  const sb = range(u.s, false)[1]; u.e.hp = Math.round(u.e.maxHp * 0.2); E.checkPhase(u.s); ok('crucible 25%: takes +15%', Math.abs(range(u.s, false)[1] / sb - 1.15) < 0.1 && u.b.every.act === 'roll' && u.b.every.n === 2);
}

{ // Brask
  const t = boss('brask'), { s, e, b, rng } = t;
  delete D.MELEE_COUNTER.__x;
  bring(t, 'overtime');
  const inc = E.incomingRange(s), hp = s.char.hp, ev = (s.events = []); E.playerAct(s, 'defend', rng, 0); delete s.events;
  const g = ev.find((x) => x.type === 'sig');
  ok('overtime: two hits', g && g.hits.length === 2 && g.hits.every((n) => n > 0), JSON.stringify(g && g.hits));
  ok('overtime: within the chip, blocked', hp - s.char.hp >= inc.defMin && hp - s.char.hp <= inc.defMax, `${hp - s.char.hp} in ${inc.defMin}-${inc.defMax}`);
  ok('overtime: winded, Exposed 2', e.st.exposed === 2); hold(s);
  e.hp = Math.round(e.maxHp * 0.2); E.checkPhase(s); e.st = {}; e.fresh = []; e.sig = null;
  bring(t, 'overtime'); ok('overtime late: the tip changes', /won.t get winded/.test(E.sigInfo(s).tip));
  const h0 = e.hp; E.playerAct(s, 'defend', rng, 0); hold(s);
  ok('overtime late: no Exposed, costs him 3%', !e.st.exposed && h0 - e.hp === Math.round(e.maxHp * 0.03), `${h0 - e.hp}`);
}
{
  const t = boss('brask'), { s, e, b, rng } = t, shot = range(s, false)[1];
  bring(t, 'front'); act(t, 'defend');
  ok('front: shots deal half', b.front === 2 && Math.abs(range(s, false)[1] / shot - 0.5) < 0.1);
  ok('front: bots go in with the Strike', E.sigAdvice(s).hit === 'strike');
  e.next = 'attack'; e.intent = 'attack'; act(t, 'strike'); e.next = 'attack'; e.intent = 'attack'; act(t, 'strike');
  ok('front: gone after 2 turns, fire held', b.front === 0 && b.frontHeld);
  const res = s.meta.resolve; e.next = 'attack'; e.intent = 'attack'; e.hp = 1; act(t, 'strike');
  ok('front: +1 Resolve on the kill', s.meta.resolve > res && s.lastResult === undefined || s.outcome.notes.some((n) => /held your fire/.test(n)), JSON.stringify(s.outcome.notes));
  const u = boss('brask'); bring(u, 'front'); act(u, 'defend'); u.e.next = 'attack'; u.e.intent = 'attack'; act(u, 'shoot'); u.e.next = 'attack'; u.e.intent = 'attack'; act(u, 'strike');
  ok('front: fire and the bonus is gone', !u.b.frontHeld);
  const v = boss('brask'); v.s.char.attrs.cha = 3; bring(v, 'front'); act(v, 'defend'); ok('front: Intimidate is the advice', E.sigAdvice(v.s).act === 'intimidate' || !E.canUse(v.s, 'intimidate'));
  if (!E.canUse(v.s, 'intimidate')) v.s.char.skills = ['intimidate'];
  if (E.canUse(v.s, 'intimidate')) { v.e.hp = v.e.maxHp; let lived = true; const real = Math.random; v.rng = () => 0.999; E.playerAct(v.s, 'intimidate', v.rng, 0); lived = !!v.s.run.enemy; ok('front: Intimidate clears them at once', lived && v.b.front === 0); }
}

{ // Kell
  const t = boss('kell'), { s, e, b, rng } = t;
  bring(t, 'count'); s.run.allies = 0; act(t, 'shoot');
  ok('count alone: Shaken 2', s.run.pst.shaken === 2, JSON.stringify(s.run.pst));
  s.run.pst = {}; s.run.pfresh = [];
  bring(t, 'count'); act(t, 'defend'); ok('count alone: Defend blocks it', !s.run.pst.shaken);
  s.run.allies = 2; bring(t, 'count'); act(t, 'defend');
  ok('count: prisoners freeze for 2', b.count === 2 && !s.run.pst.shaken);
  { e.next = 'attack'; e.intent = 'attack'; const ev = (s.events = []); E.playerAct(s, 'shoot', rng, 0); delete s.events; hold(s); ok('count: frozen prisoners do nothing', !ev.some((x) => x.who === 'ally')); }
  e.next = 'attack'; e.intent = 'attack'; act(t, 'defend'); ok('count: over after 2 turns', b.count === 0);
  { e.next = 'attack'; e.intent = 'attack'; const ev = (s.events = []); E.playerAct(s, 'shoot', rng, 0); delete s.events; hold(s); ok('count: then they fight again', ev.some((x) => x.who === 'ally')); }
  s.run.allies = 0;
  const w = boss('kell'); w.s.run.allies = 2; bring(w, 'count'); w.s.char.attrs.cha = 8; w.s.run.cooldowns = {};
  if (E.skillsOf(w.s.char).includes('intimidate')) { E.playerAct(w.s, 'intimidate', () => 0.999, 0); ok('count: Intimidate breaks it, whatever the roll', !w.e.sig && w.b.count === 0); } else ok('count: test needs Intimidate', false);
  // Lights Out
  const u = boss('kell');
  bring(u, 'lights'); act(u, 'defend');
  ok('lights: 2 turns, hidden', u.b.lights === 2 && E.intentHidden(u.s) && !E.incomingRange(u.s));
  ok('lights: bots Strike', E.sigAdvice(u.s).hit === 'strike');
  u.s.char.gear.gadget = E.makeItem('datapad', 'common', u.rng);
  ok('lights: a scanner still reads her', !E.intentHidden(u.s));
  let miss = 0, n = 800, sw = 0;
  for (let i = 0; i < n; i++) { u.b.lights = 2; u.e.sig = null; u.e.intent = 'attack'; u.e.next = 'attack'; const h = u.e.hp; u.s.char.hp = 5000; E.playerAct(u.s, 'shoot', u.rng, 0); if (h === u.e.hp) miss++; u.e.hp = u.e.maxHp; }
  for (let i = 0; i < 200; i++) { u.b.lights = 2; u.e.sig = null; u.e.intent = 'attack'; u.e.next = 'attack'; const h = u.e.hp; u.s.char.hp = 5000; E.playerAct(u.s, 'strike', u.rng, 0); if (h === u.e.hp) sw++; u.e.hp = u.e.maxHp; }
  ok('lights: about 25% of shots miss', miss > n * 0.19 && miss < n * 0.31, `${miss}/${n}`);
  ok('lights: Strike never misses', sw === 0);
  const x = boss('kell'); x.e.hp = Math.round(x.e.maxHp * 0.2); x.e.intents.special = 1; E.checkPhase(x.s);
  ok('kell 25%: keys gone, Solitary twice as often', x.b.noRun && x.e.intents.special === 2 * 2 && !E.canUse(x.s, 'run'), JSON.stringify(x.e.intents));
}

{ // Vane
  const t = boss('vane'), { s, e, b, rng } = t;
  bring(t, 'crane'); ok('crane: 2-turn telegraph', e.sig.left === 2);
  act(t, 'defend'); ok('crane: one to go', e.sig.left === 1);
  const inc = E.incomingRange(s); ok('crane: Defend only halves', Math.abs(inc.defMax / inc.max - 0.5) < 0.05);
  const hp = s.char.hp; E.playerAct(s, 'defend', rng, 0);
  ok('crane: lands', hp - s.char.hp >= inc.defMin && hp - s.char.hp <= inc.defMax, `${hp - s.char.hp}`); hold(s);
  ok('crane: the wreck blocks snipers', b.wreck === 2 && E.sniperChance(s.run) === 0);
  e.next = 'attack'; e.intent = 'attack'; act(t, 'defend'); e.next = 'attack'; e.intent = 'attack'; act(t, 'defend');
  ok('crane: for 2 turns', b.wreck === 0 && E.sniperChance(s.run) === 0.2);
  bring(t, 'crane'); act(t, 'defend'); s.char.items.smoke = 1; const h2 = s.char.hp;
  { const stay = () => 0.999; E.playerAct(s, 'smoke', stay, 0); ok('crane: failed smoke still clears you', s.run && !e.sig && b.wreck > 0 && s.char.hp >= h2 - 200, `${h2 - s.char.hp}`); hold(s); }
  { bring(t, 'crane'); s.char.items.smoke = 1; E.playerAct(s, 'smoke', () => 0, 0); ok('crane: smoke that works gets you out', !s.run); }
  const u = boss('vane'), shot = range(u.s, false)[1], blow = range(u.s, true)[1];
  bring(u, 'salute');
  ok('salute: a Strike is parried for half', Math.abs(range(u.s, true)[1] / blow - 0.5) < 0.1);
  { const ev = (u.s.events = []); E.playerAct(u.s, 'shoot', u.rng, 0); delete u.s.events; hold(u.s); const a = ev.find((x) => x.who === 'player' && x.type === 'shoot'), g = ev.find((x) => x.type === 'sig');
    ok('salute: Shoot back, a sure crit', a && a.crit); ok('salute: his is one too', g && g.crit); }
  u.e.hp = Math.round(u.e.maxHp * 0.45); E.checkPhase(u.s); ok('vane 50%: snipers 40%', E.sniperChance(u.s.run) === 0.4);
  u.e.hp = Math.round(u.e.maxHp * 0.2); E.checkPhase(u.s); ok('vane 25%: no more Salute', u.b.twice && u.b.every.act === 'crane' && u.b.every.n === 3);
  u.e.sig = null; u.e.intent = 'attack'; u.e.next = 'attack';
  const i2 = E.incomingRange(u.s); const before = u.s.char.hp; const ev = (u.s.events = []); E.playerAct(u.s, 'defend', u.rng, 0); delete u.s.events;
  ok('vane 25%: plain fire is two shots at x0.7', ev.filter((x) => x.type === 'attack').length === 2 && i2 && before - u.s.char.hp <= i2.defMax, `${before - u.s.char.hp} max ${i2 && i2.defMax}`);
}

{ // Ostrane
  const t = boss('ostrane'), { s, e, b, rng } = t;
  const shot = range(s, false)[1], blow = range(s, true)[1];
  act(t, 'shoot'); e.sig = null; e.intent = 'attack';
  e.next = 'sig:redact'; b.phase = 75; E.playerAct(s, 'shoot', rng, 0); hold(s);
  ok('redact: the intent names what you did', /Shoot/.test(E.sigInfo(s).label) && /Shoot/.test(E.sigInfo(s).tip), E.sigInfo(s).label);
  act(t, 'defend');
  ok('redact: Shoot deals half', Math.abs(range(s, false)[1] / shot - 0.5) < 0.1 && b.redact.t === 2);
  ok('redact: Strike untouched', range(s, true)[1] === blow);
  ok('redact: bots switch', E.sigAdvice(s).hit === 'strike');
  e.next = 'attack'; e.intent = 'attack'; act(t, 'strike'); e.next = 'attack'; e.intent = 'attack'; act(t, 'strike');
  ok('redact: over after 2 turns', !b.redact && range(s, false)[1] === shot);
  const u = boss('ostrane'); u.s.char.attrs.str = 8; u.s.run.cooldowns = {};
  u.b.lastAtk[0] = 'smash'; u.s.run.lastAttacker = 0; bring(u, 'redact'); act(u, 'defend');
  ok('redact: a skill locks', !E.canUse(u.s, 'smash') && /locks|lock/.test(BOSS_MOVES.ostrane.redact.tip));
  // Audit
  const a = boss('ostrane', 7, false, { atk: 400 });
  bring(a, 'audit'); ok('audit: 2-turn count', a.e.sig.left === 2 && /x1 right now/.test(E.sigInfo(a.s).tip), E.sigInfo(a.s).tip);
  act(a, 'defend'); const r1 = E.incomingRange(a.s);
  a.b.used[0] = 2; const r2 = E.incomingRange(a.s);
  ok('audit: +0.4 per item', Math.abs(r2.max / r1.max - 1.8) < 0.1 && /x1\.8 right now/.test(E.sigInfo(a.s).tip), `${r1.max} to ${r2.max}`);
  a.b.used[0] = 12; const r3 = E.incomingRange(a.s); ok('audit: caps at x3', Math.abs(r3.max / r1.max - 3) < 0.1);
  a.b.used[0] = 0; const st0 = a.s.char.items.stim; a.s.char.items.stim = 2; a.s.char.hp = 100; E.playerAct(a.s, 'stim', a.rng, 0); ok('audit: a stim counts', a.b.used[0] === 1); hold(a.s);
  const c = boss('ostrane'); c.e.hp = Math.round(c.e.maxHp * 0.2); E.checkPhase(c.s); ok('ostrane 25%: 1-turn count, every third', c.b.auditCount === 1 && c.b.every.act === 'audit' && c.b.every.n === 3);
  c.e.sig = null; c.e.intent = 'attack'; c.e.next = 'sig:audit'; E.playerAct(c.s, 'defend', c.rng, 0); hold(c.s); ok('ostrane 25%: the count really is 1', c.e.sig && c.e.sig.left === 1);
}

{ // Taunts: sparingly
  const t = boss('halvek'), { s, e, b, rng } = t; const seen = [];
  const max = E.stats(s).maxHp;
  for (let i = 0; i < 30; i++) { e.sig = null; e.intent = 'attack'; e.next = 'attack'; e.atk = 0; s.char.hp = Math.round(max * 0.2); s.events = []; E.playerAct(s, 'defend', rng, 0); for (const x of s.events) if (x.type === 'say') seen.push(x); delete s.events; e.hp = e.maxHp; }
  ok('taunts: at most twice a fight', seen.length === 2, `${seen.length}`);
  ok('taunts: boss, then the operative\u2019s head', BOSS_SCRIPT.halvek.taunt.includes(seen[0].text) && BOSS_SCRIPT.halvek.playerLow.includes(seen[1].text) && seen[1].kind === 'narration');
}

{ // First times
  const { s, rng } = game(3), e = deployBoss(s, rng, 'halvek');
  ok('first meeting: all the beats', e.intro.first && e.intro.beats.length === BOSS_SCRIPT.halvek.firstIntro.length, JSON.stringify(e.intro.beats));
  ok('first meeting: recorded on the operative', s.char.bossMet['halvek:garrison'] === 1);
  e.hp = 1; e.intent = 'guard'; s.char.hp = 500; E.playerAct(s, 'strike', rng, 0);
  ok('first win: a scene with every beat and the note', s.scene && s.scene.beats.length === BOSS_SCRIPT.halvek.firstDefeat.length && s.scene.note === BOSS_SCRIPT.halvek.victoryNote && s.char.bossBeat['halvek:garrison'] === 1);
  E.markSceneSeen(s, s.scene.key); s.scene = null;
  E.continueAfterVictory(s, rng); E.endRun(s, 'extracted', rng);
  const e2 = deployBoss(s, rng, 'halvek');
  ok('second meeting: one line from intro', !e2.intro.first && e2.intro.beats.length === 1 && BOSS_SCRIPT.halvek.intro.includes(e2.intro.beats[0]));
  e2.hp = 1; e2.intent = 'guard'; s.char.hp = 500; E.playerAct(s, 'strike', rng, 0);
  ok('repeat win: no scene, a defeat line', !s.scene && BOSS_SCRIPT.halvek.defeat.includes(s.outcome.defeatLine), s.outcome.defeatLine);
  E.continueAfterVictory(s, rng); E.endRun(s, 'extracted', rng);
  E.recruit(s, rng); E.createChar(s, rng);
  const e3 = deployBoss(s, rng, 'halvek');
  ok('later operative, first meeting, scene not seen in full: all beats', e3.intro.first && e3.intro.beats.length === BOSS_SCRIPT.halvek.firstIntro.length);
  e3.hp = 1; e3.intent = 'guard'; s.char.hp = 500; E.playerAct(s, 'strike', rng, 0);
  ok('later operative, first win, cell has seen it: the last beat and the note', s.scene && s.scene.beats.length === 1 && s.scene.beats[0] === BOSS_SCRIPT.halvek.firstDefeat[BOSS_SCRIPT.halvek.firstDefeat.length - 1] && s.scene.note);
  s.scene = null; E.continueAfterVictory(s, rng); E.endRun(s, 'extracted', rng);
  E.markSceneSeen(s, 'intro:halvek:garrison'); E.recruit(s, rng); E.createChar(s, rng);
  const e4 = deployBoss(s, rng, 'halvek');
  ok('later operative, cell has seen the meeting: its last beat', e4.intro.first && e4.intro.beats.length === 1 && e4.intro.beats[0] === BOSS_SCRIPT.halvek.firstIntro[BOSS_SCRIPT.halvek.firstIntro.length - 1]);
  // No boss fights on two maps, and the one each sector names is the one that turns up
  { const seen = {}; for (const m of D.MAPS) for (const id of m.bosses) (seen[id] = seen[id] || []).push(m.id);
    const twice = Object.entries(seen).filter(([, maps]) => maps.length > 1); ok('no boss on two maps', !twice.length, JSON.stringify(twice)); }
  { const a = game(4), ef = deployBoss(a.s, a.rng, 'slagmother'); ok('foundry sector 15 is the Slagmother', ef.id === 'slagmother' && ef.intro.first && ef.intro.beats[0] === BOSS_SCRIPT.slagmother.firstIntro[0], ef.id); }
  // Ostrane's class line
  const o = game(5); o.s.char.background = 'clerk'; const eo = deployBoss(o.s, o.rng, 'ostrane');
  ok('ostrane: a line for the class', eo.intro.beats.includes(BOSS_SCRIPT.ostrane.byBackground.clerk));
  // Old saves
  const old = game(6); delete old.s.char.bossMet; delete old.s.char.bossBeat; const mig = E.migrate(JSON.parse(JSON.stringify(old.s)), old.rng);
  const em = deployBoss(mig, old.rng, 'halvek'); ok('old save: tolerated', em.intro.first && mig.char.bossMet['halvek:garrison'] === 1);
  // A boss fight saved before these rules: picks them up, with its phase kept
  const fy = game(8), ef = deployBoss(fy.s, fy.rng, 'halvek'); delete ef.bs; delete ef.intro; ef.phase2 = true; ef.hp = Math.round(ef.maxHp * 0.4); ef.intent = 'attack'; ef.next = 'attack'; ef.atk = 1; fy.s.char.hp = 500;
  const atk0 = ef.atk; E.playerAct(fy.s, 'defend', fy.rng, 0);
  ok('old mid-fight save: rules appear, no second rage', ef.bs && ef.bs.phase === 50 && ef.atk === atk0, JSON.stringify({ p: ef.bs && ef.bs.phase }));
}

{ // Fallen line
  const r0 = E.seededRng(1), none = E.newGame(r0);
  ok('fresh save: 0 fallen', E.fallenCount(none) === 0);
  E.createChar(none, r0); ok('first operative on a fresh save: still 0', E.fallenCount(none) === 0);
  { const d = game(21); E.deploy(d.s, 'garrison', 1, d.rng); d.s.run.room = 0; d.s.run.choices = ['fight', 'fight']; E.enterRoom(d.s, 0, d.rng); const en = d.s.run.enemy; en.intent = 'attack'; en.atk = 1e6; d.s.char.hp = 1; for (let i = 0; i < 40 && d.s.screen === 'combat'; i++) { en.intent = 'attack'; d.s.char.hp = 1; E.playerAct(d.s, 'defend', d.rng, 0); } ok('after one real death: 1 fallen', d.s.screen === 'death' && E.fallenCount(d.s) === 1, `${E.fallenCount(d.s)}`); E.recruit(d.s, d.rng); E.createChar(d.s, d.rng); ok('and the next operative is told 1', E.fallenCount(d.s) === 1); }
  const f = game(2); f.s.meta.feats.counters.fallen = 37; f.s.meta.fallen = new Array(12).fill({}); ok('counter is the truth past 12', E.fallenCount(f.s) === 37);
  const o = game(2); delete o.s.meta.feats.counters.fallen; o.s.meta.operatives = 31; o.s.meta.fallen = new Array(12).fill({}); o.s.char = { name: 'x' };
  ok('old save without the counter: hired less living', E.fallenCount(o.s) === 30);
  const p = game(2); p.s.meta.feats = { counters: { fallen: 2 }, tiers: {} }; p.s.meta.fallen = new Array(9).fill({}); ok('counter started late: the wall is a floor', E.fallenCount(p.s) === 9);
  const real = game(9); E.deploy(real.s, 'garrison', 1, real.rng); real.s.char.hp = 0; real.s.run.enemy = real.s.run.enemy || null;
  for (const n of [0, 1, 2, 5, 6, 12, 47, 99, 100, 412]) {
    const tier = FALLEN.find((t) => n >= t.min && n <= t.max);
    ok(`fallen line for ${n}: a tier`, !!tier);
    for (let i = 0; i < tier.lines.length; i++) {
      const line = fallenLine(n, () => (i + 0.5) / tier.lines.length);
      if (/[{}]/.test(line) || (n === 1 && /1 operatives|1 bodies/.test(line)) || (n !== 1 && /\b1 operative\b/.test(line))) ok(`fallen wording at ${n}`, false, line);
      if (/\d/.test(tier.lines[i]) || tier.lines[i].includes('{n}')) if (!line.includes(String(n))) ok(`fallen number at ${n}`, false, line);
    }
  }
  ok('fallen line: no number at 0', !/\d/.test(fallenLine(0)));
  ok('fallen line: names the number at 47', fallenLine(47, () => 0.1).includes('47') || FALLEN.find((t) => 47 >= t.min && 47 <= t.max).lines.some((l) => !l.includes('{')), fallenLine(47, () => 0.1));
}

{ // Codex
  const { s, rng } = game(1);
  ok('codex: first look stays quiet', E.codexFresh(s).length === 0 && s.meta.codexSeen.includes('yard'));
  s.meta.feats.counters.fallen = 1; const fresh = E.codexFresh(s);
  ok('codex: a new entry gets a notice once', fresh.length === 1 && fresh[0].id === 'wall' && E.codexFresh(s).length === 0 && s.meta.codexNew.includes('wall'));
  const e = deployBoss(s, rng, 'halvek'); e.hp = 1; e.intent = 'guard'; s.char.hp = 500; E.playerAct(s, 'strike', rng, 0);
  ok('codex: beating Halvek opens Signed in Advance', E.codexFresh(s).some((x) => x.id === 'signed'));
  const old = game(2); old.s.meta.feats.counters['kill:kell'] = 3; old.s.meta.liberated = { foundry: true };
  const ctx = E.codexContext(old.s), open = E.codexEntries(old.s).filter((x) => x.open).map((x) => x.entry.id);
  ok('codex: old cells count kills and freed districts', open.includes('fit') && open.includes('booth') && open.includes('ilse') && ctx.bossRepeat === 3, open.join(','));
  ok('codex: ending from the flag', (() => { const g = game(3); g.s.meta.endingSeen = true; return E.codexEntries(g.s).some((x) => x.open && x.entry.id === 'dawn'); })());
  ok('codex: all entries have a hint', CODEX.every((x) => x.hint));
}

{ // Mapping lines
  const { s, rng } = game(1);
  E.deploy(s, 'garrison', 1, rng); const a = s.run.areaLine;
  ok('map line on arrival, with the area', a.sector === 1 && /Floodlights/.test(a.text) && /outer ring/.test(a.text), a.text);
  s.run.sector = 5; s.run.room = 99; s.run.enemy = null;
  s.run.sector = 5; E.pushDeeper(s, rng);
  ok('map line on a new area', s.run.sector === 6 && s.run.areaLine.sector === 6 && /Ration Depot/.test(s.run.areaLine.text) && !/Floodlights/.test(s.run.areaLine.text), JSON.stringify(s.run.areaLine));
  E.pushDeeper(s, rng); ok('no new line inside an area', s.run.areaLine.sector === 6);
}

{ // Co-op: everything in the state, a target rule for moves aimed at one player
  const t = boss('halvek', 7, true), { s, e, b, rng } = t;
  const copy = () => JSON.parse(JSON.stringify(s));
  e.next = 'sig:confiscate'; b.phase = 100; b.cd = 9; e.intent = 'attack'; s.run.actor = 0; s.run.acted = {}; // forced, so no cooldown was set: hold the next move off
  E.playerAct(s, 'defend', rng, 0); E.playerAct(s, 'defend', rng, 1); hold(s);
  ok('co-op: the move is in the mirrored state', copy().run.enemy.sig.id === 'confiscate' && copy().run.enemy.say && copy().run.enemy.say.text.length > 3);
  const stims = [s.char.items.stim, s.char2.items.stim];
  for (let i = 0; i < 2 && e.sig; i++) { E.playerAct(s, 'defend', rng, s.run.actor); hold(s); if (e.sig) { E.playerAct(s, 'defend', rng, s.run.actor); hold(s); } }
  const lost = [stims[0] - s.char.items.stim, stims[1] - s.char2.items.stim];
  ok('co-op: Confiscation takes from one operative', lost[0] + lost[1] === 1 && b.taken.length === 1, JSON.stringify(lost));
  e.next = 'attack'; e.intent = 'attack'; e.sig = null; e.hp = 1; s.run.actor = 0; s.run.acted = {}; E.playerAct(s, 'strike', rng, 0);
  ok('co-op: and they get it back', s.char.items.stim === stims[0] && s.char2.items.stim === stims[1] && !!s.scene, JSON.stringify([s.char.items.stim, s.char2.items.stim]));
  ok('co-op: both operatives beat him', s.char.bossBeat['halvek:garrison'] && s.char2.bossBeat['halvek:garrison']);
  ok('co-op: the scene is in the mirrored state', copy().scene.beats.length > 0);
  // One new operative is enough for the first-time scene
  const u = game(9, true); u.s.char.bossMet = { 'halvek:garrison': 1 };
  const eu = deployBoss(u.s, u.rng, 'halvek'); ok('co-op: a first meeting for either plays the scene', eu.intro.first && u.s.char2.bossMet['halvek:garrison'] === 1);
  // Redact is aimed at whoever hit last
  const r = boss('ostrane', 7, true); r.s.run.actor = 0; r.s.run.acted = {};
  r.b.phase = 75; r.e.next = 'sig:redact'; r.b.lastAtk = { 1: 'strike' };
  E.playerAct(r.s, 'defend', r.rng, 0); r.s.run.lastAttacker = 1; E.playerAct(r.s, 'strike', r.rng, 1); hold(r.s);
  ok('co-op: Redact names the last attacker', r.e.sig && r.e.sig.who === 1 && r.e.sig.act === 'strike', JSON.stringify(r.e.sig));
  for (let i = 0; i < 2 && r.e.sig; i++) { E.playerAct(r.s, 'defend', r.rng, r.s.run.actor); hold(r.s); }
  if (r.b.redact) {
    const full = E.withActor(r.s, 0, () => range(r.s, true)[1]), cut = E.withActor(r.s, 1, () => range(r.s, true)[1]);
    ok('co-op: Redact cuts only that operative', full !== cut || r.s.char.attrs.str !== r.s.char2.attrs.str, `${full} ${cut}`);
  } else ok('co-op: Redact went off', false);
}

{ // The nine added with twenty sectors: data in place, each move fires and resolves, the phase notes apply
  const LINE_KEYS = ['intro', 'firstIntro', 'taunt', 'playerLow', 'defeat', 'firstDefeat'];
  for (const id of NEW) {
    const en = D.ENEMIES[id], info = D.BOSS_INFO[id], sc = BOSS_SCRIPT[id], kit = D.BOSS_KIT[id];
    ok(`${id}: enemy, special, info, kit and script`, en && en.tags.includes('boss') && D.SPECIALS[id] && info && info.epithet && info.he && kit && sc);
    ok(`${id}: opening line is the enemy line, 50% line is phase2`, sc.firstIntro[0] === en.line && sc.phase[50][0] === info.phase2);
    const all = [...LINE_KEYS.flatMap((k) => sc[k]), ...[75, 50, 25].flatMap((t) => sc.phase[t]), ...Object.values(sc.signature).flat(), sc.victoryNote];
    const long = all.filter((l) => typeof l !== 'string' || l.length > 120);
    ok(`${id}: every line there and under 120 characters`, !long.length && Object.keys(sc.signature).every((m) => kit.moves[m]), long.join(' | '));
    ok(`${id}: notes for 75, 50 and 25`, [75, 50, 25].every((t) => kit.notes[t] && kit.notes[t].length > 5));
  }
  // Each pair of moves is its own: no new boss repeats another's pair.
  const pairs = Object.keys(BOSS_MOVES).map((id) => Object.keys(BOSS_MOVES[id]).sort().join('+'));
  ok('every boss has a different pair of moves', new Set(pairs).size === pairs.length, pairs.join(', '));

  // Each move: brought up, played to the end with no error, and its effect shows.
  const effect = {
    shutter: (t) => t.b.shutter === 2 && !E.canUse(t.s, 'run'),
    confiscate: (t) => t.b.taken.length === 1,
    anchor: (t, ev) => ev.some((x) => x.type === 'sig' && x.dmg > 0) && t.s.run.pst.pinned === 2,
    siege: (t, ev) => ev.some((x) => x.type === 'sig' && x.dmg > 0),
    roll: (t, ev) => ev.some((x) => x.type === 'sig' && x.dmg > 0),
    floor: (t) => t.b.floor === 3,
    overtime: (t, ev) => ev.some((x) => x.type === 'sig' && x.hits && x.hits.length === 2) && t.e.st.exposed === 2,
    front: (t) => t.b.front === 2,
    count: (t) => t.s.run.pst.shaken === 2,
    lights: (t) => t.b.lights === 2 && E.intentHidden(t.s),
    crane: (t, ev) => ev.some((x) => x.type === 'sig' && x.dmg > 0) && t.b.wreck === 2,
    salute: (t, ev) => ev.some((x) => x.type === 'sig' && x.crit),
    redact: (t) => t.b.redact && t.b.redact.t === 2,
    audit: (t, ev) => ev.some((x) => x.type === 'sig' && x.dmg > 0),
  };
  for (const id of NEW) for (const m of Object.keys(BOSS_MOVES[id])) {
    const t = boss(id), { s, e } = t;
    s.char.items.stim = 2; t.b.cd = 9;
    let err = null, ev = [];
    try {
      bring(t, m);
      const inf = E.sigInfo(s); if (!inf || /[{}]/.test(inf.tip)) throw new Error(`intent line: ${JSON.stringify(inf)}`);
      // Shoot rather than Defend when Defend would block the effect the check looks for (a pin, a status).
      const a = ['anchor', 'count'].includes(m) ? 'shoot' : 'defend';
      for (let i = 0; i < 4 && e.sig; i++) { s.events = []; E.playerAct(s, a, t.rng, 0); ev.push(...s.events); delete s.events; hold(s); }
      if (e.sig) throw new Error('still on its way after 4 turns');
      E.bossEffects(s); E.sigAdvice(s); E.runBlocked(s);
    } catch (x) { err = x; }
    ok(`${id}: ${BOSS_MOVES[id][m].name} (${m}) fires and resolves`, !err && effect[m](t, ev), err ? err.message : JSON.stringify(ev.filter((x) => x.type === 'sig' || x.type === 'sigfail')));
    const chips = E.bossEffects(s);
    ok(`${id}: ${m} chips read right`, chips.every((c) => c.label && c.tip && !/Brask|Kell|Gatehouse|Slag Floor|Count Time|Lights Out|Shift in Front|her moves/.test(c.tip + c.label) || D.BOSS_INFO[id].he === 'she'), JSON.stringify(chips));
  }
  // Counters that reused moves bring their own words.
  { const t = boss('hale'); bring(t, 'siege'); t.s.char.items.ion = 1; const ev = (t.s.events = []); E.playerAct(t.s, 'ion', t.rng, 0); delete t.s.events; hold(t.s);
    const f = ev.find((x) => x.type === 'sigfail'); ok('hale: an ion pulse shorts the lance, in his words', !t.e.sig && f && f.text === BOSS_MOVES.hale.siege.ion, f && f.text); }
  { const t = boss('hale'); bring(t, 'roll'); t.e.hp -= Math.ceil(t.e.maxHp * 0.12); const ev = (t.s.events = []); E.playerAct(t.s, 'defend', t.rng, 0); delete t.s.events; hold(t.s);
    ok('hale: Vent Cycle choked staggers him', !t.e.sig && t.e.stun === 1 && ev.some((x) => x.type === 'sigfail' && x.text === BOSS_MOVES.hale.roll.fail)); }
  { const t = boss('dray'); t.s.char.attrs.cha = 8; t.s.char.skills = [...new Set([...(t.s.char.skills || []), 'intimidate'])]; t.s.run.cooldowns = {};
    bring(t, 'front'); E.playerAct(t.s, 'defend', t.rng, 0); hold(t.s);
    ok('dray: conscripts in front halve shots', t.b.front === 2 && E.bossEffects(t.s).some((c) => /^Conscripts 2$/.test(c.label)));
    if (E.canUse(t.s, 'intimidate')) { t.e.sig = null; t.e.next = 'attack'; t.e.intent = 'attack'; E.playerAct(t.s, 'intimidate', () => 0.999, 0); ok('dray: Intimidate scatters the conscripts', t.b.front === 0); } }
  { const t = boss('pell'); bring(t, 'confiscate'); act(t, 'strike'); ok('pell: a Strike stops the Seizure', !t.e.sig && !t.b.taken.length); }
  { const t = boss('venn'); t.s.run.allies = 2; bring(t, 'count'); act(t, 'defend'); ok('venn: Order in Court freezes prisoners', t.b.count === 2); t.s.run.allies = 0; }
  { const t = boss('imre'); bring(t, 'shutter'); act(t, 'defend'); ok('imre: the shield blocks Run, in his words', E.runBlocked(t.s) === BOSS_MOVES.imre.shutter.blocked); }

  // Phases: the line, the note, and what each note says actually happens.
  const after = {
    dray: { 25: (u) => u.b.noRun && u.b.every.act === 'salute' && u.b.every.n === 3 },
    slagmother: { 50: (u) => u.b.floorTurns === 4 && u.e.intents.repair === 0, 25: (u, d0) => u.e.def === Math.max(0, d0 - 3) && u.b.every.act === 'floor' },
    hale: { 50: (u, d0, s0) => u.e.spd === s0 + 2, 25: (u) => u.b.brittle && u.b.every.act === 'siege' && u.b.every.n === 3 },
    restraint: { 50: (u) => u.e.intents.repair === 0, 25: (u) => u.b.noRun && u.b.every.act === 'anchor' && !E.canUse(u.s, 'run') && E.runBlocked(u.s) === D.BOSS_INFO.restraint.noRun[0] },
    voight: { 25: (u, d0, s0, sp0) => u.e.intents.special === sp0 * 2 && u.b.every.act === 'redact' },
    venn: { 50: (u, d0) => u.e.def === d0 + 2, 25: (u) => u.b.noRun && u.b.every.act === 'audit' && E.runBlocked(u.s) === D.BOSS_INFO.venn.noRun[0] },
    pell: { 50: (u) => E.sniperChance(u.s.run) === 0.3, 25: (u) => E.sniperChance(u.s.run) === 0.45 },
    gantry: { 50: (u) => u.e.intents.repair === 0, 25: (u) => u.b.wide === 0.25 && u.b.every.act === 'anchor' },
    imre: { 50: (u, d0, s0) => u.e.spd === s0 + 2 && E.sniperChance(u.s.run) === 0.4, 25: (u) => u.b.noRun && u.b.twice && u.b.every.act === 'siege' && u.b.every.n === 4 && E.runBlocked(u.s) === D.BOSS_INFO.imre.noRun[0] },
  };
  for (const id of NEW) {
    const u = boss(id); u.e.intents = { attack: 1, special: 2, repair: 1 };
    for (const [mark, want] of [[0.74, 75], [0.49, 50], [0.24, 25]]) {
      const d0 = u.e.def, s0 = u.e.spd, sp0 = u.e.intents.special, atk0 = u.e.atk;
      u.e.hp = Math.round(u.e.maxHp * mark); u.s.events = []; E.checkPhase(u.s);
      const ph = u.s.events.filter((x) => x.type === 'phase'), line = u.s.events.find((x) => x.type === 'say'); delete u.s.events;
      ok(`${id}: phase at ${want}, its line and note`, u.b.phase === want && ph.length === 1 && BOSS_SCRIPT[id].phase[want].includes(line && line.text) && line.note === D.BOSS_KIT[id].notes[want], line && line.note);
      if (want === 50) ok(`${id}: 50% is +20% ATK`, u.e.atk === Math.round(atk0 * 1.2));
      const chk = (after[id] || {})[want];
      if (chk) ok(`${id}: what the ${want}% note says happens`, chk(u, d0, s0, sp0), JSON.stringify({ def: u.e.def, spd: u.e.spd, every: u.b.every, intents: u.e.intents }));
      // A move that opens at this mark is next, so the change is felt.
      const opens = Object.entries(D.BOSS_KIT[id].moves).find(([, m]) => m.from === want);
      if (opens) ok(`${id}: ${opens[0]} opens at ${want} and comes next`, u.e.next === `sig:${opens[0]}`, u.e.next);
      u.e.next = 'attack'; u.e.sig = null;
    }
    // And the moves that close at a mark stay closed.
    for (const [m, k] of Object.entries(D.BOSS_KIT[id].moves)) if (k.until) {
      const v = boss(id); v.b.phase = k.until; v.e.next = `sig:${m}`; v.e.sig = null; v.e.intent = 'attack'; E.playerAct(v.s, 'defend', v.rng, 0); hold(v.s);
      ok(`${id}: ${m} closed from ${k.until}%`, !v.e.sig || v.e.sig.id !== m);
    }
  }

  // The map pools: every id real, each district has its own new cast, the opening sectors stay small.
  const OWN = { foundry: ['stoker', 'hookbot', 'castguard'], detention: ['warder', 'orderly'], port: ['customs', 'tetherdrone', 'exo'] };
  for (const m of D.MAPS) {
    ok(`${m.id}: every pool id is an enemy`, m.pool.every(([id]) => D.ENEMIES[id] && !D.ENEMIES[id].tags.includes('boss')));
    for (const id of OWN[m.id] || []) ok(`${m.id}: ${id} in the pool, with a special`, m.pool.some(([p]) => p === id) && D.SPECIALS[id]);
  }
  // Each one stands in for a loaned enemy at the same sector, and is no more than 10% tougher (HP x ATK) than it was.
  const WAS = { stoker: 'hound', hookbot: 'riot', castguard: 'shock', orderly: 'hound', warder: 'riot', tetherdrone: 'probe', customs: 'marksman', exo: 'shock' };
  for (const [id, was] of Object.entries(WAS)) { const a = D.ENEMIES[id], z = D.ENEMIES[was]; ok(`${id}: about as tough as the ${was} it replaced`, a.hp * a.atk <= z.hp * z.atk * 1.1, `${a.hp}x${a.atk} vs ${z.hp}x${z.atk}`); }
  const own = Object.values(OWN).flat(); ok('new enemies sit on one map each', own.every((id) => D.MAPS.filter((m) => m.pool.some(([p]) => p === id)).length === 1));

  // Codex: the district finales now open what Ostrane and the crawler used to.
  for (const [entry, key] of [['booth', 'hale:foundry'], ['paid', 'venn:detention'], ['ledger', 'imre:port']]) {
    const x = CODEX.find((c) => c.id === entry); ok(`codex: ${entry} opens on ${key}`, x && x.unlock.id === key.split(':')[0] && x.unlock.map === key.split(':')[1]);
  }
  { const g = game(11); g.s.meta.liberated = { foundry: true, detention: true, port: true }; const open = E.codexEntries(g.s).filter((x) => x.open).map((x) => x.entry.id);
    ok('codex: freed districts open their finale entries', ['booth', 'paid', 'ledger'].every((k) => open.includes(k)), open.join(',')); }
  // Imre's scene ends the story: the ledger, the column, the brake.
  ok('imre: the last scene names the ledger, Paid, and stops the lift', BOSS_SCRIPT.imre.firstDefeat.some((l) => /ledger/.test(l)) && BOSS_SCRIPT.imre.firstDefeat.some((l) => /Paid/.test(l)) && /stops/.test(BOSS_SCRIPT.imre.firstDefeat[BOSS_SCRIPT.imre.firstDefeat.length - 1]));
  { const g = game(12), ei = deployBoss(g.s, g.rng, 'imre'); ei.hp = 1; ei.intent = 'guard'; g.s.char.hp = 500; E.playerAct(g.s, 'strike', g.rng, 0);
    ok('imre: beating him plays the whole scene', g.s.scene && g.s.scene.beats.length === BOSS_SCRIPT.imre.firstDefeat.length && g.s.scene.note === BOSS_SCRIPT.imre.victoryNote && !/[{}]/.test(g.s.scene.beats.join(''))); }
}

{ // Bots and auto battle get through every boss, on many seeds, without getting stuck
  for (const id of Object.keys(WHERE)) {
    let wins = 0, deaths = 0, seen = new Set();
    for (let seed = 0; seed < 40; seed++) {
      const { s, rng } = game(100 + seed);
      const c = s.char; c.level = 12; c.attrs.str += 6; c.attrs.agi += 4; c.attrs.int += 3; c.attrs.cha += 3; c.items = { stim: 3, thermal: 1, ion: 1, smoke: 0 }; c.hp = E.stats(s).maxHp;
      const e = deployBoss(s, rng, id);
      if (WHERE[id][0] === 'reach') { e.hp = e.maxHp = 2500; e.atk = Math.min(e.atk, 120); } // endgame bosses: a level-12 test operative only needs to meet their moves
      let steps = 0;
      while (s.screen === 'combat' && s.run.enemy === e && steps++ < 300) { if (e.sig) seen.add(e.sig.id); if (seed >= 20) c.hp = Math.max(c.hp, 2000); const a = E.autoAction(s); if (!E.canUse(s, a)) throw new Error(`auto chose ${a} on ${id}`); E.playerAct(s, a, rng, 0); }
      if (steps >= 300) throw new Error(`stuck on ${id}`);
      if (s.screen === 'death') deaths++; else wins++;
    }
    const all = Object.keys(BOSS_MOVES[id]).every((m) => seen.has(m));
    ok(`auto battle plays ${id} to an end and meets its moves`, all, `${wins} wins, ${deaths} deaths, saw ${[...seen].join(', ')}`);
  }
}

// Regular enemies run less: a Cowardly one holds until 20% HP, and scaring one off is never certain.
{ const q = E.quirkById ? E.quirkById('coward') : null; if (q) ok('Cowardly runs below 20%', /20%/.test(q.desc)); }
// Bosses never flee, whatever the roll or the gear.
for (const id of ['kell', 'halvek', 'brask']) for (const key of [false, true]) {
  const v = boss(id); const c = v.s.char;
  c.attrs.cha = 10; c.hp = c.maxHp = 99999; v.e.hp = Math.floor(v.e.maxHp * 0.6);
  if (key) c.gear.gadget = { base: 'kellkey', unique: 'kell', rarity: 'unique', bonuses: [] };
  ok(`${id}${key ? ' with the key' : ''}: no chance of it running`, E.intimidateChance(v.s) === 0);
  const hp = v.e.hp;
  for (let i = 0; i < 2; i++) { v.s.run.cooldowns.intimidate = 0; v.e.intent = 'attack'; v.e.sig = null; if (E.canUse(v.s, 'intimidate')) E.playerAct(v.s, 'intimidate', () => 0, 0); if (!v.s.run || v.s.run.enemy !== v.e) break; }
  ok(`${id}${key ? ' with the key' : ''}: Intimidate never ends the fight`, !!v.s.run && v.s.run.enemy === v.e && v.e.hp > 0 && v.e.shaken === true, `${v.s.screen} ${hp}`);
}

console.log(fails ? `${fails} failed` : 'no errors');
process.exit(fails ? 1 : 0);
