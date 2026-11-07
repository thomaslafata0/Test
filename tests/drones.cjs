// Drones in the game itself: choosing one, an old operative's free pick, upgrades, repairs, and a co-op friend paying for their own upgrade.
const { chromium } = require('playwright');
const assert = require('assert');
const URL = 'http://localhost:8765/index.html';
const seed = (body) => `(async () => { const E = await import('./engine.js'); const rng = E.seededRng(9); const s = E.newGame(rng); E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town'; const c = s.char; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; ${body} localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); })()`;
const saved = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')));
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (p, n) => p.on('pageerror', (e) => errors.push(`${n}: ${e.message}`));

  // Creation.
  let ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }), p = await ctx.newPage(); watch(p, 'create');
  await p.goto(URL);
  await p.evaluate(seed(`s.char = null; s.draft = E.newDraft(s.meta, rng); s.draft.step = 3; s.screen = 'create';`));
  await p.reload(); await p.tap('button[data-a="continue-title"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('button[data-a="draftdrone"]').count(), 4, 'four drones to pick from');
  await p.tap('button[data-a="draftdrone"][data-v="mender"]'); await p.waitForTimeout(100);
  assert.strictEqual(await p.getAttribute('button[data-a="draftdrone"][data-v="mender"]', 'aria-pressed'), 'true');
  await p.tap('button[data-a="step"][data-v="4"]'); await p.waitForTimeout(100);
  await p.tap('button[data-a="create"]'); await p.waitForTimeout(150); await p.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(400);
  assert.strictEqual((await saved(p)).char.drone.type, 'mender', 'the choice sticks');
  console.log('PASS choosing a drone at creation');
  await ctx.close();

  // An old operative with no drone.
  ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); p = await ctx.newPage(); watch(p, 'old');
  await p.goto(URL);
  await p.evaluate(seed(`delete c.drone; c.credits = 500; s.meta.resolve = 4;`));
  await p.reload(); await p.click('button[data-a="continue-title"]'); await p.waitForTimeout(400);
  assert(/!/.test(await p.textContent('.shortcuts [data-v="character"]')), 'the safehouse flags it');
  await p.click('.shortcuts [data-v="missions"]'); await p.waitForTimeout(200);
  assert(/No drone yet/.test(await p.textContent('.gate')), 'the mission screen offers it');
  await p.click('.gate-heal button[data-k="drone"]'); await p.waitForTimeout(200);
  await p.click('button[data-a="dronepick"][data-v="magpie"]'); await p.waitForTimeout(200);
  let s = await saved(p);
  assert.strictEqual(s.char.drone.type, 'magpie');
  console.log('PASS an old operative gets one free pick');
  await p.click('button[data-a="droneup"]'); await p.waitForTimeout(200);
  s = await saved(p);
  assert.strictEqual(s.char.drone.rank, 2); assert.strictEqual(s.meta.resolve, 0);
  console.log('PASS upgrading with Resolve');
  await ctx.close();

  // Repairs, from the mission screen.
  ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); p = await ctx.newPage(); watch(p, 'repair');
  await p.goto(URL);
  await p.evaluate(seed(`c.drone.damaged = true; c.credits = 400;`));
  await p.reload(); await p.tap('button[data-a="continue-title"]'); await p.waitForTimeout(400);
  await p.tap('.shortcuts [data-v="missions"]'); await p.waitForTimeout(200);
  assert(/offline/.test(await p.textContent('.gate')), 'warned before a raid');
  await p.tap('button[data-a="dronerepair"]'); await p.waitForTimeout(200);
  s = await saved(p);
  assert.strictEqual(s.char.drone.damaged, false); assert(s.char.credits < 400);
  console.log('PASS repairing costs credits');
  await ctx.close();

  // Co-op: both drones in the fight, and the friend pays from their own cell.
  ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const host = await ctx.newPage(), guest = await ctx.newPage(); watch(host, 'host'); watch(guest, 'guest');
  await host.goto(URL);
  await host.evaluate(seed(`c.credits = 900; c.drone.type = 'aegis'; s.meta.resolve = 40;`));
  await host.reload(); await host.click('button[data-a="continue-title"]'); await host.waitForTimeout(500);
  await host.click('button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(150);
  await host.click('button[data-a="coophost"]'); await host.waitForTimeout(300);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent);
  await host.keyboard.press('Escape');
  await guest.goto(`${URL}?join=${code}`); await guest.waitForTimeout(800);
  await guest.click('button[data-a="step"][data-v="3"]'); await guest.waitForTimeout(100);
  await guest.click('button[data-a="draftdrone"][data-v="hornet"]');
  await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100);
  await guest.click('button[data-a="create"]'); await guest.waitForTimeout(150); await guest.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await guest.waitForTimeout(600);
  s = await saved(host);
  assert.strictEqual(s.char2.drone.type, 'hornet', 'the friend brings their drone');
  assert.strictEqual(s.char.drone.type, 'aegis');
  // The friend has no Resolve yet: no upgrade.
  const before = s.meta.resolve;
  await guest.click('.shortcuts [data-v="character"]'); await guest.waitForTimeout(200);
  await guest.click('[data-k="drone"]'); await guest.waitForTimeout(200);
  assert(await guest.locator('button[data-a="droneup"]').isDisabled(), 'no Resolve, no upgrade');
  await guest.evaluate(() => globalThis.cinderTestHome && globalThis.cinderTestHome(5)); await guest.waitForTimeout(100);
  await guest.click('[data-k="drone"]'); await guest.waitForTimeout(200);
  await guest.click('button[data-a="droneup"]'); await guest.waitForTimeout(500);
  s = await saved(host);
  assert.strictEqual(s.char2.drone.rank, 2, 'the host raises the friend\'s rank');
  assert.strictEqual(s.meta.resolve, before, 'the host\'s Resolve is untouched');
  console.log('PASS a co-op friend upgrades with their own Resolve');
  await browser.close();
  assert.deepStrictEqual(errors, []);
  console.log('no errors');
})().catch((e) => { console.error(e); process.exit(1); });
