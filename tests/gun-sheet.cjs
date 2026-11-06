// Every operative animation frame with a swapped gun, for checking by eye, plus a count of frames still showing the drawn-in pistol's colours where a gun was swapped.
// Usage: node tests/gun-sheet.cjs [gun layer]. Saves tests/shots/gun-<sex>-<gun>.png
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:8765/index.html';
const GUN = process.argv[2] || 'wpn_rifle';
(async () => {
  const b = await chromium.launch();
  for (const sex of ['f', 'm']) {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL);
    await p.waitForTimeout(600);
    await p.evaluate(async ({ sex, GUN }) => {
      const L = await import('./look.js'), S = await import('./stage.js');
      await L.loadLayers(); await S.loadSheets();
      L.setOpSheets(S.sheetOf('op_m'), S.sheetOf('op_f'));
      const sh = L.battleSheet({ body: sex === 'f' ? 'body_f1' : 'body_m1', hair: 'hair_short', hairColor: 3, skin: 1 }, 'foundry', GUN, null);
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#4a5158;color:#fff;font:13px system-ui;padding:6px';
      for (const [name, a] of Object.entries(sh.anims)) {
        const fw = a.img.width / a.frames, row = document.createElement('div'); row.textContent = name; row.style.cssText = 'display:block';
        const c = document.createElement('canvas'); c.width = 150 * a.frames; c.height = 130; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        for (let i = 0; i < a.frames; i++) g.drawImage(a.img, i * fw + 30, 10, 196, 170, i * 150, 0, 150, 130);
        row.appendChild(document.createElement('br')); row.appendChild(c); document.body.appendChild(row);
      }
    }, { sex, GUN });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(__dirname, 'shots', `gun-${sex}-${GUN}.png`), fullPage: true });
    if (errs.length) { console.error(errs); process.exit(1); }
    await p.close();
  }
  await b.close();
  console.log('no errors');
})().catch((e) => { console.error(e); process.exit(1); });
