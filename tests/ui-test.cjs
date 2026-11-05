const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8765/index.html';
(async () => {
  const browser = await chromium.launch();
  for (const width of [1200, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }); globalThis.routeShot = 0;
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const overflow = async (tag) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 0) errors.push(`${tag}: horizontal overflow ${o}px`); };
    const shot = async (name) => { await overflow(name); await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true }); };
    // 1) Old v3 save migrates into gear slots.
    await page.goto(URL);
    await page.evaluate(async () => {
      const E = await import('./engine.js');
      const rng = E.seededRng(7), s = E.newGame(rng);
      s.meta.bestSector = 12; s.meta.resolve = 30; s.meta.cell = ['heirloom'];
      E.createChar(s, rng);
      const c = s.char; c.weapon = 'repeater'; c.armor = 'coat'; delete c.gear; delete c.market; c.credits = 4000; c.attrs.str = 7; c.attrs.cha = 6;
      s.v = 3; s.screen = 'town'; s.popup = 'gear'; c.attrs.agi = 4;
      localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
    });
    await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(600);
    await shot('gear-migrated');
    await page.click('button[data-v="chest"]'); await page.waitForTimeout(100);
    const up = await page.$('button[data-a="upgradegear"]'); if (up) await up.click();
    await page.keyboard.press('Escape'); await page.click('button[data-a="popup"][data-v="character"]'); await page.waitForTimeout(200);
    await shot('character');
    await page.keyboard.press('Escape'); await page.click('button[data-a="popup"][data-v="market"]'); await page.waitForTimeout(200);
    await shot('market');
    const buy = await page.$('button[data-a="buygear"]:not([disabled])'); if (buy) { await buy.click(); await page.waitForTimeout(100); }
    // 2) Combat: deploy and fight with keys.
    await page.keyboard.press('Escape'); await page.click('button[data-a="popup"][data-v="missions"]');
    await page.click('button[data-a="deploy"]'); await page.waitForTimeout(300);
    for (let i = 0; i < 40; i++) {
      const scr = await page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')).screen);
      if (scr === 'route') { if (i > 3 && !globalThis.routeShot) { globalThis.routeShot = 1; await shot('route-after'); } await page.keyboard.press('1'); }
      else if (scr === 'combat') { if (i === 2) { const ab = await page.$('[data-speed="auto"]'); if (ab) await ab.click(); await page.waitForTimeout(4000); await shot('combat-auto'); const m = await page.$('[data-speed="1"]'); if (m) await m.click(); await page.waitForTimeout(2500); continue; } await page.keyboard.press(i % 2 ? 'f' : 'a'); await page.waitForTimeout(1800); const sk = await page.$('.speed button:last-child'); if (sk) await sk.click(); }
      else if (scr === 'loot') { await shot('loot-natural'); await page.keyboard.press('1'); }
      else if (['victory', 'room'].includes(scr)) await page.keyboard.press('Enter');
      else if (scr === 'event') { await page.click('button[data-a="event"]'); await page.waitForTimeout(100); const d = await page.$('button[data-a="eventDone"]'); if (d) await d.click(); }
      else if (scr === 'perk') await page.click('button[data-a="perk"][data-v=""]');
      else if (scr === 'sectorClear') { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/sector-view-${width}.png` }); await shot('sector'); break; }
      else if (scr === 'perk') { await shot('perk-popup'); await page.click('button[data-a="perk"][data-v=""]'); }
      else break;
      await page.waitForTimeout(150);
    }
    // 3) Forced loot screen with a boss unique and a legendary.
    await page.evaluate(async () => {
      const E = await import('./engine.js');
      const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1'));
      const rng = E.seededRng(3);
      if (!s.run) return;
      s.run.lootOffer = E.makeItem('vanepistol'); s.screen = 'loot';
      localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
    });
    await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(500);
    await shot('loot-unique');
    const t = await page.$('button[data-a="loottake"]'); if (t) await t.click();
    await page.waitForTimeout(200);
    // 4) Death with heirloom.
    await page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1'));
      s.outcome = { name: s.char.name, number: 1, level: 3, sector: 4, map: 'garrison', killer: 'Patrol Trooper', killerId: 'patrol', credits: 10, perks: 0 };
      s.run = null; s.screen = 'death';
      localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
    });
    await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(500);
    const h = await page.$('button[data-a="heirloom"]'); if (h) await h.click();
    await page.waitForTimeout(150);
    await shot('death-heirloom');
    await page.click('button[data-a="recruit"]'); await page.waitForTimeout(200);
    await shot('create');
    await page.click('button[data-a="step"][data-v="2"]'); await page.click('button[data-a="bg"][data-v="preacher"]'); await page.waitForTimeout(100);
    await shot('create-preacher');
    await page.click('button[data-a="step"][data-v="3"]'); await page.click('button[data-a="create"]'); await page.waitForTimeout(200);
    await page.keyboard.press('Escape'); await page.click('button[data-a="popup"][data-v="character"]'); await page.waitForTimeout(150);
    for (const k of ['cha', 'cha']) { const b = await page.$(`.town-pop button[data-a="spend"][data-v="${k}"]`); if (b) await b.click(); }
    await page.keyboard.press('Escape'); await page.click('button[data-a="popup"][data-v="gear"]'); await page.waitForTimeout(200);
    await shot('gear-new-op');
    console.log(width, errors.length ? errors : 'no errors');
    await page.close();
  }
  await browser.close();
})();
