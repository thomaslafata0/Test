// The damage shown on the intent line must match what the enemy actually does.
import assert from 'node:assert';
import * as E from '../engine.js';
const within = (n, a, b, what) => assert(n >= a && n <= b, `${what}: ${n} outside ${a}-${b}`);
let checked = 0;
for (let seed = 1; seed <= 40 && checked < 400; seed++) {
  const rng = E.seededRng(seed), s = E.newGame(rng);
  E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town'; s.char.items.stim = 0;
  E.deploy(s, 'garrison', 1, rng);
  for (let i = 0; i < 400 && s.run && s.screen !== 'death'; i++) {
    if (s.screen === 'combat') {
      const inc = E.incomingRange(s), e = s.run.enemy, v = i % 2 ? 'defend' : 'strike';
      const seen = s.log.length;
      s.char.hp = 9999;
      E.playerAct(s, v, rng, 0);
      const lines = s.log.slice(seen).map((l) => l.text || l.t || String(l));
      const hit = lines.map((t) => /(?:hits you|lands a heavy strike) for (\d+)/.exec(t)).find(Boolean);
      if (inc && hit) { checked++; if (v === 'defend') within(+hit[1], inc.defMin, inc.defMax, `${e.name} blocked`); else within(+hit[1], inc.min, inc.max, `${e.name}`); }
      if (s.char) s.char.hp = Math.min(s.char.hp, E.stats(s).maxHp);
    } else if (s.screen === 'route') E.enterRoom(s, 0, rng);
    else if (s.screen === 'room') E.offerRoute(s, rng);
    else if (s.screen === 'sectorClear') E.pushDeeper(s, rng);
    else if (s.screen === 'victory') E.continueAfterVictory(s, rng);
    else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); }
    else if (s.screen === 'loot' || s.screen === 'perk') { if (s.run.lootOffer) s.run.lootOffer = null; if (s.run.perkOffer) s.run.perkOffer = null; E.continueAfterVictory(s, rng); }
    else break;
  }
}
assert(checked > 40, `only ${checked} hits checked`);
console.log(`PASS incoming damage matched on ${checked} hits`);
