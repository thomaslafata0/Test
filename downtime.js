// Downtime canvases: the roulette wheel and the orbit fight. Code-drawn until the art pack lands
// (downtime/manifest.json, see docs/DOWNTIME_ART_PROMPT_CHATGPT.md).
import { WHEEL_ORDER, ROULETTE_RED } from './engine.js';

let manifest = null, images = {}, loading = null;
export function loadDowntimeArt() {
  if (loading) return loading;
  loading = fetch('downtime/manifest.json').then((r) => (r.ok ? r.json() : null)).then(async (m) => {
    if (!m || m.pending) return false;
    manifest = m;
    await Promise.all(Object.entries(m.images || {}).map(([k, src]) => new Promise((res) => { const im = new Image(); im.onload = () => { images[k] = im; res(); }; im.onerror = () => res(); im.src = `downtime/${src}`; })));
    return true;
  }).catch(() => false);
  return loading;
}
export const artFor = (k) => images[k] || null;

// ---------- The Wheel ----------
const TAU = Math.PI * 2;
export class Wheel {
  constructor() {
    this.el = document.createElement('canvas'); this.el.width = 260; this.el.height = 260; this.el.className = 'wheel';
    this.g = this.el.getContext('2d');
    this.angle = 0; this.ball = 0; this.spin = null;
    this.draw();
  }
  // Animates to the given number; resolves when the ball settles.
  spinTo(n) {
    const idx = WHEEL_ORDER.indexOf(n), seg = TAU / 37;
    const target = -idx * seg - seg / 2; // pointer at the top (angle -PI/2 handled in draw)
    const start = performance.now(), from = this.angle % TAU, turns = 4 + Math.floor(Math.random() * 3);
    const to = target + TAU * turns + Math.floor(from / TAU) * TAU;
    return new Promise((res) => {
      const dur = 3600;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
        this.angle = from + (to - from) * e;
        this.ball = -this.angle * 1.6 * (1 - e); // the ball runs the other way, then settles under the pointer on the winning number
        this.draw(p < 1 ? null : n);
        if (p < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }
  draw(settled = null) {
    const g = this.g, W = this.el.width, cx = W / 2, cy = W / 2, R = W / 2 - 6, seg = TAU / 37;
    g.clearRect(0, 0, W, W);
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(0, 0, R + 5, 0, TAU); g.fill();
    g.fillStyle = '#6a4a2a'; g.beginPath(); g.arc(0, 0, R + 2, 0, TAU); g.fill();
    g.save(); g.rotate(this.angle - Math.PI / 2);
    for (let i = 0; i < 37; i++) {
      const n = WHEEL_ORDER[i];
      g.fillStyle = n === 0 ? '#2d7a4a' : ROULETTE_RED.has(n) ? '#b53a2f' : '#1d1f24';
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R - 2, i * seg, (i + 1) * seg); g.closePath(); g.fill();
      g.save(); g.rotate(i * seg + seg / 2); g.fillStyle = '#f0e8d8'; g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.fillText(String(n), R - 16, 4); g.restore();
    }
    g.fillStyle = '#2a2420'; g.beginPath(); g.arc(0, 0, R - 30, 0, TAU); g.fill();
    g.strokeStyle = '#d9a53a'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 30, 0, TAU); g.stroke();
    g.fillStyle = '#4a3a2a'; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill();
    for (let k = 0; k < 4; k++) { g.save(); g.rotate(k * Math.PI / 2); g.fillStyle = '#d9a53a'; g.fillRect(-3, -R + 34, 6, R - 52); g.restore(); }
    g.restore();
    // the ball
    const br = R - 10, ba = this.ball - Math.PI / 2;
    g.fillStyle = '#f5f0e6'; g.beginPath(); g.arc(Math.cos(ba) * br, Math.sin(ba) * br, 5, 0, TAU); g.fill();
    // pointer
    g.fillStyle = '#d9a53a'; g.beginPath(); g.moveTo(-8, -R - 6); g.lineTo(8, -R - 6); g.lineTo(0, -R + 8); g.closePath(); g.fill();
    g.restore();
    if (settled !== null) { g.fillStyle = '#0b0d10dd'; g.fillRect(cx - 34, cy - 20, 68, 40); g.strokeStyle = settled === 0 ? '#2d7a4a' : ROULETTE_RED.has(settled) ? '#b53a2f' : '#9a9aa4'; g.lineWidth = 2; g.strokeRect(cx - 34, cy - 20, 68, 40); g.fillStyle = '#f5f0e6'; g.font = 'bold 22px monospace'; g.textAlign = 'center'; g.fillText(String(settled), cx, cy + 8); }
  }
}

// ---------- Orbit ----------
// Draws the shuttle, the enemy ship and a starfield; plays hit, miss, evade and death events.
export class OrbitScene {
  constructor() {
    this.el = document.createElement('canvas'); this.el.width = 384; this.el.height = 180; this.el.className = 'orbit-canvas';
    this.g = this.el.getContext('2d'); this.g.imageSmoothingEnabled = false;
    this.stars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 384, y: (i * 53) % 180, s: 1 + (i % 3), v: 0.2 + (i % 4) * 0.15 }));
    this.fx = []; this.shake = 0; this.t0 = performance.now(); this.enemy = 'cutter'; this.dead = { me: false, enemy: false }; this.flash = null;
    this.raf = null; this.loop();
  }
  set(enemy, dead) { this.enemy = enemy; this.dead = dead; }
  play(events) {
    let delay = 0;
    for (const ev of events) {
      setTimeout(() => {
        if (ev.t === 'hit') { this.fx.push({ kind: 'beam', from: ev.who === 'enemy' ? 'me' : 'enemy', t: 0 }); setTimeout(() => { this.fx.push({ kind: 'boom', who: ev.who, t: 0, big: !!ev.crit }); this.shake = ev.who === 'me' ? 8 : 3; this.float(ev.who, `\u2212${ev.dmg}`, ev.crit ? '#ffd166' : '#f5f0e6'); }, 180); }
        else if (ev.t === 'miss') { this.fx.push({ kind: 'beam', from: ev.who === 'enemy' ? 'me' : 'enemy', t: 0, miss: true }); this.float(ev.who, 'miss', '#9a9aa4'); }
        else if (ev.t === 'evade') { this.fx.push({ kind: 'roll', who: 'me', t: 0 }); }
        else if (ev.t === 'repair') { this.float('enemy', 'repair', '#7ad17a'); }
        else if (ev.t === 'lock') { this.fx.push({ kind: 'lock', t: 0 }); }
        else if (ev.t === 'jump') { this.fx.push({ kind: 'jump', t: 0 }); }
        else if (ev.t === 'kill') { this.fx.push({ kind: 'boom', who: 'enemy', t: 0, big: true, final: true }); this.shake = 6; }
      }, delay);
      delay += ev.t === 'hit' ? 520 : 380;
    }
    return delay;
  }
  float(who, text, color) { this.fx.push({ kind: 'text', who, text, color, t: 0 }); }
  pos(who) { return who === 'me' ? { x: 70, y: 95 } : { x: 300, y: 70 }; }
  loop() {
    const g = this.g, W = this.el.width, H = this.el.height, now = performance.now(), t = (now - this.t0) / 1000;
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
    for (const s of this.stars) { s.x -= s.v; if (s.x < 0) s.x += W; g.fillStyle = s.s === 3 ? '#cfd6e6' : '#6a7390'; g.fillRect(s.x | 0, s.y | 0, s.s === 3 ? 2 : 1, s.s === 3 ? 2 : 1); }
    const bg = artFor('bg:orbit');
    if (bg) g.drawImage(bg, 0, 0, W, H);
    else {
      // The smog-brown home world, its lift cable climbing to a Directorate station, and the station's lights.
      g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(W / 2, H + 230, 296, 0, TAU); g.fill();
      g.fillStyle = '#4e3826'; g.beginPath(); g.arc(W / 2, H + 230, 290, 0, TAU); g.fill();
      g.fillStyle = '#5e4630'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(W / 2 + Math.sin(t * 0.05 + i * 1.7) * 140, H - 12 + i * 4, 60 - i * 6, 2, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(232,151,58,0.18)'; g.fillRect(0, H - 6, W, 6);
      g.fillStyle = '#1b1e26'; g.fillRect(W - 46, 0, 3, H);
      g.fillStyle = '#2b2f3a'; g.fillRect(W - 62, 18, 36, 10); g.fillRect(W - 52, 12, 16, 22);
      const blink = Math.floor(t * 2) % 2;
      g.fillStyle = blink ? '#ff4a4a' : '#5a1a1a'; g.fillRect(W - 60, 20, 2, 2); g.fillRect(W - 30, 20, 2, 2);
      g.fillStyle = '#ffd166'; for (let i = 0; i < 5; i++) g.fillRect(W - 50 + i * 3, 24, 1, 1);
      for (let i = 0; i < 6; i++) { g.fillStyle = (Math.floor(t * 3) + i) % 6 === 0 ? '#ffd166' : '#6a5a3a'; g.fillRect(W - 45, 40 + i * 22 + ((t * 12) % 22), 1, 2); }
    }
    g.save();
    if (this.shake > 0) { g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake *= 0.85; if (this.shake < 0.3) this.shake = 0; }
    const roll = this.fx.find((f) => f.kind === 'roll');
    if (!this.dead.me) this.drawShip('me', 70, 95 + Math.sin(t * 2) * 3, roll ? Math.sin(roll.t * 10) * 0.6 : 0);
    if (!this.dead.enemy) this.drawShip('enemy', 300, 70 + Math.sin(t * 1.6 + 1) * 3, 0);
    for (const f of this.fx) {
      f.t += 1 / 60;
      if (f.kind === 'beam') { const a = this.pos(f.from), b = this.pos(f.from === 'me' ? 'enemy' : 'me'); const p = Math.min(1, f.t / 0.18); g.strokeStyle = f.from === 'me' ? '#ffd166' : '#ff6a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p + (f.miss ? -40 * p : 0)); g.stroke(); }
      if (f.kind === 'boom') { const p = this.pos(f.who), r = (f.big ? 26 : 14) * Math.min(1, f.t / 0.3); g.fillStyle = `rgba(255,${f.final ? 140 : 190},60,${Math.max(0, 1 - f.t / 0.6)})`; g.beginPath(); g.arc(p.x + (Math.random() - 0.5) * 8, p.y + (Math.random() - 0.5) * 8, r, 0, TAU); g.fill(); }
      if (f.kind === 'text') { const p = this.pos(f.who); g.fillStyle = f.color; g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.globalAlpha = Math.max(0, 1 - f.t / 1.2); g.fillText(f.text, p.x, p.y - 30 - f.t * 20); g.globalAlpha = 1; }
      if (f.kind === 'lock') { const p = this.pos('me'), r = 30 - Math.min(20, f.t * 40); g.strokeStyle = '#ff4a4a'; g.lineWidth = 1.5; g.strokeRect(p.x - r, p.y - r, r * 2, r * 2); }
      if (f.kind === 'jump') { g.fillStyle = `rgba(200,220,255,${Math.min(1, f.t * 2)})`; g.fillRect(0, 0, W, H); }
    }
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'text' ? 1.2 : f.kind === 'roll' ? 0.7 : f.kind === 'jump' ? 1.5 : 0.6));
    g.restore();
    this.raf = requestAnimationFrame(() => this.loop());
  }
  drawShip(who, x, y, tilt) {
    const g = this.g, key = who === 'me' ? 'shuttle' : this.enemy, im = artFor(`ship:${key}`);
    g.save(); g.translate(x, y); g.rotate(tilt * 0.3);
    if (im) {
      // Ship art faces right; enemies are mirrored to face the shuttle.
      if (who !== 'me') g.scale(-1, 1);
      g.imageSmoothingEnabled = false;
      g.drawImage(im, Math.round(-im.width / 2), Math.round(-im.height / 2));
      g.restore(); return;
    }
    const flip = who === 'me' ? 1 : -1, size = 1.5 * (who === 'me' ? 1 : this.enemy === 'frigate' ? 1.7 : this.enemy === 'corvette' ? 1.3 : 1);
    g.scale(flip * size, size);
    const hull = who === 'me' ? '#8a8f9a' : this.enemy === 'frigate' ? '#5a3a3a' : this.enemy === 'corvette' ? '#4a4f6a' : '#5f6b5a', dark = '#2a2d33', light = who === 'me' ? '#d9a53a' : '#ff6a4a';
    // engine glow
    g.fillStyle = `rgba(120,180,255,${0.5 + Math.random() * 0.4})`; g.fillRect(-30, -4, 8, 8);
    g.fillStyle = dark; g.fillRect(-26, -9, 40, 18);
    g.fillStyle = hull; g.fillRect(-24, -7, 36, 14);
    g.fillRect(-10, -14, 18, 6); g.fillRect(-10, 8, 18, 6);
    g.fillStyle = dark; g.fillRect(12, -5, 16, 10); g.fillStyle = hull; g.fillRect(12, -3, 14, 6);
    g.fillStyle = light; g.fillRect(16, -2, 6, 4);
    g.fillStyle = '#9fd3ff'; g.fillRect(-2, -3, 8, 3);
    if (who !== 'me') { g.fillStyle = dark; g.fillRect(-20, -16, 6, 32); g.fillStyle = light; g.fillRect(-19, -14, 4, 4); g.fillRect(-19, 10, 4, 4); }
    g.restore();
  }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }
}
