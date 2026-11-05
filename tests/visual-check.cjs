// Automated look at every composited character: body x outfit x hair x animation frame, town and battle. Measures what the
// eye catches: background showing through the figure, heads with no face from the side, bald wedges, hair over the eyes.
// Usage: node tests/visual-check.cjs   (server on 8765). Prints worst offenders and writes tests/shots/visual-*.png.
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1200 } });
  await p.route('**/blank.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="background:#4a5468;margin:0"></body>' }));
  await p.goto('http://localhost:8765/blank.html');
  const res = await p.evaluate(async () => {
    const L = await import('/look.js'); await L.loadLayers();
    const bodies = ['body_m1', 'body_m2', 'body_f1', 'body_f2'], bgs = ['foundry', 'runner', 'clerk', 'preacher'], hairs = L.HAIR;
    const out = { frames: 0, holes: [], gaps: [], noFace: [], bald: [], covered: [], strays: [], battleHoles: [] };
    const px = (cv, sx, w, h) => cv.getContext('2d', { willReadFrequently: true }).getImageData(sx, 0, w, h).data;
    const SKIN = L.SKINS[1].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const isSkin = (d, i) => d[i + 3] && SKIN.some((s) => s[0] === d[i] && s[1] === d[i + 1] && s[2] === d[i + 2]);
    function holesAndGaps(d, w, h) {
      // Transparent pixels the background can't reach from the frame edge: real holes.
      const seen = new Uint8Array(w * h), q = [];
      for (let x = 0; x < w; x++) for (const y of [0, h - 1]) q.push(y * w + x);
      for (let y = 0; y < h; y++) for (const x of [0, w - 1]) q.push(y * w + x);
      while (q.length) { const i = q.pop(); if (seen[i] || d[i * 4 + 3]) continue; seen[i] = 1; const x = i % w, y = (i - x) / w; if (x > 0) q.push(i - 1); if (x < w - 1) q.push(i + 1); if (y > 0) q.push(i - w); if (y < h - 1) q.push(i + w); }
      let holes = 0, top = h, bot = 0;
      for (let i = 0; i < w * h; i++) { if (d[i * 4 + 3]) { const y = Math.floor(i / w); top = Math.min(top, y); bot = Math.max(bot, y); } else if (!seen[i]) holes++; }
      // Narrow slits in the torso: background between outfit lines, open at one end. Legs are allowed a gap.
      let gaps = 0; const torsoBot = top + Math.round((bot - top) * 0.55);
      for (let y = top + 10; y < torsoBot; y++) for (let x = 1; x < w - 1; x++) {
        if (d[(y * w + x) * 4 + 3]) continue;
        let l = 0, r = 0; for (let k = 1; k <= 3; k++) { if (!l && x - k >= 0 && d[(y * w + x - k) * 4 + 3]) l = k; if (!r && x + k < w && d[(y * w + x + k) * 4 + 3]) r = k; }
        if (l && r) gaps++;
      }
      return { holes, gaps };
    }
    function headOf(d, w, h) {
      let top = -1, bot = -1, maxW = 0, x0 = w, x1 = -1;
      for (let y = 0; y < h; y++) { let a = w, z = -1; for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { a = Math.min(a, x); z = Math.max(z, x); } if (z < 0) { if (top >= 0) break; continue; } if (top < 0) top = y; const wd = z - a + 1; if (y > top + 6 && wd > maxW * 1.4) break; maxW = Math.max(maxW, wd); bot = y; x0 = Math.min(x0, a); x1 = Math.max(x1, z); if (y >= top + 16) break; }
      return { top, bot, x0, x1 };
    }
    for (const body of bodies) for (const bg of bgs) for (const hair of hairs) {
      const look = { body, hair, skin: 1, hairColor: 1 }, sh = L.townSheets(look, bg);
      if (!sh) continue;
      for (const [anim, s] of Object.entries(sh)) {
        const fw = s.img.width / s.frames, fh = s.img.height;
        for (let f = 0; f < s.frames; f++) {
          const d = px(s.img, f * fw, fw, fh), who = `${body} ${bg} ${hair} ${anim}#${f}`; out.frames++;
          const g = holesAndGaps(d, fw, fh);
          if (g.holes) out.holes.push([g.holes, who]);
          { const seen = new Uint8Array(fw * fh); let parts = 0; for (let i = 0; i < fw * fh; i++) { if (seen[i] || !d[i * 4 + 3]) continue; parts++; const q = [i]; seen[i] = 1; while (q.length) { const k = q.pop(), x = k % fw, y = (k - x) / fw; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * fw + x + dx; if (x + dx >= 0 && x + dx < fw && y + dy >= 0 && y + dy < fh && !seen[j] && d[j * 4 + 3]) { seen[j] = 1; q.push(j); } } } } if (parts > 1) out.strays.push([parts, who]); }
          if (g.gaps > 6) out.gaps.push([g.gaps, who]);
          const side = /left|right/.test(anim), front = /down/.test(anim);
          const hd = headOf(d, fw, fh), H = hd.bot - hd.top + 1;
          if (side && hair !== 'hair_mohawk') {
            let dark = 0, skin = 0, bald = 0;
            for (let y = hd.top; y <= hd.bot; y++) for (let x = hd.x0; x <= hd.x1; x++) { const i = (y * fw + x) * 4; if (!d[i + 3]) continue; if (isSkin(d, i)) { skin++; if (y < hd.top + H * 0.25 && hair !== 'hair_shaved') bald++; } else if (y > hd.top + H * 0.2 && y < hd.top + H * 0.75 && (isSkin(d, i - 4) || isSkin(d, i + 4))) dark++; }
            if (bald > 10) out.bald.push([bald, who]);
            if (!dark && skin > 8) out.noFace.push([skin, who]);
          }
          if (front) {
            let skin = 0; const m0 = hd.top + Math.round(H * 0.45), m1 = hd.top + Math.round(H * 0.75), cx0 = hd.x0 + 2, cx1 = hd.x1 - 2;
            for (let y = m0; y <= m1; y++) for (let x = cx0; x <= cx1; x++) if (isSkin(d, (y * fw + x) * 4)) skin++;
            if (skin < 2) out.covered.push([skin, who]);
          }
        }
      }
    }
    // Battle sheets: holes and slits only.
    for (const body of bodies) for (const bg of bgs) {
      const sh = L.battleSheet({ body, hair: 'hair_short', skin: 1, hairColor: 1 }, bg, 'wpn_carbine', 'wpn_baton');
      if (!sh) continue;
      for (const [anim, s] of Object.entries(sh.anims)) { const fw = s.img.width / s.frames, fh = s.img.height; for (let f = 0; f < s.frames; f++) { out.frames++; if (anim === 'death') continue; const g = holesAndGaps(px(s.img, f * fw, fw, fh), fw, fh); if (g.holes > 2) out.battleHoles.push([g.holes, `battle ${body} ${bg} ${anim}#${f}`]); } }
    }
    // A sheet to look at.
    const z = 3, c = document.createElement('canvas'); c.width = 1500; c.height = 1200; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; document.body.append(c);
    const dirs = ['idle_down', 'idle_left', 'idle_right', 'idle_up'];
    bodies.forEach((body, r) => bgs.forEach((bg, q) => { const sh = L.townSheets({ body, hair: hairs[(r + q) % hairs.length], skin: 1 + (q % 3), hairColor: 1 + (r % 3) }, bg); if (sh) dirs.forEach((d, k) => { const s = sh[d], fw = s.img.width / s.frames; g.drawImage(s.img, 0, 0, fw, 64, (q * 4 + k) * 92, r * 200, 64 * z, 64 * z); }); }));
    return out;
  });
  await p.waitForTimeout(100); await p.screenshot({ path: `${OUT}/visual-town.png` });
  const rep = (k, label) => { const a = res[k].sort((x, y) => y[0] - x[0]); console.log(`${label}: ${a.length} of ${res.frames} frames${a.length ? `; worst ${a[0][0]} px: ${a[0][1]}` : ''}`); return a.length; };
  const n = rep('holes', 'holes in the figure') + rep('gaps', 'see-through slits in the torso') + rep('noFace', 'side view with no face') + rep('bald', 'bald wedge under a hairstyle') + rep('covered', 'face covered from the front') + rep('strays', 'bits floating off the figure');
  rep('battleHoles', 'for information, pockets in battle poses (arm and weapon loops)');
  console.log(n ? `${n} frames flagged` : 'no errors');
  await b.close();
  process.exit(n ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
