// Contact sheets for icons.js and guns.js. Needs a static server on PORT (default 8767) at the repo root.
// Writes tests/shots/icons-96.png, icons-24.png, icons-shop.png, guns.png. Fails on a blank icon, a page error, or a wrong GUN_GRIP.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 8767;
const BLANK = 'data:text/html,<!doctype html><html></html>';

// One sheet page: real <img class=ico> under image-rendering: pixelated, as the game shows them.
const sheetCss = (px, cols) => `body{margin:0;background:#1b1e22;color:#8a8f94;font:9px monospace}
.g{display:grid;grid-template-columns:repeat(${cols},${px + 8}px);gap:2px;padding:6px}
.c{background:#23272c;display:flex;flex-direction:column;align-items:center;padding:2px;overflow:hidden}
img{width:${px}px;height:${px}px;image-rendering:pixelated;display:block}
span{white-space:nowrap;max-width:${px + 6}px;overflow:hidden}`;

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (opts) => {
    const page = await b.newPage(opts);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/privacy.html`);
    return page;
  };
  const page = await open({ viewport: { width: 1500, height: 1000 } });

  const data = await page.evaluate(async () => {
    const I = await import('./icons.js'), G = await import('./guns.js');
    const keys = I.iconKeys(), blank = [], times = [], urls = {};
    let bytes = 0;
    for (const k of keys) {
      const t = performance.now(); const u = I.iconURL(k); times.push(performance.now() - t);
      urls[k] = u;
      if (!u) { blank.push(k); continue; }
      bytes += u.length;
      const img = new Image(); img.src = u; await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, 96, 96).data; let n = 0, tones = new Set();
      for (let i = 3; i < d.length; i += 4) if (d[i]) { n++; tones.add(d[i - 3] << 16 | d[i - 2] << 8 | d[i - 1]); }
      if (n < 600 || tones.size < 5) blank.push(`${k} (${n}px ${tones.size} colours)`);
      if (img.naturalWidth !== 96) blank.push(`${k} size ${img.naturalWidth}`);
    }
    times.sort((a, b) => a - b);
    const guns = {}, gridBad = [];
    for (const id of Object.keys(G.GUN_GRIP)) {
      const t = performance.now(); const c = G.gunSprite(id); const ms = performance.now() - t;
      if (!c) { gridBad.push(`${id} null`); continue; }
      const [gx, gy] = G.GUN_GRIP[id];
      if (c.grip[0] !== gx || c.grip[1] !== gy) gridBad.push(`${id} GUN_GRIP says ${gx},${gy}; drawing says ${c.grip}`);
      if (!c.getContext('2d').getImageData(c.grip[0], c.grip[1], 1, 1).data[3]) gridBad.push(`${id} grip pixel is transparent`);
      guns[id] = { w: c.width, h: c.height, grip: c.grip, ms, url: c.toDataURL() };
    }
    const dt = (await import('./data.js')).GEAR, missing = [];
    for (const [id, base] of Object.entries(dt)) if (!I.iconURL(I.gearIconKey(id, base))) missing.push(id);
    return { keys, blank, urls, bytes, med: times[times.length >> 1], max: times[times.length - 1], total: times.reduce((a, b) => a + b, 0), guns, gridBad, missing, nullGun: G.gunSprite('wpn_knife') };
  });

  const sheet = async (name, px, cols, keys, dpr = 1, width = 1500) => {
    const p = await open({ viewport: { width, height: 800 }, deviceScaleFactor: dpr });
    await p.goto(BLANK);
    const cells = keys.map((k) => `<div class=c><img src="${data.urls[k]}"><span>${px >= 48 ? k.replace(/^[a-z]+:/, '') : ''}</span></div>`).join('');
    await p.setContent(`<!doctype html><style>${sheetCss(px, cols)}</style><div class=g>${cells}</div>`);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, name), fullPage: true });
    await p.close();
  };
  const all = data.keys.filter((k) => data.urls[k]);
  const shop = all.filter((k) => /^(weapon|armor|head|legs|gadget|unique|item):/.test(k));
  await sheet('icons-96.png', 96, 14, all);
  await sheet('icons-24.png', 24, 26, all, 1, 880);
  await sheet('icons-24-3x.png', 24, 20, shop, 3, 700);
  await sheet('icons-48.png', 48, 18, shop, 1, 1040);
  // part sheets, for reading at full size
  for (let i = 0, n = 0; i < all.length; i += 40, n++) await sheet(`icons-96-${n}.png`, 96, 8, all.slice(i, i + 40), 1, 860);

  // guns on a mid tone, at 1x and 4x with grip markers, plus beside a real operative frame for scale
  const gp = await open({ viewport: { width: 1200, height: 900 } });
  const gunsPng = await gp.evaluate(async (guns) => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 900;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#5a5f63'; g.fillRect(0, 0, 1200, 900);
    let y = 16;
    const op = new Image(); op.src = './sprites/op_f/idle.png'; await op.decode();
    g.drawImage(op, 0, 0, 256, 256, 880, 10, 256, 256);
    for (const [id, s] of Object.entries(guns)) {
      const im = new Image(); im.src = s.url; await im.decode();
      g.drawImage(im, 16, y);
      g.drawImage(im, 170, y, s.w * 4, s.h * 4);
      g.fillStyle = '#ff2fd0'; g.fillRect(170 + s.grip[0] * 4, y + s.grip[1] * 4, 4, 4);
      g.fillStyle = '#fff'; g.font = '11px monospace'; g.fillText(`${id} ${s.w}x${s.h} grip ${s.grip}`, 16, y + s.h * 4 + 12);
      y += Math.max(s.h * 4, 40) + 24;
    }
    return c.toDataURL();
  }, data.guns);
  fs.writeFileSync(path.join(OUT, 'guns.png'), Buffer.from(gunsPng.split(',')[1], 'base64'));

  // Rough phone timing: fresh module copies under a 4x CPU throttle. First draw of each key, no JIT warm-up for the module.
  const tp = await open({ viewport: { width: 400, height: 400 } });
  const cdp = await tp.context().newCDPSession(tp);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const slow = await tp.evaluate(async () => {
    const I = await import(`./icons.js?slow=${Date.now()}`), ks = I.iconKeys(), ts = [];
    for (const k of ks) { const t = performance.now(); I.iconURL(k); ts.push(performance.now() - t); }
    const first = ts[0]; ts.sort((a, b) => a - b);
    return { first, med: ts[ts.length >> 1], p95: ts[Math.floor(ts.length * 0.95)], max: ts[ts.length - 1] };
  });
  console.log(`4x throttle per icon: first ${slow.first.toFixed(1)}ms median ${slow.med.toFixed(1)}ms p95 ${slow.p95.toFixed(1)}ms max ${slow.max.toFixed(1)}ms`);

  console.log(`keys ${data.keys.length}; per icon median ${data.med.toFixed(2)}ms max ${data.max.toFixed(2)}ms; all ${data.total.toFixed(0)}ms; data URLs ${(data.bytes / 1024).toFixed(0)}KB`);
  for (const [id, s] of Object.entries(data.guns)) console.log(`${id} ${s.w}x${s.h} grip [${s.grip}] ${s.ms.toFixed(2)}ms`);
  await b.close();
  const fails = [...data.blank.map((k) => `blank: ${k}`), ...data.gridBad, ...data.missing.map((k) => `gear without icon: ${k}`), ...errors.map((e) => `page error: ${e}`)];
  if (data.nullGun !== null) fails.push('gunSprite(wpn_knife) should be null');
  if (process.env.OLD_KEYS) { const old = fs.readFileSync(process.env.OLD_KEYS, 'utf8').split('\n').filter(Boolean); for (const k of old) if (!data.keys.includes(k)) fails.push(`lost key: ${k}`); }
  if (fails.length) { console.error(`FAIL\n${fails.join('\n')}`); process.exit(1); }
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
