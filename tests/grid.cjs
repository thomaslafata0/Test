const { chromium } = require('playwright');
require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  await p.goto('http://localhost:8765/index.html');
  const url = await p.evaluate(async () => {
    const { Town } = await import('./town.js');
    const t = new Town(); const el = document.createElement('div'); document.body.appendChild(el);
    if (t.mount) t.mount(el); else if (t.attach) t.attach(el);
    for (let i = 0; i < 100 && !t.ready; i++) await new Promise((r) => setTimeout(r, 100));
    const G = t.grid, c = document.createElement('canvas'); c.width = G.w; c.height = G.h; const g = c.getContext('2d');
    g.drawImage(t.ground, 0, 0);
    for (const o of t.objects.sort((a, b) => a.sortY - b.sortY)) { const fw = o.frames > 1 ? o.im.width / o.frames : o.im.width; g.drawImage(o.im, 0, 0, fw, o.im.height, o.x, o.y, fw, o.im.height); }
    g.fillStyle = 'rgba(255,0,0,0.45)';
    for (let r = 0; r < G.rows; r++) for (let col = 0; col < G.cols; col++) if (!G.cells[r * G.cols + col]) g.fillRect(col * 8, r * 8, 8, 8);
    g.fillStyle = 'rgba(0,255,0,0.6)'; for (const d of t.doors) g.fillRect(d.x, d.y, d.w, d.h);
    return c.toDataURL();
  });
  require('fs').writeFileSync(require('path').join(__dirname, 'shots', 'grid.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
