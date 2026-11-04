// Animated battle stage: a low-res canvas scaled up with crisp pixels, plus an HTML overlay for HP boxes and
// damage numbers. It replays the events the engine records for each turn.
// Characters come from PixelLab-style sprite sheets (sprites/manifest.json) when present, otherwise from the
// code-drawn portraits.
import { portraitCanvas, MUZZLE } from './portraits.js';

export const W = 384, H = 216;
const MELEE = new Set(['hound', 'riot', 'loader']);
const HOVER = new Set(['probe']);
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = { amber: '#ffb35a', crit: '#fff1c9', red: '#ff5a44', ion: '#8fdcff', heal: '#9be08a', smoke: '#8b949c', spark: '#ffd27a' };

// ---------- sprite sheets ----------
const sheets = {};
export async function loadSheets(base = 'sprites/') {
  let man;
  try { const res = await fetch(base + 'manifest.json', { cache: 'no-cache' }); if (!res.ok) return 0; man = await res.json(); } catch (e) { return 0; }
  await Promise.all(Object.entries(man).map(async ([id, def]) => {
    const anims = {};
    await Promise.all(Object.entries(def.anims || {}).map(([name, a]) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => { anims[name] = { img, frames: a.frames || 1, fps: a.fps || 8, loop: !!a.loop }; ok(); };
      img.onerror = () => ok();
      img.src = `${base}${id}/${name}.png`;
    })));
    if (anims.idle) sheets[id] = { size: def.size || anims.idle.img.height, anims };
  }));
  return Object.keys(sheets).length;
}

// ---------- helpers ----------
const ease = (p) => 1 - Math.pow(1 - p, 3);
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Actor {
  constructor(id, side, boss) {
    this.id = id; this.side = side; this.boss = boss;
    this.sheet = sheets[id] || null;
    this.drawn = this.sheet ? null : portraitCanvas(id);
    this.ox = 0; this.oy = 0; this.alpha = 1; this.flash = 0; this.flashColor = '#ffffff';
    this.anim = 'idle'; this.animStart = 0; this.rest = 'idle';
  }
  get scale() {
    if (this.sheet) return this.side === 'player' ? 1.5 : 1;
    return this.side === 'player' ? 3 : this.boss ? 2.5 : 2;
  }
  get size() { return (this.sheet ? this.sheet.size : 40) * this.scale; }
  setAnim(name, t) { if (this.sheet && this.sheet.anims[name]) { this.anim = name; this.animStart = t; } }
  frame(t) {
    if (!this.sheet) return { img: this.drawn, sx: 0, sw: 40, sh: 40 };
    let a = this.sheet.anims[this.anim] || this.sheet.anims.idle;
    let f = Math.floor(((t - this.animStart) / 1000) * a.fps);
    if (a.loop) f %= a.frames;
    else if (f >= a.frames) {
      if (this.anim === 'death') f = a.frames - 1;
      else { this.anim = this.sheet.anims[this.rest] ? this.rest : 'idle'; this.animStart = t; a = this.sheet.anims[this.anim]; f = 0; }
    }
    const fw = a.img.width / a.frames;
    return { img: a.img, sx: f * fw, sw: fw, sh: a.img.height };
  }
}

export class Stage {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'stage';
    this.el.innerHTML = `<canvas width="${W}" height="${H}" aria-hidden="true"></canvas>
      <div class="hud hud-enemy"><div class="hud-row"><b class="hud-name"></b><span class="hud-tag"></span></div><div class="bar enemy"><i></i></div><span class="hud-hp num"></span></div>
      <div class="hud hud-player"><div class="hud-row"><b class="hud-name"></b><span class="hud-tag"></span></div><div class="bar"><i></i></div><span class="hud-hp num"></span></div>
      <div class="pops" aria-hidden="true"></div>
      <div class="speed" role="group" aria-label="Battle speed"><button data-speed="1">1\u00D7</button><button data-speed="2">2\u00D7</button><button data-speed="skip">Skip</button></div>`;
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.buf = document.createElement('canvas');
    this.pops = this.el.querySelector('.pops');
    this.hud = { enemy: this.el.querySelector('.hud-enemy'), player: this.el.querySelector('.hud-player') };
    this.max = { enemy: 1, player: 1 };
    this.particles = []; this.bolts = []; this.rings = []; this.projectiles = []; this.tweens = [];
    this.shakeUntil = 0; this.shakeMag = 0;
    this.bgCache = {};
    this.rain = Array.from({ length: reduceMotion ? 0 : 70 }, (_, i) => ({ x: (i * 53) % W, y: (i * 97) % H, v: 3 + (i % 4) }));
    this.enemy = null; this.player = null; this.enemyRef = null; this.runRef = null;
    this.intent = 'attack'; this.stun = 0; this.sector = 1; this.boss = false;
    this.playerShield = false; this.heavyBoost = false;
    try { this.speed = JSON.parse(localStorage.getItem('cinder-cell-speed')) || 1; } catch (e) { this.speed = 1; }
    this.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-speed]');
      if (!b) return;
      this.speed = b.dataset.speed === 'skip' ? 'skip' : +b.dataset.speed;
      try { localStorage.setItem('cinder-cell-speed', JSON.stringify(this.speed)); } catch (e) {}
      this.syncSpeed();
    });
    this.syncSpeed();
    const loop = (t) => { this.draw(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  syncSpeed() { this.el.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speed === String(this.speed)))); }
  get skip() { return this.speed === 'skip'; }
  wait(ms) { return this.skip ? Promise.resolve() : new Promise((r) => setTimeout(r, ms / this.speed)); }
  tween(ms, fn) {
    if (this.skip) { fn(1); return Promise.resolve(); }
    return new Promise((done) => this.tweens.push({ start: performance.now(), dur: ms / this.speed, fn, done }));
  }
  move(actor, x, y, ms) { const x0 = actor.ox, y0 = actor.oy; return this.tween(ms, (p) => { const e = ease(p); actor.ox = x0 + (x - x0) * e; actor.oy = y0 + (y - y0) * e; }); }

  // ---------- scene ----------
  anchor(side) { return side === 'enemy' ? { x: 290, y: 122 } : { x: 98, y: 228 }; }
  center(actor) {
    const a = this.anchor(actor.side);
    return { x: a.x + actor.ox, y: a.y + actor.oy - actor.size * (actor.side === 'player' ? 0.45 : 0.5) };
  }
  muzzle(actor) {
    const a = this.anchor(actor.side), s = actor.size, m = !actor.sheet && MUZZLE[actor.id];
    if (m) return { x: a.x + actor.ox - s / 2 + (m[0] / 40) * s, y: a.y + actor.oy - s + (m[1] / 40) * s };
    return actor.side === 'player' ? { x: a.x + actor.ox + s * 0.35, y: a.y + actor.oy - s * 0.6 } : { x: a.x + actor.ox - s * 0.3, y: a.y + actor.oy - s * 0.5 };
  }

  // Called after every render of the combat screen.
  sync({ run, enemy, player, sector, boss, theme = 'garrison', allies = 0 }) {
    const now = performance.now();
    this.sector = sector; this.boss = boss; this.theme = theme; this.allies = allies;
    if (!this.allySprite) this.allySprite = portraitCanvas('prisoner');
    this.intent = enemy.intent; this.stun = enemy.stun;
    this.max.enemy = enemy.maxHp; this.max.player = player.maxHp;
    this.setHud('enemy', enemy.name, enemy.boss ? 'BOSS' : `SECTOR ${sector}`, enemy.hp);
    this.setHud('player', player.name, `LV ${player.level}`, player.hp);
    if (this.runRef !== run || !this.player) {
      this.runRef = run;
      this.player = new Actor('player', 'player', false);
      this.player.ox = -150; this.player.alpha = 0;
      this.tween(500, (p) => { this.player.ox = -150 * (1 - ease(p)); this.player.alpha = p; });
    }
    if (this.enemyRef !== enemy) {
      this.enemyRef = enemy;
      this.enemy = new Actor(enemy.id, 'enemy', enemy.boss);
      this.enemy.ox = 140; this.enemy.alpha = 0;
      this.tween(enemy.boss ? 800 : 450, (p) => { this.enemy.ox = 140 * (1 - ease(p)); this.enemy.alpha = p; });
      if (enemy.boss) this.shake(3, 600);
    }
    this.enemy.rest = enemy.intent === 'heavy' && !enemy.stun ? 'charge' : 'idle';
    if (this.enemy.anim === 'idle' && this.enemy.rest === 'charge') this.enemy.setAnim('charge', now);
    this.playerShield = false;
  }

  setHud(side, name, tag, hp) {
    const h = this.hud[side];
    h.querySelector('.hud-name').textContent = name;
    h.querySelector('.hud-tag').textContent = tag;
    this.setHp(side, hp);
  }
  setHp(side, hp) {
    const h = this.hud[side], max = this.max[side], v = Math.max(0, hp);
    h.querySelector('.hud-hp').textContent = side === 'player' ? `${v} / ${max}` : `${v} / ${max}`;
    const bar = h.querySelector('.bar');
    bar.querySelector('i').style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
    bar.classList.toggle('low', v / max < 0.3);
  }

  popup(side, text, cls = '') {
    if (this.skip) return;
    const el = document.createElement('span');
    el.className = `pop ${cls}`;
    el.textContent = text;
    const [x, y] = side === 'enemy' ? [75, 22] : [26, 52];
    el.style.left = `${x + (Math.random() * 8 - 4)}%`; el.style.top = `${y + (Math.random() * 6 - 3)}%`;
    el.style.animationDuration = `${1000 / (this.speed || 1)}ms`;
    this.pops.append(el);
    setTimeout(() => el.remove(), 1100 / (this.speed || 1));
  }

  shake(mag, ms) { if (reduceMotion || this.skip) return; this.shakeMag = mag; this.shakeUntil = performance.now() + ms / this.speed; }
  burst(x, y, n, color, spd = 2, life = 350, grav = 0.05, size = 1) {
    if (this.skip) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, life: life * (0.6 + Math.random() * 0.6), born: performance.now(), color, g: grav, size });
    }
  }
  ring(x, y, r1, color, ms = 400, w = 2) { if (!this.skip) this.rings.push({ x, y, r1, color, born: performance.now(), life: ms / this.speed, w }); }
  bolt(from, to, color, w = 2, ms = 170) {
    if (this.skip) return Promise.resolve();
    const b = { from, to, color, w, born: performance.now(), dur: ms / this.speed };
    this.bolts.push(b);
    return this.wait(ms);
  }
  flash(actor, color = '#ffffff', ms = 140) { actor.flashColor = color; actor.flash = performance.now() + ms / (this.skip ? 1 : this.speed); }

  async hit(actor, dmg, { crit = false, note = '', heavy = false } = {}) {
    const c = this.center(actor), dir = actor.side === 'enemy' ? 1 : -1;
    actor.setAnim('hit', performance.now());
    this.flash(actor);
    this.burst(c.x, c.y, crit || heavy ? 18 : 9, crit ? C.crit : C.spark, crit ? 3 : 2);
    if (crit || heavy) this.shake(crit ? 4 : 3, 220);
    this.popup(actor.side, `\u2212${dmg}${note ? ` ${note}` : ''}`, crit ? 'crit' : heavy ? 'heavy' : '');
    if (crit) this.popup(actor.side, 'CRITICAL', 'tag');
    const x0 = actor.ox;
    await this.move(actor, x0 + 7 * dir, actor.oy - 2, 70);
    await this.move(actor, x0, actor.oy + 2, 140);
  }

  // ---------- turn playback ----------
  async play(events) {
    for (const ev of events) {
      if (!this.skip) await this.handle(ev);
      else this.apply(ev);
      await this.wait(110);
    }
    this.playerShield = false;
    if (this.player && this.player.alpha > 0) { this.player.oy = 0; }
  }
  apply(ev) { this.setHp('enemy', ev.ehp); this.setHp('player', ev.php); }

  async handle(ev) {
    const P = this.player, E = this.enemy, now = () => performance.now();
    switch (`${ev.who}:${ev.type}`) {
      case 'player:shoot': {
        P.setAnim('attack', now());
        await this.move(P, 6, -4, 70);
        const m = this.muzzle(P);
        this.burst(m.x, m.y, 6, C.amber, 1.5, 120, 0);
        await this.bolt(m, this.center(E), ev.crit ? C.crit : C.amber, ev.ready ? 3 : 2, 170);
        this.move(P, 0, 0, 140);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit, note: ev.guarded ? '(cover)' : '' });
        break;
      }
      case 'player:burst': {
        P.setAnim('attack', now());
        await this.move(P, 5, -3, 60);
        for (const h of ev.hits) {
          const m = this.muzzle(P), c = this.center(E);
          this.burst(m.x, m.y, 4, C.amber, 1.2, 100, 0);
          await this.bolt(m, { x: c.x + (Math.random() * 16 - 8), y: c.y + (Math.random() * 16 - 8) }, ev.suppress ? C.ion : C.amber, 2, 120);
          this.flash(E); this.burst(c.x, c.y, 5, C.spark, 1.5);
          this.popup('enemy', `\u2212${h.dmg}`, h.crit ? 'crit' : '');
        }
        this.setHp('enemy', ev.ehp);
        this.move(P, 0, 0, 120);
        if (ev.suppress) this.popup('enemy', 'Pinned', 'info');
        await this.wait(200);
        break;
      }
      case 'player:blast': {
        P.setAnim('attack', now());
        await this.move(P, 6, -4, 70);
        const m = this.muzzle(P), c = this.center(E);
        this.burst(m.x, m.y, 10, C.amber, 2, 140, 0);
        for (let i = 0; i < 5; i++) this.bolt(m, { x: c.x + (i - 2) * 9, y: c.y + (Math.random() * 20 - 10) }, C.amber, 1, 150);
        await this.wait(150);
        this.shake(3, 180);
        this.move(P, -4, 0, 140);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit });
        this.move(P, 0, 0, 120);
        break;
      }
      case 'player:smash': {
        P.setAnim('attack', now());
        await this.move(P, 150, -70, 200);
        const c = this.center(E);
        this.ring(c.x, c.y, 34, C.amber, 260, 3);
        this.shake(5, 240);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit, heavy: true });
        await this.move(P, 0, 0, 260);
        break;
      }
      case 'player:overload': {
        const from = this.muzzle(P), to = this.center(E);
        this.burst(from.x, from.y, 12, C.ion, 1.5, 200, 0);
        for (let k = 0; k < 3; k++) {
          const pts = [from];
          for (let i = 1; i < 6; i++) pts.push({ x: from.x + ((to.x - from.x) * i) / 6 + (Math.random() * 14 - 7), y: from.y + ((to.y - from.y) * i) / 6 + (Math.random() * 14 - 7) });
          pts.push(to);
          for (let i = 0; i < pts.length - 1; i++) this.bolt(pts[i], pts[i + 1], C.ion, 2, 60 + i * 10);
          await this.wait(70);
        }
        this.ring(to.x, to.y, 36, C.ion, 380, 2);
        this.flash(E, C.ion, 250);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { heavy: true });
        if (ev.droid) this.popup('enemy', 'Stunned', 'ion');
        break;
      }
      case 'player:intimidate': {
        const c = this.center(P);
        this.ring(c.x + 30, c.y - 20, 50, C.amber, 400, 2);
        this.popup('player', '\u201CRun.\u201D', 'level');
        await this.wait(350);
        if (!ev.ok) { this.popup('enemy', 'Shaken \u221225% ATK', 'info'); await this.move(E, 6, 0, 100); await this.move(E, 0, 0, 120); }
        break;
      }
      case 'ally:shoot': {
        const from = { x: 20 + Math.random() * 20, y: 150 }, c = this.center(E);
        this.burst(from.x, from.y, 4, C.amber, 1, 100, 0);
        await this.bolt(from, c, C.amber, 1, 160);
        this.flash(E); this.burst(c.x, c.y, 5, C.spark, 1.5);
        this.popup('enemy', `\u2212${ev.dmg}`, '');
        this.setHp('enemy', ev.ehp);
        await this.wait(120);
        break;
      }
      case 'env:vent': {
        this.popup('player', 'Vent!', 'heavy');
        for (let i = 0; i < 26; i++) setTimeout(() => this.burst(Math.random() * W, 130 + Math.random() * 80, 2, i % 3 ? '#c9c2b6' : '#ff8a3c', 0.8, 900, -0.05, 5), i * 18);
        this.shake(4, 400);
        await this.wait(300);
        if (ev.pdmg) { this.flash(P, '#ff8a3c', 250); this.popup('player', `\u2212${ev.pdmg}`, 'heavy'); } else this.popup('player', 'Behind cover', 'info');
        if (ev.edmg) { this.flash(E, '#ff8a3c', 250); this.popup('enemy', `\u2212${ev.edmg}`, 'heavy'); }
        this.setHp('player', ev.php); this.setHp('enemy', ev.ehp);
        await this.wait(450);
        break;
      }
      case 'env:sniper': {
        const target = this.center(P);
        await this.bolt({ x: W * 0.72, y: 0 }, target, C.red, 1, 140);
        if (ev.dmg) { this.flash(P, C.red, 150); this.burst(target.x, target.y, 8, C.spark, 1.5); this.popup('player', `\u2212${ev.dmg} sniper`, 'heavy'); }
        else { this.burst(target.x + 20, target.y, 8, C.spark, 1.5); this.popup('player', 'Sniper missed', 'info'); }
        this.setHp('player', ev.php);
        await this.wait(300);
        break;
      }
      case 'enemy:flee':
        this.popup('enemy', 'Fled!', 'info');
        await this.tween(500, (p) => { E.ox = 160 * ease(p); E.alpha = 1 - p; });
        break;
      case 'player:defend':
        P.setAnim('defend', now());
        this.playerShield = true;
        this.popup('player', 'Steady aim +50%', 'info');
        await this.move(P, -4, 8, 160);
        break;
      case 'player:stim': {
        const c = this.center(P);
        for (let i = 0; i < 14; i++) setTimeout(() => this.burst(c.x + (Math.random() * 40 - 20), c.y + 20, 1, C.heal, 0.8, 700, -0.04, 2), i * 30);
        this.flash(P, C.heal, 300);
        this.setHp('player', ev.php);
        this.popup('player', `+${ev.amt}`, 'heal');
        if (ev.adrenal) this.popup('player', 'Adrenal pump', 'info');
        await this.wait(450);
        break;
      }
      case 'player:thermal': {
        P.setAnim('attack', now());
        const from = this.muzzle(P), to = this.center(E);
        const pr = { x: from.x, y: from.y };
        this.projectiles.push(pr);
        await this.tween(420, (p) => { pr.x = from.x + (to.x - from.x) * p; pr.y = from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 50; });
        this.projectiles.splice(this.projectiles.indexOf(pr), 1);
        this.ring(to.x, to.y, 46, C.amber, 380, 3);
        this.burst(to.x, to.y, 40, C.amber, 3.5, 500, 0.06, 2);
        this.burst(to.x, to.y, 16, C.smoke, 1.2, 800, -0.01, 3);
        this.shake(6, 350);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { heavy: true });
        break;
      }
      case 'player:ion': {
        const c = this.center(E);
        this.ring(c.x, c.y, 40, C.ion, 450, 2);
        setTimeout(() => this.ring(c.x, c.y, 28, C.ion, 350, 1), 120);
        this.burst(c.x, c.y, 20, C.ion, 2.5, 450, 0);
        this.flash(E, C.ion, 250);
        if (ev.dmg) { this.setHp('enemy', ev.ehp); await this.hit(E, ev.dmg, { note: '' }); }
        this.popup('enemy', 'Stunned', 'ion');
        await this.wait(350);
        break;
      }
      case 'player:smoke': {
        const c = this.center(P);
        for (let i = 0; i < 6; i++) setTimeout(() => this.burst(c.x + (Math.random() * 80 - 40), c.y + 20, 4, C.smoke, 0.7, 1100, -0.02, 6), i * 70);
        await this.wait(300);
        await this.tween(500, (p) => { P.alpha = 1 - p; });
        break;
      }
      case 'player:run':
        if (ev.ok) { await this.tween(450, (p) => { P.ox = -140 * ease(p); P.alpha = 1 - p; }); }
        else { await this.move(P, -28, 4, 140); this.popup('player', 'Cut off!', 'info'); await this.move(P, 0, 0, 200); }
        break;
      case 'player:levelup':
        this.flash(P, '#f1d98a', 400);
        this.popup('player', `LEVEL ${ev.level}`, 'level');
        await this.wait(400);
        break;
      case 'player:down':
        P.setAnim('death', now());
        this.flash(P, C.red, 300);
        this.shake(5, 300);
        await this.tween(800, (p) => { P.oy = 30 * ease(p); P.alpha = 1 - p; });
        break;

      case 'enemy:attack':
      case 'enemy:heavy': {
        const heavy = ev.type === 'heavy';
        if (heavy) { this.heavyBoost = true; this.flash(E, C.red, 250); await this.wait(380); }
        E.setAnim('attack', now());
        if (MELEE.has(E.id)) {
          await this.move(E, -80, 50, heavy ? 140 : 180);
        } else {
          const m = this.muzzle(E), target = ev.ally ? { x: 30, y: 160 } : this.center(P);
          this.burst(m.x, m.y, 6, C.red, 1.5, 120, 0);
          if (heavy) { this.bolt(m, target, C.red, 4, 200); await this.wait(70); this.bolt(m, { x: target.x + 8, y: target.y - 6 }, C.red, 2, 200); await this.wait(130); }
          else await this.bolt(m, target, C.red, 2, 190);
        }
        this.heavyBoost = false;
        if (ev.ally) {
          this.popup('player', 'Ally down', 'heavy');
          this.burst(30, 160, 14, C.red, 2, 400);
          this.allies = Math.max(0, this.allies - 1);
        } else if (ev.dodged) {
          const x0 = P.ox;
          this.popup('player', 'Dodged', 'info');
          await this.move(P, x0 - 16, 0, 90); await this.move(P, x0, 0, 160);
        } else {
          if (ev.blocked) { const c = this.center(P); this.ring(c.x + 18, c.y - 10, 30, C.ion, 260, 2); }
          this.setHp('player', ev.php);
          await this.hit(P, ev.dmg, { heavy, note: ev.blocked ? '(blocked)' : '' });
        }
        if (MELEE.has(E.id)) await this.move(E, 0, 0, 220);
        break;
      }
      case 'enemy:stunned': {
        const c = this.center(E);
        this.burst(c.x, c.y - 20, 8, C.ion, 1, 400, 0);
        this.popup('enemy', 'Stunned', 'ion');
        await this.wait(350);
        break;
      }
      case 'enemy:guard':
        this.popup('enemy', 'Holds cover', 'info');
        await this.wait(300);
        break;
      case 'enemy:repair': {
        const c = this.center(E);
        E.setAnim('repair', now());
        this.burst(c.x, c.y, 14, C.ion, 1.5, 500, 0);
        this.flash(E, C.heal, 300);
        this.setHp('enemy', ev.ehp);
        this.popup('enemy', `+${ev.amt}`, 'heal');
        await this.wait(450);
        break;
      }
      case 'enemy:down': {
        E.setAnim('death', now());
        const c = this.center(E);
        if (E.id === 'probe' || E.id === 'loader' || E.id === 'sentinel' || E.id === 'crawler') this.burst(c.x, c.y, 24, C.spark, 2.5, 600, 0.08);
        await this.tween(450, (p) => { E.alpha = Math.floor(p * 9) % 2 ? 0.3 : 1; });
        await this.tween(500, (p) => { E.oy = 14 * ease(p); E.alpha = 1 - p; });
        break;
      }
    }
  }

  // ---------- drawing ----------
  background(sector, boss, theme = 'garrison') {
    const key = `${theme}-${sector}`;
    if (this.bgCache[key]) return this.bgCache[key];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rnd = seeded(sector * 977 + 31);
    const themes = [
      { sky: ['#0b0f14', '#1d2833'], glow: '232,151,58', far: '#121820', mid: '#1b232b', floor: ['#262d34', '#121519'] },
      { sky: ['#0d0f12', '#252a2f'], glow: '232,151,58', far: '#16191d', mid: '#22272c', floor: ['#2b2f33', '#141618'] },
      { sky: ['#0c1012', '#1f2a27'], glow: '210,170,80', far: '#131a18', mid: '#1d2522', floor: ['#29302c', '#121614'] },
      { sky: ['#090d15', '#1a2438'], glow: '115,182,212', far: '#10161f', mid: '#18202c', floor: ['#232a35', '#10131a'] },
      { sky: ['#120c0c', '#2e1d1a'], glow: '212,72,58', far: '#1a1212', mid: '#241918', floor: ['#2e2422', '#151010'] },
    ];
    const byMap = {
      garrison: [themes[0], themes[1], themes[0], themes[3]],
      foundry: [{ sky: ['#140b06', '#3a1a0b'], glow: '240,110,40', far: '#1c120c', mid: '#2a1a10', floor: ['#33231a', '#170f0a'] }, { sky: ['#120a06', '#33190c'], glow: '255,140,60', far: '#1a110b', mid: '#28190f', floor: ['#30211a', '#150e09'] }],
      detention: [{ sky: ['#0a0e12', '#1c2a33'], glow: '115,182,212', far: '#10171d', mid: '#1a242c', floor: ['#26313a', '#11161b'] }, { sky: ['#0b0f12', '#222b30'], glow: '180,210,220', far: '#12181c', mid: '#1d252b', floor: ['#2a3237', '#121619'] }],
      port: [{ sky: ['#060a14', '#1b2a44'], glow: '185,194,204', far: '#0f1622', mid: '#18212f', floor: ['#262e3a', '#10141b'] }, { sky: ['#07091a', '#2a2448'], glow: '210,190,255', far: '#12122a', mid: '#1c1b33', floor: ['#29283a', '#12111a'] }],
    };
    const set = byMap[theme] || byMap.garrison;
    const th = boss ? themes[4] : set[(sector - 1) % set.length];
    const horizon = 112;
    let grd = g.createLinearGradient(0, 0, 0, horizon);
    grd.addColorStop(0, th.sky[0]); grd.addColorStop(1, th.sky[1]);
    g.fillStyle = grd; g.fillRect(0, 0, W, horizon);
    const haze = g.createRadialGradient(W * 0.6, horizon, 10, W * 0.6, horizon, 220);
    haze.addColorStop(0, `rgba(${th.glow},0.22)`); haze.addColorStop(1, `rgba(${th.glow},0)`);
    g.fillStyle = haze; g.fillRect(0, 0, W, horizon + 10);
    // far skyline with lit windows, chimneys and masts
    for (let x = -4; x < W;) {
      const w = 10 + Math.floor(rnd() * 26), h = 14 + Math.floor(rnd() * 56);
      g.fillStyle = th.far; g.fillRect(x, horizon - h, w, h);
      if (rnd() < 0.25) { g.fillRect(x + 3, horizon - h - 22, 3, 22); g.fillStyle = `rgba(${th.glow},0.8)`; g.fillRect(x + 3, horizon - h - 24, 3, 2); }
      if (rnd() < 0.15) { g.fillStyle = th.far; g.fillRect(x + w / 2, horizon - h - 40, 1, 40); g.fillStyle = '#d4483a'; g.fillRect(x + w / 2, horizon - h - 41, 1, 1); }
      for (let i = 0; i < w * h * 0.02; i++) { g.fillStyle = rnd() < 0.8 ? `rgba(${th.glow},${0.4 + rnd() * 0.5})` : 'rgba(115,182,212,0.7)'; g.fillRect(x + 1 + Math.floor(rnd() * (w - 2)), horizon - h + 2 + Math.floor(rnd() * (h - 4)), 1, 1); }
      x += w + Math.floor(rnd() * 4);
    }
    if (theme === 'port') { g.fillStyle = '#1d2433'; g.fillRect(W * 0.72, 0, 3, horizon); g.fillStyle = 'rgba(210,190,255,0.5)'; for (let y = 6; y < horizon; y += 14) g.fillRect(W * 0.72 - 1, y, 5, 1); }
    if (theme === 'foundry') for (let i = 0; i < 4; i++) { const x = 40 + i * 90 + Math.floor(rnd() * 30); g.fillStyle = th.far; g.fillRect(x, horizon - 90, 8, 90); g.fillStyle = 'rgba(255,140,60,0.7)'; g.fillRect(x + 1, horizon - 92, 6, 2); }
    // perimeter wall with lamps
    g.fillStyle = th.mid; g.fillRect(0, horizon - 14, W, 16);
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 0; x < W; x += 24) g.fillRect(x, horizon - 14, 1, 16);
    for (let x = 30 + Math.floor(rnd() * 30); x < W; x += 90 + Math.floor(rnd() * 50)) {
      g.fillStyle = '#0c0e10'; g.fillRect(x, horizon - 40, 2, 28); g.fillRect(x - 3, horizon - 40, 8, 2);
      g.fillStyle = `rgba(${th.glow},1)`; g.fillRect(x - 2, horizon - 38, 6, 1);
      const cone = g.createLinearGradient(0, horizon - 38, 0, horizon + 30);
      cone.addColorStop(0, `rgba(${th.glow},0.18)`); cone.addColorStop(1, `rgba(${th.glow},0)`);
      g.fillStyle = cone; g.beginPath(); g.moveTo(x - 2, horizon - 37); g.lineTo(x + 4, horizon - 37); g.lineTo(x + 26, horizon + 30); g.lineTo(x - 24, horizon + 30); g.fill();
    }
    // floor with perspective grid
    grd = g.createLinearGradient(0, horizon, 0, H);
    grd.addColorStop(0, th.floor[0]); grd.addColorStop(1, th.floor[1]);
    g.fillStyle = grd; g.fillRect(0, horizon + 2, W, H - horizon);
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1;
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 14, horizon + 2); g.lineTo(W / 2 + i * 70, H); g.stroke(); }
    for (let y = horizon + 6, d = 4; y < H; y += d, d *= 1.35) { g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(W, Math.round(y) + 0.5); g.stroke(); }
    if (theme === 'detention') { g.fillStyle = 'rgba(0,0,0,0.5)'; for (let x = 4; x < W; x += 6) g.fillRect(x, horizon - 13, 1, 13); }
    // hazard stripe along the base of the wall
    for (let x = 0; x < W; x += 8) { g.fillStyle = (x / 8) % 2 ? '#1a1a1a' : 'rgba(207,149,40,0.55)'; g.fillRect(x, horizon + 2, 8, 2); }
    return (this.bgCache[key] = c);
  }

  pad(x, y, rx, ry) {
    const g = this.ctx;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(x, y + 3, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a434b'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a3138'; g.beginPath(); g.ellipse(x, y + 1, rx - 3, ry - 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(232,151,58,0.7)';
    for (let i = 0; i < 4; i++) { const a = Math.PI * (0.15 + i * 0.23); g.fillRect(Math.round(x + Math.cos(a) * (rx - 1)) - 2, Math.round(y + Math.sin(a) * (ry - 1)), 4, 1); }
  }

  drawActor(actor, t) {
    if (!actor || actor.alpha <= 0) return;
    const g = this.ctx, a = this.anchor(actor.side), f = actor.frame(t), s = actor.scale;
    const w = Math.round(f.sw * s), h = Math.round(f.sh * s);
    let bob = 0;
    if (!reduceMotion) bob = actor.side === 'enemy' ? Math.sin(t / (HOVER.has(actor.id) ? 380 : 650)) * (HOVER.has(actor.id) ? 3 : 1) : Math.sin(t / 720) * 1.2;
    const x = Math.round(a.x + actor.ox - w / 2), y = Math.round(a.y + actor.oy - h + bob);
    g.globalAlpha = actor.alpha;
    if (actor.flash > t) {
      const b = this.buf; b.width = f.sw; b.height = f.sh;
      const bg = b.getContext('2d');
      bg.drawImage(f.img, f.sx, 0, f.sw, f.sh, 0, 0, f.sw, f.sh);
      bg.globalCompositeOperation = 'source-atop'; bg.globalAlpha = 0.85; bg.fillStyle = actor.flashColor; bg.fillRect(0, 0, f.sw, f.sh);
      g.drawImage(b, 0, 0, f.sw, f.sh, x, y, w, h);
    } else {
      g.drawImage(f.img, f.sx, 0, f.sw, f.sh, x, y, w, h);
    }
    g.globalAlpha = 1;
  }

  draw(t) {
    if (!this.el.isConnected || !this.enemy) return;
    for (const tw of [...this.tweens]) {
      const p = Math.min(1, (t - tw.start) / tw.dur);
      tw.fn(p);
      if (p >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done(); }
    }
    const g = this.ctx;
    g.save();
    if (t < this.shakeUntil) g.translate(Math.round((Math.random() * 2 - 1) * this.shakeMag), Math.round((Math.random() * 2 - 1) * this.shakeMag));
    g.drawImage(this.background(this.sector, this.boss, this.theme), 0, 0);
    if (this.boss && !reduceMotion) { g.fillStyle = `rgba(212,72,58,${0.06 + 0.06 * Math.sin(t / 300)})`; g.fillRect(0, 0, W, H); }
    g.fillStyle = this.theme === 'foundry' ? 'rgba(255,150,70,0.35)' : 'rgba(160,180,200,0.22)';
    for (const d of this.rain) { d.y += d.v; d.x -= d.v * 0.25; if (d.y > H) { d.y = -6; d.x = Math.random() * (W + 40); } g.fillRect(Math.round(d.x), Math.round(d.y), 1, 4); }

    const ea = this.anchor('enemy');
    this.pad(ea.x, ea.y + 1, 58, 11);
    const E = this.enemy, ec = this.center(E);
    if ((this.intent === 'heavy' && !this.stun) || this.heavyBoost) {
      const pulse = this.heavyBoost ? 0.55 : 0.25 + 0.12 * Math.sin(t / 160);
      const rg = g.createRadialGradient(ec.x, ec.y, 4, ec.x, ec.y, E.size * 0.7);
      rg.addColorStop(0, `rgba(212,72,58,${pulse})`); rg.addColorStop(1, 'rgba(212,72,58,0)');
      g.fillStyle = rg; g.fillRect(ec.x - E.size, ec.y - E.size, E.size * 2, E.size * 2);
    }
    this.drawActor(E, t);
    if (this.intent === 'guard' && !this.stun && E.alpha > 0.5) {
      g.strokeStyle = `rgba(190,200,210,${0.35 + 0.15 * Math.sin(t / 240)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(ec.x - 8, ec.y + 6, E.size * 0.55, E.size * 0.6, 0, Math.PI * 0.6, Math.PI * 1.25); g.stroke();
    }
    if (this.stun > 0 && E.alpha > 0.5) {
      for (let i = 0; i < 3; i++) { const a = t / 300 + (i * Math.PI * 2) / 3; g.fillStyle = C.ion; g.fillRect(Math.round(ec.x + Math.cos(a) * 16), Math.round(ec.y - E.size * 0.45 + Math.sin(a) * 4), 2, 2); }
    }

    const pa = this.anchor('player');
    this.pad(pa.x, pa.y - 16, 84, 16);
    if (this.allies && this.allySprite && this.player && this.player.alpha > 0) {
      for (let i = 0; i < this.allies; i++) {
        const x = 2 + i * 34, y = 216 - 70 + Math.round(Math.sin(t / 650 + i) * 1);
        g.globalAlpha = this.player.alpha; g.drawImage(this.allySprite, 0, 0, 40, 40, x, y, 70, 70); g.globalAlpha = 1;
      }
    }
    this.drawActor(this.player, t);
    if (this.playerShield && this.player) {
      const pc = this.center(this.player);
      g.strokeStyle = `rgba(143,220,255,${0.45 + 0.2 * Math.sin(t / 90)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(pc.x + 10, pc.y, 56, 50, 0, -Math.PI * 0.55, Math.PI * 0.05); g.stroke();
    }

    for (const b of [...this.bolts]) {
      const p = (t - b.born) / b.dur;
      if (p >= 1) { this.bolts.splice(this.bolts.indexOf(b), 1); continue; }
      const hx = b.from.x + (b.to.x - b.from.x) * p, hy = b.from.y + (b.to.y - b.from.y) * p;
      const len = Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y), tl = Math.min(22, len * p) / len;
      const tx = hx - (b.to.x - b.from.x) * tl, ty = hy - (b.to.y - b.from.y) * tl;
      g.lineCap = 'round';
      g.strokeStyle = b.color; g.globalAlpha = 0.35; g.lineWidth = b.w + 3; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      g.globalAlpha = 1; g.lineWidth = b.w; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo((tx + hx) / 2, (ty + hy) / 2); g.lineTo(hx, hy); g.stroke();
    }
    for (const pr of this.projectiles) { g.fillStyle = '#c39b45'; g.fillRect(Math.round(pr.x) - 2, Math.round(pr.y) - 2, 4, 4); g.fillStyle = '#ff5a44'; g.fillRect(Math.round(pr.x), Math.round(pr.y) - 2, 1, 1); }
    for (const r of [...this.rings]) {
      const p = (t - r.born) / r.life;
      if (p >= 1) { this.rings.splice(this.rings.indexOf(r), 1); continue; }
      g.strokeStyle = r.color; g.globalAlpha = 1 - p; g.lineWidth = r.w; g.beginPath(); g.ellipse(r.x, r.y, r.r1 * ease(p), r.r1 * ease(p) * 0.8, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    for (const pt of [...this.particles]) {
      const age = t - pt.born;
      if (age > pt.life) { this.particles.splice(this.particles.indexOf(pt), 1); continue; }
      pt.vy += pt.g; pt.x += pt.vx; pt.y += pt.vy;
      g.globalAlpha = 1 - age / pt.life; g.fillStyle = pt.color;
      const sz = pt.size > 3 ? pt.size * (1 + age / pt.life) : pt.size;
      g.fillRect(Math.round(pt.x - sz / 2), Math.round(pt.y - sz / 2), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
    }
    g.globalAlpha = 1;
    g.restore();
  }
}
