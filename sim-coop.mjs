// Co-op smoke simulator: two bots share a cell and raid together. Checks the two-operative engine path end to end.
// Usage: node sim-coop.mjs [campaigns=30] [lives=20]
import * as E from './engine.js';
import * as D from './data.js';
import * as G from './sim-gear.mjs';
Object.assign(E.TUNE, JSON.parse(process.env.TUNE || '{}'));
const CAMPAIGNS = +process.argv[2] || 30, LIVES = +process.argv[3] || 20, SOLO = !!process.env.SOLO;

function draft(s, rng, attrs, bg) { const d = E.newDraft(s.meta, rng); d.background = bg; for (let i = 0; i < 12 && d.points > 0; i++) if (!E.draftAdjust(d, attrs[i % attrs.length], 1)) break; return d; }
function shop(s, who, style) {
  E.withActor(s, who, () => {
    const c = s.char; E.heal(s);
    let i = 0; while (c.attrPoints > 0 && i++ < 40) if (!E.spendAttr(s, ['str', 'agi'][i % 2])) for (const k of Object.keys(D.ATTRS)) if (E.spendAttr(s, k)) break;
    G.shopGear(s, style, 60); while (c.items.stim < 3 && E.buyItem(s, 'stim'));
    for (const id of ['dermal', 'reflex', 'pain', 'adrenal']) if (c.credits > 150) E.installImplant(s, id);
    G.upgradeGear(s, style, 150);
  });
}
function act(s, who, style) {
  return E.withActor(s, who, () => {
    const e = s.run.enemy, c = s.char, st = E.stats(s);
    if (E.canUse(s, 'revive') && !process.env.NO_REVIVE) return 'revive';
    if (c.hp < st.maxHp * 0.35 && c.items.stim > 0) return 'stim';
    if ((e.intent === 'heavy' || (e.intent === 'special' && D.SPECIALS[e.id] && D.SPECIALS[e.id].status)) && !e.stun && s.run.lastAttacker === who) return 'defend';
    for (const k of ['overload', 'smash', 'aimed', 'blast', 'burst']) if (E.canUse(s, k) && G.skillAllowed(style, k)) return k;
    return G.attackChoice(s, style);
  });
}
const pct = (a, p) => { const x = [...a].sort((m, n) => m - n); return x[Math.floor(x.length * p)] ?? 0; };
const first = { 5: [], 10: [], 15: [] }; let deaths = 0, raids = 0, hostDeaths = 0, guestDeaths = 0, maxSteps = 0;
for (let k = 0; k < CAMPAIGNS; k++) {
  const rng = E.seededRng(500 + k), s = E.newGame(rng), seen = {};
  s.coop = !SOLO;
  E.createChar(s, rng, draft(s, rng, ['str', 'str', 'agi'], 'foundry'));
  if (!SOLO) E.createChar(s, rng, draft(s, rng, ['agi', 'agi', 'str'], 'runner'), 'char2');
  let lives = 0;
  while (lives < LIVES) {
    for (const u of D.CELL) E.buyCell(s, u.id);
    let t = true; while (t) t = Object.keys(D.TRAINING).sort((a, b) => s.meta.training[a] - s.meta.training[b]).some((x) => E.train(s, x));
    if (!s.char) { lives++; E.createChar(s, rng, draft(s, rng, ['str', 'str', 'agi'], 'foundry')); }
    if (!SOLO && !s.char2) { lives++; E.createChar(s, rng, draft(s, rng, ['agi', 'agi', 'str'], 'runner'), 'char2'); }
    shop(s, 0, 'auto'); if (!SOLO) shop(s, 1, 'rangedFocus');
    const start = Math.max(...E.mapProgress(s.char, 'garrison').insertions);
    E.deploy(s, 'garrison', start, rng); raids++;
    let steps = 0;
    while (s.run && steps++ < 4000) {
      if (s.screen === 'combat') { const who = s.run.actor; E.playerAct(s, act(s, who, who ? 'rangedFocus' : 'auto'), rng, who); }
      else if (s.screen === 'victory') E.continueAfterVictory(s, rng);
      else if (s.screen === 'loot' || s.screen === 'perk') {
        // Each operative picks for themselves.
        const i = E.livingActors(s).find((n) => E.withActor(s, n, () => s.run.lootOffer || s.run.perkOffer));
        if (i === undefined) { E.continueAfterVictory(s, rng); continue; }
        E.withActor(s, i, () => { if (s.run.lootOffer) G.lootChoice(s, rng, i ? 'rangedFocus' : 'auto'); else E.choosePerk(s, s.run.perkOffer[0], rng, s.char.perks[0]); });
      }
      else if (s.screen === 'route') { const ch = s.run.choices, pref = ['rest', 'supply', 'cells', 'cargo', 'event', 'fight', 'elite', 'boss']; E.enterRoom(s, ch.map((x) => pref.indexOf(x)).reduce((bi, v, i, arr) => (v < arr[bi] ? i : bi), 0), rng); }
      else if (s.screen === 'room') E.offerRoute(s, rng);
      else if (s.screen === 'event') { if (s.eventResult) { E.offerRoute(s, rng); continue; } E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); }
      else if (s.screen === 'sectorClear') { const low = E.livingActors(s).some((i) => E.withActor(s, i, () => s.char.hp < E.stats(s).maxHp * 0.5)); if (low) E.endRun(s, 'extracted', rng); else E.pushDeeper(s, rng); }
      else break;
      if (s.actorIdx) throw new Error('actor swap leaked: ' + s.screen);
    }
    maxSteps = Math.max(maxSteps, steps);
    if (steps >= 4000) throw new Error('stuck at ' + s.screen);
    if (s.coopFallen) { deaths++; if (s.coopFallen.idx === 0) hostDeaths++; else guestDeaths++; s.coopFallen = null; }
    if (s.screen === 'death') { if (SOLO) { deaths++; hostDeaths++; } s.char = null; s.screen = 'town'; }
    for (const b of [5, 10, 15]) if (!seen[b] && Math.max(0, ...Object.values(s.meta.bestByMap)) >= b) { seen[b] = 1; first[b].push(lives + 1); }
    if (seen[15]) break;
  }
}
console.log(`${CAMPAIGNS} ${SOLO ? 'solo' : 'co-op'} campaigns: ${raids} raids, ${deaths} deaths (host ${hostDeaths}, friend ${guestDeaths}), longest raid ${maxSteps} steps`);
for (const b of [5, 10, 15]) console.log(`Boss sector ${b}: ${Math.round(first[b].length / CAMPAIGNS * 100)}% of campaigns, median at operative ${pct(first[b], 0.5) || '-'}`);
