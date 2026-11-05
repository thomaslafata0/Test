// Character looks: body, class outfit, hair and colours, stacked from layered sheets when they exist
// (chars2/manifest.json, see docs/CHARACTER_ART_PROMPT_CHATGPT.md). Until the layers are delivered,
// every look falls back to the single player sheet, so the choices are stored now and shown later.

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

const SKIN_RAMP = ['#6f6f6f', '#9a9a9a', '#c8c8c8'], HAIR_RAMP = ['#4a2c1a', '#7a4a2a', '#b07a4a'];
let manifest = null, layers = {}, loading = null;

// Loads chars2/manifest.json and the town idle_down strips of every layer. Resolves to true when layered art exists.
export function loadLayers() {
  if (loading) return loading;
  loading = fetch('chars2/manifest.json').then((r) => (r.ok ? r.json() : null)).then(async (m) => {
    if (!m || m.pending) return false;
    manifest = m;
    const jobs = [];
    for (const kind of ['body', 'outfit', 'hair']) for (const id of Object.keys(m[kind] || {})) jobs.push(new Promise((res) => { const im = new Image(); im.onload = () => { layers[`${kind}:${id}`] = im; res(); }; im.onerror = () => res(); im.src = `chars2/${kind}/${id}/idle_down.png`; }));
    await Promise.all(jobs);
    return true;
  }).catch(() => false);
  return loading;
}
export const hasLayers = () => !!manifest;

function recolour(src, from, to) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  const map = {};
  from.forEach((hex, i) => { map[hex.toLowerCase()] = to[i]; });
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const hex = '#' + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    const t = map[hex];
    if (t) { px[i] = parseInt(t.slice(1, 3), 16); px[i + 1] = parseInt(t.slice(3, 5), 16); px[i + 2] = parseInt(t.slice(5, 7), 16); }
  }
  g.putImageData(d, 0, 0);
  return c;
}

// A 64x64 still (first idle_down frame) of a look, as a data URL, or null if the layers aren't there.
const stillCache = {};
export function lookStill(look, background) {
  if (!manifest || !look) return null;
  const key = JSON.stringify([look, background]);
  if (stillCache[key]) return stillCache[key];
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const outfit = { foundry: 'cls_foundry', runner: 'cls_runner', clerk: 'cls_clerk', preacher: 'cls_preacher' }[background];
  const parts = [['body', look.body, SKIN_RAMP, SKINS[look.skin] || SKINS[1]], ['outfit', outfit, null, null], ['hair', look.hair, HAIR_RAMP, HAIRS[look.hairColor] || HAIRS[1]]];
  let drew = false;
  for (const [kind, id, from, to] of parts) {
    const im = layers[`${kind}:${id}`];
    if (!im) continue;
    const src = from ? recolour(im, from, to) : im;
    g.drawImage(src, 0, 0, 64, 64, 0, 0, 64, 64);
    drew = true;
  }
  return (stillCache[key] = drew ? c.toDataURL('image/png') : null);
}
