// Build and play-style balance harness. Plays many runs with different bot personalities and reports outliers.
// Usage: node sim-builds.mjs [operativesPerBuild=300] [campaigns=30]
import * as E from './engine.js';
import * as D from './data.js';

const OPS = +process.argv[2] || 300;
const CAMPAIGNS = +process.argv[3] || 30;

// ---------- bot personalities ----------
const BUILDS = {
  strength:  { bg: 'foundry',  attrs: ['str'], weapons: ['cannon', 'maul', 'scatter', 'baton'], implants: ['myomer', 'pain', 'dermal', 'adrenal'] },
  agility:   { bg: 'runner',   attrs: ['agi'], weapons: ['marksman', 'longbore', 'carbine'], implants: ['reflex', 'optic', 'dermal', 'adrenal'] },
  intellect: { bg: 'clerk',    attrs: ['int'], weapons: ['arc', 'carbine'], implants: ['neural', 'synapse', 'dermal', 'pain'], items: { ion: 2, thermal: 2 } },
  charisma:  { bg: 'preacher', attrs: ['cha'], weapons: ['gilded', 'sidearm', 'carbine'], implants: ['voice', 'dermal', 'pain', 'adrenal'] },
  balanced:  { bg: 'foundry',  attrs: ['str', 'agi', 'int', 'cha'], weapons: null, implants: ['dermal', 'reflex', 'pain', 'adrenal'] },
  strAgi:    { bg: 'foundry',  attrs: ['str', 'agi'], weapons: null, implants: ['dermal', 'reflex', 'pain', 'adrenal'] },
  glass:     { bg: 'runner',   attrs: ['agi', 'agi', 'str'], weapons: ['marksman', 'longbore', 'carbine'], implants: ['optic', 'reflex', 'synapse'], noArmor: true },
};
const STYLES = {
  cautious: { extractHp: 0.6, bossHp: 0.9, smoke: 1, smokeAt: 0.2 },
  standard: { extractHp: 0.5, bossHp: 0.8, smoke: 0, smokeAt: 0 },
  greedy:   { extractHp: 0.25, bossHp: 0.5, smoke: 0, smokeAt: 0 },
};

function create(s, rng, b) {
  const d = s.draft; d.background = b.bg;
  for (let i = 0; i < 12 && d.points > 0; i++) if (!E.draftAdjust(d, b.attrs[i % b.attrs.length], 1)) for (const k of Object.keys(D.ATTRS)) if (E.draftAdjust(d, k, 1)) break;
  E.createChar(s, rng);
}

function shop(s, b, st) {
  const c = s.char;
  E.heal(s);
  let i = 0; while (c.attrPoints > 0 && i++ < 40) if (!E.spendAttr(s, b.attrs[i % b.attrs.length])) for (const k of Object.keys(D.ATTRS)) if (E.spendAttr(s, k)) break;
  // weapon: build list in order of preference, else the strongest affordable
  const list = b.weapons ? b.weapons.map((id) => D.WEAPONS.find((w) => w.id === id)) : [...D.WEAPONS].reverse();
  for (const w of list) if (w.atk > E.weaponOf(c).atk && E.buyGear(s, 'weapon', w.id)) break;
  if (!b.noArmor) for (let k = D.ARMOR.length - 1; k > 0; k--) if (D.ARMOR[k].def > E.armorOf(c).def && E.buyGear(s, 'armor', D.ARMOR[k].id)) break;
  while (c.items.stim < 3 && E.buyItem(s, 'stim'));
  for (const [it, n] of Object.entries(b.items || {})) while (c.items[it] < n && c.credits > 80 && E.buyItem(s, it));
  while (c.items.smoke < st.smoke && E.buyItem(s, 'smoke'));
  for (const id of b.implants) if (c.credits > 120) E.installImplant(s, id);
  for (const u of D.UPGRADES) if (c.credits > u.cost + 80) E.buyUpgrade(s, u.id);
}

function act(s, st) {
  const r = s.run, e = r.enemy, c = s.char, hp = E.stats(s).maxHp;
  if (c.hp < hp * st.smokeAt && c.items.smoke) return 'smoke';
  if (c.hp < hp * 0.35 && c.items.stim) return 'stim';
  if (E.mechanicOf(r) === 'vents' && r.vent === 1) return 'defend';
  if ((e.intent === 'heavy' || (e.intent === 'special' && D.SPECIALS[e.id].status)) && !e.stun) return 'defend';
  if ((e.boss || e.elite) && c.items.thermal) return 'thermal';
  if (e.tags.includes('droid') && c.items.ion && !e.stun && e.hp > e.maxHp * 0.5) return 'ion';
  if (E.canUse(s, 'intimidate') && E.intimidateChance(s) > 0.45) return 'intimidate';
  if (e.intent === 'guard' && !e.stun) return 'defend';
  for (const k of ['overload', 'smash', 'aimed', 'blast', 'burst', 'suppress']) if (E.canUse(s, k)) return k;
  return 'attack';
}

// Play one operative until death or 25 raids. Returns stats for that operative.
function playOperative(s, rng, b, st, map = 'garrison') {
  let raids = 0, deaths = 0, extracts = 0, escapes = 0, credits = 0;
  while (s.screen !== 'death' && raids < 25) {
    shop(s, b, st);
    raids++;
    const m = E.mapUnlocked(s, E.mapById(map)) ? map : 'garrison';
    E.deploy(s, m, Math.max(...E.mapProgress(s.char, m).insertions), rng);
    let steps = 0;
    while (s.run && s.screen !== 'death' && steps++ < 4000) {
      if (s.screen === 'combat') { const a = act(s, st); if (a === 'smoke' || a === 'run') escapes++; E.playerAct(s, a, rng); }
      else if (s.screen === 'victory') E.continueAfterVictory(s, rng);
      else if (s.screen === 'perk') E.choosePerk(s, s.run.perkOffer[0], rng, s.char.perks[0]);
      else if (s.screen === 'route') {
        const ch = s.run.choices, low = s.char.hp < E.stats(s).maxHp * 0.5;
        const pref = low ? ['rest', 'supply', 'cells', 'cargo', 'event', 'fight', 'elite', 'boss'] : ['cells', 'supply', 'event', 'cargo', 'fight', 'rest', 'elite', 'boss'];
        E.enterRoom(s, ch.map((k) => pref.indexOf(k)).reduce((bi, v, i, arr) => (v < arr[bi] ? i : bi), 0), rng);
      }
      else if (s.screen === 'room') E.offerRoute(s, rng);
      else if (s.screen === 'event') {
        if (s.eventResult) { E.offerRoute(s, rng); continue; }
        const ev = E.eventById(s.event);
        let best = 0, bc = -1;
        ev.options.forEach((o, i) => { const ch = E.optionAvailable(s, o) ? E.checkChance(s, o.check) : -1; if (ch > bc) { bc = ch; best = i; } });
        E.resolveEvent(s, best, rng); E.offerRoute(s, rng);
      }
      else if (s.screen === 'sectorClear') {
        const hp = E.stats(s).maxHp, next = s.run.sector + 1;
        if (s.char.hp < hp * st.extractHp || (E.isBossSector(next) && s.char.hp < hp * st.bossHp)) { credits += s.char.credits; extracts++; E.endRun(s, 'extracted'); }
        else E.pushDeeper(s, rng);
      } else break;
    }
    if (s.screen === 'death') deaths++;
  }
  return { deepest: s.char ? s.char.deepest : (s.outcome ? s.outcome.sector : 0), level: s.outcome ? s.outcome.level : s.char.level, raids, extracts, escapes, died: s.screen === 'death' };
}

const pct = (a, p) => { const x = [...a].sort((m, n) => m - n); return x[Math.floor(x.length * p)] ?? 0; };
const avg = (a) => a.reduce((t, v) => t + v, 0) / (a.length || 1);

// ---------- 1. head-to-head: fresh operatives with the same fixed permanent training ----------
function headToHead(build, style, ranks) {
  const res = [];
  for (let i = 0; i < OPS; i++) {
    const rng = E.seededRng(9000 + i);
    const s = E.newGame(rng);
    s.meta.training = { hp: ranks, atk: ranks, def: ranks, spd: ranks };
    s.meta.cell = ['stash', 'kit', 'cache', 'ledger', 'mentor'];
    create(s, rng, BUILDS[build]);
    res.push(playOperative(s, rng, BUILDS[build], STYLES[style]));
  }
  return res;
}

// ---------- 2. campaigns: how many operatives until each boss falls ----------
function campaign(build, style) {
  const first = { 5: [], 10: [], 15: [] }, raidsTo15 = [];
  for (let k = 0; k < CAMPAIGNS; k++) {
    const rng = E.seededRng(3000 + k), s = E.newGame(rng), seen = {};
    for (let life = 0; life < 40; life++) {
      if (life) E.recruit(s, rng);
      // spend Resolve: cell upgrades, then cheapest training
      for (const u of D.CELL) E.buyCell(s, u.id);
      let t = true; while (t) t = Object.keys(D.TRAINING).sort((a, b) => s.meta.training[a] - s.meta.training[b]).some((x) => E.train(s, x));
      create(s, rng, BUILDS[build]);
      playOperative(s, rng, BUILDS[build], STYLES[style]);
      for (const b of [5, 10, 15]) if (!seen[b] && s.meta.bestSector >= b) { seen[b] = 1; first[b].push(life + 1); if (b === 15) raidsTo15.push(s.meta.stats.raids); }
      if (seen[15]) break;
    }
  }
  const fmt = (b) => first[b].length ? `${pct(first[b], 0.5)} (${Math.round(first[b].length / CAMPAIGNS * 100)}%)` : '-';
  return `${fmt(5).padStart(9)} ${fmt(10).padStart(9)} ${fmt(15).padStart(9)}   raids to boss15: ${raidsTo15.length ? pct(raidsTo15, 0.5) : '-'}`;
}

const row = (name, res) => {
  const d = res.map((r) => r.deepest);
  return `${name.padEnd(22)} ${String(pct(d, 0.5)).padStart(6)} ${String(pct(d, 0.9)).padStart(5)} ${avg(d).toFixed(1).padStart(6)} ${avg(res.map((r) => r.level)).toFixed(1).padStart(6)} ${avg(res.map((r) => r.raids)).toFixed(1).padStart(6)}`;
};

for (const ranks of [0, 8]) {
  console.log(`\n=== Head-to-head, ${OPS} fresh operatives each, training ${ranks} ranks in every stat ===`);
  console.log('build / style            median  p90   mean  level  raids   (deepest sector reached)');
  for (const b of Object.keys(BUILDS)) console.log(row(`${b} / standard`, headToHead(b, 'standard', ranks)));
  for (const st of ['cautious', 'greedy']) console.log(row(`strAgi / ${st}`, headToHead('strAgi', st, ranks)));
}

console.log(`\n=== Campaigns (${CAMPAIGNS} each): median operative # to first beat boss 5 / 10 / 15 (share of campaigns) ===`);
console.log('build / style                 boss5    boss10    boss15');
for (const b of Object.keys(BUILDS)) console.log(`${(b + ' / standard').padEnd(24)} ${campaign(b, 'standard')}`);
for (const st of ['cautious', 'greedy']) console.log(`${('strAgi / ' + st).padEnd(24)} ${campaign('strAgi', st)}`);
