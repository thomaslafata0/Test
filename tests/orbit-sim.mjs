// Orbit odds per tier and refit, for a sensible pilot and a fire-spamming one. Run: node tests/orbit-sim.mjs
import * as E from '../engine.js';
const smart = (o) => o.hull <= o.maxHull * 0.2 && o.eHull > o.eMaxHull * 0.5 ? 'jump' : (o.intent === 'volley' || o.intent === 'lock') ? 'evade' : o.intent === 'repair' ? 'overcharge' : 'fire';
const naive = () => 'fire';
function odds(tier, ship, pol, meta) {
  const N = 2000, out = {};
  for (let i = 0; i < N; i++) {
    const r = E.seededRng(1 + i), s = E.newGame(r); E.createChar(s, r); s.char.ejected = true;
    Object.assign(s.meta.ship, ship); Object.assign(s.meta, JSON.parse(JSON.stringify(meta)));
    if (!E.orbitStart(s, tier, r)) return 'locked: ' + E.orbitLock(s.meta, tier);
    let n = 0; while (!s.orbit.over && n++ < 80) E.orbitAct(s, pol(s.orbit), r);
    out[s.orbit.over] = (out[s.orbit.over] || 0) + 1;
  }
  return Object.entries(out).map(([k, v]) => `${k} ${(v / N * 100).toFixed(0)}`).join(' ');
}
const fresh = {}, won1 = { orbitWins: 1, orbitTierWins: { low: 1 } }, won2 = { orbitWins: 2, orbitTierWins: { low: 1, mid: 1 } };
for (const [lbl, tier, sh, m] of [['shakedown', 'low', {}, fresh], ['low stock after win', 'low', {}, won1], ['low hull1', 'low', { hull: 1 }, won1], ['low guns1', 'low', { guns: 1 }, won1], ['mid 3 refit', 'mid', { hull: 1, guns: 1, shields: 1 }, won1], ['mid all1', 'mid', { hull: 1, guns: 1, shields: 1, engines: 1 }, won1], ['mid no lowwin', 'mid', { hull: 1, guns: 1, shields: 1 }, fresh], ['high 6', 'high', { hull: 2, guns: 2, shields: 1, engines: 1 }, won2], ['high 9', 'high', { hull: 3, guns: 3, shields: 2, engines: 1 }, won2], ['high max', 'high', { hull: 3, guns: 3, shields: 3, engines: 3 }, won2]])
  console.log(lbl.padEnd(20), '| smart', odds(tier, sh, smart, m), '| naive', odds(tier, sh, naive, m));
