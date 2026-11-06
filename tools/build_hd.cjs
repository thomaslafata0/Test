// Builds high-resolution battle sheets from PixelLab frames.
// Usage: node tools/build_hd.cjs <frames dir> <out dir>   Input: <frames dir>/<id>/<anim>/<n>.png   Output: <out dir>/<id>/<anim>.png and hd.json
// Operatives (ids starting op_) face right; enemies face left. Everything is measured from the feet, so frames can be cropped to save memory.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [SRC, OUT] = process.argv.slice(2);
const FPS = { idle: 6, attack: 11, attackM: 12, charge: 8, hit: 14, defend: 10, death: 10, repair: 8 };
const LOOP = new Set(['idle', 'charge', 'repair']);
const uri = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const manifest = fs.existsSync(`${OUT}/hd.json`) ? JSON.parse(fs.readFileSync(`${OUT}/hd.json`)) : {};
  for (const id of fs.readdirSync(SRC).filter((d) => fs.statSync(path.join(SRC, d)).isDirectory())) {
    const def = { anims: {} };
    const anims = fs.readdirSync(path.join(SRC, id)).filter((a) => fs.statSync(path.join(SRC, id, a)).isDirectory() && FPS[a]);
    if (!anims.includes('idle')) continue;
    fs.mkdirSync(path.join(OUT, id), { recursive: true });
    const crop = !id.startsWith('op_');
    for (const a of ['idle', ...anims.filter((x) => x !== 'idle')]) {
      const dir = path.join(SRC, id, a);
      const files = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort((x, y) => parseInt(x, 10) - parseInt(y, 10)).map((f) => uri(path.join(dir, f)));
      const res = await p.evaluate(async ({ files, crop, faceRight, tipFrame, base }) => {
        const L = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = s; });
        const ims = await Promise.all(files.map(L)), W = ims[0].width, H = ims[0].height;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true });
        const box = (im) => { g.clearRect(0, 0, W, H); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1, d }; };
        const boxes = ims.map(box);
        const u = { x0: Math.min(...boxes.map((q) => q.x0)), y0: Math.min(...boxes.map((q) => q.y0)), x1: Math.max(...boxes.map((q) => q.x1)), y1: Math.max(...boxes.map((q) => q.y1)) };
        // Symmetric around the frame's centre, so the figure stays on its mark.
        const half = crop ? Math.min(W / 2, Math.max(W / 2 - u.x0, u.x1 + 1 - W / 2) + 2) : W / 2, sx = Math.floor(W / 2 - half), fw = W - 2 * sx;
        const top = crop ? Math.max(0, u.y0 - 2) : 0, fh = H - top;
        const out = document.createElement('canvas'); out.width = fw * ims.length; out.height = fh;
        const og = out.getContext('2d');
        ims.forEach((im, i) => og.drawImage(im, sx, top, fw, fh, i * fw, 0, fw, fh));
        const first = boxes[0], feet = base ? base.feetY : first.y1, info = { W, H, frames: ims.length, fw, fh, top, sx, feetY: feet, figTop: first.y0 };
        // Where shots come from: the far edge of the figure, in the upper body, on the firing frame.
        const k = boxes[Math.min(tipFrame, boxes.length - 1)], d = k.d, yMin = k.y0 + (k.y1 - k.y0) * 0.1, yMax = k.y0 + (k.y1 - k.y0) * 0.6;
        let tx = faceRight ? -1 : W, ty = 0;
        for (let y = Math.floor(yMin); y < yMax; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 60) { if (faceRight ? x > tx : x < tx) { tx = x; ty = y; } }
        info.tip = [tx - W / 2, ty - feet];
        return { png: out.toDataURL('image/png'), info };
      }, { files, crop, faceRight: id.startsWith('op_'), tipFrame: Math.floor(files.length * 0.55), base: def.feetY !== undefined ? { feetY: def.feetY } : null });
      fs.writeFileSync(path.join(OUT, id, `${a}.png`), Buffer.from(res.png.split(',')[1], 'base64'));
      const i = res.info;
      if (a === 'idle') { def.size = i.W; def.feetY = i.feetY; def.fig = i.feetY - i.figTop + 1; }
      def.anims[a] = { frames: i.frames, fps: FPS[a], loop: LOOP.has(a), pad: i.H - 1 - def.feetY };
      if (a === 'attack' || a === 'attackM') def.anims[a].tip = i.tip;
      console.log(id, a, `${i.frames}x${i.fw}x${i.fh}`);
    }
    manifest[id] = def;
  }
  fs.writeFileSync(`${OUT}/hd.json`, JSON.stringify(manifest, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
