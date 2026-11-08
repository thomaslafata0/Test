// Friends and spectating: a friend code shows, a friend is added by code, a watcher sees the friend's town and a fight
// with every action blocked, the friend sees "1 watching", and Leave takes the watcher back to their own game.
// /presence is answered here by the real Presence class from coop/worker.js. The spectator room runs on the two-tab transport.
// The watcher's tab gets its own localStorage (keys prefixed W:), so the two tabs are two devices with two friend codes.
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = path.join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const { Presence } = await import(pathToFileURL(path.join(__dirname, '..', 'coop', 'worker.js')).href);
  const pres = new Presence();
  const browser = await chromium.launch();
  const c = await browser.newContext({ viewport: { width: 844, height: 390 } });
  let presCalls = 0; const presKeys = new Set();
  await c.route('**/presence', async (route) => {
    presCalls++;
    try { const b = JSON.parse(route.request().postData() || '{}'); for (const k of Object.keys(b)) presKeys.add(k); if (/@/.test(route.request().postData() || '')) presKeys.add('@'); } catch (e) {}
    const res = await pres.fetch(new Request('http://worker/presence', { method: route.request().method(), body: route.request().postData() || '' }));
    await route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  const host = await c.newPage(), watcher = await c.newPage(); const errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  for (const [p, n] of [[host, 'host'], [watcher, 'watcher']]) { p.on('pageerror', (e) => errors.push(`${n}: ${e.message} ${(e.stack || '').slice(0, 300)}`)); p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/town\/street\//.test(m.location().url) && !/WebSocket|net::|AudioContext/.test(m.text())) errors.push(`${n} console: ${m.text()}`); }); }
  await host.addInitScript(() => { globalThis.cinderPresenceTest = true; });
  await watcher.addInitScript(() => {
    globalThis.cinderPresenceTest = true;
    const P = Storage.prototype, get = P.getItem, set = P.setItem, del = P.removeItem;
    const k = (st, key) => (st === window.localStorage ? `W:${key}` : key);
    P.getItem = function (key) { return get.call(this, k(this, key)); };
    P.setItem = function (key, v) { return set.call(this, k(this, key), v); };
    P.removeItem = function (key) { return del.call(this, k(this, key)); };
  });
  const seed = (name, n) => async ({ name, n }) => { const E = await import('./engine.js'), rng = E.seededRng(n), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 400; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name })); localStorage.setItem('cinder-cell-speed', JSON.stringify('manual')); };
  for (const [p, name, n] of [[host, 'Hosty', 21], [watcher, 'Watchy', 33]]) {
    await p.goto(URL);
    await p.evaluate(await seed(), { name, n });
    await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(700);
  }
  const hostOp = await host.evaluate(() => cinderGame.state().char.name), myOp = await watcher.evaluate(() => cinderGame.state().char.name);
  check('two separate games', hostOp !== myOp, `${hostOp} / ${myOp}`);

  // Friend codes: the Menu has Friends, and it shows this device's code.
  const openFriends = async (p) => { await p.click('button[data-a="modal"][data-v="menu"]'); await p.waitForTimeout(150); await p.click('.menu-grid button[data-v="friends"]'); await p.waitForFunction(() => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test((document.querySelector('.friend-code') || {}).textContent || ''), null, { timeout: 4000 }); };
  await host.bringToFront(); await openFriends(host);
  const hostCode = (await host.textContent('.friend-code')).trim();
  check('the friend code shows', /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(hostCode), hostCode);
  await watcher.bringToFront(); await openFriends(watcher);
  const myCode = (await watcher.textContent('.friend-code')).trim();
  check('each device has its own code', myCode !== hostCode, `${hostCode} / ${myCode}`);
  check('the code is kept on the device', await watcher.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-friend')).code.length === 8));

  // Phone landscape: the Friends screen fits, with big enough buttons.
  const fit = await watcher.evaluate(() => { const m = document.querySelector('.friends-modal'), r = m.getBoundingClientRect(); const small = [...m.querySelectorAll('button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).map((b) => b.textContent.trim()); return { over: document.documentElement.scrollWidth > innerWidth + 1 || r.right > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, small }; });
  check('the Friends screen fits 844x390 with no sideways scroll', !fit.over, JSON.stringify(fit));
  check('every Friends button is at least 40px tall', !fit.small.length, fit.small.join(','));

  // Add the host by code. The list fills in their name and what they're doing.
  await watcher.fill('#friend-code', hostCode.toLowerCase()); await watcher.click('button[data-a="friendadd"]'); await watcher.waitForTimeout(200);
  check('the friend is on the list', await watcher.locator('.friend-row').count() === 1);
  check('the list is stored on the device', await watcher.evaluate((code) => JSON.parse(localStorage.getItem('cinder-cell-friends')).some((f) => f.code === code), hostCode.replace('-', '')));
  await watcher.fill('#friend-code', myCode); await watcher.click('button[data-a="friendadd"]'); await watcher.waitForTimeout(150);
  check('your own code is refused', await watcher.locator('.friend-row').count() === 1);
  await watcher.waitForFunction(() => /Hosty/.test(document.querySelector('.friend-row').textContent) && /In town/.test(document.querySelector('.friend-row').textContent), null, { timeout: 5000 }).catch(() => {});
  const rowText = await watcher.textContent('.friend-row');
  check('the friend shows online in town, by name', /Hosty/.test(rowText) && /In town/.test(rowText) && rowText.includes(hostOp.split(' ')[0]), rowText);
  check('an online friend in a game has Watch', await watcher.locator('.friend-row button[data-a="watch"]').count() === 1);
  await watcher.screenshot({ path: `${OUT}/spectate-friends.png` });

  // Watch: the ask goes through the server; the host's next check-in (forced here instead of waiting 30 s) opens the room.
  await watcher.click('.friend-row button[data-a="watch"]'); await watcher.waitForTimeout(300);
  check('the watcher is told it is asking', /Watching Hosty/.test(await watcher.textContent('#app')));
  await host.bringToFront(); await host.keyboard.press('Escape'); await host.evaluate(() => cinderFriends.tick()); await host.waitForTimeout(400);
  check('the host opens a spectator room', await host.evaluate(() => !!cinderFriends.spect()));
  await watcher.bringToFront();
  await watcher.waitForFunction(() => document.querySelector('#app .town') && document.querySelector('.watch-banner'), null, { timeout: 8000 }).catch(() => {});
  const banner = await watcher.textContent('.watch-banner').catch(() => '');
  check('a banner says Watching Hosty, with Leave', /Watching Hosty/.test(banner) && await watcher.locator('.watch-banner button[data-a="watchleave"]').count() === 1, banner);
  check('the watcher sees the host\u2019s town and operative', await watcher.locator('#app .town').count() === 1 && (await watcher.textContent('.status')).includes(hostOp), hostOp);
  await host.bringToFront(); await host.waitForTimeout(300);
  check('the host sees 1 watching', /1 watching/.test(await host.textContent('.status').catch(() => '')));
  check('the host\u2019s presence says one watcher', await host.evaluate(() => cinderFriends.spect().watchers.size === 1));

  // The host walks; the watcher's figure follows.
  await host.evaluate(() => { const t = cinderTown; t.walkTo(t.player.x + 60, t.player.y + 30); }); await host.waitForTimeout(1500);
  const hp = await host.evaluate(() => [Math.round(cinderTown.player.x), Math.round(cinderTown.player.y)]);
  await watcher.bringToFront(); await watcher.waitForTimeout(900);
  const wp = await watcher.evaluate(() => [Math.round(cinderTown.player.x), Math.round(cinderTown.player.y)]);
  check('the watcher\u2019s view follows the host around town', Math.hypot(hp[0] - wp[0], hp[1] - wp[1]) < 8, `${hp} / ${wp}`);

  // Blocked: opening a menu, walking, saving.
  const before = await watcher.evaluate(() => localStorage.getItem('cinder-cell-save-v1'));
  await watcher.evaluate(() => { const b = document.querySelector('.shortcuts button[data-a="popup"]'); if (b) b.click(); }); await watcher.waitForTimeout(200);
  check('a town menu doesn\u2019t open for the watcher', await watcher.evaluate(() => !cinderGame.state().popup));
  check('the host\u2019s game is untouched', await host.evaluate(() => !cinderGame.state().popup));
  await watcher.keyboard.press('m'); await watcher.waitForTimeout(150);
  check('keys do nothing either', await watcher.evaluate(() => !cinderGame.state().popup));
  check('the town is locked for the watcher', await watcher.evaluate(() => cinderTown.blocked === true));

  // A fight on the host: the watcher sees the stage, and the shot lands on both screens.
  await host.bringToFront();
  await host.evaluate(async (toFight) => { const E = await import('./engine.js'); const s = cinderGame.state(), rng = cinderGame.rng(); E.deploy(s, 'garrison', 1, rng); new Function('s', 'E', 'rng', toFight)(s, E, rng); cinderGame.after(); }, `for (let i = 0; i < 30 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) { const k = s.run.choices.findIndex((x) => x === 'fight' || x === 'elite'); E.enterRoom(s, Math.max(0, k), rng); } else E.offerRoute(s, rng); if (['event', 'room'].includes(s.screen)) { s.screen = 'route'; s.run.choices = null; } }`);
  await host.waitForTimeout(1200);
  check('the host is in a fight', await host.evaluate(() => cinderGame.state().screen === 'combat'));
  await watcher.bringToFront(); await watcher.waitForTimeout(1000);
  check('the watcher sees the fight on the stage', await watcher.evaluate(() => cinderGame.state().screen === 'combat' && !!document.querySelector('#app .stage')));
  const ehp = async (p) => p.evaluate(() => cinderGame.state().run.enemy && cinderGame.state().run.enemy.hp);
  const e0 = await ehp(host);
  await watcher.evaluate(() => { const b = document.querySelector('button[data-a="act"][data-v="shoot"]'); if (b) b.click(); }); await watcher.keyboard.press('a'); await watcher.waitForTimeout(600);
  check('the watcher can\u2019t shoot', await ehp(host) === e0, `${e0} > ${await ehp(host)}`);
  await watcher.evaluate(() => { const st = cinderGame.stage, play = st.play.bind(st); st.play = (ev) => { globalThis.fxSeen = (globalThis.fxSeen || 0) + 1; return play(ev); }; });
  await host.bringToFront(); await host.click('button[data-a="act"][data-v="shoot"]'); await host.waitForTimeout(400);
  await watcher.bringToFront(); await watcher.waitForTimeout(2500); await host.bringToFront(); await host.waitForTimeout(800); await watcher.bringToFront(); await watcher.waitForTimeout(800);
  const e1 = await ehp(host), w1 = await ehp(watcher);
  check('the host\u2019s shot shows on the watcher\u2019s screen', e1 !== e0 && w1 === e1, `${e0} > host ${e1}, watcher ${w1}`);
  check('the watcher sees the shot animate', await watcher.evaluate(() => (globalThis.fxSeen || 0) >= 1));
  check('the watcher\u2019s fight buttons look off', await watcher.evaluate(() => document.getElementById('app').classList.contains('watching')));
  await watcher.screenshot({ path: `${OUT}/spectate-fight.png` });
  check('the watcher\u2019s own save is untouched', await watcher.evaluate((b) => localStorage.getItem('cinder-cell-save-v1') === b, before));

  // Leave: back to the watcher's own operative, and the host's count drops.
  await watcher.click('.watch-banner button[data-a="watchleave"]'); await watcher.waitForTimeout(500);
  check('Leave goes back to the watcher\u2019s own game', await watcher.evaluate((n) => !cinderFriends.watch() && cinderGame.state().char.name === n && !cinderGame.state().run && !document.querySelector('.watch-banner'), myOp));
  await host.bringToFront(); await host.waitForTimeout(500);
  check('the host no longer has a watcher', await host.evaluate(() => !cinderFriends.spect() || cinderFriends.spect().watchers.size === 0));
  check('the host\u2019s fight carried on as normal', await host.evaluate(() => cinderGame.state().screen === 'combat' || !!cinderGame.state().run));

  // The host hosts co-op and a friend joins: the watcher can still watch, and sees both operatives.
  await host.evaluate(() => { cinderGame.state().run = null; cinderGame.state().screen = 'town'; cinderGame.after(); }); await host.waitForTimeout(300);
  await host.click('button[data-a="modal"][data-v="menu"]'); await host.waitForTimeout(150); await host.click('.menu-grid button[data-v="settings"]'); await host.waitForTimeout(150);
  await host.click('button[data-a="coophost"]'); await host.waitForTimeout(300);
  const room = await host.evaluate(() => document.querySelector('.settings b.num').textContent); await host.keyboard.press('Escape');
  const guest = await c.newPage();
  guest.on('pageerror', (e) => errors.push(`guest: ${e.message}`));
  await guest.addInitScript(() => { const P = Storage.prototype, get = P.getItem, set = P.setItem, del = P.removeItem, k = (st, key) => (st === window.localStorage ? `G:${key}` : key); P.getItem = function (key) { return get.call(this, k(this, key)); }; P.setItem = function (key, v) { return set.call(this, k(this, key), v); }; P.removeItem = function (key) { return del.call(this, k(this, key)); }; });
  await guest.goto(URL); await guest.evaluate(() => localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name: 'Guesty' })));
  await guest.goto(URL + '?join=' + room); await guest.waitForTimeout(1000);
  await guest.click('button[data-a="step"][data-v="2"]'); await guest.click('button[data-a="bg"][data-v="runner"]'); await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100); await guest.click('button[data-a="create"]'); await guest.waitForTimeout(150); await guest.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await guest.waitForTimeout(1200);
  await host.bringToFront(); await host.waitForTimeout(500);
  const mate = await host.evaluate(() => cinderGame.state().char2 && cinderGame.state().char2.name);
  check('a co-op friend joins the host', !!mate, String(mate));
  await watcher.bringToFront(); await openFriends(watcher); await watcher.waitForTimeout(400);
  await watcher.click('.friend-row button[data-a="watch"]'); await watcher.waitForTimeout(300);
  await host.bringToFront(); await host.evaluate(() => cinderFriends.tick()); await host.waitForTimeout(400);
  await watcher.bringToFront();
  await watcher.waitForFunction(() => document.querySelector('#app .town') && document.querySelector('.watch-banner'), null, { timeout: 8000 }).catch(() => {});
  check('the watcher can watch a co-op host, partner and all', mate && (await watcher.textContent('.status').catch(() => '')).includes(mate.split(' ')[0]) && await watcher.evaluate(() => !!cinderGame.state().char2));
  await guest.bringToFront(); await guest.waitForTimeout(300);
  check('the co-op friend\u2019s game carries on', await guest.evaluate(() => !!document.querySelector('#app .town') && !document.querySelector('.watch-banner')));
  await watcher.bringToFront(); await watcher.click('.watch-banner button[data-a="watchleave"]'); await watcher.waitForTimeout(400);
  check('Leave works after a co-op watch', await watcher.evaluate((n) => !cinderFriends.watch() && cinderGame.state().char.name === n && !cinderGame.state().char2, myOp));
  await guest.close();

  // Let friends watch, off: the Watch button goes.
  await host.bringToFront();
  await openFriends(host); await host.click('button[data-a="watchallow"]'); await host.waitForTimeout(100);
  await host.evaluate(() => cinderFriends.tick()); await host.waitForTimeout(300);
  check('the host can turn watching off', await host.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-friend')).allow === false && !cinderFriends.spect()));
  await watcher.bringToFront(); await openFriends(watcher); await watcher.waitForTimeout(600);
  check('with watching off there is no Watch button', await watcher.locator('.friend-row button[data-a="watch"]').count() === 0, await watcher.textContent('.friend-row'));
  // Remove takes two taps.
  await watcher.click('.friend-row button[data-a="frienddel"]'); await watcher.waitForTimeout(100);
  check('Remove asks again first', await watcher.locator('.friend-row').count() === 1);
  await watcher.click('.friend-row button[data-a="frienddel"]'); await watcher.waitForTimeout(100);
  check('Remove takes the friend off the list', await watcher.locator('.friend-row').count() === 0 && await watcher.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-friends')).length === 0));
  check('presence was used', presCalls > 3, String(presCalls));
  check('presence carries only name and game info', [...presKeys].every((k) => ['key', 'name', 'op', 'where', 'coop', 'open', 'room', 'watchers', 'want', 'watch'].includes(k)), [...presKeys].join(','));
  await browser.close();
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  console.log(real.length ? real.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(real.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
