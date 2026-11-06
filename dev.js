// Dev mode's autoplay: plays the whole game, not just fights, so later stages can be tested without playing up to them.
// One call makes one decision on the current screen. Uses the simulator bots' gear logic (sim-gear.mjs), loaded only when needed.
import * as E from './engine.js';
import * as D from './data.js';

let G = null;
export async function loadDev() { if (!G) G = await import('./sim-gear.mjs'); return G; }
export const BUILDS = {
  strength: { name: 'Strength', attrs: ['str', 'str', 'agi'], style: 'auto' },
  agility: { name: 'Agility', attrs: ['agi', 'agi', 'str'], style: 'rangedFocus' },
  intellect: { name: 'Intellect', attrs: ['int', 'int', 'str'], style: 'auto' },
  balanced: { name: 'Balanced', attrs: ['str', 'agi', 'int', 'cha'], style: 'auto' },
};
const DOORS = ['rest', 'supply', 'cells', 'cargo', 'event', 'locker', 'bench', 'fence', 'fight', 'elite', 'boss'];
const rankOf = (k) => { const i = DOORS.indexOf(k); return i < 0 ? DOORS.indexOf('fight') : i; };

function draftFor(s, rng, b) {
  const d = s.draft || E.newDraft(s.meta, rng);
  d.background = { str: 'foundry', agi: 'runner', int: 'clerk', cha: 'preacher' }[b.attrs[0]] || 'foundry';
  for (let i = 0; i < 16 && d.points > 0; i++) if (!E.draftAdjust(d, b.attrs[i % b.attrs.length], 1)) break;
  return d;
}
// Spends everything a sensible player would before leaving town: Resolve, attribute points, gear, stims, mods, implants, upgrades, a drink.
const MODS = ['medic', 'drill', 'belt', 'fence', 'forger'];
const IMPLANTS = { str: ['pain', 'dermal', 'myomer', 'adrenal'], agi: ['reflex', 'optic', 'dermal', 'adrenal'], int: ['neural', 'synapse', 'dermal', 'pain'], cha: ['dermal', 'voice', 'pain', 'adrenal'] };
const DRINK = { str: 'gin', agi: 'sour', int: 'tonic', cha: 'rum' };
function shop(s, rng, b) {
  const m = s.meta, c = s.char;
  for (const u of D.CELL) E.buyCell(s, u.id);
  let t = true; while (t) t = Object.keys(D.TRAINING).sort((x, y) => m.training[x] - m.training[y]).some((x) => E.train(s, x));
  E.heal(s);
  for (let i = 0; c.attrPoints > 0 && i < 60; i++) if (!E.spendAttr(s, b.attrs[i % b.attrs.length])) for (const k of Object.keys(D.ATTRS)) if (E.spendAttr(s, k)) break;
  if (m.heirloom) E.equipHeirloom(s);
  while (c.items.stim < 2 && E.buyItem(s, 'stim'));
  G.shopGear(s, b.style, 25);
  while (c.items.stim < 3 && E.buyItem(s, 'stim'));
  for (const id of MODS) { const u = D.UPGRADES.find((x) => x.id === id); if (c.credits >= E.price(s, u.cost) + 25) E.buyUpgrade(s, id); }
  for (const id of IMPLANTS[b.attrs[0]] || IMPLANTS.str) E.installImplant(s, id);
  G.upgradeGear(s, b.style, 25);
  // Whatever is left goes on the lowest-level gear, even where the bot's score barely moves.
  for (let i = 0; i < 40; i++) {
    const slot = D.SLOT_ORDER.filter((k) => E.canUpgrade(c.gear[k]) && c.credits >= E.price(s, E.upgradeCost(c.gear[k])) + 25).sort((x, y) => c.gear[x].level - c.gear[y].level)[0];
    if (!slot || !E.upgradeItem(s, slot)) break;
  }
  E.buyDrink(s, DRINK[b.attrs[0]] || 'gin');
  E.buyNoodles(s);
}
// Called when autoplay stops, so an operative is never left in town with points or credits it would have spent.
export function autoFinish(s, rng, o) {
  if (!G || !s.char || s.run) return;
  E.closePayout(s);
  if (s.screen === 'town') shop(s, rng, BUILDS[o.build] || BUILDS.strength);
}
const nextMap = (s, wanted) => {
  const maps = D.MAPS.filter((mp) => E.mapUnlocked(s, mp));
  return (wanted && maps.find((mp) => mp.id === wanted)) || maps.find((mp) => !s.meta.liberated[mp.id]) || maps[0];
};
// o: { build, target, stopOnDeath, map, stats }. Returns { stop: why } to end, { fight: action } when the caller should animate
// a move itself (watch mode), or null to keep going.
export function autoStep(s, rng, o, watching = false) {
  const b = BUILDS[o.build] || BUILDS.strength, st = o.stats;
  if (s.char && s.char.payout) E.closePayout(s);
  s.notice = null; s.lastResult = null; s.popup = null; s.perkPick = null;
  switch (s.screen) {
    case 'intro': s.screen = 'create'; if (!s.draft) s.draft = E.newDraft(s.meta, rng); return null;
    case 'create': { s.draft = draftFor(s, rng, b); E.createChar(s, rng, s.draft); s.screen = 'town'; st.ops += 1; return null; }
    case 'death':
      st.deaths += 1;
      if (o.stopOnDeath) return { stop: `${s.outcome ? s.outcome.name : 'The operative'} died in sector ${s.outcome ? s.outcome.sector : '?'}.` };
      E.recruit(s, rng); return null;
    case 'ending': s.meta.endingSeen = true; s.screen = 'town'; return null;
    case 'town': {
      shop(s, rng, b);
      const mp = nextMap(s, o.map), ins = Math.max(...E.insertionsAt(s.char, mp.id, s.meta.threat || 0));
      s.gateMap = mp.id;
      if (E.deploy(s, mp.id, ins, rng) === false) return { stop: `Couldn\u2019t deploy to ${mp.name}.` };
      st.raids += 1;
      return null;
    }
    case 'route': {
      if (!s.run.choices || !s.run.choices.length) { E.offerRoute(s, rng); return null; }
      const ch = s.run.choices; let best = 0;
      ch.forEach((k, i) => { if (rankOf(k) < rankOf(ch[best])) best = i; });
      E.enterRoom(s, best, rng);
      return null;
    }
    case 'combat': {
      if (!s.run || !s.run.enemy) { E.offerRoute(s, rng); return null; }
      const v = E.autoAction(s);
      if (watching) return { fight: v };
      E.playerAct(s, v, rng, 0);
      return null;
    }
    case 'victory': case 'room': E.continueAfterVictory(s, rng); return null;
    case 'loot': if (s.run.lootOffer) G.lootChoice(s, rng, b.style); else E.continueAfterVictory(s, rng); return null;
    case 'perk': {
      const c = s.char, offer = s.run.perkOffer;
      if (!offer) { E.continueAfterVictory(s, rng); return null; }
      E.choosePerk(s, offer.find((id) => c.perks.includes(id)) || offer[0], rng);
      return null;
    }
    case 'event': {
      if (s.eventResult) { E.offerRoute(s, rng); return null; }
      const ev = E.eventById(s.event), i = ev ? ev.options.findIndex((x) => E.optionAvailable(s, x)) : -1;
      if (i >= 0) E.resolveEvent(s, i, rng);
      E.offerRoute(s, rng);
      return null;
    }
    case 'sectorClear': {
      const r = s.run, hp = s.char.hp / E.stats(s).maxHp;
      st.deepest = Math.max(st.deepest, r.sector);
      if (o.target && r.sector >= o.target) { const n = r.sector; E.endRun(s, 'extracted', rng); return { stop: `Reached sector ${n}.` }; }
      if (hp < 0.5 && E.extractRate(r.sector) === 0) { E.endRun(s, 'extracted', rng); return null; }
      if (hp < 0.3) { E.endRun(s, 'extracted', rng); return null; }
      E.pushDeeper(s, rng);
      return null;
    }
    default: return { stop: `Don\u2019t know what to do on the ${s.screen} screen.` };
  }
}
