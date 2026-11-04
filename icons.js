// Code-drawn 24x24 pixel icons for gear, items, implants, contraband, upgrades, skills and rooms.
// Same palette, shading and outline as the portraits. Keys look like 'weapon:carbine' or 'perk:hollow'.
import { makeGrid, outline } from './portraits.js';

const S = 24;

// ---------- shared shapes ----------
function ring(g, cx, cy, r, mat, shade = 1, t = 1) {
  for (let a = 0; a < 360; a += 4) for (let k = 0; k < t; k++) g.dot(Math.round(cx + Math.cos(a * Math.PI / 180) * (r - k)), Math.round(cy + Math.sin(a * Math.PI / 180) * (r - k)), mat, shade);
}
function gun(g, { x = 4, y = 10, len = 13, h = 4, body = 'grey', barrel = 'black', bl = 4, stock = null, grip = 'brown', mag = null, scope = null, drum = null, accent = null }) {
  if (stock) g.rect(x - 3, y, 4, h, stock);
  g.rect(x, y, len, h, body);
  g.rect(x + len, y + 1, bl, Math.max(1, h - 2), barrel, 1);
  g.rect(x + 3, y + h, 2, 5, grip);
  if (mag) g.rect(x + Math.floor(len / 2), y + h, 2, 4, mag);
  if (drum) g.ellipse(x + len / 2, y + h + 2, 3, 3, drum);
  if (scope) { g.rect(x + 3, y - 3, 7, 2, scope); g.dot(x + 10, y - 2, 'ion', 2); }
  if (accent) g.rect(x + 1, y + 1, len - 2, 1, accent, 2);
}
function torso(g, mat, collar = 'black') {
  g.ellipse(12, 9, 10, 5, mat);
  g.rect(4, 9, 16, 12, mat);
  g.rect(9, 4, 6, 3, collar, 0);
}
function heart(g, mat = 'red') { g.ellipse(8, 9, 5, 5, mat); g.ellipse(16, 9, 5, 5, mat); g.tri(3, 11, 21, 11, 12, 21, mat, 1); g.dot(7, 7, mat, 2); }
function crosshair(g, mat = 'red') { ring(g, 12, 12, 8, mat, 1, 2); g.rect(11, 2, 2, 6, mat); g.rect(11, 16, 2, 6, mat); g.rect(2, 11, 6, 2, mat); g.rect(16, 11, 6, 2, mat); g.dot(12, 12, mat, 2); }
function shield(g, mat = 'grey') { g.rect(5, 3, 14, 9, mat); g.tri(5, 12, 19, 12, 12, 21, mat, 1); g.rect(11, 5, 2, 12, mat, 2); }
function bolt(g, mat = 'yellow') { g.tri(14, 1, 5, 13, 12, 13, mat, 2); g.tri(12, 11, 19, 11, 9, 23, mat, 1); }
function skull(g, eye = 'black') { g.ellipse(12, 10, 8, 7, 'white'); g.rect(8, 15, 8, 5, 'white'); g.rect(7, 9, 4, 3, eye, eye === 'black' ? 0 : 2); g.rect(13, 9, 4, 3, eye, eye === 'black' ? 0 : 2); g.dot(12, 13, 'black', 0); for (let x = 9; x < 16; x += 2) g.rect(x, 17, 1, 3, 'black', 0); }
function crate(g, mat = 'brown') { g.rect(3, 7, 18, 14, mat); g.rect(3, 7, 18, 1, mat, 2); for (let y = 11; y < 21; y += 4) g.rect(3, y, 18, 1, mat, 0); g.rect(3, 7, 2, 14, mat, 0); g.rect(19, 7, 2, 14, mat, 0); }
function fist(g, mat = 'skin') { g.rect(6, 8, 12, 10, mat); for (let x = 9; x < 18; x += 3) g.rect(x, 8, 1, 4, mat, 0); g.rect(4, 12, 4, 5, mat, 1); g.rect(8, 18, 8, 4, 'rust'); }
function coin(g, x = 12, y = 12, r = 8) { g.ellipse(x, y, r, r, 'gold'); g.ellipse(x, y, r - 3, r - 3, 'gold', 1); g.rect(x - 1, y - 3, 2, 6, 'gold', 0); }
function medbag(g, mat = 'white', cross = 'red') { g.rect(3, 8, 18, 13, mat); g.rect(9, 5, 6, 3, 'black', 1); g.rect(10, 11, 4, 8, cross, 1); g.rect(8, 13, 8, 4, cross, 1); }

// ---------- icon definitions ----------
const DRAW = {
  // weapons
  'weapon:holdout': (g) => gun(g, { x: 5, len: 9, h: 4, bl: 3 }),
  'weapon:baton': (g) => { g.line(5, 20, 17, 6, 'black', 1); g.line(6, 20, 18, 6, 'black', 0); g.line(4, 19, 7, 16, 'brown', 1); g.ellipse(18, 5, 2, 2, 'ion', 2); g.dot(20, 3, 'ion', 2); g.dot(16, 3, 'ion', 1); },
  'weapon:carbine': (g) => gun(g, { x: 4, len: 13, stock: 'brown', mag: 'black' }),
  'weapon:scatter': (g) => { gun(g, { x: 5, len: 14, h: 5, bl: 3, stock: 'brown', accent: 'yellow' }); g.rect(10, 15, 6, 2, 'brown'); },
  'weapon:longbore': (g) => gun(g, { x: 3, y: 11, len: 15, h: 3, bl: 5, body: 'olive', stock: 'olive', scope: 'black' }),
  'weapon:maul': (g) => { g.line(5, 21, 13, 9, 'brown', 1); g.line(6, 21, 14, 9, 'brown', 0); g.rect(9, 3, 11, 7, 'grey'); g.rect(9, 3, 11, 1, 'grey', 2); g.rect(18, 3, 2, 7, 'yellow', 1); },
  'weapon:sidearm': (g) => { gun(g, { x: 5, len: 10, h: 4, bl: 3, body: 'silver', grip: 'black' }); g.rect(7, 11, 6, 1, 'gold', 2); },
  'weapon:gilded': (g) => { gun(g, { x: 3, len: 14, h: 5, bl: 5, body: 'gold', barrel: 'black', drum: 'gold', grip: 'brown' }); g.rect(5, 11, 10, 1, 'gold', 2); },
  'armor:coat': (g) => { torso(g, 'navy'); g.rect(4, 6, 4, 2, 'gold', 2); g.rect(16, 6, 4, 2, 'gold', 2); for (let y = 10; y < 20; y += 3) g.dot(12, y, 'gold', 2); g.rect(11, 9, 2, 12, 'navy', 0); },
  'weapon:arc': (g) => { g.ellipse(10, 11, 7, 4, 'white'); for (let x = 6; x < 15; x += 3) g.rect(x, 8, 1, 7, 'ion', 1); g.rect(16, 10, 4, 3, 'grey'); g.ellipse(21, 11, 2, 2, 'ion', 2); g.rect(7, 15, 2, 5, 'black'); },
  'weapon:repeater': (g) => { gun(g, { x: 3, len: 14, h: 5, bl: 5, body: 'black', barrel: 'grey', drum: 'grey' }); for (let x = 18; x < 22; x += 2) g.dot(x, 10, 'ion', 2); },
  'weapon:marksman': (g) => gun(g, { x: 2, y: 11, len: 17, h: 3, bl: 4, body: 'silver', barrel: 'black', stock: 'silver', grip: 'black', scope: 'black' }),
  'weapon:cannon': (g) => { g.rect(2, 8, 18, 7, 'olive'); g.ellipse(20, 11, 2, 4, 'black'); for (let x = 5; x < 18; x += 5) g.rect(x, 8, 2, 7, 'yellow', 1); g.rect(9, 15, 3, 5, 'black'); },

  // armour
  'armor:none': (g) => { torso(g, 'rust'); g.rect(14, 12, 4, 3, 'tan', 1); g.rect(11, 9, 2, 12, 'rust', 0); },
  'armor:vest': (g) => { torso(g, 'tan'); for (let y = 11; y < 21; y += 3) g.rect(5, y, 14, 1, 'tan', 0); g.rect(11, 7, 2, 14, 'brown', 0); },
  'armor:plates': (g) => { torso(g, 'rust'); g.rect(6, 10, 5, 5, 'grey'); g.rect(13, 10, 5, 5, 'grey'); g.rect(6, 16, 12, 4, 'grey'); },
  'armor:trooper': (g) => { torso(g, 'black'); g.ellipse(12, 13, 7, 6, 'black', 2); g.line(8, 11, 14, 17, 'grey', 1); g.rect(4, 7, 4, 3, 'grey', 1); g.rect(16, 7, 4, 3, 'grey', 1); },
  'armor:weave': (g) => { torso(g, 'navy'); for (let y = 9; y < 21; y += 2) for (let x = 5 + (y % 4 ? 1 : 0); x < 19; x += 2) g.dot(x, y, 'navy', 2); },
  'armor:exo': (g) => { torso(g, 'grey'); g.rect(3, 6, 4, 15, 'yellow'); g.rect(17, 6, 4, 15, 'yellow'); g.rect(8, 10, 8, 3, 'black', 1); g.rect(9, 15, 6, 2, 'yellow', 1); },

  // items
  'item:stim': (g) => { g.line(5, 19, 14, 10, 'white', 2); g.line(6, 19, 15, 10, 'white', 1); g.line(7, 19, 16, 10, 'white', 0); g.line(7, 17, 12, 12, 'green', 2); g.line(15, 9, 19, 5, 'silver', 2); g.rect(3, 19, 3, 3, 'grey'); },
  'item:thermal': (g) => { g.ellipse(12, 13, 8, 8, 'olive'); g.rect(4, 12, 16, 2, 'fire', 1); g.rect(10, 3, 4, 3, 'grey'); g.dot(12, 9, 'red', 2); },
  'item:ion': (g) => { g.ellipse(12, 12, 7, 7, 'ion'); ring(g, 12, 12, 10, 'ion', 2); g.dot(9, 9, 'white', 2); g.dot(21, 6, 'ion', 2); g.dot(3, 18, 'ion', 2); },
  'item:smoke': (g) => { g.rect(8, 10, 8, 12, 'grey'); g.rect(8, 13, 8, 2, 'yellow', 1); g.ellipse(9, 6, 4, 3, 'silver', 1); g.ellipse(15, 5, 5, 4, 'silver', 2); g.ellipse(12, 2, 3, 2, 'silver', 1); },

  // implants
  'implant:reflex': (g) => { for (let y = 3; y < 22; y += 4) g.rect(10, y, 4, 3, 'pale'); bolt(g, 'ion'); },
  'implant:dermal': (g) => { for (let y = 3; y < 21; y += 6) for (let x = 3 + (y % 12 ? 3 : 0); x < 20; x += 7) g.rect(x, y, 6, 5, 'silver'); },
  'implant:optic': (g) => { g.ellipse(12, 12, 10, 6, 'white'); g.ellipse(12, 12, 4, 4, 'red'); g.dot(12, 12, 'black', 0); g.rect(11, 4, 2, 3, 'red', 2); g.rect(11, 17, 2, 3, 'red', 2); },
  'implant:pain': (g) => { g.ellipse(12, 11, 9, 8, 'pale'); g.line(7, 8, 11, 12, 'pale', 0); g.line(13, 6, 16, 11, 'pale', 0); g.rect(3, 13, 18, 3, 'grey'); g.dot(12, 14, 'ion', 2); },
  'implant:adrenal': (g) => { heart(g, 'red'); g.line(12, 2, 12, 9, 'ion', 2); g.dot(12, 1, 'ion', 2); },
  'implant:myomer': (g) => { g.ellipse(9, 13, 6, 8, 'rust'); g.ellipse(16, 8, 5, 4, 'rust'); for (let y = 8; y < 20; y += 3) g.line(5, y, 13, y - 2, 'rust', 0); g.rect(3, 19, 6, 3, 'grey'); },
  'implant:neural': (g) => { g.ellipse(12, 11, 9, 8, 'pale'); g.line(5, 11, 19, 11, 'pale', 0); [[7, 7], [16, 8], [9, 15], [15, 15]].forEach(([x, y]) => g.dot(x, y, 'ion', 2)); g.line(7, 7, 16, 8, 'ion', 1); g.line(9, 15, 15, 15, 'ion', 1); },
  'implant:voice': (g) => { g.ellipse(9, 12, 6, 6, 'grey'); for (let y = 9; y < 16; y += 2) g.rect(6, y, 6, 1, 'black', 0); ring(g, 13, 12, 7, 'ion', 2); ring(g, 13, 12, 10, 'ion', 1); g.rect(2, 5, 4, 14, 'black'); },
  'implant:synapse': (g) => { g.rect(6, 6, 12, 12, 'black'); for (let i = 7; i < 18; i += 3) { g.rect(i, 3, 1, 3, 'silver', 2); g.rect(i, 18, 1, 3, 'silver', 2); g.rect(3, i, 3, 1, 'silver', 2); g.rect(18, i, 3, 1, 'silver', 2); } g.line(8, 15, 12, 9, 'ion', 2); g.line(12, 9, 16, 13, 'ion', 2); },

  // contacts and mods
  'upgrade:belt': (g) => { g.line(3, 4, 20, 21, 'brown', 1); g.line(4, 4, 21, 21, 'brown', 0); g.line(2, 5, 19, 22, 'brown', 2); for (let i = 0; i < 4; i++) g.rect(6 + i * 4, 4 + i * 4, 3, 4, 'yellow', 1); },
  'upgrade:medic': (g) => medbag(g),
  'upgrade:drill': (g) => fist(g),
  'upgrade:forger': (g) => { g.rect(5, 2, 13, 19, 'paper'); for (let y = 5; y < 13; y += 2) g.rect(7, y, 9, 1, 'grey', 1); g.ellipse(14, 16, 4, 4, 'red', 1); g.dot(14, 16, 'red', 2); },
  'upgrade:fence': (g) => { for (let i = 0; i < 4; i++) { g.ellipse(9, 19 - i * 3, 6, 2, 'gold'); } coin(g, 17, 9, 5); },

  // contraband
  'perk:hollow': (g) => { g.rect(8, 9, 8, 12, 'gold'); g.ellipse(12, 8, 4, 5, 'grey'); g.dot(12, 4, 'black', 0); g.rect(8, 19, 8, 2, 'gold', 0); },
  'perk:dressing': (g) => { g.ellipse(10, 12, 7, 8, 'white'); g.ellipse(10, 12, 3, 4, 'white', 0); g.rect(15, 14, 7, 5, 'white', 1); g.rect(17, 15, 3, 3, 'red', 1); },
  'perk:chit': (g) => { coin(g); g.dot(12, 12, 'black', 0); },
  'perk:serrated': (g) => { g.tri(3, 20, 6, 17, 21, 3, 'silver', 2); g.tri(3, 20, 21, 3, 8, 21, 'silver', 1); for (let i = 0; i < 5; i++) g.dot(9 + i * 3, 18 - i * 3, 'red', 1); g.rect(2, 19, 4, 4, 'brown'); },
  'perk:incendiary': (g) => { g.ellipse(12, 15, 7, 7, 'fire'); g.tri(5, 14, 19, 14, 12, 1, 'fire', 1); g.ellipse(12, 16, 3, 4, 'yellow', 2); },
  'perk:steady': (g) => crosshair(g, 'red'),
  'perk:secondwind': (g) => { [[4, 8], [3, 13], [5, 18]].forEach(([x, y], i) => { g.line(x, y, x + 14 - i * 2, y, 'ion', 2 - (i % 2)); }); g.ellipse(19, 7, 2, 2, 'ion', 1); g.ellipse(18, 18, 2, 2, 'ion', 1); g.dot(12, 13, 'green', 2); },
  'perk:scavenger': (g) => { g.rect(5, 6, 14, 15, 'olive'); g.rect(5, 6, 14, 5, 'olive', 2); g.rect(8, 13, 8, 5, 'olive', 0); g.rect(9, 3, 6, 3, 'brown'); },
  'perk:spotter': (g) => { g.ellipse(7, 13, 5, 6, 'black'); g.ellipse(17, 13, 5, 6, 'black'); g.rect(10, 9, 4, 4, 'black', 1); g.ellipse(7, 14, 2, 3, 'ion', 2); g.ellipse(17, 14, 2, 3, 'ion', 2); },
  'perk:thick': (g) => shield(g, 'brown'),
  'perk:ambush': (g) => { g.tri(11, 1, 14, 1, 12, 14, 'silver', 2); g.rect(11, 2, 3, 12, 'silver', 1); g.rect(7, 14, 11, 2, 'gold'); g.rect(11, 16, 3, 6, 'black'); },
  'perk:deadman': (g) => { skull(g); g.rect(18, 2, 4, 6, 'red'); g.dot(20, 3, 'red', 2); },
  'perk:grudge': (g) => fist(g, 'red'),
  'perk:quickdraw': (g) => { gun(g, { x: 9, len: 9, h: 4, bl: 3 }); for (let y = 9; y < 16; y += 3) g.line(1, y, 6, y, 'yellow', 2); },
  'perk:capacitor': (g) => { g.rect(6, 5, 12, 17, 'grey'); g.rect(9, 2, 6, 3, 'ion'); g.tri(13, 7, 8, 14, 12, 14, 'ion', 2); g.tri(12, 13, 16, 13, 11, 20, 'ion', 2); },
  'perk:reputation': (g) => { g.tri(12, 1, 7, 13, 17, 13, 'gold', 2); g.tri(2, 9, 22, 9, 12, 16, 'gold', 1); g.tri(7, 13, 12, 16, 4, 22, 'gold', 1); g.tri(17, 13, 12, 16, 20, 22, 'gold', 0); },

  // the cell (permanent)
  'cell:stash': (g) => { crate(g); coin(g, 16, 7, 4); },
  'cell:kit': (g) => medbag(g, 'olive', 'white'),
  'cell:cache': (g) => { crate(g, 'olive'); g.rect(4, 4, 16, 3, 'black'); g.rect(17, 3, 4, 2, 'black', 1); },
  'cell:ledger': (g) => { g.rect(4, 3, 16, 19, 'navy'); g.rect(6, 4, 13, 17, 'paper'); for (let y = 7; y < 19; y += 3) g.rect(8, y, 9, 1, 'grey', 1); g.rect(15, 3, 2, 8, 'red', 1); },
  'cell:mentor': (g) => { g.tri(6, 2, 12, 2, 10, 11, 'red', 1); g.tri(12, 2, 18, 2, 14, 11, 'navy', 1); coin(g, 12, 15, 6); },

  // training
  'train:hp': (g) => heart(g),
  'train:atk': (g) => crosshair(g, 'yellow'),
  'train:def': (g) => shield(g, 'grey'),
  'train:spd': (g) => bolt(g, 'yellow'),

  // skills
  'skill:aimed': (g) => crosshair(g, 'red'),
  'skill:burst': (g) => { for (let i = 0; i < 3; i++) { g.rect(4 + i * 6, 8, 4, 10, 'gold'); g.ellipse(6 + i * 6, 7, 2, 3, 'grey'); } },
  'skill:blast': (g) => { g.rect(2, 10, 6, 4, 'grey'); for (let i = -2; i <= 2; i++) g.line(9, 12, 21, 12 + i * 4, 'fire', 2); },
  'skill:smash': (g) => { g.rect(5, 3, 14, 8, 'grey'); g.line(12, 11, 12, 22, 'brown', 1); g.rect(4, 18, 4, 2, 'yellow', 2); g.rect(16, 18, 4, 2, 'yellow', 2); },
  'skill:overload': (g) => bolt(g, 'ion'),
  'skill:suppress': (g) => { g.rect(3, 13, 7, 9, 'grey'); for (let i = 0; i < 3; i++) g.line(11, 6 + i * 5, 21, 6 + i * 5, 'yellow', 2); },
  'skill:intimidate': (g) => skull(g, 'red'),

  // rooms
  'room:fight': (g) => { g.line(4, 4, 19, 19, 'black', 1); g.line(5, 4, 20, 19, 'black', 0); g.line(19, 4, 4, 19, 'grey', 1); g.line(20, 4, 5, 19, 'grey', 0); g.rect(3, 17, 4, 4, 'brown'); g.rect(17, 17, 4, 4, 'brown'); },
  'room:elite': (g) => { skull(g); g.tri(5, 2, 9, 2, 7, 6, 'red', 1); g.tri(15, 2, 19, 2, 17, 6, 'red', 1); },
  'room:event': (g) => { g.rect(7, 3, 10, 3, 'ion', 2); g.rect(6, 5, 3, 3, 'ion', 1); g.rect(15, 5, 3, 6, 'ion', 1); g.rect(11, 10, 5, 3, 'ion', 2); g.rect(11, 12, 3, 4, 'ion', 1); g.rect(11, 18, 3, 3, 'ion', 2); },
  'room:supply': (g) => crate(g),
  'room:rest': (g) => { g.rect(2, 12, 20, 5, 'brown'); g.rect(2, 9, 6, 4, 'white'); g.rect(8, 10, 14, 3, 'olive'); g.rect(2, 17, 2, 4, 'brown', 0); g.rect(20, 17, 2, 4, 'brown', 0); },
  'room:cells': (g) => { ring(g, 7, 8, 5, 'gold', 1, 2); g.rect(11, 7, 11, 3, 'gold'); g.rect(17, 10, 2, 4, 'gold', 0); g.rect(20, 10, 2, 3, 'gold', 0); },
  'room:cargo': (g) => { crate(g, 'grey'); for (let x = 3; x < 21; x += 4) g.line(x, 20, x + 3, 17, 'yellow', 1); },
  'room:boss': (g) => { skull(g, 'red'); g.tri(4, 3, 8, 3, 6, 0, 'gold', 2); g.tri(10, 3, 14, 3, 12, 0, 'gold', 2); g.tri(16, 3, 20, 3, 18, 0, 'gold', 2); g.rect(4, 3, 16, 2, 'gold'); },
};

const cache = {};
export function iconURL(key) {
  if (cache[key] !== undefined) return cache[key];
  const draw = DRAW[key];
  if (!draw || typeof document === 'undefined') return (cache[key] = null);
  const g = makeGrid(S);
  draw(g);
  outline(g);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  g.px.forEach((col, i) => { if (col) { ctx.fillStyle = col; ctx.fillRect(i % S, Math.floor(i / S), 1, 1); } });
  return (cache[key] = c.toDataURL('image/png'));
}
export const iconKeys = () => Object.keys(DRAW);
