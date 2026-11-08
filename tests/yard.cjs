// The open-square yard: walking in 2D, tap and drag, the walkable area, every destination from every corner, every room and menu,
// depth, signs, phone rules, a real two-page co-op test, and the art being missing. Runs at phone and desktop size.
// Walking is stepped by calling update() in the page, so a long walk takes no real time; the taps and drags themselves are real input.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = process.env.SHOTS || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const SIZES = [
  ['phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }],
  ['desk', { viewport: { width: 1280, height: 760 } }],
];
let fails = 0, passes = 0;
const check = (tag, name, ok, extra = '') => { if (!ok) { fails++; console.log(`FAIL ${tag} ${name} ${extra}`); } else { passes++; if (process.env.V) console.log(`PASS ${tag} ${name}`); } };
const SAVE = async () => {
  const E = await import('./engine.js'), rng = E.seededRng(5), s = E.newGame(rng);
  E.createChar(s, rng); s.char.credits = 900; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null; s.screen = 'town';
  localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
};

async function open(browser, opt, route) {
  const ctx = await browser.newContext(opt), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'warning' && /yard/.test(m.text())) errors.push(m.text()); });
  if (route === 'none') await page.route(/town\/street\/.*\.png/, (r) => r.abort());
  await page.goto(URL);
  await page.evaluate(SAVE);
  await page.reload();
  await page.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.evaluate(async () => { globalThis.Y = await import('./yard.js'); });
  return { ctx, page, errors };
}
function tools(page, touch) {
  const T = () => page.evaluate(() => { const t = cinderTown, p = t.player; return { scene: t.scene, x: p.x, y: p.y, face: p.face, dir: p.dir, moving: p.moving, path: !!p.path, say: t.say && t.say.text, offer: !!t.offer, prompt: t.prompt.hidden ? '' : t.prompt.textContent, popup: cinderGame.state().popup || null }; });
  const put = (x, y) => page.evaluate(([x, y]) => { const t = cinderTown, p = t.player; p.path = null; p.then = null; p.x = x; p.y = y; t.say = null; t.offer = null; }, [x, y]);
  // Runs the simulation until the walk ends (or for n steps, when n is given).
  const run = (n) => page.evaluate((n) => { const t = cinderTown; if (n) { for (let i = 0; i < n; i++) t.update(1 / 30); return; } for (let i = 0; i < 900 && t.player.path; i++) t.update(1 / 30); t.update(1 / 30); }, n || 0);
  const at = (x, y) => page.evaluate(([x, y]) => cinderTown.toPage(x, y), [x, y]);
  const tapPage = async (px, py) => { if (touch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py); };
  const tapStage = async (x, y) => { const q = await at(x, y); await tapPage(q.x, q.y); };
  const tapSign = async (id) => { const q = await page.evaluate((id) => { const r = cinderTown.signs[id].el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id); await tapPage(q.x, q.y); };
  const hold = async (keys, steps) => { for (const k of keys) await page.keyboard.down(k); await run(steps); for (const k of keys) await page.keyboard.up(k); };
  const home = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(40); await page.evaluate(() => { const t = cinderTown; if (t.interior) t.exit(); t.say = null; t.offer = null; if (t.patrol) { t.patrol.x = 560; t.patrol.y = 375; t.patrol.pause = 1e6; } }); await page.waitForTimeout(40); };
  return { T, put, run, at, tapPage, tapStage, tapSign, hold, home };
}
const openOf = { terminal: 'missions', market: 'market', clinic: 'clinic', safehouse: 'character' };

(async () => {
  const browser = await chromium.launch();
  for (const [tag, opt] of SIZES) {
    const { ctx, page, errors } = await open(browser, opt);
    const touch = !!opt.hasTouch, { T, put, run, at, tapPage, tapStage, tapSign, hold, home } = tools(page, touch);
    const P = await page.evaluate(() => JSON.parse(JSON.stringify(Y.PLACES)));
    await page.evaluate(() => { const t = cinderTown; t.patrol.x = 560; t.patrol.y = 375; t.patrol.pause = 1e6; });

    // ---------- the scene fits ----------
    const v = await page.evaluate(() => { const t = cinderTown, d = document.documentElement, r = t.cv.getBoundingClientRect(), b = t.fromPage(r.left, r.top), e = t.fromPage(r.right, r.bottom); return { W: t.cv.width, H: t.cv.height, s: t.s, ox: t.ox, oy: t.oy, rw: r.width, rh: r.height, bottom: r.bottom, wh: innerHeight, sx: d.scrollWidth - d.clientWidth, sy: d.scrollHeight - d.clientHeight, tl: b, br: e, dpr: devicePixelRatio, art: t.art.yard }; });
    console.log(tag, `view ${Math.round(v.rw)}x${Math.round(v.rh)} CSS, backing ${v.W}x${v.H}, scale ${v.s.toFixed(3)}, art ${v.art}`);
    check(tag, 'the whole picture is on screen', v.tl.x <= 0.5 && v.tl.y <= 0.5 && v.br.x >= 687.5 && v.br.y >= 383.5, JSON.stringify(v));
    check(tag, 'contain: one side touches the view', Math.abs(v.s - Math.min(v.W / 688, v.H / 384)) < 1e-6 && v.ox >= 0 && v.oy >= 0, JSON.stringify(v));
    check(tag, 'backing capped at twice CSS pixels', v.W / v.rw <= 2.01, `${v.W / v.rw}`);
    check(tag, 'page does not scroll', v.sx <= 0 && v.sy <= 0, JSON.stringify(v));
    check(tag, 'canvas fits the screen', v.bottom <= v.wh, JSON.stringify(v));
    check(tag, 'the painted art loaded', v.art === 'ok', v.art);
    await page.screenshot({ path: `${OUT}/yard-${tag}-start.png` });
    check(tag, 'Missions pulses until something is opened', await page.evaluate(() => cinderTown.signs.terminal.el.classList.contains('pulse')));

    // ---------- PLACES makes sense ----------
    const sane = await page.evaluate(() => { const t = cinderTown, bad = [], w = Y.walkable, P = Y.PLACES; for (const d of t.doors) { if (!w(d.x, d.y)) bad.push(`door ${d.id}`); if (!w(d.front[0], d.front[1])) bad.push(`front ${d.id}`); } for (const h of P.spots) if (h.stand && !w(h.stand[0], h.stand[1])) bad.push(`stand ${h.id}`); for (const q of P.patrol.route) if (!w(q[0], q[1])) bad.push(`route ${q}`); return bad; });
    check(tag, 'every door, stand and patrol point is on the ground', !sane.length, sane.join());

    // ---------- free movement, all eight ways ----------
    const dirs = [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['w', 0, -1], ['s', 0, 1], ['a', -1, 0], ['d', 1, 0]];
    const STEPS = 15;
    let dx0 = 0;
    for (const [k, ux, uy] of dirs) {
      await put(380, 280); await hold([k], STEPS);
      const a = await T(), dx = a.x - 380, dy = a.y - 280;
      if (k === 'ArrowRight') dx0 = dx;
      check(tag, `${k} walks that way`, (ux ? Math.sign(dx) === ux && Math.abs(dx) > 30 : Math.abs(dx) < 1) && (uy ? Math.sign(dy) === uy && Math.abs(dy) > 30 : Math.abs(dy) < 1), `${dx} ${dy}`);
    }
    for (const [ks, ux, uy] of [[['ArrowUp', 'ArrowRight'], 1, -1], [['ArrowUp', 'ArrowLeft'], -1, -1], [['ArrowDown', 'ArrowRight'], 1, 1], [['s', 'a'], -1, 1]]) {
      await put(380, 280); await hold(ks, STEPS);
      const a = await T(), dx = a.x - 380, dy = a.y - 280, len = Math.hypot(dx, dy);
      check(tag, `${ks.join('+')} walks diagonally`, Math.sign(dx) === ux && Math.sign(dy) === uy && Math.abs(Math.abs(dx) - Math.abs(dy)) < 8, `${dx} ${dy}`);
      check(tag, `${ks.join('+')} is normalised, not faster`, len <= dx0 * 1.01 && len >= dx0 * 0.78, `${len} vs ${dx0}`);
    }
    // Facing: up and down keep the last side, and the walk cycle runs.
    await put(380, 280); await hold(['ArrowLeft'], 3); await page.keyboard.down('ArrowUp'); await run(5);
    let a = await T(); await page.keyboard.up('ArrowUp');
    check(tag, 'walking up keeps the last sideways facing and the walk cycle', a.face === -1 && a.dir === 'up' && a.moving, JSON.stringify(a));
    await put(380, 280); await hold(['ArrowRight'], 3); await page.keyboard.down('ArrowDown'); await run(5);
    a = await T(); await page.keyboard.up('ArrowDown');
    check(tag, 'walking down keeps it too', a.face === 1 && a.dir === 'down' && a.moving, JSON.stringify(a));

    // ---------- depth ----------
    const depth = await page.evaluate(async () => { const t = cinderTown, D = Y.PLACES.depth, f = (y) => t.figureAt(y); const seen = []; for (const y of [160, 280, 380]) { t.player.x = 380; t.player.y = y; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const o = t.people.find((q) => q.id === 'player'); seen.push(o.h); } const ys = t.people.map((q) => q.y); return { far: f(D.yFar), near: f(D.yNear), seen, sorted: ys.every((y, i) => !i || ys[i - 1] <= y) }; });
    check(tag, 'figures are smaller at the back', Math.abs(depth.far / depth.near - 0.62) < 0.02, JSON.stringify(depth));
    check(tag, 'near height is 34-38% of the view', depth.near / 384 >= 0.34 && depth.near / 384 <= 0.38, JSON.stringify(depth));
    check(tag, 'scale really changes with y', depth.seen[0] < depth.seen[1] && depth.seen[1] < depth.seen[2], JSON.stringify(depth));
    check(tag, 'people are drawn in y order', depth.sorted);

    // ---------- tap ----------
    await put(240, 330); await tapStage(420, 240); await run();
    a = await T(); check(tag, 'tap walks there', Math.hypot(a.x - 420, a.y - 240) < 4, JSON.stringify(a));
    check(tag, 'a tap is 2D: y changed too', a.y < 300);
    await put(240, 330); await tapStage(5, 8); await run();
    a = await T(); check(tag, 'a tap off the ground walks to the nearest ground', await page.evaluate(([x, y]) => Y.walkable(x, y), [a.x, a.y]) && a.scene === 'town', JSON.stringify(a));

    // ---------- drag to steer ----------
    const press = async () => {
      if (!touch) return { down: async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); }, move: (x, y) => page.mouse.move(x, y), up: () => page.mouse.up() };
      const c = await ctx.newCDPSession(page);
      return { down: (x, y) => c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }), move: (x, y) => c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }), up: () => c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) };
    };
    const fing = await press();
    await put(300, 300);
    let f1 = await at(300, 300); await fing.down(f1.x, f1.y);
    f1 = await at(480, 240); await fing.move(f1.x, f1.y); await page.waitForTimeout(40); await run(12);
    a = await T(); check(tag, 'drag: walks toward the finger while held', a.x > 340 && a.y < 300 && a.moving, JSON.stringify(a));
    f1 = await at(260, 350); await fing.move(f1.x, f1.y); await page.waitForTimeout(40); const b0 = await T(); await run(12);
    let b = await T(); check(tag, 'drag: turns with the finger', b.x < b0.x && b.y > b0.y, JSON.stringify([b0, b]));
    await run(60); b = await T(); check(tag, 'drag: stops at the finger', Math.hypot(b.x - 260, b.y - 350) < 8 && !b.moving, JSON.stringify(b));
    await fing.up(); await page.waitForTimeout(40); await run(5);
    const b2 = await T(); check(tag, 'drag: release stops, no walk left over', !b2.path && !b2.moving, JSON.stringify(b2));
    // A drag begun on a sign steers, it doesn't go there.
    await put(300, 300);
    const sr = await page.evaluate(() => { const r = cinderTown.signs.lantern.el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await fing.down(sr.x, sr.y); f1 = await at(480, 300); await fing.move(f1.x, f1.y); await page.waitForTimeout(40); await run(10); await fing.up(); await page.waitForTimeout(40); await run(2);
    a = await T(); check(tag, 'a drag from a sign steers', a.x > 320 && a.scene === 'town' && !a.path, JSON.stringify(a));

    // ---------- staying inside and sliding ----------
    const mash = await page.evaluate(() => { const t = cinderTown, w = Y.walkable; let seed = 7, out = 0; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; const names = ['up', 'down', 'left', 'right']; t.player.x = 380; t.player.y = 280; const s = t.scene; for (let i = 0; i < 6000; i++) { if (i % 37 === 0) { t.keys.clear(); t.keys.add(names[Math.floor(rnd() * 4)]); if (rnd() < 0.5) t.keys.add(names[Math.floor(rnd() * 4)]); } t.lockedSaid = performance.now(); t.update(1 / 30); if (t.interior) { t.keys.clear(); t.exit(); } if (!w(t.player.x, t.player.y)) out++; t.say = null; } t.keys.clear(); return { out }; });
    check(tag, 'six thousand random steps never leave the ground', mash.out === 0, JSON.stringify(mash));
    await page.waitForTimeout(250); await home(); // anything those doors opened
    await put(450, 172); await hold(['ArrowUp'], 12);
    a = await T(); check(tag, 'up against a slanted edge slides along it', a.x < 449 && a.y < 172 && await page.evaluate(([x, y]) => Y.walkable(x, y), [a.x, a.y]), JSON.stringify(a));
    await put(300, 151); await hold(['ArrowUp'], 12);
    a = await T(); check(tag, 'straight into an edge just stops', Math.abs(a.x - 300) < 2 && a.y >= 147, JSON.stringify(a));
    await page.evaluate(() => { Y.PLACES.walk.blocks.push([300, 250, 360, 290]); cinderTown.rebuildGround(); });
    await put(330, 300); await hold(['ArrowUp'], 25);
    a = await T(); check(tag, 'a block stops you', a.y >= 290 && a.y < 296, JSON.stringify(a));
    await hold(['ArrowUp', 'ArrowRight'], 30);
    a = await T(); check(tag, 'pushing diagonally slides along the block and past it', a.x > 355, JSON.stringify(a));
    await put(330, 300); await tapStage(330, 235);
    const walked = await page.evaluate(() => { const t = cinderTown, w = Y.walkable; let bad = 0, n = 0; while (t.player.path && n++ < 500) { t.update(1 / 30); if (!w(t.player.x, t.player.y)) bad++; } return { bad, x: t.player.x, y: t.player.y }; });
    check(tag, 'a tap routes round a block and arrives', walked.bad === 0 && Math.hypot(walked.x - 330, walked.y - 235) < 4, JSON.stringify(walked));
    // A walk round the inside corner of the area, which a straight line would cut.
    await page.evaluate(() => { Y.PLACES.walk.blocks.length = 0; cinderTown.rebuildGround(); });
    await put(126, 372); await tapStage(206, 174); await run();
    a = await T(); check(tag, 'a tap routes round the corner of the area', Math.hypot(a.x - 206, a.y - 174) < 5, JSON.stringify(a));

    // ---------- every destination, by its sign and by its building, from every corner ----------
    const corners = [[126, 378], [618, 378], [226, 162], [405, 152]];
    const places = [...P.buildings.filter((d) => d.sign).map((d) => ({ id: d.id, box: d.box, enter: !d.knock }))];
    for (const q of places) for (const [cx, cy] of corners) for (const how of ['sign', 'building']) {
      await home(); await put(cx, cy);
      if (how === 'sign') await tapSign(q.id);
      else if (q.spot) await tapStage(q.spot.x, q.spot.y);
      else await tapStage((q.box[0] + q.box[2]) / 2, (q.box[1] + q.box[3]) / 2);
      await page.waitForTimeout(30); await run();
      a = await T();
      const name = `${q.id} by ${how} from ${cx},${cy}`;
      if (q.enter) check(tag, `${name} goes in`, a.scene === `interior:${q.id}`, JSON.stringify(a));
      else check(tag, `${name} knocks`, a.scene === 'town' && !!a.say, JSON.stringify(a));
      if (q.id === 'terminal') await page.waitForTimeout(230);
    }
    await home();

    // ---------- every room, its person and its menu ----------
    for (const d of P.buildings.filter((b) => !b.knock)) {
      const it = P.interiors[d.id], want = openOf[d.id], door = await page.evaluate((id) => cinderTown.doors.find((q) => q.id === id).front, d.id);
      await home(); await put(door[0], door[1]); await page.waitForTimeout(60);
      a = await T(); check(tag, `${d.id}: prompt at the door`, /·/.test(a.prompt), a.prompt);
      await page.keyboard.press('e'); await page.waitForTimeout(260);
      a = await T(); check(tag, `${d.id}: E goes in`, a.scene === `interior:${d.id}`, a.scene);
      if (d.id === 'terminal') { check(tag, 'the terminal opens Missions as you walk in', a.popup === 'missions', a.popup); await page.keyboard.press('Escape'); await page.waitForTimeout(60); } else check(tag, `${d.id}: no menu until you talk`, !a.popup, a.popup);
      const seen = await page.evaluate(() => { const t = cinderTown; return { signs: t.signLayer.hidden, whole: t.fromPage(t.cv.getBoundingClientRect().right, t.cv.getBoundingClientRect().bottom).x >= 687, art: t.art[`int_${t.interiorId}`] }; });
      check(tag, `${d.id}: the room fits whole, signs away`, seen.signs && seen.whole && seen.art === 'ok', JSON.stringify(seen));
      if (d.id === 'clinic' || d.id === 'market') await page.screenshot({ path: `${OUT}/yard-${tag}-${d.id}.png` });
      if (!it.npc) { await put(it.exit[1] + 30, 316); await hold(['ArrowLeft'], 15); await page.waitForTimeout(30); a = await T(); check(tag, `${d.id}: walking to the exit leaves`, a.scene === 'town', a.scene); continue; } // Club Velvet: the girls, no shopkeeper
      await tapStage(it.npc.x, 280); await run(); await page.waitForTimeout(40);
      a = await T(); const opened = async () => (d.id === 'lantern' ? (await page.locator('.dtm-bar').count()) > 0 : (await T()).popup === want);
      check(tag, `${d.id}: tapping the person opens the menu`, (await opened()) && !!a.say, JSON.stringify(a));
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      await page.keyboard.press('e'); await page.waitForTimeout(60);
      a = await T(); check(tag, `${d.id}: E near the person opens the menu`, await opened(), a.popup);
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      if (it.also) { await tapStage(it.also.x, 280); await run(); await page.waitForTimeout(40); check(tag, 'the croupier opens the wheel', (await page.locator('.dtm-wheel').count()) > 0); await page.keyboard.press('Escape'); await page.waitForTimeout(60); }
      await put(it.exit[1] + 30, 316); await hold(['ArrowLeft'], 15); await page.waitForTimeout(30);
      a = await T(); check(tag, `${d.id}: walking to the exit leaves`, a.scene === 'town' && Math.hypot(a.x - door[0], a.y - door[1]) < 2, `${a.scene} ${a.x} ${a.y}`);
      // Back in by keys, walking through the door the way its push says.
      const kx = Math.abs(d.push[0]) > Math.abs(d.push[1]) ? (d.push[0] < 0 ? 'ArrowLeft' : 'ArrowRight') : (d.push[1] < 0 ? 'ArrowUp' : 'ArrowDown');
      await page.evaluate(() => { const t = cinderTown; t.say = null; });
      await hold([kx], 12); await page.waitForTimeout(240);
      a = await T(); check(tag, `${d.id}: ${kx} at the door goes in`, a.scene === `interior:${d.id}`, a.scene);
      if (d.id === 'terminal') { await page.keyboard.press('Escape'); await page.waitForTimeout(60); }
      await tapStage(it.exit[1] / 2, 320); await run(); await page.waitForTimeout(30);
      a = await T(); check(tag, `${d.id}: tapping the exit side leaves`, a.scene === 'town', a.scene);
      await page.evaluate((id) => { const t = cinderTown; t.enter(t.doors.find((q) => q.id === id)); }, d.id); await page.waitForTimeout(240);
      if (d.id === 'terminal') { await page.keyboard.press('Escape'); await page.waitForTimeout(60); }
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      a = await T(); check(tag, `${d.id}: Escape leaves`, a.scene === 'town', a.scene);
      await page.keyboard.up(kx);
    }

    // ---------- every spot and knock: by E where you stand, and by tapping it ----------
    for (const h of P.spots.filter((q) => !q.folk)) {
      const st = await page.evaluate((id) => cinderTown.standOf(Y.PLACES.spots.find((q) => q.id === id)), h.id);
      await home(); await put(st[0], st[1]); await page.waitForTimeout(50);
      a = await T(); check(tag, `${h.id}: prompt at its stand point`, a.prompt.includes(h.prompt), `"${a.prompt}"`);
      await page.keyboard.press('e'); await page.waitForTimeout(60);
      a = await T(); check(tag, `${h.id}: E uses it`, h.open ? a.popup === h.open : !!a.say, JSON.stringify(a));
      await home(); await put(380, 300);
      await tapStage(h.x, h.y); await page.waitForTimeout(20); await run(); await page.waitForTimeout(30);
      a = await T(); check(tag, `${h.id}: tapping walks there and uses it`, h.open ? a.popup === h.open : !!a.say, JSON.stringify(a));
      check(tag, `${h.id}: arrives at the stand point`, Math.hypot(a.x - st[0], a.y - st[1]) < 5, JSON.stringify(a));
    }
    for (const d of P.buildings.filter((b) => b.knock)) {
      await home(); await put(d.door[0], d.door[1]); await page.waitForTimeout(50);
      a = await T(); check(tag, `${d.id}: knock prompt`, /knock/.test(a.prompt), a.prompt);
      await page.keyboard.press('e'); await page.waitForTimeout(50);
      a = await T(); check(tag, `${d.id}: knocking answers`, !!a.say && a.scene === 'town', JSON.stringify(a));
      await home(); await put(380, 300);
      await tapStage((d.box[0] + d.box[2]) / 2, (d.box[1] + d.box[3]) / 2); await page.waitForTimeout(20); await run();
      a = await T(); check(tag, `${d.id}: tapping it walks there and knocks`, !!a.say && Math.hypot(a.x - d.door[0], a.y - d.door[1]) < 5, JSON.stringify(a));
    }

    // ---------- people ----------
    for (const f of P.folk) {
      const q = await page.evaluate((id) => { const o = cinderTown.folk.find((k) => k.id === id); return [o.x, o.y]; }, f.id);
      await home(); await page.evaluate(([x, y]) => { const n = Y.nearestWalk(x + 18, y), p = cinderTown.player; p.x = n[0]; p.y = n[1]; }, q); await page.waitForTimeout(40);
      await page.keyboard.press('e'); await page.waitForTimeout(50);
      a = await T(); check(tag, `${f.id} speaks`, !!a.say, JSON.stringify(a));
    }
    const pat = await page.evaluate(() => { const t = cinderTown, g = t.patrol; g.pause = 0; t.player.x = 130; t.player.y = 372; const xs = [], ys = []; for (let i = 0; i < 900; i++) { t.update(1 / 30); xs.push(g.x); ys.push(g.y); } const k = t.folk.find((f) => f.id === 'kid') || { x: 0, y: 0, gx: 0, gy: 0 }; k.pause = 0; k.gx = k.x + 30; k.gy = k.y + 20; const kx = k.x, ky = k.y; for (let i = 0; i < 60; i++) t.update(1 / 30); return { wx: Math.max(...xs) - Math.min(...xs), wy: Math.max(...ys) - Math.min(...ys), kx: k.x - kx, ky: k.y - ky, inside: Y.walkable(g.x, g.y) }; });
    check(tag, 'patrol walks in 2D', pat.wx > 100 && pat.wy > 60 && pat.inside, JSON.stringify(pat));
    // No townsfolk loiter in the square any more (only people who belong to a building), so there's no kid to watch wander.

    // ---------- a partner, faked: labels, marks ----------
    await home(); await put(330, 300);
    await page.evaluate(() => { const t = cinderTown; t.mateName = 'Vee'; t.setPartner({ x: 420, y: 330, dir: 'left', moving: false, scene: 'town' }); t.partner.name = 'Vee'; t.partnerSay('Over here!'); });
    await page.waitForTimeout(120);
    let m = await page.evaluate(() => { const t = cinderTown, cs = (e) => getComputedStyle(e); return { tag: t.tag.hidden ? '' : t.tag.textContent, me: t.meTag.hidden ? '' : t.meTag.textContent, c1: cs(t.tag).color, c2: cs(t.meTag).color, fs: parseFloat(cs(t.tag).fontSize), say: t.mateBubble.hidden ? '' : t.mateBubble.textContent, face: t.partner.face }; });
    check(tag, 'both names show', m.tag === 'Vee' && !!m.me, JSON.stringify(m));
    check(tag, 'the partner label has its own colour', m.c1 !== m.c2, JSON.stringify(m));
    check(tag, 'name labels are readable', m.fs >= 11, JSON.stringify(m));
    check(tag, 'partner speech shows', m.say === 'Over here!', JSON.stringify(m));
    await page.screenshot({ path: `${OUT}/yard-${tag}-partner.png` });
    await page.evaluate(() => { const t = cinderTown; t.setPartner({ x: 100, y: 316, dir: 'right', moving: false, scene: 'interior:clinic' }); }); await page.waitForTimeout(80);
    m = await page.evaluate(() => { const t = cinderTown; return { clinic: t.signs.clinic.el.classList.contains('mate'), tag: !t.tag.hidden }; });
    check(tag, 'partner indoors marks that sign and hides their figure', m.clinic && !m.tag, JSON.stringify(m));
    await page.evaluate(() => { const t = cinderTown; t.setPartner({ x: 420, y: 330, dir: 'left', moving: false, scene: 'town' }); t.partner.menu = 'missions'; }); await page.waitForTimeout(80);
    m = await page.evaluate(() => { const t = cinderTown; return { term: t.signs.terminal.el.classList.contains('mate'), clinic: t.signs.clinic.el.classList.contains('mate') }; });
    check(tag, 'partner in a menu marks that sign', m.term && !m.clinic, JSON.stringify(m));
    await page.screenshot({ path: `${OUT}/yard-${tag}-partner-menu.png` });
    await page.evaluate(() => cinderTown.setPartner(null)); await page.waitForTimeout(60);
    m = await page.evaluate(() => { const t = cinderTown; return t.tag.hidden && t.meTag.hidden && t.mateBubble.hidden && !document.querySelector('.yard-sign.mate'); });
    check(tag, 'partner leaving clears their marks', m);

    // ---------- reduced motion ----------
    await page.evaluate(() => { const t = cinderTown; Y.setCalm(true); t.touched = false; }); await page.waitForTimeout(120);
    check(tag, 'calm: Missions does not pulse', await page.evaluate(() => !cinderTown.signs.terminal.el.classList.contains('pulse')));
    await page.screenshot({ path: `${OUT}/yard-${tag}-calm.png` });
    await page.evaluate(() => Y.setCalm(false));

    // ---------- signs and phone rules ----------
    await home(); await put(330, 300); await page.waitForTimeout(80);
    const rules = await page.evaluate(() => { const t = cinderTown, out = {}, bad = []; const pills = []; for (const k in t.signs) { const e = t.signs[k].el, r = e.getBoundingClientRect(), s = e.firstChild.getBoundingClientRect(), fs = parseFloat(getComputedStyle(e).fontSize), c = t.cv.getBoundingClientRect(); if (fs < 11 - 0.01) bad.push(`${k} font ${fs}`); if (r.width < 37.5 || r.height < 37.5) bad.push(`${k} target ${r.width}x${r.height}`); if (r.left < c.left - 0.5 || r.right > c.right + 0.5 || r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5) bad.push(`${k} off the view`); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!hit || !e.contains(hit)) bad.push(`${k} covered by ${hit && hit.className}`); pills.push([k, s]); } for (let i = 0; i < pills.length; i++) for (let j = i + 1; j < pills.length; j++) { const a = pills[i][1], b = pills[j][1]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) bad.push(`${pills[i][0]} overlaps ${pills[j][0]}`); } out.bad = bad; out.names = Object.keys(t.signs); out.texts = Object.values(t.signs).map((q) => q.el.textContent); const cv = t.cv.getBoundingClientRect(); out.covered = [...document.querySelectorAll('.shortcuts .btn')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width) return false; const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !h || !(h === e || e.contains(h)); }).map((e) => e.textContent); out.overlapBtns = [...document.querySelectorAll('.shortcuts .btn')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < cv.right && r.right > cv.left && r.top < cv.bottom && r.bottom > cv.top; }).map((e) => e.textContent); return out; });
    check(tag, 'signs: readable, tappable, on screen, not overlapping', !rules.bad.length, rules.bad.join('; '));
    for (const want of ['Missions', 'Black Market', 'Clinic', 'Resolve', 'Lantern', 'Barracks']) check(tag, `a sign says ${want}`, rules.texts.some((x) => x.includes(want)), rules.texts.join());
    check(tag, 'nothing covers the buttons', !rules.covered.length && !rules.overlapBtns.length, JSON.stringify(rules));
    // The prompt: small, up over the rooftops, and never on the player, wherever they stand.
    const prob = await page.evaluate(async () => { const t = cinderTown, p = t.player, bad = []; const check = async (x, y, want) => { p.x = x; p.y = y; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const pr = t.prompt.getBoundingClientRect(), v = t.cv.getBoundingClientRect(), h = t.figureAt(p.y), a = t.toPage(p.x, p.y - h), b = t.toPage(p.x, p.y), w = (b.y - a.y) * 0.3; if (t.prompt.hidden) { if (want) bad.push(`none at ${x},${y}`); return null; } if (pr.left < b.x + w && pr.right > b.x - w && pr.top < b.y && pr.bottom > a.y) bad.push(`over the player at ${x},${y}`); return { h: pr.height, top: pr.top - v.top, vh: v.height, w: pr.width, vw: v.width }; }; let last = null; for (const d of t.doors) last = (await check(d.x, d.y, true)) || last; for (const [x, y] of [[300, 152], [400, 152], [130, 380], [610, 380]]) await check(x, y, false); return { bad, last }; });
    check(tag, 'the prompt is never over the player', !prob.bad.length, prob.bad.join('; '));
    check(tag, 'the prompt stays at the top, off the plaza', prob.last && prob.last.top + prob.last.h <= prob.last.vh * 0.14, JSON.stringify(prob.last));
    if (tag === 'phone') {
      const door = await page.evaluate(() => cinderTown.doors.find((d) => d.id === 'barracks').front);
      await put(door[0], door[1]); await page.waitForTimeout(70);
      const pr = await page.evaluate(() => { const t = cinderTown, r = t.prompt.getBoundingClientRect(); return { h: r.height, fs: parseFloat(getComputedStyle(t.prompt).fontSize), act: t.prompt.classList.contains('act'), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      check(tag, 'prompt is a tap target of at least 38px', pr.act && pr.h >= 37.5, JSON.stringify(pr));
      check(tag, 'prompt text at least 11px', pr.fs >= 11, JSON.stringify(pr));
      await tapPage(pr.x, pr.y); await page.waitForTimeout(60);
      a = await T(); check(tag, 'tapping the prompt uses the thing', !!a.say, JSON.stringify(a));
    }
    await put(380, 372); await page.waitForTimeout(80);
    await page.screenshot({ path: `${OUT}/yard-${tag}-near.png` });
    await page.evaluate(() => { cinderTown.debug = true; }); await page.waitForTimeout(80);
    await page.screenshot({ path: `${OUT}/yard-${tag}-debug.png` });
    await page.evaluate(() => { cinderTown.debug = false; });
    // Opening a menu from the side buttons stops the pulse and freezes walking.
    await page.evaluate(() => { const t = cinderTown; t.touched = false; }); await page.waitForTimeout(60);
    check(tag, 'pulse is back after a return', await page.evaluate(() => cinderTown.signs.terminal.el.classList.contains('pulse')));
    await page.click('.shortcuts [data-a="popup"][data-v="gear"]'); await page.waitForTimeout(100);
    const before = await T();
    check(tag, 'a menu stops the pulse', await page.evaluate(() => !cinderTown.signs.terminal.el.classList.contains('pulse')));
    await hold(['ArrowLeft'], 10);
    a = await T(); check(tag, 'a menu freezes walking', a.x === before.x && a.y === before.y, JSON.stringify(a));
    await page.keyboard.press('Escape'); await page.waitForTimeout(60);

    check(tag, 'no page errors', errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }

  // ---------- other shapes: contain, bars, no scroll ----------
  for (const [tag, opt] of [['small', { viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['wide', { viewport: { width: 1000, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['short', { viewport: { width: 1280, height: 620 } }], ['tablet', { viewport: { width: 1024, height: 768 } }]]) {
    const { ctx, page, errors } = await open(browser, opt);
    const r = await page.evaluate(async () => { await new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q))); const t = cinderTown, d = document.documentElement, g = t.cv.getContext('2d'), bar = t.ox > 1 ? [1, t.cv.height >> 1] : t.oy > 1 ? [t.cv.width >> 1, 1] : null, px = bar ? [...g.getImageData(bar[0], bar[1], 1, 1).data] : null, c = t.cv.getBoundingClientRect(); return { s: t.s, ox: t.ox, oy: t.oy, W: t.cv.width, H: t.cv.height, scrollY: d.scrollHeight - d.clientHeight, scrollX: d.scrollWidth - d.clientWidth, px, bottom: c.bottom, wh: innerHeight, ratio: t.cv.width / c.width }; });
    console.log(tag, JSON.stringify(r));
    check(tag, 'picture is contained', r.ox >= 0 && r.oy >= 0 && 688 * r.s <= r.W + 1 && 384 * r.s <= r.H + 1, JSON.stringify(r));
    check(tag, 'page does not scroll', r.scrollX <= 0 && r.scrollY <= 0, JSON.stringify(r));
    if (r.px) check(tag, 'bars are dark', r.px[0] < 20 && r.px[1] < 20 && r.px[2] < 24, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}/yard-${tag}.png` });
    check(tag, 'no page errors', errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }

  // ---------- art missing: never blank, never broken ----------
  for (const [tag, opt] of SIZES) {
    const { ctx, page, errors } = await open(browser, opt, 'none');
    const { T, tapStage, run, put } = tools(page, !!opt.hasTouch);
    await page.waitForTimeout(400);
    const art = await page.evaluate(() => cinderTown.art);
    check(tag, 'missing art is noticed', Object.values(art).every((x) => x === 'failed'), JSON.stringify(art));
    const sample = () => page.evaluate(() => { const t = cinderTown, d = t.cv.getContext('2d').getImageData(0, 0, t.cv.width, t.cv.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); return seen.size; });
    check(tag, 'yard placeholder is not blank', (await sample()) > 8);
    await page.screenshot({ path: `${OUT}/yard-${tag}-noart.png` });
    await put(300, 300); await tapStage(420, 240); await run();
    const a = await T(); check(tag, 'walking still works with the art missing', Math.hypot(a.x - 420, a.y - 240) < 4, JSON.stringify(a));
    await page.evaluate(() => { const t = cinderTown; t.enter(t.doors.find((d) => d.id === 'clinic')); });
    await page.waitForTimeout(500);
    check(tag, 'room placeholder is not blank', (await sample()) > 4);
    await page.screenshot({ path: `${OUT}/yard-${tag}-noart-room.png` });
    check(tag, 'no page errors with art missing', errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }

  // ---------- two real pages in co-op ----------
  {
    const c = await browser.newContext({ viewport: { width: 1000, height: 760 } });
    const host = await c.newPage(), guest = await c.newPage(), errors = [], tag = 'coop';
    for (const [p, n] of [[host, 'host'], [guest, 'guest']]) p.on('pageerror', (e) => errors.push(`${n}: ${e.message}`));
    await host.goto(URL);
    await host.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 900; s.meta.tips = { town: true, combat: true, route: true, loot: true, perk: true, gear: true }; s.notice = null; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-coop', JSON.stringify({ relay: '', name: 'Hosty' })); });
    await host.reload(); await host.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await host.waitForTimeout(800);
    await host.click('button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(150); await host.click('button[data-a="coophost"]'); await host.waitForTimeout(300);
    const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent); await host.keyboard.press('Escape');
    await guest.goto(`${URL}?join=${code}`); await guest.waitForTimeout(1000);
    await guest.click('button[data-a="step"][data-v="2"]'); await guest.click('button[data-a="bg"][data-v="runner"]'); await guest.click('button[data-a="step"][data-v="4"]'); await guest.waitForTimeout(100); await guest.click('button[data-a="create"]'); await guest.waitForTimeout(150); await guest.click('button[data-a="scenenext"]', { timeout: 1500 }).catch(() => {}); await guest.waitForTimeout(1200);
    // A page in the background doesn't animate, so each one is brought forward to send and to see.
    const tick = async (p, ms = 300) => { await p.bringToFront(); await p.waitForTimeout(ms); };
    await tick(host); await tick(guest); await tick(host);
    const seenBy = (p) => p.evaluate(() => { const t = cinderTown, m = t.partner; if (!m) return null; const r = t.cv.getBoundingClientRect(), q = t.toPage(m.x, m.y); return { x: m.x, y: m.y, tx: m.tx, ty: m.ty, name: t.tag.hidden ? '' : t.tag.textContent, me: t.meTag.hidden ? '' : t.meTag.textContent, onScreen: q.x >= r.left && q.x <= r.right && q.y >= r.top && q.y <= r.bottom, c1: getComputedStyle(t.tag).color, c2: getComputedStyle(t.meTag).color, scene: m.scene, shift: t.spawnShift }; });
    let g0 = await seenBy(guest), h0 = await seenBy(host);
    check(tag, 'each sees the other', !!g0 && !!h0, JSON.stringify([g0, h0]));
    check(tag, 'partner on screen with a name', g0 && g0.onScreen && !!g0.name && !!g0.me && h0.onScreen && !!h0.name, JSON.stringify([g0, h0]));
    check(tag, 'partner label coloured differently', g0 && g0.c1 !== g0.c2, JSON.stringify(g0));
    await host.screenshot({ path: `${OUT}/yard-coop-host.png` });
    // The host walks diagonally, for real, by keys and then by a real tap; the guest's view follows in both axes.
    await host.bringToFront();
    await host.evaluate(() => { const p = cinderTown.player; p.x = 380; p.y = 330; });
    await host.waitForTimeout(150);
    await tick(guest, 300); g0 = await seenBy(guest);
    await host.bringToFront();
    await host.keyboard.down('ArrowUp'); await host.keyboard.down('ArrowLeft'); await host.waitForTimeout(600); await host.keyboard.up('ArrowUp'); await host.keyboard.up('ArrowLeft'); await host.waitForTimeout(150);
    const hp = await host.evaluate(() => ({ x: cinderTown.player.x, y: cinderTown.player.y }));
    await guest.bringToFront(); await guest.waitForTimeout(80);
    const gMid = await seenBy(guest); await guest.waitForTimeout(500);
    const g1 = await seenBy(guest);
    check(tag, 'position carries x and y', Math.abs(g1.tx - hp.x) <= 1 && Math.abs(g1.ty - hp.y) <= 1 && Math.abs(g1.tx - g0.tx) > 30 && Math.abs(g1.ty - g0.ty) > 30, JSON.stringify([g0, g1, hp]));
    check(tag, 'interpolation reaches both x and y', Math.abs(g1.x - hp.x) <= 1.5 && Math.abs(g1.y - hp.y) <= 1.5, JSON.stringify([g1, hp]));
    await guest.screenshot({ path: `${OUT}/yard-coop-guest.png` });
    await host.bringToFront(); await host.click('.shortcuts [data-a="popup"][data-v="clinic"]'); await host.waitForTimeout(250);
    await guest.bringToFront(); await guest.waitForTimeout(250);
    check(tag, 'a menu the partner opened marks its sign', await guest.evaluate(() => cinderTown.signs.clinic.el.classList.contains('mate')));
    await host.bringToFront(); await host.keyboard.press('Escape'); await host.waitForTimeout(250);
    await host.evaluate(() => { const t = cinderTown; t.enter(t.doors.find((d) => d.id === 'market')); }); await host.waitForTimeout(250);
    await guest.bringToFront(); await guest.waitForTimeout(250);
    const inMk = await guest.evaluate(() => ({ mark: cinderTown.signs.market.el.classList.contains('mate'), clinic: cinderTown.signs.clinic.el.classList.contains('mate'), tag: !cinderTown.tag.hidden }));
    check(tag, 'partner in a room marks its sign, no figure in the yard', inMk.mark && !inMk.clinic && !inMk.tag, JSON.stringify(inMk));
    await host.bringToFront(); await host.keyboard.press('Escape'); await host.waitForTimeout(250);
    // Emotes still arrive.
    await guest.bringToFront(); await guest.waitForTimeout(150);
    await guest.click('.emotes button'); await guest.waitForTimeout(80);
    await host.bringToFront(); await host.waitForTimeout(150);
    check(tag, 'emote shows over the partner', await host.evaluate(() => !cinderTown.mateBubble.hidden && !!cinderTown.mateBubble.textContent));
    await host.screenshot({ path: `${OUT}/yard-coop-emote.png` });
    check(tag, 'no page errors', errors.length === 0, errors.join(' | ').slice(0, 400));
    await c.close();
  }
  await browser.close();
  console.log(`${passes} passed`);
  console.log(fails ? `${fails} failed` : 'no errors');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
