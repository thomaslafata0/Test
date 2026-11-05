// Kessa Yard: the walkable top-down town and its walk-in interiors.
// Canvas scene with camera follow, arrow/WASD and tap-to-walk, collisions, depth sorting,
// door zones into interiors, NPC one-liners and a patrolling guard. Art comes from town/manifest.json.
import { play } from './audio.js';

const BASE = 'town/';
const T = 32;                      // tile size
let VIEW_W = 416, VIEW_H = 256;    // native resolution; resized to a whole-pixel scale of the element's width
const MAP_COLS = 30, MAP_ROWS = 22, MAP_W = MAP_COLS * T, MAP_H = MAP_ROWS * T;
const CELL = 8;                    // collision grid
const SPEED = 78;                  // px per second
const FEET = { x: 32, y: 59 };     // feet position inside a 64x64 frame
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- layout (top-left of each image, world pixels) ----------
const BUILDINGS = [
  { id: 'tenement_b', x: 40, y: 40 },
  { id: 'terminal', x: 352, y: 16 },
  { id: 'tenement_a', x: 776, y: 24 },
  { id: 'market', x: 80, y: 228 },
  { id: 'clinic', x: 716, y: 196 },
  { id: 'safehouse', x: 708, y: 428 },
  { id: 'barracks', x: 56, y: 486 },
];
// The screen each building's NPC opens, and how the town labels it.
export const SHOPS = {
  terminal: { name: 'Freight terminal', opens: 'missions', label: 'Missions' },
  market: { name: 'Marrow\u2019s container', opens: 'market', label: 'Black Market' },
  clinic: { name: 'Doc Ilse\u2019s clinic', opens: 'clinic', label: 'Clinic' },
  safehouse: { name: 'The safehouse', opens: 'character', label: 'Character & Resolve' },
  barracks: { name: 'Directorate barracks', locked: 'Directorate barracks. You don\u2019t want to go in there.' },
  tenement_a: { name: 'Tenement', locked: 'Someone\u2019s asleep in there. Probably.' },
  tenement_b: { name: 'Tenement', locked: 'The door is welded shut. Curfew rules.' },
};
const PROPS = [
  ['poster_wall', 216, 150], ['steam_vent', 280, 200], ['holosign', 276, 256], ['console', 640, 150], ['noticeboard', 616, 200],
  ['queue_barrier', 380, 300], ['queue_barrier', 540, 300], ['vending_terminal', 680, 360], ['junction_box', 640, 360],
  ['streetlamp', 300, 290], ['streetlamp', 604, 290], ['streetlamp', 300, 500], ['streetlamp', 604, 500],
  ['crate', 300, 446], ['cargo_crate', 332, 446], ['cargo_crawler', 460, 460], ['cargo_pile', 590, 440], ['barrels', 650, 600],
  ['noodle_stall', 430, 560], ['barrel_fire', 330, 612], ['lockers', 180, 600], ['workbench', 212, 610], ['trash_pile', 168, 440],
  ['generator', 680, 640], ['water_tower', 872, 620], ['fuel_tank', 900, 360], ['power_unit', 880, 420], ['sat_dish', 912, 260],
  ['antenna', 24, 250], ['air_unit', 260, 60], ['cargo_crate', 20, 420], ['barrels', 24, 660],
];
const LAMPS = [[300, 290], [604, 290], [300, 500], [604, 500]];
// Townsfolk: feet position and what they say.
const TOWNSFOLK = [
  { id: 'vendor', x: 462, y: 650, lines: ['Noodles. Real broth, mostly.', 'Two credits a bowl. Curfew prices.', 'Eat. You look like you\u2019re going somewhere.'] },
  { id: 'worker', x: 624, y: 560, lines: ['Double shift again. The quota went up.', 'Crawler\u2019s been broken for a month. They fine us for it.', 'Heard someone hit the garrison last night. Wasn\u2019t me.'] },
  { id: 'kid', x: 366, y: 650, lines: ['Are you one of them? The cell?', 'I can run messages. I\u2019m fast.', 'My dad worked the casting floor. Before.'] },
];
const PATROL = { id: 'patrol', route: [[240, 400], [560, 400], [560, 690], [240, 690]], lines: ['Papers.', 'Curfew\u2019s at dusk. Move along.', 'Keep walking, citizen.'] };
// Interior NPC one-liners.
const INSIDE = {
  marrow: ['No receipts. No refunds. No questions.', 'Fresh stock after every job you pull.', 'Trade in the old piece, I\u2019ll knock it off the price.'],
  ilse: ['Sit. Don\u2019t bleed on the floor.', 'Hardware under the skin costs extra.', 'You again. Good. Means you\u2019re alive.'],
  handler: ['The cell remembers. Spend what you\u2019ve earned.', 'Training keeps the next one alive.', 'Sit down. Tell me what you saw.'],
  dispatcher: ['Freight manifests, patrol rotas, the lot. Pick a target.', 'Contracts on the board. The cell pays.', 'The lift port\u2019s open once you\u2019ve been deep enough.'],
};

// ---------- asset loading ----------
function loadImg(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}

export class Town {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'town';
    this.el.innerHTML = `<canvas width="${VIEW_W}" height="${VIEW_H}" aria-label="Kessa Yard. Walk with arrow keys or WASD, or tap where to go. E or Space to talk." tabindex="0"></canvas>
      <div class="town-bubble" hidden></div><div class="town-prompt" hidden></div><div class="town-fade"></div>`;
    this.cv = this.el.querySelector('canvas');
    this.g = this.cv.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.bubble = this.el.querySelector('.town-bubble');
    this.prompt = this.el.querySelector('.town-prompt');
    this.fade = this.el.querySelector('.town-fade');
    this.keys = new Set();
    this.blocked = false;
    this.onOpen = null;     // (screen, shopId) => void
    this.scene = 'town';    // 'town' | 'interior:<id>'
    this.player = { x: 780, y: 600, dir: 'up', moving: false, t: 0, path: null, goal: null };
    this.cam = { x: 0, y: 0 };
    this.say = null;        // { text, who, until }
    this.stepT = 0;
    this.ready = false;
    this.rain = Array.from({ length: reduceMotion ? 0 : 60 }, (_, i) => ({ x: (i * 67) % VIEW_W, y: (i * 41) % VIEW_H, v: 120 + (i % 5) * 30 }));
    this.load();
    this.bindInput();
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (this.el.isConnected && this.ready) { try { this.fit(); this.update(dt); this.draw(t); } catch (e) { console.warn('town', e); } }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Pick a native size so the canvas scales by a whole number (crisp pixels): about 2x on desktop, 1x on phones.
  fit() {
    const cw = this.el.clientWidth, inside = this.scene.startsWith('interior:'), key = `${cw}:${inside}`;
    if (!cw || key === this.fitKey) return;
    this.fitKey = key;
    // Interiors are small rooms: zoom one step further on wider screens.
    const scale = Math.max(1, Math.round(cw / 480)) + (inside && cw >= 600 ? 1 : 0);
    VIEW_W = Math.round(cw / scale); VIEW_H = Math.round(VIEW_W * (cw < 600 ? 0.78 : 0.56));
    this.cv.width = VIEW_W; this.cv.height = VIEW_H;
    this.cv.style.aspectRatio = `${VIEW_W} / ${VIEW_H}`;
    this.g.imageSmoothingEnabled = false;
    this.snapCamera();
  }

  async load() {
    try {
      const m = this.m = await (await fetch(BASE + 'manifest.json')).json();
      const jobs = [];
      const img = {};
      const add = (key, path) => jobs.push(loadImg(BASE + path).then((im) => { img[key] = im; }));
      add('tiles', 'tiles/town.png');
      for (const id of Object.keys(m.buildings)) add(`b:${id}`, `buildings/${id}.png`);
      for (const id of Object.keys(m.interiors)) add(`i:${id}`, `interiors/${id}.png`);
      for (const id of Object.keys(m.props)) add(`p:${id}`, `props/${id}.png`);
      for (const [id, ch] of Object.entries(m.chars)) for (const [anim, a] of Object.entries(ch.anims)) for (const d of a.dirs) add(`c:${id}:${anim}_${d}`, `chars/${id}/${anim}_${d}.png`);
      await Promise.all(jobs);
      this.img = img;
      this.buildTown();
      this.ready = true;
      this.el.classList.add('ready');
    } catch (e) {
      console.warn('town art failed to load', e);
      this.el.classList.add('failed');
    }
  }

  // ---------- world building ----------
  buildTown() {
    const m = this.m;
    // Corner terrain grid: metal deck inside a border of sand, with a landing pad in the middle.
    const corner = (cx, cy) => {
      if (cx >= 13 && cx <= 17 && cy >= 14 && cy <= 17) return 'landing_pad';
      const notch = cx >= 21 && cx <= 22 && cy >= 2 && cy <= 4; // a sand bay by the tenements
      return cx >= 1 && cx <= MAP_COLS - 1 && cy >= 2 && cy <= MAP_ROWS - 1 && !notch ? 'metal_deck' : 'sand';
    };
    const lookup = {};
    for (const set of Object.values(m.tilesets)) for (const t of set.tiles) {
      const k = [t.corners.nw, t.corners.ne, t.corners.sw, t.corners.se].join('|');
      if (!(k in lookup) || set === m.tilesets.deck_sand) lookup[k] = t.id;
    }
    const ground = document.createElement('canvas');
    ground.width = MAP_W; ground.height = MAP_H;
    const gg = ground.getContext('2d');
    gg.fillStyle = '#d9b98f'; gg.fillRect(0, 0, MAP_W, MAP_H);
    for (let ty = 0; ty < MAP_ROWS; ty++) for (let tx = 0; tx < MAP_COLS; tx++) {
      const k = [corner(tx, ty), corner(tx + 1, ty), corner(tx, ty + 1), corner(tx + 1, ty + 1)].join('|');
      const id = lookup[k] ?? lookup[['metal_deck', 'metal_deck', 'metal_deck', 'metal_deck'].join('|')];
      if (id === undefined || !this.img.tiles) continue;
      gg.drawImage(this.img.tiles, (id % 12) * T, Math.floor(id / 12) * T, T, T, tx * T, ty * T, T, T);
    }
    this.ground = ground;

    // Objects for depth sorting, collision rectangles and door triggers.
    this.objects = []; this.blocks = []; this.doors = [];
    for (const b of BUILDINGS) {
      const info = m.buildings[b.id], im = this.img[`b:${b.id}`];
      if (!info || !im) continue;
      const doorBottom = b.y + info.door.y + info.door.h;
      const top = b.y + Math.round(info.h * 0.42);
      this.objects.push({ kind: 'building', bid: b.id, im, x: b.x, y: b.y, sortY: doorBottom });
      this.blocks.push({ x: b.x + 6, y: top, w: info.w - 12, h: doorBottom - 3 - top });
      this.doors.push({ id: b.id, enterable: info.enterable, x: b.x + info.door.x - 8, y: doorBottom - 8, w: info.door.w + 16, h: 14, front: { x: b.x + info.door.x + info.door.w / 2, y: doorBottom + 14 } });
    }
    for (const [id, x, y] of PROPS) {
      const p = m.props[id], im = this.img[`p:${id}`];
      if (!p || !im) continue;
      this.objects.push({ kind: 'prop', id, im, x, y, w: p.w, h: p.h, frames: p.frames || 1, fps: p.fps || 0, sortY: y + p.h - 2 });
      const fh = Math.max(8, Math.round(p.h * (p.h > 32 ? 0.35 : 0.4)));
      this.blocks.push({ x: x + 3, y: y + p.h - fh - 2, w: p.w - 6, h: fh });
    }
    this.lamps = LAMPS.map(([x, y]) => ({ x: x + 16 - 48, y: y + 40 }));
    this.folk = TOWNSFOLK.map((f) => ({ ...f, dir: 'down', t: Math.random() * 3 }));
    for (const f of this.folk) this.blocks.push({ x: f.x - 7, y: f.y - 5, w: 14, h: 7 });
    this.patrol = { ...PATROL, x: PATROL.route[0][0], y: PATROL.route[0][1], leg: 1, dir: 'right', t: 0, pause: 0 };
    this.buildGrid('town');
    if (this.pendingSpawn) { this.spawnAt(this.pendingSpawn); this.pendingSpawn = null; }
    else this.spawnAt('safehouse');
  }

  // Walkability grid for the current scene (8 px cells).
  buildGrid(scene) {
    let w, h, rects, floor = null;
    if (scene === 'town') { w = MAP_W; h = MAP_H; rects = this.blocks; }
    else {
      const it = this.m.interiors[scene.slice(9)];
      w = it.w; h = it.h; floor = it.floor;
      rects = [{ x: it.npc.x - 10, y: it.npc.y - 6, w: 20, h: 10 }];
    }
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL), grid = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      let open = floor ? x >= floor.x && x <= floor.x + floor.w && y >= floor.y && y <= floor.y + floor.h + 24 : x > 12 && x < w - 12 && y > 30 && y < h - 6;
      if (floor) { const ex = this.m.interiors[scene.slice(9)].exit; if (x >= ex.x && x <= ex.x + ex.w && y >= ex.y && y <= ex.y + ex.h) open = true; }
      if (open) for (const b of rects) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { open = false; break; }
      grid[r * cols + c] = open ? 1 : 0;
    }
    this.grid = { cols, rows, cells: grid, w, h };
  }
  walkable(x, y) {
    const G = this.grid;
    // check a small box around the feet
    for (const [dx, dy] of [[-5, -2], [5, -2], [-5, 2], [5, 2]]) {
      const c = Math.floor((x + dx) / CELL), r = Math.floor((y + dy) / CELL);
      if (c < 0 || r < 0 || c >= G.cols || r >= G.rows || !G.cells[r * G.cols + c]) return false;
    }
    return true;
  }

  // ---------- scenes ----------
  spawnAt(where) {
    if (!this.doors) { this.pendingSpawn = where; return; }
    this.setScene('town');
    const d = this.doors.find((x) => x.id === where);
    const p = this.player;
    if (d) { p.x = d.front.x; p.y = d.front.y + 6; p.dir = 'down'; }
    p.path = null; p.goal = null; this.say = null;
    this.snapCamera();
  }
  setScene(scene) {
    this.scene = scene;
    this.buildGrid(scene);
    this.keys.clear();
  }
  enter(door) {
    const it = this.m.interiors[door.id];
    if (!it) return;
    play('door');
    this.flash();
    this.lastDoor = door;
    this.setScene(`interior:${door.id}`);
    const p = this.player;
    p.x = it.spawn.x; p.y = it.spawn.y - 4; p.dir = 'up'; p.path = null; p.goal = null; this.say = null;
    this.snapCamera();
    const shop = SHOPS[door.id];
    // The shop's menu opens as soon as you walk in.
    if (shop && shop.opens && this.onOpen) setTimeout(() => this.onOpen(shop.opens, door.id), 180);
  }
  exit() {
    play('door');
    this.flash();
    const d = this.lastDoor;
    this.setScene('town');
    const p = this.player;
    if (d) { p.x = d.front.x; p.y = d.front.y + 6; }
    p.dir = 'down'; p.path = null; p.goal = null; this.say = null;
    this.snapCamera();
  }
  flash() { this.fade.classList.remove('on'); void this.fade.offsetWidth; this.fade.classList.add('on'); }
  get interior() { return this.scene.startsWith('interior:') ? this.m.interiors[this.scene.slice(9)] : null; }
  get interiorId() { return this.scene.startsWith('interior:') ? this.scene.slice(9) : null; }

  // ---------- input ----------
  bindInput() {
    const DIR = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    window.addEventListener('keydown', (ev) => {
      if (!this.active || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      const k = ev.key.toLowerCase();
      if (DIR[k]) { this.keys.add(DIR[k]); this.player.path = null; this.player.goal = null; ev.preventDefault(); }
      else if (k === 'e' || k === ' ' || k === 'enter') { if (this.interact()) ev.preventDefault(); }
    });
    window.addEventListener('keyup', (ev) => { const k = DIR[ev.key.toLowerCase()]; if (k) this.keys.delete(k); });
    window.addEventListener('blur', () => this.keys.clear());
    this.cv.addEventListener('pointerdown', (ev) => {
      if (!this.ready || this.blocked) return;
      const r = this.cv.getBoundingClientRect();
      const x = (ev.clientX - r.left) * (VIEW_W / r.width) + this.cam.x, y = (ev.clientY - r.top) * (VIEW_H / r.height) + this.cam.y;
      this.tapAt(x, y);
    });
  }
  get active() { return this.ready && this.el.isConnected && !this.blocked; }
  setBlocked(b) { this.blocked = b; if (b) { this.keys.clear(); this.player.path = null; } }

  // Who or what is next to the player that they could talk to or use.
  nearby() {
    const p = this.player, near = (x, y, r = 26) => Math.hypot(p.x - x, p.y - y) < r;
    const it = this.interior;
    if (it) {
      if (near(it.npc.x, it.npc.y, 34)) return { kind: 'npc', id: it.npc.id, x: it.npc.x, y: it.npc.y, opens: SHOPS[this.interiorId].opens };
      return null;
    }
    for (const f of this.folk) if (near(f.x, f.y)) return { kind: 'folk', who: f };
    if (near(this.patrol.x, this.patrol.y)) return { kind: 'folk', who: this.patrol };
    const board = PROPS.find((p) => p[0] === 'noticeboard');
    if (board && near(board[1] + 32, board[2] + 62, 30)) return { kind: 'board' };
    return null;
  }
  interact() {
    const n = this.nearby();
    if (!n) return false;
    if (n.kind === 'npc') {
      this.speak(n.id, pick(INSIDE[n.id] || ['...']), n.x, n.y);
      if (this.onOpen) this.onOpen(n.opens, this.interiorId);
    } else if (n.kind === 'folk') {
      this.speak(n.who.id, pick(n.who.lines), n.who.x, n.who.y);
      play('click');
    } else if (n.kind === 'board') {
      if (this.onOpen) this.onOpen('missions', 'terminal');
    }
    return true;
  }
  speak(who, text, x, y) { this.say = { text, x, y, until: performance.now() + 2600 }; }

  tapAt(x, y) {
    const p = this.player;
    const it = this.interior;
    // Tap a person: walk next to them and talk.
    const targets = it ? [{ x: it.npc.x, y: it.npc.y, talk: true }] : [...this.folk, this.patrol].map((f) => ({ x: f.x, y: f.y, talk: true }));
    for (const t of targets) if (Math.abs(x - t.x) < 14 && y > t.y - 44 && y < t.y + 4) { this.walkTo(t.x, t.y + 14, () => this.interact()); return; }
    if (!it) {
      // Tap a building: walk to its door.
      for (const o of this.objects) if (o.kind === 'building' && x >= o.x && x <= o.x + o.im.width && y >= o.y && y <= o.sortY) {
        const d = this.doors.find((dd) => dd.id === o.bid);
        if (d) { this.walkTo(d.front.x, d.front.y, () => this.tryDoor(d, true)); return; }
      }
    }
    this.walkTo(x, y);
  }

  // Breadth-first path on the walk grid to the nearest open cell to (x, y).
  walkTo(x, y, then = null) {
    const G = this.grid, p = this.player;
    const cell = (px, py) => [clampI(Math.floor(px / CELL), 0, G.cols - 1), clampI(Math.floor(py / CELL), 0, G.rows - 1)];
    const open = (c, r) => c >= 0 && r >= 0 && c < G.cols && r < G.rows && G.cells[r * G.cols + c] && this.walkable(c * CELL + 4, r * CELL + 4);
    let [tc, tr] = cell(x, y);
    if (!open(tc, tr)) { // nearest open cell
      let best = null, bd = 1e9;
      for (let r = Math.max(0, tr - 8); r <= Math.min(G.rows - 1, tr + 8); r++) for (let c = Math.max(0, tc - 8); c <= Math.min(G.cols - 1, tc + 8); c++) if (open(c, r)) { const d = (c - tc) ** 2 + (r - tr) ** 2; if (d < bd) { bd = d; best = [c, r]; } }
      if (!best) return;
      [tc, tr] = best;
    }
    const [sc, sr] = cell(p.x, p.y);
    const prev = new Int32Array(G.cols * G.rows).fill(-1), start = sr * G.cols + sc, goal = tr * G.cols + tc;
    const q = [start]; prev[start] = start;
    while (q.length) {
      const i = q.shift();
      if (i === goal) break;
      const c = i % G.cols, r = (i - c) / G.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = c + dc, nr = r + dr, ni = nr * G.cols + nc;
        if (!open(nc, nr) || prev[ni] !== -1) continue;
        if (dc && dr && (!open(c + dc, r) || !open(c, r + dr))) continue;
        prev[ni] = i; q.push(ni);
      }
    }
    if (prev[goal] === -1) return;
    const path = [];
    for (let i = goal; i !== start; i = prev[i]) path.push([(i % G.cols) * CELL + CELL / 2, Math.floor(i / G.cols) * CELL + CELL / 2]);
    path.reverse();
    p.path = path.filter((_, i) => i % 2 === 1 || i === path.length - 1);
    p.then = then;
  }

  tryDoor(d, tapped = false) {
    if (d.enterable && this.m.interiors[d.id]) { this.enter(d); return true; }
    const shop = SHOPS[d.id];
    if (shop && shop.locked && (tapped || !this.lockedSaid || performance.now() - this.lockedSaid > 3000)) {
      this.lockedSaid = performance.now();
      this.speak('player', shop.locked, this.player.x, this.player.y);
    }
    return false;
  }

  // ---------- simulation ----------
  update(dt) {
    const p = this.player;
    let vx = 0, vy = 0;
    if (!this.blocked) {
      if (this.keys.has('left')) vx -= 1; if (this.keys.has('right')) vx += 1;
      if (this.keys.has('up')) vy -= 1; if (this.keys.has('down')) vy += 1;
      if (!vx && !vy && p.path && p.path.length) {
        const [tx, ty] = p.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        if (d < 3) { p.path.shift(); if (!p.path.length) { p.path = null; const f = p.then; p.then = null; if (f) f(); } }
        else { vx = dx / d; vy = dy / d; }
      }
    }
    p.moving = !!(vx || vy);
    if (p.moving) {
      const n = Math.hypot(vx, vy); vx /= n; vy /= n;
      p.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      const nx = p.x + vx * SPEED * dt, ny = p.y + vy * SPEED * dt;
      if (this.walkable(nx, p.y)) p.x = nx;
      if (this.walkable(p.x, ny)) p.y = ny;
      this.stepT -= dt;
      if (this.stepT <= 0) { play('step'); this.stepT = 0.32; }
      // doors and exits
      if (!this.interior) {
        for (const d of this.doors) if (p.x > d.x && p.x < d.x + d.w && p.y > d.y && p.y < d.y + d.h && vy < 0) { this.tryDoor(d); break; }
      } else {
        const ex = this.interior.exit;
        if (p.x > ex.x && p.x < ex.x + ex.w && p.y > ex.y + 6 && vy > 0) this.exit();
      }
    }
    p.t += dt;
    // patrol walks its loop, pausing at corners
    const g = this.patrol;
    if (g && !this.interior) {
      g.t += dt;
      if (g.pause > 0) g.pause -= dt;
      else {
        const [tx, ty] = g.route[g.leg], dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
        if (d < 2) { g.leg = (g.leg + 1) % g.route.length; g.pause = 1.2; }
        else { g.x += (dx / d) * 34 * dt; g.y += (dy / d) * 34 * dt; g.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }
      }
    }
    // camera follows the player
    const W = this.grid.w, H = this.grid.h;
    const tx = W <= VIEW_W ? (W - VIEW_W) / 2 : clamp(p.x - VIEW_W / 2, 0, W - VIEW_W);
    const ty = H <= VIEW_H ? (H - VIEW_H) / 2 : clamp(p.y - 20 - VIEW_H / 2, 0, H - VIEW_H);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
    for (const r of this.rain) { r.y += r.v * dt; r.x -= r.v * 0.25 * dt; if (r.y > VIEW_H) { r.y = -6; r.x = Math.random() * (VIEW_W + 40); } }
  }
  snapCamera() {
    const p = this.player, W = this.grid.w, H = this.grid.h;
    this.cam.x = W <= VIEW_W ? (W - VIEW_W) / 2 : clamp(p.x - VIEW_W / 2, 0, W - VIEW_W);
    this.cam.y = H <= VIEW_H ? (H - VIEW_H) / 2 : clamp(p.y - 20 - VIEW_H / 2, 0, H - VIEW_H);
  }

  // ---------- drawing ----------
  sprite(id, anim, dir, x, y, t) {
    const a = this.m.chars[id] && this.m.chars[id].anims[anim];
    let im = this.img[`c:${id}:${anim}_${dir}`];
    let frames = a ? a.frames : 4, fps = a ? a.fps : 5;
    if (!im) { im = this.img[`c:${id}:idle_down`]; const ia = this.m.chars[id] && this.m.chars[id].anims.idle; frames = ia ? ia.frames : 4; fps = ia ? ia.fps : 5; }
    if (!im) return;
    const f = Math.floor(t * fps) % frames;
    this.g.drawImage(im, f * 64, 0, 64, 64, Math.round(x - FEET.x - this.cam.x), Math.round(y - FEET.y - this.cam.y), 64, 64);
  }
  shadow(x, y) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(Math.round(x - this.cam.x), Math.round(y - this.cam.y), 9, 3, 0, 0, Math.PI * 2); g.fill();
  }
  draw(now) {
    const g = this.g, t = now / 1000, cx = Math.round(this.cam.x), cy = Math.round(this.cam.y), p = this.player;
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const it = this.interior;
    const list = [];
    if (it) {
      g.drawImage(this.img[`i:${this.interiorId}`], -cx, -cy);
      list.push({ y: it.npc.y, draw: () => { this.shadow(it.npc.x, it.npc.y); this.sprite(it.npc.id, 'idle', 'down', it.npc.x, it.npc.y, t); } });
    } else {
      g.drawImage(this.ground, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
      for (const o of this.objects) {
        if (o.x - cx > VIEW_W || o.y - cy > VIEW_H || o.x + (o.w || o.im.width) - cx < 0 || o.sortY - cy < -40) continue;
        list.push({ y: o.sortY, draw: () => {
          if (o.frames > 1) { const fw = o.im.width / o.frames, f = Math.floor(t * o.fps) % o.frames; g.drawImage(o.im, f * fw, 0, fw, o.im.height, o.x - cx, o.y - cy, fw, o.im.height); }
          else g.drawImage(o.im, o.x - cx, o.y - cy);
        } });
      }
      for (const f of this.folk) list.push({ y: f.y, draw: () => { this.shadow(f.x, f.y); this.sprite(f.id, 'idle', 'down', f.x, f.y, t + f.t); } });
      const gd = this.patrol;
      list.push({ y: gd.y, draw: () => { this.shadow(gd.x, gd.y); this.sprite('patrol', gd.pause > 0 ? 'idle' : 'walk', gd.pause > 0 ? 'down' : gd.dir, gd.x, gd.y, gd.t); } });
    }
    list.push({ y: p.y, draw: () => { this.shadow(p.x, p.y); this.sprite('player', p.moving ? 'walk' : 'idle', p.dir, p.x, p.y, p.t); } });
    list.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
    if (!it) {
      // dusk tint, lamp light, rain
      g.fillStyle = 'rgba(18,22,48,0.28)'; g.fillRect(0, 0, VIEW_W, VIEW_H);
      const pool = this.img['p:lamp_light_pool'];
      if (pool) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + (reduceMotion ? 0 : 0.05 * Math.sin(t * 3)); for (const l of this.lamps) g.drawImage(pool, l.x - cx, l.y - cy); g.restore(); }
      g.strokeStyle = 'rgba(170,190,220,.25)'; g.lineWidth = 1; g.beginPath();
      for (const r of this.rain) { g.moveTo(Math.round(r.x), Math.round(r.y)); g.lineTo(Math.round(r.x - 2), Math.round(r.y + 6)); }
      g.stroke();
    }
    this.drawOverlay(now);
  }
  // Speech bubble and the context prompt are HTML so the text stays crisp.
  drawOverlay(now) {
    const s = this.say, b = this.bubble;
    if (s && now < s.until) {
      const sx = (s.x - this.cam.x) / VIEW_W * 100, sy = (s.y - 46 - this.cam.y) / VIEW_H * 100;
      if (b.hidden || b.textContent !== s.text) { b.textContent = s.text; b.hidden = false; }
      b.style.left = `${clamp(sx, 12, 88)}%`; b.style.top = `${clamp(sy, 4, 90)}%`;
    } else if (!b.hidden) { b.hidden = true; this.say = null; }
    const n = this.nearby();
    let text = '';
    if (n && n.kind === 'npc') text = `E \u00B7 talk to ${npcName(n.id)} (${SHOPS[this.interiorId].label})`;
    else if (n && n.kind === 'folk') text = 'E \u00B7 talk';
    else if (n && n.kind === 'board') text = 'E \u00B7 read the contracts (Missions)';
    else if (this.interior) text = `${SHOPS[this.interiorId].name} \u00B7 exit at the bottom`;
    else {
      const p = this.player;
      const d = this.doors.find((dd) => Math.hypot(dd.front.x - p.x, dd.front.y - p.y) < 40);
      if (d) text = SHOPS[d.id] && SHOPS[d.id].label ? `${SHOPS[d.id].name} \u00B7 walk in for ${SHOPS[d.id].label}` : `${SHOPS[d.id].name}`;
    }
    if (this.prompt.textContent !== text) { this.prompt.textContent = text; this.prompt.hidden = !text; }
  }
}

const NPC_NAMES = { marrow: 'Marrow', ilse: 'Doc Ilse', handler: 'Cass', dispatcher: 'the dispatcher' };
const npcName = (id) => NPC_NAMES[id] || id;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampI = (v, a, b) => Math.max(a, Math.min(b, v | 0));
