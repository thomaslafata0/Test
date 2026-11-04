// Code-drawn pixel portraits. Each enemy is a list of shapes on a 40x40 grid.
// Shapes get light from the top-left (3-step ramps), then a 1px dark outline.
// To use a hand-made or AI-generated PNG instead, set `portrait: 'portraits/<id>.png'` on the enemy in data.js.

export const N = 40;
const OUTLINE = '#07080a';
const RAMPS = {
  armor:  ['#676d73', '#a7acb0', '#e2e1da'],
  black:  ['#141619', '#262b31', '#454d56'],
  visor:  ['#08090b', '#16191d', '#3d4650'],
  grey:   ['#363b41', '#59616a', '#8a939c'],
  skin:   ['#7e5140', '#b9825f', '#deac86'],
  pale:   ['#8f7067', '#c9aa9b', '#ead3c4'],
  olive:  ['#363a2b', '#565c43', '#7c8462'],
  red:    ['#6a1610', '#d23a2a', '#ff9a78'],
  ion:    ['#1b475a', '#4aa5cc', '#c4f1ff'],
  yellow: ['#6e4f10', '#cf9528', '#f4d272'],
  brown:  ['#33241b', '#5d4232', '#8a6a52'],
  tan:    ['#7a5e48', '#a8896d', '#cdb497'],
  hair:   ['#16130f', '#2e2824', '#4e4640'],
  silver: ['#5b5b5b', '#9a9895', '#cfcdc8'],
  gold:   ['#6e5016', '#c39b45', '#f1d98a'],
  navy:   ['#18202c', '#2d3a50', '#4a5d7c'],
  white:  ['#8e959b', '#d2d5d7', '#f5f5f0'],
};

function makeGrid() {
  const g = { px: new Array(N * N).fill(null) };
  const put = (x, y, mat, shade) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    g.px[y * N + x] = RAMPS[mat][shade];
  };
  // shade from a surface normal (nx, ny in -1..1); light comes from the top-left
  const lit = (nx, ny) => { const d = -0.6 * nx - 0.8 * ny; return d > 0.35 ? 2 : d < -0.3 ? 0 : 1; };
  g.ellipse = (cx, cy, rx, ry, mat, flat) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1.02) put(x, y, mat, flat ?? lit(nx, ny));
      }
  };
  g.rect = (x0, y0, w, h, mat, flat) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const nx = w > 1 ? ((x - x0) / (w - 1)) * 2 - 1 : 0, ny = h > 1 ? ((y - y0) / (h - 1)) * 2 - 1 : 0;
        put(x, y, mat, flat ?? lit(nx * 0.7, ny * 0.7));
      }
  };
  g.tri = (ax, ay, bx, by, cx, cy, mat, flat = 1) => {
    const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx), minY = Math.min(ay, by, cy), maxY = Math.max(ay, by, cy);
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / area;
        const w1 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / area;
        if (w0 >= -0.01 && w1 >= -0.01 && w0 + w1 <= 1.01) put(x, y, mat, flat);
      }
  };
  g.line = (x0, y0, x1, y1, mat, flat = 1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) put(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, mat, flat);
  };
  g.dot = (x, y, mat, flat = 1) => put(x, y, mat, flat);
  return g;
}

function outline(g) {
  const out = g.px.slice();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g.px[y * N + x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < N && ny < N && g.px[ny * N + nx];
      });
      if (near) out[y * N + x] = OUTLINE;
    }
  g.px = out;
}

// Small reusable features
const eyes = (g, y, l = 17, r = 23, mat = 'hair') => { g.dot(l, y, mat, 0); g.dot(r, y, mat, 0); };

export const ART = {
  patrol(g) {
    g.ellipse(20, 41, 18, 10, 'grey');
    g.rect(4, 32, 8, 3, 'olive', 1); g.rect(28, 32, 8, 3, 'olive', 0);
    g.rect(15, 33, 10, 7, 'black');
    g.rect(16, 27, 8, 6, 'black', 0);
    g.ellipse(20, 18, 9, 10, 'grey');
    g.rect(8, 13, 24, 3, 'grey');
    g.rect(8, 13, 24, 1, 'grey', 2);
    g.rect(12, 17, 16, 3, 'ion', 0);
    g.rect(13, 18, 4, 1, 'ion', 2);
    g.rect(14, 22, 12, 6, 'olive');
    g.rect(19, 23, 2, 4, 'black', 0);
    g.dot(16, 25, 'black', 0); g.dot(23, 25, 'black', 0);
    g.dot(9, 14, 'red', 1);
  },
  probe(g) {
    g.line(14, 10, 10, 2, 'grey'); g.line(26, 10, 30, 2, 'grey');
    g.dot(10, 2, 'red', 2); g.dot(30, 2, 'red', 2);
    g.rect(13, 28, 4, 5, 'grey'); g.rect(23, 28, 4, 5, 'grey');
    g.dot(15, 34, 'ion', 2); g.dot(25, 34, 'ion', 2); g.dot(15, 35, 'ion', 1); g.dot(25, 35, 'ion', 1);
    g.ellipse(20, 19, 11, 11, 'black');
    g.rect(10, 13, 21, 1, 'black', 0);
    g.ellipse(20, 20, 6, 6, 'grey');
    g.ellipse(20, 20, 4, 4, 'red', 1);
    g.ellipse(20, 20, 2, 2, 'red', 2);
    g.dot(18, 18, 'ion', 2);
  },
  officer(g) {
    g.ellipse(20, 42, 16, 10, 'olive');
    g.rect(15, 30, 10, 4, 'olive', 0);
    g.rect(17, 26, 6, 5, 'skin', 0);
    g.ellipse(20, 19, 8, 10, 'skin');
    g.rect(11, 18, 1, 3, 'skin', 1); g.rect(28, 18, 1, 3, 'skin', 0);
    g.ellipse(20, 10, 10, 4, 'olive');
    g.rect(11, 11, 18, 3, 'olive');
    g.rect(11, 14, 18, 2, 'black', 0);
    g.dot(20, 12, 'gold', 2);
    g.rect(16, 17, 3, 1, 'hair', 1); g.rect(22, 17, 3, 1, 'hair', 1);
    eyes(g, 19);
    g.dot(20, 21, 'skin', 0);
    g.rect(18, 24, 4, 1, 'skin', 0);
    g.rect(23, 35, 4, 2, 'gold', 1); g.rect(13, 35, 3, 1, 'red', 1);
  },
  hound(g) {
    g.ellipse(20, 41, 14, 10, 'brown');
    g.tri(10, 15, 12, 2, 18, 11, 'brown', 0); g.tri(30, 15, 28, 2, 22, 11, 'brown', 0);
    g.tri(12, 12, 13, 6, 16, 11, 'tan', 0); g.tri(28, 12, 27, 6, 24, 11, 'tan', 0);
    g.ellipse(20, 18, 10, 9, 'brown');
    g.ellipse(20, 25, 6, 5, 'tan');
    g.ellipse(20, 21, 2, 1, 'black', 0);
    g.rect(15, 15, 2, 2, 'gold', 2); g.rect(23, 15, 2, 2, 'gold', 2);
    g.dot(16, 16, 'hair', 0); g.dot(24, 16, 'hair', 0);
    g.rect(16, 28, 8, 1, 'black', 0);
    g.dot(17, 29, 'white', 2); g.dot(22, 29, 'white', 2);
    g.rect(11, 31, 18, 3, 'black');
    g.dot(20, 32, 'red', 2);
  },
  riot(g) {
    g.ellipse(20, 40, 18, 11, 'black');
    g.ellipse(20, 15, 10, 11, 'black');
    g.rect(11, 15, 18, 10, 'visor');
    g.line(13, 16, 17, 16, 'ion', 1); g.line(12, 17, 14, 17, 'ion', 0);
    g.rect(10, 13, 20, 2, 'grey');
    g.rect(5, 27, 30, 13, 'grey');
    g.rect(5, 31, 30, 2, 'yellow', 1);
    g.rect(13, 28, 14, 1, 'visor', 0);
    g.rect(5, 27, 30, 1, 'grey', 2);
  },
  loader(g) {
    g.rect(5, 29, 30, 11, 'yellow');
    for (let k = 0; k < 40; k += 6) g.line(k, 40, k + 8, 29, 'black', 0);
    g.rect(5, 29, 30, 1, 'yellow', 2);
    g.rect(15, 23, 3, 6, 'grey'); g.rect(22, 23, 3, 6, 'grey');
    g.line(30, 9, 33, 2, 'grey'); g.dot(33, 2, 'red', 2);
    g.rect(9, 8, 22, 16, 'yellow');
    g.rect(12, 12, 6, 5, 'visor'); g.rect(22, 12, 6, 5, 'visor');
    g.rect(14, 14, 2, 2, 'red', 2); g.rect(24, 14, 2, 2, 'red', 1);
    g.rect(15, 19, 10, 3, 'black', 0);
    for (let x = 16; x < 25; x += 2) g.rect(x, 19, 1, 3, 'grey', 0);
    g.rect(9, 8, 22, 1, 'yellow', 2);
    g.dot(10, 22, 'grey', 1); g.dot(29, 22, 'grey', 1);
  },
  marksman(g) {
    g.ellipse(20, 41, 17, 11, 'olive');
    g.ellipse(20, 19, 12, 14, 'olive');
    g.ellipse(20, 21, 7, 8, 'skin');
    g.rect(13, 23, 14, 6, 'black');
    g.ellipse(20, 12, 9, 5, 'olive');
    g.dot(17, 19, 'hair', 0);
    g.rect(21, 17, 8, 3, 'grey');
    g.rect(29, 17, 2, 3, 'black', 0);
    g.dot(30, 18, 'red', 2);
    g.dot(23, 19, 'red', 1);
  },
  interrogator(g) {
    g.ellipse(20, 42, 16, 11, 'grey');
    g.tri(12, 27, 18, 36, 13, 38, 'grey', 2); g.tri(28, 27, 22, 36, 27, 38, 'grey', 0);
    g.rect(18, 30, 4, 10, 'black', 1);
    g.rect(17, 25, 6, 5, 'pale', 0);
    g.ellipse(20, 18, 8, 10, 'pale');
    g.ellipse(20, 11, 9, 5, 'hair');
    g.rect(12, 10, 2, 7, 'hair'); g.rect(26, 10, 2, 5, 'hair');
    g.line(15, 10, 22, 8, 'hair', 2);
    g.rect(16, 17, 3, 1, 'hair', 1); g.rect(22, 17, 3, 1, 'hair', 1);
    g.dot(17, 19, 'ion', 0); g.dot(23, 19, 'ion', 0);
    g.dot(20, 21, 'pale', 0);
    g.rect(18, 24, 5, 1, 'pale', 0);
    g.rect(24, 34, 3, 2, 'silver', 2);
  },
  shock(g) {
    g.ellipse(20, 41, 18, 11, 'black');
    g.ellipse(6, 32, 6, 4, 'black'); g.ellipse(34, 32, 6, 4, 'black');
    g.rect(16, 27, 8, 5, 'grey', 0);
    g.ellipse(20, 17, 10, 11, 'black');
    g.rect(13, 23, 14, 4, 'black', 0);
    for (let x = 15; x < 26; x += 2) g.dot(x, 24, 'grey', 1);
    g.rect(11, 17, 18, 2, 'red', 1);
    g.rect(14, 17, 4, 1, 'red', 2);
    g.rect(11, 13, 18, 1, 'black', 2);
  },
  sentinel(g) {
    g.rect(11, 27, 18, 13, 'black');
    g.ellipse(8, 31, 8, 6, 'grey'); g.ellipse(32, 31, 8, 6, 'grey');
    g.rect(17, 24, 6, 4, 'black', 0);
    g.rect(14, 3, 12, 22, 'grey');
    g.rect(14, 3, 12, 1, 'grey', 2);
    g.tri(15, 11, 25, 11, 20, 17, 'ion', 1);
    g.tri(17, 12, 23, 12, 20, 15, 'ion', 2);
    g.rect(16, 20, 8, 1, 'black', 0);
    g.dot(20, 33, 'ion', 2); g.dot(20, 34, 'ion', 1);
  },
  halvek(g) {
    g.ellipse(20, 42, 18, 11, 'navy');
    g.rect(4, 31, 9, 2, 'gold', 2); g.rect(27, 31, 9, 2, 'gold', 2);
    g.tri(14, 28, 19, 38, 15, 39, 'navy', 2); g.tri(26, 28, 21, 38, 25, 39, 'navy', 0);
    for (let y = 32; y < 40; y += 3) g.dot(20, y, 'gold', 2);
    g.rect(17, 26, 6, 4, 'skin', 0);
    g.ellipse(20, 19, 9, 10, 'skin');
    g.rect(11, 15, 2, 5, 'silver'); g.rect(27, 15, 2, 5, 'silver');
    g.ellipse(20, 9, 12, 5, 'navy');
    g.rect(9, 10, 22, 3, 'navy');
    g.rect(9, 13, 22, 2, 'black', 0);
    g.rect(19, 10, 3, 2, 'gold', 2);
    g.rect(15, 16, 4, 1, 'silver', 1); g.rect(21, 16, 4, 1, 'silver', 1);
    eyes(g, 18);
    g.dot(20, 21, 'skin', 0);
    g.rect(15, 23, 10, 2, 'silver', 1);
    g.rect(18, 26, 4, 1, 'skin', 0);
  },
  crawler(g) {
    g.tri(4, 28, 0, 40, 9, 40, 'black', 0); g.tri(36, 28, 40, 40, 31, 40, 'black', 0);
    g.tri(13, 30, 10, 40, 17, 40, 'black', 1); g.tri(27, 30, 30, 40, 23, 40, 'black', 1);
    g.rect(0, 17, 9, 3, 'black'); g.rect(31, 17, 9, 3, 'black');
    g.rect(3, 13, 34, 17, 'grey');
    for (let k = 3; k < 37; k += 5) g.line(k, 30, k + 4, 26, 'yellow', 1);
    g.rect(3, 26, 34, 1, 'black', 0);
    g.ellipse(20, 12, 10, 6, 'grey');
    g.rect(14, 15, 12, 7, 'visor');
    [[16, 17], [20, 17], [24, 17], [18, 19], [22, 19]].forEach(([x, y], i) => g.rect(x, y, 2, 1, 'red', i === 1 ? 2 : 1));
    g.rect(3, 13, 34, 1, 'grey', 2);
  },
  ostrane(g) {
    g.ellipse(20, 42, 16, 11, 'white');
    g.rect(15, 27, 10, 5, 'white', 1);
    g.rect(16, 31, 8, 1, 'grey', 0);
    for (let x = 24; x < 30; x += 2) g.rect(x, 34, 1, 2, 'red', 1);
    g.rect(17, 25, 6, 3, 'pale', 0);
    g.ellipse(20, 18, 7, 10, 'pale');
    g.ellipse(20, 6, 4, 3, 'hair');
    g.ellipse(20, 11, 8, 5, 'hair');
    g.rect(12, 11, 2, 7, 'hair'); g.rect(26, 11, 2, 7, 'hair');
    g.rect(16, 16, 3, 1, 'hair', 1); g.rect(22, 16, 3, 1, 'hair', 1);
    eyes(g, 18);
    g.dot(20, 21, 'pale', 0);
    g.rect(18, 24, 4, 1, 'red', 0);
    g.rect(4, 31, 9, 8, 'black');
    g.rect(5, 32, 7, 5, 'ion', 1);
    g.line(6, 33, 9, 33, 'ion', 2);
  },
};

const cache = {};
export function portraitURL(id) {
  if (cache[id]) return cache[id];
  if (!ART[id] || typeof document === 'undefined') return null;
  const g = makeGrid();
  ART[id](g);
  outline(g);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  g.px.forEach((col, i) => { if (col) { ctx.fillStyle = col; ctx.fillRect(i % N, Math.floor(i / N), 1, 1); } });
  return (cache[id] = c.toDataURL('image/png'));
}
