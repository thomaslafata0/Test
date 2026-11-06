// Drone art: small pixel sprites, kept as text so they load instantly and stay easy to change.
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
  const src = droneCanvas(type, 0, off), cv = document.createElement('canvas');
  cv.width = DRONE_W * scale; cv.height = DRONE_H * scale;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  icons[key] = cv.toDataURL();
  return icons[key];
}
