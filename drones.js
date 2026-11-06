// Drone art. High-resolution sheets (sprites/drone_<type>) are used once loaded; the small text sprites below show until then.
// Each drone is 16 wide and 12 tall and faces right, towards the enemy. The top row is the rotors, which swap between two frames.
const PAL = { k: '#15191d', g: '#3d464d', s: '#7c8890', l: '#c6ced2', r: '#e0463a', d: '#8c2a22', o: '#e8973a', y: '#ffd27a', b: '#2f7fd1', c: '#9fe6ff', w: '#f3ead8', n: '#5fce70', N: '#2c7a3c', p: '#b06a2c', v: '#7a5cc8' };
const ROTOR = ['lls.lls..lls.lls', '.s...s....s...s.'];
const ART = {
  // Attack: a lean wasp with a stinger gun and a red eye.
  hornet: [
    '...k.......k....',
    '..kkkkkkkkkkk...',
    '.koooooooooook..',
    'kkogggooogrrgkkk',
    'kdogggggggrygsss',
    'kkogggggggggkkkk',
    '.kkdkkkkkkdkk...',
    '...kd..k..dk....',
    '...k..kdk..k....',
    '.......k........',
    '................',
  ],
  // Shield: a heavy disc with a glowing ring.
  aegis: [
    '...k.......k....',
    '....kkkkkkk.....',
    '..kkbbbbbbbkk...',
    '.kbbcccccccbbk..',
    'kbbckggggkcbbbk.',
    'kbcckgcwgkccbbk.',
    'kbbckggggkcbbbk.',
    '.kbbcccccccbbk..',
    '..kkbbbbbbbkk...',
    '....kkkkkkk.....',
    '................',
  ],
  // Healing: a white capsule with a green cross and a little injector.
  mender: [
    '...k.......k....',
    '..kkkkkkkkkkk...',
    '.kwwwwwwwwwwwk..',
    'kwwwwwnnwwwwwwk.',
    'kwwwnnnnnnwwwwk.',
    'kllwnnnnnnwlllk.',
    'kllllwnnwlllllk.',
    '.kkkkkkkkkkkkk..',
    '.....kNk........',
    '.....kNk........',
    '......n.........',
  ],
  // Tech: a scrappy salvager with a claw, an antenna and one big lens.
  magpie: [
    '...k...y...k....',
    '..kkkkkkkkkkk...',
    '.kvvvvvvvvvvvk..',
    'kvvgggvvvkkkvvk.',
    'kvggggggkcwckvk.',
    'kvvgggvvkcckkvk.',
    '.kkkkkkkkkkkkk..',
    '..kyk.....kyk...',
    '.ks.sk...ks.sk..',
    '.k...k...k...k..',
    '................',
  ],
};
export const DRONE_W = 16, DRONE_H = 12;
const hi = {};
export function setDroneArt(type, sheet) { hi[type] = sheet && sheet.anims.idle ? sheet.anims.idle : null; for (const k of Object.keys(icons)) if (k.startsWith(`${type}:`)) delete icons[k]; }
// A powered-down copy: the same drone in grey.
const greyed = new WeakMap();
function greyOf(img) {
  if (greyed.has(img)) return greyed.get(img);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height), p = id.data;
  for (let i = 0; i < p.length; i += 4) { const v = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) * 0.62; p[i] = v; p[i + 1] = v; p[i + 2] = v * 1.05; }
  g.putImageData(id, 0, 0);
  greyed.set(img, c);
  return c;
}
// The current high-resolution frame, or null. { img, sx, sw, sh }
export function droneHiFrame(type, t, off = false) {
  const a = hi[type];
  if (!a) return null;
  const fw = a.img.width / a.frames, f = off ? 0 : Math.floor(t / 1000 * a.fps) % a.frames;
  return { img: off ? greyOf(a.img) : a.img, sx: f * fw, sw: fw, sh: a.img.height };
}
const cache = {};
// A canvas for one frame. Frame 0 and 1 are the rotors; 'off' is a powered-down copy with stopped rotors.
export function droneCanvas(type, frame = 0, off = false) {
  const key = `${type}:${frame}:${off}`;
  if (cache[key]) return cache[key];
  const rows = [ROTOR[off ? 1 : frame % 2], ...(ART[type] || ART.hornet)];
  const cv = document.createElement('canvas');
  cv.width = DRONE_W; cv.height = DRONE_H;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => { [...row].forEach((ch, x) => {
    if (!PAL[ch]) return;
    g.fillStyle = PAL[off && 'rdoypbcwnNv'.includes(ch) ? (ch === 'w' || ch === 'c' ? 's' : 'g') : ch];
    g.fillRect(x, y, 1, 1);
  }); });
  cache[key] = cv;
  return cv;
}
// A larger picture for the menus.
const icons = {};
export function droneIcon(type, scale = 4, off = false) {
  const key = `${type}:${scale}:${off}`;
  if (icons[key]) return icons[key];
  const hf = droneHiFrame(type, 0, off);
  if (hf) {
    const c = document.createElement('canvas'); c.width = hf.sw; c.height = hf.sh;
    c.getContext('2d').drawImage(hf.img, hf.sx, 0, hf.sw, hf.sh, 0, 0, hf.sw, hf.sh);
    icons[key] = c.toDataURL();
    return icons[key];
  }
  const src = droneCanvas(type, 0, off), cv = document.createElement('canvas');
  cv.width = DRONE_W * scale; cv.height = DRONE_H * scale;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  icons[key] = cv.toDataURL();
  return icons[key];
}
