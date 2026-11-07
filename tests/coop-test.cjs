// Two tabs in one browser context, joined through the BroadcastChannel transport: host creates, friend joins and creates,
// both ready, host deploys, they take turns in a fight.
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const host = await ctx.newPage(), guest = await ctx.newPage();
  const errors = [];
  for (const [p, n] of [[host, 'host'], [guest, 'guest']]) { p.on('pageerror', (e) => errors.push(`${n}: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/town\/street\//.test(m.location().url)) errors.push(`${n} console: ${m.text()}`); }); }
  await host.goto('http://localhost:8765/index.html');
  await host.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 300; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-speed', JSON.stringify('manual')); localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name: 'Hosty' })); });
  await host.reload(); await host.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await host.waitForTimeout(900);
  // host opens settings and hosts
  await host.click('button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(200);
  await host.click('button[data-a="coophost"]'); await host.waitForTimeout(400);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent);
  console.log('room code', code);
  await host.keyboard.press('Escape');
  // guest page: same save in localStorage (same browser), joins
  await guest.goto('http://localhost:8765/index.html'); await guest.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await guest.waitForTimeout(900);
  await guest.click('button[data-a="modal"][data-v="settings"]'); await guest.waitForTimeout(200);
  await guest.fill('#coop-name', 'Buddy');
  await guest.fill('#coop-code', code);
  await guest.click('button[data-a="coopjoin"]'); await guest.waitForTimeout(800);
  await guest.keyboard.press('Escape'); await guest.waitForTimeout(400);
  const gScreen = () => guest.evaluate(() => document.querySelector('h2') && document.querySelector('h2').textContent);
  console.log('guest sees:', await gScreen());
  await guest.screenshot({ path: `${OUT}/coop-guest-create.png` });
  // guest creates an operative
  await guest.click('button[data-a="step"][data-v="2"]'); await guest.click('button[data-a="bg"][data-v="runner"]'); await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100);
  await guest.click('button[data-a="create"]'); await guest.waitForTimeout(150); await guest.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await guest.waitForTimeout(700);
  console.log('guest after create:', await gScreen(), '| host chip:', await host.evaluate(() => (document.querySelector('.head-stats .chip') || {}).textContent));
  const hostState = () => host.evaluate(() => { const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); return { coop: s.coop, c1: s.char && s.char.name, c2: s.char2 && s.char2.name, ready: s.guestReady, screen: s.screen, actor: s.run && s.run.actor }; });
  console.log('host state:', JSON.stringify(await hostState()));
  // guest ready, host deploys
  await guest.click('button[data-a="popup"][data-v="missions"]'); await guest.waitForTimeout(200);
  await guest.click('.popup button[data-a="coopready"]'); await guest.waitForTimeout(500);
  await host.click('button[data-a="popup"][data-v="missions"]'); await host.waitForTimeout(300);
  await host.screenshot({ path: `${OUT}/coop-host-missions.png` });
  await host.click('button[data-a="deploy"]'); await host.waitForTimeout(600);
  console.log('after deploy:', JSON.stringify(await hostState()), '| guest h2:', await gScreen());
  // walk doors until combat, then alternate turns for a while
  let fights = 0;
  for (let i = 0; i < 40; i++) {
    const st = await hostState();
    if (!st.screen) break;
    if (st.screen === 'route') { await host.keyboard.press('1'); await guest.keyboard.press('1'); await host.waitForTimeout(400); continue; }
    if (st.screen === 'combat') {
      if (fights === 0) { await host.waitForTimeout(600); await host.screenshot({ path: `${OUT}/coop-host-combat.png` }); await guest.screenshot({ path: `${OUT}/coop-guest-combat.png` }); }
      fights++;
      const page = st.actor === 0 ? host : guest;
      const other = st.actor === 0 ? guest : host;
      const lockedOther = await other.evaluate(() => !!document.querySelector('.actions.locked'));
      if (!lockedOther) errors.push(`turn ${i}: the non-acting player's buttons are not locked (actor ${st.actor})`);
      await page.keyboard.press('a'); await page.waitForTimeout(2600);
      continue;
    }
    if (['loot', 'perk'].includes(st.screen)) { for (const p of [host, guest]) { const b = (await p.$('button[data-a="lootsell"]')) || (await p.$('button[data-a="perk"][data-v=""]')); if (b) await b.click(); await p.waitForTimeout(250); } continue; }
    if (st.screen === 'sectorClear') { await host.keyboard.press('2'); await guest.keyboard.press('2'); await host.waitForTimeout(400); continue; }
    if (st.screen === 'event') { const b = await host.$('button[data-a="event"]'); if (b) await b.click(); await host.waitForTimeout(150); const d = await host.$('button[data-a="eventDone"]'); if (d) await d.click(); await host.waitForTimeout(300); continue; }
    if (st.screen === 'town' || st.screen === 'death' || st.screen === 'create') break;
    await host.waitForTimeout(200);
  }
  const fin = await hostState();
  console.log('end:', JSON.stringify(fin), 'fights stepped:', fights, '| guest h2:', await gScreen());
  await host.screenshot({ path: `${OUT}/coop-host-end.png` }); await guest.screenshot({ path: `${OUT}/coop-guest-end.png` });
  console.log(errors.length ? errors : 'no errors');
  await browser.close();
})();
