// Random touch play on a sideways phone: taps anything enabled, and reports crashes, stuck screens, bad numbers and play screens that need scrolling.
// Usage: node tests/phone-monkey.cjs [steps=400] [seed=1]
const { chromium } = require('playwright'); const STEPS = +process.argv[2] || 400, SEED = +process.argv[3] || 1;
let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
(async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }); const p = await c.newPage(); p.setDefaultTimeout(6000); const errors = new Set();
 p.on('pageerror', (e) => errors.add('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.add('CONSOLE ' + m.text().slice(0, 160)); });
 await p.goto('http://localhost:8765/index.html');
 await p.evaluate(async (seed) => { localStorage.setItem('cinder-cell-speed', JSON.stringify('auto2')); const E = await import('./engine.js'), rng = E.seededRng(seed), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; s.char.credits = 800; s.meta.tips = { town: true, combat: true, route: true, perk: true, loot: true, gear: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); }, SEED);
 await p.reload(); await p.tap('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await p.waitForTimeout(600);
 const seen = {}, over = {}; let last = '', same = 0;
 for (let i = 0; i < STEPS; i++) {
  if (!(await p.evaluate(() => !!globalThis.cinderGame))) { await p.waitForTimeout(200); continue; } // the page is reloading
  const st = await p.evaluate(() => { const g = globalThis.cinderGame.state(), o = []; const modal = [...document.querySelectorAll('.modal')].pop(); const pan = document.querySelector('#app > section, #app .columns > section'); if (!modal && pan && pan.scrollHeight > pan.clientHeight + 1) o.push(pan.scrollHeight - pan.clientHeight); if (modal && modal.scrollHeight > modal.clientHeight + 1 && !modal.classList.contains('wide') && !modal.classList.contains('dt')) o.push('modal ' + (modal.scrollHeight - modal.clientHeight)); return { s: g.screen, popup: g.popup, hp: g.char && g.char.hp, cr: g.char && g.char.credits, o, page: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1, busy: document.getElementById('app').classList.contains('busy') }; });
  seen[st.s] = (seen[st.s] || 0) + 1; if (st.s === last) same++; else same = 0; last = st.s;
  if (same > 350) { errors.add(`STUCK on ${st.s} popup=${st.popup}`); break; }
  if (st.hp != null && (Number.isNaN(st.hp) || Number.isNaN(st.cr) || st.cr < 0)) errors.add(`BAD hp=${st.hp} cr=${st.cr} on ${st.s}`);
  if (st.page) over[`PAGE ${st.s}`] = 1; if (st.o.length && !st.popup && st.s !== 'create') over[`${st.s} ${st.o.join()}`] = 1;
  if (st.busy) { await p.waitForTimeout(120); continue; }
  // Leave town often enough to actually play: open missions and deploy when they're on offer.
  if (rnd() < 0.3) { const go = await p.$('button[data-a="deploy"]:not([disabled])') || (st.s === 'town' && !st.popup ? await p.$('.shortcuts button[data-v="missions"]') : null); if (go) { await go.tap().catch(() => {}); await p.waitForTimeout(60); continue; } }
  const pick = await p.evaluate((r) => { const all = [...document.querySelectorAll('button:not([disabled])')].filter((e) => { const b = e.getBoundingClientRect(); if (!b.width) return false; const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return t && (t === e || e.contains(t)) && !['reset', 'newcell', 'cloudload', 'coophost', 'coopjoin', 'devunlock', 'report', 'savecode', 'cloudcopy'].includes(e.dataset.a); }); if (!all.length) return null; const e = all[Math.floor(r * all.length)], z = e.getBoundingClientRect(); return [z.x + z.width / 2, z.y + z.height / 2]; }, rnd());
  if (!pick) { await p.waitForTimeout(80); continue; }
  await p.touchscreen.tap(pick[0], pick[1]); await p.waitForTimeout(st.s === 'combat' ? 150 : 30);
 }
 console.log('seed', SEED, JSON.stringify(seen)); console.log('tall:', Object.keys(over).slice(0, 14).join(' ; ') || 'none'); console.log(errors.size ? [...errors].slice(0, 10) : 'no errors'); await b.close(); })().catch((e) => { console.error('RUNFAIL', e.message.slice(0, 200)); process.exit(1); });
