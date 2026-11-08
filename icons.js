// Code-drawn 96x96 pixel icons for gear, items, implants, contraband, upgrades, skills and rooms.
// Keys look like 'weapon:carbine' or 'perk:hollow'. Icons are drawn lazily, once each, on first iconURL().
//
// Painter: every shape is rasterised to a mask, then lit from the top-left using a distance-to-edge
// bevel, quantised to a 7-tone material ramp with a little ordered dither. Tone 0 is reserved for the
// dark inner rim on the lower-right of shapes. No anti-aliasing, so it stays pixel art at any scale.
// guns.js reuses Painter, pistol and gun.

const S = 96;

// ---------- palette: seven tones per material, dark to specular ----------
const RAMPS = {
  steel:   ['#14181c', '#252b31', '#3a4249', '#535c64', '#707a82', '#98a1a6', '#cfd3d0'],
  gun:     ['#0c1217', '#172129', '#233340', '#324854', '#466571', '#6a8f92', '#a9c9c2'],
  black:   ['#08090b', '#121519', '#1d2228', '#2d353d', '#434d57', '#626e79', '#9aa6af'],
  silver:  ['#2a2c2f', '#4a4d50', '#6d7072', '#8f9191', '#afb0ad', '#cfcfc9', '#f1efe6'],
  gold:    ['#2c1c08', '#523610', '#7a5518', '#a37a2b', '#c79f47', '#e5c670', '#fbedb0'],
  rust:    ['#1f0f0a', '#3a1d12', '#5a2e1b', '#7c4126', '#a05a33', '#c37a4b', '#e3a676'],
  wood:    ['#170e09', '#2a1b12', '#3f2a1c', '#563c29', '#70513a', '#8d6c50', '#b0916f'],
  leather: ['#150b08', '#27140e', '#3b2016', '#522f1f', '#6c412b', '#8a583c', '#b0795a'],
  tan:     ['#2c2119', '#4a3a2c', '#6a5642', '#87715a', '#a38c72', '#c0aa8e', '#dccaad'],
  olive:   ['#15170f', '#252a1b', '#383e29', '#4e553a', '#676f4e', '#858d66', '#a9b088'],
  navy:    ['#0a0e15', '#141b27', '#1f2a3b', '#2d3c52', '#415470', '#5f7694', '#8ea5bd'],
  white:   ['#2f3336', '#565b5e', '#7f8485', '#a3a7a6', '#c2c5c1', '#dcddd6', '#f5f3e9'],
  red:     ['#1e0706', '#3f0e0b', '#66160f', '#8e2318', '#b53a26', '#d65f3f', '#f29670'],
  ion:     ['#07191f', '#0f3038', '#185059', '#237a82', '#3aa8ac', '#78d5cf', '#d2f7ec'],
  yellow:  ['#251a07', '#4a350c', '#7a5a12', '#a67d1c', '#cb9f31', '#e5c15a', '#f7e49a'],
  sodium:  ['#2a0f03', '#57200a', '#8a3a0f', '#bc5a14', '#e07f22', '#f5a648', '#ffd68f'],
  fire:    ['#3a0e05', '#7a2108', '#b83d0c', '#e5651a', '#f79030', '#ffc04f', '#fff0a6'],
  green:   ['#0c1a0e', '#173019', '#245029', '#37723a', '#549654', '#86bd78', '#c5e5a9'],
  paper:   ['#3a362c', '#5f594a', '#857e6a', '#a9a18a', '#c6bea6', '#dcd5bd', '#f3edda'],
  skin:    ['#2b150e', '#52291a', '#7a4128', '#a0603d', '#bf8158', '#d9a27b', '#f0c8a6'],
  pale:    ['#33211e', '#5a3e39', '#836259', '#a8877b', '#c6a99b', '#dfc8b9', '#f4e5d6'],
  knit:    ['#0e1114', '#1b2025', '#2a3138', '#3b444d', '#4f5a64', '#6c7882', '#949fa7'],
  glass:   ['#05080a', '#0b1216', '#131e25', '#1d2e38', '#2e4753', '#56808b', '#c8f0ee'],
  line:    ['#07080a', '#07080a', '#07080a', '#07080a', '#07080a', '#07080a', '#07080a'],
};
const MAT = {}, LUT = new Uint32Array(8 * (Object.keys(RAMPS).length + 2));
Object.keys(RAMPS).forEach((name, i) => {
  MAT[name] = i + 1;
  RAMPS[name].forEach((hex, t) => {
    const n = parseInt(hex.slice(1), 16);
    LUT[(i + 1) * 8 + t] = (255 << 24 | (n & 255) << 16 | (n >> 8 & 255) << 8 | n >> 16) >>> 0;   // little-endian RGBA
  });
});
// Per material: texture, gloss (extra brightness on strongly lit slopes), dither strength.
const LOOK = {
  steel: { tex: 'brush', gloss: 0.7 }, gun: { tex: 'brush', gloss: 0.8 }, black: { tex: 'brush', gloss: 0.8 },
  silver: { tex: 'brush', gloss: 0.9 }, gold: { tex: 'brush', gloss: 0.9 }, rust: { tex: 'grit', gloss: 0.1, dither: 0.8 },
  wood: { tex: 'wood', gloss: 0.1 }, leather: { tex: 'hide', gloss: 0.3, dither: 0.6 }, tan: { tex: 'cloth', dither: 0.7 },
  olive: { tex: 'grit', gloss: 0.2, dither: 0.7 }, navy: { tex: 'cloth', dither: 0.6 }, white: { tex: 'grit', gloss: 0.6, dither: 0.5 },
  red: { gloss: 0.5 }, ion: { gloss: 1 }, yellow: { tex: 'grit', gloss: 0.4, dither: 0.6 }, sodium: { gloss: 0.9 }, fire: { gloss: 1 },
  green: { gloss: 0.5 }, paper: { tex: 'grit', dither: 0.4 }, skin: { gloss: 0.3, dither: 0.7 }, pale: { gloss: 0.4, dither: 0.7 },
  knit: { tex: 'cloth', dither: 0.8 }, glass: { gloss: 1.4 },
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 15 - 0.5);
const NOISE = new Float32Array(1024);
{ let s = 12345; for (let i = 0; i < 1024; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; NOISE[i] = (s >> 8 & 1023) / 511.5 - 1; } }
const nz = (x, y) => NOISE[(x * 57 + y * 131 + (x * y & 15) * 17) & 1023];
const TEX = {
  brush: (x, y) => nz(y * 3, y) * 0.28 + (nz(x >> 2, y) > 0.82 ? -0.5 : 0),
  grit: (x, y) => nz(x, y) * 0.3 + (nz(x >> 1, y >> 1) > 0.72 ? -0.7 : 0),
  wood: (x, y) => nz((y + (nz(x >> 3, 3) > 0 ? 1 : 0)) * 5, 1) * 0.65 + (nz(x >> 2, y) > 0.86 ? -0.6 : 0),
  hide: (x, y) => nz(x >> 1, y >> 1) * 0.45,
  cloth: (x, y) => ((x + y) & 1 ? 0.2 : -0.2) + nz(x >> 1, y) * 0.2,
};

export class Painter {
  constructor(w = S, h = w) {
    this.w = w; this.h = h; const n = w * h;
    this.buf = new Uint16Array(n); this.mask = new Uint8Array(n); this.dist = new Int16Array(n);
    this.x0 = w; this.y0 = h; this.x1 = -1; this.y1 = -1;
  }
  // ---- mask building ----
  _bb(a, b, c, d) {
    this.x0 = Math.max(0, Math.min(this.x0, Math.floor(a))); this.y0 = Math.max(0, Math.min(this.y0, Math.floor(b)));
    this.x1 = Math.min(this.w - 1, Math.max(this.x1, Math.ceil(c))); this.y1 = Math.min(this.h - 1, Math.max(this.y1, Math.ceil(d)));
  }
  _mark(x0, y0, x1, y1, v, test) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(this.w - 1, Math.ceil(x1)); y1 = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (test(x, y)) this.mask[y * this.w + x] = v;
  }
  mRect(x, y, w, h, v = 1) { if (v) this._bb(x, y, x + w - 1, y + h - 1); this._mark(x, y, x + w - 1, y + h - 1, v, () => true); }
  mEll(cx, cy, rx, ry, v = 1) {
    if (v) this._bb(cx - rx, cy - ry, cx + rx, cy + ry);
    this._mark(cx - rx, cy - ry, cx + rx, cy + ry, v, (x, y) => { const a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b <= 1; });
  }
  mPoly(pts, v = 1) {
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    if (v) this._bb(a, b, c, d);
    for (let y = Math.max(0, Math.floor(b)); y <= Math.min(this.h - 1, Math.ceil(d)); y++) {
      const yy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [px, py] = pts[i], [qx, qy] = pts[(i + 1) % pts.length];
        if ((py <= yy && qy > yy) || (qy <= yy && py > yy)) xs.push(px + (yy - py) / (qy - py) * (qx - px));
      }
      xs.sort((m, n) => m - n);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5)); x++) this.mask[y * this.w + x] = v;
    }
  }
  mBar(x0, y0, x1, y1, w, v = 1, w2 = w) {
    const r = Math.max(w, w2) / 2 + 1;
    if (v) this._bb(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r);
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
    this._mark(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, v, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2));
      const ex = x - x0 - t * dx, ey = y - y0 - t * dy, rr = (w + (w2 - w) * t) / 2;
      return ex * ex + ey * ey <= rr * rr;
    });
  }
  // ---- painting: lights whatever is in the mask, then clears it ----
  paint(mat, o = {}) {
    const { w, mask, dist, buf } = this, { x0, y0, x1, y1 } = this, m = MAT[mat], look = LOOK[mat] || {};
    if (x1 < x0 || y1 < y0) return this;
    const R = Math.max(0.5, o.bevel ?? 3), cap = Math.ceil(R * 5) + 5, k = o.k ?? 1.5, base = o.tone ?? 3, grad = o.grad ?? 0.8;
    const texName = o.tex === undefined ? look.tex : o.tex, tex = texName && TEX[texName], tamt = o.texAmt ?? 1;
    const gloss = o.gloss ?? look.gloss ?? 0, amp = o.dither ?? look.dither ?? 0.45, round = o.flat !== true;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (!mask[i]) { dist[i] = 0; continue; }
      let d = cap;
      if (x > x0) { d = Math.min(d, dist[i - 1] + 5); if (y > y0) d = Math.min(d, dist[i - w - 1] + 7); } else d = 5;
      if (y > y0) { d = Math.min(d, dist[i - w] + 5); if (x < x1) d = Math.min(d, dist[i - w + 1] + 7); } else d = 5;
      dist[i] = d;
    }
    for (let y = y1; y >= y0; y--) for (let x = x1; x >= x0; x--) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let d = dist[i];
      if (x < x1) { d = Math.min(d, dist[i + 1] + 5); if (y < y1) d = Math.min(d, dist[i + w + 1] + 7); } else d = 5;
      if (y < y1) { d = Math.min(d, dist[i + w] + 5); if (x > x0) d = Math.min(d, dist[i + w - 1] + 7); } else d = 5;
      dist[i] = d;
    }
    const H = (d) => { const t = Math.min(1, d / 5 / R); return round ? 1 - (1 - t) * (1 - t) : t; };
    const rimOn = o.rim !== false, clip = !!o.clip, shadow = o.shadow ?? (clip ? 0 : 1);
    // contact shadow on what lies below and to the right
    if (shadow) for (let y = y0; y <= Math.min(this.h - 1, y1 + 1); y++) for (let x = x0; x <= Math.min(w - 1, x1 + 1); x++) {
      const i = y * w + x;
      if (mask[i] || !buf[i]) continue;
      if ((x > 0 && mask[i - 1]) || (y > 0 && mask[i - w]) || (x > 0 && y > 0 && mask[i - w - 1])) { const t = buf[i] & 7; buf[i] = (buf[i] & ~7) | Math.max(0, t - 2); }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (!mask[i] || (clip && !buf[i])) continue;
      const hL = x > x0 && mask[i - 1] ? H(dist[i - 1]) : 0, hR = x < x1 && mask[i + 1] ? H(dist[i + 1]) : 0;
      const hU = y > y0 && mask[i - w] ? H(dist[i - w]) : 0, hD = y < y1 && mask[i + w] ? H(dist[i + w]) : 0;
      const l = ((hR - hL) * 0.6 + (hD - hU) * 0.8) * 0.5 * R;
      let v = base + k * l + grad * ((mx - x) / bw + (my - y) / bh);
      if (gloss && l > 0.45) v += gloss * (l - 0.2);
      if (tex) v += tex(x, y) * tamt;
      v += BAYER[(y & 3) * 4 + (x & 3)] * amp;
      let t = Math.round(v);
      t = t < 1 ? 1 : t > 6 ? 6 : t;
      if (rimOn && ((x === x1 || !mask[i + 1]) || (y === y1 || !mask[i + w]))) t = Math.min(t, o.rimTone ?? 1);
      buf[i] = m * 8 + t;
    }
    for (let y = y0; y <= y1; y++) mask.fill(0, y * w + x0, y * w + x1 + 1);
    this.x0 = w; this.y0 = this.h; this.x1 = -1; this.y1 = -1;
    return this;
  }
  // ---- shapes ----
  rect(x, y, w, h, mat, o = {}) { this.mRect(x, y, w, h); return this.paint(mat, { bevel: 2, ...o }); }
  ell(cx, cy, rx, ry, mat, o = {}) { this.mEll(cx, cy, rx, ry); return this.paint(mat, { bevel: Math.min(rx, ry) * 0.9, k: 1.7, ...o }); }
  poly(pts, mat, o = {}) { this.mPoly(pts); return this.paint(mat, o); }
  bar(x0, y0, x1, y1, w, mat, o = {}) { this.mBar(x0, y0, x1, y1, w, 1, o.w2 ?? w); return this.paint(mat, { bevel: Math.max(1, w / 2), k: 1.8, ...o }); }
  ring(cx, cy, r, t, mat, o = {}) { this.mEll(cx, cy, r, r); this.mEll(cx, cy, r - t, r - t, 0); return this.paint(mat, { bevel: t / 2, k: 1.8, ...o }); }
  // Several shapes painted as one surface. Items: ['r',x,y,w,h], ['e',cx,cy,rx,ry], ['p',pts], ['b',x0,y0,x1,y1,w]; '-r' etc. cut.
  shape(mat, o, items) {
    for (const it of items) {
      const cut = it[0][0] === '-', kind = cut ? it[0][1] : it[0], v = cut ? 0 : 1;
      if (kind === 'r') this.mRect(it[1], it[2], it[3], it[4], v);
      else if (kind === 'e') this.mEll(it[1], it[2], it[3], it[4], v);
      else if (kind === 'p') this.mPoly(it[1], v);
      else if (kind === 'b') this.mBar(it[1], it[2], it[3], it[4], it[5], v);
    }
    return this.paint(mat, o || {});
  }
  // ---- pixel-level detail, all safe off-canvas ----
  has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.buf[y * this.w + x] !== 0; }
  set(x, y, mat, t) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.buf[y * this.w + x] = MAT[mat] * 8 + t; return this; }
  adj(x, y, dt) {
    if (!this.has(x, y)) return this;
    const i = y * this.w + x, t = this.buf[i] & 7;
    this.buf[i] = (this.buf[i] & ~7) | Math.max(0, Math.min(6, t + dt));
    return this;
  }
  _walk(x0, y0, x1, y1, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx - dy;
    for (;;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } }
  }
  line(x0, y0, x1, y1, mat, t) { this._walk(x0, y0, x1, y1, (x, y) => this.set(x, y, mat, t)); return this; }
  // Cut-in seam: dark line with a catch light just below it. Only touches pixels already painted.
  groove(x0, y0, x1, y1, dark = -2) { this._walk(x0, y0, x1, y1, (x, y) => { if (this.has(x, y)) { this.adj(x, y, dark); this.adj(x + (y0 === y1 ? 0 : 1), y + (y0 === y1 ? 1 : 0), 1); } }); return this; }
  tint(x0, y0, x1, y1, dt) { this._walk(x0, y0, x1, y1, (x, y) => this.adj(x, y, dt)); return this; }
  shade(x, y, w, h, dt) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.adj(i, j, dt); return this; }
  rivet(x, y, mat = 'steel') { this.set(x, y, mat, 6).set(x + 1, y, mat, 4).set(x, y + 1, mat, 4).set(x + 1, y + 1, mat, 2); this.adj(x + 2, y + 1, -2).adj(x + 1, y + 2, -2).adj(x + 2, y + 2, -2); return this; }
  // Blotchy wear on painted pixels: tone knocks, plus optional material swap (rust creep).
  grime(x, y, w, h, seed = 1, amt = 0.55, mat = null) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (!this.has(i, j)) continue;
      // Blocks with jittered edges, so patches read as wear rather than a grid; rust creep is rarer than tone wear.
      const n = nz(((i + (nz(i, j) > 0 ? 1 : 0)) >> 2) + seed * 7, ((j + (nz(j, i) > 0 ? 1 : 0)) >> 2) + seed) * 0.75 + nz(i + seed, j) * 0.25;
      if (n > amt + (mat ? 0.14 : 0)) {
        const q = j * this.w + i;
        if (mat) this.buf[q] = MAT[mat] * 8 + Math.max(1, Math.min(5, this.buf[q] & 7));
        else this.adj(i, j, -1);
      }
    }
    return this;
  }
  // Short bright nicks.
  scuff(x, y, w, h, seed = 1, n = 6) {
    for (let k = 0; k < n; k++) {
      const a = x + Math.floor((nz(k + seed, 3) + 1) / 2 * w), b = y + Math.floor((nz(5, k + seed) + 1) / 2 * h), l = 1 + (k % 3);
      this.tint(a, b, a + l, b - (k % 2), 2);
    }
    return this;
  }
  // Outer outline. w=2 is a full two pixel border; w=1 is one pixel plus extra weight lower-right.
  outline(w = 2) {
    const W = this.w, H = this.h, src = this.buf, line = MAT.line * 8;
    const out = src.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!src[i]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const a = x + dx, b = y + dy;
        if (a >= 0 && b >= 0 && a < W && b < H && !src[b * W + a]) out[b * W + a] = line;
      }
      if (w >= 2) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const a = x + dx, b = y + dy;
        if (a >= 0 && b >= 0 && a < W && b < H && !src[b * W + a]) out[b * W + a] = line;
      }
    }
    this.buf = out;
    return this;
  }
  // Shift the drawing so its bounds sit centred on the canvas.
  centre() {
    const r = this.bounds(), dx = ((this.w - r.w) >> 1) - r.x, dy = ((this.h - r.h) >> 1) - r.y;
    if (!dx && !dy) return this;
    const out = new Uint16Array(this.buf.length);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) out[(y + r.y + dy) * this.w + x + r.x + dx] = this.buf[(y + r.y) * this.w + x + r.x];
    this.buf = out;
    return this;
  }
  // Tight bounds of everything painted.
  bounds() {
    let a = this.w, b = this.h, c = -1, d = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.buf[y * this.w + x]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
    return { x: a, y: b, w: c - a + 1, h: d - b + 1 };
  }
  // To canvas, optionally cropped to r.
  canvas(r = { x: 0, y: 0, w: this.w, h: this.h }) {
    const c = document.createElement('canvas');
    c.width = r.w; c.height = r.h;
    const ctx = c.getContext('2d'), im = ctx.createImageData(r.w, r.h), px = new Uint32Array(im.data.buffer);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const v = this.buf[(y + r.y) * this.w + x + r.x]; if (v) px[y * r.w + x] = LUT[v]; }
    ctx.putImageData(im, 0, 0);
    return c;
  }
}

// ---------- guns ----------
// Long gun, side view, muzzle right. (x, y) is the receiver's top-left, len x h its size; everything else hangs off that.
export function gun(p, o) {
  const { x, y, len, h, body = 'gun', barrel = 'black', bl = 20, stock = null, stockMat = 'wood', stockLen = 0, gripMat = 'leather', mag = null, magMat = 'black', muzzle = null, muzzleMat = 'black', scope = null, scopeMat = 'black', accent = null, hand = null, handMat = null, pump = null, pumpMat = 'wood', tube = false } = o;
  const u = Math.max(1, Math.round(h / 7)), bh = o.bh ?? Math.max(2, Math.round(h * 0.34)), by = o.by ?? y + Math.round(h * 0.18), gx = o.gx ?? x + Math.round(len * 0.26), gw = o.gw ?? Math.round(h * 0.62), gh = o.gh ?? Math.round(h * 1.05);
  const end = x + len + bl;
  // stock behind everything
  if (stock === 'solid' || stock === 'wood') {
    const sl = stockLen, top = y + u, low = y + h + Math.round(h * 0.55);
    p.poly([[x + 3, top], [x - sl * 0.45, top + u], [x - sl, top + u * 2], [x - sl, low], [x - sl + u * 2, low], [x - sl * 0.4, y + h + u], [x + 3, y + h - 1]], stockMat, { bevel: 2 + u, k: 1.5 });
    p.rect(x - sl - u, top + u * 2, u * 2, low - top - u * 2 + 1, 'black', { bevel: 1, shadow: 0 });
    if (stock === 'wood') p.groove(x - sl + u * 3, top + u * 3, x, top + u * 2);
  } else if (stock === 'skel') {
    const sl = stockLen, low = y + h + Math.round(h * 0.4);
    p.bar(x + 2, y + u * 2, x - sl, y + u * 2, u * 2, stockMat);
    p.bar(x + 2, y + h - u, x - sl, low, u * 2, stockMat);
    p.rect(x - sl - u, y + u, u * 2 + 1, low - y + 1, 'black', { bevel: 1 });
  }
  // barrel, with tube mag and muzzle
  if (tube) p.bar(x + len - 1, by + bh + u * 2, x + len + bl * 0.82, by + bh + u * 2, u * 3, 'steel');
  p.rect(x + len - 2, by, bl + 2, bh, barrel, { bevel: Math.max(1, bh / 2), k: 1.9, gloss: 1.1 });
  if (bh > 2 * u) p.tint(x + len + 2, by + 1, end - 2, by + 1, 1);
  if (muzzle === 'brake') {
    p.rect(end - u * 5, by - u, u * 5 + 1, bh + u * 2, muzzleMat, { bevel: 1, k: 2 });
    for (let k = 1; k < 4; k += 2) p.rect(end - u * 5 + k * u, by, u, bh, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null });
  } else if (muzzle === 'flash') {
    p.poly([[end - u * 4, by - u * 0.5], [end + u, by - u], [end + u, by + bh + u], [end - u * 4, by + bh + u * 0.5]], muzzleMat, { bevel: 1, k: 2 });
    p.tint(end - u * 2, by, end - u * 2, by + bh - 1, -2);
  } else if (muzzle === 'bell') {
    p.poly([[end - u * 5, by - u * 0.5], [end + u, by - u * 2.5], [end + u, by + bh + u * 2.5], [end - u * 5, by + bh + u * 0.5]], muzzleMat, { bevel: 2, k: 1.8 });
    p.rect(end, by - u, u + 1, bh + u * 2, 'black', { tone: 0.5, k: 0, rim: false, shadow: 0, tex: null });
  } else if (muzzle === 'coil') {
    for (let k = 0; k < 3; k++) p.rect(end - u * (8 - k * 3), by - u, u * 2, bh + u * 2, 'ion', { bevel: 1, k: 2, tone: 3.5 });
    p.rect(end - u, by - u * 0.5, u * 2, bh + u, muzzleMat, { bevel: 1 });
  } else p.rect(end - u, by - (u > 1 ? 1 : 0), u + 1, bh + (u > 1 ? 2 : 0), muzzleMat, { bevel: 1, k: 2 });
  // magazine
  if (mag) {
    const mx = o.magX ?? x + Math.round(len * 0.58), mw = o.magW ?? Math.round(h * 0.6), mh = o.magH ?? Math.round(h * 1.15), my = y + h - 1;
    if (mag === 'box') {
      p.poly([[mx, my], [mx + mw, my], [mx + mw - u, my + mh], [mx - u * 2, my + mh]], magMat, { bevel: 1 + u / 2, k: 1.7 });
      for (let k = 2; k < mh - 1; k += 2 * u + 1) p.groove(mx - Math.round(k * 2 * u / mh) + 1, my + k, mx + mw - 2, my + k);
    } else if (mag === 'curve') {
      p.poly([[mx, my], [mx + mw, my], [mx + mw - u, my + mh * 0.55], [mx + mw - u * 4, my + mh], [mx - u * 5, my + mh * 0.92], [mx - u * 2, my + mh * 0.5]], magMat, { bevel: 1 + u / 2, k: 1.7 });
      p.groove(mx + 1, my + Math.round(mh * 0.35), mx + mw - 2, my + Math.round(mh * 0.35));
      p.groove(mx - u * 2, my + Math.round(mh * 0.65), mx + mw - u * 2, my + Math.round(mh * 0.7));
    } else if (mag === 'drum') {
      const r = mw, cy = my + r - u;
      p.ell(mx + mw / 2, cy, r, r, magMat, { k: 1.8 });
      p.ell(mx + mw / 2, cy, r * 0.55, r * 0.55, magMat, { tone: 2.5, bevel: 2, k: 1.4, shadow: 0, rimTone: 0 });
      p.rivet(Math.round(mx + mw / 2) - 1, Math.round(cy) - 1, 'steel');
      p.tint(mx + mw / 2, cy - r + 2, mx + mw / 2, cy - r * 0.6, -2).tint(mx + mw / 2 - r * 0.75, cy, mx + mw / 2 - r * 0.6, cy, -2).tint(mx + mw / 2 + r * 0.6, cy, mx + mw / 2 + r * 0.8, cy, -2);
    }
  }
  // pistol grip and trigger guard
  p.poly([[gx, y + h - 2], [gx + gw, y + h - 2], [gx + gw - u, y + h + gh], [gx - u * 2.5, y + h + gh], [gx - u * 2, y + h + gh * 0.5]], gripMat, { bevel: 1 + u / 2, k: 1.5 });
  for (let k = 2; k < gh - 1; k += 2 + (u > 1 ? 1 : 0)) p.tint(gx - u + 1, y + h + k, gx + gw - u - 2, y + h + k, -1);
  const tx = gx + gw;
  p.shape(body, { bevel: 1, k: 1.3, tone: 2.6 }, [['r', tx - 1, y + h, u * 4 + 2, gh * 0.55 + 1], ['-r', tx - 1 + u, y + h, u * 3 - u, gh * 0.55 + 1 - u]]);
  p.line(tx + u, y + h, tx + u - 1, y + h + Math.ceil(gh * 0.28), 'silver', 4);
  // receiver
  const ch = Math.max(1, u * 2);
  p.poly([[x, y], [x + len - ch, y], [x + len, y + ch], [x + len, y + h - u], [x + len - ch, y + h], [x, y + h]], body, { bevel: 1 + u, k: 1.4, tone: o.bodyTone ?? 3.4 });
  // handguard, pump
  if (hand) {
    const hl = hand, hh = h - u;
    p.poly([[x + len - 1, y + u], [x + len + hl - u, y + u], [x + len + hl, y + u * 2], [x + len + hl, y + hh - u], [x + len + hl - u, y + hh], [x + len - 1, y + hh]], handMat || body, { bevel: 1 + u / 2, k: 1.6 });
    const vy = y + u * 2, vh = Math.max(1, u * 1);
    for (let vx = x + len + u * 2; vx < x + len + hl - u * 2; vx += u * 3) p.rect(vx, vy, u, vh + 1, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null });
  }
  if (pump) {
    const px = x + len + (o.pumpX ?? Math.round(bl * 0.25));
    p.rect(px, by + bh, pump, u * 4, pumpMat, { bevel: 1 + u / 2, k: 1.7 });
    for (let k = px + u; k < px + pump - 1; k += u + 1) p.tint(k, by + bh + 1, k, by + bh + u * 3, -2);
  }
  // receiver details
  p.groove(x + u, y + Math.round(h * 0.62), x + len - u * 2, y + Math.round(h * 0.62));
  const portX = x + Math.round(len * 0.5), portW = Math.max(2, Math.round(len * 0.2));
  p.rect(portX, y + u, portW, Math.max(1, u + 1), 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null });
  p.set(portX + portW - 1, y + u, 'silver', 5);
  if (h >= 12) { p.rivet(x + u * 2, y + h - u * 2 - 1); p.rivet(x + len - u * 4, y + h - u * 2 - 1); }
  if (accent) { p.line(x + u, y + Math.round(h * 0.62) + 1, x + len - u * 2, y + Math.round(h * 0.62) + 1, accent, 5); p.line(x + u, y + Math.round(h * 0.62) + 2, x + len - u * 2, y + Math.round(h * 0.62) + 2, accent, 3); }
  p.tint(x + 1, y, x + len - ch, y, 2);
  // sights or scope
  if (scope) {
    const sw = o.scopeW ?? Math.round(len * 0.8), sx = o.scopeX ?? x + Math.round(len * 0.08), sh = o.scopeH ?? Math.max(3, u * 3), sy = y - sh - Math.max(1, u);
    p.rect(sx + u * 2, sy + sh - 1, u * 2, y - sy - sh + 2, 'steel', { bevel: 1 });
    p.rect(sx + sw - u * 4, sy + sh - 1, u * 2, y - sy - sh + 2, 'steel', { bevel: 1 });
    p.bar(sx + 1, sy + sh / 2, sx + sw - 1, sy + sh / 2, sh, scopeMat, { gloss: 1.2 });
    p.rect(sx + sw - u, sy - u * 0.5, u * 2, sh + u, scopeMat, { bevel: 1, k: 2 });
    p.rect(sx - u, sy - u * 0.5, u * 2, sh + u, scopeMat, { bevel: 1, k: 2 });
    p.line(sx + sw + u - 1, sy, sx + sw + u - 1, sy + sh - 1, scope === 'ion' ? 'ion' : 'glass', 6);
    p.line(sx + 2, sy + 1, sx + sw * 0.5, sy + 1, scopeMat, 6);
  } else {
    p.rect(x + Math.round(len * 0.82), y - u, u + 1, u + 1, 'black', { bevel: 1, shadow: 0 });
    p.rect(x + u * 2, y - u, u * 2 + 1, u + 1, 'black', { bevel: 1, shadow: 0 });
  }
}

// Pistol, side view, muzzle right: slide on frame on grip. (x, y) is the slide's top-left.
export function pistol(p, o) {
  const { x, y, len, h, slide = 'gun', frame = 'black', gripMat = 'leather', barrel = 'steel', bl = 0, trim = null, drum = null, lamp = null } = o;
  const u = Math.max(1, Math.round(h / 8)), fh = o.fh ?? Math.round(h * 0.55), gh = o.gh ?? Math.round(h * 1.75), gw = o.gw ?? Math.round(len * 0.32), fy = y + h - 1;
  // barrel protrudes a bit
  if (bl) p.rect(x + len - 2, y + Math.round(h * 0.25), bl + 2, Math.max(2, Math.round(h * 0.42)), barrel, { bevel: 1.5, k: 1.9, gloss: 1.1 });
  // grip raked backwards
  const gx = x + Math.round(len * 0.1);
  p.poly([[gx + 1, fy + fh - u], [gx + gw + u, fy + fh - u], [gx + gw - u * 2, fy + fh + gh], [gx - u * 4, fy + fh + gh], [gx - u * 3, fy + fh + gh * 0.5]], gripMat, { bevel: 2 + u / 2, k: 1.6 });
  for (let k = u * 2; k < gh - u; k += u + 1 + (u > 1 ? 1 : 0)) p.tint(gx - u, fy + fh + k, gx + gw - u * 2, fy + fh + k, -1);
  p.rect(gx - u * 4 - 1, fy + fh + gh - 1, gw + u * 2 + 1, u + 1, 'black', { bevel: 1, shadow: 0 });
  // frame and trigger guard
  const tx = gx + gw;
  p.shape(frame, { bevel: 1, k: 1.3, tone: 2.6 }, [['r', tx - 1, fy + fh - 1, Math.round(len * 0.28), Math.round(h * 0.7)], ['-r', tx - 1 + u, fy + fh - 1, Math.round(len * 0.28) - u * 2, Math.round(h * 0.7) - u]]);
  p.line(tx + u + 1, fy + fh - 1, tx + u, fy + fh + Math.round(h * 0.3), 'silver', 4);
  p.poly([[x + 1, fy], [x + len - u * 3, fy], [x + len - u * 2, fy + fh * 0.5], [x + len - u * 4, fy + fh], [x + 1, fy + fh]], frame, { bevel: 1 + u / 2, k: 1.4 });
  // hammer
  p.rect(x - u * 2 + 1, y + u, u * 2, u * 3, 'black', { bevel: 1 });
  // slide
  if (drum) {
    const dx = x + Math.round(len * 0.26), dw = Math.round(len * 0.34);
    p.rect(x, y, len, Math.round(h * 0.42), slide, { bevel: 1 + u / 2, k: 1.5 });
    p.rect(x + len - 2, y + u, bl || u * 2, Math.round(h * 0.42) - u, barrel, { bevel: 1, k: 1.9 });
    p.rect(x, y + Math.round(h * 0.38), dx - x, h - Math.round(h * 0.38), slide, { bevel: 1 + u / 2, k: 1.5 });
    p.rect(dx, y + Math.round(h * 0.1), dw, Math.round(h * 1.05), drum, { bevel: 2 + u / 2, k: 2 });
    for (let k = dx + Math.round(dw / 4); k < dx + dw - 1; k += Math.round(dw / 3.2)) p.groove(k, y + Math.round(h * 0.18), k, y + Math.round(h * 1.08));
  } else {
    p.poly([[x, y], [x + len - u, y], [x + len, y + u], [x + len, y + h], [x, y + h]], slide, { bevel: 1 + u, k: 1.5 });
    const sn = Math.max(4, Math.round(len * 0.26));
    for (let k = x + u * 2; k < x + u * 2 + sn; k += u + 1) p.tint(k, y + u + 1, k, y + h - u - 1, -2);
    p.rect(x + Math.round(len * 0.48), y + u, Math.round(len * 0.2), Math.max(1, u + 1), 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null });
    p.set(x + Math.round(len * 0.68) - 1, y + u, 'silver', 5);
    p.tint(x + 1, y, x + len - u - 1, y, 2);
    p.rect(x + len - u * 3, y - u, u + 1, u + 1, 'black', { bevel: 1, shadow: 0 });
    p.rect(x + u, y - u, u * 2, u + 1, 'black', { bevel: 1, shadow: 0 });
  }
  if (trim) { p.line(x + 2, y + h - u, x + len - u * 2, y + h - u, trim, 5); p.line(x + 2, y + h - u + 1, x + len - u * 2, y + h - u + 1, trim, 3); }
  if (lamp) { p.set(x + len - u * 4, y + h + 1, lamp, 6); p.set(x + len - u * 4 + 1, y + h + 1, lamp, 5); p.set(x + len - u * 4, y + h + 2, lamp, 4); p.set(x + len - u * 4 + 1, y + h + 2, lamp, 3); }
}

// ---------- shared icon shapes ----------
function spark(p, x, y, r = 4, mat = 'ion') {
  p.line(x - r, y, x + r, y, mat, 5); p.line(x, y - r, x, y + r, mat, 5);
  p.line(x - 1, y, x + 1, y, mat, 6); p.line(x, y - 1, x, y + 1, mat, 6);
}
function arcLine(p, pts, mat = 'ion') {
  for (let i = 0; i + 1 < pts.length; i++) {
    p.line(pts[i][0] + 1, pts[i][1] + 1, pts[i + 1][0] + 1, pts[i + 1][1] + 1, mat, 3);
    p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], mat, 6);
  }
}
function coin(p, x = 48, y = 48, r = 30, mat = 'gold') {
  p.ell(x, y, r, r, mat, { bevel: Math.max(2, r * 0.22), k: 2, tone: 3.4 });
  p.ell(x, y, r * 0.72, r * 0.72, mat, { bevel: 1.5, k: -1, tone: 3.2, shadow: 0, rim: false });
  const b = Math.max(1, Math.round(r * 0.16)), h = Math.round(r * 0.42);
  p.rect(x - b, y - h, b * 2, h * 2, mat, { bevel: 1, tone: 5, k: 1.2, shadow: 1, rimTone: 2 });
  p.rect(x - b * 2.4, y - h + b * 0.5, b * 4.8, b, mat, { bevel: 1, tone: 5, k: 1.2, shadow: 0, rimTone: 2 });
  p.rect(x - b * 2.4, y + h - b * 1.5, b * 4.8, b, mat, { bevel: 1, tone: 5, k: 1.2, shadow: 0, rimTone: 2 });
  p.tint(x - r * 0.6, y - r * 0.55, x - r * 0.35, y - r * 0.78, 2);
}
function heart(p, mat = 'red', o = {}) {
  p.shape(mat, { bevel: 12, k: 1.7, tone: 3.2, ...o }, [['e', 30, 34, 22, 23], ['e', 66, 34, 22, 23], ['p', [[9, 42], [87, 42], [48, 90]]]]);
  p.ell(27, 26, 6, 5, mat, { tone: 5.4, bevel: 3, k: 0.6, shadow: 0, rim: false, clip: true });
  p.set(23, 23, mat, 6).set(24, 23, mat, 6).set(23, 24, mat, 6);
}
function crosshair(p, mat = 'red') {
  p.ring(48, 48, 34, 7, mat, { tone: 3.4 });
  p.rect(44, 3, 8, 26, mat, { tone: 3.6, bevel: 2 }); p.rect(44, 67, 8, 26, mat, { tone: 3.2, bevel: 2 });
  p.rect(3, 44, 26, 8, mat, { tone: 3.6, bevel: 2 }); p.rect(67, 44, 26, 8, mat, { tone: 3.2, bevel: 2 });
  p.ell(48, 48, 6, 6, mat, { tone: 4.5 });
  p.set(46, 46, mat, 6).set(47, 46, mat, 6);
}
function shield(p, mat = 'steel', o = {}) {
  const pts = [[14, 10], [34, 6], [48, 4], [62, 6], [82, 10], [84, 44], [76, 64], [62, 80], [48, 90], [34, 80], [20, 64], [12, 44]];
  p.poly(pts, mat, { bevel: 6, k: 1.7, tone: 3, ...o });
  p.poly([[24, 18], [48, 13], [72, 18], [73, 43], [66, 60], [48, 78], [30, 60], [23, 43]], mat, { bevel: 2, k: -1.2, tone: 3, shadow: 0, rim: false, clip: true });
  p.rect(44, 13, 8, 64, mat, { tone: 4.6, bevel: 2, shadow: 1, clip: true });
  p.rect(24, 34, 49, 7, mat, { tone: 4.2, bevel: 2, shadow: 1, clip: true });
  p.scuff(20, 14, 56, 46, 4, 7);
}
function bolt(p, mat = 'yellow', o = {}) {
  const dark = o.back || 'black';
  p.poly([[58, 3], [18, 54], [42, 54], [32, 93], [78, 36], [52, 36], [66, 3]], mat, { bevel: 4, k: 1.6, tone: 4, gloss: 1 });
  p.line(57, 6, 23, 51, mat, 6); p.line(33, 90, 72, 40, mat, dark === 'black' ? 3 : 2);
}
function skull(p, { eye = null, cx = 48, cy = 42, s = 1, mat = 'pale' } = {}) {
  const X = (v) => cx + v * s, Y = (v) => cy + v * s;
  p.shape(mat, { bevel: 12 * s, k: 1.6, tone: 3.8, gloss: 0.4 }, [['e', cx, cy, 34 * s, 31 * s], ['r', X(-20), Y(18), 40 * s, 26 * s]]);
  p.shade(X(-15), Y(36), 30 * s, 8 * s, -1);
  for (const sx of [-1, 1]) {
    const ex = X(sx * 14);
    p.ell(ex, Y(4), 10 * s, 10.5 * s, 'black', { tone: 0.6, k: 0.2, shadow: 0, rim: false, tex: null, dither: 0 });
    p.tint(ex - 9 * s, Y(-7), ex + 9 * s, Y(-7), 1);
    if (eye) { p.ell(ex, Y(5), 5 * s, 5 * s, eye, { tone: 4.4, k: 1.2, shadow: 0, rim: false }); p.set(Math.round(ex - s), Math.round(Y(3)), eye, 6); }
  }
  p.poly([[cx, Y(13)], [X(5), Y(23)], [X(-5), Y(23)]], 'black', { tone: 0.8, k: 0, rim: false, shadow: 0, tex: null, dither: 0 });
  for (let k = -12; k <= 12; k += 6) p.rect(Math.round(X(k)) - 0, Y(30), Math.max(1, Math.round(1.5 * s)), 14 * s, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null, dither: 0 });
  p.line(X(10), Y(-28), X(4), Y(-18), mat, 1); p.line(X(4), Y(-18), X(9), Y(-11), mat, 1);
}
function crate(p, mat = 'wood', o = {}) {
  const x = o.x ?? 8, y = o.y ?? 22, w = o.w ?? 80, h = o.h ?? 68;
  p.rect(x, y, w, h, mat, { bevel: 3, k: 1, tone: 2.7 });
  for (let k = 1; k < 4; k++) p.groove(x + 2, y + Math.round(h * k / 4), x + w - 3, y + Math.round(h * k / 4));
  const b = Math.round(w * 0.12);
  p.rect(x, y, w, b, mat, { bevel: 2, tone: 3.8, k: 1.2 });
  p.rect(x, y + h - b, w, b, mat, { bevel: 2, tone: 3.4, k: 1.2 });
  p.rect(x, y, b, h, mat, { bevel: 2, tone: 3.8, k: 1.2 });
  p.rect(x + w - b, y, b, h, mat, { bevel: 2, tone: 3.2, k: 1.2 });
  p.poly([[x + b, y + h - b - 7], [x + w - b - 7, y + b], [x + w - b, y + b], [x + w - b, y + b + 7], [x + b + 7, y + h - b], [x + b, y + h - b]], mat, { bevel: 2, tone: 3.5, k: 1.1, shadow: 1 });
  for (const [a, c] of [[x + 3, y + 3], [x + w - 6, y + 3], [x + 3, y + h - 6], [x + w - 6, y + h - 6]]) p.rivet(a, c);
  p.grime(x, y + h - 14, w, 14, 5, 0.3);
}
function fist(p, mat = 'skin', wrap = 'rust') {
  p.rect(30, 70, 38, 22, wrap, { bevel: 3, k: 1.4 });
  for (let y = 75; y < 92; y += 5) p.groove(31, y, 66, y);
  p.shape(mat, { bevel: 8, k: 1.4, tone: 3.3 }, [['r', 22, 16, 56, 58], ['e', 50, 18, 28, 12], ['e', 50, 72, 26, 8]]);
  // knuckle row
  for (let k = 0; k < 4; k++) {
    const x = 24 + k * 13.5;
    p.rect(x, 12, 13, 28, mat, { bevel: 5, tone: 4, k: 1.5, shadow: 1 });
    p.set(x + 3, 15, mat, 6).set(x + 4, 15, mat, 6);
  }
  // thumb across
  p.bar(10, 50, 52, 46, 16, mat, { tone: 3.7, k: 1.5 });
  p.tint(14, 43, 40, 41, 2);
}
function medbag(p, mat = 'white', cross = 'red') {
  p.shape('black', { bevel: 2 }, [['r', 34, 8, 28, 20], ['-r', 40, 14, 16, 16]]);
  p.rect(8, 22, 80, 68, mat, { bevel: 5, k: 1.4, tone: 3.6 });
  p.groove(10, 36, 86, 36);
  p.rect(38, 20, 20, 8, 'steel', { bevel: 1 });
  p.rect(41, 42, 14, 40, cross, { bevel: 2, tone: 3.8, k: 1.2 });
  p.rect(28, 54, 40, 15, cross, { bevel: 2, tone: 3.8, k: 1.2 });
  p.grime(8, 70, 80, 20, 3, 0.35);
  p.rivet(12, 26); p.rivet(81, 26);
}
const TORSO = [[36, 7], [60, 7], [76, 12], [88, 25], [90, 47], [78, 49], [75, 40], [74, 89], [22, 89], [21, 40], [18, 49], [6, 47], [8, 25], [20, 12]];
function torso(p, mat, { collar = 'black', tone = 3, tex, k = 1.4, seams = true } = {}) {
  p.poly(TORSO, mat, { bevel: 8, k, tone, ...(tex !== undefined ? { tex } : {}) });
  p.ell(48, 7, 13, 11, collar, { tone: 1, k: 0.3, rim: false, shadow: 0, clip: true, tex: null });
  if (seams) { p.groove(22, 18, 21, 44); p.groove(74, 18, 75, 44); }
  p.tint(36, 18, 48, 22, 1); p.tint(60, 18, 48, 22, 1);
}
function helm(p, mat, { visor = null, crest = null, brim = null, cheek = false, tone = 3.2, vents = false } = {}) {
  if (cheek) { p.poly([[12, 44], [26, 44], [28, 78], [18, 84], [12, 72]], mat, { bevel: 3, k: 1.5, tone: tone - 0.4 }); p.poly([[84, 44], [70, 44], [68, 78], [78, 84], [84, 72]], mat, { bevel: 3, k: 1.5, tone: tone - 0.6 }); }
  p.shape(mat, { bevel: 14, k: 1.8, tone }, [['e', 48, 42, 36, 36], ['-r', 0, 68, 96, 28]]);
  p.ell(35, 22, 7, 5, mat, { tone: tone + 2, bevel: 3, k: 0.5, clip: true, shadow: 0, rim: false });
  p.tint(30, 19, 36, 15, 1);
  if (crest) { p.rect(42, 2, 12, 38, crest, { bevel: 3, k: 1.7, tone: 3 }); }
  if (visor) {
    p.poly([[16, 40], [80, 40], [84, 62], [12, 62]], visor, { bevel: 2, k: 1.4, tone: visor === 'black' ? 2 : 3.4, tex: null });
    p.line(22, 44, 38, 44, visor, 6); p.line(22, 45, 30, 45, visor, 5); p.line(25, 49, 32, 49, visor, 5);
  }
  if (vents) for (let x = 36; x <= 58; x += 6) p.rect(x, 70, 3, 12, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null });
  if (brim) p.rect(6, 64, 84, 8, brim, { bevel: 2, k: 1.5 });
  else p.rect(12, 62, 72, 7, mat, { bevel: 2, k: 1.5, tone: tone - 0.8 });
  p.rivet(18, 65); p.rivet(76, 65);
}
function legs(p, mat, { boots = 'black', knee = null, stripe = null, tone = 3, belt = 'leather', buckle = 'steel' } = {}) {
  // boots first so trouser cuffs overlap them
  p.poly([[24, 72], [46, 72], [46, 92], [14, 92], [14, 85], [24, 80]], boots, { bevel: 3, k: 1.6 });
  p.poly([[50, 72], [72, 72], [72, 80], [82, 85], [82, 92], [50, 92]], boots, { bevel: 3, k: 1.6, tone: 2.7 });
  p.line(14, 91, 46, 91, 'black', 4); p.line(50, 91, 82, 91, 'black', 3);
  p.poly([[24, 6], [72, 6], [76, 30], [74, 78], [52, 78], [48, 34], [44, 78], [22, 78], [20, 30]], mat, { bevel: 7, k: 1.4, tone });
  // waistband, fly, creases
  p.rect(23, 5, 50, 10, belt, { bevel: 2, k: 1.5 });
  p.rect(43, 5, 10, 10, buckle, { bevel: 2, k: 2, tone: 3.6 });
  p.groove(48, 16, 48, 33);
  p.tint(33, 22, 31, 74, 1); p.tint(64, 22, 66, 74, -1);
  p.groove(26, 30, 40, 26); p.groove(70, 30, 56, 26);
  if (knee) {
    p.rect(26, 44, 18, 16, knee, { bevel: 3, k: 1.7, tone: 3.6 }); p.rect(53, 44, 18, 16, knee, { bevel: 3, k: 1.7, tone: 3.3 });
    p.rivet(29, 47); p.rivet(40, 47); p.rivet(56, 47); p.rivet(67, 47);
  }
  if (stripe) { p.rect(24, 18, 3, 58, stripe, { bevel: 1, tone: 4, shadow: 0, rim: false }); p.rect(70, 18, 3, 58, stripe, { bevel: 1, tone: 3.6, shadow: 0, rim: false }); }
}
// Diagonal blade, handle lower-left, point upper-right.
function blade(p, { mat = 'silver', handle = 'leather', guard = 'steel', tip = [88, 8], heel = [34, 62], w = 15, end = [10, 86], hw = 9, belly = 0 } = {}) {
  const dx = tip[0] - heel[0], dy = tip[1] - heel[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  const a = [heel[0] - nx * w / 2, heel[1] - ny * w / 2], b = [heel[0] + nx * w / 2, heel[1] + ny * w / 2];
  const midB = [heel[0] + ux * l * 0.62 + nx * (w / 2 + belly), heel[1] + uy * l * 0.62 + ny * (w / 2 + belly)];
  p.bar(end[0], end[1], heel[0], heel[1], hw, handle, { k: 1.8 });
  for (let t = 0.2; t < 0.95; t += 0.2) { const x = end[0] + (heel[0] - end[0]) * t, y = end[1] + (heel[1] - end[1]) * t; p.tint(x - nx * hw * 0.5, y - ny * hw * 0.5, x + nx * hw * 0.5, y + ny * hw * 0.5, -2); }
  p.ell(end[0], end[1], hw * 0.72, hw * 0.72, guard, { tone: 3.4 });
  p.poly([a, tip, heel], mat, { bevel: 1, k: 0.5, tone: 4.6, flat: true, grad: 1.2, rim: false });
  p.poly([b, midB, tip, heel], mat, { bevel: 1, k: 0.4, tone: 2.6, flat: true, grad: 0.8, shadow: 0 });
  p.line(heel[0] + ux * 3, heel[1] + uy * 3, tip[0], tip[1], mat, 6);
  p.line(a[0] + ux * 3, a[1] + uy * 3, tip[0], tip[1], mat, 5);
  p.bar(a[0] - nx * 3, a[1] - ny * 3, b[0] + nx * 3, b[1] + ny * 3, 8, guard, { k: 1.9 });
}
function haft(p, x0, y0, x1, y1, w, mat = 'wood', wrap = 'black') {
  p.bar(x0, y0, x1, y1, w, mat, { k: 1.9 });
  const xw = x0 + (x1 - x0) * 0.28, yw = y0 + (y1 - y0) * 0.28;
  p.bar(x0, y0, xw, yw, w + 1, wrap, { k: 1.9 });
  for (let t = 0.06; t < 0.28; t += 0.055) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; p.tint(x - w * 0.5, y - w * 0.3, x + w * 0.5, y + w * 0.3, -2); }
}
function grenade(p, cx, cy, r, mat = 'olive', band = 'sodium') {
  p.ell(cx, cy, r * 0.9, r, mat, { tone: 3.2, k: 1.9 });
  p.rect(cx - r * 0.3, cy - r - r * 0.32, r * 0.6, r * 0.42, 'steel', { bevel: 1 });
  if (band) p.rect(cx - r * 0.9, cy - r * 0.12, r * 1.8, Math.max(2, r * 0.26), band, { bevel: 1, clip: true, shadow: 0, tone: 3.5 });
}
function syringe(p, x0, y0, x1, y1, w, fluid = 'green') {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  const pt = (t, n) => [x0 + ux * t + nx * n, y0 + uy * t + ny * n];
  p.bar(...pt(l * 0.72, 0), ...pt(l, 0), 3, 'silver', { gloss: 1 });
  p.bar(...pt(-l * 0.1, 0), ...pt(l * 0.1, 0), w * 0.45, 'steel');
  p.bar(...pt(-l * 0.12, -w * 0.72), ...pt(-l * 0.12, w * 0.72), 5, 'steel');
  p.bar(...pt(l * 0.08, 0), ...pt(l * 0.68, 0), w, 'white', { tone: 4, k: 1.3 });
  p.bar(...pt(l * 0.28, 0), ...pt(l * 0.64, 0), w * 0.62, fluid, { tone: 4, k: 1.8, shadow: 0 });
  p.bar(...pt(l * 0.66, -w * 0.6), ...pt(l * 0.66, w * 0.6), 4, 'steel');
  p.bar(...pt(l * 0.08, -w * 0.72), ...pt(l * 0.08, w * 0.72), 4, 'steel');
  p.line(...pt(l * 0.12, -w * 0.32), ...pt(l * 0.62, -w * 0.32), 'white', 6);
}
function injector(p, fluid = 'green', body = 'white') {
  p.rect(4, 32, 12, 34, 'steel', { bevel: 2 });
  p.rect(14, 28, 56, 40, body, { bevel: 7, k: 1.7, tone: 3.6 });
  p.rect(22, 36, 38, 22, 'black', { bevel: 1, tone: 1, k: 0, rim: false, tex: null, shadow: 0 });
  p.rect(24, 38, 26, 18, fluid, { bevel: 3, k: 1.6, tone: 4, shadow: 0 });
  p.line(26, 40, 44, 40, fluid, 6);
  for (let x = 30; x < 60; x += 6) p.line(x, 37, x, 41, 'white', 5);
  p.rect(68, 40, 10, 16, 'steel', { bevel: 2 });
  p.bar(76, 48, 92, 48, 4, 'silver', { gloss: 1 });
  p.rect(34, 66, 14, 24, 'black', { bevel: 3, k: 1.5 });
  for (let y = 70; y < 90; y += 4) p.tint(35, y, 46, y, 1);
  p.rect(14, 30, 8, 36, 'sodium', { bevel: 1, tone: 3.4, clip: true, shadow: 0 });
}
function tablet(p, mat, screen, o = {}) {
  const x = o.x ?? 14, y = o.y ?? 5, w = o.w ?? 68, h = o.h ?? 86;
  p.rect(x, y, w, h, mat, { bevel: 4, k: 1.5, tone: 3 });
  p.rect(x + 6, y + 7, w - 12, h - 24, screen, { bevel: 1, tone: o.sTone ?? 2, k: 0.4, rim: false, shadow: 0, tex: null, grad: 1.2 });
  p.shade(x + 5, y + 6, w - 10, 1, -3); p.shade(x + 5, y + 6, 1, h - 22, -3);
  p.rivet(x + 3, y + 3); p.rivet(x + w - 6, y + 3);
}
function paperSheet(p, x = 16, y = 5, w = 64, h = 86, mat = 'paper') {
  p.poly([[x, y], [x + w - 14, y], [x + w, y + 14], [x + w, y + h], [x, y + h]], mat, { bevel: 1.5, k: 1, tone: 4.2 });
  p.poly([[x + w - 14, y], [x + w, y + 14], [x + w - 14, y + 14]], mat, { flat: true, bevel: 1, k: 0, tone: 2.5, shadow: 1 });
  for (let k = y + 16; k < y + h - 16; k += 7) p.line(x + 7, k, x + w - 9 - ((k * 7) % 11), k, 'knit', 3);
}
function wax(p, x, y, r, mat = 'red') {
  p.ell(x, y, r, r, mat, { tone: 3.4, k: 2 });
  p.ell(x, y, r * 0.6, r * 0.6, mat, { tone: 3, k: -1.2, bevel: 2, clip: true, shadow: 0, rim: false });
  p.set(Math.round(x - r * 0.55), Math.round(y - r * 0.55), mat, 6);
}
function key(p, mat = 'silver', eye = null) {
  p.ring(26, 30, 22, 9, mat, { tone: 3.8 });
  p.rect(44, 25, 46, 11, mat, { bevel: 3, k: 1.8, tone: 3.6 });
  p.rect(66, 35, 8, 22, mat, { bevel: 2, tone: 3.2 });
  p.rect(80, 35, 8, 15, mat, { bevel: 2, tone: 3 });
  p.groove(46, 30, 86, 30);
  if (eye) { p.ell(26, 30, 7, 7, eye, { tone: 4 }); p.set(24, 28, eye, 6); }
}
function ammo(p, cx, top, w, h, mat = 'gold', tip = 'steel') {
  p.shape(tip, { bevel: w * 0.42, k: 2, tone: 3.6 }, [['e', cx, top + w * 0.72, w * 0.5, w * 0.8], ['r', cx - w / 2, top + w * 0.72, w, w * 0.34]]);
  p.rect(cx - w / 2, top + w, w, h - w, mat, { bevel: w * 0.42, k: 2, tone: 3.6 });
  p.rect(cx - w / 2 - 1, top + h - 3, w + 2, 4, mat, { bevel: 1, tone: 3 });
  p.groove(cx - w / 2, top + w + 3, cx + w / 2 - 1, top + w + 3);
}
function stripes(p, x, y, w, h, gap = 8, dark = 'black') {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (p.has(i, j) && ((i + j) % (gap * 2)) < gap) { const q = j * p.w + i; p.buf[q] = MAT[dark] * 8 + Math.max(1, Math.min(3, (p.buf[q] & 7) - 1)); }
}
function brain(p, mat = 'pale') {
  p.shape(mat, { bevel: 14, k: 1.5, tone: 3.6 }, [['e', 48, 42, 40, 34], ['e', 62, 66, 16, 12]]);
  p.groove(48, 10, 46, 70);
  for (const pts of [[[18, 30], [30, 24], [38, 30]], [[14, 48], [28, 42], [40, 50]], [[24, 62], [34, 58], [42, 64]], [[58, 24], [68, 28], [78, 26]], [[56, 42], [68, 38], [82, 46]], [[56, 56], [68, 54], [76, 60]]])
    { p.groove(...pts[0], ...pts[1]); p.groove(...pts[1], ...pts[2]); }
}
function bandage(p, x, y) {
  p.ell(x, y, 24, 28, 'white', { tone: 3.6, k: 1.6 });
  p.ell(x, y, 9, 11, 'knit', { tone: 1.2, k: 0.4, rim: false, shadow: 0, tex: null });
  for (let k = -18; k < 22; k += 7) p.tint(x - 22, y + k, x - 11, y + k + 2, -1);
}

// ---------- icon definitions ----------
const DRAW = {
  // ---- ranged weapons ----
  'weapon:holdout': (p) => { pistol(p, { x: 20, y: 22, len: 50, h: 22, slide: 'gun', frame: 'black', gripMat: 'wood', barrel: 'steel', bl: 8, gw: 22, gh: 30, fh: 11 }); p.scuff(24, 24, 40, 14, 2, 5); },
  'weapon:sidearm': (p) => { pistol(p, { x: 14, y: 16, len: 66, h: 24, slide: 'silver', frame: 'black', gripMat: 'black', barrel: 'steel', bl: 8, trim: 'gold', gw: 24, gh: 38, fh: 12 }); },
  'weapon:slugpistol': (p) => { pistol(p, { x: 12, y: 16, len: 60, h: 28, slide: 'wood', frame: 'steel', gripMat: 'black', barrel: 'steel', bl: 16, gw: 24, gh: 36, fh: 12 }); p.rect(72, 14, 12, 6, 'steel', { bevel: 1 }); p.grime(14, 18, 56, 24, 6, 0.42, 'rust'); },
  'weapon:gilded': (p) => { pistol(p, { x: 14, y: 22, len: 54, h: 24, slide: 'gold', frame: 'gold', gripMat: 'wood', barrel: 'gold', bl: 16, drum: 'gold', gw: 18, gh: 32, fh: 10 }); p.rect(66, 22, 22, 10, 'gold', { bevel: 3, k: 2 }); p.rect(84, 20, 5, 13, 'black', { bevel: 1 }); p.scuff(16, 24, 40, 14, 3, 5); },
  'weapon:needler': (p) => { pistol(p, { x: 16, y: 26, len: 46, h: 16, slide: 'silver', frame: 'steel', gripMat: 'black', barrel: 'silver', gw: 18, gh: 32, fh: 9, lamp: 'ion' }); p.bar(60, 33, 91, 33, 4, 'silver', { gloss: 1.2 }); p.line(62, 37, 84, 37, 'ion', 5); p.rect(24, 16, 30, 9, 'ion', { bevel: 3, tone: 3.6, k: 2 }); p.line(26, 18, 46, 18, 'ion', 6); p.rect(24, 22, 30, 4, 'steel', { bevel: 1 }); },
  'unique:halvekpistol': (p) => { pistol(p, { x: 14, y: 22, len: 62, h: 20, slide: 'black', frame: 'black', gripMat: 'red', barrel: 'silver', bl: 12, trim: 'silver', gw: 20, gh: 36, fh: 11, lamp: 'red' }); p.rect(46, 14, 18, 7, 'silver', { bevel: 2, k: 2 }); p.set(64, 17, 'red', 6); p.set(64, 16, 'red', 5); },
  'unique:vanepistol': (p) => { pistol(p, { x: 12, y: 22, len: 58, h: 24, slide: 'gold', frame: 'gold', gripMat: 'navy', barrel: 'silver', bl: 16, gw: 20, gh: 34, fh: 11, trim: 'white' }); for (let x = 28; x < 66; x += 7) p.rivet(x, 39, 'silver'); p.ell(52, 18, 5, 5, 'ion', { tone: 4 }); p.set(50, 16, 'ion', 6); },
  'weapon:carbine': (p) => { gun(p, { x: 25, y: 26, len: 36, h: 20, body: 'gun', barrel: 'steel', bl: 26, bh: 7, hand: 18, handMat: 'steel', stock: 'wood', stockMat: 'wood', stockLen: 19, mag: 'box', magW: 12, magH: 30, magX: 49, gh: 26, gw: 12, muzzle: 'flash' }); p.grime(25, 26, 36, 20, 3, 0.5, 'rust'); },
  'weapon:scatter': (p) => { gun(p, { x: 24, y: 26, len: 32, h: 22, body: 'steel', barrel: 'black', bl: 34, bh: 11, by: 28, stock: 'wood', stockMat: 'wood', stockLen: 20, gh: 22, gw: 13, gx: 30, tube: true, pump: 20, pumpMat: 'wood', pumpX: 8, muzzle: 'bell', muzzleMat: 'steel' }); p.rect(36, 30, 12, 6, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null }); p.rect(38, 30, 7, 5, 'sodium', { bevel: 2, tone: 3.8, k: 1.8, shadow: 0 }); p.grime(24, 26, 32, 22, 9, 0.35, 'rust'); },
  'weapon:longbore': (p) => { gun(p, { x: 22, y: 38, len: 34, h: 16, body: 'olive', barrel: 'steel', bl: 36, bh: 5, by: 40, stock: 'solid', stockMat: 'olive', stockLen: 17, gh: 24, gw: 11, mag: 'box', magW: 9, magH: 16, magX: 45, muzzle: 'brake', scope: 'glass', scopeW: 36, scopeX: 21, scopeH: 9 }); p.rect(16, 41, 4, 4, 'tan', { bevel: 1, shadow: 0 }); },
  'weapon:marksman': (p) => { gun(p, { x: 20, y: 40, len: 38, h: 15, body: 'silver', barrel: 'steel', bl: 34, bh: 5, by: 42, stock: 'skel', stockMat: 'steel', stockLen: 15, gripMat: 'black', gh: 24, gw: 11, mag: 'box', magW: 10, magH: 18, magX: 46, muzzle: 'flash', scope: 'glass', scopeW: 46, scopeX: 18, scopeH: 13 }); p.rect(66, 47, 3, 24, 'black', { bevel: 1 }); p.bar(67, 62, 58, 76, 3, 'steel'); p.bar(68, 62, 78, 76, 3, 'steel'); },
  'weapon:repeater': (p) => { gun(p, { x: 21, y: 20, len: 36, h: 22, body: 'black', barrel: 'steel', bl: 34, bh: 8, stock: 'skel', stockMat: 'steel', stockLen: 15, gh: 22, gw: 12, mag: 'drum', magW: 20, magX: 36, magMat: 'steel', muzzle: 'brake', hand: 18, handMat: 'black' }); p.set(50, 24, 'sodium', 6); p.set(51, 24, 'sodium', 4); },
  'weapon:cannon': (p) => { p.rect(8, 56, 26, 8, 'steel', { bevel: 2 }); p.rect(36, 62, 12, 26, 'black', { bevel: 3, k: 1.5 }); p.rect(22, 60, 12, 18, 'leather', { bevel: 3, k: 1.5 }); p.rect(6, 26, 74, 32, 'olive', { bevel: 13, k: 1.9, tone: 3.1 }); for (let x = 16; x < 74; x += 19) { p.rect(x, 25, 7, 34, 'yellow', { bevel: 5, k: 1.9, tone: 3.2, shadow: 1 }); } p.rect(76, 21, 16, 42, 'black', { bevel: 6, k: 1.9, tone: 2.6 }); p.ell(88, 42, 3, 15, 'black', { tone: 0.5, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.rect(30, 16, 22, 10, 'steel', { bevel: 2 }); p.set(46, 19, 'sodium', 6); p.grime(6, 30, 70, 28, 2, 0.42, 'rust'); },
  'weapon:arc': (p) => { p.rect(36, 62, 12, 26, 'black', { bevel: 3, k: 1.5 }); p.rect(66, 36, 16, 16, 'steel', { bevel: 3 }); p.ell(34, 44, 30, 22, 'white', { tone: 3.6, k: 1.6 }); for (let x = 16; x < 56; x += 9) p.rect(x, 22, 4, 44, 'ion', { bevel: 2, tone: 3.5, k: 1.6, clip: true, shadow: 0 }); p.ell(34, 44, 10, 10, 'ion', { tone: 4.4, k: 2 }); p.set(31, 40, 'ion', 6).set(32, 40, 'ion', 6); p.ell(84, 44, 9, 9, 'ion', { tone: 4.5, k: 2 }); p.set(81, 40, 'ion', 6); arcLine(p, [[88, 26], [80, 32], [86, 36]]); arcLine(p, [[90, 62], [82, 56], [86, 52]]); },
  'weapon:rivetgun': (p) => { p.rect(30, 62, 13, 28, 'black', { bevel: 3, k: 1.5 }); p.rect(16, 24, 56, 40, 'yellow', { bevel: 8, k: 1.7, tone: 3.3 }); stripes(p, 18, 52, 52, 12, 5); p.rect(70, 34, 12, 20, 'steel', { bevel: 3 }); p.rect(80, 38, 12, 12, 'black', { bevel: 3, k: 1.9 }); p.ell(50, 66, 14, 14, 'steel', { tone: 3, k: 1.9 }); p.ell(50, 66, 6, 6, 'black', { tone: 2, bevel: 2, shadow: 0 }); for (let x = 22; x < 66; x += 11) p.rivet(x, 28); p.grime(16, 24, 56, 40, 3, 0.4, 'rust'); },
  'weapon:smartgun': (p) => { gun(p, { x: 20, y: 34, len: 40, h: 20, body: 'black', barrel: 'steel', bl: 28, bh: 7, stock: 'skel', stockMat: 'steel', stockLen: 14, gripMat: 'black', gh: 24, gw: 12, mag: 'box', magMat: 'steel', magW: 11, magH: 22, magX: 46, accent: 'ion', muzzle: 'flash', hand: 12, handMat: 'black', scope: 'ion', scopeW: 28, scopeX: 28, scopeH: 11, scopeMat: 'steel' }); p.rect(29, 20, 8, 3, 'ion', { bevel: 1, tone: 4, shadow: 0 }); p.set(46, 38, 'sodium', 6); },
  'weapon:railcarbine': (p) => { p.rect(56, 28, 36, 5, 'silver', { bevel: 2, k: 2, gloss: 1.1 }); p.rect(56, 44, 36, 5, 'silver', { bevel: 2, k: 2, gloss: 1.1 }); p.line(58, 38, 92, 38, 'ion', 6); p.line(58, 37, 90, 37, 'ion', 4); p.line(58, 39, 90, 39, 'ion', 3); gun(p, { x: 24, y: 28, len: 34, h: 20, body: 'navy', barrel: 'navy', bl: 1, bh: 2, by: 37, stock: 'solid', stockMat: 'black', stockLen: 18, gripMat: 'black', gh: 22, gw: 11, mag: 'box', magMat: 'silver', magW: 10, magH: 22, magX: 44, accent: 'ion' }); for (let x = 62; x < 90; x += 9) { p.rect(x, 26, 3, 25, 'navy', { bevel: 1, tone: 3.5 }); } },
  'weapon:wardenrifle': (p) => { gun(p, { x: 22, y: 38, len: 36, h: 18, body: 'rust', barrel: 'steel', bl: 34, bh: 6, by: 40, stock: 'solid', stockMat: 'black', stockLen: 17, gripMat: 'black', gh: 24, gw: 11, mag: 'curve', magW: 11, magH: 24, magX: 46, accent: 'red', muzzle: 'brake', scope: 'glass', scopeW: 34, scopeX: 22, scopeH: 9 }); p.set(44, 41, 'red', 6); },

  // ---- melee ----
  'weapon:baton': (p) => { haft(p, 8, 88, 66, 30, 12, 'black', 'leather'); p.bar(40, 56, 46, 50, 16, 'steel', { k: 1.9 }); p.bar(60, 36, 72, 24, 15, 'steel', { k: 1.9 }); p.bar(70, 26, 82, 14, 11, 'ion', { tone: 4, k: 2 }); p.set(76, 15, 'ion', 6); arcLine(p, [[90, 4], [84, 12], [92, 16]]); arcLine(p, [[72, 6], [76, 14]]); arcLine(p, [[92, 28], [84, 24]]); },
  'weapon:maul': (p) => { haft(p, 12, 88, 56, 36, 10, 'wood', 'black'); p.poly([[34, 4], [84, 22], [74, 52], [24, 34]], 'steel', { bevel: 5, k: 1.7, tone: 3.2 }); p.poly([[76, 19], [86, 23], [76, 53], [66, 49]], 'yellow', { bevel: 3, k: 1.6, tone: 3.3 }); stripes(p, 66, 19, 22, 36, 5); p.rivet(40, 18); p.rivet(62, 26); p.grime(24, 4, 50, 46, 4, 0.42, 'rust'); p.scuff(30, 8, 40, 30, 7, 6); },
  'weapon:wrench': (p) => { p.shape('steel', { bevel: 5, k: 1.9, tone: 3.4 }, [['b', 12, 86, 58, 34, 14], ['e', 68, 24, 22, 22], ['-p', [[58, -4], [78, -4], [78, 18], [58, 28]]]]); p.ell(66, 26, 4, 4, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null }); p.bar(10, 88, 28, 68, 16, 'rust', { k: 1.9 }); p.groove(30, 70, 54, 42); p.grime(10, 40, 60, 50, 4, 0.5, 'rust'); },
  'weapon:knife': (p) => blade(p, { mat: 'silver', handle: 'leather', tip: [88, 8], heel: [38, 58], w: 22, belly: 3, end: [12, 84], hw: 11 }),
  'weapon:shiv': (p) => { blade(p, { mat: 'steel', handle: 'knit', guard: 'black', tip: [90, 6], heel: [36, 60], w: 16, end: [14, 82], hw: 12 }); p.grime(30, 20, 60, 44, 2, 0.5, 'rust'); p.bar(26, 60, 32, 66, 6, 'tan', { shadow: 0 }); },
  'weapon:prod': (p) => { haft(p, 8, 88, 60, 36, 11, 'steel', 'black'); p.bar(54, 42, 66, 30, 17, 'yellow', { tone: 3.4 }); stripes(p, 50, 26, 22, 22, 4); p.bar(64, 24, 80, 8, 4, 'silver', { gloss: 1.2 }); p.bar(74, 34, 90, 18, 4, 'silver', { gloss: 1.2 }); arcLine(p, [[80, 8], [84, 14], [80, 16], [90, 18]]); spark(p, 85, 12, 5); },
  'weapon:sabre': (p) => { blade(p, { mat: 'silver', handle: 'navy', guard: 'gold', tip: [92, 4], heel: [28, 64], w: 12, end: [10, 84], hw: 8, belly: 4 }); p.shape('gold', { bevel: 2, k: 1.9, tone: 3.4 }, [['e', 22, 76, 18, 18], ['-e', 16, 70, 14, 14]]); },
  'weapon:axe': (p) => { haft(p, 14, 90, 60, 6, 9, 'wood', 'black'); p.poly([[50, 8], [62, 4], [90, 16], [90, 46], [80, 42], [60, 28], [50, 26]], 'red', { bevel: 4, k: 1.3, tone: 3 }); p.poly([[76, 10], [91, 16], [91, 47], [78, 41]], 'silver', { bevel: 2, k: 1.4, tone: 4.3 }); p.line(90, 17, 90, 45, 'silver', 6); p.grime(50, 4, 28, 26, 6, 0.42, 'black'); p.rivet(55, 14); },
  'weapon:hammer': (p) => { haft(p, 10, 90, 50, 30, 9, 'steel', 'black'); p.rect(14, 8, 68, 34, 'steel', { bevel: 6, k: 1.8, tone: 3.2 }); p.rect(78, 11, 12, 28, 'yellow', { bevel: 4, k: 1.7, tone: 3.2 }); stripes(p, 78, 11, 12, 28, 5); p.rect(8, 13, 8, 24, 'black', { bevel: 2 }); for (let x = 26; x < 74; x += 13) p.rivet(x, 24); p.tint(18, 11, 74, 11, 1); p.grime(14, 8, 66, 34, 8, 0.45, 'rust'); },
  'weapon:pipe': (p) => { p.bar(12, 86, 74, 24, 13, 'steel', { gloss: 0.9, k: 2 }); p.bar(62, 36, 88, 10, 21, 'steel', { tone: 2.6, k: 1.9 }); p.bar(12, 86, 28, 70, 15, 'tan', { tone: 2.8 }); for (let k = 0; k < 4; k++) p.tint(14 + k * 4, 74 + k * -4, 24 + k * 4, 84 + k * -4, -2); p.grime(30, 8, 60, 64, 3, 0.35, 'rust'); p.tint(80, 8, 90, 18, -3); },
  'weapon:cleaver': (p) => { p.bar(10, 88, 34, 62, 13, 'wood'); p.rivet(14, 80, 'silver'); p.rivet(24, 70, 'silver'); p.poly([[22, 50], [62, 6], [92, 34], [50, 80]], 'silver', { bevel: 2, k: 1, tone: 3.6, flat: true }); p.poly([[62, 6], [92, 34], [84, 42], [54, 14]], 'silver', { flat: true, bevel: 1, k: 0, tone: 5, shadow: 0 }); p.line(62, 6, 92, 34, 'silver', 6); p.ell(38, 42, 4, 4, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.grime(22, 20, 50, 50, 5, 0.46); p.grime(34, 58, 22, 18, 7, 0.45, 'red'); },
  'weapon:arcblade': (p) => { blade(p, { mat: 'ion', handle: 'black', guard: 'steel', tip: [90, 6], heel: [32, 62], w: 15, end: [10, 86], hw: 9 }); arcLine(p, [[44, 30], [36, 34], [40, 42]]); arcLine(p, [[76, 40], [68, 42], [64, 52]]); spark(p, 82, 12, 4); },
  'weapon:breacher': (p) => { p.rect(2, 36, 16, 22, 'black', { bevel: 3, k: 1.6 }); p.rect(66, 18, 28, 13, 'silver', { bevel: 4, k: 2, gloss: 1 }); p.rect(66, 60, 28, 13, 'silver', { bevel: 4, k: 2, gloss: 1 }); p.rect(60, 34, 24, 24, 'steel', { bevel: 3 }); p.rect(14, 14, 54, 66, 'yellow', { bevel: 8, k: 1.7, tone: 3.2 }); stripes(p, 16, 58, 50, 20, 6); p.rect(22, 24, 36, 18, 'black', { bevel: 2, tone: 1.6, tex: null }); p.set(52, 30, 'sodium', 6).set(53, 30, 'sodium', 5); for (let y = 28; y < 40; y += 4) p.line(26, y, 46, y, 'steel', 3); p.grime(14, 14, 54, 66, 6, 0.42, 'rust'); },
  'unique:braskhammer': (p) => { fist(p, 'steel', 'black'); for (let k = 0; k < 4; k++) { p.rect(26 + k * 13.5, 9, 10, 9, 'silver', { bevel: 3, k: 2, tone: 4 }); p.rivet(29 + k * 13.5, 25); } p.rect(26, 68, 46, 7, 'gold', { bevel: 2, k: 1.8 }); p.grime(22, 20, 56, 50, 5, 0.42, 'rust'); },

  // ---- helmets ----
  'head:cap': (p) => { p.shape('olive', { bevel: 12, k: 1.6, tone: 3.2 }, [['e', 46, 44, 36, 30], ['-r', 0, 56, 96, 40]]); p.rect(10, 52, 72, 12, 'olive', { bevel: 3, k: 1.3, tone: 2.5 }); p.poly([[34, 60], [84, 56], [93, 68], [80, 74], [34, 72]], 'olive', { bevel: 4, k: 1.5, tone: 2.6 }); p.rect(38, 28, 14, 10, 'sodium', { bevel: 2, tone: 3.3, k: 1 }); p.groove(46, 15, 46, 28); p.groove(22, 28, 44, 20); p.grime(10, 15, 72, 44, 3, 0.5); },
  'head:hood': (p) => { p.shape('tan', { bevel: 12, k: 1.5, tone: 3 }, [['e', 48, 40, 37, 36], ['p', [[12, 42], [84, 42], [90, 92], [6, 92]]]]); p.ell(48, 52, 21, 24, 'black', { tone: 0.8, k: 0.2, rim: false, shadow: 0, tex: null, dither: 0 }); for (let k = 0; k < 4; k++) { p.groove(24 - k * 3, 40 + k * 11, 28 - k, 44 + k * 11); p.groove(72 + k * 3, 40 + k * 11, 68 + k, 44 + k * 11); } p.groove(30, 22, 66, 22); p.groove(26, 14, 48, 10); p.line(36, 42, 42, 36, 'knit', 3); p.grime(6, 40, 84, 50, 4, 0.48); },
  'head:helmet': (p) => { helm(p, 'rust', { visor: 'black', cheek: true, vents: true }); p.grime(14, 8, 68, 30, 2, 0.35); p.scuff(16, 10, 60, 26, 5, 8); },
  'head:visor': (p) => { helm(p, 'steel', { visor: 'ion', cheek: true }); p.set(30, 56, 'red', 6).set(31, 56, 'red', 5); p.set(64, 56, 'red', 6).set(65, 56, 'red', 5); p.rect(84, 34, 8, 20, 'black', { bevel: 2 }); p.line(88, 12, 88, 34, 'steel', 5); p.set(88, 11, 'sodium', 6); },
  'head:officercap': (p) => { p.poly([[14, 42], [20, 16], [48, 8], [78, 14], [88, 34], [72, 54], [22, 54]], 'navy', { bevel: 8, k: 1.5, tone: 3.2 }); p.rect(20, 50, 56, 13, 'black', { bevel: 3, tone: 2.6 }); p.rect(20, 54, 56, 3, 'gold', { bevel: 1, tone: 3.6, shadow: 0, rim: false }); p.poly([[12, 62], [84, 62], [90, 76], [48, 82], [6, 76]], 'black', { bevel: 5, k: 2, tone: 2.8, gloss: 1.2 }); p.ell(48, 34, 11, 12, 'gold', { tone: 3.6, k: 1.8 }); p.ell(48, 34, 5, 6, 'red', { tone: 3.8, shadow: 0, clip: true }); p.set(44, 28, 'gold', 6); },
  'head:trooperhelm': (p) => { helm(p, 'white', { visor: 'black', cheek: true, vents: true, tone: 3.6 }); p.groove(30, 26, 52, 34); p.groove(48, 8, 48, 38); p.grime(12, 8, 72, 30, 6, 0.52); p.rect(62, 22, 12, 6, 'sodium', { bevel: 1, tone: 3.6, shadow: 0, clip: true }); },
  'head:blasthelm': (p) => { helm(p, 'yellow', { visor: 'black', crest: 'black', cheek: true, tone: 3.4 }); p.rect(20, 66, 56, 16, 'black', { bevel: 3 }); for (let x = 26; x < 72; x += 7) p.rect(x, 69, 3, 10, 'steel', { tone: 3, bevel: 1, shadow: 0 }); stripes(p, 14, 8, 28, 30, 6); p.grime(10, 8, 76, 34, 3, 0.4, 'rust'); },
  'head:respirator': (p) => { p.shape('tan', { bevel: 12, k: 1.5, tone: 3 }, [['e', 48, 38, 34, 34], ['r', 14, 38, 68, 30]]); p.rect(16, 26, 64, 16, 'black', { bevel: 3, tone: 2 }); p.ell(34, 34, 9, 7, 'glass', { tone: 3.4, k: 1.8, shadow: 0 }); p.ell(62, 34, 9, 7, 'glass', { tone: 3.4, k: 1.8, shadow: 0 }); p.set(30, 31, 'glass', 6).set(31, 31, 'glass', 6); p.set(58, 31, 'glass', 6).set(59, 31, 'glass', 6); p.ell(48, 64, 19, 18, 'steel', { tone: 3, k: 1.8 }); p.ell(48, 66, 11, 11, 'black', { tone: 1.8, bevel: 2, shadow: 0 }); for (let y = 60; y < 74; y += 4) p.line(40, y, 56, y, 'steel', 4); p.rect(10, 62, 14, 22, 'olive', { bevel: 4, k: 1.7 }); p.rect(72, 62, 14, 22, 'olive', { bevel: 4, k: 1.7 }); p.line(12, 70, 22, 70, 'black', 2); p.line(74, 70, 84, 70, 'black', 2); },
  'head:wardenhelm': (p) => { helm(p, 'rust', { visor: 'ion', crest: 'black', cheek: true, vents: true }); p.grime(14, 8, 68, 30, 5, 0.38); p.rect(44, 8, 8, 6, 'red', { bevel: 1, tone: 4 }); },

  // ---- leg armour ----
  'legs:trousers': (p) => { legs(p, 'olive', { boots: 'leather' }); p.rect(25, 34, 15, 15, 'olive', { bevel: 2, tone: 2.5 }); p.rect(56, 34, 15, 15, 'olive', { bevel: 2, tone: 2.3 }); p.rect(30, 60, 12, 9, 'tan', { bevel: 1, tone: 2.6 }); p.grime(20, 50, 56, 28, 3, 0.45); },
  'legs:padded': (p) => { legs(p, 'tan', { knee: 'leather', boots: 'black' }); for (let y = 24; y < 44; y += 6) { p.groove(24, y, 44, y); p.groove(52, y, 73, y); } for (let y = 64; y < 76; y += 6) { p.groove(25, y, 44, y); p.groove(52, y, 72, y); } },
  'legs:runners': (p) => { legs(p, 'navy', { knee: 'silver', boots: 'steel', stripe: 'yellow' }); p.line(84, 42, 94, 42, 'sodium', 5); p.line(82, 52, 94, 52, 'sodium', 4); p.line(84, 62, 94, 62, 'sodium', 3); p.line(2, 42, 12, 42, 'sodium', 5); p.line(2, 52, 14, 52, 'sodium', 4); p.line(2, 62, 12, 62, 'sodium', 3); },
  'legs:plated': (p) => { legs(p, 'leather', { knee: 'steel', boots: 'black' }); p.rect(25, 18, 19, 22, 'steel', { bevel: 3, tone: 3.2 }); p.rect(53, 18, 19, 22, 'steel', { bevel: 3, tone: 2.9 }); p.rect(26, 62, 17, 15, 'steel', { bevel: 3, tone: 3.2 }); p.rect(53, 62, 17, 15, 'steel', { bevel: 3, tone: 2.9 }); p.rivet(28, 21); p.rivet(40, 21); p.rivet(56, 21); p.rivet(68, 21); p.grime(24, 18, 50, 60, 4, 0.42, 'rust'); },
  'legs:officerboots': (p) => { legs(p, 'navy', { stripe: 'red', boots: 'black', belt: 'black', buckle: 'gold' }); p.poly([[24, 54], [46, 54], [46, 92], [14, 92], [14, 85], [24, 80]], 'black', { bevel: 4, k: 2, tone: 3, gloss: 1.2 }); p.poly([[50, 54], [72, 54], [72, 80], [82, 85], [82, 92], [50, 92]], 'black', { bevel: 4, k: 2, tone: 2.7, gloss: 1.2 }); p.rect(24, 52, 22, 4, 'gold', { bevel: 1, tone: 3.5 }); p.rect(50, 52, 22, 4, 'gold', { bevel: 1, tone: 3.3 }); p.line(30, 60, 30, 76, 'black', 6); p.line(56, 60, 56, 76, 'black', 5); },
  'legs:trooperlegs': (p) => { legs(p, 'knit', { knee: 'white', boots: 'black' }); p.rect(25, 18, 19, 22, 'white', { bevel: 3, tone: 3.6 }); p.rect(53, 18, 19, 22, 'white', { bevel: 3, tone: 3.2 }); p.rect(26, 63, 17, 13, 'white', { bevel: 3, tone: 3.6 }); p.rect(53, 63, 17, 13, 'white', { bevel: 3, tone: 3.2 }); p.grime(24, 18, 50, 58, 7, 0.5); p.rect(38, 24, 5, 10, 'sodium', { bevel: 1, tone: 3.5, shadow: 0 }); },
  'legs:exolegs': (p) => { legs(p, 'steel', { knee: 'yellow', boots: 'black' }); p.rect(12, 18, 10, 62, 'yellow', { bevel: 3, k: 1.7, tone: 3.3 }); p.rect(74, 18, 10, 62, 'yellow', { bevel: 3, k: 1.7, tone: 3 }); stripes(p, 12, 18, 10, 18, 3); stripes(p, 74, 18, 10, 18, 3); p.ell(17, 52, 7, 7, 'steel', { tone: 3.4, k: 1.9 }); p.ell(79, 52, 7, 7, 'steel', { tone: 3.2, k: 1.9 }); p.rivet(16, 51); p.rivet(78, 51); p.bar(17, 22, 17, 44, 3, 'silver', { shadow: 0, gloss: 1 }); p.bar(79, 22, 79, 44, 3, 'silver', { shadow: 0, gloss: 1 }); },
  'legs:mag': (p) => { legs(p, 'steel', { boots: 'ion', knee: 'silver' }); p.rect(14, 84, 32, 8, 'black', { bevel: 2 }); p.rect(50, 84, 32, 8, 'black', { bevel: 2 }); arcLine(p, [[8, 94], [16, 92], [24, 94]]); arcLine(p, [[70, 94], [78, 92], [88, 94]]); p.line(30, 72, 30, 80, 'ion', 6); p.line(64, 72, 64, 80, 'ion', 5); p.grime(20, 18, 56, 56, 4, 0.5); },
  'legs:wardenlegs': (p) => { legs(p, 'rust', { knee: 'black', boots: 'black', belt: 'black', buckle: 'silver' }); p.rect(25, 18, 19, 22, 'black', { bevel: 3, tone: 2.9, k: 1.8 }); p.rect(53, 18, 19, 22, 'black', { bevel: 3, tone: 2.7, k: 1.8 }); p.rect(32, 26, 5, 5, 'red', { bevel: 1, tone: 4 }); p.rect(60, 26, 5, 5, 'red', { bevel: 1, tone: 4 }); p.grime(24, 40, 50, 36, 5, 0.42); },
  'unique:crawlertreads': (p) => { legs(p, 'olive', { knee: 'yellow', boots: 'black' }); p.rect(16, 56, 32, 38, 'black', { bevel: 3, k: 1.5 }); p.rect(50, 56, 32, 38, 'black', { bevel: 3, k: 1.5, tone: 2.7 }); for (let y = 60; y < 92; y += 6) { p.rect(16, y, 32, 3, 'steel', { bevel: 1, tone: 3.2, shadow: 0 }); p.rect(50, y, 32, 3, 'steel', { bevel: 1, tone: 3, shadow: 0 }); } stripes(p, 26, 44, 18, 16, 4); stripes(p, 53, 44, 18, 16, 4); p.grime(16, 56, 66, 38, 3, 0.42, 'rust'); },

  // ---- gadgets ----
  'gadget:grenadebelt': (p) => { for (let k = 0; k < 4; k++) grenade(p, 16 + k * 21.5, 36, 11, k % 2 ? 'olive' : 'steel', 'sodium'); p.rect(3, 48, 90, 22, 'leather', { bevel: 3, k: 1.5 }); p.groove(4, 54, 92, 54); p.groove(4, 64, 92, 64); p.rect(36, 44, 24, 30, 'gold', { bevel: 3, k: 1.9, tone: 3.2 }); p.rect(42, 51, 12, 16, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null }); p.rect(46, 50, 3, 18, 'gold', { bevel: 1, tone: 4 }); for (let x = 8; x < 88; x += 10) if (x < 34 || x > 60) p.rivet(x, 58, 'silver'); },
  'gadget:injector': (p) => injector(p, 'green'),
  'gadget:scanner': (p) => { p.rect(66, 2, 7, 18, 'steel', { bevel: 2 }); p.set(69, 2, 'sodium', 6); tablet(p, 'black', 'green', { x: 12, y: 14, w: 72, h: 78, sTone: 1.4 }); for (let x = 22; x < 76; x += 10) p.line(x, 24, x, 72, 'green', 2); for (let y = 30; y < 72; y += 10) p.line(20, y, 76, y, 'green', 2); arcLine(p, [[22, 62], [34, 62], [40, 38], [50, 68], [56, 50], [74, 50]], 'green'); p.ell(26, 82, 4, 4, 'red', { tone: 4 }); p.ell(40, 82, 4, 4, 'yellow', { tone: 4 }); p.rect(52, 78, 24, 8, 'steel', { bevel: 2 }); },
  'gadget:coil': (p) => { p.rect(40, 2, 16, 16, 'steel', { bevel: 3 }); p.rect(30, 80, 36, 12, 'steel', { bevel: 3 }); for (let y = 18; y < 82; y += 10) p.ell(48, y + 4, 28, 8, 'rust', { tone: 3.5, k: 1.9, bevel: 4, gloss: 0.8, tex: null }); p.poly([[54, 10], [36, 46], [50, 46], [40, 84], [64, 40], [50, 40], [62, 10]], 'ion', { bevel: 3, tone: 4.2, k: 1.5, gloss: 1 }); spark(p, 22, 16, 5); spark(p, 80, 72, 4); },
  'gadget:datapad': (p) => { tablet(p, 'black', 'ion', { sTone: 1.6 }); for (let y = 20; y < 66; y += 8) p.line(26, y, 70 - (y * 5) % 22, y, 'ion', y === 28 ? 6 : 4); p.rect(62, 14, 10, 5, 'sodium', { bevel: 1, tone: 4, shadow: 0 }); p.ell(48, 82, 5, 5, 'steel', { tone: 3.6 }); },
  'gadget:medkit': (p) => medbag(p, 'white', 'red'),
  'gadget:bandolier': (p) => { p.bar(14, 14, 82, 82, 16, 'leather', { bevel: 5, k: 1.5 }); for (let k = 0; k < 5; k++) { const c = 22 + k * 13; p.bar(c - 11, c + 11, c + 5, c - 5, 8, 'gold', { tone: 3.6, gloss: 1 }); p.bar(c + 5, c - 5, c + 11, c - 11, 8, 'steel', { w2: 4, tone: 3.6 }); } p.grime(4, 4, 88, 88, 5, 0.55); },

  // ---- uniques (non-gun) ----
  'unique:crucibleplate': (p) => { torso(p, 'black', { tone: 2.6, k: 1.8 }); p.rect(6, 26, 18, 18, 'rust', { bevel: 4, k: 1.7 }); p.rect(72, 26, 18, 18, 'rust', { bevel: 4, k: 1.7, tone: 2.7 }); p.ring(48, 54, 24, 7, 'rust', { tone: 3 }); p.ell(48, 54, 17, 17, 'fire', { tone: 3.4, bevel: 15, k: 2 }); p.ell(48, 54, 7, 7, 'fire', { tone: 5.5, bevel: 3, k: 0.6, shadow: 0, rim: false }); for (let a = 0; a < 6; a++) p.rivet(Math.round(48 + Math.cos(a * 1.047) * 20.5) - 1, Math.round(54 + Math.sin(a * 1.047) * 20.5) - 1); p.line(48, 37, 30, 24, 'fire', 4); p.line(48, 71, 42, 88, 'fire', 3); p.line(66, 58, 74, 66, 'fire', 3); p.grime(22, 22, 52, 66, 2, 0.45, 'rust'); },
  'unique:kellkey': (p) => { key(p, 'silver', 'red'); p.scuff(44, 26, 40, 10, 3, 5); p.rect(46, 45, 10, 5, 'red', { bevel: 1, tone: 3.6 }); p.line(50, 37, 50, 45, 'knit', 4); },
  'unique:ostranepad': (p) => { p.rect(14, 3, 68, 90, 'navy', { bevel: 5, k: 1.5, tone: 3.2 }); p.rect(22, 11, 52, 66, 'paper', { bevel: 1, k: 0.5, tone: 4.2, shadow: 1, flat: true }); for (let y = 18; y < 72; y += 7) p.line(27, y, 68 - (y * 3) % 12, y, 'knit', 3); p.rect(27, 31, 30, 5, 'red', { bevel: 1, tone: 3.8, shadow: 0 }); wax(p, 62, 66, 8, 'red'); p.ell(48, 85, 5, 5, 'gold', { tone: 3.8 }); p.rivet(17, 6, 'gold'); p.rivet(77, 6, 'gold'); },

  // ---- armour ----
  'armor:none': (p) => { torso(p, 'rust', { tone: 2.9 }); p.rect(56, 50, 16, 13, 'tan', { bevel: 2, tone: 3, k: 1 }); for (let x = 58; x < 72; x += 4) { p.set(x, 49, 'knit', 1); p.set(x, 63, 'knit', 1); } p.rect(24, 28, 15, 8, 'paper', { bevel: 1, tone: 3.4, k: 0.6 }); p.line(26, 32, 36, 32, 'knit', 2); p.groove(48, 18, 48, 88); p.grime(22, 60, 52, 28, 4, 0.34); p.poly([[30, 90], [36, 82], [40, 90]], 'black', { tone: 0, k: 0, rim: false, shadow: 0, tex: null, clip: true, dither: 0 }); },
  'armor:vest': (p) => { torso(p, 'tan', { tone: 3.2 }); for (let y = 34; y < 88; y += 9) { p.groove(23, y, 45, y); p.groove(51, y, 73, y); } p.rect(45, 17, 6, 72, 'leather', { bevel: 2 }); for (let y = 22; y < 88; y += 5) p.set(48, y, 'silver', 5); p.rect(26, 62, 14, 14, 'tan', { bevel: 2, tone: 2.6 }); p.rect(56, 62, 14, 14, 'tan', { bevel: 2, tone: 2.4 }); p.grime(22, 24, 52, 64, 3, 0.45); },
  'armor:plates': (p) => { torso(p, 'rust', { tone: 2.6 }); p.rect(25, 26, 21, 24, 'steel', { bevel: 4, k: 1.7, tone: 3.6 }); p.rect(50, 26, 21, 24, 'steel', { bevel: 4, k: 1.7, tone: 3.2 }); p.rect(25, 54, 46, 12, 'steel', { bevel: 3, k: 1.7, tone: 3.3 }); p.rect(25, 69, 46, 12, 'steel', { bevel: 3, k: 1.7, tone: 3.1 }); for (const [x, y] of [[28, 29], [41, 29], [53, 29], [66, 29], [28, 57], [66, 57], [28, 72], [66, 72]]) p.rivet(x, y); p.grime(25, 26, 46, 55, 6, 0.42, 'rust'); p.scuff(28, 30, 40, 44, 2, 8); },
  'armor:trooper': (p) => { torso(p, 'black', { tone: 2.6 }); p.rect(5, 22, 20, 20, 'white', { bevel: 5, k: 1.8, tone: 3.6 }); p.rect(71, 22, 20, 20, 'white', { bevel: 5, k: 1.8, tone: 3.2 }); p.poly([[26, 22], [70, 22], [72, 54], [48, 74], [24, 54]], 'white', { bevel: 7, k: 1.7, tone: 3.6 }); p.groove(48, 26, 48, 70); p.groove(28, 42, 68, 42); p.tint(30, 54, 48, 70, -1); p.rect(32, 28, 10, 5, 'sodium', { bevel: 1, tone: 3.6, shadow: 0 }); for (let y = 76; y < 88; y += 5) p.groove(25, y, 71, y); p.grime(24, 22, 48, 50, 3, 0.48); p.scuff(30, 30, 36, 30, 4, 6); },
  'armor:weave': (p) => { torso(p, 'navy', { tone: 3.2 }); for (let y = 14; y < 90; y += 1) for (let x = 6; x < 90; x++) if (p.has(x, y) && ((x + y * 3) % 6 === 0 || (x * 3 - y) % 6 === 0)) p.adj(x, y, (x + y) % 2 ? 2 : -1); p.groove(48, 18, 48, 88); p.rect(24, 30, 48, 4, 'ion', { bevel: 1, tone: 3.2, shadow: 0, clip: true }); p.rect(24, 72, 48, 4, 'ion', { bevel: 1, tone: 2.8, shadow: 0, clip: true }); },
  'armor:exo': (p) => { torso(p, 'steel', { tone: 3 }); p.rect(6, 18, 14, 72, 'yellow', { bevel: 4, k: 1.7, tone: 3.3 }); p.rect(76, 18, 14, 72, 'yellow', { bevel: 4, k: 1.7, tone: 3 }); stripes(p, 6, 18, 14, 20, 4); stripes(p, 76, 18, 14, 20, 4); p.rect(30, 30, 36, 14, 'black', { bevel: 2, tone: 2 }); for (let x = 34; x < 64; x += 5) p.line(x, 33, x, 41, 'steel', 4); p.rect(34, 52, 28, 10, 'yellow', { bevel: 2, tone: 3.4 }); p.rect(36, 68, 24, 16, 'black', { bevel: 3, tone: 2.4 }); p.ell(48, 76, 5, 5, 'sodium', { tone: 4.2 }); p.rivet(10, 58, 'silver'); p.rivet(82, 58, 'silver'); p.grime(6, 18, 84, 72, 5, 0.46, 'rust'); },
  'armor:coat': (p) => { p.poly([[22, 40], [74, 40], [80, 92], [16, 92]], 'navy', { bevel: 6, k: 1.3, tone: 2.8 }); torso(p, 'navy', { tone: 3.1, seams: true }); p.poly([[36, 8], [47, 40], [32, 50], [24, 18]], 'navy', { bevel: 3, k: 1.3, tone: 4 }); p.poly([[60, 8], [49, 40], [64, 50], [72, 18]], 'navy', { bevel: 3, k: 1.3, tone: 3.5 }); p.rect(6, 20, 20, 9, 'gold', { bevel: 2, k: 1.9, tone: 3.8 }); p.rect(70, 20, 20, 9, 'gold', { bevel: 2, k: 1.9, tone: 3.5 }); p.groove(48, 40, 48, 92); for (let y = 46; y < 88; y += 11) { p.ell(41, y, 3, 3, 'gold', { tone: 4 }); p.ell(55, y, 3, 3, 'gold', { tone: 3.6 }); } },
  'armor:smuggler': (p) => { torso(p, 'leather', { tone: 3 }); p.poly([[36, 8], [48, 30], [30, 40], [24, 18]], 'leather', { bevel: 3, tone: 3.8 }); p.poly([[60, 8], [48, 30], [66, 40], [72, 18]], 'leather', { bevel: 3, tone: 3.4 }); p.groove(48, 30, 48, 88); p.rect(25, 52, 18, 18, 'tan', { bevel: 3, tone: 3 }); p.rect(53, 52, 18, 18, 'tan', { bevel: 3, tone: 2.7 }); p.rect(25, 52, 18, 6, 'tan', { bevel: 2, tone: 3.6 }); p.rect(53, 52, 18, 6, 'tan', { bevel: 2, tone: 3.2 }); p.rivet(33, 54, 'silver'); p.rivet(61, 54, 'silver'); p.grime(22, 18, 52, 70, 6, 0.42); p.scuff(24, 22, 48, 60, 5, 8); },
  'armor:wardenplate': (p) => { torso(p, 'rust', { tone: 2.9 }); p.rect(5, 22, 20, 20, 'black', { bevel: 5, k: 1.8, tone: 3 }); p.rect(71, 22, 20, 20, 'black', { bevel: 5, k: 1.8, tone: 2.8 }); p.poly([[26, 24], [70, 24], [72, 72], [48, 82], [24, 72]], 'black', { bevel: 6, k: 1.8, tone: 2.8 }); p.poly([[38, 32], [58, 32], [58, 48], [48, 56], [38, 48]], 'red', { bevel: 3, k: 1.6, tone: 3.6 }); p.line(40, 34, 46, 34, 'red', 6); for (const [x, y] of [[29, 28], [65, 28], [29, 66], [65, 66]]) p.rivet(x, y, 'silver'); p.groove(30, 60, 66, 60); p.grime(6, 44, 84, 44, 4, 0.42); },

  // ---- items ----
  'item:stim': (p) => { syringe(p, 14, 84, 90, 8, 22, 'green'); p.rect(12, 74, 10, 4, 'sodium', { bevel: 1, tone: 4, shadow: 0 }); },
  'item:thermal': (p) => { grenade(p, 46, 54, 37, 'olive', null); p.groove(14, 40, 78, 40); p.groove(10, 68, 82, 68); p.groove(46, 18, 46, 90); p.rect(10, 48, 72, 13, 'sodium', { bevel: 3, k: 1.5, tone: 3.8, clip: true, shadow: 0 }); stripes(p, 10, 48, 72, 13, 5); p.rect(36, 2, 20, 14, 'steel', { bevel: 3 }); p.bar(56, 8, 82, 16, 6, 'steel'); p.ring(84, 22, 8, 3, 'silver'); p.set(46, 28, 'red', 6).set(47, 28, 'red', 5).set(46, 29, 'red', 4).set(47, 29, 'red', 3); p.grime(10, 20, 72, 70, 3, 0.42, 'rust'); },
  'item:ion': (p) => { p.ring(48, 48, 44, 5, 'ion', { tone: 3 }); p.ell(48, 48, 27, 27, 'steel', { tone: 3.2, k: 1.9 }); p.ell(48, 48, 18, 18, 'ion', { tone: 3.8, k: 2.2, bevel: 16, shadow: 0 }); p.ell(44, 44, 6, 6, 'ion', { tone: 5.6, bevel: 3, k: 0.4, shadow: 0, rim: false }); for (let a = 0; a < 8; a++) p.rivet(Math.round(48 + Math.cos(a * 0.785) * 22.5) - 1, Math.round(48 + Math.sin(a * 0.785) * 22.5) - 1); arcLine(p, [[24, 22], [14, 26], [18, 14]]); arcLine(p, [[74, 72], [80, 66], [84, 80]]); spark(p, 80, 14, 5); spark(p, 14, 80, 4); },
  'item:smoke': (p) => { p.ell(30, 30, 20, 17, 'knit', { tone: 4.3, k: 1.3, shadow: 0, grad: 1 }); p.ell(60, 24, 25, 19, 'knit', { tone: 4.8, k: 1.3, shadow: 0, grad: 1 }); p.ell(44, 13, 15, 11, 'knit', { tone: 5.2, k: 1.1, shadow: 0, rim: false }); p.rect(30, 44, 36, 48, 'steel', { bevel: 8, k: 1.8, tone: 3 }); p.rect(30, 58, 36, 12, 'yellow', { bevel: 3, tone: 3.4, clip: true, shadow: 0 }); stripes(p, 30, 58, 36, 12, 4); p.rect(36, 38, 24, 8, 'black', { bevel: 2 }); for (let x = 39; x < 58; x += 5) p.set(x, 41, 'knit', 5); p.grime(30, 46, 36, 46, 5, 0.42, 'rust'); },

  // ---- implants ----
  'implant:reflex': (p) => { for (let y = 4; y < 88; y += 18) { p.rect(32, y, 32, 15, 'pale', { bevel: 5, k: 1.7, tone: 3.6 }); p.rect(26, y + 5, 44, 5, 'pale', { bevel: 2, tone: 3, k: 1.2, shadow: 0 }); } bolt(p, 'ion'); },
  'implant:dermal': (p) => { const r = [[4, 8], [34, 8], [64, 8], [18, 34], [48, 34], [78, 34], [4, 60], [34, 60], [64, 60]]; for (const [x, y] of r) { p.poly([[x + 7, y], [x + 21, y], [x + 28, y + 12], [x + 21, y + 24], [x + 7, y + 24], [x, y + 12]], 'silver', { bevel: 4, k: 1.8, tone: 3.5 }); p.rivet(x + 13, y + 11); } },
  'implant:optic': (p) => { p.shape('white', { bevel: 14, k: 1.6, tone: 4 }, [['e', 48, 48, 44, 28]]); p.ell(48, 48, 22, 22, 'black', { tone: 1.4, k: 0.6, shadow: 0, bevel: 3 }); p.ring(48, 48, 22, 4, 'silver', { shadow: 0 }); p.ell(48, 48, 16, 16, 'red', { tone: 3.4, k: 2, shadow: 0 }); p.ell(48, 48, 6, 6, 'black', { tone: 0.5, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.rect(38, 37, 6, 5, 'white', { tone: 6, k: 0, rim: false, shadow: 0, tex: null, bevel: 1, dither: 0 }); for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.4; p.tint(48 + Math.cos(a) * 8, 48 + Math.sin(a) * 8, 48 + Math.cos(a) * 15, 48 + Math.sin(a) * 15, -2); } p.rect(44, 4, 8, 16, 'red', { bevel: 2, tone: 3.4 }); p.rect(44, 76, 8, 16, 'red', { bevel: 2, tone: 3 }); p.line(14, 50, 24, 60, 'red', 3); p.line(82, 44, 72, 34, 'red', 3); },
  'implant:pain': (p) => { brain(p); p.rect(8, 56, 80, 14, 'steel', { bevel: 3, k: 1.7 }); p.rect(40, 54, 16, 18, 'black', { bevel: 3 }); p.ell(48, 63, 5, 5, 'ion', { tone: 4.4 }); p.set(46, 61, 'ion', 6); for (let x = 14; x < 36; x += 7) p.rivet(x, 61); for (let x = 60; x < 84; x += 7) p.rivet(x, 61); },
  'implant:adrenal': (p) => { heart(p, 'red'); p.bar(48, 2, 48, 36, 7, 'ion', { tone: 3.6, gloss: 1 }); p.rect(40, 2, 16, 5, 'steel', { bevel: 1 }); p.rect(44, 36, 8, 8, 'steel', { bevel: 2 }); p.groove(30, 50, 50, 42); p.groove(64, 30, 74, 52); spark(p, 76, 12, 5); },
  'implant:myomer': (p) => { p.ell(60, 26, 28, 20, 'rust', { tone: 3.6, k: 1.7 }); p.shape('rust', { bevel: 13, k: 1.7, tone: 3.4 }, [['p', [[10, 24], [40, 18], [46, 92], [14, 92]]], ['e', 28, 54, 24, 36]]); for (let k = 0; k < 7; k++) { p.groove(10, 28 + k * 9, 46, 22 + k * 9); } for (let k = 0; k < 4; k++) p.groove(44, 16 + k * 8, 84, 16 + k * 8); p.rect(8, 76, 40, 18, 'steel', { bevel: 3, k: 1.7 }); p.rivet(14, 82); p.rivet(38, 82); p.bar(28, 40, 66, 24, 3, 'ion', { shadow: 0, tone: 4 }); },
  'implant:neural': (p) => { brain(p); const n = [[28, 28], [66, 30], [34, 54], [62, 54], [48, 42]]; for (const [a, b] of [[0, 4], [1, 4], [2, 4], [3, 4], [0, 2], [1, 3]]) arcLine(p, [n[a], n[b]]); for (const [x, y] of n) { p.ell(x, y, 4, 4, 'ion', { tone: 4.6, shadow: 0 }); p.set(x - 1, y - 1, 'ion', 6); } },
  'implant:voice': (p) => { p.shape('ion', { bevel: 2, k: 1.8, tone: 3.8, gloss: 1, shadow: 0 }, [['e', 44, 48, 32, 32], ['-e', 44, 48, 27, 27], ['-r', 0, 0, 60, 96]]); p.shape('ion', { bevel: 1.5, k: 1.8, tone: 3, shadow: 0 }, [['e', 44, 48, 45, 45], ['-e', 44, 48, 41, 41], ['-r', 0, 0, 62, 96]]); p.rect(4, 22, 20, 52, 'black', { bevel: 4, k: 1.6 }); p.ell(34, 48, 24, 26, 'steel', { tone: 3.2, k: 1.9 }); p.ell(34, 48, 15, 17, 'black', { tone: 2, bevel: 2, shadow: 0 }); for (let y = 36; y < 62; y += 5) p.line(23, y, 45, y, 'steel', 4); },
  'implant:synapse': (p) => { for (let k = 0; k < 4; k++) { const v = 26 + k * 12; p.rect(v, 3, 6, 20, 'gold', { bevel: 2, k: 1.9, tone: 3.6 }); p.rect(v, 73, 6, 20, 'gold', { bevel: 2, k: 1.9, tone: 3.2 }); p.rect(3, v, 20, 6, 'gold', { bevel: 2, k: 1.9, tone: 3.6 }); p.rect(73, v, 20, 6, 'gold', { bevel: 2, k: 1.9, tone: 3.2 }); } p.rect(18, 18, 60, 60, 'black', { bevel: 4, k: 1.8, tone: 2.8 }); p.rect(26, 26, 44, 44, 'navy', { bevel: 1, tone: 2, k: 0.3, rim: false, shadow: 0, tex: null }); arcLine(p, [[30, 62], [42, 38], [52, 54], [66, 34]]); p.rivet(21, 21, 'silver'); p.rivet(72, 21, 'silver'); p.rivet(21, 72, 'silver'); p.rivet(72, 72, 'silver'); },

  // ---- contacts and mods ----
  'upgrade:belt': (p) => { p.bar(14, 14, 82, 82, 18, 'leather', { bevel: 5, k: 1.5 }); for (let k = 0; k < 4; k++) { const c = 25 + k * 15; p.rect(c - 8, c - 9, 16, 18, 'yellow', { bevel: 3, k: 1.8, tone: 3.5 }); p.rect(c - 5, c - 9, 10, 5, 'leather', { bevel: 1, tone: 3.2 }); p.rivet(c - 1, c - 8, 'silver'); } p.grime(4, 6, 88, 84, 4, 0.55); },
  'upgrade:medic': (p) => medbag(p),
  'upgrade:drill': (p) => fist(p),
  'upgrade:forger': (p) => { paperSheet(p, 14, 4, 62, 86); p.bar(58, 18, 84, 52, 6, 'black', { w2: 3 }); p.line(84, 52, 87, 56, 'gold', 5); wax(p, 58, 72, 15, 'red'); p.groove(53, 67, 63, 77); p.groove(63, 67, 53, 77); },
  'upgrade:fence': (p) => { for (let k = 0; k < 5; k++) p.ell(32, 80 - k * 12, 25, 11, 'gold', { tone: 3.4 - k * 0.05, bevel: 5, k: 1.8 }); coin(p, 66, 34, 25); p.grime(8, 30, 46, 60, 5, 0.5); },

  // ---- contraband ----
  'perk:hollow': (p) => { ammo(p, 48, 4, 40, 88, 'gold', 'steel'); p.ell(48, 16, 9, 6, 'black', { tone: 0.6, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.tint(40, 12, 54, 11, 2); for (const [a, b] of [[38, 20], [58, 20]]) p.set(a, b, 'steel', 1); },
  'perk:dressing': (p) => { bandage(p, 36, 46); p.rect(46, 50, 44, 28, 'white', { bevel: 3, k: 1.3, tone: 3.8 }); p.rect(58, 56, 22, 16, 'red', { bevel: 3, tone: 3, k: 1 }); for (let x = 50; x < 90; x += 5) p.tint(x, 51, x, 76, -1); p.grime(58, 56, 22, 16, 3, 0.2, 'red'); },
  'perk:chit': (p) => { coin(p, 48, 48, 42); p.ell(48, 48, 6, 6, 'black', { tone: 0.6, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.grime(6, 6, 84, 84, 3, 0.52); },
  'perk:serrated': (p) => { blade(p, { mat: 'silver', handle: 'leather', tip: [90, 6], heel: [32, 62], w: 17, end: [10, 84], hw: 10 }); for (let k = 0; k < 7; k++) { const x = 46 + k * 6.4, y = 60 - k * 7; p.poly([[x - 4, y - 5], [x + 4, y + 4], [x + 8, y - 3]], 'black', { tone: 0, k: 0, flat: true, rim: false, shadow: 0, tex: null, dither: 0, bevel: 1 }); } p.grime(44, 20, 40, 44, 3, 0.45, 'red'); },
  'perk:incendiary': (p) => { p.shape('fire', { bevel: 13, k: 1, tone: 2.8, gloss: 0.2 }, [['e', 48, 62, 32, 30], ['p', [[18, 58], [12, 26], [30, 42], [38, 8], [50, 34], [62, 2], [68, 38], [84, 22], [78, 60]]]]); p.shape('fire', { bevel: 9, k: 0.8, tone: 4.2, shadow: 0, rim: false }, [['e', 48, 68, 20, 20], ['p', [[30, 66], [32, 40], [42, 52], [50, 28], [56, 52], [66, 42], [66, 66]]]]); p.ell(48, 74, 10, 12, 'fire', { tone: 5.8, k: 0.4, shadow: 0, rim: false, bevel: 4 }); },
  'perk:steady': (p) => crosshair(p, 'red'),
  'perk:secondwind': (p) => { for (const [y, x1, r, flip] of [[28, 60, 16, 0], [50, 74, 14, 1], [72, 54, 12, 0]]) { const cy = y + (flip ? r : -r); p.mRect(4, y - 3, x1 - 4, 7); p.mEll(x1, cy, r + 3, r + 3); p.mEll(x1, cy, r - 3, r - 3, 0); p.mRect(x1 - r - 4, cy - r - 4, r + 4, r * 2 + 8, 0); p.mRect(4, y - 3, x1 - 4, 7); p.paint('ion', { bevel: 3, k: 1.8, tone: 3.4, gloss: 0.8 }); } spark(p, 22, 10, 5, 'green'); p.ell(30, 88, 4, 4, 'green', { tone: 4.4 }); },
  'perk:scavenger': (p) => { p.bar(30, 16, 30, 4, 7, 'leather'); p.bar(66, 16, 66, 4, 7, 'leather'); p.rect(28, 3, 40, 7, 'leather', { bevel: 2 }); p.poly([[16, 14], [80, 14], [86, 80], [76, 92], [20, 92], [10, 80]], 'olive', { bevel: 8, k: 1.6, tone: 3.1 }); p.poly([[14, 14], [82, 14], [84, 38], [48, 48], [12, 38]], 'olive', { bevel: 4, k: 1.6, tone: 3.8 }); p.rect(42, 34, 12, 18, 'leather', { bevel: 2, tone: 3 }); p.rect(44, 44, 8, 6, 'silver', { bevel: 1 }); p.rect(26, 58, 44, 26, 'olive', { bevel: 3, tone: 2.5, k: 1.2 }); p.groove(26, 66, 70, 66); p.rivet(30, 62, 'silver'); p.rivet(62, 62, 'silver'); p.rect(30, 50, 8, 5, 'sodium', { bevel: 1, tone: 3.5 }); p.grime(12, 20, 72, 70, 4, 0.42); },
  'perk:spotter': (p) => { p.rect(38, 28, 20, 18, 'steel', { bevel: 3 }); p.rect(6, 22, 36, 62, 'black', { bevel: 8, k: 1.8, tone: 2.8 }); p.rect(54, 22, 36, 62, 'black', { bevel: 8, k: 1.8, tone: 2.6 }); p.rect(8, 12, 32, 12, 'steel', { bevel: 3, k: 1.8 }); p.rect(56, 12, 32, 12, 'steel', { bevel: 3, k: 1.8 }); p.ell(24, 62, 13, 15, 'glass', { tone: 3.2, k: 2.2, shadow: 0 }); p.ell(72, 62, 13, 15, 'glass', { tone: 3.2, k: 2.2, shadow: 0 }); p.line(19, 54, 25, 50, 'glass', 6); p.line(67, 54, 73, 50, 'glass', 6); p.line(20, 57, 22, 55, 'glass', 5); p.line(68, 57, 70, 55, 'glass', 5); p.set(46, 30, 'sodium', 6); p.groove(8, 42, 40, 42); p.groove(56, 42, 88, 42); },
  'perk:thick': (p) => { shield(p, 'leather'); p.grime(14, 8, 68, 70, 3, 0.45); for (const [x, y] of [[20, 14], [74, 14], [18, 44], [76, 44]]) p.rivet(x, y, 'silver'); },
  'perk:ambush': (p) => { p.poly([[41, 60], [41, 16], [48, 2], [48, 60]], 'silver', { flat: true, bevel: 1, k: 0.3, tone: 5, rim: false, grad: 1 }); p.poly([[48, 2], [55, 16], [55, 60], [48, 60]], 'silver', { flat: true, bevel: 1, k: 0.3, tone: 3, grad: 1 }); p.line(48, 3, 48, 60, 'silver', 6); p.rect(26, 58, 44, 10, 'gold', { bevel: 3, k: 1.9, tone: 3.5 }); p.rect(41, 68, 14, 18, 'black', { bevel: 3, k: 1.8, tone: 3 }); for (let y = 71; y < 86; y += 4) p.tint(42, y, 53, y, -2); p.ell(48, 88, 7, 6, 'gold', { tone: 3.5 }); },
  'perk:deadman': (p) => { skull(p, { cx: 44, cy: 46, s: 0.95 }); p.rect(72, 2, 18, 26, 'red', { bevel: 3, k: 1.7, tone: 3.6 }); p.rect(78, 28, 6, 10, 'steel', { bevel: 1 }); p.set(76, 6, 'red', 6).set(77, 6, 'red', 6); p.line(80, 38, 70, 46, 'silver', 4); },
  'perk:grudge': (p) => { fist(p, 'red', 'black'); p.grime(22, 16, 56, 54, 3, 0.42); },
  'perk:quickdraw': (p) => { pistol(p, { x: 34, y: 26, len: 46, h: 18, slide: 'gun', frame: 'black', gripMat: 'leather', barrel: 'steel', bl: 6, gw: 16, gh: 30, fh: 9 }); for (let k = 0; k < 4; k++) { const y = 30 + k * 12, x1 = 26 - (k % 2) * 6; p.line(4, y, x1, y, 'sodium', 6 - k); p.line(4, y + 1, x1 - 4, y + 1, 'sodium', 3); } },
  'perk:capacitor': (p) => { p.rect(22, 16, 52, 76, 'steel', { bevel: 9, k: 1.8, tone: 3 }); p.rect(34, 4, 28, 14, 'ion', { bevel: 3, k: 1.8, tone: 3.4 }); p.rect(22, 30, 52, 4, 'black', { tone: 1.5, k: 0, clip: true, rim: false, shadow: 0 }); p.rect(22, 80, 52, 4, 'black', { tone: 1.5, k: 0, clip: true, rim: false, shadow: 0 }); p.poly([[52, 38], [36, 60], [47, 60], [40, 78], [60, 54], [49, 54], [58, 38]], 'ion', { bevel: 2, tone: 4.4, k: 1.3, gloss: 1, shadow: 1 }); p.grime(22, 16, 52, 76, 3, 0.48, 'rust'); },
  'perk:reputation': (p) => { p.poly([[48, 4], [59, 34], [92, 36], [66, 56], [76, 90], [48, 70], [20, 90], [30, 56], [4, 36], [37, 34]], 'gold', { bevel: 8, k: 1.8, tone: 3.5, gloss: 1 }); p.poly([[48, 28], [55, 44], [70, 46], [58, 56], [62, 72], [48, 62], [34, 72], [38, 56], [26, 46], [41, 44]], 'gold', { bevel: 2, k: -1.2, tone: 3.2, shadow: 0, rim: false, clip: true }); p.set(44, 18, 'gold', 6); p.grime(10, 8, 76, 78, 4, 0.55); },
  'perk:adrenal': (p) => injector(p, 'red'),
  'perk:rangefinder': (p) => crosshair(p, 'ion'),
  'perk:knuckles': (p) => { for (let i = 0; i < 4; i++) p.ell(24 + i * 16, 40, 9, 12, 'gold', { tone: 4, k: 1.2 }); p.rect(14, 50, 68, 22, 'gold', { bevel: 6, k: 1.6, tone: 3.4 }); },
  'perk:stimsling': (p) => { syringe(p, 14, 84, 90, 8, 22, 'green'); syringe(p, 6, 70, 70, 6, 14, 'green'); },
  'perk:fieldnotes': (p) => { p.rect(18, 10, 60, 76, 'leather', { bevel: 5, k: 1.6, tone: 3.2 }); for (let y = 24; y < 76; y += 10) p.line(28, y, 68, y, 'pale', 3); },
  'perk:pockets': (p) => { p.rect(14, 22, 68, 62, 'olive', { bevel: 8, k: 1.7, tone: 3.2 }); p.rect(14, 22, 68, 18, 'olive', { bevel: 4, k: 1.4, tone: 4 }); },
  'perk:siphon': (p) => { heart(p, 'red'); ammo(p, 70, 30, 16, 52, 'gold', 'red'); },
  'perk:flashbang': (p) => { bolt(p, 'yellow'); p.ell(48, 48, 40, 40, 'pale', { tone: 5, k: 0.4, shadow: 0, gloss: 1 }); },
  'perk:riposte': (p) => blade(p, { mat: 'silver', handle: 'leather', tip: [88, 8], heel: [34, 62], w: 14, end: [10, 86], hw: 9 }),
  'perk:tithe': (p) => { heart(p, 'red'); coin(p, 66, 68, 24); },
  'perk:ironlung': (p) => { p.rect(42, 3, 12, 34, 'silver', { bevel: 4, k: 2 }); for (let y = 6; y < 36; y += 6) p.groove(43, y, 53, y); p.bar(46, 34, 32, 44, 7, 'silver'); p.bar(50, 34, 64, 44, 7, 'silver'); p.shape('steel', { bevel: 12, k: 1.8, tone: 3 }, [['p', [[42, 38], [42, 82], [30, 92], [14, 88], [6, 66], [14, 42], [28, 30]]]]); p.shape('steel', { bevel: 12, k: 1.8, tone: 2.8 }, [['p', [[54, 38], [54, 82], [66, 92], [82, 88], [90, 66], [82, 42], [68, 30]]]]); for (let y = 48; y < 88; y += 10) { p.groove(11, y, 41, y); p.groove(55, y, 86, y); } for (const [x, y] of [[20, 40], [32, 54], [14, 66], [32, 78], [72, 40], [60, 54], [80, 66], [60, 78]]) p.rivet(x, y); },
  'perk:tripwire': (p) => { p.rect(4, 44, 16, 40, 'black', { bevel: 3, k: 1.7 }); p.rect(76, 36, 16, 40, 'black', { bevel: 3, k: 1.7, tone: 2.7 }); p.poly([[4, 84], [20, 84], [24, 92], [0, 92]], 'steel', { bevel: 2 }); p.poly([[76, 76], [92, 76], [95, 84], [73, 84]], 'steel', { bevel: 2 }); p.line(20, 60, 76, 54, 'silver', 6); p.line(20, 61, 76, 55, 'silver', 2); p.ell(48, 57, 7, 7, 'red', { tone: 4.2, k: 1.8 }); p.set(46, 55, 'red', 6); p.ell(12, 52, 3, 3, 'red', { tone: 4 }); p.ell(84, 44, 3, 3, 'red', { tone: 4 }); },
  'perk:padding': (p) => { shield(p, 'olive'); for (let y = 22; y < 66; y += 9) p.groove(22, y, 74, y); p.grime(14, 8, 68, 70, 5, 0.45); },
  'perk:coupdegrace': (p) => { skull(p, { eye: 'red' }); blade(p, { mat: 'silver', handle: 'black', tip: [92, 4], heel: [24, 72], w: 8, end: [6, 90], hw: 8 }); },
  'perk:ghost': (p) => { p.poly([[14, 44], [20, 18], [48, 5], [76, 18], [82, 44], [84, 90], [72, 80], [60, 90], [48, 80], [36, 90], [24, 80], [12, 90]], 'white', { bevel: 12, k: 1.3, tone: 3.6, gloss: 0.1 }); for (const x of [36, 60]) p.ell(x, 40, 7, 10, 'black', { tone: 0.6, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.ell(48, 58, 5, 7, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.grime(12, 60, 72, 30, 3, 0.15); },
  'perk:warpaint': (p) => { p.shape('skin', { bevel: 14, k: 1.6, tone: 3.4 }, [['e', 48, 42, 36, 37], ['p', [[16, 54], [80, 54], [66, 90], [48, 94], [30, 90]]]]); p.rect(12, 32, 72, 14, 'red', { bevel: 2, k: 0.8, tone: 3.2, clip: true, shadow: 0, rim: false }); for (let x = 12; x < 84; x += 7) { p.set(x, 46, 'red', 2); p.set(x + 3, 47, 'red', 2); } for (const x of [34, 62]) { p.ell(x, 40, 7, 3.5, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null, dither: 0 }); p.set(x - 1, 39, 'white', 6); p.set(x, 39, 'white', 5); } p.rect(42, 52, 12, 26, 'red', { bevel: 2, tone: 3, k: 0.8, clip: true, shadow: 0, rim: false }); p.line(36, 82, 60, 82, 'skin', 1); },

  // ---- the cell ----
  'cell:stash': (p) => { crate(p, 'wood'); coin(p, 66, 26, 20); },
  'cell:kit': (p) => medbag(p, 'olive', 'white'),
  'cell:cache': (p) => { crate(p, 'olive', { y: 30, h: 60 }); p.poly([[6, 30], [10, 12], [86, 12], [90, 30]], 'black', { bevel: 4, k: 1.7, tone: 2.9 }); p.rect(40, 24, 16, 14, 'silver', { bevel: 3, k: 1.8 }); p.rect(46, 30, 4, 5, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null }); p.bar(70, 12, 88, 6, 5, 'steel'); },
  'cell:ledger': (p) => { p.rect(10, 4, 76, 88, 'navy', { bevel: 5, k: 1.5, tone: 3 }); p.rect(20, 8, 64, 80, 'paper', { bevel: 1, k: 0.4, tone: 4.2, flat: true }); for (let y = 16; y < 84; y += 8) p.line(26, y, 76 - (y * 5) % 16, y, 'knit', 3); p.shade(20, 8, 4, 80, -1); p.poly([[64, 2], [74, 2], [74, 42], [69, 36], [64, 42]], 'red', { bevel: 2, k: 1.4, tone: 3.6 }); p.rect(10, 4, 10, 88, 'navy', { bevel: 3, k: 1.8, tone: 2.6 }); },
  'cell:mentor': (p) => { p.poly([[24, 2], [46, 2], [52, 46], [42, 46]], 'red', { bevel: 3, k: 1.4, tone: 3.2 }); p.poly([[72, 2], [50, 2], [44, 46], [54, 46]], 'navy', { bevel: 3, k: 1.4, tone: 3.4 }); for (let y = 8; y < 44; y += 8) { p.tint(26, y, 44, y + 2, -1); p.tint(52, y + 2, 70, y, 1); } coin(p, 48, 62, 28); },

  // ---- training ----
  'train:hp': (p) => heart(p),
  'train:atk': (p) => crosshair(p, 'yellow'),
  'train:def': (p) => { shield(p, 'steel'); p.grime(14, 8, 68, 70, 3, 0.48, 'rust'); },
  'train:spd': (p) => bolt(p, 'yellow'),

  // ---- skills ----
  'skill:aimed': (p) => crosshair(p, 'red'),
  'skill:burst': (p) => { for (let k = 0; k < 3; k++) ammo(p, 18 + k * 30, 6 + (k === 1 ? 0 : 6), 22, 78, 'gold', 'steel'); p.grime(6, 30, 84, 56, 3, 0.52); },
  'skill:blast': (p) => { p.rect(2, 34, 26, 28, 'steel', { bevel: 5, k: 1.9 }); p.rect(26, 28, 8, 40, 'black', { bevel: 2 }); for (let i = -2; i <= 2; i++) { const y = 48 + i * 19, a = 38 + Math.abs(i) * 2; p.bar(a, 48 + i * 4, 90 - Math.abs(i) * 2, y, 4, 'fire', { w2: 8, tone: 4.2, k: 1.5, shadow: 0 }); p.line(a + 4, 48 + i * 4, 88 - Math.abs(i) * 2, y, 'fire', 6); } p.ell(44, 48, 9, 12, 'fire', { tone: 5, k: 0.8, shadow: 0 }); },
  'skill:smash': (p) => { p.rect(42, 40, 12, 52, 'wood', { bevel: 5, k: 1.9 }); p.rect(14, 6, 68, 38, 'steel', { bevel: 6, k: 1.8, tone: 3.3 }); p.rect(8, 10, 8, 30, 'black', { bevel: 2 }); p.rect(80, 10, 8, 30, 'black', { bevel: 2 }); for (let x = 26; x < 72; x += 15) p.rivet(x, 24); p.grime(14, 6, 68, 38, 3, 0.45, 'rust'); for (const [x, y, u, v] of [[6, 76, 22, 64], [90, 76, 68, 64], [14, 90, 30, 80], [82, 90, 62, 80]]) { p.line(x, y, u, v, 'sodium', 6); p.line(x, y + 1, u, v + 1, 'sodium', 3); } },
  'skill:overload': (p) => bolt(p, 'ion'),
  'skill:suppress': (p) => { pistol(p, { x: 4, y: 52, len: 40, h: 14, slide: 'steel', frame: 'black', gripMat: 'black', barrel: 'steel', bl: 4, gw: 14, gh: 18, fh: 7 }); for (let i = 0; i < 4; i++) { const y = 10 + i * 13; p.bar(40 + i * 2, y, 90, y, 3, 'yellow', { w2: 6, tone: 4.2, k: 1.5, shadow: 0 }); p.line(44 + i * 2, y, 90, y, 'yellow', 6); } },
  'skill:intimidate': (p) => skull(p, { eye: 'red' }),
  'skill:barrier': (p) => { shield(p, 'ion'); p.rect(40, 22, 16, 40, 'white', { bevel: 2, tone: 4, shadow: 0 }); p.rect(28, 34, 40, 16, 'white', { bevel: 2, tone: 4, shadow: 0 }); },
  'skill:rally': (p) => { syringe(p, 14, 84, 90, 8, 22, 'red'); p.rect(12, 74, 10, 4, 'sodium', { bevel: 1, tone: 4, shadow: 0 }); },
  'skill:triage': (p) => { heart(p); p.rect(42, 26, 12, 36, 'white', { bevel: 2, tone: 4, shadow: 0 }); p.rect(30, 38, 36, 12, 'white', { bevel: 2, tone: 4, shadow: 0 }); },
  'skill:tag': (p) => crosshair(p, 'yellow'),

  // ---- rooms ----
  'room:fight': (p) => { blade(p, { mat: 'steel', handle: 'leather', tip: [88, 6], heel: [32, 62], w: 14, end: [10, 84], hw: 9 }); blade(p, { mat: 'silver', handle: 'wood', tip: [8, 6], heel: [64, 62], w: 14, end: [86, 84], hw: 9 }); },
  'room:elite': (p) => { skull(p, { cy: 50, s: 0.92 }); p.poly([[14, 28], [12, 2], [32, 20]], 'red', { bevel: 3, k: 1.6, tone: 3.4 }); p.poly([[82, 28], [84, 2], [64, 20]], 'red', { bevel: 3, k: 1.6, tone: 3.2 }); },
  'room:event': (p) => { p.shape('ion', { bevel: 5, k: 1.5, tone: 3.5, gloss: 0.8 }, [['p', [[22, 12], [34, 2], [64, 2], [76, 12], [76, 40], [64, 50], [56, 50], [56, 66], [40, 66], [40, 42], [60, 36], [60, 18], [36, 18], [36, 32], [22, 32]]]]); p.ell(48, 83, 10, 10, 'ion', { tone: 4 }); p.set(44, 78, 'ion', 6).set(45, 78, 'ion', 6); },
  'room:supply': (p) => crate(p, 'wood'),
  'room:rest': (p) => { p.rect(4, 74, 8, 18, 'wood', { bevel: 2 }); p.rect(84, 74, 8, 18, 'wood', { bevel: 2, tone: 2.6 }); p.rect(4, 52, 88, 26, 'wood', { bevel: 3, k: 1.3 }); p.rect(4, 22, 8, 36, 'wood', { bevel: 3 }); p.rect(10, 34, 28, 22, 'white', { bevel: 8, k: 1.5, tone: 3.8 }); p.rect(34, 40, 58, 24, 'olive', { bevel: 8, k: 1.5, tone: 3.2 }); p.groove(36, 50, 90, 50); p.grime(34, 40, 58, 24, 3, 0.46); },
  'room:cells': (p) => { key(p, 'gold'); p.grime(4, 8, 88, 50, 3, 0.48); for (let k = 0; k < 3; k++) { p.rect(10 + k * 30, 66, 7, 26, 'steel', { bevel: 3, k: 1.9 }); } p.rect(4, 64, 88, 6, 'steel', { bevel: 2 }); p.rect(4, 86, 88, 6, 'steel', { bevel: 2 }); },
  'room:cargo': (p) => { crate(p, 'steel', { y: 18, h: 72 }); p.rect(20, 66, 56, 12, 'yellow', { bevel: 2, tone: 3.4, clip: true, shadow: 0 }); stripes(p, 20, 66, 56, 12, 5); p.rect(30, 30, 36, 20, 'tan', { bevel: 1, tone: 3.6, shadow: 1 }); p.line(34, 36, 62, 36, 'knit', 2); p.line(34, 42, 54, 42, 'knit', 2); p.grime(8, 18, 80, 72, 6, 0.48, 'rust'); },
  'room:bounty': (p) => { skull(p, { cx: 40, cy: 38, s: 0.9 }); coin(p, 68, 68, 23); },
  'room:vault': (p) => { p.rect(6, 6, 84, 84, 'steel', { bevel: 6, k: 1.7, tone: 3 }); for (const [x, y] of [[12, 12], [81, 12], [12, 81], [81, 81], [12, 46], [81, 46]]) p.rivet(x, y); p.ell(48, 48, 28, 28, 'silver', { tone: 3.2, k: 1.9, bevel: 8 }); p.ell(48, 48, 18, 18, 'steel', { tone: 3, k: 1.5, bevel: 3, shadow: 0, rimTone: 0 }); p.rect(44, 22, 8, 52, 'black', { bevel: 3, k: 1.8, tone: 3 }); p.rect(22, 44, 52, 8, 'black', { bevel: 3, k: 1.8, tone: 3 }); p.ell(48, 48, 7, 7, 'silver', { tone: 3.8, k: 2 }); p.grime(6, 6, 84, 84, 3, 0.48, 'rust'); },
  'room:medbay': (p) => { p.rect(6, 6, 84, 84, 'white', { bevel: 6, k: 1.5, tone: 3.6 }); p.rect(38, 16, 20, 64, 'red', { bevel: 3, tone: 3.6, k: 1.4 }); p.rect(16, 38, 64, 20, 'red', { bevel: 3, tone: 3.6, k: 1.4 }); p.grime(6, 60, 84, 30, 3, 0.4); for (const [x, y] of [[11, 11], [83, 11], [11, 83], [83, 83]]) p.rivet(x, y); },
  'room:locker': (p) => { p.rect(14, 3, 68, 90, 'olive', { bevel: 5, k: 1.5, tone: 3 }); p.groove(48, 5, 48, 91); for (let y = 10; y < 26; y += 5) { p.groove(20, y, 42, y); p.groove(54, y, 76, y); } p.rect(40, 34, 5, 16, 'silver', { bevel: 1 }); p.rect(51, 34, 5, 16, 'silver', { bevel: 1 }); p.grime(14, 3, 68, 90, 4, 0.42, 'rust'); gun(p, { x: 26, y: 56, len: 26, h: 11, body: 'gun', barrel: 'black', bl: 16, bh: 4, stock: 'solid', stockMat: 'wood', stockLen: 14, gh: 12, gw: 7, mag: 'box', magW: 6, magH: 11 }); },
  'room:bench': (p) => { p.rect(4, 82, 8, 12, 'wood', { bevel: 2 }); p.rect(84, 82, 8, 12, 'wood', { bevel: 2, tone: 2.6 }); p.rect(2, 52, 92, 14, 'wood', { bevel: 3, k: 1.4, tone: 3.2 }); p.rect(10, 64, 10, 22, 'wood', { bevel: 3, tone: 2.8 }); p.rect(76, 64, 10, 22, 'wood', { bevel: 3, tone: 2.6 }); p.groove(4, 58, 92, 58); p.bar(18, 48, 58, 14, 9, 'wood'); p.poly([[48, 4], [82, 12], [76, 32], [42, 24]], 'steel', { bevel: 4, k: 1.8 }); p.rect(70, 34, 18, 18, 'steel', { bevel: 3, tone: 2.8 }); p.ell(79, 42, 3, 3, 'black', { tone: 1, k: 0, rim: false, shadow: 0, tex: null }); p.grime(2, 52, 92, 14, 3, 0.45); },
  'room:fence': (p) => { crate(p, 'wood', { y: 26, h: 64 }); p.ell(48, 50, 9, 9, 'gold', { tone: 4 }); p.ell(30, 66, 8, 8, 'red', { tone: 4 }); p.ell(66, 66, 8, 8, 'ion', { tone: 4 }); for (const [x, y, m] of [[45, 46, 'gold'], [27, 62, 'red'], [63, 62, 'ion']]) p.set(x, y, m, 6); },
  'room:boss': (p) => { p.poly([[12, 28], [12, 2], [28, 14], [38, 0], [48, 12], [58, 0], [68, 14], [84, 2], [84, 28]], 'gold', { bevel: 3, k: 1.7, tone: 3.6, gloss: 1 }); skull(p, { eye: 'red', cy: 56, s: 0.9 }); p.rect(14, 24, 68, 8, 'gold', { bevel: 2, k: 1.9, tone: 3.4 }); for (let x = 24; x < 76; x += 15) p.rivet(x, 26, 'silver'); },

  // ---- Downtime: Marks, shuttle parts, ventures ----
  'mark:hardened': (p) => { p.rect(14, 8, 68, 80, 'steel', { bevel: 6, k: 1.7 }); p.rect(26, 20, 44, 56, 'navy', { bevel: 3, tone: 2.2, k: 1, rim: false }); p.poly([[48, 26], [62, 34], [62, 54], [48, 68], [34, 54], [34, 34]], 'ion', { bevel: 5, k: 1.7, tone: 3.6 }); for (const [x, y] of [[18, 12], [75, 12], [18, 81], [75, 81]]) p.rivet(x, y); p.grime(14, 8, 68, 80, 3, 0.45, 'rust'); },
  'mark:reckoning': (p) => { p.ring(48, 48, 34, 8, 'gold', { tone: 3.5 }); p.ring(48, 48, 15, 6, 'red', { tone: 4 }); p.rect(44, 3, 8, 24, 'gold', { bevel: 2, tone: 4 }); p.rect(44, 69, 8, 24, 'gold', { bevel: 2, tone: 3.4 }); p.ell(48, 48, 3, 3, 'red', { tone: 5 }); p.grime(10, 10, 76, 76, 3, 0.5); },
  'mark:blockade': (p) => { p.poly([[4, 64], [30, 34], [56, 22], [90, 44], [62, 54], [52, 76], [20, 76]], 'ion', { bevel: 6, k: 1.6, tone: 3 }); p.poly([[30, 40], [50, 30], [50, 44], [30, 50]], 'black', { bevel: 1, tone: 1.4, k: 0.2, shadow: 0 }); p.line(32, 42, 44, 36, 'ion', 6); p.rect(62, 54, 26, 10, 'yellow', { bevel: 2, tone: 3.5 }); stripes(p, 62, 54, 26, 10, 4); p.rect(4, 78, 88, 6, 'black', { bevel: 1 }); },
  'mark:salvage': (p) => { coin(p, 36, 58, 26); coin(p, 64, 34, 24); },
  'mark:coldblood': (p) => { for (const [a, b, c, d] of [[48, 4, 48, 92], [4, 48, 92, 48], [16, 16, 80, 80], [80, 16, 16, 80]]) p.bar(a, b, c, d, a === c || b === d ? 8 : 6, a === c || b === d ? 'white' : 'ion', { tone: 4, gloss: 1 }); for (const [x, y] of [[48, 16], [48, 80], [16, 48], [80, 48]]) { p.ell(x, y, 5, 5, 'ion', { tone: 4 }); } p.ell(48, 48, 10, 10, 'white', { tone: 4.5, k: 1.6 }); p.set(45, 45, 'white', 6); },
  'ship:hull': (p) => { p.rect(8, 16, 80, 64, 'steel', { bevel: 6, k: 1.7, tone: 3 }); p.rect(20, 28, 56, 40, 'steel', { bevel: 4, k: 1.6, tone: 3.5 }); p.rect(36, 40, 24, 16, 'black', { bevel: 2, tone: 1.2, k: 0.2 }); for (const [x, y] of [[12, 20], [81, 20], [12, 73], [81, 73], [46, 20], [46, 73], [24, 32], [69, 32], [24, 62], [69, 62]]) p.rivet(x, y); p.grime(8, 16, 80, 64, 5, 0.42, 'rust'); p.scuff(22, 30, 50, 34, 3, 7); },
  'ship:guns': (p) => { p.rect(4, 36, 60, 24, 'black', { bevel: 6, k: 1.8, tone: 2.8 }); p.rect(58, 28, 32, 40, 'steel', { bevel: 6, k: 1.8 }); p.rect(2, 41, 18, 6, 'yellow', { bevel: 2, tone: 4 }); p.rect(2, 51, 18, 6, 'yellow', { bevel: 2, tone: 3.6 }); p.rect(66, 66, 18, 14, 'steel', { bevel: 2, tone: 2.6 }); p.rivet(62, 32); p.rivet(84, 32); p.grime(4, 28, 86, 40, 2, 0.45, 'rust'); },
  'ship:shields': (p) => { p.ring(48, 48, 44, 7, 'ion', { tone: 3.4, gloss: 1 }); p.ring(48, 48, 30, 3, 'ion', { tone: 2.4, shadow: 0 }); p.poly([[34, 28], [62, 28], [66, 50], [48, 70], [30, 50]], 'ion', { bevel: 5, k: 1.7, tone: 3.8, gloss: 1 }); p.line(36, 30, 46, 30, 'ion', 6); },
  'ship:engines': (p) => { p.poly([[22, 4], [74, 4], [78, 50], [18, 50]], 'steel', { bevel: 8, k: 1.8, tone: 3 }); for (let y = 14; y < 46; y += 8) p.groove(22, y, 74, y); p.poly([[30, 50], [66, 50], [72, 62], [24, 62]], 'black', { bevel: 3, k: 1.7 }); p.poly([[26, 62], [70, 62], [58, 80], [48, 94], [38, 80]], 'sodium', { bevel: 8, k: 0.8, tone: 4 }); p.poly([[38, 62], [58, 62], [48, 84]], 'fire', { bevel: 4, k: 0.4, tone: 5.5, shadow: 0, rim: false }); p.rivet(26, 8); p.rivet(68, 8); p.grime(18, 4, 60, 46, 3, 0.45, 'rust'); },
  'ship:ejector': (p) => { p.poly([[32, 74], [64, 74], [78, 92], [18, 92]], 'red', { bevel: 3, k: 1.6, tone: 3.2 }); p.ell(48, 42, 30, 38, 'white', { tone: 3.6, k: 1.7 }); p.ell(48, 34, 17, 13, 'glass', { tone: 3.2, k: 2.2, shadow: 0 }); p.line(38, 28, 46, 24, 'glass', 6); p.groove(20, 54, 76, 54); p.rect(20, 56, 56, 6, 'sodium', { bevel: 1, tone: 3.5, clip: true, shadow: 0 }); p.grime(18, 40, 60, 40, 3, 0.48); },
  'ship:targeting': (p) => { p.ell(48, 48, 40, 40, 'black', { tone: 2, bevel: 5, k: 1.4 }); p.ring(48, 48, 34, 4, 'red', { tone: 3.2, shadow: 0 }); p.rect(46, 6, 4, 84, 'red', { bevel: 1, tone: 3.8, shadow: 0 }); p.rect(6, 46, 84, 4, 'red', { bevel: 1, tone: 3.8, shadow: 0 }); p.ring(48, 48, 15, 3, 'red', { tone: 4.4, shadow: 0 }); p.ell(48, 48, 3, 3, 'red', { tone: 5.5 }); p.ell(66, 28, 3, 3, 'sodium', { tone: 5 }); },
  'ship:salvager': (p) => { p.rect(40, 2, 16, 34, 'steel', { bevel: 4, k: 1.8 }); p.rect(14, 34, 68, 13, 'yellow', { bevel: 3, tone: 3.4 }); stripes(p, 14, 34, 68, 13, 5); p.poly([[14, 46], [28, 46], [26, 78], [38, 90], [24, 90], [12, 76]], 'steel', { bevel: 4, k: 1.7 }); p.poly([[82, 46], [68, 46], [70, 78], [58, 90], [72, 90], [84, 76]], 'steel', { bevel: 4, k: 1.7, tone: 2.7 }); coin(p, 48, 72, 14); p.grime(12, 2, 72, 88, 4, 0.45, 'rust'); },
  'venture:stall': (p) => { p.rect(10, 36, 8, 56, 'wood', { bevel: 3 }); p.rect(78, 36, 8, 56, 'wood', { bevel: 3, tone: 2.6 }); p.rect(8, 58, 80, 34, 'olive', { bevel: 3, k: 1.3 }); p.groove(10, 68, 86, 68); p.poly([[4, 32], [14, 8], [82, 8], [92, 32]], 'red', { bevel: 3, k: 1.3, tone: 3.2 }); for (let x = 20; x < 78; x += 24) p.poly([[x, 8], [x + 12, 8], [x + 13, 32], [x - 3, 32]], 'white', { bevel: 2, k: 1, tone: 3.6, clip: true, shadow: 0 }); p.rect(4, 32, 88, 5, 'black', { bevel: 1, tone: 2.4 }); p.ell(30, 54, 6, 6, 'red', { tone: 3.6 }); p.ell(48, 54, 6, 6, 'gold', { tone: 3.8 }); p.ell(66, 54, 6, 6, 'green', { tone: 3.6 }); },
  'venture:consignment': (p) => { crate(p, 'navy'); p.rect(26, 50, 44, 22, 'paper', { bevel: 1, tone: 3.8, k: 0.5 }); p.line(30, 56, 64, 56, 'knit', 2); p.line(30, 62, 54, 62, 'knit', 2); coin(p, 68, 26, 20); },
  'venture:bond': (p) => { paperSheet(p, 14, 4, 66, 88); wax(p, 62, 72, 14, 'red'); p.line(22, 76, 42, 74, 'navy', 2); p.line(42, 74, 36, 80, 'navy', 2); },
};

const cache = {};
export function iconURL(key) {
  if (cache[key] !== undefined) return cache[key];
  const draw = DRAW[key];
  if (!draw || typeof document === 'undefined') return (cache[key] = null);
  const p = new Painter(S);
  draw(p);
  p.centre();
  p.outline(2);
  return (cache[key] = p.canvas().toDataURL('image/png'));
}
export const iconKeys = () => Object.keys(DRAW);
// Icon key for a gear base from data.js GEAR.
export function gearIconKey(id, b) {
  if (b.unique) return `unique:${id}`;
  return `${{ ranged: 'weapon', melee: 'weapon', chest: 'armor', head: 'head', legs: 'legs', gadget: 'gadget' }[b.slot]}:${id}`;
}
