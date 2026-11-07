// The side-on street: walking, tap-to-walk, every door and hotspot, every interior and its menu, the camera,
// a co-op partner, and the art being missing. Runs at phone and desktop size. ART=dir serves town/street/*.png from that folder
// (for trying placeholder or draft art without putting it in the repo); ART=none blocks those files even if they exist.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.env.U || 'http://localhost:8765/index.html';
const ART = process.env.ART || '';
const OUT = process.env.SHOTS || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const SIZES = [
  ['phone', { viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 3 }],
  ['desk', { viewport: { width: 1280, height: 760 } }],
];
let fails = 0;
const check = (tag, name, ok, extra = '') => { if (!ok) { fails++; console.log(`FAIL ${tag} ${name} ${extra}`); } else if (process.env.V) console.log(`PASS ${tag} ${name}`); };

async function open(browser, opt, route) {
  const ctx = await browser.newContext(opt), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'warning' && /street/.test(m.text())) errors.push(m.text()); });
  if (route === 'none') await page.route(/town\/street\/.*\.png/, (r) => r.abort());
  else if (route) await page.route(/town\/street\/.*\.png/, (r) => { const f = path.join(route, path.basename(new (globalThis.URL)(r.request().url()).pathname)); return fs.existsSync(f) ? r.fulfill({ path: f }) : r.abort(); });
  await page.goto(URL);
  await page.evaluate(async () => {
    const E = await import('./engine.js'), rng = E.seededRng(5), s = E.newGame(rng);
    E.createChar(s, rng); s.char.credits = 900; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true }; s.notice = null; s.screen = 'town';
    localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
  });
  await page.reload();
  await page.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch();
  for (const [tag, opt] of SIZES) {
    const { ctx, page, errors } = await open(browser, opt, ART);
    const T = () => page.evaluate(() => { const t = globalThis.cinderTown, p = t.player; return { scene: t.scene, x: p.x, y: p.y, face: p.face, say: t.say && t.say.text, offer: !!t.offer, prompt: t.prompt.hidden ? '' : t.prompt.textContent, popup: JSON.parse(localStorage.getItem('cinder-cell-save-v1')).popup || null, camX: t.cam.x, camY: t.cam.y, vw: t.vw, vh: t.vh, s: t.s }; });
    const closeAll = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(120); };
    const put = (x, y) => page.evaluate(([x, y]) => { const t = globalThis.cinderTown; t.player.path = null; t.player.then = null; t.player.x = x; if (y) t.player.y = y; t.snapCamera(); }, [x, y || 0]);
    // A real pointer press on the canvas at a stage position.
    const tapStage = async (x, y) => {
      const at = await page.evaluate(([x, y]) => { const t = globalThis.cinderTown, r = t.cv.getBoundingClientRect(); return { x: r.left + (x - t.cam.x) / t.vw * r.width, y: r.top + (y - t.cam.y) / t.vh * r.height, r: { l: r.left, t: r.top, w: r.width, h: r.height } }; }, [x, y]);
      await page.mouse.click(at.x, at.y);
      return at;
    };
    const P = await page.evaluate(async () => (await import('./street.js')).PLACES);

    const v = await T();
    console.log(tag, `view ${v.vw}x${v.vh} stage px at scale ${v.s}`);
    check(tag, 'whole-pixel scale', Number.isInteger(v.s) && v.s >= 1);
    check(tag, 'spawned on the street', v.scene === 'town');
    await page.screenshot({ path: `${OUT}/street-${tag}-start.png` });

    // ---------- walking ----------
    await put(1000);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
    let a = await T(); check(tag, 'right arrow walks right', a.x > 1030 && a.face === 1, `x=${a.x}`);
    await page.keyboard.down('a'); await page.waitForTimeout(500); await page.keyboard.up('a');
    let b = await T(); check(tag, 'A walks left and faces left', b.x < a.x - 30 && b.face === -1, `x=${b.x}`);
    await put(1120);
    await page.keyboard.down('ArrowDown'); await page.waitForTimeout(700); await page.keyboard.up('ArrowDown');
    a = await T();
    await page.keyboard.down('s'); await page.waitForTimeout(100); await page.keyboard.up('s');
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(900); await page.keyboard.up('ArrowUp');
    b = await T();
    check(tag, 'depth shift is small', a.y <= P.floor.y1 && b.y >= P.floor.y0 && a.y - b.y > 10 && a.y - b.y <= 24, `${a.y} to ${b.y}`);
    check(tag, 'walking up where there is no door stays on the street', b.scene === 'town');

    // ---------- tap to walk ----------
    await put(1100, 316);
    await page.waitForTimeout(150);
    await tapStage(1100 + Math.min(120, v.vw * 0.2), 320);
    await page.waitForTimeout(1000);
    a = await T(); check(tag, 'tap on the pavement walks there', Math.abs(a.x - (1100 + Math.min(120, v.vw * 0.2))) < 8, `x=${a.x}`);

    // ---------- camera ----------
    for (const [x, name] of [[0, 'left end'], [2064, 'right end'], [1032, 'middle']]) {
      await put(x);
      await page.waitForTimeout(200);
      a = await T();
      check(tag, `camera in bounds at ${name}`, a.camX >= 0 && a.camX <= 2064 - a.vw + 0.01, `cam=${a.camX}`);
      check(tag, `player kept off the pillars at ${name}`, a.x >= P.walk.margin && a.x <= 2064 - P.walk.margin, `x=${a.x}`);
      check(tag, `camera keeps the pavement in view at ${name}`, a.camY + a.vh === 384, `camY=${a.camY}`);
      const box = await page.evaluate(() => { const t = globalThis.cinderTown; return (t.player.x - t.cam.x) / t.vw; });
      check(tag, `player on screen at ${name}`, box > 0 && box < 1, `at ${box}`);
    }
    // Walks all the way along with the camera easing behind, ends in bounds.
    await put(1800); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1800); await page.keyboard.up('ArrowRight');
    a = await T(); check(tag, 'easing camera stays in bounds', a.camX >= 0 && a.camX <= 2064 - a.vw + 0.01, `cam=${a.camX}`);

    // ---------- every hotspot: by proximity and E, and by tapping it ----------
    for (const h of P.spots) {
      const cx = (h.x[0] + h.x[1]) / 2;
      await put(cx, 316); await page.evaluate(() => { const t = globalThis.cinderTown; t.say = null; t.patrol.x = 1400; t.patrol.pause = 30; }); await page.waitForTimeout(120);
      a = await T(); check(tag, `${h.id}: prompt when next to it`, /\u00B7/.test(a.prompt), `"${a.prompt}"`);
      await page.keyboard.press('e'); await page.waitForTimeout(160);
      a = await T();
      const gotE = h.open ? a.popup === h.open : !!a.say;
      check(tag, `${h.id}: E uses it`, gotE, JSON.stringify(a));
      if (h.open) await closeAll();
      if (a.offer) { await closeAll(); }
      // now from a little way off, by tapping it
      await page.evaluate(() => { const t = globalThis.cinderTown; t.say = null; t.offer = null; });
      const off = cx + (cx > 1000 ? -130 : 130);
      await put(off, 316); await page.waitForTimeout(100);
      const [y0, y1] = h.y || P.tapY, ty = Math.max(y0 + 8, Math.min(y1 - 8, (y0 + y1) / 2));
      await tapStage(cx, ty); await page.waitForTimeout(1200);
      a = await T();
      const gotTap = h.open ? a.popup === h.open : !!a.say;
      check(tag, `${h.id}: tap walks there and uses it`, gotTap && Math.abs(a.x - cx) < (h.x[1] - h.x[0]) / 2 + 20, JSON.stringify(a));
      if (h.open) await closeAll();
      await page.evaluate(() => { const t = globalThis.cinderTown; t.say = null; t.offer = null; });
    }

    // ---------- every door ----------
    for (const d of P.buildings) {
      const cx = (d.door[0] + d.door[1]) / 2, off = cx + (cx > 1000 ? -130 : 130), room = !d.knock;
      await put(cx, 316); await page.waitForTimeout(100);
      a = await T(); check(tag, `${d.id}: door prompt`, a.prompt.length > 0, a.prompt);
      await page.keyboard.press('e'); await page.waitForTimeout(room ? 350 : 160);
      a = await T();
      if (room) {
        check(tag, `${d.id}: E goes in`, a.scene === `interior:${d.id}`, a.scene);
        if (d.id === 'terminal') { check(tag, 'terminal opens Missions as you walk in', a.popup === 'missions', a.popup); await closeAll(); } else check(tag, `${d.id}: no menu until you talk`, !a.popup, a.popup);
        await page.waitForTimeout(100);
        if (d.id === 'clinic' || d.id === 'market') await page.screenshot({ path: `${OUT}/street-${tag}-${d.id}.png` });
        // walk to the person, using a tap on them
        const it = P.interiors[d.id], want = { terminal: 'missions', market: 'market', clinic: 'clinic', safehouse: 'character' }[d.id];
        await tapStage(it.npc.x, 280); await page.waitForTimeout(2600);
        a = await T(); check(tag, `${d.id}: tapping the NPC opens its menu`, a.popup === want && !!a.say, JSON.stringify(a));
        check(tag, `${d.id}: figure drawn near them`, Math.abs(a.x - it.npc.x) < 72);
        await closeAll();
        // and the same by E
        await page.keyboard.press('e'); await page.waitForTimeout(200);
        a = await T(); check(tag, `${d.id}: E near the NPC opens the menu`, a.popup === want, a.popup);
        await closeAll();
        // leave by walking to the exit side
        await put(it.exit[1] + 40, 316);
        await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(150);
        a = await T(); check(tag, `${d.id}: walking to the exit side leaves`, a.scene === 'town' && Math.abs(a.x - cx) < 4, `${a.scene} ${a.x}`);
        // back in by tap on the building, out by Escape
        await put(off, 316); await page.waitForTimeout(100);
        await tapStage(cx, 180); await page.waitForTimeout(1300);
        a = await T(); check(tag, `${d.id}: tapping the building walks in`, a.scene === `interior:${d.id}`, a.scene);
        if (d.id === 'terminal') { await closeAll(); }
        await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        a = await T(); check(tag, `${d.id}: Escape leaves`, a.scene === 'town', a.scene);
        // walking up into the door also goes in
        await put(cx, 316); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(150); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(300);
        a = await T(); check(tag, `${d.id}: up at the door goes in`, a.scene === `interior:${d.id}`, a.scene);
        if (d.id === 'terminal') await closeAll();
        // leave by tapping the exit side
        await tapStage(it.exit[1] / 2, 320); await page.waitForTimeout(1400);
        a = await T(); check(tag, `${d.id}: tapping the exit side leaves`, a.scene === 'town', a.scene);
      } else {
        check(tag, `${d.id}: knock answers`, !!a.say && a.scene === 'town', JSON.stringify(a));
        await page.evaluate(() => { globalThis.cinderTown.say = null; });
        await put(off, 316); await page.waitForTimeout(100);
        await tapStage(cx, 180); await page.waitForTimeout(1300);
        a = await T(); check(tag, `${d.id}: tapping it walks there and knocks`, !!a.say && Math.abs(a.x - cx) < 30, JSON.stringify(a));
      }
      await page.evaluate(() => { globalThis.cinderTown.say = null; });
    }

    // ---------- people ----------
    for (const f of P.folk) {
      const x = await page.evaluate((id) => globalThis.cinderTown.folk.find((q) => q.id === id).x, f.id);
      await put(x + 20, 316); await page.waitForTimeout(100);
      await page.keyboard.press('e'); await page.waitForTimeout(160);
      a = await T(); check(tag, `${f.id} speaks`, !!a.say, JSON.stringify(a));
      if (f.talk === 'noodles') {
        check(tag, 'vendor offers a bowl', a.offer);
        await page.screenshot({ path: `${OUT}/street-${tag}-noodles.png` });
        await page.keyboard.press('Enter'); await page.waitForTimeout(200);
        const fed = await page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')).char.fed);
        check(tag, 'noodles bought', !!fed);
      }
      await page.evaluate(() => { globalThis.cinderTown.say = null; });
    }
    // Patrol walks and can be talked to.
    const gx = await page.evaluate(() => { const g = globalThis.cinderTown.patrol; g.pause = 0; return g.x; });
    await page.waitForTimeout(600);
    const gx2 = await page.evaluate(() => globalThis.cinderTown.patrol.x);
    check(tag, 'patrol walks', gx !== gx2, `${gx} ${gx2}`);
    await put(gx2, 316); await page.keyboard.press('e'); await page.waitForTimeout(150);
    a = await T(); check(tag, 'patrol answers', !!a.say);

    // ---------- co-op partner ----------
    await page.evaluate(() => { const t = globalThis.cinderTown; t.say = null; t.onPartner = t.onPartner || (() => {}); t.mateName = 'Vee'; t.setPartner({ x: t.player.x + 60, y: 316, dir: 'left', moving: false, scene: 'town' }); t.partner.name = 'Vee'; t.partnerSay('Over here!'); });
    await page.waitForTimeout(200);
    let m = await page.evaluate(() => { const t = globalThis.cinderTown, a = t.partner; return { face: a.face, tag: t.tag.hidden ? '' : t.tag.textContent, say: t.mateBubble.hidden ? '' : t.mateBubble.textContent, arrow: !t.arrow.hidden }; });
    check(tag, 'partner name shows', m.tag === 'Vee', JSON.stringify(m));
    check(tag, 'partner speech shows', m.say === 'Over here!', JSON.stringify(m));
    check(tag, 'partner facing follows dir', m.face === -1, JSON.stringify(m));
    await page.screenshot({ path: `${OUT}/street-${tag}-partner.png` });
    await page.evaluate(() => { const t = globalThis.cinderTown; t.setPartner({ x: t.player.x > 1000 ? 40 : 2000, y: 316, dir: 'left', moving: false, scene: 'town' }); t.partner.x = t.partner.tx; });
    await page.waitForTimeout(150);
    m = await page.evaluate(() => { const t = globalThis.cinderTown; return { arrow: !t.arrow.hidden, tag: !t.tag.hidden }; });
    check(tag, 'partner off screen gets an arrow', m.arrow && !m.tag, JSON.stringify(m));
    await page.evaluate(() => { const t = globalThis.cinderTown; t.setPartner({ x: 100, y: 316, dir: 'right', moving: false, scene: 'interior:clinic' }); });
    await put(40); await page.waitForTimeout(100);
    m = await page.evaluate(() => { const t = globalThis.cinderTown; return { arrow: !t.arrow.hidden, tag: !t.tag.hidden }; });
    check(tag, 'partner indoors far away: arrow toward their door', m.arrow && !m.tag, JSON.stringify(m));
    await put(1488); await page.waitForTimeout(100);
    m = await page.evaluate(() => { const t = globalThis.cinderTown; return { arrow: !t.arrow.hidden, tag: !t.tag.hidden }; });
    check(tag, 'partner indoors, door in view: no arrow', !m.arrow && !m.tag, JSON.stringify(m));
    await page.evaluate(() => globalThis.cinderTown.setPartner(null));
    await page.waitForTimeout(100);
    m = await page.evaluate(() => { const t = globalThis.cinderTown; return t.tag.hidden && t.arrow.hidden && t.mateBubble.hidden; });
    check(tag, 'partner leaving clears their marks', m);

    // ---------- a walk animation arriving later ----------
    await page.evaluate(() => { const t = globalThis.cinderTown; if (t.playerHd) { t.playerHd = { ...t.playerHd, anims: { ...t.playerHd.anims, walk: { ...t.playerHd.anims.idle, fps: 10 } } }; } });
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/street-${tag}-walk.png` });
    await page.keyboard.up('ArrowRight');

    // ---------- reduced motion ----------
    await page.evaluate(async () => { (await import('./street.js')).setCalm(true); });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/street-${tag}-calm.png` });
    await page.evaluate(async () => { (await import('./street.js')).setCalm(false); });

    // ---------- phone rules ----------
    if (tag === 'phone') {
      await put((P.spots[1].x[0] + P.spots[1].x[1]) / 2, 316); await page.waitForTimeout(150);
      const r = await page.evaluate(() => { const t = globalThis.cinderTown, pr = t.prompt.getBoundingClientRect(), fs = parseFloat(getComputedStyle(t.prompt).fontSize), d = document.documentElement, canvas = t.cv.getBoundingClientRect(); return { h: pr.height, fs, scroll: d.scrollHeight - d.clientHeight, scrollX: d.scrollWidth - d.clientWidth, cw: canvas.width, ch: canvas.height, bottom: canvas.bottom, wh: innerHeight, act: t.prompt.classList.contains('act') }; });
      check(tag, 'prompt is a tap target of at least 38px', r.act && r.h >= 38, JSON.stringify(r));
      check(tag, 'prompt text at least 11px', r.fs >= 11, JSON.stringify(r));
      check(tag, 'page does not scroll', r.scroll <= 0 && r.scrollX <= 0, JSON.stringify(r));
      check(tag, 'canvas fits the screen', r.bottom <= r.wh, JSON.stringify(r));
      console.log(tag, `town view ${Math.round(r.cw)}x${Math.round(r.ch)} CSS px`);
      await page.evaluate(() => { globalThis.cinderTown.say = null; });
      const tapped = await page.evaluate(() => { const t = globalThis.cinderTown, pr = t.prompt.getBoundingClientRect(); return { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2 }; });
      await page.mouse.click(tapped.x, tapped.y); await page.waitForTimeout(150);
      a = await T(); check(tag, 'tapping the prompt uses the thing', !!a.say, JSON.stringify(a));
    }

    check(tag, 'no page errors', errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }

  // ---------- art missing: never blank, never broken ----------
  for (const [tag, opt] of SIZES) {
    const { ctx, page, errors } = await open(browser, opt, 'none');
    await page.waitForTimeout(600);
    const art = await page.evaluate(() => globalThis.cinderTown.art);
    check(tag, 'missing art is noticed', Object.values(art).every((x) => x === 'failed'), JSON.stringify(art));
    const sample = () => page.evaluate(() => { const t = globalThis.cinderTown, g = t.cv.getContext('2d'), d = g.getImageData(0, 0, t.cv.width, t.cv.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); return seen.size; });
    check(tag, 'street placeholder is not blank', (await sample()) > 8);
    await page.screenshot({ path: `${OUT}/street-${tag}-noart.png` });
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400); await page.keyboard.up('ArrowLeft');
    await page.evaluate(() => { const t = globalThis.cinderTown; t.enter(t.doors.find((d) => d.id === 'clinic')); });
    await page.waitForTimeout(600);
    check(tag, 'room placeholder is not blank', (await sample()) > 4);
    await page.screenshot({ path: `${OUT}/street-${tag}-noart-room.png` });
    check(tag, 'no page errors with art missing', errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }
  // ---------- other screens: a screen taller than the art gets the sky band; an older phone at twice the pixels ----------
  for (const [tag, opt, band] of [['tall', { viewport: { width: 844, height: 500 } }, true], ['small', { viewport: { width: 667, height: 375 }, hasTouch: true, deviceScaleFactor: 2 }, false]]) {
    const { ctx, page, errors } = await open(browser, opt, ART);
    const r = await page.evaluate(() => { const t = globalThis.cinderTown, d = document.documentElement; return { vw: t.vw, vh: t.vh, s: t.s, camY: t.cam.y, scroll: d.scrollHeight - d.clientHeight }; });
    console.log(tag, `view ${r.vw}x${r.vh} stage px at scale ${r.s}`);
    check(tag, 'whole-pixel scale', Number.isInteger(r.s));
    check(tag, band ? 'sky band above the art' : 'cropped from the top, not the pavement', band ? r.camY < 0 : r.camY > 0, JSON.stringify(r));
    check(tag, 'page does not scroll', r.scroll <= 0, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}/street-${tag}.png` });
    check(tag, 'no page errors', errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} failed` : 'no errors');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
