import { gunSprite, GUN_GRIP } from './guns.js';
import { DYES } from './data.js';
// Character looks: body, class outfit, hair, colours and held weapon, composited from the layered pack in chars2/
// (manifest.json; see docs/CHARACTER_ART_PROMPT_CHATGPT.md). Every overlay was drawn on body_m1: see compose().
// Without the pack, everything returns null and the game falls back to the single player sheet.

// New operatives are male or female. The other two bodies remain for older saves.
export const BODIES = [
  { id: 'body_m1', name: 'Male', sex: 'm' },
  { id: 'body_f1', name: 'Female', sex: 'f' },
];
const OLD_BODIES = { body_m2: 'm', body_f2: 'f' };
export const sexOf = (look) => { const b = look && BODIES.find((x) => x.id === look.body); return b ? b.sex : (look && OLD_BODIES[look.body]) || 'm'; };
// Each operative's hair is drawn into their art, so the style follows from the choice; town uses the closest match.
export const HAIR_FOR = { m: 'hair_short', f: 'hair_long_tied' };
export const HAIR = ['hair_short', 'hair_cropped', 'hair_long_tied', 'hair_shaved', 'hair_mohawk', 'hair_bob'];
export const HAIR_NAMES = { hair_short: 'Short', hair_cropped: 'Cropped', hair_long_tied: 'Tied back', hair_shaved: 'Shaved', hair_mohawk: 'Mohawk', hair_bob: 'Bob' };
// Palettes replace the neutral ramps in the art: [dark, mid, light].
export const SKINS = [['#5a3a2a', '#8a5a3c', '#b98562'], ['#6b4a35', '#a0745a', '#d1a07f'], ['#7a5a48', '#b9907a', '#e6c3a8'], ['#8c6a5a', '#caa48f', '#f2d9c4'], ['#4a3028', '#6e4a3a', '#95695a'], ['#6a6a72', '#9a9aa4', '#c6c6cf']];
export const HAIRS = [['#1d1512', '#33231c', '#4d352a'], ['#3a2516', '#6a4423', '#9a6a3a'], ['#5a3a1a', '#9a6a2a', '#d9a650'], ['#7a2a1a', '#b9452a', '#e07a52'], ['#4a4a52', '#8a8a94', '#c4c4cc'], ['#1a2a4a', '#2f4f8a', '#5a86c8']];
export const defaultLook = () => ({ body: 'body_m1', hair: 'hair_short', skin: 1, hairColor: 1 });
export const OUTFITS = { foundry: 'cls_foundry', runner: 'cls_runner', clerk: 'cls_clerk', preacher: 'cls_preacher', medic: 'cls_clerk' }; // the Field Medic borrows the clerk's coat until it has its own
// Gear base id or type -> weapon layer.
export function weaponLayer(base) {
  if (!base) return null;
  if (base.slot === 'ranged') return { pistol: 'wpn_pistol', carbine: 'wpn_carbine', scatter: 'wpn_scattergun', rifle: 'wpn_rifle', tech: 'wpn_carbine', heavy: 'wpn_cannon' }[base.type] || 'wpn_carbine';
  if (base.slot === 'melee') { const n = (base.id || base.name || '').toLowerCase(); if (/knife|shiv|sabre/.test(n)) return 'wpn_knife'; if (/baton|prod/.test(n)) return 'wpn_baton'; return 'wpn_maul'; }
  return null;
}

const TOWN_ANIMS = ['idle_down', 'idle_up', 'idle_left', 'idle_right', 'walk_down', 'walk_up', 'walk_left', 'walk_right'];
const BATTLE_ANIMS = ['idle', 'attack', 'charge', 'hit', 'defend', 'death'];
let manifest = null, loading = null, ready = false;
const layers = {}, portraits = {};   // layers[id][scene][anim] = { img, frames, fps, tip }

export function loadLayers() {
  if (loading) return loading;
  loading = fetch('chars2/manifest.json').then((r) => (r.ok ? r.json() : null)).then(async (m) => {
    if (!m || m.pending || !m.layers) return false;
    manifest = m;
    const jobs = [];
    // Atlas entries (battle hair) name a strip by y, w and h inside a shared image; cut it out once.
    const cut = (img, a) => { const c = document.createElement('canvas'); c.width = a.w; c.height = a.h; c.getContext('2d').drawImage(img, 0, a.y, a.w, a.h, 0, 0, a.w, a.h); return c; };
    const loaded = {};
    const load = (src) => loaded[src] || (loaded[src] = loadOne(src));
    const loadOne = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `chars2/${src}`; });
    for (const [id, def] of Object.entries(m.layers)) {
      layers[id] = { kind: def.kind, town: {}, battle: {} };
      for (const scene of ['town', 'battle']) for (const [anim, a] of Object.entries(def[scene] || {})) jobs.push(load(a.file).then((img) => { if (img) layers[id][scene][anim] = { img: a.y != null ? cut(img, a) : img, frames: a.frames, fps: a.fps, tip: a.tip || null }; }));
    }
    for (const [id, p] of Object.entries(m.portraits || {})) jobs.push(load(p.file).then((img) => { if (img) portraits[id] = img; }));
    await Promise.all(jobs);
    ready = true; // nothing composites until every layer is in: a half-loaded pack would crash or cache a broken figure
    return true;
  }).catch(() => false);
  return loading;
}
export const hasLayers = () => ready;

// ---------- recolouring ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// Exact ramp swap (skin: the art uses exactly the three greys).
function swapExact(px, from, to) {
  const F = from.map(hex), T = to.map(hex);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    for (let k = 0; k < 3; k++) if (px[i] === F[k][0] && px[i + 1] === F[k][1] && px[i + 2] === F[k][2]) { px[i] = T[k][0]; px[i + 1] = T[k][1]; px[i + 2] = T[k][2]; break; }
  }
}
// Luminance ramp (hair: the art has its own shades, so every pixel is mapped by brightness onto the target ramp).
function swapByLight(px, to) {
  const T = to.map(hex);
  let lo = 255, hi = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) { const l = (px[i] * 3 + px[i + 1] * 6 + px[i + 2]) / 10; lo = Math.min(lo, l); hi = Math.max(hi, l); }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const t = ((px[i] * 3 + px[i + 1] * 6 + px[i + 2]) / 10 - lo) / span;
    const a = t < 0.5 ? 0 : 1, f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    for (let k = 0; k < 3; k++) px[i + k] = Math.round(T[a][k] + (T[a + 1][k] - T[a][k]) * f);
  }
}

// ---------- fitting overlays to bodies ----------
// The bald head in one frame of a body layer: its extent, and the front of the face at eye height.
const headCache = {};
function headGeom(bodyId, scene, anim, f) {
  const key = `${bodyId}:${scene}:${anim}:${f}`;
  if (key in headCache) return headCache[key];
  const L = layers[bodyId] && layers[bodyId][scene][anim];
  if (!L) return (headCache[key] = null);
  const fw = L.img.width / L.frames, fh = L.img.height, c = document.createElement('canvas'); c.width = fw; c.height = fh;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(L.img, f * fw, 0, fw, fh, 0, 0, fw, fh);
  const d = g.getImageData(0, 0, fw, fh).data, rows = [];
  let top = -1, maxW = 0;
  for (let y = 0; y < fh; y++) {
    let a = fw, z = -1;
    for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3]) { a = Math.min(a, x); z = Math.max(z, x); }
    if (z < 0) { if (top >= 0) break; continue; }
    if (top < 0) top = y;
    const w = z - a + 1;
    if (y > top + 6 && w > maxW * 1.4) break; // the shoulders
    if (y >= top + 16) break;
    maxW = Math.max(maxW, w);
    rows.push({ y, a, z });
  }
  if (!rows.length) return (headCache[key] = null);
  const bot = rows[rows.length - 1].y, h = bot - top + 1, mid = rows[Math.min(rows.length - 1, Math.round(h * 0.45))];
  return (headCache[key] = { top, bot, h, x0: Math.min(...rows.map((r) => r.a)), x1: Math.max(...rows.map((r) => r.z)), left: mid.a, right: mid.z, rows });
}
// ---------- repairs ----------
// What compose() can't get from the pack directly. tests/visual-check.cjs measures the result across every combination.
const NO_CAP = new Set(['hair_shaved', 'hair_mohawk']);
// Scalp the hair art doesn't reach: top of the head, and the back of it from the side.
function capScalp(g, ox, fw, fh, head, side, skin, hair) {
  const im = g.getImageData(ox, 0, fw, fh), d = im.data, S = skin.map(hex), H = hair.map(hex), lineTop = head.top + Math.round(head.h * 0.3), lineBack = head.top + Math.round(head.h * 0.62);
  const width = head.x1 - head.x0 + 1, backEdge = side === 'right' ? head.x0 + Math.round(width * 0.42) : head.x1 - Math.round(width * 0.42);
  const isSkin = (i) => d[i + 3] && S.some((c) => c[0] === d[i] && c[1] === d[i + 1] && c[2] === d[i + 2]);
  const set = [];
  for (const r of head.rows) for (let x = r.a; x <= r.z; x++) {
    const y = r.y, i = (y * fw + x) * 4;
    if (!isSkin(i)) continue;
    const back = side === 'right' ? x < backEdge : x > backEdge;
    if (y < lineTop || (back && y < lineBack)) set.push([i, x, y]);
  }
  for (const [i, x, y] of set) {
    const edge = !d[i - 4 + 3] || !d[i + 4 + 3] || !d[i - fw * 4 + 3];
    const c = edge ? H[0] : H[(x + y) % 3 === 0 ? 2 : 1];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  g.putImageData(im, ox, 0);
}
// Fill background that shows through the figure: pixels the outside can't reach, and thin slits between outfit lines in the
// torso. Legs keep their gap. Each takes the commonest non-outline colour around it.
function closeGaps(g, ox, fw, fh) {
  const im = g.getImageData(ox, 0, fw, fh), d = im.data, seen = new Uint8Array(fw * fh), q = [];
  const op = (x, y) => x >= 0 && y >= 0 && x < fw && y < fh && d[(y * fw + x) * 4 + 3];
  for (let x = 0; x < fw; x++) q.push(x, (fh - 1) * fw + x);
  for (let y = 0; y < fh; y++) q.push(y * fw, y * fw + fw - 1);
  while (q.length) { const i = q.pop(); if (seen[i] || d[i * 4 + 3]) continue; seen[i] = 1; const x = i % fw, y = (i - x) / fw; if (x > 0) q.push(i - 1); if (x < fw - 1) q.push(i + 1); if (y > 0) q.push(i - fw); if (y < fh - 1) q.push(i + fw); }
  let top = fh, bot = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (op(x, y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
  if (top > bot) return;
  const figure = bot - top, torsoTop = top + 10, torsoBot = top + Math.round(figure * 0.55), want = [];
  for (let y = top; y <= bot; y++) for (let x = 0; x < fw; x++) {
    if (op(x, y)) continue;
    if (!seen[y * fw + x]) { want.push([x, y]); continue; }
    if (y < torsoTop || y >= torsoBot) continue;
    let l = 0, r = 0;
    for (let k = 1; k <= 3; k++) { if (!l && op(x - k, y)) l = k; if (!r && op(x + k, y)) r = k; }
    if (l && r) want.push([x, y]);
  }
  for (let pass = 0; pass < 8 && want.length; pass++) for (let n = want.length - 1; n >= 0; n--) {
    const [x, y] = want[n], counts = {};
    let best = null, bestN = 0, any = null;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) {
      if (!op(x + dx, y + dy)) continue;
      const i = ((y + dy) * fw + x + dx) * 4, k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      any = k;
      if (d[i] + d[i + 1] + d[i + 2] < 110) continue;
      counts[k] = (counts[k] || 0) + 1;
      if (counts[k] > bestN) { bestN = counts[k]; best = k; }
    }
    const k = best ?? any;
    if (k == null) continue;
    const i = (y * fw + x) * 4;
    d[i] = (k >> 16) & 255; d[i + 1] = (k >> 8) & 255; d[i + 2] = k & 255; d[i + 3] = 255;
    want.splice(n, 1);
  }
  g.putImageData(im, ox, 0);
}

// Bits of an overlay left floating off the figure, like a hood's rim above a smaller head: keep only the biggest connected piece.
function dropStrays(g, ox, fw, fh) {
  const im = g.getImageData(ox, 0, fw, fh), d = im.data, comp = new Int32Array(fw * fh), sizes = [0];
  for (let i = 0; i < fw * fh; i++) {
    if (comp[i] || !d[i * 4 + 3]) continue;
    const id = sizes.length, q = [i]; comp[i] = id; let n = 0;
    while (q.length) {
      const k = q.pop(); n++;
      const x = k % fw, y = (k - x) / fw;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue; const j = ny * fw + nx; if (!comp[j] && d[j * 4 + 3]) { comp[j] = id; q.push(j); } }
    }
    sizes.push(n);
  }
  if (sizes.length <= 2) return;
  const main = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < fw * fh; i++) if (comp[i] && comp[i] !== main) d[i * 4 + 3] = 0;
  g.putImageData(im, ox, 0);
}

// ---------- composition ----------
const sheetCache = {};
function compose(scene, anim, look, background, weapon) {
  // The outfit files aren't whole clothes: each holds only what differs from body_m1, and leans on that body's pixels for the rest
  // (shoulders, sleeves, outlines). On any other body those parts go missing. So every figure is body_m1 under the outfit, with
  // the chosen body's head on top. From the side, every head is body_m2's, the only clean profile in the pack. Real per-body
  // outfits would need new art.
  const base = 'body_m1', side = anim.endsWith('_left') ? 'left' : anim.endsWith('_right') ? 'right' : null, facingUs = anim.endsWith('_down');
  // If the chosen body's art failed to download, draw the base body's head rather than nothing.
  const wantHead = scene !== 'town' ? base : side ? 'body_m2' : look.body, headBody = layers[wantHead] && layers[wantHead][scene][anim] ? wantHead : base;
  const body = layers[base] && layers[base][scene][anim];
  if (!body) return null;
  const headL = layers[headBody][scene][anim];
  const fw = body.img.width / body.frames, fh = body.img.height;
  const c = document.createElement('canvas'); c.width = body.img.width; c.height = fh;
  const g = c.getContext('2d', { willReadFrequently: true });
  const skin = SKINS[look.skin] || SKINS[1], hair = HAIRS[look.hairColor] || HAIRS[1], outfit = OUTFITS[background];
  const layerFrame = (id, kind, ramp, f) => {
    const L = layers[id] && layers[id][scene][anim];
    if (!L) return null;
    const lw = L.img.width / L.frames, tmp = document.createElement('canvas'); tmp.width = fw; tmp.height = fh;
    const tg = tmp.getContext('2d', { willReadFrequently: true }); tg.drawImage(L.img, (f % L.frames) * lw, 0, lw, fh, 0, 0, fw, fh);
    if (ramp) {
      const d = tg.getImageData(0, 0, fw, fh);
      // Hair art uses exactly the pack's three hair shades: swap them exactly, so the colour can't drift frame to frame.
      if (kind === 'hair' || kind === 'fitted') { if (manifest.hairRamp) swapExact(d.data, manifest.hairRamp, ramp); else swapByLight(d.data, ramp); }
      else swapExact(d.data, manifest.skinRamp, ramp);
      tg.putImageData(d, 0, 0);
    }
    return { tmp, tg };
  };
  const paint = (id, kind, ramp, f, dx = 0, dy = 0, before = null) => {
    const L = layerFrame(id, kind, ramp, f);
    if (!L) return;
    if (before) before(L.tg);
    g.drawImage(L.tmp, f * fw + dx, dy);
  };
  const mid = (r) => (r.a + r.z) / 2;
  for (let f = 0; f < body.frames; f++) {
    paint(base, 'body', skin, f);
    const hm = scene === 'town' ? headGeom(base, scene, anim, f) : null, own = hm && headBody !== base ? headGeom(headBody, scene, anim, f % headL.frames) : null;
    let head = null; // where the head ended up
    if (own) {
      // Swap the head, neck to neck.
      const nm = hm.rows[hm.rows.length - 1], no = own.rows[own.rows.length - 1], px = Math.round(mid(nm) - mid(no)), py = hm.bot - own.bot;
      for (const r of hm.rows) g.clearRect(f * fw + r.a, r.y, r.z - r.a + 1, 1);
      const L = layerFrame(headBody, 'body', skin, f);
      if (L) for (const r of own.rows) g.drawImage(L.tmp, r.a, r.y, r.z - r.a + 1, 1, f * fw + r.a + px, r.y + py, r.z - r.a + 1, 1);
      head = { ...own, top: own.top + py, bot: own.bot + py, x0: own.x0 + px, x1: own.x1 + px, left: own.left + px, right: own.right + px, rows: own.rows.map((r) => ({ y: r.y + py, a: r.a + px, z: r.z + px })) };
    }
    // Outfits show hands: same skin swap. Above the collar an outfit is drawn around body_m1's head, so a swapped head loses that part.
    if (outfit) paint(outfit, 'outfit', skin, f, 0, 0, own ? (tg) => tg.clearRect(0, 0, fw, Math.max(0, hm.bot - 2)) : null);
    if (scene === 'town' && look.hair) {
      // Hair was drawn for body_m1's head: move it to this one, by the forehead from the side, by the centre otherwise.
      const dx = !head ? 0 : side ? head[side] - hm[side] : Math.round((head.x0 + head.x1) / 2 - (hm.x0 + hm.x1) / 2), dy = !head ? 0 : head.top - hm.top;
      const clip = head && facingUs ? (tg) => tg.clearRect(head.x0 + 1 - dx, head.top + Math.round(head.h * 0.36) - dy, head.x1 - head.x0 - 1, head.bot - head.top - Math.round(head.h * 0.36) + 1) : null; // not across a smaller face
      paint(look.hair, 'hair', hair, f, dx, dy, clip);
      if (head && side && !NO_CAP.has(look.hair)) capScalp(g, f * fw, fw, fh, head, side, skin, hair);
    }
    // Battle hair is pre-fitted to the body's head, frame by frame (falls included).
    if (scene === 'battle' && look.hair && layers[`${look.hair}@${base}`]) paint(`${look.hair}@${base}`, 'fitted', hair, f);
    if (scene === 'battle' && weapon) paint(weapon, 'weapon', skin, f);
    if (anim !== 'death') closeGaps(g, f * fw, fw, fh);
    if (scene === 'town') dropStrays(g, f * fw, fw, fh);
  }
  return { img: c, frames: body.frames, fps: body.fps, tip: weapon && layers[weapon] && layers[weapon].battle[anim] ? layers[weapon].battle[anim].tip : null };
}
// Town strips for a look: { idle_down: {img, frames, fps}, ... } or null.
export function townSheets(look, background) {
  if (!ready || !look) return null;
  const key = `town:${JSON.stringify([look, background])}`;
  if (sheetCache[key]) return sheetCache[key];
  const out = {};
  for (const a of TOWN_ANIMS) { const s = compose('town', a, look, background, null); if (s) out[a] = s; }
  return (sheetCache[key] = out.idle_down ? out : null);
}
// A battle sheet in stage.js's shape: { size, anims: { idle, attack, attackM, charge, hit, defend, death } }. Ranged weapon in
// idle, charge and attack; the melee weapon in attackM; no weapon on hit, defend and death (the pack has none there).
export function battleSheet(look, background, ranged, melee) {
  if (!look) return null;
  // High-res operatives need only their own sheet, so they don't wait for the layer pack.
  const hd = hdSheet(look, ranged);
  if (hd) return hd;
  if (!ready) return null;
  const key = `battle:${JSON.stringify([look, background, ranged, melee])}`;
  if (sheetCache[key]) return sheetCache[key];
  const anims = {};
  for (const a of BATTLE_ANIMS) {
    const s = compose('battle', a, look, background, ['idle', 'charge', 'attack'].includes(a) ? ranged : null);
    if (s) anims[a] = { img: s.img, frames: s.frames, fps: s.fps, loop: a === 'idle' || a === 'charge', tip: s.tip };
  }
  const m = compose('battle', 'attack', look, background, melee);
  if (m) anims.attackM = { img: m.img, frames: m.frames, fps: m.fps, loop: false, tip: m.tip };
  return (sheetCache[key] = anims.idle ? { size: 96, anims, look: true } : null);
}

// ---------- high-resolution operatives ----------
// One finished figure per sex, from sprites/op_f and op_m. Hair and skin are recoloured from the art; guns other than the
// pistol they were drawn holding are painted over it from the older weapon art.
const ops = { m: null, f: null };
export function setOpSheets(m, f) { ops.m = m; ops.f = f; for (const k of Object.keys(sheetCache)) if (k.startsWith('hd:')) delete sheetCache[k]; for (const k of Object.keys(stillCache)) if (k.startsWith('hd')) delete stillCache[k]; }
const NATURAL_HAIR = 3; // the colour they were drawn with
const NATURAL_SKIN = 1;
// Finds the drawn-in pistol in one frame: the thin run of steel-coloured pixels furthest forward in the upper body.
// Returns its pixels, its angle, and the end nearest the hand, or null if no pistol shows in this frame.
function findPistol(p, W, ox, fw, fh) {
  let top = -1, bottom = -1;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (p[(y * W + ox + x) * 4 + 3] > 40) { if (top < 0) top = y; bottom = y; break; }
  if (top < 0) return null;
  const at = (x, y) => (y * W + ox + x) * 4;
  const steel = (x, y) => { const o = at(x, y); if (p[o + 3] < 60) return false; const [h, s, v] = hsv(p[o], p[o + 1], p[o + 2]); return h > 165 && h < 240 && s < 0.62 && v < 0.85 && v > 0.12; };
  const yTo = Math.min(fh - 1, top + (bottom - top) * 0.62), tried = new Uint8Array(fw * fh);
  for (let sx = fw - 1; sx > fw * 0.45; sx--) for (let sy = top; sy <= yTo; sy++) {
    if (tried[sy * fw + sx] || !steel(sx, sy)) continue;
    const list = [], stack = [[sx, sy]]; tried[sy * fw + sx] = 1;
    while (stack.length) {
      const [x, y] = stack.pop(); list.push([x, y]);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= fw || ny >= fh || tried[ny * fw + nx] || Math.hypot(nx - sx, ny - sy) > 58 || !steel(nx, ny)) continue;
        tried[ny * fw + nx] = 1; stack.push([nx, ny]);
      }
    }
    if (list.length < 30) continue;
    if (list.length > 700) return null; // a leg or the jacket, not a gun: no pistol showing
    let cx = 0, cy = 0; for (const q of list) { cx += q[0]; cy += q[1]; } cx /= list.length; cy /= list.length;
    let xx = 0, yy = 0, xy = 0; for (const q of list) { const a = q[0] - cx, b = q[1] - cy; xx += a * a; yy += b * b; xy += a * b; }
    const ang = 0.5 * Math.atan2(2 * xy, xx - yy), ux = Math.cos(ang), uy = Math.sin(ang);
    let lo = 1e9, hi = -1e9, wide = 0; for (const q of list) { const a = q[0] - cx, b = q[1] - cy, d = a * ux + b * uy; lo = Math.min(lo, d); hi = Math.max(hi, d); wide = Math.max(wide, Math.abs(-a * uy + b * ux)); }
    if (hi - lo < 16 || hi - lo > 66 || wide > 16) return null;
    return { list, ang, hx: cx + ux * lo, hy: cy + uy * lo, tx: cx + ux * hi, ty: cy + uy * hi };
  }
  return null;
}
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; let h = 0; if (c) h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; return [(h * 60 + 360) % 360, mx ? c / mx : 0, mx / 255]; };
const hsvRgb = (h, s, v) => { const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; };
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
function hdSheet(look, ranged) {
  const op = ops[sexOf(look)];
  if (!op || !op.anims.idle) return null;
  const gun = ranged && ranged !== 'wpn_pistol' ? ranged : null, key = `hd:${sexOf(look)}:${look.hairColor}:${look.skin}:${gun}:${look.dye || ''}`;
  if (sheetCache[key]) return sheetCache[key];
  const hair = look.hairColor !== NATURAL_HAIR && HAIRS[look.hairColor] ? rgb(HAIRS[look.hairColor][1]) : null;
  const skin = look.skin !== NATURAL_SKIN && SKINS[look.skin] ? rgb(SKINS[look.skin][2]) : null;
  const art = gun ? gunSprite(gun) : null, grip = gun ? GUN_GRIP[gun] : null, anims = {}, dye = look.dye && DYES.find((x) => x.id === look.dye);
  for (const [name, a] of Object.entries(op.anims)) {
    if (!hair && !skin && !art && !dye) { anims[name] = a; continue; }
    const fw = a.img.width / a.frames, fh = a.img.height, c = document.createElement('canvas'); c.width = a.img.width; c.height = fh;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; g.drawImage(a.img, 0, 0);
    const id = g.getImageData(0, 0, c.width, fh), p = id.data;
    for (let f = 0; f < a.frames; f++) {
      const ox = Math.round(f * fw);
      let top = fh;
      for (let y = 0; y < fh && top === fh; y++) for (let x = 0; x < fw; x++) if (p[(y * c.width + ox + x) * 4 + 3] > 40) { top = y; break; }
      for (let y = top; y < fh; y++) for (let x = 0; x < fw; x++) {
        const o = (y * c.width + ox + x) * 4; if (p[o + 3] < 40) continue;
        const [h, s, v] = hsv(p[o], p[o + 1], p[o + 2]);
        if (hair && y < top + 46 && (h < 30 || h > 350) && s > 0.56) { const k = Math.min(1.3, v * 1.5); for (let n = 0; n < 3; n++) p[o + n] = Math.min(255, hair[n] * k); }
        else if (skin && h > 8 && h < 36 && s > 0.2 && s < 0.56 && v > 0.55) { const k = Math.min(1.15, v * 1.12); for (let n = 0; n < 3; n++) p[o + n] = Math.min(255, skin[n] * k); }
        // A dye: the outfit's coloured cloth takes the dye's hue (hair, skin and grey metal are left alone).
        else if (dye && s > 0.2 && v > 0.1 && !(y < top + 46 && (h < 30 || h > 350) && s > 0.56) && !(h > 8 && h < 36 && s < 0.56 && v > 0.55)) { const [r, g2, b] = hsvRgb(dye.hue, Math.min(1, s * dye.sat), v); p[o] = r; p[o + 1] = g2; p[o + 2] = b; }
      }
    }
    const swaps = [];
    if (art) for (let f = 0; f < a.frames; f++) {
      const ox = Math.round(f * fw), hit = findPistol(p, c.width, ox, fw, fh);
      if (!hit) continue;
      // Clear the pistol, its dark outline, and any muzzle flash, leaving the hand.
      for (const [qx, qy] of hit.list) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue;
        const o = (ny * c.width + ox + nx) * 4; if (p[o + 3] < 40) continue;
        const [hh, ss, vv] = hsv(p[o], p[o + 1], p[o + 2]);
        if (vv < 0.24 || (hh > 165 && hh < 240 && ss < 0.62)) p[o + 3] = 0;
      }
      for (let y = Math.max(0, Math.round(hit.ty) - 26); y < Math.min(fh, hit.ty + 26); y++) for (let x = Math.max(0, Math.round(hit.tx) - 6); x < Math.min(fw, hit.tx + 40); x++) {
        const o = (y * c.width + ox + x) * 4; if (p[o + 3] > 0 && Math.max(p[o], p[o + 1], p[o + 2]) > 190) p[o + 3] = 0;
      }
      swaps.push({ ox, hit });
    }
    g.putImageData(id, 0, 0);
    for (const { ox, hit } of swaps) {
      g.save(); g.beginPath(); g.rect(ox, 0, fw, fh); g.clip();
      g.translate(ox + hit.hx, hit.hy); g.rotate(hit.ang);
      g.drawImage(art, -grip[0] + 4, -grip[1]);
      g.restore();
    }
    anims[name] = { ...a, img: c };
    // Shots leave from the end of the longer barrel.
    if (art && a.tip) anims[name].tip = [a.tip[0] + (art.width - grip[0]) - 36, a.tip[1]];
  }
  return (sheetCache[key] = { size: op.size, hd: true, fig: op.fig, anims, look: true });
}

// ---------- stills and portraits ----------
const stillCache = {};
function cropStill(img, sx, fw, fh) {
  const c = document.createElement('canvas'); c.width = fw; c.height = fh;
  const g = c.getContext('2d'); g.drawImage(img, sx, 0, fw, fh, 0, 0, fw, fh);
  const px = g.getImageData(0, 0, fw, fh).data;
  let x0 = fw, y0 = fh, x1 = 0, y1 = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (px[(y * fw + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) return null;
  const side = Math.max(x1 - x0, y1 - y0) + 6, out = document.createElement('canvas'); out.width = out.height = side;
  out.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.round((side - (x1 - x0)) / 2), Math.round((side - (y1 - y0)) / 2), x1 - x0 + 1, y1 - y0 + 1);
  return out.toDataURL('image/png');
}
// A full-figure still (town, facing down) of a look, as a data URL.
export function lookStill(look, background) {
  const hdS = look ? hdSheet(look, null) : null;
  if (hdS) { const k = `hdstill:${JSON.stringify(look)}`; const a = hdS.anims.idle; return stillCache[k] || (stillCache[k] = cropStill(a.img, 0, a.img.width / a.frames, a.img.height)); }
  const sh = townSheets(look, background);
  if (!sh) return null;
  const key = `still:${JSON.stringify([look, background])}`;
  return stillCache[key] || (stillCache[key] = cropStill(sh.idle_down.img, 0, 64, 64));
}
// The battle pose still (facing right, with the ranged weapon), for victory and death screens.
export function lookBattleStill(look, background, ranged) {
  const hdS = look ? hdSheet(look, ranged) : null;
  if (hdS) { const k = `hdbstill:${JSON.stringify([look, ranged])}`; const a = hdS.anims.idle; return stillCache[k] || (stillCache[k] = cropStill(a.img, 0, a.img.width / a.frames, a.img.height)); }
  const sh = battleSheet(look, background, ranged, null);
  if (!sh) return null;
  const key = `bstill:${JSON.stringify([look, background, ranged])}`;
  return stillCache[key] || (stillCache[key] = cropStill(sh.anims.idle.img, 0, 96, 96));
}
// The body portrait with the look's skin tone, as a data URL.
export function lookPortrait(look) {
  const im = look && portraits[look.body];
  if (!im || !manifest) return null;
  const key = `portrait:${look.body}:${look.skin}`;
  if (stillCache[key]) return stillCache[key];
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height); swapExact(d.data, manifest.skinRamp, SKINS[look.skin] || SKINS[1]); g.putImageData(d, 0, 0);
  return (stillCache[key] = c.toDataURL('image/png'));
}
