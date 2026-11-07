// Random play: clicks random enabled buttons and presses random keys for N steps, reporting page errors and stuck screens.
const { chromium } = require('playwright');
const STEPS = +process.argv[2] || 600, SEED = +process.argv[3] || 1;
let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/town\/street\//.test(m.location().url)) errors.push('CONSOLE ' + m.text()); });
  await page.goto('http://localhost:8765/index.html');
  await page.evaluate(() => localStorage.setItem('cinder-cell-speed', JSON.stringify('auto2')));
  await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(800);
  const seen = {}; let lastScreen = '', same = 0;
  for (let i = 0; i < STEPS; i++) {
    const st = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1') || '{}'); return { screen: s.screen, popup: s.popup, run: !!s.run, hp: s.char && s.char.hp, credits: s.char && s.char.credits, busy: document.getElementById('app').classList.contains('busy') }; });
    seen[st.screen] = (seen[st.screen] || 0) + 1;
    if (st.screen === lastScreen) same++; else same = 0; lastScreen = st.screen;
    if (same > 1200) { errors.push(`STUCK on ${st.screen} popup=${st.popup}`); break; }
    if (st.hp !== null && st.hp !== undefined && (Number.isNaN(st.hp) || st.credits < 0 || Number.isNaN(st.credits))) errors.push(`BAD STATE hp=${st.hp} credits=${st.credits}`);
    if (st.busy) { await page.waitForTimeout(150); continue; }
    const buttons = await page.$$('button:not([disabled])');
    const visible = [];
    for (const b of buttons) { const box = await b.boundingBox(); if (box && box.width > 0) visible.push(b); }
    if (!visible.length) { await page.waitForTimeout(100); continue; }
    const choice = visible[Math.floor(rnd() * visible.length)];
    const a = await choice.getAttribute('data-a');
    if (a === 'reset' || (a === 'modal' && rnd() < 0.7) || (a === 'closemodal' && rnd() < 0.3)) continue;
    try { await choice.click({ timeout: 2000 }); } catch (e) { }
    if (rnd() < 0.15) await page.keyboard.press(['Enter', '1', '2', 'a', 'f', 'd', 'Escape', 'e'][Math.floor(rnd() * 8)]);
    await page.waitForTimeout(st.screen === 'combat' ? 250 : 40);
  }
  console.log('seed', SEED, 'screens', JSON.stringify(seen));
  console.log(errors.length ? errors.slice(0, 20) : 'no errors');
  await browser.close();
})();
