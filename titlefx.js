// The living title screen, drawn entirely in code: a rain-soaked city after curfew, with parallax skylines, sweeping searchlights,
// passing dropships, lightning and embers, and the cell's operatives on a rooftop in front. The menu sits on the left, so the action is on the right.
const W = 640, H = 360;
const calm = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.classList.contains('calm');
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const layer = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g, w, h); return c; };

function sky() {
  return layer(W, H, (g) => {
    const s = g.createLinearGradient(0, 0, 0, H);
    s.addColorStop(0, '#05070d'); s.addColorStop(0.45, '#101725'); s.addColorStop(0.72, '#33242a'); s.addColorStop(0.9, '#7a4326'); s.addColorStop(1, '#a85a28');
    g.fillStyle = s; g.fillRect(0, 0, W, H);
    const r = seeded(12);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(220,225,240,${0.08 + r() * 0.25})`; g.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.45), 1, 1); }
    const m = g.createRadialGradient(470, 70, 4, 470, 70, 110);
    m.addColorStop(0, 'rgba(226,212,178,.55)'); m.addColorStop(0.16, 'rgba(226,212,178,.16)'); m.addColorStop(1, 'rgba(226,212,178,0)');
    g.fillStyle = m; g.fillRect(340, 0, 300, 220);
    g.fillStyle = '#cdbf9f'; g.beginPath(); g.arc(470, 70, 15, 0, 7); g.fill();
    g.fillStyle = '#b0a382'; g.beginPath(); g.arc(466, 66, 4, 0, 7); g.arc(475, 76, 3, 0, 7); g.fill();
  });
}
function clouds(seed, a) {
  return layer(W * 2, 150, (g) => {
    const r = seeded(seed);
    for (let i = 0; i < 90; i++) {
      const x = r() * W * 2, y = 20 + r() * 110, w = 40 + r() * 120, h = 6 + r() * 16;
      g.fillStyle = `rgba(${44 + r() * 26},${40 + r() * 20},${54 + r() * 20},${a * (0.25 + r() * 0.5)})`;
      g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill();
      if (x > W * 2 - w) { g.beginPath(); g.ellipse(x - W * 2, y, w, h, 0, 0, 7); g.fill(); }
    }
  });
}
// A band of buildings. Lit windows are stored so a few can flicker on and off.
function skyline(seed, { base, top, step, col, rim, windows, spires }) {
  const list = [];
  const c = layer(W + 200, H, (g, w) => {
    const r = seeded(seed);
    let x = -10;
    while (x < w) {
      const bw = step * (0.6 + r() * 1.2), bh = top + r() * (base - top);
      g.fillStyle = col; g.fillRect(Math.floor(x), Math.floor(bh), Math.ceil(bw), H - Math.floor(bh));
      g.fillStyle = rim; g.fillRect(Math.floor(x), Math.floor(bh), Math.ceil(bw), 1); g.fillRect(Math.floor(x), Math.floor(bh), 1, H);
      if (spires && r() < 0.5) { const sx = Math.floor(x + bw * (0.2 + r() * 0.6)), sh = 8 + r() * 26; g.fillStyle = col; g.fillRect(sx, Math.floor(bh - sh), 2, Math.ceil(sh)); }
      if (r() < 0.35) { g.fillStyle = col; g.fillRect(Math.floor(x + bw * 0.2), Math.floor(bh - 5), Math.ceil(bw * 0.4), 5); }
      for (let wy = bh + 5; wy < H - 4; wy += windows.gap + 2) for (let wx = x + 3; wx < x + bw - 3; wx += windows.gap + 1) {
        if (r() < windows.lit) { const warm = r() < 0.82, t = warm ? `rgba(255,${176 + r() * 40},${86 + r() * 30},${0.28 + r() * 0.6})` : `rgba(150,214,235,${0.25 + r() * 0.45})`; g.fillStyle = t; g.fillRect(Math.floor(wx), Math.floor(wy), windows.size, windows.size + 1); if (r() < 0.03) list.push([Math.floor(wx), Math.floor(wy), windows.size, r() * 7]); }
      }
      x += bw + (r() < 0.2 ? 2 + r() * 8 : 0);
    }
  });
  return { c, flick: list };
}
// The rooftop the operatives stand on: a parapet catching the light, vents and cables.
function roof() {
  return layer(W + 80, 90, (g, w) => {
    const r = seeded(77);
    g.fillStyle = '#090b0f'; g.fillRect(0, 22, w, 68);
    g.fillStyle = '#171b22'; g.fillRect(0, 22, w, 7);
    g.fillStyle = '#6a3f24'; g.fillRect(0, 22, w, 1);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,190,120,${0.04 + r() * 0.1})`; g.fillRect(Math.floor(r() * w), 30 + Math.floor(r() * 50), 18 + Math.floor(r() * 50), 1); }
    for (const vx of [30, 150, 610]) { g.fillStyle = '#10131a'; g.fillRect(vx, 4, 34, 20); g.fillStyle = '#242a33'; g.fillRect(vx, 4, 34, 2); for (let y = 8; y < 22; y += 3) { g.fillStyle = '#05060a'; g.fillRect(vx + 3, y, 28, 1); } }
    g.strokeStyle = '#05060a'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(90, 26, 150, 8); g.stroke();
  });
}
function vignette() {
  return layer(W, H, (g) => {
    const v = g.createRadialGradient(W * 0.56, H * 0.48, 110, W * 0.56, H * 0.48, 390);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.82)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    const l = g.createLinearGradient(0, 0, W * 0.62, 0);
    l.addColorStop(0, 'rgba(5,7,11,.86)'); l.addColorStop(0.72, 'rgba(5,7,11,.38)'); l.addColorStop(1, 'rgba(5,7,11,0)');
    g.fillStyle = l; g.fillRect(0, 0, W, H);
  });
}

export class TitleScene {
  constructor() {
    this.el = document.createElement('canvas');
    this.el.width = W; this.el.height = H; this.el.className = 'title-canvas'; this.el.setAttribute('aria-hidden', 'true');
    this.g = this.el.getContext('2d'); this.g.imageSmoothingEnabled = false;
    this.layers = { sky: sky(), c1: clouds(5, 0.75), c2: clouds(9, 1), far: skyline(3, { base: 245, top: 165, step: 22, col: '#141a26', rim: '#1d2533', windows: { gap: 3, size: 1, lit: 0.13 }, spires: true }), mid: skyline(8, { base: 285, top: 195, step: 38, col: '#0d1119', rim: '#2a2023', windows: { gap: 4, size: 2, lit: 0.17 } }), roof: roof(), vig: vignette() };
    this.cast = []; this.drone = null;
    const r = seeded(31);
    this.rain = Array.from({ length: 150 }, () => ({ x: r() * (W + 60), y: r() * H, v: 6 + r() * 7, l: 3 + r() * 7, a: 0.1 + r() * 0.28 }));
    this.embers = Array.from({ length: 34 }, () => ({ x: 300 + r() * 340, y: r() * H, v: 0.15 + r() * 0.45, s: r() * 6.28, z: r() < 0.25 ? 2 : 1 }));
    this.smoke = Array.from({ length: 26 }, (_, i) => ({ seed: r() * 1000, stack: i % 2, t: r() }));
    this.next = 1500 + Math.random() * 3000; this.flash = 0; this.flash2 = 0;
    this.shipAt = 2500; this.ship = null;
    this.loop = this.loop.bind(this); this.running = false; this.last = 0;
  }
  // cast: up to two sheets, front one first. drone: { frame(t) } giving { img, sx, sw, sh }.
  setCast(cast, drone) { this.cast = cast || []; this.drone = drone || null; }
  start() { if (!this.running) { this.running = true; requestAnimationFrame(this.loop); } }
  loop(now) {
    if (!this.el.isConnected) { this.running = false; return; }
    requestAnimationFrame(this.loop);
    if (now - this.last < 32) return; // about 30 frames a second is plenty
    const dt = Math.min(80, now - this.last); this.last = now;
    if (document.hidden) return;
    this.draw(now, dt);
  }
  beam(g, x, y, ang, len, spread, a, col = '255,226,170') {
    const x1 = x + Math.cos(ang - spread) * len, y1 = y + Math.sin(ang - spread) * len, x2 = x + Math.cos(ang + spread) * len, y2 = y + Math.sin(ang + spread) * len;
    const gr = g.createLinearGradient(x, y, (x1 + x2) / 2, (y1 + y2) / 2);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
  }
  drawFigure(g, sheet, t, cx, feet, tall, dim) {
    const a = sheet.anims.idle; if (!a) return;
    const fw = a.img.width / a.frames, f = Math.floor(t / 1000 * a.fps) % a.frames, s = tall / sheet.fig, w = fw * s, h = a.img.height * s;
    const x = Math.round(cx - w / 2), y = Math.round(feet - h + (a.pad || 0) * s);
    g.save();
    if (dim) g.globalAlpha = dim;
    g.drawImage(a.img, f * fw, 0, fw, a.img.height, x, y, w, h);
    g.restore();
  }
  draw(t, dt) {
    const g = this.g, still = calm(), L = this.layers, T = still ? 4000 : t;
    const dx = still ? 0 : Math.sin(T / 9000) * 14, dy = still ? 0 : Math.sin(T / 13000) * 3, zoom = still ? 1 : 1.02 + Math.sin(T / 17000) * 0.012;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(L.sky, 0, 0);
    // Everything else moves with the slow camera, nearer layers further.
    const cam = (p) => { g.setTransform(zoom, 0, 0, zoom, W * (1 - zoom) / 2 + dx * p, H * (1 - zoom) / 2 + dy * p); };
    const cl = (T / 1000 * 2.2) % (W * 2), cl2 = (T / 1000 * 4.2) % (W * 2);
    cam(0.1); g.drawImage(L.c1, -cl, 8); g.drawImage(L.c1, W * 2 - cl, 8);
    // Lightning, behind the skyline so it cuts out the towers.
    if (!still) {
      this.next -= dt;
      if (this.next <= 0) { this.flash = 1; this.flash2 = 0.6 + Math.random() * 0.4; this.boltX = 330 + Math.random() * 280; this.next = 5000 + Math.random() * 9000; this.boltSeed = Math.random() * 1000; }
      if (this.flash > 0) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = `rgba(190,205,240,${this.flash * 0.34})`; g.fillRect(0, 0, W, H);
        if (this.flash > 0.45) {
          const r = seeded(this.boltSeed); let x = this.boltX, y = 0;
          g.strokeStyle = `rgba(235,240,255,${this.flash})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
          while (y < 170) { x += (r() - 0.5) * 22; y += 6 + r() * 14; g.lineTo(x, y); }
          g.stroke();
        }
        this.flash -= dt / 240; if (this.flash <= 0 && this.flash2 > 0) { this.flash = this.flash2; this.flash2 = 0; }
      }
    }
    cam(0.25); g.drawImage(L.far.c, -60, 0);
    cam(0.25); g.drawImage(L.c2, -cl2, 90); g.drawImage(L.c2, W * 2 - cl2, 90);
    g.globalCompositeOperation = 'lighter';
    // Searchlights sweep the sky from the far towers.
    const sw = [[255, 212, -1.36, 0.35, 5200, 1.9], [420, 196, -1.72, 0.42, 7100, 0.3], [565, 218, -1.28, 0.28, 6100, 4.2]];
    for (const [x, y, base, range, per, ph] of sw) this.beam(g, x, y, base + Math.sin(T / per + ph) * range, 270, 0.055, 0.17);
    g.globalCompositeOperation = 'source-over';
    // Dropship with blinking lights, its own beam picking through the district.
    if (!still) {
      this.shipAt -= dt;
      if (this.shipAt <= 0 && !this.ship) { this.ship = { x: W + 50, y: 62 + Math.random() * 46, v: 0.028 + Math.random() * 0.018 }; this.shipAt = 16000 + Math.random() * 12000; }
      if (this.ship) {
        const s = this.ship; s.x -= s.v * dt;
        if (s.x < -80) this.ship = null;
        else {
          const sx = Math.round(s.x), sy = Math.round(s.y + Math.sin(T / 700) * 2);
          g.fillStyle = '#05070c'; g.fillRect(sx - 18, sy - 3, 36, 7); g.fillRect(sx - 8, sy - 7, 15, 5); g.fillRect(sx + 15, sy - 8, 5, 7); g.fillRect(sx - 26, sy - 1, 8, 2); g.fillRect(sx - 4, sy + 4, 9, 3);
          g.globalCompositeOperation = 'lighter';
          this.beam(g, sx - 2, sy + 6, 1.5 + Math.sin(T / 900) * 0.3, 165, 0.09, 0.22, '200,225,255');
          g.fillStyle = Math.sin(T / 160) > 0 ? '#ff4a36' : '#5a1a14'; g.fillRect(sx + 18, sy - 8, 2, 2);
          g.fillStyle = Math.sin(T / 210 + 2) > 0 ? '#9fe6ff' : '#22404e'; g.fillRect(sx - 24, sy, 2, 2);
          g.globalCompositeOperation = 'source-over';
        }
      }
    }
    cam(0.5); g.drawImage(L.mid.c, -70, 0);
    if (!still) for (const [x, y, s, ph] of L.mid.flick) if (Math.sin(T / 1300 + ph) > 0.55) { g.fillStyle = '#0d1119'; g.fillRect(x - 70, y, s, s + 1); }
    // A red beacon on the Directorate's tower, and smoke from two stacks lit from below.
    cam(0.5);
    const bx = 438, by = 188;
    g.fillStyle = '#0a0d13'; g.fillRect(bx - 11, by, 22, 110); g.fillRect(bx - 3, by - 34, 6, 36); g.fillStyle = '#2a2023'; g.fillRect(bx - 11, by, 1, 110);
    const pulse = (Math.sin(T / 520) + 1) / 2;
    g.globalCompositeOperation = 'lighter';
    const rg = g.createRadialGradient(bx, by - 35, 1, bx, by - 35, 26);
    rg.addColorStop(0, `rgba(255,70,50,${0.25 + pulse * 0.55})`); rg.addColorStop(1, 'rgba(255,70,50,0)');
    g.fillStyle = rg; g.fillRect(bx - 28, by - 62, 56, 56);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = pulse > 0.5 ? '#ff5a44' : '#7a241c'; g.fillRect(bx - 1, by - 36, 3, 3);
    for (const k of [0, 1]) { const sx = k ? 335 : 594, sy = k ? 202 : 214; g.fillStyle = '#0a0d13'; g.fillRect(sx - 5, sy, 10, 90); g.fillStyle = '#6a3f24'; g.fillRect(sx - 5, sy, 10, 1); }
    if (!still) for (const p of this.smoke) {
      const sx = p.stack ? 335 : 594, sy = p.stack ? 200 : 212, life = (p.t + T / 9000 + p.seed) % 1, r = 3 + life * 19;
      g.fillStyle = `rgba(${90 - life * 40},${70 - life * 25},${70 - life * 20},${0.3 * (1 - life)})`;
      g.beginPath(); g.ellipse(sx + life * 54 + Math.sin(p.seed + life * 6) * 7, sy - life * 110, r, r * 0.78, 0, 0, 7); g.fill();
    }
    // Warm city haze.
    g.setTransform(1, 0, 0, 1, 0, 0);
    const hz = g.createLinearGradient(0, 210, 0, H); hz.addColorStop(0, 'rgba(170,92,40,0)'); hz.addColorStop(1, 'rgba(190,100,44,.34)');
    g.fillStyle = hz; g.fillRect(0, 210, W, H - 210);
    // The rooftop, its operatives and drone, on the right so the menu has the left.
    cam(1);
    const roofY = H - 62;
    g.drawImage(L.roof, -40, roofY - 22);
    if (this.cast[1]) this.drawFigure(g, this.cast[1], T + 700, 418, roofY + 8, 150, 0.94);
    if (this.cast[0]) this.drawFigure(g, this.cast[0], T, 506, roofY + 18, 178);
    if (this.drone) {
      const hf = this.drone(T), hx = 566 + Math.sin(T / 830) * 6, hy = roofY - 118 + Math.sin(T / 310) * 3;
      if (hf) {
        const k = Math.min(44 / hf.sh, 62 / hf.sw), w = hf.sw * k, h = hf.sh * k;
        g.globalCompositeOperation = 'lighter';
        const gl = g.createRadialGradient(hx, hy, 2, hx, hy, 42); gl.addColorStop(0, 'rgba(255,190,120,.17)'); gl.addColorStop(1, 'rgba(255,190,120,0)');
        g.fillStyle = gl; g.fillRect(hx - 42, hy - 42, 84, 84);
        g.globalCompositeOperation = 'source-over';
        g.drawImage(hf.img, hf.sx, 0, hf.sw, hf.sh, Math.round(hx - w / 2), Math.round(hy - h / 2), w, h);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!still) {
      // Embers rise from the district, rain crosses everything.
      g.globalCompositeOperation = 'lighter';
      for (const e of this.embers) {
        e.y -= e.v * dt / 32; e.s += 0.02 * dt / 32; if (e.y < -4) { e.y = H + 4; e.x = 300 + Math.random() * 340; }
        g.fillStyle = `rgba(255,${150 + Math.sin(e.s * 3) * 50},70,${0.35 + Math.sin(e.s * 2) * 0.3})`;
        g.fillRect(Math.round(e.x + Math.sin(e.s) * 10), Math.round(e.y), e.z, e.z);
      }
      g.globalCompositeOperation = 'source-over';
      g.lineWidth = 1;
      for (const d of this.rain) {
        d.y += d.v * dt / 32; d.x -= d.v * 0.28 * dt / 32; if (d.y > H) { d.y = -8; d.x = Math.random() * (W + 60); }
        g.strokeStyle = `rgba(175,195,225,${d.a})`; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.28, d.y - d.l); g.stroke();
      }
    }
    g.drawImage(L.vig, 0, 0);
  }
}
