const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  for (const width of [1200, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 860 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/town\/street\//.test(m.location().url)) errors.push(m.text()); });
    const ov = async (tag) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 0) errors.push(`${tag} overflow ${o}`); };
    const T = () => page.evaluate(() => { const t = globalThis.cinderTown, p = t.player; return { scene: t.scene, x: Math.round(p.x), y: Math.round(p.y), say: t.say && t.say.text, offer: !!t.offer, prompt: t.prompt.textContent }; });
    const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')));
    await page.goto('http://localhost:8765/index.html');
    await page.evaluate(async () => {
      const E = await import('./engine.js'), rng = E.seededRng(5), s = E.newGame(rng);
      E.createChar(s, rng); s.char.credits = 900; s.char.wanted = 4; s.meta.tips = { town: true }; s.notice = null;
      localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
    });
    await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(1500);
    await ov('town'); await page.screenshot({ path: `${OUT}/t2-town-${width}.png` });
    // 1) safehouse: walk in, no popup until you talk to Cass
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(900); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(400);
    let s = await save(); console.log(width, 'inside safehouse:', (await T()).scene, 'popup:', s.popup);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1900); await page.keyboard.up('ArrowRight');
    await page.keyboard.press('e'); await page.waitForTimeout(300);
    s = await save(); console.log(width, 'after talking to Cass popup:', s.popup);
    await ov('character'); await page.screenshot({ path: `${OUT}/t2-character-${width}.png`, fullPage: width === 390 });
    await page.waitForTimeout(150);
    s = await save(); console.log(width, 'wanted after lie low:', s.char.wanted, 'credits', s.char.credits);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.evaluate(() => { const t = globalThis.cinderTown; t.player.x = 120; });
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(900); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(400);
    console.log(width, 'back outside via the door:', (await T()).scene);
    // 2) teleport next to the vendor and buy noodles
    await page.evaluate(() => { const t = globalThis.cinderTown; t.player.x = t.folk.find((f) => f.id === 'vendor').x + 20; t.snapCamera(); });
    await page.waitForTimeout(200); await page.keyboard.press('e'); await page.waitForTimeout(200);
    console.log(width, 'vendor offer:', JSON.stringify(await T()));
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    s = await save(); console.log(width, 'fed:', s.char.fed, 'credits', s.char.credits, 'say:', (await T()).say);
    await page.screenshot({ path: `${OUT}/t2-noodles-${width}.png` });
    // 3) tenement knock
    await page.evaluate(() => { const t = globalThis.cinderTown; const d = t.doors.find((x) => x.id === 'tenement_a'); t.player.x = d.front.x; t.player.y = d.front.y; t.snapCamera(); });
    await page.waitForTimeout(200); await page.keyboard.press('e'); await page.waitForTimeout(200);
    s = await save(); console.log(width, 'tenement stims:', s.char.items.stim, 'say:', (await T()).say);
    // 4) terminal auto-opens
    await page.evaluate(() => { const t = globalThis.cinderTown; const d = t.doors.find((x) => x.id === 'terminal'); t.player.x = d.front.x; t.player.y = d.front.y + 4; t.snapCamera(); });
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(600); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(500);
    s = await save(); console.log(width, 'terminal:', (await T()).scene, 'popup:', s.popup);
    await ov('missions'); await page.screenshot({ path: `${OUT}/t2-missions-${width}.png` });
    // 5) the pavement holds you: pushing up into a blank wall and along it stays on the street
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    console.log(width, 'Esc leaves the terminal:', (await T()).scene);
    await page.evaluate(() => { const t = globalThis.cinderTown; t.player.x = 480; t.snapCamera(); });
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowUp');
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(200);
    console.log(width, 'after pushing into the wall:', JSON.stringify(await T()));
    await page.screenshot({ path: `${OUT}/t2-wall-${width}.png` });
    console.log(width, errors.length ? errors : 'no errors');
    await page.close();
  }
  await browser.close();
})();
