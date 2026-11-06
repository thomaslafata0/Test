// Code-drawn guns for combat, at the same pixel density as the 256px character art.
// gunSprite(layerId) returns a cached transparent canvas, side view, muzzle right, cropped tight.
// GUN_GRIP[layerId] is the [x, y] where the hand holds it, measured from that canvas's top-left.
import { Painter, gun, pistol } from './icons.js';

const W = 170, H = 70;

// grip is in painter coordinates; crop offsets are subtracted in gunSprite.
const SPECS = {
  wpn_carbine: {
    grip: [44, 41],
    draw: (p) => {
      gun(p, { x: 30, y: 24, len: 30, h: 11, body: 'gun', barrel: 'steel', bl: 22, bh: 4, by: 26, hand: 14, handMat: 'steel', stock: 'skel', stockMat: 'steel', stockLen: 18, gripMat: 'leather', gh: 12, gw: 7, gx: 41, mag: 'box', magW: 7, magH: 12, magX: 51, muzzle: 'flash', muzzleMat: 'black' });
      p.grime(30, 24, 30, 11, 3, 0.55);
      p.set(47, 26, 'sodium', 5);
    },
  },
  wpn_rifle: {
    grip: [38, 42],
    draw: (p) => {
      gun(p, { x: 24, y: 28, len: 36, h: 9, body: 'gun', barrel: 'steel', bl: 42, bh: 3, by: 30, hand: 18, handMat: 'black', stock: 'solid', stockMat: 'gun', stockLen: 20, gripMat: 'black', gh: 9, gw: 6, gx: 36, mag: 'box', magW: 6, magH: 8, magX: 52, muzzle: 'brake', muzzleMat: 'black', scope: 'glass', scopeW: 24, scopeX: 28, scopeH: 4, scopeMat: 'black' });
      p.line(26, 33, 56, 33, 'ion', 3);
      p.set(45, 32, 'ion', 6);
    },
  },
  wpn_scattergun: {
    grip: [43, 46],
    draw: (p) => {
      gun(p, { x: 30, y: 27, len: 28, h: 13, body: 'steel', barrel: 'black', bl: 26, bh: 8, by: 27, stock: 'wood', stockMat: 'wood', stockLen: 18, gripMat: 'wood', gh: 12, gw: 8, gx: 40, tube: true, pump: 13, pumpMat: 'wood', pumpX: 5, muzzleMat: 'steel' });
      p.rect(44, 29, 8, 3, 'sodium', { bevel: 1, tone: 3.8, k: 1.8, shadow: 0 });
      p.grime(30, 27, 28, 13, 5, 0.5, 'rust');
    },
  },
  wpn_cannon: {
    grip: [48, 50],
    draw: (p) => {
      // bulky shouldered launcher: fat tube, heat bands, flared muzzle, big rear grip and fore grip
      p.poly([[44, 40], [55, 40], [52, 56], [42, 56]], 'black', { bevel: 3, k: 1.6 });
      for (let y = 43; y < 55; y += 3) p.tint(44, y, 52, y, -1);
      p.rect(80, 40, 8, 13, 'black', { bevel: 2, k: 1.6 });
      p.rect(22, 20, 92, 21, 'olive', { bevel: 9, k: 1.9, tone: 3 });
      for (let x = 34; x < 104; x += 18) p.rect(x, 19, 5, 23, 'gun', { bevel: 4, k: 1.9, tone: 3, shadow: 1 });
      p.rect(44, 27, 26, 3, 'yellow', { bevel: 1, tone: 3.5, clip: true, shadow: 0 });
      p.rect(16, 22, 8, 17, 'black', { bevel: 3, k: 1.7 });
      p.poly([[112, 18], [126, 14], [126, 47], [112, 43]], 'black', { bevel: 5, k: 1.9, tone: 2.8 });
      p.rect(123, 17, 3, 27, 'black', { tone: 0.5, k: 0, rim: false, shadow: 0, tex: null, dither: 0 });
      p.rect(42, 13, 24, 7, 'steel', { bevel: 2 });
      p.line(46, 15, 60, 15, 'glass', 6);
      p.rect(66, 15, 3, 5, 'black', { bevel: 1 });
      p.set(52, 33, 'sodium', 6).set(53, 33, 'sodium', 5);
      p.grime(22, 20, 92, 21, 4, 0.55, 'rust');
      p.scuff(26, 22, 80, 10, 3, 8);
    },
  },
  wpn_pistol: {
    grip: [35, 42],
    draw: (p) => {
      pistol(p, { x: 30, y: 25, len: 36, h: 9, slide: 'gun', frame: 'black', gripMat: 'black', barrel: 'steel', bl: 4, gw: 9, gh: 11, fh: 5 });
      p.line(46, 26, 64, 26, 'ion', 3);
      p.set(36, 27, 'ion', 6);
    },
  },
};

// Measured from the crops below; tests/icon-sheet.cjs fails if these drift from the drawing.
export const GUN_GRIP = {
  wpn_carbine: [35, 20],
  wpn_rifle: [36, 21],
  wpn_scattergun: [34, 22],
  wpn_cannon: [33, 38],
  wpn_pistol: [7, 19],
};

const cache = {};
export function gunSprite(layerId) {
  if (cache[layerId] !== undefined) return cache[layerId];
  const spec = SPECS[layerId];
  if (!spec || typeof document === 'undefined') return (cache[layerId] = null);
  const p = new Painter(W, H);
  spec.draw(p);
  p.outline(1);
  const r = p.bounds(), c = p.canvas(r);
  c.grip = [spec.grip[0] - r.x, spec.grip[1] - r.y];
  return (cache[layerId] = c);
}
