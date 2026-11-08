// Kessa Yard: one painted courtyard that fits on screen whole, and the single-screen interiors. Same public face as street.js.
// Nothing scrolls. The picture is scaled to contain at any fractional scale, so both co-op players are always in view.
// Walking is free in 2D over a polygon. Name signs float over every destination, and tapping a sign or a building walks there and goes in.
// The art lives in town/street/. A missing image gets a flat labelled placeholder, so nothing here depends on it.
// To line PLACES up against the art, run `cinderTown.debug = true` in the console: it draws the area, doors, spots and tap boxes.
import { play } from './audio.js';
import { sheetOf, ensureSheet } from './stage.js';

const ART = 'town/street/';
const VIEW_W = 688, VIEW_H = 384;

// ---------- PLACES: every position in the yard. Move things here, not in the code. ----------
// All numbers are image pixels of yard.png (or of a room image in `interiors`): x 0-688, y 0-384.
//   figure:    height of the player and partner at scale 1 (the near edge of the plaza).
//   depth:     yFar, yNear, far, near. Everyone is scaled by y between these.
//   walk:      area is the polygon feet can stand in. blocks are optional [x0, y0, x1, y1] rectangles taken out of it.
//              speed is pixels a second going sideways, ySpeed the fraction of that going straight up or down.
//              near is how close to a door or spot's stand point the prompt appears.
//   buildings: box [x0, y0, x1, y1] is the tap area. door [x, y] is the point on the ground you walk to.
//              push [x, y] is the way you walk to go through the door by keys or drag. sign is the floating name (omit for none).
//              knock: no inside; a prompt and lines or an action for the game.
//   spots:     x, y, r are the thing and its tap circle. stand [x, y] is where you use it from (default: nearest ground).
//              lines, action or open as in the old hotspots; folk: hands over to that person. sign: as for buildings.
//   folk:      x, y where they stand, h height at scale 1, wander (optional) { x: [a, b], y: [c, d] }.
//   patrol:    route is a loop of points they walk, h height at scale 1.
//   lights:    x, y, r (radius), color, kind: lamp | neon | fire | steady; a is how strong (the door light is already painted, so keep these faint).
//   steam, embers, puddles, dust (rooms only): where the small effects come from.
//   room:      how walking works inside. interiors: npc (id, x, h, optional y), spawn (x where you arrive), exit (x range; walking into it leaves), lights.
export const PLACES = {
  figure: 138,
  depth: { yFar: 150, yNear: 384, far: 0.62, near: 1 },
  walk: {
    speed: 170, ySpeed: 0.8, near: 34, enter: 20,
    area: [[222, 156], [300, 148], [410, 148], [490, 176], [530, 180], [548, 198], [578, 212], [478, 238], [470, 350], [604, 374], [604, 384], [118, 384], [122, 322], [160, 272], [168, 248], [192, 232], [192, 200], [200, 170]],
    blocks: [],
  },
  // Checked in this order when tapped, so a box that overlaps another must come first.
  buildings: [
    { id: 'terminal', box: [258, 20, 445, 148], door: [355, 152], push: [0, -1], sign: { x: 355, y: 72 } },
    { id: 'barracks', box: [140, 75, 218, 150], door: [210, 168], push: [0, -1], sign: { x: 205, y: 84, text: 'Barracks', minor: true }, knock: { prompt: 'knock', action: 'barracks' } },
    { id: 'clinic', box: [480, 80, 610, 178], door: [518, 184], push: [0, -1], sign: { x: 525, y: 72 } },
    { id: 'safehouse', box: [598, 140, 688, 232], door: [570, 210], push: [1, -0.3], sign: { x: 632, y: 172, text: 'Character\n& Resolve' } },
    { id: 'tenement_b', box: [219, 118, 250, 150], door: [238, 160], push: [0, -1], knock: { prompt: 'knock', action: 'tenement_a' } },
    { id: 'market', box: [28, 125, 188, 265], door: [172, 250], push: [-0.8, -0.5], sign: { x: 84, y: 118 } },
    { id: 'lantern', box: [0, 270, 140, 384], door: [122, 325], push: [-1, 0], sign: { x: 60, y: 246, text: 'The Lantern' } },
    // Club Velvet, bottom right of the square: the girls and the card table. Its facade is an overlay (town/street/club_ext.png).
    { id: 'club', box: [478, 214, 688, 384], door: [566, 370], push: [0.4, -1], sign: { x: 548, y: 286, text: 'Club Velvet' } },
  ],
  spots: [
    { id: 'holosign', x: 118, y: 160, r: 26, stand: [194, 222], prompt: 'read the sign', lines: ['MARROW\u2019S. OPEN. (The word CLOSED flickers underneath.)', 'The sign buzzes: NO REFUNDS. NO RECEIPTS. NO RUNNING.'] },
    { id: 'vent', x: 344, y: 268, r: 26, stand: [344, 300], prompt: 'look at the vent', lines: ['Steam. The foundry runs under half the town now.', 'The vent sighs. It sounds tired.'] },
    { id: 'lockers', x: 160, y: 130, r: 22, stand: [194, 195], prompt: 'check the lockers', lines: ['Shift lockers, padlocked. One has a name you recognise from the wall.', 'Empty. Someone has scratched a tally of days into the door. It stops at ninety.'] },
    { id: 'poster', x: 282, y: 118, r: 24, stand: [282, 156], prompt: 'read the poster', lines: ['\u201CPRODUCTIVITY IS LOYALTY.\u201D Someone has drawn a moustache on the Supervisor.', '\u201CREPORT UNUSUAL MOVEMENT.\u201D Below it, in marker: \u201Clike your bowels?\u201D', '\u201CCURFEW: DUSK.\u201D The word DUSK has been scratched out and replaced with NEVER.', 'A reward notice. The face is smudged. Could be anyone. Could be you.'] },
    { id: 'noticeboard', x: 425, y: 140, r: 22, stand: [428, 158], prompt: 'read the board (Missions)', open: 'missions' },
    { id: 'vending', x: 455, y: 128, r: 22, stand: [462, 172], prompt: 'use the vending terminal (1 cr)', action: 'vending' },
    { id: 'tower', x: 648, y: 75, r: 58, stand: [590, 320], prompt: 'look up', lines: ['The water tower. The Directorate tested the water last month and nobody saw the results.', 'A kid has climbed it and painted a fist on the tank. Nobody has painted over it yet.'] },
  ],
  folk: [], // only people who belong to a building now
  patrol: { id: 'patrol', route: [[250, 200], [440, 190], [530, 300], [400, 360], [200, 340], [205, 260]], h: 140, lines: ['Papers.', 'Curfew\u2019s at dusk. Move along.', 'Keep walking, citizen.', 'Nothing to see. Keep moving.', 'Eyes down, citizen.', 'Did you hear something? No. You didn\u2019t.', 'This is a quiet yard. Keep it quiet.'] },
  lights: [
    { x: 535, y: 305, r: 46, color: '#ff4fb8', kind: 'neon', a: 0.3 },
    { x: 596, y: 352, r: 40, color: '#ff6ad5', kind: 'neon', a: 0.3 },
    { x: 344, y: 268, r: 30, color: '#ffb066', kind: 'lamp', a: 0.14 },
    { x: 118, y: 160, r: 40, color: '#4fe0d0', kind: 'neon', a: 0.2 },
    { x: 549, y: 222, r: 28, color: '#ffc27a', kind: 'lamp', a: 0.28 },
    { x: 42, y: 332, r: 32, color: '#ffb066', kind: 'lamp', a: 0.24 },
    { x: 115, y: 285, r: 24, color: '#ffb066', kind: 'lamp', a: 0.24 },
    { x: 171, y: 88, r: 22, color: '#ffd9a0', kind: 'lamp', a: 0.24 },
    { x: 291, y: 82, r: 18, color: '#ff4a3a', kind: 'neon', a: 0.22 },
    { x: 410, y: 88, r: 18, color: '#4fe0d0', kind: 'neon', a: 0.22 },
    { x: 624, y: 200, r: 20, color: '#ffc27a', kind: 'lamp', a: 0.24 },
  ],
  steam: [{ x: 344, y: 262, big: true }, { x: 88, y: 316 }],
  embers: null,
  // Painted pieces laid over the yard picture: the club's front and the vent grate (each skipped until its file loads).
  overlays: [{ key: 'club_ext', x: 470, y: 200 }, { key: 'vent', x: 314, y: 246 }],
  puddles: [{ x: [270, 340], y: 300 }, { x: [430, 500], y: 345 }, { x: [230, 280], y: 230 }, { x: [500, 540], y: 250 }],
  // The E-Girl Room, through the curtain at the back of the Lantern: tonight's three girls stand at the slots; she walks you
  // out through the curtain on the right. Leaving by the left door goes back into the Lantern.
  room: { figure: 165, floor: { wall: 256, y0: 304, y1: 328 }, speed: 170, depth: 60, margin: 6 },
  interiors: {
    terminal: { npc: { id: 'dispatcher', x: 470, h: 156 }, spawn: 130, exit: [0, 62], lights: [{ x: 344, y: 70, r: 150, color: '#9fc4ff', kind: 'lamp' }, { x: 560, y: 150, r: 70, color: '#59c7ff', kind: 'neon' }] },
    market: { npc: { id: 'marrow', x: 480, h: 160 }, spawn: 130, exit: [0, 62], lights: [{ x: 330, y: 80, r: 130, color: '#ffb066', kind: 'lamp' }, { x: 580, y: 140, r: 70, color: '#ff3d7a', kind: 'neon' }] },
    clinic: { npc: { id: 'ilse', x: 470, h: 152 }, spawn: 130, exit: [0, 62], lights: [{ x: 350, y: 66, r: 150, color: '#c8ffe6', kind: 'lamp' }] },
    safehouse: { npc: { id: 'handler', x: 470, h: 158 }, spawn: 110, exit: [0, 62], lights: [{ x: 240, y: 130, r: 120, color: '#ffc27a', kind: 'fire' }, { x: 640, y: 215, r: 50, color: '#ff9a4a', kind: 'fire' }] },
    lantern: { npc: { id: 'keg7', x: 545, h: 150 }, also: { id: 'croupier', x: 285, h: 156, opens: 'wheel' }, spawn: 110, exit: [0, 62], lights: [{ x: 300, y: 70, r: 150, color: '#ff8a3c', kind: 'fire' }, { x: 120, y: 60, r: 80, color: '#ff4a3a', kind: 'neon' }, { x: 560, y: 110, r: 110, color: '#ffc27a', kind: 'lamp' }] },
    club: { npc: null, name: 'Club Velvet', girls: [180, 300, 420], table: { x: 545, opens: 'cards' }, spawn: 70, exit: [0, 50], curtain: 650, lights: [{ x: 230, y: 90, r: 130, color: '#ff4fb8', kind: 'neon' }, { x: 520, y: 90, r: 130, color: '#b44fff', kind: 'neon' }, { x: 640, y: 200, r: 80, color: '#ff8ad8', kind: 'neon' }] },
  },
};
// Each E-Girl's own room, through the curtain: she leads you in, the night plays out, and the left door goes back to the lounge.
const GIRL_ROOMS = {
  vex: { name: 'Vex\u2019s den', lights: [{ x: 520, y: 120, r: 140, color: '#ff4fb8', kind: 'neon' }, { x: 160, y: 80, r: 100, color: '#8a4fff', kind: 'neon' }] },
  pixie: { name: 'Pixie\u2019s room', lights: [{ x: 300, y: 70, r: 150, color: '#c9a2ff', kind: 'lamp' }, { x: 560, y: 120, r: 90, color: '#ffd1f0', kind: 'lamp' }] },
  rook: { name: 'Rook\u2019s studio', lights: [{ x: 420, y: 80, r: 140, color: '#3ff2ff', kind: 'neon' }, { x: 180, y: 120, r: 90, color: '#ff8a3c', kind: 'lamp' }] },
  jinx: { name: 'Jinx\u2019s stream room', lights: [{ x: 500, y: 100, r: 150, color: '#ff5ac8', kind: 'neon' }, { x: 220, y: 90, r: 120, color: '#4fa8ff', kind: 'neon' }] },
  luna: { name: 'Luna\u2019s nook', lights: [{ x: 420, y: 130, r: 140, color: '#a8e6ff', kind: 'lamp' }, { x: 180, y: 80, r: 100, color: '#ffd8a8', kind: 'lamp' }] },
  nova: { name: 'Nova\u2019s loft', lights: [{ x: 300, y: 90, r: 150, color: '#ff3a3a', kind: 'neon' }, { x: 560, y: 110, r: 100, color: '#ffb05a', kind: 'lamp' }] },
};
for (const [id, r] of Object.entries(GIRL_ROOMS)) PLACES.interiors[`room_${id}`] = { npc: null, host: id, name: r.name, girls: [430], spawn: 70, exit: [0, 50], parent: 'club', lights: r.lights };

const ROOM = PLACES.room, FLOOR = ROOM.floor, MID_Y = (FLOOR.y0 + FLOOR.y1) / 2;
const FIG = PLACES.figure, WALK = PLACES.walk;
const SPAWN_SPREAD = 3;          // index.html's spawnShift was in small-town pixels: stand co-op players side by side
const PAGE_BELOW = 100;          // CSS px the buttons under the view need on a big screen
const TAP_MOVE = 12, TAP_MS = 260; // a press that moves less than this many CSS px, and is this short, is a tap and not a drag
const osCalm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let reduceMotion = osCalm;
export const setCalm = (on) => { reduceMotion = osCalm || on; };
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

// What each building is. opens: the menu its NPC opens. auto: the menu opens as soon as you walk in.
export const SHOPS = {
  terminal: { name: 'Freight terminal', opens: 'missions', label: 'Missions', auto: true },
  market: { name: 'Marrow\u2019s container', opens: 'market', label: 'Black Market' },
  clinic: { name: 'Doc Ilse\u2019s clinic', opens: 'clinic', label: 'Clinic' },
  safehouse: { name: 'The hideout', opens: 'character', label: 'Character & Resolve' },
  lantern: { name: 'The Lantern', opens: 'bar', label: 'The Lantern' },
  club: { name: 'Club Velvet', opens: 'lounge', label: 'Club Velvet' },
  barracks: { name: 'Directorate barracks', hotspot: 'barracks' },
  tenement_a: { name: 'Tenement', hotspot: 'tenement_a' },
  tenement_b: { name: 'Tenement', hotspot: 'tenement_b' },
};
// Which sign a partner's open menu belongs to.
const MENU_SIGN = { missions: 'terminal', market: 'market', clinic: 'clinic', character: 'safehouse', gear: 'safehouse', bar: 'lantern', wheel: 'lantern', lounge: 'club', cards: 'club' };
// Interior NPC one-liners.
const INSIDE = {
  marrow: ['No receipts. No refunds. No questions.', 'Fresh stock after every job you pull.', 'I don\u2019t buy. I sell. Old kit goes on the heap.'],
  ilse: ['Sit. Don\u2019t bleed on the floor.', 'Hardware under the skin costs extra.', 'You again. Good. Means you\u2019re alive.'],
  handler: ['Door shut behind you? Good. They\u2019ve walked over this floor twice and never knocked.', 'The cell remembers. Spend what you\u2019ve earned.', 'Training keeps the next one alive.', 'Too many eyes on you? I can make you disappear. For a price.'],
  keg7: ['KEG-7 slides a glass down the bar and says nothing.', 'KEG-7 wipes the same spot on the bar. One drink per raid.', 'A servo whirs. It might be a greeting.'],
  croupier: ['Place your bet. The wheel doesn\u2019t care who you were.', 'Red, black or the long shot. Your funeral.', 'House rules: no credit, no crying.'],
  dispatcher: ['Freight manifests, patrol rotas, the lot. Pick a target.', 'Contracts on the board. The cell pays.', 'The lift port\u2019s open once you\u2019ve been deep enough.'],
};
const NPC_NAMES = { marrow: 'Marrow', ilse: 'Doc Ilse', handler: 'Cass', dispatcher: 'the dispatcher', keg7: 'KEG-7', croupier: 'the croupier' };
// People in the Lantern wear art from the rest of the cast: a loader droid for KEG-7, the interrogator's coat for the croupier.
const NPC_ART = { keg7: 'loader', croupier: 'interrogator' };
const npcName = (id) => NPC_NAMES[id] || id;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
// How big someone is at this height on the plaza.
export const depthAt = (y) => { const d = PLACES.depth; return d.far + (d.near - d.far) * clamp((y - d.yFar) / (d.yNear - d.yFar), 0, 1); };

// ---------- the ground ----------
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[j];
    if ((ay > y) !== (by > y) && x < ax + (y - ay) / (by - ay) * (bx - ax)) inside = !inside;
  }
  return inside;
}
const inBlock = (x, y) => WALK.blocks.some((b) => x > b[0] && x < b[2] && y > b[1] && y < b[3]);
export const walkable = (x, y) => inPoly(x, y, WALK.area) && !inBlock(x, y);
// The walkable point closest to (x, y). Because it is the closest one, walking into an edge slides along it.
export function nearestWalk(x, y) {
  if (walkable(x, y)) return [x, y];
  let best = null, bd = 1e12;
  const offer = (qx, qy) => { const d = (qx - x) ** 2 + (qy - y) ** 2; if (d < bd && walkable(qx, qy)) { bd = d; best = [qx, qy]; } };
  const poly = WALK.area;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey;
    const k = clamp(((x - ax) * ex + (y - ay) * ey) / len2, 0, 1), cx = ax + ex * k, cy = ay + ey * k, len = Math.sqrt(len2);
    const nx = -ey / len * 0.6, ny = ex / len * 0.6;
    offer(cx + nx, cy + ny); offer(cx - nx, cy - ny);
  }
  // The corners catch a target past a sharp inward corner, where the nudged edge points can both miss.
  for (const [ax, ay] of poly) for (const [dx, dy] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]]) offer(ax + dx, ay + dy);
  for (const b of WALK.blocks) {
    const cx = clamp(x, b[0], b[2]), cy = clamp(y, b[1], b[3]), e = 0.1;
    offer(b[0] - e, cy); offer(b[2] + e, cy); offer(cx, b[1] - e); offer(cx, b[3] + e);
  }
  return best;
}
const clearLine = (ax, ay, bx, by) => {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
  for (let i = 1; i < n; i++) if (!walkable(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
  return true;
};
// Corners worth turning at: every corner of the area and of each block, moved a little onto open ground.
function navNodes() {
  const out = [], tryAdd = (x, y) => { if (walkable(x, y)) { out.push([x, y]); return true; } return false; };
  const poly = WALK.area, n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x, y] = poly[i], [px, py] = poly[(i + n - 1) % n], [qx, qy] = poly[(i + 1) % n];
    let bx = (px - x) / Math.hypot(px - x, py - y) + (qx - x) / Math.hypot(qx - x, qy - y), by = (py - y) / Math.hypot(px - x, py - y) + (qy - y) / Math.hypot(qx - x, qy - y);
    const bl = Math.hypot(bx, by) || 1; bx = bx / bl * 5; by = by / bl * 5;
    if (!tryAdd(x + bx, y + by)) tryAdd(x - bx, y - by);
  }
  for (const b of WALK.blocks) for (const [x, y] of [[b[0] - 4, b[1] - 4], [b[2] + 4, b[1] - 4], [b[0] - 4, b[3] + 4], [b[2] + 4, b[3] + 4]]) tryAdd(x, y);
  return out;
}
// The shortest way round on open ground. null when there is none.
export function findRoute(ax, ay, bx, by, nodes = navNodes()) {
  if (clearLine(ax, ay, bx, by)) return [[bx, by]];
  const pts = [[ax, ay], [bx, by], ...nodes], N = pts.length, dist = new Array(N).fill(Infinity), from = new Array(N).fill(-1), done = new Array(N).fill(false);
  dist[0] = 0;
  for (let k = 0; k < N; k++) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (let v = 0; v < N; v++) {
      if (done[v]) continue;
      const d = Math.hypot(pts[v][0] - pts[u][0], pts[v][1] - pts[u][1]);
      if (dist[u] + d < dist[v] && clearLine(pts[u][0], pts[u][1], pts[v][0], pts[v][1])) { dist[v] = dist[u] + d; from[v] = u; }
    }
  }
  if (from[1] < 0) return null;
  const route = [];
  for (let i = 1; i > 0; i = from[i]) route.unshift(pts[i]);
  return route;
}

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

const LOW = { idle: { frames: 4, fps: 5 }, walk: { frames: 6, fps: 8 } }; // the old 64px sheets, the fallback until the high-res ones land
const LOW_FIG = 47, LOW_FEET = 59;

export class Town {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'town yard';
    this.el.innerHTML = `<canvas width="${VIEW_W}" height="${VIEW_H}" aria-label="Kessa Yard. Walk with arrow keys or WASD, or tap or drag where to go. E or Space to talk." tabindex="0"></canvas>
      <div class="yard-signs"></div><div class="town-tag me" hidden></div><div class="town-tag" hidden></div><div class="town-bubble" hidden></div><div class="town-bubble mate" hidden></div><div class="town-prompt" hidden></div><div class="town-fade"></div>`;
    this.cv = this.el.querySelector('canvas');
    this.g = this.cv.getContext('2d', { alpha: false });
    this.signLayer = this.el.querySelector('.yard-signs');
    this.bubble = this.el.querySelector('.town-bubble');
    this.mateBubble = this.el.querySelector('.town-bubble.mate');
    this.meTag = this.el.querySelector('.town-tag.me');
    this.tag = this.el.querySelector('.town-tag:not(.me)');
    this.prompt = this.el.querySelector('.town-prompt');
    this.fade = this.el.querySelector('.town-fade');
    this.partner = null;    // the co-op partner: { x, y, tx, ty, dir, face, moving, scene, t, name, say, menu }
    this.onMove = null;     // ({ x, y, dir, moving, scene }) => void, at most ten times a second and only on change
    this.onPartner = null;  // () => void, walking up to the partner and pressing E
    this.onOpen = null;     // (screen, shopId) => void
    this.onAction = null;   // (id) => { text, ok?, sfx? } from the game
    this.moveT = 0; this.moveKey = '';
    this.keys = new Set();
    this.press = null;      // a finger or mouse held on the scene: { id, sx, sy, cx, cy, t0, sign, drag }
    this.blocked = false;
    this.scene = 'town';    // 'town' | 'interior:<id>'
    this.player = { x: 0, y: 0, dir: 'down', face: 1, moving: false, t: 0, path: null, then: null, stuck: 0 };
    this.s = 1; this.ox = 0; this.oy = 0;
    this.say = null;        // { text, x, y, until }
    this.offer = null;      // a yes/no waiting on Enter: { accept }
    this.stepT = 0;
    this.touched = false;   // has this stay in the yard opened anything yet? Missions pulses until it has
    this.debug = false;
    this.ready = true;      // nothing has to load before you can walk
    this.el.classList.add('ready');
    this.buildWorld();
    const home = this.doors.find((d) => d.id === 'safehouse').front;
    this.player.x = home[0]; this.player.y = home[1];
    this.buildSigns();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.layoutSigns()); // the web font changes how wide a sign is
    this.loadArt();
    this.bindInput();
    this.simT = 0;
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (this.el.isConnected) { try { this.fit(); this.update(dt); this.draw(t); } catch (e) { console.warn('yard', e); } }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------- size ----------
  // The picture is contained in the view at whatever scale that takes, with dark bars if the shape differs. Backing is capped at twice CSS pixels.
  fit() {
    const raw = window.devicePixelRatio || 1, dpr = clamp(raw, 1, 2);
    // A phone held sideways: fill the height of the screen so nothing scrolls. Otherwise the height is chosen to fit the art exactly.
    const sideways = matchMedia('(orientation: landscape) and (max-height: 600px), (orientation: landscape) and (pointer: coarse) and (max-height: 820px)').matches;
    const roomH = sideways ? Math.max(120, Math.floor(window.innerHeight - this.el.getBoundingClientRect().top - 10)) : 0;
    const cw = this.el.clientWidth;
    // On a bigger screen, take the art's full shape unless that would push the page into scrolling: then bars at the sides instead.
    const full = Math.max(cw * 0.6 * VIEW_H / VIEW_W, Math.min(cw * VIEW_H / VIEW_W, window.innerHeight - this.el.getBoundingClientRect().top - window.scrollY - PAGE_BELOW));
    const key = `${cw}:${roomH}:${Math.round(full)}:${dpr}`;
    if (!cw || key === this.fitKey) return;
    this.fitKey = key;
    const cssH = roomH || full;
    const W = Math.round(cw * dpr), H = Math.round(cssH * dpr);
    this.cv.width = W; this.cv.height = H;
    this.cv.style.aspectRatio = `${cw} / ${cssH}`;
    // Past the cap the browser stretches the backing to the screen, and doubling up nearest-neighbour there would look uneven.
    this.cv.style.imageRendering = raw > dpr ? 'auto' : '';
    this.s = Math.min(W / VIEW_W, H / VIEW_H);
    this.ox = Math.round((W - VIEW_W * this.s) / 2); this.oy = Math.round((H - VIEW_H * this.s) / 2);
    this.cssK = cw / W; this.cssW = cw; this.cssH = cssH;
    this.layoutSigns();
  }
  // Image pixels to CSS pixels inside the view, and to the page.
  cssX(x) { return (this.ox + x * this.s) * this.cssK; }
  cssY(y) { return (this.oy + y * this.s) * this.cssK; }
  toPage(x, y) { const r = this.cv.getBoundingClientRect(); return { x: r.left + this.cssX(x) / this.cssW * r.width, y: r.top + this.cssY(y) / this.cssH * r.height }; }
  fromPage(cx, cy) { const r = this.cv.getBoundingClientRect(); return { x: ((cx - r.left) / r.width * this.cssW / this.cssK - this.ox) / this.s, y: ((cy - r.top) / r.height * this.cssH / this.cssK - this.oy) / this.s }; }

  // ---------- art ----------
  async loadArt() {
    this.sprites = { shadow: softBlack() };
    this.baked = {}; this.art = {};
    for (const key of ['yard', 'int_terminal', 'int_market', 'int_clinic', 'int_safehouse', 'int_lantern', 'int_club']) {
      this.art[key] = 'loading';
      // A slow connection gets the placeholder after a few seconds; the real picture still replaces it when it arrives.
      setTimeout(() => { if (this.art[key] === 'loading') { this.art[key] = 'failed'; this.bake(key, null); } }, 4000);
      loadImg(`${ART}${key}.png`).then((im) => { this.art[key] = im ? 'ok' : 'failed'; this.bake(key, im); });
    }
  }
  // Backdrops not loaded up front (the girls' rooms): fetched the first time they're needed, placeholder until then.
  ensureBack(key) {
    if (!this.art || this.art[key]) return;
    this.art[key] = 'loading'; this.bake(key, null);
    loadImg(`${ART}${key}.png`).then((im) => { this.art[key] = im ? 'ok' : 'failed'; if (im) this.bake(key, im); });
  }
  bake(key, im) {
    if (key === 'yard' && im) for (const o of PLACES.overlays || []) loadImg(`${ART}${o.key}.png`).then((ov) => { if (ov && this.baked.yard) { const g = this.baked.yard.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(ov, o.x, o.y); } });
    const c = makeCanvas(VIEW_W, VIEW_H), g = c.getContext('2d');
    if (im) g.drawImage(im, 0, 0, VIEW_W, VIEW_H);
    else if (key === 'yard') paintYardPlaceholder(g);
    else paintRoomPlaceholder(g, key.slice(4));
    this.baked[key] = c;
  }
  // The stage's sheets arrive after the page starts and may not exist at all, so this asks every time.
  hdOf(id) {
    const sh = id === 'player' ? this.playerHd : id === 'partner' ? this.partnerHd : sheetOf(NPC_ART[id] || id);
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
  buildWorld() {
    this.rebuildGround();
    this.doors = PLACES.buildings.map((b) => {
      const l = Math.hypot(b.push[0], b.push[1]) || 1, push = [b.push[0] / l, b.push[1] / l];
      return { id: b.id, enterable: !b.knock && !!PLACES.interiors[b.id], x: b.door[0], y: b.door[1], push, front: nearestWalk(b.door[0] - push[0] * 14, b.door[1] - push[1] * 14), knock: b.knock ? { id: b.id, door: true, ...b.knock } : null, b };
    });
    this.folk = PLACES.folk.map((f, i) => ({ ...f, face: -1, t: i * 1.3, pause: 1 + i, moving: false, gx: f.x, gy: f.y, dir: 'left' }));
    const g = PLACES.patrol;
    this.patrol = { ...g, x: g.route[0][0], y: g.route[0][1], leg: 1, dir: 'right', face: 1, t: 0, pause: 0, moving: true };
    const count = coarse ? 24 : 36;
    this.rain = Array.from({ length: count }, (_, i) => ({ x: (i * 97) % VIEW_W, y: (i * 41) % VIEW_H, v: 360 + (i % 5) * 70 }));
    this.ripples = Array.from({ length: 6 }, () => ({ age: 9, life: 1, x: 0, y: 0 }));
    this.puffs = Array.from({ length: 10 }, () => ({ age: 9, life: 1, x: 0, y: 0, vx: 0, vy: 0, size: 20 }));
    this.sparks = Array.from({ length: 10 }, () => ({ age: 9, life: 1, x: 0, y: 0, vx: 0, vy: 0 }));
    this.rippleT = 0; this.puffT = 0; this.sparkT = 0;
  }
  // Call after changing PLACES.walk while the game runs.
  rebuildGround() { this.nav = navNodes(); }
  standOf(h) { return h.stand ? nearestWalk(h.stand[0], h.stand[1]) : nearestWalk(h.x, h.y); }
  // The floating name over each place. A button, big enough to tap, around a smaller visible label.
  buildSigns() {
    this.signs = {};
    const add = (id, s, text, go) => {
      const b = document.createElement('button');
      b.type = 'button'; b.tabIndex = -1; b.className = `yard-sign${s.minor ? ' minor' : ''}`; b.dataset.place = id;
      b.innerHTML = '<span></span>'; b.firstChild.textContent = text;
      b.setAttribute('aria-label', `Walk to ${text}`);
      this.signLayer.appendChild(b);
      this.signs[id] = { el: b, s, go };
    };
    for (const d of this.doors) if (d.b.sign) add(d.id, d.b.sign, d.b.sign.text || SHOPS[d.id].label, () => this.goDoor(d));
    for (const h of PLACES.spots) if (h.sign) add(h.id, h.sign, h.sign.text || h.id, () => this.goSpot(h));
  }
  // Keeps every sign whole inside the view.
  layoutSigns() {
    if (this.interior || !this.cssW) return;
    for (const k in this.signs) {
      const { el, s } = this.signs[k], w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = `${Math.round(clamp(this.cssX(s.x) - w / 2, 1, this.cssW - w - 1))}px`;
      el.style.top = `${Math.round(clamp(this.cssY(s.y) - h / 2, 0, this.cssH - h))}px`;
    }
  }

  // ---------- scenes ----------
  spawnAt(where) {
    this.setScene('town');
    const d = this.doors.find((x) => x.id === where), p = this.player;
    if (d) { p.x = d.front[0]; p.y = d.front[1]; p.dir = 'down'; }
    if (this.spawnShift) p.x += this.spawnShift * SPAWN_SPREAD; // co-op: side by side, not stacked
    const q = nearestWalk(p.x, p.y); if (q) { p.x = q[0]; p.y = q[1]; }
    p.path = null; p.then = null; this.say = null; this.offer = null;
    this.touched = false;
  }
  setScene(scene) {
    this.scene = scene; this.keys.clear(); this.press = null;
    const inside = scene !== 'town';
    if (this.signLayer.hidden !== inside) { this.signLayer.hidden = inside; if (!inside) this.layoutSigns(); }
  }
  enter(door) {
    const it = PLACES.interiors[door.id];
    if (!it) return;
    play('door');
    this.flash();
    this.lastDoor = door;
    this.touched = true;
    this.setScene(`interior:${door.id}`);
    const p = this.player;
    p.x = it.spawn; p.y = MID_Y; p.dir = 'right'; p.face = !it.npc || it.npc.x > it.spawn ? 1 : -1; p.path = null; p.then = null; this.say = null;
    for (const n of [it.npc, it.also]) if (n && NPC_ART[n.id]) ensureSheet(NPC_ART[n.id]);
    if (it.girls && this.onBack) this.onBack(door.id); // the girls' town sheets
    const shop = SHOPS[door.id];
    // Only the freight terminal opens its menu as you walk in; everywhere else you talk to the person inside.
    if (shop && shop.auto && this.onOpen) setTimeout(() => this.onOpen(shop.opens, door.id), 180);
  }
  // Through the Lantern's back curtain into the E-Girl Room, and back out of it.
  enterBack() {
    const from = this.interior; if (!from || !from.back) return;
    play('door'); this.flash(); this.touched = true;
    this.setScene(`interior:${from.back.to}`);
    const it = this.interior, p = this.player;
    p.x = it.spawn; p.y = MID_Y; p.dir = 'right'; p.face = 1; p.path = null; p.then = null; this.say = null;
    if (this.onBack) this.onBack(from.back.to);
  }
  exit() {
    const was = this.interior;
    if (was && was.parent) {
      play('door'); this.flash();
      this.setScene(`interior:${was.parent}`);
      const p = this.player, back = this.interior.back; p.x = back ? back.x : 120; p.y = MID_Y; p.dir = 'down'; p.face = -1; p.path = null; p.then = null; this.say = null;
      return;
    }
    play('door');
    this.flash();
    const d = this.lastDoor;
    this.setScene('town');
    const p = this.player;
    if (d) { p.x = d.front[0]; p.y = d.front[1]; }
    p.dir = 'down'; p.path = null; p.then = null; this.say = null;
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
      if (this.led) return; // being led out back: hands off the controls
      const k = ev.key.toLowerCase();
      if (DIR[k]) { this.keys.add(DIR[k]); this.player.path = null; this.player.then = null; ev.preventDefault(); }
      else if (k === 'e' || k === ' ' || k === 'enter') { this.interact(); if (k === ' ') ev.preventDefault(); }
      else if (k === 'escape' && this.offer) { this.offer = null; this.say = null; }
    });
    window.addEventListener('keyup', (ev) => { const k = DIR[ev.key.toLowerCase()]; if (k) this.keys.delete(k); });
    window.addEventListener('blur', () => { this.keys.clear(); this.press = null; });
    // Everything on the scene, signs included, is one press: it steers while held and it is a tap if it was short and still.
    // Moves and releases are heard on the window, because a co-op update can redraw the page and lift the view out from under a finger.
    this.el.addEventListener('pointerdown', (ev) => {
      if (this.blocked || ev.button > 0 || !ev.isPrimary) return; // a new first finger replaces any press whose release was lost
      const sign = ev.target.closest && ev.target.closest('.yard-sign');
      const at = this.fromPage(ev.clientX, ev.clientY);
      this.press = { id: ev.pointerId, sx: at.x, sy: at.y, cx: ev.clientX, cy: ev.clientY, t0: performance.now(), sign: sign ? sign.dataset.place : null, drag: false };
      if (!sign) { this.player.path = null; this.player.then = null; }
    });
    window.addEventListener('pointermove', (ev) => {
      const q = this.press;
      if (!q || ev.pointerId !== q.id) return;
      const at = this.fromPage(ev.clientX, ev.clientY);
      q.sx = at.x; q.sy = at.y;
      if (!q.drag && Math.hypot(ev.clientX - q.cx, ev.clientY - q.cy) >= TAP_MOVE) { q.drag = true; this.player.path = null; this.player.then = null; if (this.offer) { this.offer = null; this.say = null; } }
    });
    window.addEventListener('pointerup', (ev) => {
      const q = this.press;
      if (!q || ev.pointerId !== q.id) return;
      this.press = null;
      if (this.blocked || q.drag) return;
      if (q.sign) { const s = this.signs[q.sign]; if (s) { if (this.offer) { this.offer = null; this.say = null; } s.go(); } return; }
      if (performance.now() - q.t0 < TAP_MS) { const at = this.fromPage(ev.clientX, ev.clientY); this.tapAt(at.x, at.y); }
    });
    window.addEventListener('pointercancel', (ev) => { if (this.press && ev.pointerId === this.press.id) this.press = null; });
    this.signLayer.addEventListener('mousedown', (ev) => ev.preventDefault()); // keep the keyboard on the game, not on the sign
    // A screen reader's or switch's press arrives as a bare click.
    this.signLayer.addEventListener('click', (ev) => {
      const b = ev.target.closest('.yard-sign');
      if (b && ev.detail === 0 && this.active && this.signs[b.dataset.place]) this.signs[b.dataset.place].go();
    });
    // The prompt itself is a button on a touch screen: tapping it does what E does.
    this.prompt.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); if (this.active) this.interact(); });
  }
  get active() { return this.ready && this.el.isConnected && !this.blocked; }
  setBlocked(b) { this.blocked = b; if (b) { this.keys.clear(); this.press = null; this.player.path = null; this.player.then = null; this.touched = true; } }

  // Who or what is next to the player that they could talk to or use. The nearest one wins.
  nearby() {
    const p = this.player, it = this.interior, m = this.partner;
    let best = null, bd = 1e9;
    const offer = (d, n) => { if (d < bd) { bd = d; best = n; } };
    if (m && this.onPartner && m.scene === this.scene && Math.abs(p.x - m.x) < 50 && Math.abs(p.y - m.y) < 40) offer(Math.hypot(p.x - m.x, p.y - m.y) * 0.2, { kind: 'partner', who: m }); // walking up to each other beats whatever is nearby
    if (it) {
      if (it.npc && Math.abs(p.x - it.npc.x) < 72) offer(Math.abs(p.x - it.npc.x) * 0.5, { kind: 'npc', id: it.npc.id, x: it.npc.x, y: it.npc.y || MID_Y, opens: SHOPS[this.interiorId].opens });
      if (it.back && Math.abs(p.x - it.back.x) < 60) offer(Math.abs(p.x - it.back.x) * 0.6, { kind: 'back' });
      if (it.table && Math.abs(p.x - it.table.x) < 60) offer(Math.abs(p.x - it.table.x) * 0.6, { kind: 'table', opens: it.table.opens });
      if (it.girls) for (const g of this.girlsHere()) if (Math.abs(p.x - g.x) < 60) offer(Math.abs(p.x - g.x) * 0.5, { kind: 'girl', id: g.id, name: g.name, x: g.x, y: MID_Y });
      if (it.also && Math.abs(p.x - it.also.x) < 72) offer(Math.abs(p.x - it.also.x) * 0.5, { kind: 'npc', id: it.also.id, x: it.also.x, y: it.also.y || MID_Y, opens: it.also.opens, also: true });
      return best;
    }
    const folkNear = (f) => { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < 46) offer(d * 0.5, { kind: 'folk', who: f }); };
    for (const f of this.folk) folkNear(f);
    folkNear(this.patrol);
    for (const h of PLACES.spots) { const q = this.standOf(h), d = Math.hypot(p.x - q[0], p.y - q[1]); if (d < WALK.near) offer(d, this.spotNear(h)); }
    for (const d of this.doors) { const k = Math.hypot(p.x - d.x, p.y - d.y); if (k < WALK.near) offer(k, this.doorNear(d)); }
    return best;
  }
  spotNear(h) {
    if (h.folk) return { kind: 'folk', who: this.folk.find((f) => f.id === h.folk) };
    return { kind: 'spot', spot: h, x: this.player.x, y: this.player.y };
  }
  doorNear(d) {
    if (d.knock) return { kind: 'spot', spot: d.knock, x: this.player.x, y: this.player.y, door: d };
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
    if (n.kind === 'back') { this.enterBack(); return; }
    if (n.kind === 'table') { play('click'); if (this.onOpen) this.onOpen(n.opens, this.interiorId); return; }
    if (n.kind === 'girl') { const g = this.girlsHere().find((q) => q.id === n.id); if (g && g.greet) this.speak('girl', g.greet, g.x, MID_Y - ROOM.figure - 10, 3200); play('click'); if (this.onGirl) this.onGirl(n.id); return; }
    if (n.kind === 'npc') {
      this.speak(n.id, pick(INSIDE[n.id] || ['...']), n.x, n.y);
      if (this.onOpen) this.onOpen(n.opens, this.interiorId);
    } else if (n.kind === 'folk') {
      const f = n.who;
      this.speak(f.id, pick(f.lines), f.x, f.y);
      play('click');
    } else if (n.kind === 'spot') {
      const h = n.spot;
      if (h.open) { if (this.onOpen) this.onOpen(h.open, 'terminal'); }
      else if (h.action) { const r = this.onAction ? this.onAction(h.action) : null; this.speak(h.id, r ? r.text : '...', n.x, n.y); play(r && r.sfx ? r.sfx : 'click'); }
      else { this.speak(h.id, pick(h.lines), n.x, n.y); play('click'); }
    }
  }
  // An E-Girl takes your hand and walks you out the back. done() runs once you're through the door, or straight away
  // when her town art isn't in (the result still shows). id is the hostess id; her town sheet is girl_<id>.
  escort(id, line, done, inside = '') {
    const key = `girl_${id}`;
    if (!this.active || !this.hdOf(key)) { done(); return; }
    const p = this.player, it = this.interior;
    this.keys.clear(); this.press = null;
    const side = p.x > VIEW_W / 2 ? -1 : 1;
    const slot = it && it.girls ? this.girlsHere().find((g) => g.id === id) : null;
    this.led = { id: key, x: slot ? slot.x : p.x + side * 60, y: p.y, face: -side, moving: false, t: 0, done, phase: 'meet', inside };
    if (line) this.speak('girl', line, this.led.x, p.y - this.figureAt(p.y) - 10, 2600);
    // Out back: the far wall of the room, away from the street door; outside, the Lantern's own door.
    const target = it && it.curtain ? [it.curtain, FLOOR.y0 + 4] : it ? [it.exit[0] < 1 ? VIEW_W - 50 : 50, FLOOR.y0 + 4] : [PLACES.buildings.find((b) => b.id === 'lantern').door[0], PLACES.buildings.find((b) => b.id === 'lantern').door[1]];
    setTimeout(() => {
      if (!this.led) return;
      this.led.phase = 'walk';
      this.walkTo(target[0], target[1], () => this.endEscort());
      setTimeout(() => this.endEscort(), 6000); // never strand the player if the path can't finish
    }, 900);
  }
  endEscort() {
    const e = this.led;
    if (!e || e.phase === 'gone') return;
    const gid = e.id.slice(5), room = `room_${gid}`;
    if (this.interiorId === 'club' && PLACES.interiors[room] && e.phase !== 'inside') { this.enterRoom(room, e); return; }
    e.phase = 'gone';
    this.flash();
    setTimeout(() => { const d = e.done; this.led = null; this.say = null; if (d) d(); }, 450);
  }
  // Through the curtain into her room: she's already inside, turns to you, and the night plays out (done()).
  enterRoom(room, e) {
    const it = PLACES.interiors[room];
    this.ensureBack(`int_${room}`);
    play('door'); this.flash();
    e.phase = 'inside';
    this.host = this.girlsHere().find((g) => `girl_${g.id}` === e.id) || null;
    this.setScene(`interior:${room}`);
    const p = this.player; p.x = 300; p.y = MID_Y; p.dir = 'right'; p.face = 1; p.path = null; p.then = null; p.moving = false;
    e.x = it.girls[0]; e.y = MID_Y; e.face = -1; e.moving = false;
    if (e.inside) this.speak('girl', e.inside, e.x, MID_Y - ROOM.figure - 10, 2400);
    setTimeout(() => { if (this.led !== e) return; e.phase = 'gone'; const d = e.done; this.led = null; if (d) d(); }, 1700);
  }
  updateEscort(dt) {
    const e = this.led;
    if (!e || e.phase === 'gone') return;
    e.t += dt;
    const p = this.player, gx = p.x - (p.face || 1) * 30, gy = p.y + 2, dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy);
    if (e.phase === 'inside') { e.moving = false; return; }
    if (e.phase === 'meet' || d < 2) { e.moving = false; if (e.phase === 'meet') e.face = p.x < e.x ? -1 : 1; return; }
    const step = Math.min(d, 190 * dt); e.x += (dx / d) * step; e.y += (dy / d) * step; e.moving = true; if (Math.abs(dx) > 1) e.face = Math.sign(dx);
  }
  // Tonight's girls, set by the page (setLineup): [{ id, name, greet }], placed on the room's slots.
  setLineup(list) { this.lineup = list || []; }
  girlsHere() { const it = this.interior; if (!it || !it.girls) return []; if (it.host) { const g = (this.lineup || []).find((q) => q.id === it.host) || (this.host && this.host.id === it.host ? this.host : { id: it.host, name: it.name }); return [{ ...g, x: it.girls[0] }]; } return (this.lineup || []).slice(0, it.girls.length).map((g, i) => ({ ...g, x: it.girls[i] })); }
  speak(who, text, x, y, ms = 2800) { this.say = { text, x, y, until: performance.now() + ms }; }

  // How tall someone stands at this y, right now.
  figureAt(y) { return this.interior ? ROOM.figure : FIG * depthAt(y); }
  // A tap: a person, then a thing, then a building, and otherwise just walk there.
  tapAt(x, y) {
    if (this.led) return;
    const p = this.player, it = this.interior, m = this.partner;
    const onFigure = (f, h) => Math.abs(x - f.x) < Math.max(24, h * 0.26) && y > f.y - h && y < f.y + 14;
    const beside = (f) => f.x + (p.x < f.x ? -34 : 34);
    if (m && this.onPartner && m.scene === this.scene && onFigure(m, this.figureAt(m.y))) { this.walkTo(beside(m), m.y, () => { if (m === this.partner && m.scene === this.scene) this.use({ kind: 'partner', who: m }); }); return; }
    if (it) {
      if (it.girls) for (const g of this.girlsHere()) if (onFigure({ x: g.x, y: MID_Y }, ROOM.figure)) { this.walkTo(beside(g), MID_Y, () => this.use({ kind: 'girl', id: g.id, name: g.name, x: g.x, y: MID_Y })); return; }
      if (it.back && Math.abs(x - it.back.x) < 50 && y < MID_Y) { this.walkTo(it.back.x, MID_Y, () => this.enterBack()); return; }
      if (it.table && Math.abs(x - it.table.x) < 60 && y < MID_Y + 20) { this.walkTo(it.table.x - 40, MID_Y, () => this.use({ kind: 'table', opens: it.table.opens })); return; }
      const n = it.npc || { x: -999, h: 0 };
      if (it.npc && onFigure({ x: n.x, y: n.y || MID_Y }, n.h)) { this.walkTo(beside(n), MID_Y, () => this.use({ kind: 'npc', id: n.id, x: n.x, y: n.y || MID_Y, opens: SHOPS[this.interiorId].opens })); return; }
      const o = it.also;
      if (o && (onFigure({ x: o.x, y: o.y || MID_Y }, o.h) || (Math.abs(x - o.x) < 90 && y < MID_Y))) { this.walkTo(beside(o), MID_Y, () => this.use({ kind: 'npc', id: o.id, x: o.x, y: o.y || MID_Y, opens: o.opens, also: true })); return; }
      if (this.offer) { this.offer = null; this.say = null; }
      if (x >= it.exit[0] && x <= it.exit[1]) { this.walkTo(it.exit[0] < 1 ? 0 : VIEW_W, MID_Y); return; }
      this.walkTo(x, y);
      return;
    }
    for (const f of [...this.folk, this.patrol]) if (onFigure(f, f.h * depthAt(f.y))) {
      const h = PLACES.spots.find((q) => q.folk === f.id);
      if (h) this.goSpot(h);
      else this.walkTo(beside(f), f.y, () => this.use({ kind: 'folk', who: f }));
      return;
    }
    if (this.offer) { this.offer = null; this.say = null; }
    for (const h of PLACES.spots) if (Math.hypot(x - h.x, y - h.y) <= h.r) { this.goSpot(h); return; }
    if (!walkable(x, y)) for (const d of this.doors) {
      const [x0, y0, x1, y1] = d.b.box;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { this.goDoor(d); return; }
    }
    this.walkTo(x, y);
  }
  goDoor(d) { this.walkTo(d.x, d.y, () => this.tryDoor(d, true)); }
  goSpot(h) { const q = this.standOf(h); this.walkTo(q[0], q[1], () => this.use(this.spotNear(h))); }
  // Straight there if the way is clear, around whatever is in the way if not, and to the nearest ground if the place itself can't be stood on.
  walkTo(x, y, then = null) {
    const p = this.player;
    p.then = then; p.stuck = 0;
    if (this.interior) { p.path = [[clamp(x, ROOM.margin, VIEW_W - ROOM.margin), clamp(y, FLOOR.y0, FLOOR.y1)]]; return; }
    const q = nearestWalk(x, y) || [p.x, p.y];
    p.path = findRoute(p.x, p.y, q[0], q[1], this.nav) || [q];
  }
  tryDoor(d, tapped = false) {
    if (d.enterable) { this.enter(d); return true; }
    if (tapped || !this.lockedSaid || performance.now() - this.lockedSaid > 3000) { this.lockedSaid = performance.now(); this.use(this.doorNear(d)); }
    return false;
  }

  // ---------- simulation ----------
  update(dt) {
    const p = this.player;
    this.simT += dt;
    if (this.interior) this.updateRoom(dt); else this.updateYard(dt);
    p.t += dt;
    this.updatePartner(dt);
    this.updateEscort(dt);
    this.updateFolk(dt);
    if (!reduceMotion) this.updateEffects(dt);
  }
  // Which way the player wants to go this frame, as a unit vector: keys first, then a held finger. Also the point to stop at, for a finger.
  intent() {
    let ux = 0, uy = 0, room = Infinity;
    const k = this.keys;
    if (k.has('left')) ux -= 1;
    if (k.has('right')) ux += 1;
    if (k.has('up')) uy -= 1;
    if (k.has('down')) uy += 1;
    const p = this.player, q = this.press;
    if (!ux && !uy && q && (!q.sign || q.drag)) {
      const dx = q.sx - p.x, dy = q.sy - p.y, d = Math.hypot(dx, dy);
      if (d > 4) { ux = dx / d; uy = dy / d; room = d; }
    }
    const l = Math.hypot(ux, uy);
    return l ? { ux: ux / l, uy: uy / l, room } : null;
  }
  // Side to side is full speed and up and down is foreshortened.
  stepLen(ux, uy, dt) { return WALK.speed * dt * (1 - (1 - WALK.ySpeed) * Math.abs(uy)); }
  // One step on the ground. Into an edge it slides, because the closest open point to where you were headed is along that edge.
  stepBy(ux, uy, len) {
    const p = this.player, tx = p.x + ux * len, ty = p.y + uy * len;
    let nx = tx, ny = ty;
    if (!walkable(tx, ty)) {
      const q = nearestWalk(tx, ty);
      if (!q || Math.hypot(q[0] - p.x, q[1] - p.y) > len * 1.6) return false;
      nx = q[0]; ny = q[1];
    }
    const moved = Math.hypot(nx - p.x, ny - p.y);
    if (moved < 0.03) return false;
    p.x = nx; p.y = ny;
    return true;
  }
  updateYard(dt) {
    const p = this.player;
    // Anyone put somewhere they can't stand (a test, a spawn, a change to PLACES) is moved to the nearest ground.
    if (!walkable(p.x, p.y)) { const q = nearestWalk(p.x, p.y); if (q) { p.x = q[0]; p.y = q[1]; } }
    let ux = 0, uy = 0, walked = false;
    if (!this.blocked) {
      const want = this.intent();
      if (want) {
        ux = want.ux; uy = want.uy;
        walked = this.stepBy(ux, uy, Math.min(want.room, this.stepLen(ux, uy, dt)));
        for (const d of this.doors) if (ux * d.push[0] + uy * d.push[1] > 0.4 && Math.hypot(p.x - d.x, p.y - d.y) < WALK.enter) { this.tryDoor(d); if (this.interior) return; break; }
      } else if (p.path) {
        const [gx, gy] = p.path[0], dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy);
        if (d < 2.5) {
          p.path.shift();
          if (!p.path.length) { p.path = null; const f = p.then; p.then = null; if (f) f(); }
        } else {
          ux = dx / d; uy = dy / d;
          walked = this.stepBy(ux, uy, Math.min(d, this.stepLen(ux, uy, dt)));
          p.stuck = walked ? 0 : p.stuck + dt;
          if (p.stuck > 0.6) { const f = p.then; p.path = null; p.then = null; if (f) f(); }
        }
      }
    }
    this.settle(walked, ux, uy, dt);
  }
  // The walk cycle, the facing and the footsteps. Going mainly up or down keeps the last sideways facing.
  settle(walked, ux, uy, dt) {
    const p = this.player;
    p.moving = walked && !this.blocked;
    if (!p.moving) return;
    if (Math.abs(ux) > 0.3) p.face = ux < 0 ? -1 : 1;
    p.dir = Math.abs(ux) >= Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
    this.stepT -= dt;
    if (this.stepT <= 0) { play('step'); this.stepT = 0.32; }
  }
  // Rooms walk as they always did: mostly side to side, with a little depth.
  updateRoom(dt) {
    const p = this.player, it = this.interior;
    let mx = 0, my = 0;
    if (!this.blocked) {
      const k = this.keys, sp = ROOM.speed * dt, dp = ROOM.depth * dt;
      if (k.has('left')) mx -= sp;
      if (k.has('right')) mx += sp;
      if (k.has('up')) my -= dp;
      if (k.has('down')) my += dp;
      const q = this.press;
      if (!mx && !my && q && (!q.sign || q.drag)) {
        const dx = q.sx - p.x, dy = q.sy - p.y;
        if (Math.abs(dx) > 4) mx = Math.sign(dx) * Math.min(Math.abs(dx), sp);
        if (Math.abs(dy) > 4) my = Math.sign(dy) * Math.min(Math.abs(dy), dp);
      }
      if (!mx && !my && p.path) {
        const dx = p.path[0][0] - p.x, dy = p.path[0][1] - p.y;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 2) { p.path = null; const f = p.then; p.then = null; if (f) f(); }
        else { mx = Math.sign(dx) * Math.min(Math.abs(dx), sp); my = Math.sign(dy) * Math.min(Math.abs(dy), dp); }
      }
    }
    if (!this.interior) return; // what just ran may have left the room
    const nx = clamp(p.x + mx, ROOM.margin, VIEW_W - ROOM.margin), ny = clamp(p.y + my, FLOOR.y0, FLOOR.y1);
    const walked = Math.abs(nx - p.x) > 0.001 || Math.abs(ny - p.y) > 0.001;
    p.x = nx; p.y = ny;
    this.settle(walked, mx, my, dt);
    if (!this.blocked) {
      const left = it.exit[0] < 1;
      if (p.x >= it.exit[0] - 8 && p.x <= it.exit[1] + 8 && (left ? mx < 0 : mx > 0)) this.exit();
    }
  }
  updateFolk(dt) {
    for (const f of this.folk) {
      f.t += dt;
      if (!f.wander) continue;
      if (f.pause > 0) { f.pause -= dt; f.moving = false; continue; }
      const dx = f.gx - f.x, dy = f.gy - f.y, d = Math.hypot(dx, dy);
      if (d < 2) { f.pause = 2 + hash(f.t) * 4; f.gx = f.wander.x[0] + hash(f.t + 5) * (f.wander.x[1] - f.wander.x[0]); f.gy = f.wander.y[0] + hash(f.t + 9) * (f.wander.y[1] - f.wander.y[0]); f.moving = false; }
      else { const st = Math.min(d, 42 * dt); f.x += dx / d * st; f.y += dy / d * st; if (Math.abs(dx) > 1) f.face = Math.sign(dx); f.moving = true; }
    }
    // The patrol walks its loop and stops at each corner to look about.
    const g = this.patrol;
    if (g && !this.interior) {
      g.t += dt;
      if (g.pause > 0) { g.pause -= dt; g.moving = false; }
      else {
        const [gx, gy] = g.route[g.leg], dx = gx - g.x, dy = gy - g.y, d = Math.hypot(dx, dy);
        if (d < 2) { g.leg = (g.leg + 1) % g.route.length; g.pause = 1.2; g.moving = false; }
        else { const st = Math.min(d, 62 * dt); g.x += dx / d * st; g.y += dy / d * st; if (Math.abs(dx) > 1) g.face = Math.sign(dx); g.dir = dx < 0 ? 'left' : 'right'; g.moving = true; }
      }
    }
  }
  updateEffects(dt) {
    for (const r of this.rain) { r.y += r.v * dt; r.x -= r.v * 0.2 * dt; if (r.y > VIEW_H) { r.y = -14; r.x = Math.random() * (VIEW_W + 60); } if (r.x < -20) r.x += VIEW_W + 40; }
    if (this.interior) return;
    this.rippleT -= dt;
    for (const r of this.ripples) r.age += dt;
    if (this.rippleT <= 0) {
      this.rippleT = 0.3;
      const r = this.ripples.find((q) => q.age > q.life), q = PLACES.puddles[Math.floor(Math.random() * PLACES.puddles.length)];
      if (r && q) { r.x = q.x[0] + Math.random() * (q.x[1] - q.x[0]); r.y = q.y + (Math.random() - 0.5) * 8; r.age = 0; r.life = 0.8 + Math.random() * 0.4; }
    }
    this.puffT -= dt;
    for (const q of this.puffs) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    if (this.puffT <= 0) {
      this.puffT = 0.3;
      for (const v of PLACES.steam) {
        const q = this.puffs.find((o) => o.age > o.life);
        if (!q) break;
        q.x = v.x + (Math.random() - 0.5) * 10; q.y = v.y; q.vx = 3 + Math.random() * 8; q.vy = -(v.big ? 24 : 14) - Math.random() * 10; q.age = 0; q.life = v.big ? 2.2 : 1.4; q.size = v.big ? 26 : 14;
      }
    }
    const em = PLACES.embers;
    this.sparkT -= dt;
    for (const q of this.sparks) { q.age += dt; q.x += (q.vx + Math.sin(q.age * 5) * 12) * dt; q.y += q.vy * dt; }
    if (this.sparkT <= 0 && em) {
      this.sparkT = 0.22;
      const q = this.sparks.find((o) => o.age > o.life);
      if (q) { q.x = em.x + (Math.random() - 0.5) * 14; q.y = em.y; q.vx = (Math.random() - 0.5) * 14; q.vy = -24 - Math.random() * 34; q.age = 0; q.life = 0.9 + Math.random() * 1; }
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
      else if (d > 0.5) { const step = Math.min(d, Math.max(WALK.speed * 1.15, d * 6) * dt); m.x += (dx / d) * step; m.y += (dy / d) * step; }
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
      const f = reduceMotion && !moving ? 0 : walk ? Math.floor(t * (a.fps || 8)) % a.frames : a.frames >= 6 ? [0, 1, 2, 1][Math.floor(t * 2) % 4] : Math.floor(t * (a.fps || 8)) % a.frames; // standing: a slow, small breath, not the whole idle cycle
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
  drawShadow(x, y, h) {
    const w = h * 0.46, d = Math.max(6, h * 0.1);
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
  drawBack(key) {
    const g = this.g, im = this.baked && this.baked[key];
    if (im) { g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0); }
    else { g.fillStyle = '#10121a'; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  }
  drawLight(l, i, t) {
    const base = l.a === undefined ? 0.5 : l.a * 2;
    let a = 0.5;
    if (!reduceMotion) {
      if (l.kind === 'lamp') a = hash(i + Math.floor(t * 0.9)) < 0.06 && hash(i * 3 + Math.floor(t * 14)) < 0.5 ? 0.16 : 0.48 + 0.03 * Math.sin(t * 3 + i);
      else if (l.kind === 'neon') a = hash(i + Math.floor(t * 11)) < 0.05 ? 0.14 : 0.52 + 0.04 * Math.sin(t * 17 + i);
      else if (l.kind === 'fire') a = 0.46 + 0.14 * hash(i + Math.floor(t * 9));
    }
    const g = this.g;
    g.globalAlpha = a * base;
    g.drawImage(glowSprite(l.color), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  draw(now) {
    const g = this.g, t = now / 1000, s = this.s, it = this.interior;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#07080c'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(s, 0, 0, s, this.ox, this.oy);
    this.drawBack(it ? `int_${this.interiorId}` : 'yard');
    // Light on the walls, then what's on the ground, then people, then what's in the air.
    g.globalCompositeOperation = 'lighter';
    g.imageSmoothingEnabled = true;
    const lights = it ? it.lights : PLACES.lights;
    for (let i = 0; i < lights.length; i++) this.drawLight(lights[i], i, t);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (!it && !reduceMotion) this.drawRipples();
    this.drawGoal();
    this.drawPeople(t, it);
    const n = this.nearby();
    if (!it && n) this.drawChevron(n, t);
    g.imageSmoothingEnabled = true;
    if (!reduceMotion) { if (!it) this.drawAir(); else this.drawDust(t); }
    g.globalAlpha = 1;
    if (this.debug && !it) this.drawDebug();
    this.drawBars();
    this.drawOverlay(now, n);
  }
  // Effects may stray off the picture: the bars go on last. Only drawn when the view's shape differs.
  drawBars() {
    const g = this.g, W = this.cv.width, H = this.cv.height, { ox, oy } = this;
    if (ox <= 0 && oy <= 0) return;
    const pw = Math.ceil(VIEW_W * this.s), ph = Math.ceil(VIEW_H * this.s);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07080c';
    if (ox > 0) { g.fillRect(0, 0, ox, H); g.fillRect(ox + pw, 0, W - ox - pw, H); }
    if (oy > 0) { g.fillRect(0, 0, W, oy); g.fillRect(0, oy + ph, W, H - oy - ph); }
  }
  // A small ring where a tap is taking you.
  drawGoal() {
    const p = this.player;
    if (!p.path || !p.path.length) return;
    const [x, y] = p.path[p.path.length - 1], g = this.g;
    g.strokeStyle = '#e8973a'; g.lineWidth = 1.5; g.globalAlpha = 0.7;
    g.beginPath(); g.ellipse(x, y, 9, 3.5, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }
  // Points through the door you are next to.
  drawChevron(n, t) {
    const d = n.door || null;
    if (!d) return;
    const g = this.g, bob = reduceMotion ? 0 : Math.sin(t * 5) * 2.5, [ux, uy] = d.push, off = 18 + bob, x = d.x + ux * off, y = d.y + uy * off, sz = 7;
    const px = -uy, py = ux; // across the way through
    g.beginPath();
    g.moveTo(x + ux * sz, y + uy * sz);
    g.lineTo(x + px * sz, y + py * sz);
    g.lineTo(x - px * sz, y - py * sz);
    g.closePath();
    g.lineWidth = 2; g.strokeStyle = '#0a0b10'; g.stroke();
    g.fillStyle = d.enterable ? '#e8973a' : '#aeb4c0'; g.fill();
  }
  drawRipples() {
    const g = this.g;
    g.strokeStyle = '#cfe0ff'; g.lineWidth = 1;
    for (const r of this.ripples) if (r.age < r.life) {
      const q = r.age / r.life, rad = 2 + q * 12;
      g.globalAlpha = (1 - q) * 0.36;
      g.beginPath(); g.ellipse(r.x, r.y, rad, rad * 0.32, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }
  drawPeople(t, it) {
    const p = this.player, m = this.partner, list = this.people || (this.people = []);
    list.length = 0;
    const add = (id, x, y, h, moving, dir, face, time, native) => { list.push({ id, x, y, h, moving, dir, face, t: time, native }); };
    const toward = (x, near, dflt) => (Math.abs(p.x - x) < near ? (p.x < x ? -1 : 1) : dflt);
    if (it && it.girls) for (const g of this.girlsHere()) { if (this.led && this.led.id === `girl_${g.id}` && this.led.phase !== 'gone') continue; add(`girl_${g.id}`, g.x, MID_Y - 8, ROOM.figure * 0.96, false, 'down', toward(g.x, 9999, -1), t + g.x / 97, -1); }
    if (it && it.npc) { const n = it.npc; add(n.id, n.x, n.y || MID_Y - 8, n.h, false, 'down', toward(n.x, 9999, -1), t + 0.4, -1); if (it.also) add(it.also.id, it.also.x, it.also.y || MID_Y - 8, it.also.h, false, 'down', toward(it.also.x, 9999, -1), t + 1.1, -1); }
    else if (!it) {
      for (const f of this.folk) add(f.id, f.x, f.y, f.h * depthAt(f.y), f.moving, f.dir, f.moving ? f.face : toward(f.x, 150, f.face), f.t, -1);
      const gd = this.patrol;
      add('patrol', gd.x, gd.y, gd.h * depthAt(gd.y), gd.moving, gd.dir, gd.face, gd.t, -1);
    }
    add('player', p.x, p.y, this.figureAt(p.y), p.moving, p.dir, p.face, p.t, 1);
    if (m && m.scene === this.scene) add('partner', m.x, m.y, this.figureAt(m.y), m.moving, m.dir, m.face, m.t, 1);
    const eg = this.led;
    if (eg && eg.phase !== 'gone') add(eg.id, eg.x, eg.y, this.figureAt(eg.y) * 0.96, eg.moving, eg.face < 0 ? 'left' : 'right', eg.face, eg.t, -1);
    list.sort((a, b) => a.y - b.y);
    for (const o of list) {
      if (it) o.h *= 1 + (o.y - MID_Y) * 0.002; // a touch bigger nearer the viewer
      o.pic = this.pose(o.id, o.moving, o.dir, o.face, o.t, o.h, o.native);
    }
    for (const o of list) this.drawShadow(o.x, o.y, o.h);
    for (const o of list) { if (o.pic) this.drawPose(o.pic, o.x, o.y); else this.drawBlank(o.x, o.y, o.h); }
  }
  drawAir() {
    const g = this.g, puff = glowSprite('#c8d2e0');
    for (const q of this.puffs) if (q.age < q.life) {
      const k = q.age / q.life, d = q.size * (0.6 + k * 1.6);
      g.globalAlpha = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.2;
      g.drawImage(puff, q.x - d / 2, q.y - d / 2, d, d);
    }
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ff9a3a';
    for (const q of this.sparks) if (q.age < q.life) { g.globalAlpha = 1 - q.age / q.life; g.fillRect(q.x, q.y, 2, 2); }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(170,190,225,.26)'; g.lineWidth = 1;
    g.beginPath();
    for (const r of this.rain) { g.moveTo(r.x, r.y); g.lineTo(r.x - 2.6, r.y + 13); }
    g.stroke();
  }
  // A few motes turning in the light of a room. Their paths come from the clock, so there is nothing to keep.
  drawDust(t) {
    const g = this.g;
    g.fillStyle = '#e6dcc8';
    for (let i = 0; i < 10; i++) {
      const x = (hash(i) * VIEW_W + t * (4 + hash(i + 9) * 8) + Math.sin(t * 0.7 + i) * 8) % VIEW_W, y = 50 + hash(i + 20) * 230 + Math.sin(t * 0.5 + i * 2) * 10;
      g.globalAlpha = 0.14 + 0.14 * Math.sin(t + i);
      g.fillRect(x, y, 2, 2);
    }
    g.globalAlpha = 1;
  }
  // Set cinderTown.debug = true to see PLACES drawn over the art while lining them up.
  drawDebug() {
    const g = this.g;
    g.lineWidth = 1; g.font = '10px monospace'; g.textAlign = 'center';
    const poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    g.strokeStyle = '#3cff7a'; poly(WALK.area); g.stroke();
    g.strokeStyle = '#ff4a4a'; for (const b of WALK.blocks) g.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    for (const d of this.doors) {
      const [x0, y0, x1, y1] = d.b.box;
      g.strokeStyle = 'rgba(255,220,90,.8)'; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = '#ffdc5a'; g.fillRect(d.x - 2, d.y - 2, 4, 4); g.fillText(d.id, d.x, d.y - 5);
    }
    for (const h of PLACES.spots) {
      const q = this.standOf(h);
      g.strokeStyle = 'rgba(120,200,255,.8)'; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#78c8ff'; g.fillRect(q[0] - 2, q[1] - 2, 4, 4); g.fillText(h.id, h.x, h.y);
    }
  }

  // ---------- speech and prompts: HTML, so the text stays crisp ----------
  placeTag(el, text, x, y, up = 0) {
    if (el.textContent !== text) el.textContent = text;
    if (el.hidden) el.hidden = false;
    el.style.left = `${clamp(this.cssX(x), 22, this.cssW - 22)}px`;
    el.style.top = `${Math.max(16, this.cssY(y - this.figureAt(y) - 3) - up)}px`;
  }
  // Names over both heads, the partner's in another colour; their speech; and a mark on the sign of wherever they've gone in.
  drawPartnerOverlay(now) {
    const m = this.partner, here = m && m.scene === this.scene, p = this.player;
    const hide = (el) => { if (!el.hidden) el.hidden = true; };
    this.markSigns(m);
    if (!m) { hide(this.tag); hide(this.meTag); hide(this.mateBubble); return; }
    // Standing together, one name goes up a row so both can be read.
    const close = here && Math.abs(this.cssX(p.x) - this.cssX(m.x)) < 64 && Math.abs(this.cssY(p.y) - this.cssY(m.y)) < 18;
    this.placeTag(this.meTag, 'You', p.x, p.y);
    if (here) this.placeTag(this.tag, m.name || 'Partner', m.x, m.y, close ? 16 : 0); else hide(this.tag);
    if (m.say && now < m.say.until && here) {
      if (this.mateBubble.textContent !== m.say.text) this.mateBubble.textContent = m.say.text;
      this.mateBubble.hidden = false;
      this.mateBubble.style.left = `${clamp(this.cssX(m.x) / this.cssW * 100, 12, 88)}%`; this.mateBubble.style.top = `${clamp(this.cssY(m.y - this.figureAt(m.y) - 26) / this.cssH * 100, 26, 90)}%`;
    } else hide(this.mateBubble);
  }
  markSigns(m) {
    const inside = m && m.scene && m.scene.startsWith('interior:') ? m.scene.slice(9) : null;
    const id = m ? (MENU_SIGN[m.menu] || inside) : null, key = id ? `${id}:${m.name || ''}` : '';
    if (key === this.markKey) return;
    this.markKey = key;
    for (const k in this.signs) {
      const on = k === id, el = this.signs[k].el;
      el.classList.toggle('mate', on);
      if (on) el.title = `${m.name || 'Your partner'} is here`; else el.removeAttribute('title');
    }
  }
  drawOverlay(now, n) {
    const s = this.say, b = this.bubble;
    if (s && now < s.until) {
      if (b.hidden || b.textContent !== s.text) { b.textContent = s.text; b.hidden = false; }
      b.style.left = `${clamp(this.cssX(s.x) / this.cssW * 100, 12, 88)}%`; b.style.top = `${clamp(this.cssY(s.y - this.figureAt(s.y) - (this.partner ? 26 : 8)) / this.cssH * 100, 26, 90)}%`;
    } else if (!b.hidden) { b.hidden = true; this.say = null; }
    this.drawPartnerOverlay(now);
    const pulse = !this.touched && !this.blocked && !reduceMotion && !this.interior;
    if (pulse !== this.pulsing) { this.pulsing = pulse; this.signs.terminal.el.classList.toggle('pulse', pulse); }
    const E = coarse ? 'Tap' : 'E';
    let text = '', act = true;
    if (this.offer) text = coarse ? 'Tap here \u00B7 yes \u00B7 tap the yard \u00B7 no' : 'Enter \u00B7 yes \u00B7 Esc \u00B7 no';
    else if (n && n.kind === 'partner') text = `${E} \u00B7 trade or give to ${n.who.name || 'your partner'}`;
    else if (n && n.kind === 'npc') text = `${E} \u00B7 talk to ${npcName(n.id)} (${n.also ? 'Wheel' : this.interiorId === 'lantern' ? 'Bar' : SHOPS[this.interiorId].label})`;
    else if (n && n.kind === 'folk') text = n.who.talk ? `${E} \u00B7 talk to the vendor` : `${E} \u00B7 talk`;
    else if (n && n.kind === 'spot') text = `${E} \u00B7 ${n.spot.prompt}`;
    else if (n && n.kind === 'girl') text = `${E} \u00B7 talk to ${n.name}`;
    else if (n && n.kind === 'back') text = `${E} \u00B7 through the curtain`;
    else if (n && n.kind === 'table') text = `${E} \u00B7 sit at the card table \u00B7 Velvet Hearts`;
    else if (n && n.kind === 'door') { const sh = SHOPS[n.door.id]; text = `${E} \u00B7 go in \u00B7 ${sh.label}`; }
    else {
      act = false;
      if (this.interior) {
        const side = this.interior.exit[0] < 1 ? 'left' : 'right';
        if (!this.interior.npc) text = `${this.interior.name || 'E-Girl Room'} \u00B7 ${coarse ? 'walk' : 'Esc or walk'} ${side} to leave`;
        else { const who = npcName(this.interior.npc.id);
        text = coarse ? `Talk to ${who} \u00B7 walk ${side} to leave` : `${SHOPS[this.interiorId].name} \u00B7 talk to ${who} \u00B7 Esc or walk ${side} to leave`; }
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
function paintYardPlaceholder(g) {
  g.fillStyle = '#14161e'; g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = '#2d303a';
  g.beginPath(); WALK.area.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.035)';
  for (let y = 150; y < VIEW_H; y += 22) g.fillRect(0, y, VIEW_W, 1);
  PLACES.buildings.forEach((b, i) => {
    const [x0, y0, x1, y1] = b.box;
    g.fillStyle = ['#343745', '#3a3438', '#2f3a44', '#3d3a33'][i % 4]; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, y0, x1 - x0, 6);
    g.fillStyle = PLACES.interiors[b.id] && !b.knock ? '#5a4a2e' : '#1b1c22'; g.fillRect(b.door[0] - 10, b.door[1] - 26, 20, 20);
    label(g, SHOPS[b.id].name.split(' ').slice(-2).join(' '), (x0 + x1) / 2, y1 - 8, 11);
  });
  for (const h of PLACES.spots) {
    g.fillStyle = 'rgba(120,135,160,.3)';
    g.beginPath(); g.arc(h.x, h.y, Math.min(h.r, 22), 0, Math.PI * 2); g.fill();
    label(g, h.id, h.x, h.y + 4, 10);
  }
  for (const b of WALK.blocks) { g.fillStyle = '#20222b'; g.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); }
}
function paintRoomPlaceholder(g, id) {
  const wall = g.createLinearGradient(0, 0, 0, FLOOR.wall);
  wall.addColorStop(0, '#1a1c25'); wall.addColorStop(1, '#2c2d38');
  g.fillStyle = wall; g.fillRect(0, 0, VIEW_W, FLOOR.wall);
  g.fillStyle = '#23242d'; g.fillRect(0, FLOOR.wall, VIEW_W, VIEW_H - FLOOR.wall);
  g.fillStyle = '#0f1016'; g.fillRect(0, FLOOR.wall, VIEW_W, 3);
  const it = PLACES.interiors[id];
  if (it) {
    const left = it.exit[0] < 1;
    g.fillStyle = '#4a3e2a'; g.fillRect(left ? 8 : VIEW_W - 60, FLOOR.wall - 140, 52, 140);
    label(g, 'EXIT', left ? 34 : VIEW_W - 34, FLOOR.wall - 150, 12);
  }
  label(g, (SHOPS[id] || it || { name: id }).name || id, VIEW_W / 2, 58, 15);
}
