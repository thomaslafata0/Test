const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const c = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const host = await c.newPage(), guest = await c.newPage(); const errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  for (const [p, n] of [[host, 'host'], [guest, 'guest']]) { p.on('pageerror', (e) => errors.push(`${n}: ${e.message} ${(e.stack || '').slice(0, 300)}`)); p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/WebSocket|net::|AudioContext/.test(m.text())) errors.push(`${n} console: ${m.text()}`); }); }
  await host.goto(URL);
  await host.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 900; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name: 'Hosty' })); });
  await host.reload(); await host.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await host.waitForTimeout(800);
  await host.click('button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(150); await host.click('button[data-a="coophost"]'); await host.waitForTimeout(300);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent); await host.keyboard.press('Escape');
  await guest.goto(URL + '?join=' + code); await guest.waitForTimeout(1000);
  await guest.click('button[data-a="step"][data-v="2"]'); await guest.click('button[data-a="bg"][data-v="runner"]'); await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100); await guest.click('button[data-a="create"]'); await guest.waitForTimeout(1200);
  const hs = () => host.evaluate(() => { const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1')); const g = (c) => Object.fromEntries(Object.entries(c.gear).map(([k, v]) => [k, v && v.base])); return { a: { cr: s.char.credits, gear: g(s.char) }, b: { cr: s.char2.credits, gear: g(s.char2) }, lock: [...(s.char.lockup || []), ...(s.char2.lockup || [])].map((x) => x.base), lockB: (s.char2.lockup || []).map((x) => x.base), trade: s.trade }; });
  const count = (o) => Object.values(o.a.gear).concat(Object.values(o.b.gear), o.lock).filter(Boolean).length;
  let s0 = await hs(); const total = count(s0), money = s0.a.cr + s0.b.cr;
  // Walk up to each other: force positions together, press E.
  const meet = async (p, q) => { await q.bringToFront(); await q.waitForTimeout(80); await p.bringToFront(); await p.evaluate(() => { const t = globalThis.cinderTown; t.player.x = t.partner.x; t.player.y = t.partner.y + 6; }); await p.waitForTimeout(250); };
  await meet(host, guest);
  check('prompt offers trade', /trade or give/.test(await host.innerText('.town-prompt')), await host.innerText('.town-prompt'));
  await host.keyboard.press('e'); await host.waitForTimeout(250);
  check('walking up opens the partner menu', await host.evaluate(() => (document.querySelector('.town-pop h2') || {}).textContent) === 'With your partner');
  await host.screenshot({ path: `${OUT}/s3-partner.png` });
  await host.click('button[data-a="givecredits"][data-v="100"]'); await host.waitForTimeout(400);
  let s1 = await hs(); check('host gives credits', s1.a.cr === s0.a.cr - 100 && s1.b.cr === s0.b.cr + 100, `${s1.a.cr}/${s1.b.cr}`);
  check('friend sees the credits', (await guest.innerText('.head-stats')).includes(String(s1.b.cr)));
  // gift gear, needs confirming
  const giveSlot = Object.entries(s1.a.gear).find(([, v]) => v)[0];
  await host.click(`button[data-a="givearm"][data-v="${giveSlot}"]`); await host.waitForTimeout(100);
  s1 = await hs(); check('one click does not give gear', s1.a.gear[giveSlot]);
  await host.click(`button[data-a="givegear"][data-v="${giveSlot}"]`); await host.waitForTimeout(400);
  let s2 = await hs(); check('host gives gear', !s2.a.gear[giveSlot], JSON.stringify(s2.lock));
  check('no gear lost or duped after gift', count(s2) === total, `${count(s2)} of ${total}`);
  // friend gives credits back through their own screen
  await host.click('button[data-a="closepopup"]'); await host.waitForTimeout(100);
  await meet(guest, host); await guest.keyboard.press('e'); await guest.waitForTimeout(250);
  await guest.click('button[data-a="givecredits"][data-v="10"]'); await guest.waitForTimeout(400);
  let s3 = await hs(); check('friend gives credits', s3.a.cr === s2.a.cr + 10, `${s3.a.cr}`);
  // Trade
  await guest.click('button[data-a="tradeask"]'); await guest.waitForTimeout(300);
  check('host is asked', /wants to trade/.test(await host.innerText('body')));
  await host.bringToFront(); await host.click('button[data-a="tradeanswer"][data-v="yes"]'); await host.waitForTimeout(300);
  await host.click('button[data-a="tradecredits"][data-v="100"]'); await host.waitForTimeout(200);
  const hSlot = Object.entries((await hs()).a.gear).find(([, v]) => v)[0];
  await host.click(`button[data-a="tradeslot"][data-v="${hSlot}"]`); await host.waitForTimeout(200);
  await guest.bringToFront(); await guest.click('button[data-a="tradecredits"][data-v="10"]'); await guest.waitForTimeout(200);
  await guest.click('button[data-a="tradeok"]'); await guest.waitForTimeout(200);
  await host.bringToFront(); await host.click('button[data-a="tradecredits"][data-v="-100"]'); await host.waitForTimeout(250);
  check('a change clears acceptance', (await hs()).trade.offers[1].ok === false);
  await host.click('button[data-a="tradecredits"][data-v="100"]'); await host.waitForTimeout(200);
  const pre = await hs();
  await host.screenshot({ path: `${OUT}/s3-trade.png` });
  await host.click('button[data-a="tradeok"]'); await host.waitForTimeout(200);
  check('one acceptance does nothing yet', !!(await hs()).trade);
  await guest.bringToFront(); await guest.click('button[data-a="tradeok"]'); await guest.waitForTimeout(400);
  const post = await hs();
  check('trade completes', !post.trade && post.a.cr === pre.a.cr - 90 && post.b.cr === pre.b.cr + 90, `${post.a.cr} ${post.b.cr}`);
  check('traded piece moved', !post.a.gear[hSlot] || post.a.gear[hSlot] !== pre.a.gear[hSlot]);
  check('no gear lost or duped after trade', count(post) === total, `${count(post)} of ${total}`);
  check('no money lost or duped', post.a.cr + post.b.cr === money, `${post.a.cr + post.b.cr} of ${money}`);
  // Lockup
  await host.bringToFront(); await host.click('button[data-a="popup"][data-v="lockup"]'); await host.waitForTimeout(250);
  await host.screenshot({ path: `${OUT}/s3-lockup.png`, fullPage: true });
  const before = await hs(), slot = Object.entries(before.a.gear).find(([, v]) => v);
  if (slot) { await host.click(`button[data-a="lockupstore"][data-v="${slot[0]}"]`); await host.waitForTimeout(300); const a = await hs(); check('store', !a.a.gear[slot[0]] && a.lock.includes(slot[1]), JSON.stringify(a.lock)); }
  await guest.bringToFront(); await guest.click('button[data-a="popup"][data-v="lockup"]'); await guest.waitForTimeout(250);
  const n0 = await hs(), mineSlot = Object.entries(n0.b.gear).find(([, v]) => v);
  await guest.click(`button[data-a="lockupstore"][data-v="${mineSlot[0]}"]`); await guest.waitForTimeout(350);
  const n1 = await hs(); check('friend stores on their own shelf', n1.lockB.length === n0.lockB.length + 1 && count(n1) === total);
  const take = await guest.$('button[data-a="lockuptake"]:not([disabled])');
  if (take) { await take.click(); await guest.waitForTimeout(350); const n2 = await hs(); check('friend takes from their own shelf', count(n2) === total && JSON.stringify(n1.b.gear) !== JSON.stringify(n2.b.gear)); } else check('friend can take something', false);
  await guest.screenshot({ path: `${OUT}/s3-lockup-guest.png` });
  console.log(errors.length ? errors : 'no errors');
  await browser.close();
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
