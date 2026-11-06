// Quality-of-life behaviour: auto battle's safety stop and title guard, the damage preview, touch explanations, shop help, settings, keys, crash banner.
const { chromium } = require('playwright');
const assert = require('assert');
const URL = 'http://localhost:8765/index.html';
const setup = (body) => `(async () => {
  const E = await import('./engine.js'); const rng = E.seededRng(5); const s = E.newGame(rng);
  E.createChar(s, rng, E.newDraft(s.meta, rng)); s.screen = 'town'; const c = s.char;
  ${body}
  localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
})()`;
const fightSetup = `E.deploy(s, 'garrison', 1, rng); E.offerRoute(s, rng); E.enterRoom(s, 0, rng); while (s.screen !== 'combat') { if (s.screen === 'route') E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); } s.run.enemy.stun = 0; s.run.enemy.intent = 'attack'; s.run.enemy.quirk = null;`;
async function open(browser, opts, body, prefs = {}) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.evaluate(setup(body));
  await page.evaluate((p) => { for (const [k, v] of Object.entries(p)) localStorage.setItem(k, JSON.stringify(v)); }, prefs);
  await page.reload();
  return { page, ctx, errors };
}
const enter = async (page) => { await page.click('button[data-a="continue-title"]', { timeout: 4000 }); await page.waitForTimeout(500); };
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')));
const speed = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-speed')));
const PHONE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };
const DESK = { viewport: { width: 1280, height: 800 } };
(async () => {
  const browser = await chromium.launch();

  // Auto battle waits behind the title screen.
  let t = await open(browser, DESK, fightSetup, { 'cinder-cell-speed': 'auto2' });
  await t.page.waitForSelector('button[data-a="continue-title"]');
  await t.page.waitForTimeout(1500);
  const round0 = (await saved(t.page)).run.round;
  await t.page.waitForTimeout(1500);
  assert.strictEqual((await saved(t.page)).run.round, round0, 'auto battle played behind the title');
  console.log('PASS auto battle waits at the title');
  await t.ctx.close();

  // The safety stop.
  t = await open(browser, DESK, `${fightSetup} c.items.stim = 0; c.hp = 3; s.run.enemy.atk = 1;`, { 'cinder-cell-speed': 'auto1' });
  await enter(t.page); await t.page.waitForTimeout(700);
  assert.strictEqual(await speed(t.page), 'manual', 'auto should drop to manual');
  assert(/stopped/i.test(await t.page.textContent('#hint')), 'should say why');
  console.log('PASS auto battle stops at low HP with no stims');
  await t.page.keyboard.press('Tab');
  assert.strictEqual(await speed(t.page), 'auto1', 'Tab cycles the battle mode');
  await t.page.keyboard.press('Tab'); await t.page.keyboard.press('Tab');
  await t.ctx.close();

  // The preview.
  t = await open(browser, PHONE, `${fightSetup} c.hp = 1; s.run.pst = { bleed: 2 };`);
  await enter(t.page);
  assert(/Lethal/.test(await t.page.textContent('.intent-side')), 'lethal warning missing');
  assert(/^Take \d+-\d+/.test((await t.page.textContent('[data-v="defend"] .bs')).trim()), 'defend preview missing');
  console.log('PASS damage preview and lethal warning');
  // Holding a button explains it without pressing it.
  const r1 = (await saved(t.page)).run.round;
  await t.page.evaluate(() => { document.querySelector('[data-v="stim"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 5, clientY: 5 })); });
  await t.page.waitForTimeout(600);
  assert(/Restore/.test(await t.page.textContent('#hint')), 'hold should explain');
  await t.page.evaluate(() => { const b = document.querySelector('[data-v="stim"]'); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })); b.click(); });
  await t.page.waitForTimeout(300);
  assert.strictEqual((await saved(t.page)).run.round, r1, 'the hold pressed the button');
  // Tapping a status explains it.
  await t.page.evaluate(() => document.querySelector('.hud-player [data-st="bleed"]').click());
  assert(/Bleeding/.test(await t.page.textContent('#hint')), 'status tap should explain');
  console.log('PASS holding buttons and tapping statuses explain them');
  // Left-handed swap.
  const before = (await t.page.locator('.c-right').boundingBox()).x;
  await t.page.evaluate(() => { localStorage.setItem('cinder-cell-ui', JSON.stringify({ lefty: true })); });
  await t.page.reload(); await enter(t.page);
  assert((await t.page.locator('.c-right').boundingBox()).x < before, 'controls should move left');
  console.log('PASS left-handed fights');
  assert.deepStrictEqual(t.errors, []);
  await t.ctx.close();

  // Shop.
  t = await open(browser, DESK, `c.credits = 100000; c.items.stim = 0;`);
  await enter(t.page);
  await t.page.click('.shortcuts button[data-a="popup"][data-v="market"]');
  await t.page.waitForTimeout(200);
  for (const b of await t.page.$$('[data-a="markettab"]')) if (/suppl/i.test(await b.textContent())) await b.click();
  await t.page.waitForTimeout(200);
  await t.page.click('button[data-a="restock"]');
  await t.page.waitForTimeout(200);
  assert((await saved(t.page)).char.items.stim >= 2, 'restock should fill up');
  assert(/Full/.test(await t.page.textContent('.rows')), 'a full stack should say so');
  console.log('PASS restock and Full label');
  for (const b of await t.page.$$('[data-a="markettab"]')) if (/gear/i.test(await b.textContent())) await b.click();
  await t.page.waitForTimeout(200);
  const body = await t.page.textContent('.item-grid');
  assert(/Upgrade|Needs|Buy/.test(body), 'gear cards missing');
  assert(!/Requirements not met/.test(body), 'requirements should be named');
  console.log('PASS gear cards name requirements and flag upgrades');
  // Keys.
  await t.page.keyboard.press('Escape'); await t.page.waitForTimeout(150);
  await t.page.keyboard.press('m'); await t.page.waitForTimeout(200);
  assert.strictEqual((await saved(t.page)).popup, 'missions', 'M opens Missions');
  await t.page.keyboard.press('Escape'); await t.page.waitForTimeout(150);
  await t.page.keyboard.press('Escape'); await t.page.waitForTimeout(150);
  assert.strictEqual(await t.page.locator('[data-a="uipref"]').count(), 0, 'a spare Esc should do nothing');
  await t.page.keyboard.press('o'); await t.page.waitForTimeout(200);
  assert(await t.page.locator('[data-a="uipref"][data-v="calm"]').count(), 'O opens Settings');
  await t.page.click('[data-a="uipref"][data-v="calm"]');
  assert(await t.page.evaluate(() => document.documentElement.classList.contains('calm')), 'Reduce motion');
  console.log('PASS hotkeys and settings');
  await t.page.keyboard.press('Escape');
  // The crash banner.
  await t.page.evaluate(() => { setTimeout(() => { throw new Error('boom'); }, 0); });
  await t.page.waitForSelector('#crash');
  await t.page.click('#crash [data-c="close"]');
  assert.strictEqual(await t.page.locator('#crash').count(), 0);
  console.log('PASS crash banner');
  await t.ctx.close();

  // A corrupt save is kept, not thrown away.
  const ctx = await browser.newContext(DESK), page = await ctx.newPage();
  await page.goto(URL);
  await page.evaluate(() => localStorage.setItem('cinder-cell-save-v1', '{broken'));
  await page.reload(); await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('cinder-cell-save-v1-broken')), '{broken');
  console.log('PASS corrupt save kept');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
