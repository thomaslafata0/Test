// Animated battle stage: a low-res canvas scaled up with crisp pixels, plus an HTML overlay for HP boxes and
// damage numbers. It replays the events the engine records for each turn.
// Characters come from PixelLab-style sprite sheets (sprites/manifest.json) when present, otherwise from the
// code-drawn portraits.
import { portraitCanvas, MUZZLE } from './portraits.js';
import { play } from './audio.js';

export const W = 384, H = 216;
const MELEE = new Set(['hound', 'riot', 'loader', 'brask', 'foreman', 'slagger', 'jailer', 'sedation']);
const HOVER = new Set(['probe']);
const osCalm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let reduceMotion = osCalm;
export const setCalm = (on) => { reduceMotion = osCalm || on; };
const C = { amber: '#ffb35a', crit: '#fff1c9', red: '#ff5a44', ion: '#8fdcff', heal: '#9be08a', smoke: '#8b949c', spark: '#ffd27a' };

// ---------- sprite sheets ----------
const sheets = {};
// Composited look sheets (look.js) for the player and the co-op partner; they replace sheets.player per side.
const lookSheets = { player: null, partner: null };
export function setLookSheets(player, partner) { lookSheets.player = player || null; lookSheets.partner = partner || null; }
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

// First idle frame of a character's sheet, cropped to the figure, as a data URL (for victory/death screens).
const stills = {};
export function sheetStill(id) {
  if (stills[id] !== undefined) return stills[id];
  const sh = sheets[id];
  if (!sh || !sh.anims.idle) return null;
  const a = sh.anims.idle, fw = a.img.width / a.frames, fh = a.img.height;
  const c = document.createElement('canvas'); c.width = fw; c.height = fh;
  const g = c.getContext('2d'); g.drawImage(a.img, 0, 0, fw, fh, 0, 0, fw, fh);
  const px = g.getImageData(0, 0, fw, fh).data;
  let x0 = fw, y0 = fh, x1 = 0, y1 = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (px[(y * fw + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) return (stills[id] = null);
  const side = Math.max(x1 - x0, y1 - y0) + 4, out = document.createElement('canvas');
  out.width = out.height = side;
  out.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.round((side - (x1 - x0)) / 2), Math.round((side - (y1 - y0)) / 2), x1 - x0 + 1, y1 - y0 + 1);
  return (stills[id] = out.toDataURL('image/png'));
}

// ---------- helpers ----------
const ease = (p) => 1 - Math.pow(1 - p, 3);
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Actor {
  constructor(id, side, boss) {
    this.id = id; this.side = side; this.boss = boss;
    this.sheet = (id === 'player' && lookSheets[side === 'partner' ? 'partner' : 'player']) || sheets[id] || null;
    this.drawn = this.sheet ? null : portraitCanvas(id);
    this.ox = 0; this.oy = 0; this.alpha = 1; this.flash = 0; this.flashColor = '#ffffff';
    this.anim = 'idle'; this.animStart = 0; this.rest = 'idle';
  }
  get scale() {
    // Sheet characters fill about half their frame, so they're drawn larger than the frame size.
    if (this.sheet) return this.side === 'player' ? 2 : this.side === 'partner' ? 1.7 : this.side === 'ally' ? 1.1 : this.sheet.size >= 128 ? 1.1 : 1.6;
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
      <div class="hud hud-enemy"><div class="hud-row"><b class="hud-name"></b><span class="hud-tag"></span></div><div class="bar enemy"><i></i></div><div class="hud-row"><span class="hud-st"></span><span class="hud-hp num"></span></div></div>
      <div class="hud hud-player"><div class="hud-row"><b class="hud-name"></b><span class="hud-tag"></span></div><div class="bar"><i></i></div><div class="hud-row"><span class="hud-st"></span><span class="hud-hp num"></span></div></div>
      <div class="cine" hidden><i class="bar-top"></i><i class="bar-bot"></i><div class="cine-card"><span class="cine-label"></span><b class="cine-name"></b><span class="cine-epithet"></span></div><span class="cine-skip">Click to skip</span></div>
      <div class="pops" aria-hidden="true"></div>
      <div class="speed" role="group" aria-label="Battle mode"><button data-speed="manual" title="You choose every move">Manual</button><button data-speed="auto1" title="Auto battle: the operative fights with a fixed routine. Tap Manual to take over.">Auto 1\u00D7</button><button data-speed="auto2" title="Auto battle at double speed.">Auto 2\u00D7</button></div>`;
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
    this.rain = Array.from({ length: 70 }, (_, i) => ({ x: (i * 53) % W, y: (i * 97) % H, v: 3 + (i % 4) }));
    this.enemy = null; this.player = null; this.enemyRef = null; this.runRef = null;
    this.intent = 'attack'; this.stun = 0; this.sector = 1; this.boss = false;
    this.playerShield = false; this.heavyBoost = false;
    // Battle mode: 'manual', 'auto1' (auto battle) or 'auto2' (auto battle, animations at double speed).
    try { this.mode = JSON.parse(localStorage.getItem('cinder-cell-speed')); } catch (e) { this.mode = 'manual'; }
    if (!['manual', 'auto1', 'auto2'].includes(this.mode)) this.mode = this.mode === 'auto' ? 'auto1' : 'manual';
    this.auto = this.mode !== 'manual'; this.speed = this.mode === 'auto2' ? 2 : 1;
    this.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-speed]');
      if (!b) return;
      this.setMode(b.dataset.speed);
    });
    this.syncSpeed();
    const loop = (t) => { try { this.draw(performance.now()); } catch (e) { console.warn('stage draw', e); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setMode(m) {
    this.mode = m; this.auto = m !== 'manual'; this.applySpeed();
    try { localStorage.setItem('cinder-cell-speed', JSON.stringify(m)); } catch (e) {}
    this.syncSpeed();
    this.el.dispatchEvent(new CustomEvent('automode', { bubbles: true, detail: this.auto }));
  }
  cycleMode() { this.setMode({ manual: 'auto1', auto1: 'auto2', auto2: 'manual' }[this.mode]); }
  setFast(on) { this.fast = on; this.applySpeed(); }
  applySpeed() { this.speed = this.mode === 'auto2' ? 2 : this.fast ? 1.6 : 1; }
  syncSpeed() { this.el.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speed === this.mode))); }
  get skip() { return false; }
  wait(ms) { return this.skip ? Promise.resolve() : new Promise((r) => setTimeout(r, ms / this.speed)); }
  tween(ms, fn) {
    if (this.skip) { fn(1); return Promise.resolve(); }
    return new Promise((done) => this.tweens.push({ start: performance.now(), dur: ms / this.speed, fn, done }));
  }
  move(actor, x, y, ms) { const x0 = actor.ox, y0 = actor.oy; return this.tween(ms, (p) => { const e = ease(p); actor.ox = x0 + (x - x0) * e; actor.oy = y0 + (y - y0) * e; }); }

  // ---------- scene ----------
  // Drawn busts sit on the pad cut off at the bottom; full-body sheets stand on it.
  anchor(side, actor) {
    const sheet = actor ? actor.sheet : (side === 'enemy' ? this.enemy : this.player)?.sheet;
    if (side === 'enemy') return { x: 290, y: sheet ? 126 : 122 };
    if (side === 'partner') return { x: 38, y: 198 };
    return sheet ? { x: 104, y: 206 } : { x: 98, y: 228 };
  }
  // Pixels from the frame's bottom edge to the character's feet (8px in the source sheet).
  footPad(actor) { return actor.sheet ? 8 * actor.scale : 0; }
  center(actor) {
    const a = this.anchor(actor.side, actor);
    if (actor.sheet) return { x: a.x + actor.ox, y: a.y + actor.oy - actor.size * 0.3 };
    return { x: a.x + actor.ox, y: a.y + actor.oy - actor.size * (actor.side === 'player' ? 0.45 : 0.5) };
  }
  muzzle(actor) {
    const a = this.anchor(actor.side, actor), s = actor.size, m = !actor.sheet && MUZZLE[actor.id];
    if (actor.sheet && actor.sheet.look && actor.sheet.anims.attack && actor.sheet.anims.attack.tip) { const tip = actor.sheet.anims.attack.tip[0] || actor.sheet.anims.attack.tip; if (tip && tip.length === 2) return { x: a.x + actor.ox - s / 2 + (tip[0] / 96) * s, y: a.y + actor.oy - s + (tip[1] / 96) * s + this.footPad(actor) }; }
    if (actor.sheet) return actor.side === 'player' ? { x: a.x + actor.ox + s * 0.18, y: a.y + actor.oy - s * 0.36 } : { x: a.x + actor.ox - s * 0.18, y: a.y + actor.oy - s * 0.36 };
    if (m) return { x: a.x + actor.ox - s / 2 + (m[0] / 40) * s, y: a.y + actor.oy - s + (m[1] / 40) * s };
    return actor.side === 'player' ? { x: a.x + actor.ox + s * 0.35, y: a.y + actor.oy - s * 0.6 } : { x: a.x + actor.ox - s * 0.3, y: a.y + actor.oy - s * 0.5 };
  }

  // Called after every render of the combat screen.
  sync({ run, enemy, player, partner = null, sector, boss, theme = 'garrison', allies = 0, pst = {}, est = {}, affix = null, quirk = null, label = '' }) {
    const now = performance.now();
    // Co-op: the friend's operative stands at your shoulder. partner = { idx, name, hp, maxHp, acting }.
    this.partnerInfo = partner;
    if (partner && !this.partner) this.partner = new Actor('player', 'partner', false);
    if (!partner) this.partner = null;
    this.sector = sector; this.boss = boss; this.theme = theme; this.allies = allies;
    if (!this.allySprite) this.allySprite = portraitCanvas('prisoner');
    if (sheets.prisoner) {
      this.allyActors = this.allyActors || [];
      while (this.allyActors.length < allies) this.allyActors.push(new Actor('prisoner', 'ally', false));
      this.allyActors.length = allies;
    }
    this.intent = enemy.intent; this.stun = enemy.stun;
    this.max.enemy = enemy.maxHp; this.max.player = player.maxHp;
    this.setHud('enemy', enemy.name, enemy.boss ? (enemy.phase2 ? 'ENRAGED' : 'BOSS') : enemy.elite ? 'ELITE' : `SECTOR ${sector}`, enemy.hp);
    this.setHud('player', player.name, `LV ${player.level}`, player.hp);
    this.setStatuses('player', pst);
    this.setStatuses('enemy', est, affix, quirk);
    this.label = label;
    let isNewBoss = false;
    if (this.runRef !== run || !this.player) {
      this.runRef = run;
      this.player = new Actor('player', 'player', false);
      this.player.ox = -150; this.player.alpha = 0;
      this.tween(500, (p) => { this.player.ox = -150 * (1 - ease(p)); this.player.alpha = p; });
    }
    // Co-op: a downed operative stays on the floor until they're back up.
    for (const [a, info] of [[this.player, player], [this.partner, partner]]) {
      if (!a || !info) continue;
      if (info.down && a.anim !== 'death') a.setAnim('death', now - 100000);
      else if (!info.down && a.anim === 'death' && info.hp > 0) a.setAnim('idle', now);
    }
    if (this.enemyRef !== enemy) {
      this.enemyRef = enemy;
      this.enemy = new Actor(enemy.id, 'enemy', enemy.boss);
      this.enemy.ox = 140; this.enemy.alpha = 0;
      this.tween(enemy.boss ? 800 : 450, (p) => { this.enemy.ox = 140 * (1 - ease(p)); this.enemy.alpha = p; });
      if (enemy.boss) { isNewBoss = true; this.enemy.alpha = 0; this.enemy.ox = 0; }
      else { play('door'); if (quirk) setTimeout(() => this.popup('enemy', quirk.toUpperCase(), 'quirk'), 450 / (this.speed || 1)); }
    }
    this.enemy.rest = enemy.intent === 'heavy' && !enemy.stun ? 'charge' : 'idle';
    if (this.enemy.anim === 'idle' && this.enemy.rest === 'charge') this.enemy.setAnim('charge', now);
    this.playerShield = false;
    return { isNewBoss };
  }

  setStatuses(side, st = {}, affix = null, quirk = null) {
    const el = this.hud[side].querySelector('.hud-st');
    const names = { bleed: 'BLEED', burn: 'BURN', shaken: 'SHAKEN', exposed: 'EXPOSED' };
    el.innerHTML = (quirk ? `<i class="st quirk" data-st="quirk">${quirk.toUpperCase()}</i>` : '') + (affix ? `<i class="st affix" data-st="affix">${affix.toUpperCase()}</i>` : '') +
      Object.entries(st).filter(([, n]) => n > 0).map(([k, n]) => `<i class="st st-${k}" data-st="${k}">${names[k] || k} ${n}</i>`).join('');
  }

  // Cinematic boss entrance: letterbox, silhouette, reveal, name card. Click skips.
  bossIntro({ name, epithet, label }) {
    const E = this.enemy, cine = this.el.querySelector('.cine');
    if (!E) return Promise.resolve();
    if (this.skip) { E.alpha = 1; E.ox = 0; return Promise.resolve(); }
    return new Promise((done) => {
      let finished = false;
      const timers = [];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms / this.speed));
      const finish = () => {
        if (finished) return; finished = true;
        timers.forEach(clearTimeout);
        cine.hidden = true; cine.className = 'cine';
        this.dim = 0; E.alpha = 1; E.ox = 0; E.oy = 0; E.flash = 0;
        this.el.removeEventListener('click', finish);
        done();
      };
      cine.querySelector('.cine-label').textContent = label;
      cine.querySelector('.cine-name').textContent = name;
      cine.querySelector('.cine-epithet').textContent = epithet || '';
      cine.hidden = false; cine.className = 'cine';
      void cine.offsetWidth;
      cine.classList.add('on');
      this.dim = 0.75;
      E.alpha = 1; E.oy = -70; E.ox = 0;
      this.flash(E, '#000000', 1500);
      play('bossSting');
      this.tween(420, (p) => { E.oy = -70 * (1 - p * p); });
      at(420, () => { this.shake(6, 500); const c = this.center(E); this.burst(c.x, c.y + 40, 30, '#8b949c', 2.5, 700, 0.02, 3); });
      at(1300, () => { this.flash(E, '#ffffff', 160); this.tween(500, (p) => { this.dim = 0.75 * (1 - p) + 0.25 * p; }); });
      at(1500, () => { cine.classList.add('card'); play('bossName'); });
      at(3000, () => { cine.classList.add('out'); this.tween(400, (p) => { this.dim = 0.25 * (1 - p); }); });
      at(3450, finish);
      setTimeout(() => this.el.addEventListener('click', finish), 250);
    });
  }

  setHud(side, name, tag, hp) {
    const h = this.hud[side];
    const nm = h.querySelector('.hud-name'); nm.textContent = name; nm.classList.toggle('long', name.length > 16);
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
    const [x, y] = side === 'enemy' ? [75, 22] : side === 'partner' ? [10, 48] : [26, 52];
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
    play(crit ? 'crit' : heavy ? 'heavy' : actor.side === 'player' ? 'hurt' : 'hit');
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
    // In co-op, events tagged with the friend's index animate the friend's sprite.
    const P = this.partner && this.partnerInfo && ev.actor === this.partnerInfo.idx ? this.partner : this.player, E = this.enemy, now = () => performance.now();
    if (ev.type === 'downed') { P.setAnim('death', now()); play('hurt'); this.popup(P === this.partner ? 'partner' : 'player', 'DOWN', 'crit'); await this.wait(500); return; }
    if (ev.type === 'revived') { P.setAnim('idle', now()); play('heal'); this.popup(P === this.partner ? 'partner' : 'player', 'Back up', 'info'); await this.wait(350); return; }
    if (ev.type === 'handoff' || ev.type === 'target') { if (ev.type === 'target' && this.partnerInfo) this.popup(ev.actor === this.partnerInfo.idx ? 'partner' : 'player', 'Targeted', 'info'); return; }
    const START = { 'player:shoot': 'shot', 'player:burst': 'burst', 'player:blast': 'blast', 'player:smash': 'whoosh', 'player:strike': 'whoosh', 'player:overload': 'zap',
      'player:intimidate': 'status', 'player:defend': 'shield', 'player:stim': 'heal', 'player:thermal': 'throw', 'player:ion': 'zap',
      'player:smoke': 'smoke', 'player:run': 'whoosh', 'player:levelup': 'levelup', 'player:down': 'death', 'ally:shoot': 'shot',
      'enemy:repair': 'repair', 'enemy:down': 'enemyDown', 'enemy:flee': 'whoosh', 'enemy:stunned': 'zap', 'env:vent': 'vent', 'env:sniper': 'sniper',
      'enemy:phase': 'enrage', 'player:deadman': 'heal', 'env:explode': 'explosion' };
    const k = `${ev.who}:${ev.type}`;
    if (START[k]) play(START[k]);
    if (k === 'enemy:attack' || k === 'enemy:heavy') play(ev.type === 'heavy' ? 'heavyCharge' : MELEE.has(E.id) ? 'whoosh' : 'enemyShot');
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
        P.setAnim(P.sheet && P.sheet.anims.attackM ? 'attackM' : 'attack', now());
        await this.move(P, 150, -70, 200);
        const c = this.center(E);
        this.ring(c.x, c.y, 34, C.amber, 260, 3);
        this.shake(5, 240);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit, heavy: true });
        await this.move(P, 0, 0, 260);
        break;
      }
      case 'player:strike': {
        P.setAnim(P.sheet && P.sheet.anims.attackM ? 'attackM' : 'attack', now());
        await this.move(P, 130, -60, 170);
        const c = this.center(E);
        this.ring(c.x, c.y, 18, ev.crit ? C.crit : C.amber, 180, 2);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit });
        await this.move(P, 0, 0, 220);
        break;
      }
      case 'enemy:counter': {
        E.setAnim('attack', now());
        this.flash(E, C.red, 180);
        this.popup('enemy', ev.text, 'quirk');
        this.setHp('player', ev.php);
        if (ev.dmg) await this.hit(P, ev.dmg, {});
        else { this.flash(P); await this.wait(200); }
        for (const k of ev.statuses || []) this.popup('player', k.toUpperCase(), `st-${k}`);
        await this.wait(150);
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
        const ally = (this.allyActors || [])[Math.floor(Math.random() * (this.allyActors || []).length)];
        if (ally) ally.setAnim('attack', now());
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
      case 'enemy:quirk':
        play('status');
        this.flash(E, '#e6d36a', 250);
        this.popup('enemy', ev.text, 'quirk');
        await this.move(E, 6, -4, 120); await this.move(E, 0, 0, 160);
        await this.wait(250);
        break;
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
        play('explosion');
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
          // It takes a few hits to put a prisoner down: only the last one removes them.
          this.popup('player', ev.allyDown ? 'Ally down' : 'Ally hit', ev.allyDown ? 'heavy' : 'info');
          this.burst(30, 160, ev.allyDown ? 14 : 6, C.red, 2, 400);
          if (ev.allyDown) {
            this.allies = Math.max(0, this.allies - 1);
            if (this.allyActors && this.allyActors.length) this.allyActors.pop();
          }
        } else if (ev.dodged) {
          const x0 = P.ox;
          this.popup(ev.missed ? 'enemy' : 'player', ev.missed ? 'Missed!' : 'Dodged', ev.missed ? 'quirk' : 'info'); play('dodge');
          await this.move(P, x0 - 16, 0, 90); await this.move(P, x0, 0, 160);
        } else {
          if (ev.blocked) { const c = this.center(P); this.ring(c.x + 18, c.y - 10, 30, C.ion, 260, 2); play('block'); }
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
      case 'enemy:special': {
        const col = (ev.statuses || []).includes('burn') ? '#ff8a3c' : (ev.statuses || []).includes('bleed') ? C.red : '#e6d36a';
        this.flash(E, col, 300);
        this.popup('enemy', ev.name, 'info');
        play('heavyCharge');
        await this.wait(380);
        E.setAnim('attack', now());
        if (MELEE.has(E.id)) { play('whoosh'); await this.move(E, -80, 50, 170); }
        else { const m = this.muzzle(E); play('enemyShot'); this.burst(m.x, m.y, 8, col, 1.5, 150, 0); await this.bolt(m, this.center(P), col, 3, 200); }
        if (ev.blocked) { const c = this.center(P); this.ring(c.x + 18, c.y - 10, 30, C.ion, 260, 2); play('block'); this.popup('player', 'Blocked', 'info'); }
        if (ev.dmg) { this.setHp('player', ev.php); await this.hit(P, ev.dmg, { note: ev.blocked ? '(blocked)' : '' }); }
        for (const st of ev.statuses || []) { play('status'); this.popup('player', st.toUpperCase(), `st-${st}`); this.flash(P, col, 300); }
        if (MELEE.has(E.id)) await this.move(E, 0, 0, 220);
        await this.wait(200);
        break;
      }
      case 'enemy:phase': {
        this.flash(E, C.red, 900);
        this.shake(6, 600);
        this.ring(this.center(E).x, this.center(E).y, 60, C.red, 600, 3);
        this.popup('enemy', 'ENRAGED', 'heavy');
        this.tween(700, (p) => { this.dim = 0.4 * Math.sin(p * Math.PI); });
        await this.wait(900);
        break;
      }
      case 'status:tick':
      case 'status:undefined': {
        if (ev.pdmg) { play('bleed'); this.flash(P, C.red, 200); this.popup('player', `\u2212${ev.pdmg}`, 'st-bleed'); this.setHp('player', ev.php); }
        if (ev.edmg) { play('burn'); this.flash(E, '#ff8a3c', 200); this.popup('enemy', `\u2212${ev.edmg}`, 'st-burn'); this.setHp('enemy', ev.ehp); }
        if (ev.regen) { play('repair'); this.popup('enemy', `+${ev.regen}`, 'heal'); this.setHp('enemy', ev.ehp); }
        await this.wait(350);
        break;
      }
      case 'player:deadman':
        this.flash(P, '#ffffff', 500);
        this.popup('player', 'NOT TODAY', 'level');
        this.setHp('player', ev.php);
        await this.wait(400);
        break;
      case 'env:explode': {
        const c = this.center(E);
        this.ring(c.x, c.y, 60, '#ff8a3c', 450, 3);
        this.burst(c.x, c.y, 40, '#ff8a3c', 3.5, 600, 0.05, 2);
        this.shake(7, 400);
        if (ev.pdmg) { this.flash(P, '#ff8a3c', 250); this.popup('player', `\u2212${ev.pdmg}`, 'heavy'); }
        else this.popup('player', 'Behind cover', 'info');
        this.setHp('player', ev.php);
        await this.wait(500);
        break;
      }
      case 'enemy:down': {
        E.setAnim('death', now());
        const c = this.center(E);
        if (E.id === 'probe' || E.id === 'loader' || E.id === 'sentinel' || E.id === 'crawler') this.burst(c.x, c.y, 24, C.spark, 2.5, 600, 0.08);
        if (ev.boss) { this.shake(6, 900); this.burst(c.x, c.y, 50, C.spark, 3, 900, 0.05, 2); play('explosion'); }
        await this.tween(ev.boss ? 900 : 450, (p) => { E.alpha = Math.floor(p * 9) % 2 ? 0.3 : 1; });
        await this.tween(500, (p) => { E.oy = 14 * ease(p); E.alpha = 1 - p; });
        break;
      }
    }
  }

  // ---------- drawing ----------
  background(sector, boss, theme = 'garrison') {
    const key = `${theme}-${sector}-${boss ? 1 : 0}`;
    if (this.bgCache[key]) return this.bgCache[key];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rnd = seeded(sector * 977 + 31), Y = 112, band = Math.min(2, Math.floor((sector - 1) / 5));
    const rect = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const grad = (a, b, y0, y1) => { const d = g.createLinearGradient(0, y0, 0, y1); d.addColorStop(0, a); d.addColorStop(1, b); return d; };
    const sky = (a, b, h = Y + 2) => { g.fillStyle = grad(a, b, 0, h); g.fillRect(0, 0, W, h); };
    const glow = (x, y, r, rgb, al) => { const d = g.createRadialGradient(x, y, 1, x, y, r); d.addColorStop(0, `rgba(${rgb},${al})`); d.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = d; g.fillRect(x - r, y - r, r * 2, r * 2); };
    const cone = (x, y, x2, y2, spread, rgb, al) => { g.fillStyle = `rgba(${rgb},${al})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x2 - spread, y2); g.lineTo(x2 + spread, y2); g.fill(); };
    const floor = (a, b) => { g.fillStyle = grad(a, b, Y, H); g.fillRect(0, Y + 2, W, H - Y); };
    const perspective = (col = 'rgba(0,0,0,0.28)', step = 14) => { g.strokeStyle = col; g.lineWidth = 1; for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(W / 2 + i * step, Y + 2); g.lineTo(W / 2 + i * step * 5, H); g.stroke(); } for (let y = Y + 6, d = 4; y < H; y += d, d *= 1.35) { g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(W, Math.round(y) + 0.5); g.stroke(); } };
    const skyline = (far, lit, maxH = 60) => { for (let x = -4; x < W;) { const w = 10 + Math.floor(rnd() * 26), h = 14 + Math.floor(rnd() * maxH); rect(far, x, Y - h, w, h); for (let i = 0; i < w * h * 0.02; i++) rect(`rgba(${lit},${0.35 + rnd() * 0.5})`, x + 1 + Math.floor(rnd() * Math.max(1, w - 2)), Y - h + 2 + Math.floor(rnd() * Math.max(1, h - 4)), 1, 1); x += w + Math.floor(rnd() * 4); } };
    const bars = (x, y, w, h, col, gap = 4) => { for (let bx = x; bx < x + w; bx += gap) rect(col, bx, y, 1, h); rect(col, x, y, w, 2); rect(col, x, y + h - 2, w, 2); };
    const chain = (x, y0, y1, col) => { for (let y = y0; y < y1; y += 4) rect(col, x, y, 2, 3); };
    const banner = (x, y, w, h, col, mark) => { rect(col, x, y, w, h); g.fillStyle = col; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w / 2, y + h + 6); g.lineTo(x + w, y + h); g.fill(); rect(mark, x + w / 2 - 3, y + 5, 6, 10); rect(mark, x + w / 2 - 6, y + 8, 12, 2); };
    let indoor = false;
    const scenes = {
      garrison: [
        () => { // the outer yard: city behind the wall, watchtowers and searchlights
          sky('#0b0f14', '#1d2833'); glow(W * 0.6, Y, 220, '232,151,58', 0.2); skyline('#121820', '232,151,58');
          for (const x of [50 + rnd() * 30, 280 + rnd() * 40]) { rect('#0e1216', x, Y - 62, 5, 62); rect('#0e1216', x + 22, Y - 62, 5, 62); rect('#171d23', x - 5, Y - 78, 42, 18); rect('#232b33', x - 8, Y - 80, 48, 3); rect('rgba(232,190,120,0.8)', x + 2, Y - 74, 24, 6); }
          cone(70, Y - 70, 150 + rnd() * 90, Y + 40, 30, '232,210,150', 0.07); cone(300, Y - 70, 180 + rnd() * 60, Y + 40, 30, '232,210,150', 0.07);
          rect('#1b232b', 0, Y - 14, W, 16); for (let x = 0; x < W; x += 24) rect('rgba(0,0,0,0.35)', x, Y - 14, 1, 16);
          g.strokeStyle = '#4a545c'; for (let x = 0; x < W; x += 8) { g.beginPath(); g.arc(x + 4, Y - 16, 3, 0, Math.PI * 2); g.stroke(); }
          floor('#262d34', '#121519'); perspective(); for (let x = 0; x < W; x += 8) rect((x / 8) % 2 ? '#1a1a1a' : 'rgba(207,149,40,0.55)', x, Y + 2, 8, 2);
        },
        () => { // barracks: lockers, strip lights, the flag
          indoor = true; sky('#1a2024', '#2a3035'); rect('#12161a', 0, 0, W, 16); for (let x = 16; x < W; x += 74) { rect('rgba(225,235,235,0.9)', x, 16, 42, 2); cone(x + 21, 18, x + 21, Y + 40, 46, '220,235,235', 0.06); }
          for (let x = 0; x < W; x += 22) { rect('#39454c', x + 1, 48, 20, Y - 48); rect('#2b353b', x + 1, 48, 1, Y - 48); rect('#1c2328', x + 16, 74, 2, 8); for (let v = 0; v < 3; v++) rect('#1c2328', x + 5, 53 + v * 3, 8, 1); }
          banner(160 + rnd() * 40, 20, 34, 34, '#7a1f1a', '#d8b04a'); rect('#1b2126', 0, Y - 6, W, 8);
          floor('#3a4044', '#1b1f22'); perspective('rgba(0,0,0,0.22)', 18);
        },
        () => { // command deck: tall windows over the city, and screens
          indoor = true; sky('#0a1018', '#142133'); skyline('#0e1826', '115,182,212', 44);
          for (let x = -6; x < W; x += 58) rect('#20282f', x, 0, 12, Y);
          rect('#20282f', 0, 0, W, 14); rect('#20282f', 0, Y - 22, W, 24);
          for (let x = 22; x < W; x += 64) { rect('#0c2333', x, Y - 18, 34, 12); rect('rgba(115,182,212,0.8)', x + 3, Y - 15, 12 + rnd() * 16, 1); rect('rgba(115,182,212,0.5)', x + 3, Y - 12, 8 + rnd() * 20, 1); rect('rgba(232,151,58,0.7)', x + 3, Y - 9, 6 + rnd() * 10, 1); }
          banner(W / 2 - 18, 8, 36, 40, '#7a1f1a', '#d8b04a'); floor('#2a3540', '#10151b'); perspective('rgba(115,182,212,0.12)', 22);
        },
      ],
      foundry: [
        () => { // the furnace hall
          indoor = true; sky('#120a07', '#2c150b'); for (let x = 0; x < W; x += 34) { g.strokeStyle = '#2a1a12'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 17, 20); g.lineTo(x + 34, 0); g.stroke(); } rect('#2a1a12', 0, 19, W, 3);
          for (const x of [40, 170, 300]) { rect('#1d120c', x - 6, 30, 58, Y - 30); rect('#311d12', x, 38, 46, 8); g.fillStyle = grad('#ffd27a', '#ff6a1c', 52, Y - 4); g.fillRect(x + 6, 52, 34, Y - 56); glow(x + 23, Y - 20, 66, '255,120,40', 0.34); }
          chain(120, 22, 56, '#3a261a'); g.fillStyle = '#3a261a'; g.beginPath(); g.moveTo(106, 56); g.lineTo(136, 56); g.lineTo(130, 76); g.lineTo(112, 76); g.fill(); rect('#ffb050', 109, 56, 24, 3);
          floor('#33231a', '#150e09'); perspective('rgba(0,0,0,0.3)', 16); g.fillStyle = grad('#ffcf70', '#d9561a', Y + 4, Y + 10); g.fillRect(0, Y + 5, W, 5); glow(W / 2, Y + 8, 170, '255,120,40', 0.12);
        },
        () => { // the rolling mill: gears, rollers and hot ingots
          indoor = true; sky('#16100c', '#2a1c14');
          for (const [x, r] of [[60, 30], [116, 18], [318, 34]]) { g.strokeStyle = '#3f2c20'; g.lineWidth = 6; g.beginPath(); g.arc(x, 56, r, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; for (let a = 0; a < 8; a++) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x + Math.cos(a * Math.PI / 4) * r, 56 + Math.sin(a * Math.PI / 4) * r); g.stroke(); } rect('#6a4b34', x - 3, 53, 6, 6); }
          rect('#20150f', 0, Y - 20, W, 22); for (let x = 3; x < W; x += 11) { rect('#5a4434', x, Y - 21, 8, 8); rect('#2c1f17', x + 2, Y - 19, 4, 4); }
          for (const x of [34, 190 + rnd() * 40, 340]) { rect('#ff8a34', x, Y - 28, 34, 7); rect('#ffd27a', x + 3, Y - 26, 28, 2); glow(x + 17, Y - 24, 42, '255,120,40', 0.25); }
          floor('#2c2622', '#121010'); perspective('rgba(0,0,0,0.35)', 20); for (let x = 0; x < W; x += 16) rect((x / 16) % 2 ? '#191512' : 'rgba(255,170,60,0.5)', x, Y + 2, 16, 3);
        },
        () => { // the slag yard, outdoors under a burning sky
          sky('#2b0f08', '#a03a14'); glow(W * 0.3, Y, 200, '255,170,70', 0.4);
          for (const x of [48, 96, 300, 346]) { rect('#1a0f0a', x, 16, 14, Y - 16); rect('#3a241a', x, 22, 14, 2); for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(30,18,14,${0.5 - i * 0.05})`; g.beginPath(); g.ellipse(x + 7 + i * 7, 12 - i * 1.2, 5 + i * 2, 3 + i, 0, 0, Math.PI * 2); g.fill(); } }
          for (let x = -30; x < W; x += 72) { g.fillStyle = '#20120c'; g.beginPath(); g.moveTo(x, Y + 2); g.lineTo(x + 40, Y - 22 - rnd() * 22); g.lineTo(x + 90, Y + 2); g.fill(); }
          floor('#2a1a14', '#0e0807'); for (let i = 0; i < 22; i++) { const x = rnd() * W, y = Y + 8 + rnd() * (H - Y - 10), l = 6 + rnd() * 24; g.strokeStyle = 'rgba(255,120,40,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (rnd() - 0.5) * 6); g.stroke(); }
        },
      ],
      detention: [
        () => { // the cell block: two tiers of barred doors under cold light
          indoor = true; sky('#10181d', '#1e2b31');
          for (const tier of [12, 60]) { rect('#1a252b', 0, tier + 40, W, 5); for (let x = 2; x < W; x += 46) { rect('#070b0e', x, tier, 38, 40); if (rnd() < 0.3) rect('rgba(115,182,212,0.28)', x + 6, tier + 8, 26, 26); if (rnd() < 0.25) rect('#2a3840', x + 14, tier + 18, 10, 22); bars(x, tier, 38, 40, '#51626c'); rect('rgba(200,50,40,0.9)', x + 18, tier - 3, 3, 2); } }
          for (let x = 0; x < W; x += 12) rect('#3a4a52', x, 50, 1, 6); rect('#3a4a52', 0, 50, W, 1);
          g.fillStyle = '#1a2428'; g.fillRect(0, Y + 2, W, H - Y); const n = 13; for (let r = 0; r < 7; r++) { const y0 = Y + 2 + Math.pow(r / 7, 1.7) * (H - Y), y1 = Y + 2 + Math.pow((r + 1) / 7, 1.7) * (H - Y); for (let i = -n; i < n; i++) if ((i + r) % 2 === 0) { const s0 = 8 + r * 7, x = W / 2 + i * s0; rect('rgba(130,155,165,0.14)', x, y0, s0, y1 - y0); } }
        },
        () => { // the exercise yard: chain link, guard lights, flat grey sky
          sky('#39433f', '#7d8a84'); skyline('#2a322f', '20,24,22', 34);
          rect('#3b4441', 0, Y - 56, W, 2); for (let x = 0; x < W; x += 6) { g.strokeStyle = 'rgba(40,48,46,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, Y - 56); g.lineTo(x + 56, Y); g.moveTo(x + 56, Y - 56); g.lineTo(x, Y); g.stroke(); }
          for (let x = 8; x < W; x += 62) { rect('#2a322f', x, Y - 66, 3, 68); g.strokeStyle = '#2a322f'; g.beginPath(); g.moveTo(x, Y - 66); g.lineTo(x + 8, Y - 72); g.stroke(); } g.strokeStyle = '#59645f'; for (let x = 0; x < W; x += 7) { g.beginPath(); g.arc(x, Y - 66, 3, 0, Math.PI * 2); g.stroke(); }
          floor('#4b5350', '#1f2422'); for (let i = 0; i < 180; i++) rect(`rgba(${rnd() < 0.5 ? '0,0,0' : '200,210,205'},0.16)`, rnd() * W, Y + 4 + rnd() * (H - Y), 2, 1);
        },
        () => { // the interrogation wing: stained tile, pipes, one hard lamp
          indoor = true; sky('#20282a', '#2f3a3a');
          for (let y = 8; y < Y; y += 10) for (let x = (y % 20 ? 0 : 7); x < W; x += 14) rect('rgba(160,185,180,0.08)', x, y, 13, 9);
          for (const y of [10, 18]) { rect('#4a3a2c', 0, y, W, 4); for (let x = 30; x < W; x += 90) rect('#6a543f', x, y - 1, 6, 6); }
          for (let i = 0; i < 6; i++) { const x = rnd() * W; g.fillStyle = 'rgba(70,40,30,0.3)'; g.fillRect(x, 24, 2 + rnd() * 5, 20 + rnd() * 60); }
          chain(W * 0.5, 22, 42, '#20282a'); rect('#20282a', W * 0.5 - 14, 42, 30, 6); rect('#f4f1dc', W * 0.5 - 10, 48, 22, 2); cone(W * 0.5 + 1, 48, W * 0.5 + 1, H, 110, '240,240,215', 0.09);
          rect('#111719', 300, 44, 56, Y - 44); bars(300, 44, 56, Y - 44, '#51626c', 7);
          floor('#3b4543', '#141a19'); perspective('rgba(0,0,0,0.3)', 18); g.fillStyle = '#0a0e0d'; g.beginPath(); g.ellipse(W * 0.5, Y + 40, 10, 3, 0, 0, Math.PI * 2); g.fill();
        },
      ],
      port: [
        () => { // the landing pad: open sky, a planet, the lift tether
          sky('#050816', '#2a2448', Y + 2); for (let i = 0; i < 90; i++) rect(`rgba(230,230,255,${0.3 + rnd() * 0.7})`, rnd() * W, rnd() * (Y - 10), 1, 1);
          g.fillStyle = '#3a3f76'; g.beginPath(); g.arc(70, 8, 46, 0, Math.PI * 2); g.fill(); g.fillStyle = '#54589a'; g.beginPath(); g.arc(62, 2, 42, 0, Math.PI * 2); g.fill(); glow(70, 8, 80, '160,170,255', 0.16);
          rect('#232a3c', W * 0.72, 0, 4, Y); for (let y = 4; y < Y; y += 11) rect('rgba(210,190,255,0.7)', W * 0.72 - 1, y, 6, 1); rect('#39445c', W * 0.72 - 7, 34, 18, 12);
          rect('#121827', 170, Y - 50, 5, 52); rect('#121827', 170, Y - 50, 90, 5); chain(240, Y - 45, Y - 22, '#121827');
          g.fillStyle = '#1a2233'; g.beginPath(); g.moveTo(190, Y - 4); g.lineTo(205, Y - 22); g.lineTo(254, Y - 22); g.lineTo(272, Y - 8); g.lineTo(272, Y - 2); g.fill(); rect('rgba(115,182,212,0.8)', 208, Y - 18, 12, 3);
          floor('#2a3240', '#10141c'); perspective('rgba(115,182,212,0.13)', 22); for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(232,210,90,0.55)'; g.lineWidth = 2; const y = Y + 18 + i * 14, x = W / 2; g.beginPath(); g.moveTo(x - 40 - i * 8, y + 8); g.lineTo(x, y); g.lineTo(x + 40 + i * 8, y + 8); g.stroke(); }
        },
        () => { // the cargo hold: stacked containers and an overhead crane
          indoor = true; sky('#0d1219', '#1c2533'); rect('#0a0e14', 0, 0, W, 12); rect('#2b3648', 0, 12, W, 4); rect('#3a4860', 200 + rnd() * 60, 16, 36, 6); chain(218 + rnd() * 2, 22, 42, '#2b3648');
          const cols = ['#8a3a2a', '#2f5d76', '#a8842a', '#3f6a4c', '#5a4a78'];
          for (let x = -6; x < W; x += 44) { const stack = 1 + Math.floor(rnd() * 3); for (let s = 0; s < stack; s++) { const y = Y - (s + 1) * 26, col = cols[Math.floor(rnd() * cols.length)]; rect(col, x, y, 42, 25); rect('rgba(0,0,0,0.25)', x, y + 22, 42, 3); for (let v = 4; v < 40; v += 5) rect('rgba(0,0,0,0.2)', x + v, y + 2, 1, 20); rect('rgba(255,255,255,0.28)', x + 5, y + 5, 12, 2); } }
          for (let x = 30; x < W; x += 110) cone(x, 16, x, Y + 40, 50, '140,190,230', 0.07);
          floor('#2a313c', '#11151b'); perspective('rgba(0,0,0,0.3)', 18); for (let x = 0; x < W; x += 12) rect((x / 12) % 2 ? '#14181e' : 'rgba(232,210,90,0.45)', x, Y + 2, 12, 2);
        },
        () => { // the top of the lift: above the clouds, tether right beside you
          sky('#020412', '#3a2a66', Y - 10); for (let i = 0; i < 130; i++) rect(`rgba(240,240,255,${0.3 + rnd() * 0.7})`, rnd() * W, rnd() * (Y - 30), 1, 1);
          g.fillStyle = '#c8a2d8'; g.beginPath(); g.ellipse(W / 2, Y + 60, W, 76, 0, Math.PI, Math.PI * 2); g.fill(); g.fillStyle = '#8f78bc'; g.beginPath(); g.ellipse(W / 2, Y + 66, W, 76, 0, Math.PI, Math.PI * 2); g.fill(); for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(250,235,255,0.35)'; g.beginPath(); g.ellipse(rnd() * W, Y - 6 + rnd() * 10, 8 + rnd() * 26, 2, 0, 0, Math.PI * 2); g.fill(); }
          rect('#39445c', 318, 0, 12, Y + 2); for (let y = 2; y < Y; y += 9) rect('rgba(210,190,255,0.8)', 316, y, 16, 1); rect('#55617e', 306, 30, 36, 18); rect('rgba(115,182,212,0.9)', 310, 35, 28, 4);
          rect('#232a3c', 0, Y - 8, W, 2); for (let x = 0; x < W; x += 20) rect('#232a3c', x, Y - 8, 2, 10);
          floor('#1c2436', '#0a0d16'); perspective('rgba(150,200,255,0.2)', 26);
        },
      ],
    };
    (scenes[theme] || scenes.garrison)[band]();
    if (boss) { g.fillStyle = 'rgba(120,18,12,0.24)'; g.fillRect(0, 0, W, H); glow(W * 0.7, Y - 30, 150, '212,72,58', 0.3); banner(W * 0.7 - 16, 4, 32, 40, '#7a1f1a', '#e8c35a'); }
    c.indoor = indoor;
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
    const g = this.ctx, a = this.anchor(actor.side, actor), f = actor.frame(t), s = actor.scale;
    const w = Math.round(f.sw * s), h = Math.round(f.sh * s);
    let bob = 0;
    if (!reduceMotion) bob = actor.side === 'enemy' ? Math.sin(t / (HOVER.has(actor.id) ? 380 : 650)) * (HOVER.has(actor.id) ? 3 : 1) : Math.sin(t / 720) * 1.2;
    const x = Math.round(a.x + actor.ox - w / 2), y = Math.round(a.y + actor.oy - h + this.footPad(actor) + bob);
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
      const p = Math.max(0, Math.min(1, (t - tw.start) / tw.dur));
      tw.fn(p);
      if (p >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done(); }
    }
    const g = this.ctx;
    g.save();
    if (t < this.shakeUntil) g.translate(Math.round((Math.random() * 2 - 1) * this.shakeMag), Math.round((Math.random() * 2 - 1) * this.shakeMag));
    const backdrop = this.background(this.sector, this.boss, this.theme);
    g.drawImage(backdrop, 0, 0);
    if (this.boss && !reduceMotion) { g.fillStyle = `rgba(212,72,58,${0.06 + 0.06 * Math.sin(t / 300)})`; g.fillRect(0, 0, W, H); }
    g.fillStyle = this.theme === 'foundry' ? 'rgba(255,150,70,0.35)' : 'rgba(160,180,200,0.22)';
    // Rain outdoors; in the foundry, sparks. Under a roof, neither.
    if (!backdrop.indoor || this.theme === 'foundry') for (const d of reduceMotion ? [] : this.rain) { d.y += d.v; d.x -= d.v * 0.25; if (d.y > H) { d.y = -6; d.x = Math.random() * (W + 40); } g.fillRect(Math.round(d.x), Math.round(d.y), 1, 4); }

    const ea = this.anchor('enemy');
    this.pad(ea.x, ea.y + 1, 58, 11);
    const E = this.enemy, ec = this.center(E);
    if ((this.intent === 'heavy' && !this.stun) || this.heavyBoost) {
      const pulse = this.heavyBoost ? 0.55 : 0.25 + 0.12 * Math.sin(t / 160);
      const rg = g.createRadialGradient(ec.x, ec.y, 4, ec.x, ec.y, E.size * (E.sheet ? 0.4 : 0.7));
      rg.addColorStop(0, `rgba(212,72,58,${pulse})`); rg.addColorStop(1, 'rgba(212,72,58,0)');
      g.fillStyle = rg; g.fillRect(ec.x - E.size, ec.y - E.size, E.size * 2, E.size * 2);
    }
    this.drawActor(E, t);
    if (this.intent === 'guard' && !this.stun && E.alpha > 0.5) {
      g.strokeStyle = `rgba(190,200,210,${0.35 + 0.15 * Math.sin(t / 240)})`; g.lineWidth = 2;
      const k = E.sheet ? 0.5 : 1; g.beginPath(); g.ellipse(ec.x - 8, ec.y + 6, E.size * 0.55 * k, E.size * 0.6 * k, 0, Math.PI * 0.6, Math.PI * 1.25); g.stroke();
    }
    if (this.stun > 0 && E.alpha > 0.5) {
      for (let i = 0; i < 3; i++) { const a = t / 300 + (i * Math.PI * 2) / 3; g.fillStyle = C.ion; g.fillRect(Math.round(ec.x + Math.cos(a) * 16), Math.round(ec.y - E.size * 0.45 + Math.sin(a) * 4), 2, 2); }
    }

    const pa = this.anchor('player');
    this.pad(pa.x, this.player && this.player.sheet ? pa.y - 2 : pa.y - 16, 84, 16);
    if (this.allies && this.allyActors && this.allyActors.length && this.player && this.player.alpha > 0) {
      // Freed prisoners from the PixelLab sheet stand behind the player's left shoulder.
      this.allyActors.forEach((al, i) => {
        const f = al.frame(t), sc = al.scale, w = Math.round(f.sw * sc), h = Math.round(f.sh * sc);
        g.globalAlpha = this.player.alpha;
        g.drawImage(f.img, f.sx, 0, f.sw, f.sh, Math.round(18 + i * 26 - w / 2), Math.round(184 - h + 8 * sc), w, h);
        g.globalAlpha = 1;
      });
    } else if (this.allies && this.allySprite && this.player && this.player.alpha > 0) {
      for (let i = 0; i < this.allies; i++) {
        const x = 2 + i * 34, y = 216 - 70 + Math.round(Math.sin(t / 650 + i) * 1);
        g.globalAlpha = this.player.alpha; g.drawImage(this.allySprite, 0, 0, 40, 40, x, y, 70, 70); g.globalAlpha = 1;
      }
    }
    if (this.partner && this.player && this.player.alpha > 0) {
      this.partner.alpha = this.player.alpha;
      this.drawActor(this.partner, t);
      if (this.partnerInfo) { const pc = this.center(this.partner); g.fillStyle = this.partnerInfo.acting ? C.amber : 'rgba(221,214,198,.7)'; g.font = '7px monospace'; g.textAlign = 'center'; g.fillText(this.partnerInfo.name.toUpperCase().slice(0, 12), Math.round(pc.x), Math.round(pc.y - this.partner.size * 0.45)); g.textAlign = 'left'; }
    }
    this.drawActor(this.player, t);
    if (this.playerShield && this.player) {
      const pc = this.center(this.player);
      g.strokeStyle = `rgba(143,220,255,${0.45 + 0.2 * Math.sin(t / 90)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(pc.x + 10, pc.y, 56, 50, 0, -Math.PI * 0.55, Math.PI * 0.05); g.stroke();
    }

    for (const b of [...this.bolts]) {
      const p = Math.max(0, (t - b.born) / b.dur);
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
      const p = Math.max(0, (t - r.born) / r.life);
      if (p >= 1) { this.rings.splice(this.rings.indexOf(r), 1); continue; }
      g.strokeStyle = r.color; g.globalAlpha = 1 - p; g.lineWidth = r.w; g.beginPath(); g.ellipse(r.x, r.y, r.r1 * ease(p), r.r1 * ease(p) * 0.8, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    for (const pt of [...this.particles]) {
      const age = Math.max(0, t - pt.born);
      if (age > pt.life) { this.particles.splice(this.particles.indexOf(pt), 1); continue; }
      pt.vy += pt.g; pt.x += pt.vx; pt.y += pt.vy;
      g.globalAlpha = 1 - age / pt.life; g.fillStyle = pt.color;
      const sz = pt.size > 3 ? pt.size * (1 + age / pt.life) : pt.size;
      g.fillRect(Math.round(pt.x - sz / 2), Math.round(pt.y - sz / 2), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
    }
    g.globalAlpha = 1;
    g.restore();
    if (this.dim > 0) { g.fillStyle = `rgba(4,5,7,${this.dim})`; g.fillRect(0, 0, W, H); this.drawActor(E, t); }
  }
}
