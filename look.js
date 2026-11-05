// Character looks: body, class outfit, hair, colours and held weapon, composited from the layered pack in chars2/
// (manifest.json; see docs/CHARACTER_ART_PROMPT_CHATGPT.md). Every overlay was drawn on body_m1, so overlays are
// shifted per frame to fit the other bodies (head top and centre for hair, centre for outfits and weapons).
// Without the pack, everything returns null and the game falls back to the single player sheet.

export const BODIES = [
  { id: 'body_m1', name: 'Broad', sex: 'm', desc: 'Casting-floor shoulders.' },
  { id: 'body_m2', name: 'Lean', sex: 'm', desc: 'Built for fences and vents.' },
  { id: 'body_f1', name: 'Solid', sex: 'f', desc: 'Carried loader rigs for a living.' },
  { id: 'body_f2', name: 'Wiry', sex: 'f', desc: 'Fast, and knows it.' },
];
export const HAIR = ['hair_short', 'hair_cropped', 'hair_long_tied', 'hair_shaved', 'hair_mohawk', 'hair_bob'];
export const HAIR_NAMES = { hair_short: 'Short', hair_cropped: 'Cropped', hair_long_tied: 'Tied back', hair_shaved: 'Shaved', hair_mohawk: 'Mohawk', hair_bob: 'Bob' };
// Palettes replace the neutral ramps in the art: [dark, mid, light].
export const SKINS = [['#5a3a2a', '#8a5a3c', '#b98562'], ['#6b4a35', '#a0745a', '#d1a07f'], ['#7a5a48', '#b9907a', '#e6c3a8'], ['#8c6a5a', '#caa48f', '#f2d9c4'], ['#4a3028', '#6e4a3a', '#95695a'], ['#6a6a72', '#9a9aa4', '#c6c6cf']];
export const HAIRS = [['#1d1512', '#33231c', '#4d352a'], ['#3a2516', '#6a4423', '#9a6a3a'], ['#5a3a1a', '#9a6a2a', '#d9a650'], ['#7a2a1a', '#b9452a', '#e07a52'], ['#4a4a52', '#8a8a94', '#c4c4cc'], ['#1a2a4a', '#2f4f8a', '#5a86c8']];
export const defaultLook = () => ({ body: 'body_m1', hair: 'hair_short', skin: 1, hairColor: 1 });
export const OUTFITS = { foundry: 'cls_foundry', runner: 'cls_runner', clerk: 'cls_clerk', preacher: 'cls_preacher' };
// Gear base id or type -> weapon layer.
export function weaponLayer(base) {
  if (!base) return null;
  if (base.slot === 'ranged') return { pistol: 'wpn_pistol', carbine: 'wpn_carbine', scatter: 'wpn_scattergun', rifle: 'wpn_rifle', tech: 'wpn_carbine', heavy: 'wpn_cannon' }[base.type] || 'wpn_carbine';
  if (base.slot === 'melee') { const n = (base.id || base.name || '').toLowerCase(); if (/knife|shiv|sabre/.test(n)) return 'wpn_knife'; if (/baton|prod/.test(n)) return 'wpn_baton'; return 'wpn_maul'; }
  return null;
}

const TOWN_ANIMS = ['idle_down', 'idle_up', 'idle_left', 'idle_right', 'walk_down', 'walk_up', 'walk_left', 'walk_right'];
const BATTLE_ANIMS = ['idle', 'attack', 'charge', 'hit', 'defend', 'death'];
let manifest = null, loading = null;
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
    return true;
  }).catch(() => false);
  return loading;
}
export const hasLayers = () => !!manifest;

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
// Per body, scene, anim and frame: where the figure's head top and centre are, so overlays drawn on body_m1 can be shifted.
const boxCache = {};
function frameBoxes(bodyId, scene, anim) {
  const key = `${bodyId}:${scene}:${anim}`;
  if (boxCache[key]) return boxCache[key];
  const L = layers[bodyId] && layers[bodyId][scene][anim];
  if (!L) return (boxCache[key] = null);
  const fw = L.img.width / L.frames, fh = L.img.height, c = document.createElement('canvas'); c.width = L.img.width; c.height = fh;
  const g = c.getContext('2d'); g.drawImage(L.img, 0, 0);
  const d = g.getImageData(0, 0, c.width, fh).data, out = [];
  for (let f = 0; f < L.frames; f++) {
    let top = fh, x0 = fw, x1 = -1, hx0 = fw, hx1 = -1;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[((y * c.width) + f * fw + x) * 4 + 3]) { if (y < top) top = y; x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    for (let y = top; y < Math.min(fh, top + 8); y++) for (let x = 0; x < fw; x++) if (d[((y * c.width) + f * fw + x) * 4 + 3]) { hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); }
    out.push({ top, cx: (x0 + x1) / 2, hcx: (hx0 + hx1) / 2 });
  }
  return (boxCache[key] = out);
}
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
function offsetFor(bodyId, scene, anim, f, kind) {
  if (bodyId === 'body_m1' || kind === 'fitted') return { dx: 0, dy: 0 };
  const a = frameBoxes(bodyId, scene, anim), b = frameBoxes('body_m1', scene, anim);
  if (!a || !b || !a[f] || !b[f]) return { dx: 0, dy: 0 };
  if (kind === 'hair') {
    // From the side, line the hair up on the forehead, not the head's centre: heads differ in depth, and centring slides hair off the back.
    const side = anim.endsWith('_left') ? 'left' : anim.endsWith('_right') ? 'right' : null, ha = side && headGeom(bodyId, scene, anim, f), hb = side && headGeom('body_m1', scene, anim, f);
    if (ha && hb) return { dx: ha[side] - hb[side], dy: a[f].top - b[f].top };
    return { dx: Math.round(a[f].hcx - b[f].hcx), dy: a[f].top - b[f].top };
  }
  return { dx: Math.round(a[f].cx - b[f].cx), dy: 0 };
}

// ---------- repairs ----------
// The pack's overlays were all drawn on body_m1. On other bodies that leaves heads without a face from the side, scalp showing
// where the hair stops, hair across the eyes, and background showing through sleeves cut for a thicker arm. These put it right
// when the figure is composited. tests/visual-check.cjs measures all of it across every combination.
// Three of the four bodies' side views have a blank or muddled head that sits badly under every overlay. At this size a body from
// the side reads much the same either way, so all of them walk in the lean body's side strips, which have a real profile.
const SIDE_BODY = { body_m1: 'body_m2', body_f1: 'body_m2', body_f2: 'body_m2' };
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
  for (let pass = 0; pass < 3 && want.length; pass++) for (let n = want.length - 1; n >= 0; n--) {
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
function compose(scene, anim, lookIn, background, weapon) {
  const sideOn = scene === 'town' && (anim.endsWith('_left') || anim.endsWith('_right'));
  const look = sideOn && SIDE_BODY[lookIn.body] ? { ...lookIn, body: SIDE_BODY[lookIn.body] } : lookIn;
  const body = layers[look.body] && layers[look.body][scene][anim];
  if (!body) return null;
  const fw = body.img.width / body.frames, fh = body.img.height;
  const c = document.createElement('canvas'); c.width = body.img.width; c.height = fh;
  const g = c.getContext('2d', { willReadFrequently: true });
  const side = anim.endsWith('_left') ? 'left' : anim.endsWith('_right') ? 'right' : null, facingUs = anim.endsWith('_down');
  const paint = (id, kind, ramp, f) => {
    const L = layers[id] && layers[id][scene][anim];
    if (!L) return;
    const { dx, dy } = offsetFor(look.body, scene, anim, f, kind);
    const tmp = document.createElement('canvas'); tmp.width = fw; tmp.height = fh;
    const tg = tmp.getContext('2d'); tg.drawImage(L.img, f * fw, 0, fw, fh, 0, 0, fw, fh);
    if (ramp) {
      const d = tg.getImageData(0, 0, fw, fh);
      // Hair art uses exactly the pack's three hair shades: swap them exactly, so the colour can't drift frame to frame.
      if (kind === 'hair' || kind === 'fitted') { if (manifest.hairRamp) swapExact(d.data, manifest.hairRamp, ramp); else swapByLight(d.data, ramp); }
      else swapExact(d.data, manifest.skinRamp, ramp);
      tg.putImageData(d, 0, 0);
    }
    // Hair drawn for a bigger head mustn't fall across a smaller head's face.
    if (kind === 'hair' && facingUs && look.body !== 'body_m1') {
      const h = headGeom(look.body, scene, anim, f);
      if (h) tg.clearRect(h.x0 + 1 - dx, h.top + Math.round(h.h * 0.36) - dy, h.x1 - h.x0 - 1, h.bot - h.top - Math.round(h.h * 0.36) + 1);
    }
    g.drawImage(tmp, f * fw + dx, dy);
  };
  const skin = SKINS[look.skin] || SKINS[1], hair = HAIRS[look.hairColor] || HAIRS[1], outfit = OUTFITS[background];
  for (let f = 0; f < body.frames; f++) {
    paint(look.body, 'body', skin, f);
    const head = scene === 'town' && side ? headGeom(look.body, scene, anim, f) : null;
    if (outfit) paint(outfit, 'outfit', skin, f);       // outfits show hands: same skin swap
    if (scene === 'town' && look.hair) paint(look.hair, 'hair', hair, f);
    if (head && look.body !== 'body_m1' && look.hair && !NO_CAP.has(look.hair)) capScalp(g, f * fw, fw, fh, head, side, skin, hair);
    // Battle hair is pre-fitted to each body's head, frame by frame (falls included), so it is painted without an offset.
    if (scene === 'battle' && look.hair && layers[`${look.hair}@${look.body}`]) paint(`${look.hair}@${look.body}`, 'fitted', hair, f);
    if (scene === 'battle' && weapon) paint(weapon, 'weapon', skin, f);
    if (anim !== 'death') closeGaps(g, f * fw, fw, fh);
    if (scene === 'town') dropStrays(g, f * fw, fw, fh);
  }
  return { img: c, frames: body.frames, fps: body.fps, tip: weapon && layers[weapon] && layers[weapon].battle[anim] ? layers[weapon].battle[anim].tip : null };
}
// Town strips for a look: { idle_down: {img, frames, fps}, ... } or null.
export function townSheets(look, background) {
  if (!manifest || !look) return null;
  const key = `town:${JSON.stringify([look, background])}`;
  if (sheetCache[key]) return sheetCache[key];
  const out = {};
  for (const a of TOWN_ANIMS) { const s = compose('town', a, look, background, null); if (s) out[a] = s; }
  return (sheetCache[key] = out.idle_down ? out : null);
}
// A battle sheet in stage.js's shape: { size, anims: { idle, attack, attackM, charge, hit, defend, death } }. Ranged weapon in
// idle, charge and attack; the melee weapon in attackM; no weapon on hit, defend and death (the pack has none there).
export function battleSheet(look, background, ranged, melee) {
  if (!manifest || !look) return null;
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
  const sh = townSheets(look, background);
  if (!sh) return null;
  const key = `still:${JSON.stringify([look, background])}`;
  return stillCache[key] || (stillCache[key] = cropStill(sh.idle_down.img, 0, 64, 64));
}
// The battle pose still (facing right, with the ranged weapon), for victory and death screens.
export function lookBattleStill(look, background, ranged) {
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
