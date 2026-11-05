// Kessa Yard: the walkable top-down town and its walk-in interiors.
// Canvas scene with camera follow, arrow/WASD and tap-to-walk, collisions, depth sorting,
// door zones into interiors, NPC one-liners and a patrolling guard. Art comes from town/manifest.json.
import { play } from './audio.js';

const BASE = 'town/';
const T = 32;                      // tile size
let VIEW_W = 416, VIEW_H = 256;    // native resolution; resized to a whole-pixel scale of the element's width
const MAP_COLS = 22, MAP_ROWS = 16, MAP_W = MAP_COLS * T, MAP_H = MAP_ROWS * T;
const CELL = 8;                    // collision grid
const SPEED = 84;                  // px per second
const FEET = { x: 32, y: 59 };     // feet position inside a 64x64 frame
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- layout (top-left of each image, world pixels). A tight yard: the four shops ring one plaza. ----------
const BUILDINGS = [
  { id: 'tenement_a', x: 36, y: 0 },
  { id: 'terminal', x: 224, y: 0 },
  { id: 'tenement_b', x: 512, y: 0 },
  { id: 'market', x: 16, y: 166 },
  { id: 'clinic', x: 528, y: 166 },
  { id: 'barracks', x: 16, y: 340 },
  { id: 'safehouse', x: 528, y: 336 },
];
// What each building is. opens: the menu its NPC opens. auto: the menu opens as soon as you walk in.
export const SHOPS = {
  terminal: { name: 'Freight terminal', opens: 'missions', label: 'Missions', auto: true },
  market: { name: 'Marrow\u2019s container', opens: 'market', label: 'Black Market' },
  clinic: { name: 'Doc Ilse\u2019s clinic', opens: 'clinic', label: 'Clinic' },
  safehouse: { name: 'The safehouse', opens: 'character', label: 'Character & Resolve' },
  barracks: { name: 'Directorate barracks', hotspot: 'barracks' },
  tenement_a: { name: 'Tenement', hotspot: 'tenement_a' },
  tenement_b: { name: 'Tenement', hotspot: 'tenement_b' },
};
const PROPS = [
  ['noticeboard', 176, 186], ['queue_barrier', 252, 214], ['queue_barrier', 392, 214], ['holosign', 100, 150], ['console', 476, 190],
  ['streetlamp', 236, 258], ['streetlamp', 452, 258], ['streetlamp', 236, 420], ['streetlamp', 452, 420],
  ['poster_wall', 212, 336], ['vending_terminal', 500, 300], ['junction_box', 500, 332],
  ['crate', 388, 452], ['cargo_crate', 420, 452], ['barrels', 356, 462], ['cargo_crawler', 436, 376],
  ['noodle_stall', 272, 444], ['barrel_fire', 244, 476], ['trash_pile', 180, 470], ['lockers', 200, 300],
  ['water_tower', 672, 440], ['antenna', 680, 160], ['sat_dish', 8, 310], ['fuel_tank', 680, 250], ['air_unit', 200, 20], ['generator', 680, 20],
  ['steam_vent', 320, 300], ['cargo_pile', 640, 60],
];
const LAMPS = [[236, 258], [452, 258], [236, 420], [452, 420]];
// Townsfolk: feet position and what they say. talk: a hotspot id for something to do.
const TOWNSFOLK = [
  { id: 'vendor', x: 304, y: 500, talk: 'noodles', lines: ['Noodles. Real broth, mostly.', 'Two credits a bowl. Curfew prices.'] },
  { id: 'worker', x: 400, y: 490, lines: ['Double shift again. The quota went up.', 'Crawler\u2019s been broken for a month. They fine us for it.', 'Heard someone hit the garrison last night. Wasn\u2019t me.', 'Don\u2019t stand near the vent. It bites.'] },
  { id: 'kid', x: 228, y: 500, lines: ['Are you one of them? The cell?', 'I can run messages. I\u2019m fast.', 'My dad worked the casting floor. Before.', 'The guard\u2019s scared of the dark. I saw him.'] },
];
const PATROL = { id: 'patrol', route: [[300, 260], [420, 260], [420, 420], [300, 420]], lines: ['Papers.', 'Curfew\u2019s at dusk. Move along.', 'Keep walking, citizen.', 'Nothing to see. Keep moving.'] };
// Things in the yard you can poke at. Each has a position, a radius, a prompt and either lines or an action for the game.
const HOTSPOTS = [
  { id: 'noticeboard', x: 208, y: 248, r: 30, prompt: 'read the board (Missions)', open: 'missions' },
  { id: 'poster', x: 244, y: 398, r: 26, prompt: 'read the poster', lines: ['\u201CPRODUCTIVITY IS LOYALTY.\u201D Someone has drawn a moustache on the Supervisor.', '\u201CREPORT UNUSUAL MOVEMENT.\u201D Below it, in marker: \u201Clike your bowels?\u201D', '\u201CCURFEW: DUSK.\u201D The word DUSK has been scratched out and replaced with NEVER.', 'A reward notice. The face is smudged. Could be anyone. Could be you.'] },
  { id: 'vending', x: 516, y: 332, r: 26, prompt: 'use the vending terminal (1 cr)', action: 'vending' },
  { id: 'fire', x: 260, y: 508, r: 24, prompt: 'warm your hands', lines: ['You warm your hands. The rain hisses on the rim.', 'Someone has burned a stack of ration cards in here.', 'Warm. For a moment nothing is chasing you.'] },
  { id: 'holosign', x: 132, y: 190, r: 26, prompt: 'read the sign', lines: ['MARROW\u2019S. OPEN. (The word CLOSED flickers underneath.)', 'The sign buzzes: NO REFUNDS. NO RECEIPTS. NO RUNNING.'] },
  { id: 'crawler', x: 468, y: 436, r: 30, prompt: 'look at the crawler', lines: ['A cargo crawler, three wheels and a prayer. Someone has keyed REPAIR ME into the door.', 'The crawler\u2019s cab smells of coolant and old noodles.'] },
  { id: 'vent', x: 336, y: 328, r: 22, prompt: 'look at the vent', lines: ['Steam. The foundry runs under half the town now.', 'The vent sighs. It sounds tired.'] },
  { id: 'lockers', x: 216, y: 330, r: 22, prompt: 'check the lockers', lines: ['Shift lockers, padlocked. One has a name you recognise from the wall.', 'Empty. Someone has scratched a tally of days into the door. It stops at ninety.'] },
  { id: 'tower', x: 704, y: 500, r: 30, prompt: 'look up', lines: ['The water tower. The Directorate tested the water last month and nobody saw the results.', 'A kid has climbed it and painted a fist on the tank. Nobody has painted over it yet.'] },
  // Buildings with no inside.
  { id: 'barracks', door: true, prompt: 'knock', action: 'barracks' },
  { id: 'tenement_a', door: true, prompt: 'knock', action: 'tenement_a' },
  { id: 'tenement_b', door: true, prompt: 'knock', lines: ['The door is welded shut. Curfew rules.', 'Someone inside is singing, badly. You leave them to it.', 'A note on the door: GONE TO THE FOUNDRY. BACK NEVER.'] },
];
// Interior NPC one-liners.
const INSIDE = {
  marrow: ['No receipts. No refunds. No questions.', 'Fresh stock after every job you pull.', 'I don\u2019t buy. I sell. Old kit goes on the heap.'],
  ilse: ['Sit. Don\u2019t bleed on the floor.', 'Hardware under the skin costs extra.', 'You again. Good. Means you\u2019re alive.'],
  handler: ['The cell remembers. Spend what you\u2019ve earned.', 'Training keeps the next one alive.', 'Too many eyes on you? I can make you disappear. For a price.'],
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
    this.offer = null;      // a yes/no waiting on Enter: { accept }
    this.onAction = null;   // (id) => { text, ok?, sfx? } from the game
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
    const corner = (cx, cy) => (cx >= 1 && cx <= MAP_COLS - 1 && cy >= 1 && cy <= MAP_ROWS - 1 ? 'metal_deck' : 'sand');
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
    this.objects = []; this.blocks = []; this.doors = []; this.masks = [];
    for (const b of BUILDINGS) {
      const info = m.buildings[b.id], im = this.img[`b:${b.id}`];
      if (!info || !im) continue;
      const doorBottom = b.y + info.door.y + info.door.h;
      this.objects.push({ kind: 'building', bid: b.id, im, x: b.x, y: b.y, sortY: doorBottom });
      // Footprint from the art itself: opaque pixels in the lower part of the image block, except the doorway.
      // Below the door's bottom edge, the strip around the door is ground detail (rails, dirt) and stays walkable.
      this.masks.push({ x: b.x, y: b.y, w: info.w, h: info.h, top: Math.round(info.h * 0.28), bottom: info.door.y + info.door.h + 2, alpha: alphaOf(im), door: { x: info.door.x - 6, y: info.door.y, w: info.door.w + 12 } });
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
      if (floor) { const ex = this.m.interiors[scene.slice(9)].exit; if (x >= ex.x - 12 && x <= ex.x + ex.w + 12 && y >= ex.y && y <= ex.y + ex.h) open = true; }
      if (open) for (const b of rects) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { open = false; break; }
      if (open && scene === 'town') for (const mk of this.masks) {
        const lx = x - mk.x, ly = y - mk.y;
        if (lx < 0 || ly < mk.top || lx >= mk.w || ly >= mk.h) continue;
        if (ly >= mk.bottom && lx >= mk.door.x - 48 && lx <= mk.door.x + mk.door.w + 48) continue;
        if (lx >= mk.door.x && lx <= mk.door.x + mk.door.w && ly >= mk.door.y) continue;
        let hits = 0;
        for (const [dx, dy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) { const px = lx + dx, py = ly + dy; if (px >= 0 && py >= 0 && px < mk.w && py < mk.h && mk.alpha[py * mk.w + px]) hits++; }
        if (hits >= 3) { open = false; break; }
      }
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
    p.path = null; p.goal = null; this.say = null; this.offer = null;
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
    // Only the freight terminal opens its menu as you walk in; everywhere else you talk to the person inside.
    if (shop && shop.auto && this.onOpen) setTimeout(() => this.onOpen(shop.opens, door.id), 180);
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
      else if (k === 'e' || k === ' ' || k === 'enter') { this.interact(); if (k === ' ') ev.preventDefault(); }
      else if (k === 'escape' && this.offer) { this.offer = null; this.say = null; }
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
    for (const h of HOTSPOTS) {
      if (h.door) { const d = this.doors.find((dd) => dd.id === h.id); if (d && near(d.front.x, d.front.y, 22)) return { kind: 'spot', spot: h, x: d.front.x, y: d.front.y - 20 }; }
      else if (near(h.x, h.y, h.r)) return { kind: 'spot', spot: h, x: h.x, y: h.y - 16 };
    }
    return null;
  }
  interact() {
    if (this.offer) { const o = this.offer; this.offer = null; o.accept(); return true; }
    const n = this.nearby();
    if (!n) return false;
    if (n.kind === 'npc') {
      this.speak(n.id, pick(INSIDE[n.id] || ['...']), n.x, n.y);
      if (this.onOpen) this.onOpen(n.opens, this.interiorId);
    } else if (n.kind === 'folk') {
      const f = n.who;
      if (f.talk === 'noodles') {
        const can = this.onAction ? this.onAction('noodles:can') : null;
        if (can && can.ok) { this.speak(f.id, `A bowl? ${can.text}`, f.x, f.y, 6000); this.offer = { accept: () => { const r = this.onAction('noodles'); this.speak(f.id, r ? r.text : 'Yum.', f.x, f.y); play('coin'); } }; }
        else this.speak(f.id, can ? can.text : pick(f.lines), f.x, f.y);
      } else this.speak(f.id, pick(f.lines), f.x, f.y);
      play('click');
    } else if (n.kind === 'spot') {
      const h = n.spot;
      if (h.open) { if (this.onOpen) this.onOpen(h.open, 'terminal'); }
      else if (h.action) { const r = this.onAction ? this.onAction(h.action) : null; this.speak(h.id, r ? r.text : '...', n.x, n.y); play(r && r.sfx ? r.sfx : 'click'); }
      else { this.speak(h.id, pick(h.lines), n.x, n.y); play('click'); }
    }
    return true;
  }
  speak(who, text, x, y, ms = 2800) { this.say = { text, x, y, until: performance.now() + ms }; }

  tapAt(x, y) {
    const p = this.player;
    const it = this.interior;
    // Tap a person: walk next to them and talk.
    const targets = it ? [{ x: it.npc.x, y: it.npc.y, talk: true }] : [...this.folk, this.patrol].map((f) => ({ x: f.x, y: f.y, talk: true }));
    for (const t of targets) if (Math.abs(x - t.x) < 14 && y > t.y - 44 && y < t.y + 4) { this.walkTo(t.x, t.y + 14, () => this.interact()); return; }
    if (this.offer) { this.offer = null; this.say = null; }
    if (!it) for (const h of HOTSPOTS) if (!h.door && Math.hypot(x - h.x, y - (h.y - 12)) < h.r) { this.walkTo(h.x, h.y + 4, () => this.interact()); return; }
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
    if (tapped || !this.lockedSaid || performance.now() - this.lockedSaid > 3000) { this.lockedSaid = performance.now(); this.interact(); }
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
        if (p.x > ex.x - 12 && p.x < ex.x + ex.w + 12 && p.y > ex.y + 4 && vy > 0) this.exit();
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
  // Composited look strips from look.js ({ idle_down: { img, frames, fps }, ... }) replace the stock player sheets.
  setPlayerSheets(sheets) { this.playerSheets = sheets || null; }
  sprite(id, anim, dir, x, y, t) {
    const a = this.m.chars[id] && this.m.chars[id].anims[anim];
    const custom = id === 'player' && this.playerSheets && (this.playerSheets[`${anim}_${dir}`] || this.playerSheets.idle_down);
    if (custom) { const f = Math.floor(t * custom.fps) % custom.frames; this.g.drawImage(custom.img, f * 64, 0, 64, 64, Math.round(x - FEET.x - this.cam.x), Math.round(y - FEET.y - this.cam.y), 64, 64); return; }
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
    if (this.offer) text = 'Enter \u00B7 yes \u00B7 Esc \u00B7 no';
    else if (n && n.kind === 'npc') text = `E \u00B7 talk to ${npcName(n.id)} (${SHOPS[this.interiorId].label})`;
    else if (n && n.kind === 'folk') text = n.who.talk ? 'E \u00B7 talk to the vendor' : 'E \u00B7 talk';
    else if (n && n.kind === 'spot') text = `E \u00B7 ${n.spot.prompt}`;
    else if (n && n.kind === 'board') text = 'E \u00B7 read the contracts (Missions)';
    else if (this.interior) text = `${SHOPS[this.interiorId].name} \u00B7 talk to ${npcName(this.interior.npc.id)} \u00B7 Esc or the bottom door to leave`;
    else {
      const p = this.player;
      const d = this.doors.find((dd) => Math.hypot(dd.front.x - p.x, dd.front.y - p.y) < 40);
      if (d) text = SHOPS[d.id] && SHOPS[d.id].label ? `${SHOPS[d.id].name} \u00B7 walk in for ${SHOPS[d.id].label}` : SHOPS[d.id].name;
    }
    if (this.prompt.textContent !== text) { this.prompt.textContent = text; this.prompt.hidden = !text; }
  }
}

// Alpha channel of an image as a Uint8Array (1 = opaque), for footprint collision.
function alphaOf(im) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, im.width, im.height).data, out = new Uint8Array(im.width * im.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  return out;
}
const NPC_NAMES = { marrow: 'Marrow', ilse: 'Doc Ilse', handler: 'Cass', dispatcher: 'the dispatcher' };
const npcName = (id) => NPC_NAMES[id] || id;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampI = (v, a, b) => Math.max(a, Math.min(b, v | 0));
