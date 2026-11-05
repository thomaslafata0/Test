// Global leaderboard: run `npx wrangler dev --port 8787` first, then `node tests/board.cjs`.
// Two separate browser profiles stand in for two people on different computers.
const { chromium } = require('playwright');
const assert = require('assert');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8787';
const tag = 't' + Date.now().toString(36);
const raid = (o = {}) => ({ id: tag + Math.random().toString(36).slice(2, 10), name: 'API', number: 1, background: 'foundry', level: 3, map: 'garrison', from: 1, to: 5, how: 'extracted', kills: 4, bosses: 1, cleared: 5, parts: { haul: 100, cleared: 750, kills: 100, elites: 0, bosses: 500, freed: 0 }, ...o });
const post = (b) => fetch(`${BASE}/board`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

async function finishRaid(page, name, credits) {
  return page.evaluate(async ({ name, credits }) => {
    const E = await import('./engine.js'); const rng = E.seededRng(3);
    const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1'));
    s.meta.boardShared = true;
    if (!s.char) E.createChar(s, rng); s.char.name = name; s.char.credits = 50; s.screen = 'town'; E.deploy(s, 'garrison', 1, rng);
    s.run.kills = 30; s.run.bosses = 2; s.run.cleared = 10; s.run.sector = 10; s.char.credits = credits;
    E.endRun(s, 'extracted', rng); s.char.payout = null;
    localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
    return s.meta.boardOut.length;
  }, { name, credits });
}

(async () => {
  // The API: score is worked out by the server, junk is refused, retries don't double up.
  const before = (await (await fetch(`${BASE}/board?limit=1`)).json()).total;
  const good = raid({ parts: { haul: 100, cleared: 999999, kills: 999999, elites: 0, bosses: 999999, freed: 0 } });
  let r = await post(good), o = await r.json();
  assert.strictEqual(r.status, 200); assert.strictEqual(o.score, 100 + 750 + 100 + 500, 'server works the score out itself');
  assert.strictEqual(o.total, before + 1);
  r = await post(good); o = await r.json(); assert.strictEqual(o.total, before + 1, 'a retry with the same id is not a second raid');
  for (const bad of [{ id: 'x' }, raid({ how: 'won' }), raid({ name: '' }), raid({ kills: -4 }), raid({ kills: 1e9 }), raid({ parts: { haul: 1e12 } })]) assert.strictEqual((await post(bad)).status, 400, JSON.stringify(bad).slice(0, 80));
  r = await post(raid({ name: '<img src=x onerror=alert(1)>' })); assert.strictEqual(r.status, 200);
  const list = await (await fetch(`${BASE}/board?limit=500`)).json();
  assert(!JSON.stringify(list.rows).includes('<img'), 'names are cleaned');
  console.log('api ok, total', list.total);

  // Two people.
  const errors = [], b = await chromium.launch();
  const open = async () => {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/index.html`); await page.waitForTimeout(600);
    return page;
  };
  const a = await open(), c = await open();
  const nameA = `Ana${tag}`, nameB = `Bo${tag}`;
  assert.strictEqual(await finishRaid(a, nameA, 90000), 1); assert.strictEqual(await finishRaid(c, nameB, 80000), 1);
  for (const p of [a, c]) { await p.reload(); await p.waitForTimeout(1200); }
  const queued = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')).meta.boardOut.length);
  assert.strictEqual(await queued(a), 0, 'first player’s raid was sent'); assert.strictEqual(await queued(c), 0, 'second player’s raid was sent');
  await a.click('button[data-a="modal"][data-v="board"]'); await a.waitForSelector('.board-table tbody tr');
  await a.waitForFunction((n) => document.querySelector('.board-table').textContent.includes(n), nameB);
  const seen = await a.$$eval('.board-table tbody tr', (rows, [x, y]) => rows.filter((t) => t.textContent.includes(x) || t.textContent.includes(y)).map((t) => [t.querySelector('b').textContent, t.classList.contains('mine')]), [nameA, nameB]);
  console.log('player A sees', JSON.stringify(seen));
  assert.deepStrictEqual(seen.map((x) => x[0]), [nameA, nameB], 'both raids, best first');
  assert.deepStrictEqual(seen.map((x) => x[1]), [true, false], 'only your own is highlighted');
  assert(/raids by everyone/.test(await a.textContent('.modal h2')));
  await a.screenshot({ path: `${OUT}/board-global.png` });

  // Offline: a raid waits, then gets sent when the board is back.
  await a.keyboard.press('Escape');
  await a.route('**/board*', (route) => route.abort());
  await finishRaid(a, `Off${tag}`, 3000); await a.reload(); await a.waitForTimeout(1000);
  assert.strictEqual(await queued(a), 1, 'kept while offline');
  await a.click('button[data-a="modal"][data-v="board"]'); await a.waitForTimeout(500);
  assert(/this device/.test(await a.textContent('.modal h2')), 'falls back to this device’s raids');
  await a.unroute('**/board*');
  await a.reload(); await a.waitForTimeout(1200);
  assert.strictEqual(await queued(a), 0, 'sent once back online');

  // Dev cells stay off.
  const devOut = await c.evaluate(async () => {
    const E = await import('./engine.js'), rng = E.seededRng(4), s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); s.meta.dev = true; s.meta.boardOut = [];
    s.screen = 'town'; s.char.dead = false; E.deploy(s, 'garrison', 1, rng); s.run.kills = 3; E.endRun(s, 'extracted', rng); return s.meta.boardOut.length;
  });
  assert.strictEqual(devOut, 0, 'dev cells stay off the board');
  console.log(errors.length ? errors : 'no errors'); assert(!errors.length);
  await b.close();
  console.log('PASS');
})().catch((e) => { console.error(e); process.exit(1); });
