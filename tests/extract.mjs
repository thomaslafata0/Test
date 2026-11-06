// Leaving between bosses: risky can fail and force you deeper, safe always works and keeps nothing from the raid.
import assert from 'node:assert';
import * as E from '../engine.js';
const atClear = (seed) => {
  const rng = E.seededRng(seed), s = E.newGame(rng);
  E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town';
  E.deploy(s, 'garrison', 1, rng);
  for (let n = 0; n < 300 && s.screen !== 'sectorClear'; n++) {
    if (s.screen === 'combat') { s.run.enemy.hp = 1; s.char.hp = 999; E.playerAct(s, 'strike', rng, 0); }
    else if (['victory', 'loot', 'perk'].includes(s.screen)) { s.run.lootOffer = null; s.run.perkOffer = null; E.continueAfterVictory(s, rng); }
    else if (s.screen === 'route') E.enterRoom(s, 0, rng);
    else if (s.screen === 'event') { if (!s.eventResult) E.resolveEvent(s, 0, rng, 0); E.offerRoute(s, rng); }
    else E.offerRoute(s, rng);
  }
  assert.strictEqual(s.screen, 'sectorClear');
  return { s, rng };
};
// Risky fails about as often as stated, and a failure pushes you on to the next sector.
{
  let fails = 0, n = 500;
  for (let i = 0; i < n; i++) {
    const { s, rng } = atClear(i + 1), sector = s.run.sector;
    if (!E.attemptExtract(s, rng)) { fails++; assert(s.run, 'still in the raid'); assert.strictEqual(s.run.sector, sector + 1, 'forced deeper'); assert.strictEqual(s.lastResult.name, 'Extraction failed'); }
    else assert.strictEqual(s.run, null, 'got out');
  }
  const share = fails / n;
  assert(share > 0.1 && share < 0.2, `failed ${share}`);
  console.log(`PASS risky extraction failed ${Math.round(share * 100)}% of the time`);
}
// Safe always works and leaves only what you walked in with.
for (let i = 0; i < 50; i++) {
  const { s, rng } = atClear(1000 + i), c = s.char, kept = c.credits - E.unsecured(s), bank = c.xpBank || 0, xp = c.xp;
  assert(E.unsecured(s) > 0 || bank > 0, 'there was a haul to lose');
  E.safeExtract(s, rng);
  assert.strictEqual(s.run, null, 'always gets out');
  assert.strictEqual(c.credits, kept, 'no raid credits kept');
  assert.strictEqual(c.xp, xp, 'no raid XP kept');
}
console.log('PASS safe extraction always works and keeps nothing');
// No failure when leaving is free, right after a boss.
{
  const { s, rng } = atClear(5);
  s.run.sector = 5;
  assert.strictEqual(E.extractFailChance(s), 0);
  assert.strictEqual(E.attemptExtract(s, () => 0), true, 'a free exit can\'t fail');
  assert.strictEqual(s.run, null); void rng;
  console.log('PASS leaving after a boss is free and certain');
}
