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
    const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `chars2/${src}`; });
    for (const [id, def] of Object.entries(m.layers)) {
      layers[id] = { kind: def.kind, town: {}, battle: {} };
      for (const scene of ['town', 'battle']) for (const [anim, a] of Object.entries(def[scene] || {})) jobs.push(load(a.file).then((img) => { if (img) layers[id][scene][anim] = { img, frames: a.frames, fps: a.fps, tip: a.tip || null }; }));
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
function offsetFor(bodyId, scene, anim, f, kind) {
  if (bodyId === 'body_m1') return { dx: 0, dy: 0 };
  const a = frameBoxes(bodyId, scene, anim), b = frameBoxes('body_m1', scene, anim);
  if (!a || !b || !a[f] || !b[f]) return { dx: 0, dy: 0 };
  if (kind === 'hair') return { dx: Math.round(a[f].hcx - b[f].hcx), dy: a[f].top - b[f].top };
  return { dx: Math.round(a[f].cx - b[f].cx), dy: 0 };
}

// ---------- composition ----------
const sheetCache = {};
function compose(scene, anim, look, background, weapon) {
  const body = layers[look.body] && layers[look.body][scene][anim];
  if (!body) return null;
  const fw = body.img.width / body.frames, fh = body.img.height;
  const c = document.createElement('canvas'); c.width = body.img.width; c.height = fh;
  const g = c.getContext('2d');
  const paint = (id, kind, ramp, f) => {
    const L = layers[id] && layers[id][scene][anim];
    if (!L) return;
    const { dx, dy } = offsetFor(look.body, scene, anim, f, kind);
    const tmp = document.createElement('canvas'); tmp.width = fw; tmp.height = fh;
    const tg = tmp.getContext('2d'); tg.drawImage(L.img, f * fw, 0, fw, fh, 0, 0, fw, fh);
    if (ramp) { const d = tg.getImageData(0, 0, fw, fh); if (kind === 'hair') swapByLight(d.data, ramp); else swapExact(d.data, manifest.skinRamp, ramp); tg.putImageData(d, 0, 0); }
    g.drawImage(tmp, f * fw + dx, dy);
  };
  const skin = SKINS[look.skin] || SKINS[1], hair = HAIRS[look.hairColor] || HAIRS[1], outfit = OUTFITS[background];
  for (let f = 0; f < body.frames; f++) {
    paint(look.body, 'body', skin, f);
    if (outfit) paint(outfit, 'outfit', skin, f);       // outfits show hands: same skin swap
    if (scene === 'town' && look.hair) paint(look.hair, 'hair', hair, f);
    if (scene === 'battle' && weapon) paint(weapon, 'weapon', skin, f);
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
