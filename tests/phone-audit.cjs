// Audit of the menus on a phone held sideways: small tap targets, text cut off, things off screen, and whether each menu can be reached and closed by touch.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
const MIN = +process.env.MIN_TAP || 30;
(async () => {
  const b = await chromium.launch(); const errs = []; const report = {};
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.setDefaultTimeout(6000);
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(400);
  await p.evaluate(async () => { const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(9), s = E.newGame(rng); E.createChar(s, rng); s.screen = 'town'; const c = s.char; c.name = 'Tamsin Rook'; c.credits = 2500; c.level = 6; c.attrPoints = 2; s.meta.resolve = 20; for (const [id, n] of [['ironlung', 5], ['grudge', 3], ['tithe', 2]]) { c.perks.push(id); c.perkN[id] = n; } s.meta.tips = { town: true, combat: true, route: true, perk: true, loot: true, gear: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(300); await p.tap('button[data-a="continue-title"]', { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(600);
  const audit = (name) => p.evaluate(({ name, MIN }) => {
    const top = [...document.querySelectorAll('.modal')].pop() || document.getElementById('app'), out = { small: [], clipped: [], off: [] };
    for (const el of top.querySelectorAll('button, input, select, a')) { const r = el.getBoundingClientRect(); if (!r.width || el.disabled) continue; const label = (el.textContent || el.placeholder || el.id || '').trim().slice(0, 28); if (r.height < MIN || r.width < MIN) out.small.push(`${label}(${Math.round(r.width)}x${Math.round(r.height)})`); if (r.right > innerWidth + 1 || r.left < -1) out.off.push(label); if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.clipped.push(label); }
    out.pageOver = document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1;
    out.scrollsBy = top.scrollHeight - top.clientHeight; out.closable = !!top.querySelector('[data-a="closepopup"], [data-a="closemodal"]') || top.id === 'app';
    return out;
  }, { name, MIN });
  const shot = async (name) => { report[name] = await audit(name); await p.screenshot({ path: `${OUT}/au-${name}.png` }); };
  await shot('town');
  for (const v of ['missions', 'market', 'clinic', 'character', 'gear', 'lockup']) { await p.tap(`.shortcuts button[data-a="popup"][data-v="${v}"]`); await p.waitForTimeout(250); await shot(v); await p.tap('[data-a="closepopup"]'); await p.waitForTimeout(150); }
  for (const v of ['bar', 'wheel', 'orbit', 'ventures']) { await p.tap(`.shortcuts button[data-a="modal"][data-v="${v}"]`); await p.waitForTimeout(250); await shot(v); await p.tap('.modal [data-a="closemodal"]'); await p.waitForTimeout(150); }
  await p.tap('[data-a="modal"][data-v="menu"]'); await p.waitForTimeout(200); await shot('menu');
  for (const v of ['manual', 'board', 'feats', 'settings']) { await p.tap(`.menu-grid button[data-v="${v}"]`); await p.waitForTimeout(250); await shot(v); await p.tap('.modal [data-a="closemodal"]'); await p.waitForTimeout(150); await p.tap('[data-a="modal"][data-v="menu"]'); await p.waitForTimeout(150); }
  await p.tap('.modal [data-a="closemodal"]'); await p.waitForTimeout(100);
  // Creation
  await p.evaluate(() => { localStorage.removeItem('cinder-cell-save-v1'); }); await p.reload(); await p.waitForTimeout(400); await p.tap('button[data-a="newcell"]').catch(() => {}); await p.waitForTimeout(150); await p.tap('button[data-a="newcell"]').catch(() => {}); await p.waitForTimeout(300); await shot('create1');
  for (const [k, r] of Object.entries(report)) console.log(k.padEnd(10), 'scroll', String(r.scrollsBy).padStart(5), r.closable ? '' : 'NO-CLOSE', r.pageOver ? 'PAGE-OVER' : '', r.off.length ? `off:${r.off.join('|')}` : '', r.clipped.length ? `clip:${r.clipped.join('|')}` : '', r.small.length ? `small(${r.small.length}): ${r.small.slice(0, 7).join(' ')}` : '');
  console.log(errs.length ? errs : 'no errors'); await b.close();
})().catch((e) => { console.error(e.message.slice(0, 400)); process.exit(1); });
