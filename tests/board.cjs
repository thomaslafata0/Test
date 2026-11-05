// Global leaderboard: run `npx wrangler dev --port 8787` first, then `node tests/board.cjs`.
// Two separate browser profiles stand in for two people on different computers.
const { chromium } = require('playwright');
const assert = require('assert');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8787';
const tag = 't' + Date.now().toString(36);
const uid = () => tag + Math.random().toString(36).slice(2, 10);
const row = (o = {}) => ({ id: uid(), name: 'API', number: 1, background: 'foundry', level: 3, status: 'alive', raids: 2, kills: 9, bosses: 1, progress: [{ map: 'garrison', threat: 0, best: 5 }], ...o });
const post = (b) => fetch(`${BASE}/board`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const list = async () => (await fetch(`${BASE}/board?limit=500`)).json();

// Plays out the numbers of a raid in the player's own browser and saves the result.
async function raid(page, name, sector, opts = {}) {
  return page.evaluate(async ({ name, sector, opts }) => {
    const E = await import('./engine.js'); const rng = E.seededRng(3);
    const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1'));
    if (!s.char) E.createChar(s, rng); s.char.name = name; s.char.hp = 50; s.screen = 'town'; s.meta.threat = opts.threat || 0;
    const start = E.insertionsAt(s.char, 'garrison', s.meta.threat).includes(sector) ? sector : 1;
    E.deploy(s, 'garrison', start, rng);
    s.run.sector = sector; s.run.kills = 5; s.char.credits += 99999;
    // Clear the sector for real, through the fight's last room.
    s.run.room = 99; s.run.enemy = null; E.offerRoute(s, rng);
    if (s.screen !== 'sectorClear') throw new Error('expected sectorClear, got ' + s.screen);
    E.endRun(s, 'extracted', rng); s.char.payout = null;
    localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
    return { out: s.meta.boardOut.length, score: E.careerScore(s.char), best: s.char.maps.garrison.best };
  }, { name, sector, opts });
}

(async () => {
  // Score: worked out by the server from progress. Nothing the client claims about score counts.
  let id = uid(), r = await post(row({ id, score: 999999 })), o = await r.json();
  assert.strictEqual(r.status, 200); assert.strictEqual(o.score, 900, '5 sectors + a boss, not what the client claimed');
  const before = o.total;
  // One row per operative, however many times it reports.
  r = await post(row({ id, progress: [{ map: 'garrison', threat: 0, best: 5 }] })); o = await r.json();
  assert.strictEqual(o.total, before, 'the same operative is one row'); assert.strictEqual(o.score, 900, 're-clearing adds nothing');
  r = await post(row({ id, progress: [{ map: 'garrison', threat: 0, best: 15 }] })); o = await r.json();
  assert.strictEqual(o.score, 1500 + 1200 + 1000, 'sectors, three bosses, liberation');
  r = await post(row({ id, progress: [{ map: 'garrison', threat: 0, best: 15 }, { map: 'garrison', threat: 2, best: 5 }] })); o = await r.json();
  assert.strictEqual(o.score, 3700 + 1800, 'threat II counts on top at double');
  r = await post(row({ id, progress: [{ map: 'garrison', threat: 0, best: 5 }] })); o = await r.json();
  assert.strictEqual(o.score, 5500, 'a score never goes down');
  r = await post(row({ id, status: 'died', killer: 'The Warden', progress: [{ map: 'garrison', threat: 0, best: 15 }, { map: 'garrison', threat: 2, best: 5 }] })); o = await r.json();
  r = await post(row({ id, status: 'alive', progress: [{ map: 'garrison', threat: 0, best: 15 }, { map: 'garrison', threat: 2, best: 10 }] })); o = await r.json();
  assert.strictEqual(o.score, 5500, 'dead stays dead: a died row is final');
  let all = await list();
  const dead = all.rows.find((x) => x.tag === o.tag);
  assert.strictEqual(dead.status, 'died'); assert.strictEqual(dead.killer, 'The Warden');
  assert(all.rows.every((x) => !('id' in x)), 'operative ids are never handed out');
  for (const bad of [{ id: 'x' }, row({ status: 'winning' }), row({ name: '' }), row({ kills: -4 }), row({ progress: [] }), row({ progress: [{ map: 'garrison', threat: 0, best: 5000 }] }), row({ progress: [{ map: 'garrison', threat: 0, best: 5 }, { map: 'garrison', threat: 0, best: 15 }] })]) assert.strictEqual((await post(bad)).status, 400, JSON.stringify(bad).slice(0, 90));
  r = await post(row({ name: '<img src=x onerror=alert(1)>' })); assert.strictEqual(r.status, 200);
  all = await list(); assert(!JSON.stringify(all.rows).includes('<img'), 'names are cleaned');
  console.log('api ok, total', all.total);

  const errors = [], b = await chromium.launch();
  const open = async () => {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/index.html`); await page.waitForTimeout(600);
    return page;
  };
  const queued = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')).meta.boardOut.length);
  const a = await open(), c = await open();
  const nameA = `Ana${tag}`, nameB = `Bo${tag}`;

  // A career in the real engine: new ground scores, going back over it doesn't, and threat counts on top.
  let res = await raid(a, nameA, 5); assert.strictEqual(res.score, 900);
  await a.reload(); await a.waitForTimeout(1200); assert.strictEqual(await queued(a), 0, 'row sent');
  res = await raid(a, nameA, 5); assert.strictEqual(res.score, 900, 're-clearing a sector scores nothing');
  await a.reload(); await a.waitForTimeout(1200);
  res = await raid(a, nameA, 3); assert.strictEqual(res.score, 900, 'nor does clearing an easier one');
  await a.reload(); await a.waitForTimeout(1200);
  res = await raid(a, nameA, 5, { threat: 1 }); assert.strictEqual(res.score, 900 + 1350, 'threat I counts on top');
  await a.reload(); await a.waitForTimeout(1200);
  await raid(c, nameB, 2); await c.reload(); await c.waitForTimeout(1200);

  await a.click('button[data-a="modal"][data-v="board"]'); await a.waitForSelector('.board-table tbody tr');
  await a.waitForFunction((n) => document.querySelector('.board-table').textContent.includes(n), nameB);
  const seen = await a.$$eval('.board-table tbody tr', (rows, [x, y]) => rows.filter((t) => t.textContent.includes(x) || t.textContent.includes(y)).map((t) => [t.querySelector('b').textContent, t.classList.contains('mine'), t.querySelector('.score').textContent]), [nameA, nameB]);
  console.log('player A sees', JSON.stringify(seen));
  assert.deepStrictEqual(seen, [[nameA, true, '2,250'], [nameB, false, '200']], 'one row each, best first, only your own highlighted');
  assert(/operatives, everyone/.test(await a.textContent('.modal h2')));
  await a.screenshot({ path: `${OUT}/board-global.png` });

  // Offline: the row waits, and only the newest copy gets sent.
  await a.keyboard.press('Escape');
  await a.route('**/board*', (route) => route.abort());
  await raid(a, nameA, 6); await raid(a, nameA, 7); await a.reload(); await a.waitForTimeout(1000);
  assert.strictEqual(await queued(a), 1, 'one waiting row for one operative');
  await a.click('button[data-a="modal"][data-v="board"]'); await a.waitForTimeout(500);
  assert(/this device/.test(await a.textContent('.modal h2')), 'falls back to this device\u2019s operatives');
  await a.unroute('**/board*');
  await a.reload(); await a.waitForTimeout(1200);
  assert.strictEqual(await queued(a), 0, 'sent once back online');

  // Dev cells stay off.
  const devOut = await c.evaluate(async () => {
    const E = await import('./engine.js'), rng = E.seededRng(4), s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); s.meta.dev = true; s.meta.boardOut = [];
    s.screen = 'town'; E.deploy(s, 'garrison', 1, rng); s.run.kills = 3; E.endRun(s, 'extracted', rng); return s.meta.boardOut.length;
  });
  assert.strictEqual(devOut, 0, 'dev cells stay off the board');
  console.log(errors.length ? errors : 'no errors'); assert(!errors.length);
  await b.close();
  console.log('PASS');
})().catch((e) => { console.error(e); process.exit(1); });
