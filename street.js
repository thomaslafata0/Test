// Kessa Yard: a side-on painted street and its single-screen interiors. Same public face as the old town.js.
// Three painted panels joined edge to edge scroll left and right; the bottom third is the pavement you walk on.
// Everything alive (rain, ripples, steam, lamps, neon, searchlight, embers, people) is drawn here in code over the art.
// The art lives in town/street/. A missing image gets a flat labelled placeholder, so nothing here depends on it.
import { play } from './audio.js';
import { sheetOf } from './stage.js';

const ART = 'town/street/';
const STREET_W = 2064, PANEL_W = 688, PANEL_H = 384;

// ---------- PLACES: every position in the street. Move things here, not in the code. ----------
// x values are street pixels (0 to 2064; panel 1 is 0-687, panel 2 is 688-1375, panel 3 is 1376-2063), or room pixels (0 to 688) in `interiors`.
// y values are panel pixels, 0 at the top and 384 at the bottom.
//   buildings: x is the whole front (tap it to walk to its door), door is the part you can enter or knock on, top is where its front starts when tapped.
//              knock: no inside; a prompt and lines or an action for the game.
//   spots:     x is where the player can use it and where a tap counts, y (optional, default tapY) is the height of that tap box.
//              lines, action or open as in the old hotspots; folk: hands over to that person.
//   folk:      x where they stand, h their height, wander (optional) a range they pace.
//   patrol:    x is the stretch of street they walk, h their height.
//   lights:    x, y, r (radius), color, kind: lamp | neon | fire | steady; pool: a glow and wet streak on the pavement under it.
//   steam, embers, puddles, dust (rooms only): where the small effects come from.
//   interiors: npc (id, x, h, optional y), spawn (x where you arrive), exit (x range; walking into it leaves), lights.
export const PLACES = {
  figure: 165,              // height of the player and partner, stage pixels
  floor: { wall: 256, y0: 304, y1: 328 }, // wall: where the pavement meets the buildings; y0-y1: the depth band feet can use
  walk: { speed: 170, depth: 60, margin: 28 }, // stage pixels a second; margin keeps you off the end pillars
  minViewH: 260,            // phones: the tallest whole-pixel scale that still shows at least this much of a panel, measured up from the pavement
  buildings: [
    { id: 'tenement_a', x: [1905, 2040], door: [1950, 1990], top: 60, knock: { prompt: 'knock', action: 'tenement_a' } },
    { id: 'market', x: [55, 287], door: [120, 220], top: 80 },
    { id: 'terminal', x: [830, 1010], door: [860, 970], top: 40 },
    { id: 'barracks', x: [1148, 1315], door: [1210, 1260], top: 60, knock: { prompt: 'knock', action: 'barracks' } },
    { id: 'clinic', x: [1437, 1623], door: [1530, 1568], top: 70 },
    { id: 'tenement_b', x: [1626, 1716], door: [1650, 1690], top: 60, knock: { prompt: 'knock', lines: ['The door is welded shut. Curfew rules.', 'Someone inside is singing, badly. You leave them to it.', 'A note on the door: GONE TO THE FOUNDRY. BACK NEVER.'] } },
    { id: 'safehouse', x: [1716, 1825], door: [1745, 1805], top: 70 },
  ],
  tapY: [120, 300],
  spots: [
    { id: 'noodles', x: [480, 620], y: [150, 310], folk: 'vendor' },
    { id: 'fire', x: [285, 340], y: [220, 320], prompt: 'warm your hands', lines: ['You warm your hands. The rain hisses on the rim.', 'Someone has burned a stack of ration cards in here.', 'Warm. For a moment nothing is chasing you.'] },
    { id: 'holosign', x: [232, 282], y: [110, 260], prompt: 'read the sign', lines: ['MARROW\u2019S. OPEN. (The word CLOSED flickers underneath.)', 'The sign buzzes: NO REFUNDS. NO RECEIPTS. NO RUNNING.'] },
    { id: 'vent', x: [2000, 2040], y: [240, 320], prompt: 'look at the vent', lines: ['Steam. The foundry runs under half the town now.', 'The vent sighs. It sounds tired.'] },
    { id: 'lockers', x: [1016, 1056], y: [170, 290], prompt: 'check the lockers', lines: ['Shift lockers, padlocked. One has a name you recognise from the wall.', 'Empty. Someone has scratched a tally of days into the door. It stops at ninety.'] },
    { id: 'poster', x: [365, 420], y: [150, 260], prompt: 'read the poster', lines: ['\u201CPRODUCTIVITY IS LOYALTY.\u201D Someone has drawn a moustache on the Supervisor.', '\u201CREPORT UNUSUAL MOVEMENT.\u201D Below it, in marker: \u201Clike your bowels?\u201D', '\u201CCURFEW: DUSK.\u201D The word DUSK has been scratched out and replaced with NEVER.', 'A reward notice. The face is smudged. Could be anyone. Could be you.'] },
    { id: 'noticeboard', x: [748, 813], y: [150, 280], prompt: 'read the board (Missions)', open: 'missions' },
    { id: 'vending', x: [1837, 1902], y: [160, 290], prompt: 'use the vending terminal (1 cr)', action: 'vending' },
    { id: 'crawler', x: [1062, 1120], y: [190, 310], prompt: 'look at the crawler', lines: ['A cargo crawler, three wheels and a prayer. Someone has keyed REPAIR ME into the door.', 'The crawler\u2019s cab smells of coolant and old noodles.'] },
    { id: 'tower', x: [1800, 1835], y: [40, 280], prompt: 'look up', lines: ['The water tower. The Directorate tested the water last month and nobody saw the results.', 'A kid has climbed it and painted a fist on the tank. Nobody has painted over it yet.'] },
  ],
  folk: [
    { id: 'vendor', x: 548, h: 152, talk: 'noodles', lines: ['Noodles. Real broth, mostly.', 'Two credits a bowl. Curfew prices.'] },
    { id: 'kid', x: 356, h: 104, wander: [344, 392], lines: ['Are you one of them? The cell?', 'I can run messages. I\u2019m fast.', 'My dad worked the casting floor. Before.', 'The guard\u2019s scared of the dark. I saw him.'] },
    { id: 'worker', x: 1130, h: 160, lines: ['Double shift again. The quota went up.', 'Crawler\u2019s been broken for a month. They fine us for it.', 'Heard someone hit the garrison last night. Wasn\u2019t me.', 'Don\u2019t stand near the vent. It bites.'] },
  ],
  patrol: { id: 'patrol', x: [840, 1560], h: 168, lines: ['Papers.', 'Curfew\u2019s at dusk. Move along.', 'Keep walking, citizen.', 'Nothing to see. Keep moving.'] },
  lights: [
    { x: 220, y: 157, r: 66, color: '#4fe0d0', kind: 'neon', pool: true },
    { x: 313, y: 277, r: 70, color: '#ff7a2a', kind: 'fire', pool: true },
    { x: 430, y: 150, r: 84, color: '#ffc27a', kind: 'lamp', pool: true },
    { x: 540, y: 247, r: 60, color: '#ff6a4a', kind: 'neon' },
    { x: 813, y: 117, r: 84, color: '#ffc27a', kind: 'lamp', pool: true },
    { x: 1212, y: 46, r: 64, color: '#ffd9a0', kind: 'lamp' },
    { x: 1456, y: 136, r: 54, color: '#ffb066', kind: 'steady' },
    { x: 1558, y: 154, r: 74, color: '#ff9a3a', kind: 'neon', pool: true },
    { x: 1870, y: 265, r: 56, color: '#7fd7ff', kind: 'steady', pool: true },
    { x: 1976, y: 154, r: 64, color: '#ffb066', kind: 'lamp' },
  ],
  steam: [{ x: 2018, y: 300, big: true }, { x: 540, y: 212 }],
  embers: { x: 313, y: 262 },
  puddles: [{ x: [120, 200], y: 348 }, { x: [540, 640], y: 356 }, { x: [920, 1020], y: 362 }, { x: [1400, 1470], y: 346 }, { x: [1700, 1800], y: 358 }],
  searchlight: { every: 21, sweep: 9 }, // seconds between passes, seconds a pass takes
  interiors: {
    terminal: { npc: { id: 'dispatcher', x: 470, h: 156 }, spawn: 130, exit: [0, 62], lights: [{ x: 344, y: 70, r: 150, color: '#9fc4ff', kind: 'lamp' }, { x: 560, y: 150, r: 70, color: '#59c7ff', kind: 'neon' }] },
    market: { npc: { id: 'marrow', x: 480, h: 160 }, spawn: 130, exit: [0, 62], lights: [{ x: 330, y: 80, r: 130, color: '#ffb066', kind: 'lamp' }, { x: 580, y: 140, r: 70, color: '#ff3d7a', kind: 'neon' }] },
    clinic: { npc: { id: 'ilse', x: 470, h: 152 }, spawn: 130, exit: [0, 62], lights: [{ x: 350, y: 66, r: 150, color: '#c8ffe6', kind: 'lamp' }] },
    safehouse: { npc: { id: 'handler', x: 470, h: 158 }, spawn: 130, exit: [0, 62], lights: [{ x: 340, y: 90, r: 130, color: '#ffc27a', kind: 'fire' }] },
  },
};

const FLOOR = PLACES.floor, FIG = PLACES.figure, MID_Y = (FLOOR.y0 + FLOOR.y1) / 2;
const SPEED = PLACES.walk.speed, DEPTH = PLACES.walk.depth;
const NEAR = 14;                 // how far past an x range still counts as next to it
const SPAWN_SPREAD = 3;          // index.html's spawnShift was in small-town pixels: stand co-op players side by side
const osCalm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let reduceMotion = osCalm;
export const setCalm = (on) => { reduceMotion = osCalm || on; };
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

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
// Interior NPC one-liners.
const INSIDE = {
  marrow: ['No receipts. No refunds. No questions.', 'Fresh stock after every job you pull.', 'I don\u2019t buy. I sell. Old kit goes on the heap.'],
  ilse: ['Sit. Don\u2019t bleed on the floor.', 'Hardware under the skin costs extra.', 'You again. Good. Means you\u2019re alive.'],
  handler: ['The cell remembers. Spend what you\u2019ve earned.', 'Training keeps the next one alive.', 'Too many eyes on you? I can make you disappear. For a price.'],
  dispatcher: ['Freight manifests, patrol rotas, the lot. Pick a target.', 'Contracts on the board. The cell pays.', 'The lift port\u2019s open once you\u2019ve been deep enough.'],
};
const NPC_NAMES = { marrow: 'Marrow', ilse: 'Doc Ilse', handler: 'Cass', dispatcher: 'the dispatcher' };
const npcName = (id) => NPC_NAMES[id] || id;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// How far x is outside a range (0 inside it), with a small pull to the middle so overlapping things pick the nearer one.
const rangeDist = (x, a, b) => Math.max(0, a - x, x - b) + Math.abs(x - (a + b) / 2) * 0.05;
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

function loadImg(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// A soft round sprite in one colour, made once. Drawn with drawImage so no gradient is built while the game runs.
const glowCache = {};
function glowSprite(color) {
  if (glowCache[color]) return glowCache[color];
  const c = makeCanvas(96, 96), g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  gr.addColorStop(0, color); gr.addColorStop(0.35, `${color}66`); gr.addColorStop(1, `${color}00`);
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  return (glowCache[color] = c);
}
function softBlack() {
  const c = makeCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}
function beamSprite() {
  const c = makeCanvas(160, 320), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 320, 0, 0);
  gr.addColorStop(0, 'rgba(200,220,255,.14)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
  g.fillStyle = gr;
  // Stacked wedges, narrowest last, for a soft edge.
  for (let i = 0; i < 6; i++) { const w = 80 - i * 13; g.beginPath(); g.moveTo(76, 320); g.lineTo(84, 320); g.lineTo(80 + w, 0); g.lineTo(80 - w, 0); g.closePath(); g.fill(); }
  return c;
}
// The band above the panels, only ever seen when a screen is taller than the art.
function skyBand() {
  const c = makeCanvas(1024, 160), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 160);
  gr.addColorStop(0, '#080a12'); gr.addColorStop(1, '#1a1a26');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#10121b';
  for (let x = 0, i = 0; x < 1024; i++) { const w = 26 + hash(i) * 50, h = 16 + hash(i + 40) * 66; g.fillRect(x, 160 - h, w, h); x += w; }
  g.fillStyle = 'rgba(255,190,110,.35)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.floor(hash(i + 90) * 1024), 90 + Math.floor(hash(i + 130) * 66), 2, 2);
  return c;
}

const LOW = { idle: { frames: 4, fps: 5 }, walk: { frames: 6, fps: 8 } }; // the old 64px sheets, the fallback until the high-res ones land
const LOW_FIG = 47, LOW_FEET = 59;

export class Town {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'town';
    this.el.innerHTML = `<canvas width="${PANEL_W}" height="${PANEL_H}" aria-label="Kessa Yard. Walk with arrow keys or WASD, or tap where to go. E or Space to talk." tabindex="0"></canvas>
      <div class="town-bubble" hidden></div><div class="town-bubble mate" hidden></div><div class="town-tag" hidden></div><div class="town-arrow" hidden><i>\u25B2</i><span></span></div><div class="town-prompt" hidden></div><div class="town-fade"></div>`;
    this.cv = this.el.querySelector('canvas');
    this.g = this.cv.getContext('2d', { alpha: false });
    this.bubble = this.el.querySelector('.town-bubble');
    this.mateBubble = this.el.querySelector('.town-bubble.mate');
    this.tag = this.el.querySelector('.town-tag');
    this.arrow = this.el.querySelector('.town-arrow');
    this.prompt = this.el.querySelector('.town-prompt');
    this.fade = this.el.querySelector('.town-fade');
    this.partner = null;    // the co-op partner: { x, y, tx, ty, dir, face, moving, scene, t, name, say }
    this.onMove = null;     // ({ x, y, dir, moving, scene }) => void, at most ten times a second and only on change
    this.onPartner = null;  // () => void, walking up to the partner and pressing E
    this.onOpen = null;     // (screen, shopId) => void
    this.onAction = null;   // (id) => { text, ok?, sfx? } from the game
    this.moveT = 0; this.moveKey = '';
    this.keys = new Set();
    this.blocked = false;
    this.scene = 'town';    // 'town' | 'interior:<id>'
    this.player = { x: PLACES.buildings.find((b) => b.id === 'safehouse').door[0] + 30, y: MID_Y, dir: 'down', face: 1, moving: false, t: 0, path: null, then: null };
    this.cam = { x: 0, y: 0 };
    this.vw = PANEL_W; this.vh = PANEL_H; this.s = 1;
    this.say = null;        // { text, x, y, until }
    this.offer = null;      // a yes/no waiting on Enter: { accept }
    this.stepT = 0;
    this.ready = true;      // nothing has to load before you can walk
    this.el.classList.add('ready');
    this.buildStreet();
    this.loadArt();
    this.bindInput();
    this.simT = 0;
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (this.el.isConnected) { try { this.fit(); this.update(dt); this.draw(t); } catch (e) { console.warn('street', e); } }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------- size ----------
  // The canvas is one backing pixel per device pixel, and the art is drawn at a whole number of them per stage pixel.
  fit() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    // A phone held sideways: fill the height of the screen so nothing scrolls. Otherwise the height is chosen to fit the art exactly.
    const sideways = window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
    const roomH = sideways ? Math.max(120, Math.floor(window.innerHeight - this.el.getBoundingClientRect().top - 10)) : 0;
    const cw = this.el.clientWidth, key = `${cw}:${roomH}:${dpr}`;
    if (!cw || key === this.fitKey) return;
    this.fitKey = key;
    let s, cssH;
    if (roomH) { cssH = roomH; s = Math.max(1, Math.floor(roomH * dpr / PLACES.minViewH)); }
    else { s = Math.max(1, Math.round(cw * (cw < 600 ? 0.78 : 0.56) * dpr / PANEL_H)); cssH = PANEL_H * s / dpr; }
    const W = Math.round(cw * dpr), H = Math.round(cssH * dpr);
    this.cv.width = W; this.cv.height = H;
    this.cv.style.aspectRatio = `${cw} / ${cssH}`;
    this.s = s; this.vw = W / s; this.vh = H / s;
    this.snapCamera();
  }
  get worldW() { return this.interior ? PANEL_W : STREET_W; }
  camTarget() {
    const W = this.worldW, p = this.player;
    if (W <= this.vw) return (W - this.vw) / 2;
    return clamp(p.x + p.face * Math.min(40, this.vw * 0.07) - this.vw / 2, 0, W - this.vw);
  }
  snapCamera() { this.cam.x = this.camTarget(); this.cam.y = PANEL_H - this.vh; }

  // ---------- art ----------
  async loadArt() {
    this.sprites = { shadow: softBlack(), beam: beamSprite() };
    this.baked = {}; this.art = {};
    const keys = [['street_1', 0], ['street_2', 1], ['street_3', 2], ['int_terminal', -1], ['int_market', -1], ['int_clinic', -1], ['int_safehouse', -1]];
    for (const [key, panel] of keys) {
      this.art[key] = 'loading';
      // A slow connection gets the placeholder after a few seconds; the real picture still replaces it when it arrives.
      setTimeout(() => { if (this.art[key] === 'loading') { this.art[key] = 'failed'; this.bake(key, panel, null); } }, 4000);
      loadImg(`${ART}${key}.png`).then((im) => { this.art[key] = im ? 'ok' : 'failed'; this.bake(key, panel, im); });
    }
  }
  // Each panel is flattened once with its wet sheen and lamp streaks, so a frame is only a few drawImage calls.
  bake(key, panel, im) {
    const c = makeCanvas(PANEL_W, PANEL_H), g = c.getContext('2d');
    if (im) g.drawImage(im, 0, 0, PANEL_W, PANEL_H);
    else if (panel >= 0) paintStreetPlaceholder(g, panel);
    else paintRoomPlaceholder(g, key.slice(4));
    if (panel >= 0) {
      const ox = panel * PANEL_W;
      const shade = g.createLinearGradient(0, FLOOR.wall, 0, PANEL_H);
      shade.addColorStop(0, 'rgba(6,8,16,0)'); shade.addColorStop(1, 'rgba(6,8,16,.3)');
      g.fillStyle = shade; g.fillRect(0, FLOOR.wall, PANEL_W, PANEL_H - FLOOR.wall);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const l of PLACES.lights) if (l.pool && l.x + l.r > ox && l.x - l.r < ox + PANEL_W) {
        // A long soft smear of the light on wet ground, starting at the foot of the wall.
        const w = l.r * 1.1, h = (PANEL_H - FLOOR.wall) * 2;
        g.save(); g.beginPath(); g.rect(0, FLOOR.wall, PANEL_W, PANEL_H - FLOOR.wall); g.clip();
        g.globalAlpha = 0.34; g.drawImage(glowSprite(l.color), l.x - ox - w / 2, FLOOR.wall - h * 0.28, w, h);
        g.restore();
      }
      g.restore();
    }
    this.baked[key] = c;
  }
  // The stage's sheets arrive after the page starts and may not exist at all, so this asks every time.
  hdOf(id) {
    const sh = id === 'player' ? this.playerHd : id === 'partner' ? this.partnerHd : sheetOf(id);
    return sh && sh.hd && sh.anims && sh.anims.idle && sh.fig ? sh : null;
  }
  // The old small sheets, fetched only for someone who has no high-res art.
  lowStrip(id, anim, dir) {
    const lows = this.lows || (this.lows = {}), key = `${id}:${anim}_${dir}`;
    if (!(key in lows)) { lows[key] = null; loadImg(`town/chars/${id}/${anim}_${dir}.png`).then((im) => { lows[key] = im; }); }
    return lows[key];
  }
  // Composited 64px strips from look.js for the fallback, and the high-res sheet from battleSheet when it exists.
  setPlayerSheets(sheets, hd) { this.playerSheets = sheets || null; this.playerHd = hd || null; }
  setPartnerSheets(sheets, hd) { this.partnerSheets = sheets || null; this.partnerHd = hd || null; }

  // ---------- world ----------
  buildStreet() {
    this.doors = PLACES.buildings.map((b) => ({ id: b.id, enterable: !b.knock && !!PLACES.interiors[b.id], x: b.door[0], y: FLOOR.y0, w: b.door[1] - b.door[0], h: FLOOR.y1 - FLOOR.y0, front: { x: (b.door[0] + b.door[1]) / 2, y: MID_Y }, knock: b.knock ? { id: b.id, door: true, ...b.knock } : null, b }));
    this.folk = PLACES.folk.map((f, i) => ({ ...f, y: MID_Y - 4 + (i % 3) * 3, face: -1, t: i * 1.3, pause: 1 + i, moving: false, goal: f.x, dir: 'left' }));
    const g = PLACES.patrol;
    this.patrol = { ...g, ends: g.x, x: g.x[0], y: MID_Y - 6, leg: 1, dir: 'right', face: 1, t: 0, pause: 0, moving: true };
    const count = coarse ? 36 : 54;
    this.rain = Array.from({ length: count }, (_, i) => ({ x: (i * 97) % 1000, y: (i * 41) % 500, v: 360 + (i % 5) * 70 }));
    this.ripples = Array.from({ length: 8 }, () => ({ age: 9, life: 1, x: 0, y: 0 }));
    this.puffs = Array.from({ length: 16 }, () => ({ age: 9, life: 1, x: 0, y: 0, vx: 0, vy: 0, size: 20 }));
    this.sparks = Array.from({ length: 14 }, () => ({ age: 9, life: 1, x: 0, y: 0, vx: 0, vy: 0 }));
    this.rippleT = 0; this.puffT = 0; this.sparkT = 0;
  }

  // ---------- scenes ----------
  spawnAt(where) {
    this.setScene('town');
    const d = this.doors.find((x) => x.id === where), p = this.player;
    if (d) { p.x = d.front.x; p.y = MID_Y; p.dir = 'down'; }
    if (this.spawnShift) p.x += this.spawnShift * SPAWN_SPREAD; // co-op: side by side, not stacked
    p.path = null; p.then = null; this.say = null; this.offer = null;
    this.snapCamera();
  }
  setScene(scene) { this.scene = scene; this.keys.clear(); }
  enter(door) {
    const it = PLACES.interiors[door.id];
    if (!it) return;
    play('door');
    this.flash();
    this.lastDoor = door;
    this.setScene(`interior:${door.id}`);
    const p = this.player;
    p.x = it.spawn; p.y = MID_Y; p.dir = 'right'; p.face = it.npc.x > it.spawn ? 1 : -1; p.path = null; p.then = null; this.say = null;
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
    if (d) { p.x = d.front.x; p.y = MID_Y; }
    p.dir = 'down'; p.path = null; p.then = null; this.say = null;
    this.snapCamera();
  }
  flash() { this.fade.classList.remove('on'); void this.fade.offsetWidth; this.fade.classList.add('on'); }
  get interior() { return this.scene.startsWith('interior:') ? PLACES.interiors[this.scene.slice(9)] : null; }
  get interiorId() { return this.scene.startsWith('interior:') ? this.scene.slice(9) : null; }

  // ---------- input ----------
  bindInput() {
    const DIR = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    window.addEventListener('keydown', (ev) => {
      if (!this.active || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      const k = ev.key.toLowerCase();
      if (DIR[k]) { this.keys.add(DIR[k]); this.player.path = null; this.player.then = null; ev.preventDefault(); }
      else if (k === 'e' || k === ' ' || k === 'enter') { this.interact(); if (k === ' ') ev.preventDefault(); }
      else if (k === 'escape' && this.offer) { this.offer = null; this.say = null; }
    });
    window.addEventListener('keyup', (ev) => { const k = DIR[ev.key.toLowerCase()]; if (k) this.keys.delete(k); });
    window.addEventListener('blur', () => this.keys.clear());
    this.cv.addEventListener('pointerdown', (ev) => {
      if (this.blocked) return;
      const r = this.cv.getBoundingClientRect();
      this.tapAt((ev.clientX - r.left) * (this.vw / r.width) + this.cam.x, (ev.clientY - r.top) * (this.vh / r.height) + this.cam.y);
    });
    // The prompt itself is a button on a touch screen: tapping it does what E does.
    this.prompt.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); if (this.active) this.interact(); });
  }
  get active() { return this.ready && this.el.isConnected && !this.blocked; }
  setBlocked(b) { this.blocked = b; if (b) { this.keys.clear(); this.player.path = null; this.player.then = null; } }

  // Who or what is next to the player that they could talk to or use. The nearest one wins.
  nearby() {
    const p = this.player, it = this.interior, m = this.partner;
    let best = null, bd = 1e9;
    const offer = (d, n) => { if (d < bd) { bd = d; best = n; } };
    if (m && this.onPartner && m.scene === this.scene && Math.abs(p.x - m.x) < 50 && Math.abs(p.y - m.y) < 40) offer(Math.abs(p.x - m.x) * 0.5, { kind: 'partner', who: m });
    if (it) {
      if (Math.abs(p.x - it.npc.x) < 72) offer(Math.abs(p.x - it.npc.x) * 0.5, { kind: 'npc', id: it.npc.id, x: it.npc.x, y: it.npc.y || MID_Y, opens: SHOPS[this.interiorId].opens });
      return best;
    }
    for (const f of this.folk) if (Math.abs(p.x - f.x) < 44) offer(Math.abs(p.x - f.x) * 0.5, { kind: 'folk', who: f });
    if (Math.abs(p.x - this.patrol.x) < 44) offer(Math.abs(p.x - this.patrol.x) * 0.5, { kind: 'folk', who: this.patrol });
    for (const h of PLACES.spots) if (p.x > h.x[0] - NEAR && p.x < h.x[1] + NEAR) offer(rangeDist(p.x, h.x[0], h.x[1]), this.spotNear(h));
    for (const d of this.doors) if (p.x > d.x - NEAR && p.x < d.x + d.w + NEAR) offer(rangeDist(p.x, d.x, d.x + d.w), this.doorNear(d));
    return best;
  }
  spotNear(h) {
    if (h.folk) return { kind: 'folk', who: this.folk.find((f) => f.id === h.folk) };
    return { kind: 'spot', spot: h, x: (h.x[0] + h.x[1]) / 2, y: MID_Y };
  }
  doorNear(d) {
    if (d.knock) return { kind: 'spot', spot: d.knock, x: d.front.x, y: MID_Y };
    return { kind: 'door', door: d };
  }
  interact() {
    if (this.offer) { const o = this.offer; this.offer = null; o.accept(); return true; }
    const n = this.nearby();
    if (!n) return false;
    this.use(n);
    return true;
  }
  use(n) {
    if (n.kind === 'partner') { if (this.onPartner) this.onPartner(); play('click'); return; }
    if (n.kind === 'door') { this.enter(n.door); return; }
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
  }
  speak(who, text, x, y, ms = 2800) { this.say = { text, x, y, until: performance.now() + ms }; }

  // A tap: a person, then a thing, then a building's front, and otherwise just walk there.
  tapAt(x, y) {
    const p = this.player, it = this.interior, m = this.partner;
    const onFigure = (f, h) => Math.abs(x - f.x) < Math.max(26, h * 0.26) && y > f.y - h && y < f.y + 14;
    const beside = (f) => f.x + (p.x < f.x ? -34 : 34);
    if (m && this.onPartner && m.scene === this.scene && onFigure(m, FIG)) { this.walkTo(beside(m), m.y, () => { if (m === this.partner && m.scene === this.scene) this.use({ kind: 'partner', who: m }); }); return; }
    if (it) {
      const n = it.npc;
      if (onFigure({ x: n.x, y: n.y || MID_Y }, n.h)) { this.walkTo(beside(n), MID_Y, () => this.use({ kind: 'npc', id: n.id, x: n.x, y: n.y || MID_Y, opens: SHOPS[this.interiorId].opens })); return; }
      if (this.offer) { this.offer = null; this.say = null; }
      if (x >= it.exit[0] && x <= it.exit[1]) { this.walkTo(it.exit[0] < 1 ? 0 : PANEL_W, MID_Y); return; }
      this.walkTo(x, y);
      return;
    }
    for (const f of [...this.folk, this.patrol]) if (onFigure(f, f.h)) { this.walkTo(beside(f), MID_Y, () => this.use({ kind: 'folk', who: f })); return; }
    if (this.offer) { this.offer = null; this.say = null; }
    for (const h of PLACES.spots) {
      const [y0, y1] = h.y || PLACES.tapY;
      if (x >= h.x[0] && x <= h.x[1] && y >= y0 && y <= y1) { this.walkTo(clamp(p.x, h.x[0] + 4, h.x[1] - 4), p.y, () => this.use(this.spotNear(h))); return; }
    }
    if (y < FLOOR.wall) for (const d of this.doors) {
      if (x >= d.b.x[0] && x <= d.b.x[1] && y >= d.b.top) { this.walkTo(d.front.x, p.y, () => this.tryDoor(d, true)); return; }
    }
    this.walkTo(x, y);
  }
  walkTo(x, y, then = null) {
    const p = this.player, w = this.interior ? 6 : PLACES.walk.margin;
    p.path = [[clamp(x, w, this.worldW - w), clamp(y, FLOOR.y0, FLOOR.y1)]];
    p.then = then;
  }
  tryDoor(d, tapped = false) {
    if (d.enterable) { this.enter(d); return true; }
    if (tapped || !this.lockedSaid || performance.now() - this.lockedSaid > 3000) { this.lockedSaid = performance.now(); this.use(this.doorNear(d)); }
    return false;
  }

  // ---------- simulation ----------
  update(dt) {
    const p = this.player, it = this.interior, margin = it ? 6 : PLACES.walk.margin;
    this.simT += dt;
    let mx = 0, my = 0;
    if (!this.blocked) {
      if (this.keys.has('left')) mx -= SPEED * dt;
      if (this.keys.has('right')) mx += SPEED * dt;
      if (this.keys.has('up')) my -= DEPTH * dt;
      if (this.keys.has('down')) my += DEPTH * dt;
      if (!mx && !my && p.path) {
        const dx = p.path[0][0] - p.x, dy = p.path[0][1] - p.y;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 2) { p.path = null; const f = p.then; p.then = null; if (f) f(); }
        else { mx = Math.sign(dx) * Math.min(Math.abs(dx), SPEED * dt); my = Math.sign(dy) * Math.min(Math.abs(dy), DEPTH * dt); }
      }
    }
    const W = this.worldW;
    const nx = clamp(p.x + mx, margin, W - margin), ny = clamp(p.y + my, FLOOR.y0, FLOOR.y1);
    const walked = Math.abs(nx - p.x) > 0.001 || Math.abs(ny - p.y) > 0.001;
    p.moving = walked && !this.blocked;
    if (p.moving) {
      if (mx) { p.dir = mx < 0 ? 'left' : 'right'; p.face = mx < 0 ? -1 : 1; } else p.dir = my < 0 ? 'up' : 'down';
      this.stepT -= dt;
      if (this.stepT <= 0) { play('step'); this.stepT = 0.32; }
    }
    p.x = nx; p.y = ny;
    if (!this.blocked) {
      if (it) {
        const left = it.exit[0] < 1;
        if (p.x >= it.exit[0] - 8 && p.x <= it.exit[1] + 8 && (left ? mx < 0 : mx > 0)) this.exit();
      } else if (this.keys.has('up')) {
        for (const d of this.doors) if (p.x > d.x && p.x < d.x + d.w) { this.tryDoor(d); break; }
      }
    }
    p.t += dt;
    this.updatePartner(dt);
    this.updateFolk(dt);
    const tx = this.camTarget();
    this.cam.x = reduceMotion ? tx : this.cam.x + (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y = PANEL_H - this.vh;
    if (!reduceMotion) this.updateEffects(dt);
  }
  updateFolk(dt) {
    for (const f of this.folk) {
      f.t += dt;
      if (!f.wander) continue;
      if (f.pause > 0) { f.pause -= dt; f.moving = false; continue; }
      const dx = f.goal - f.x;
      if (Math.abs(dx) < 2) { f.pause = 2 + hash(f.t) * 4; f.goal = f.wander[0] + hash(f.t + 5) * (f.wander[1] - f.wander[0]); f.moving = false; }
      else { f.x += Math.sign(dx) * 42 * dt; f.face = Math.sign(dx); f.moving = true; }
    }
    // The patrol walks its stretch of street and stops at each end to look about.
    const g = this.patrol;
    if (g && !this.interior) {
      g.t += dt;
      if (g.pause > 0) { g.pause -= dt; g.moving = false; }
      else {
        const dx = g.ends[g.leg] - g.x;
        if (Math.abs(dx) < 2) { g.leg = 1 - g.leg; g.pause = 1.2; g.moving = false; }
        else { g.x += Math.sign(dx) * 62 * dt; g.face = Math.sign(dx); g.dir = dx < 0 ? 'left' : 'right'; g.moving = true; }
      }
    }
  }
  updateEffects(dt) {
    const vw = this.vw, vh = this.vh;
    for (const r of this.rain) { r.y += r.v * dt; r.x -= r.v * 0.2 * dt; if (r.y > vh) { r.y = -14; r.x = Math.random() * (vw + 60); } if (r.x < -20) r.x += vw + 40; }
    if (this.interior) return;
    const cx = this.cam.x;
    // Ripples start in puddles that are on screen.
    this.rippleT -= dt;
    for (const r of this.ripples) r.age += dt;
    if (this.rippleT <= 0) {
      this.rippleT = 0.22;
      const seen = PLACES.puddles.filter((q) => q.x[1] > cx && q.x[0] < cx + vw), r = this.ripples.find((q) => q.age > q.life);
      if (seen.length && r) { const q = seen[Math.floor(Math.random() * seen.length)]; r.x = q.x[0] + Math.random() * (q.x[1] - q.x[0]); r.y = q.y + (Math.random() - 0.5) * 8; r.age = 0; r.life = 0.8 + Math.random() * 0.4; }
    }
    // Steam leaves the vents that are nearly on screen.
    this.puffT -= dt;
    for (const q of this.puffs) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    if (this.puffT <= 0) {
      this.puffT = 0.24;
      for (const v of PLACES.steam) if (v.x > cx - 120 && v.x < cx + vw + 120) {
        const q = this.puffs.find((o) => o.age > o.life);
        if (!q) break;
        q.x = v.x + (Math.random() - 0.5) * 14; q.y = v.y; q.vx = 4 + Math.random() * 10; q.vy = -(v.big ? 34 : 18) - Math.random() * 14; q.age = 0; q.life = v.big ? 2.8 : 1.6; q.size = v.big ? 34 : 18;
      }
    }
    // Embers off the burn barrel.
    const em = PLACES.embers;
    this.sparkT -= dt;
    for (const q of this.sparks) { q.age += dt; q.x += (q.vx + Math.sin(q.age * 5) * 12) * dt; q.y += q.vy * dt; }
    if (this.sparkT <= 0 && em.x > cx - 60 && em.x < cx + vw + 60) {
      this.sparkT = 0.18;
      const q = this.sparks.find((o) => o.age > o.life);
      if (q) { q.x = em.x + (Math.random() - 0.5) * 18; q.y = em.y; q.vx = (Math.random() - 0.5) * 16; q.vy = -28 - Math.random() * 40; q.age = 0; q.life = 1 + Math.random() * 1.2; }
    }
  }

  // ---------- co-op ----------
  // Where the partner says they are. null when they aren't in town.
  setPartner(m) {
    if (!m) { this.partner = null; return; }
    const o = this.partner, face = m.dir === 'left' ? -1 : m.dir === 'right' ? 1 : (o ? o.face : 1);
    if (!o || o.scene !== m.scene) this.partner = { x: m.x, y: m.y, tx: m.x, ty: m.y, dir: m.dir, face, moving: m.moving, scene: m.scene, t: 0, name: (o && o.name) || this.mateName || '', say: o && o.say };
    else Object.assign(o, { tx: m.x, ty: m.y, dir: m.dir, face, moving: m.moving });
  }
  partnerSay(text, ms = 3200) { if (this.partner) this.partner.say = { text, until: performance.now() + ms }; }
  resendMove() { this.moveKey = ''; }
  // Glide toward the last reported spot, and report our own when it changes.
  updatePartner(dt) {
    const m = this.partner;
    if (m) {
      m.t += dt;
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d > 320) { m.x = m.tx; m.y = m.ty; }
      else if (d > 0.5) { const step = Math.min(d, Math.max(SPEED * 1.15, d * 6) * dt); m.x += (dx / d) * step; m.y += (dy / d) * step; }
    }
    const p = this.player;
    this.moveT -= dt;
    if (!this.onMove || this.moveT > 0) return;
    const key = [Math.round(p.x), Math.round(p.y), p.dir, p.moving ? 1 : 0, this.scene].join();
    if (key === this.moveKey) return;
    this.moveKey = key; this.moveT = 0.1;
    this.onMove({ x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, moving: p.moving, scene: this.scene });
  }

  // ---------- figures ----------
  // The picture for someone this frame: which strip, which frame, how big, and which way it faces.
  pose(id, moving, dir, face, t, h, native) {
    const hd = this.hdOf(id);
    if (hd) {
      const walk = moving && hd.anims.walk, a = walk || hd.anims.idle, fw = a.img.width / a.frames, k = h / hd.fig;
      const f = reduceMotion && !moving ? 0 : Math.floor(t * (a.fps || 8)) % a.frames;
      const bob = moving && !walk && !reduceMotion ? -Math.abs(Math.sin(t * 9)) * 5 : 0;
      return { img: a.img, sx: Math.round(f * fw), sw: fw, sh: a.img.height, k, pad: a.pad || 0, mirror: face !== native, bob, smooth: true };
    }
    // Fallback: the old 64px figures.
    const anim = moving ? 'walk' : 'idle', sheets = id === 'player' ? this.playerSheets : id === 'partner' ? this.partnerSheets : null;
    const side = face < 0 ? 'left' : 'right', d = dir === 'up' || dir === 'down' ? dir : side;
    const k = h / LOW_FIG;
    if (sheets) {
      const a = sheets[`${anim}_${d}`] || sheets.idle_down;
      if (a) { const f = reduceMotion && !moving ? 0 : Math.floor(t * a.fps) % a.frames; return { img: a.img, sx: f * 64, sw: 64, sh: 64, k, pad: 64 - LOW_FEET, mirror: false, bob: 0, smooth: false }; }
    }
    const stock = id === 'partner' ? 'player' : id;
    let im = stock === 'player' || (stock === 'patrol' && moving) ? this.lowStrip(stock, anim, d) : null, L = LOW[anim];
    if (!im) { im = this.lowStrip(stock, 'idle', 'down'); L = LOW.idle; }
    if (!im) return null;
    const f = reduceMotion && !moving ? 0 : Math.floor(t * L.fps) % L.frames;
    const bob = moving && L === LOW.idle && !reduceMotion ? -Math.abs(Math.sin(t * 9)) * 5 : 0;
    return { img: im, sx: f * 64, sw: 64, sh: 64, k, pad: 64 - LOW_FEET, mirror: false, bob, smooth: false };
  }
  drawPose(o, x, y) {
    const g = this.g, w = o.sw * o.k, h = o.sh * o.k;
    g.imageSmoothingEnabled = o.smooth;
    if (o.mirror) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(o.img, o.sx, 0, o.sw, o.sh, -w / 2, y - h + o.pad * o.k + o.bob, w, h); g.restore(); }
    else g.drawImage(o.img, o.sx, 0, o.sw, o.sh, x - w / 2, y - h + o.pad * o.k + o.bob, w, h);
  }
  // Upside down and squashed, faintly, on the wet pavement.
  drawReflection(o, x, y) {
    const g = this.g, w = o.sw * o.k, h = o.sh * o.k;
    g.imageSmoothingEnabled = o.smooth;
    g.save(); g.globalAlpha = 0.14; g.translate(x, y + 2); g.scale(o.mirror ? -1 : 1, -0.38);
    g.drawImage(o.img, o.sx, 0, o.sw, o.sh, -w / 2, -h + o.pad * o.k, w, h);
    g.restore();
  }
  drawShadow(x, y, h) {
    const w = Math.max(44, h * 0.5), d = Math.max(10, h * 0.1);
    this.g.imageSmoothingEnabled = true;
    this.g.drawImage(this.sprites.shadow, x - w / 2, y - d / 2, w, d);
  }
  // Nothing at all to draw: a plain figure so nobody is ever invisible.
  drawBlank(x, y, h) {
    const g = this.g;
    g.fillStyle = '#23262e'; g.fillRect(x - h * 0.13, y - h * 0.82, h * 0.26, h * 0.82);
    g.fillStyle = '#39404c'; g.beginPath(); g.arc(x, y - h * 0.9, h * 0.1, 0, Math.PI * 2); g.fill();
  }

  // ---------- drawing ----------
  drawBack(key, x) {
    const g = this.g, im = this.baked && this.baked[key];
    if (im) { g.imageSmoothingEnabled = false; g.drawImage(im, x, 0); }
    else { g.fillStyle = '#10121a'; g.fillRect(x, 0, PANEL_W, PANEL_H); }
  }
  drawLight(l, i, t) {
    if (l.x + l.r < this.cam.x - 4 || l.x - l.r > this.cam.x + this.vw + 4) return;
    let a = 0.5;
    if (!reduceMotion) {
      if (l.kind === 'lamp') a = hash(i + Math.floor(t * 0.9)) < 0.06 && hash(i * 3 + Math.floor(t * 14)) < 0.5 ? 0.16 : 0.48 + 0.03 * Math.sin(t * 3 + i);
      else if (l.kind === 'neon') a = hash(i + Math.floor(t * 11)) < 0.05 ? 0.14 : 0.52 + 0.04 * Math.sin(t * 17 + i);
      else if (l.kind === 'fire') a = 0.46 + 0.14 * hash(i + Math.floor(t * 9));
    }
    const g = this.g;
    g.globalAlpha = a;
    g.drawImage(glowSprite(l.color), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    if (l.pool) { const w = l.r * 1.5, h = l.r * 0.32; g.globalAlpha = a * 0.55; g.drawImage(glowSprite(l.color), l.x - w / 2, FLOOR.y0 - h / 2 - 6, w, h); }
  }
  draw(now) {
    const g = this.g, t = now / 1000, s = this.s, it = this.interior, vw = this.vw, vh = this.vh;
    const cx = Math.round(this.cam.x * s) / s, cy = this.cam.y;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#07080c'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    if (it) this.drawBack(`int_${this.interiorId}`, 0);
    else {
      if (cy < 0) this.drawSky(cx, cy);
      for (let i = 0; i < 3; i++) { const x = i * PANEL_W; if (x < cx + vw && x + PANEL_W > cx) this.drawBack(`street_${i + 1}`, x); }
      this.drawSearchlight(t, cx);
    }
    // Light on the walls, then what's on the ground, then people, then what's in the air.
    g.globalCompositeOperation = 'lighter';
    g.imageSmoothingEnabled = true;
    const lights = it ? it.lights : PLACES.lights;
    for (let i = 0; i < lights.length; i++) this.drawLight(lights[i], i, t);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (!it && !reduceMotion) this.drawRipples();
    this.drawPeople(t, cx, it);
    g.imageSmoothingEnabled = true;
    if (!it) { if (!reduceMotion) this.drawAir(cx, cy); }
    else if (!reduceMotion) this.drawDust(t);
    g.globalAlpha = 1;
    this.drawOverlay(now);
  }
  drawSky(cx, cy) {
    const g = this.g, band = this.skyImg || (this.skyImg = skyBand());
    const h = -cy, off = ((cx * 0.3) % band.width + band.width) % band.width;
    g.imageSmoothingEnabled = false;
    for (let x = -off + cx; x < cx + this.vw; x += band.width) g.drawImage(band, x, -h, band.width, h);
  }
  // A searchlight far off, passing now and then across the top of the view.
  drawSearchlight(t, cx) {
    if (reduceMotion) return;
    const L = PLACES.searchlight, ph = t % L.every;
    if (ph > L.sweep) return;
    const q = ph / L.sweep, g = this.g, fade = Math.min(q, 1 - q) * 5;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, fade) * 0.16;
    g.imageSmoothingEnabled = true;
    g.translate(cx + this.vw * (1.2 - q * 1.4), 170);
    g.rotate(-0.55 + q * 1.1);
    g.drawImage(this.sprites.beam, -160, -420, 320, 420);
    g.restore();
  }
  drawRipples() {
    const g = this.g;
    g.strokeStyle = '#cfe0ff'; g.lineWidth = 1;
    for (const r of this.ripples) if (r.age < r.life) {
      const q = r.age / r.life, rad = 2 + q * 15;
      g.globalAlpha = (1 - q) * 0.42;
      g.beginPath(); g.ellipse(r.x, r.y, rad, rad * 0.32, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }
  drawPeople(t, cx, it) {
    const g = this.g, p = this.player, m = this.partner, list = this.people || (this.people = []);
    list.length = 0;
    const add = (id, x, y, h, moving, dir, face, time, native) => { if (x > cx - 200 && x < cx + this.vw + 200) list.push({ id, x, y, h, moving, dir, face, t: time, native }); };
    const toward = (x, near, dflt) => (Math.abs(p.x - x) < near ? (p.x < x ? -1 : 1) : dflt);
    if (it) { const n = it.npc; add(n.id, n.x, n.y || MID_Y - 8, n.h, false, 'down', toward(n.x, 9999, -1), t + 0.4, -1); }
    else {
      for (const f of this.folk) add(f.id, f.x, f.y, f.h, f.moving, f.dir, f.moving ? f.face : toward(f.x, 150, f.face), f.t, -1);
      const gd = this.patrol;
      add('patrol', gd.x, gd.y, gd.h, gd.moving, gd.dir, gd.face, gd.t, -1);
    }
    add('player', p.x, p.y, FIG, p.moving, p.dir, p.face, p.t, 1);
    if (m && m.scene === this.scene) add('partner', m.x, m.y, FIG, m.moving, m.dir, m.face, m.t, 1);
    list.sort((a, b) => a.y - b.y);
    for (const o of list) {
      o.h *= 1 + (o.y - MID_Y) * 0.002; // a touch bigger nearer the viewer
      o.pic = this.pose(o.id, o.moving, o.dir, o.face, o.t, o.h, o.native);
    }
    if (!it) for (const o of list) if (o.pic) this.drawReflection(o.pic, o.x, o.y);
    for (const o of list) this.drawShadow(o.x, o.y, o.h);
    for (const o of list) { if (o.pic) this.drawPose(o.pic, o.x, o.y); else this.drawBlank(o.x, o.y, o.h); }
  }
  drawAir(cx, cy) {
    const g = this.g, puff = glowSprite('#c8d2e0');
    for (const q of this.puffs) if (q.age < q.life) {
      const k = q.age / q.life, d = q.size * (0.6 + k * 1.6);
      g.globalAlpha = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.24;
      g.drawImage(puff, q.x - d / 2, q.y - d / 2, d, d);
    }
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ff9a3a';
    for (const q of this.sparks) if (q.age < q.life) { g.globalAlpha = 1 - q.age / q.life; g.fillRect(q.x, q.y, 2, 2); }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(170,190,225,.3)'; g.lineWidth = 1;
    g.beginPath();
    for (const r of this.rain) { const x = cx + r.x, y = cy + r.y; g.moveTo(x, y); g.lineTo(x - 2.6, y + 13); }
    g.stroke();
  }
  // A few motes turning in the light of a room. Their paths come from the clock, so there is nothing to keep.
  drawDust(t) {
    const g = this.g;
    g.fillStyle = '#e6dcc8';
    for (let i = 0; i < 10; i++) {
      const x = (hash(i) * PANEL_W + t * (4 + hash(i + 9) * 8) + Math.sin(t * 0.7 + i) * 8) % PANEL_W, y = 50 + hash(i + 20) * 230 + Math.sin(t * 0.5 + i * 2) * 10;
      g.globalAlpha = 0.14 + 0.14 * Math.sin(t + i);
      g.fillRect(x, y, 2, 2);
    }
    g.globalAlpha = 1;
  }

  // ---------- speech and prompts: HTML, so the text stays crisp ----------
  // Name over the partner's head, their speech, and an arrow at the edge when they're out of view.
  drawPartnerOverlay(now) {
    const m = this.partner, here = m && m.scene === this.scene;
    const hide = (el) => { if (!el.hidden) el.hidden = true; };
    if (!m) { hide(this.tag); hide(this.mateBubble); hide(this.arrow); return; }
    const pctX = (x) => (x - this.cam.x) / this.vw * 100, pctY = (y) => (y - this.cam.y) / this.vh * 100;
    let target = here ? m : null;
    // On the street, a partner who's indoors is pointed to by the door they went through.
    if (!here && !this.interior && m.scene.startsWith('interior:')) { const d = this.doors.find((dd) => dd.id === m.scene.slice(9)); if (d) target = d.front; }
    const inView = target && pctX(target.x) > 2 && pctX(target.x) < 98;
    if (here && inView) {
      const label = m.name || 'Partner';
      if (this.tag.textContent !== label) this.tag.textContent = label;
      this.tag.hidden = false;
      this.tag.style.left = `${clamp(pctX(m.x), 6, 94)}%`; this.tag.style.top = `${clamp(pctY(m.y - FIG - 4), 6, 96)}%`;
    } else hide(this.tag);
    if (m.say && now < m.say.until && here) {
      if (this.mateBubble.textContent !== m.say.text) this.mateBubble.textContent = m.say.text;
      this.mateBubble.hidden = false;
      this.mateBubble.style.left = `${clamp(pctX(m.x), 12, 88)}%`; this.mateBubble.style.top = `${clamp(pctY(m.y - FIG - 12), 14, 90)}%`;
    } else hide(this.mateBubble);
    if (target && !inView) {
      const left = pctX(target.x) < 50;
      this.arrow.hidden = false;
      this.arrow.style.left = left ? '4%' : '96%'; this.arrow.style.top = '46%';
      this.arrow.firstChild.style.transform = `rotate(${left ? -90 : 90}deg)`;
      const label = m.name || 'Partner';
      if (this.arrow.lastChild.textContent !== label) this.arrow.lastChild.textContent = label;
    } else hide(this.arrow);
  }
  drawOverlay(now) {
    const s = this.say, b = this.bubble;
    if (s && now < s.until) {
      const sx = (s.x - this.cam.x) / this.vw * 100, sy = (s.y - FIG - 8 - this.cam.y) / this.vh * 100;
      if (b.hidden || b.textContent !== s.text) { b.textContent = s.text; b.hidden = false; }
      b.style.left = `${clamp(sx, 12, 88)}%`; b.style.top = `${clamp(sy, 22, 90)}%`;
    } else if (!b.hidden) { b.hidden = true; this.say = null; }
    this.drawPartnerOverlay(now);
    const n = this.nearby(), E = coarse ? 'Tap here' : 'E';
    let text = '', act = true;
    if (this.offer) text = coarse ? 'Tap here \u00B7 yes \u00B7 tap the street \u00B7 no' : 'Enter \u00B7 yes \u00B7 Esc \u00B7 no';
    else if (n && n.kind === 'partner') text = `${E} \u00B7 trade or give to ${n.who.name || 'your partner'}`;
    else if (n && n.kind === 'npc') text = `${E} \u00B7 talk to ${npcName(n.id)} (${SHOPS[this.interiorId].label})`;
    else if (n && n.kind === 'folk') text = n.who.talk ? `${E} \u00B7 talk to the vendor` : `${E} \u00B7 talk`;
    else if (n && n.kind === 'spot') text = `${E} \u00B7 ${n.spot.prompt}`;
    else if (n && n.kind === 'door') { const sh = SHOPS[n.door.id]; text = coarse ? `${E} \u00B7 ${sh.name} (${sh.label})` : `${E} \u00B7 ${sh.name} \u00B7 walk in for ${sh.label}`; }
    else {
      act = false;
      if (this.interior) {
        const side = this.interior.exit[0] < 1 ? 'left' : 'right', who = npcName(this.interior.npc.id);
        text = coarse ? `Talk to ${who} \u00B7 walk ${side} to leave` : `${SHOPS[this.interiorId].name} \u00B7 talk to ${who} \u00B7 Esc or walk ${side} to leave`;
      }
      else {
        const p = this.player, d = this.doors.find((dd) => Math.abs(dd.front.x - p.x) < 70);
        if (d) text = SHOPS[d.id] && SHOPS[d.id].label ? `${SHOPS[d.id].name} \u00B7 walk in for ${SHOPS[d.id].label}` : SHOPS[d.id].name;
      }
    }
    if (this.prompt.textContent !== text) { this.prompt.textContent = text; this.prompt.hidden = !text; }
    if (act !== this.promptAct) { this.promptAct = act; this.prompt.classList.toggle('act', act); }
  }
}

// ---------- placeholders: flat, labelled, only seen until the painted art is in town/street/ ----------
const label = (g, text, x, y, size = 13) => {
  g.font = `${size}px ui-monospace, Menlo, monospace`; g.textAlign = 'center';
  g.fillStyle = '#0a0b10'; g.fillText(text, x + 1, y + 1);
  g.fillStyle = '#c9cfdb'; g.fillText(text, x, y);
};
function paintStreetPlaceholder(g, panel) {
  const ox = panel * PANEL_W, sky = g.createLinearGradient(0, 0, 0, FLOOR.wall);
  sky.addColorStop(0, '#0d1018'); sky.addColorStop(1, '#22242f');
  g.fillStyle = sky; g.fillRect(0, 0, PANEL_W, FLOOR.wall);
  const pave = g.createLinearGradient(0, FLOOR.wall, 0, PANEL_H);
  pave.addColorStop(0, '#2d303a'); pave.addColorStop(1, '#1b1d25');
  g.fillStyle = pave; g.fillRect(0, FLOOR.wall, PANEL_W, PANEL_H - FLOOR.wall);
  g.fillStyle = '#11131a'; g.fillRect(0, FLOOR.wall, PANEL_W, 4);
  g.fillStyle = 'rgba(255,255,255,.04)';
  for (let x = 0; x < PANEL_W; x += 86) g.fillRect(x, FLOOR.wall + 4, 1, PANEL_H);
  g.font = '13px ui-monospace, Menlo, monospace';
  PLACES.buildings.forEach((b, i) => {
    const x = b.x[0] - ox, w = b.x[1] - b.x[0];
    if (x > PANEL_W || x + w < 0) return;
    g.fillStyle = ['#343745', '#3a3438', '#2f3a44', '#3d3a33'][i % 4]; g.fillRect(x, b.top, w, FLOOR.wall - b.top);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, b.top, w, 8);
    g.fillStyle = 'rgba(255,205,130,.22)';
    for (let wy = b.top + 24; wy < FLOOR.wall - 130; wy += 44) for (let wx = x + 16; wx < x + w - 24; wx += 46) g.fillRect(wx, wy, 22, 22);
    const dx = b.door[0] - ox, dw = b.door[1] - b.door[0], dh = 120;
    g.fillStyle = PLACES.interiors[b.id] && !b.knock ? '#5a4a2e' : '#1b1c22'; g.fillRect(dx, FLOOR.wall - dh, dw, dh);
    g.strokeStyle = '#0c0d12'; g.lineWidth = 2; g.strokeRect(dx, FLOOR.wall - dh, dw, dh);
    label(g, SHOPS[b.id].name.split(' ').slice(-2).join(' '), x + w / 2, FLOOR.wall - dh - 10);
  });
  for (const h of PLACES.spots) {
    const x = h.x[0] - ox, w = h.x[1] - h.x[0], [y0, y1] = h.y || PLACES.tapY;
    if (x > PANEL_W || x + w < 0 || h.folk) continue;
    g.fillStyle = 'rgba(120,135,160,.3)'; g.fillRect(x, Math.max(y0, 170), w, Math.min(y1, FLOOR.wall + 30) - Math.max(y0, 170));
    label(g, h.id, x + w / 2, Math.max(y0, 170) + 14, 11);
  }
  g.fillStyle = '#0b0c11'; g.fillRect(0, 0, 18, PANEL_H); g.fillRect(PANEL_W - 18, 0, 18, PANEL_H);
}
function paintRoomPlaceholder(g, id) {
  const wall = g.createLinearGradient(0, 0, 0, FLOOR.wall);
  wall.addColorStop(0, '#1a1c25'); wall.addColorStop(1, '#2c2d38');
  g.fillStyle = wall; g.fillRect(0, 0, PANEL_W, FLOOR.wall);
  g.fillStyle = '#23242d'; g.fillRect(0, FLOOR.wall, PANEL_W, PANEL_H - FLOOR.wall);
  g.fillStyle = '#0f1016'; g.fillRect(0, FLOOR.wall, PANEL_W, 3);
  const it = PLACES.interiors[id];
  if (it) {
    const left = it.exit[0] < 1;
    g.fillStyle = '#4a3e2a'; g.fillRect(left ? 8 : PANEL_W - 60, FLOOR.wall - 140, 52, 140);
    label(g, 'EXIT', left ? 34 : PANEL_W - 34, FLOOR.wall - 150, 12);
  }
  label(g, (SHOPS[id] || { name: id }).name, PANEL_W / 2, 58, 15);
}
