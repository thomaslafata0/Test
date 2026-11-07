// Animated battle stage: a low-res canvas scaled up with crisp pixels, plus an HTML overlay for HP boxes and
// damage numbers. It replays the events the engine records for each turn.
// Characters come from PixelLab-style sprite sheets (sprites/manifest.json) when present, otherwise from the
// code-drawn portraits.
import { portraitCanvas, MUZZLE } from './portraits.js';
import { play } from './audio.js';
import { MAPS } from './data.js';

import { droneCanvas, droneHiFrame, DRONE_W, DRONE_H } from './drones.js';
export const W = 384, H = 216;
// The fight draws at 3x, so high-resolution sprites keep their detail. Older art scales up with crisp pixels.
const RES = 3;
// How tall each high-resolution figure stands on the stage. The enemy stands further back, so it's smaller.
const HD_HEIGHT = { player: 146, partner: 124, patrol: 112, probe: 66, officer: 108, hound: 78, riot: 116, marksman: 112, interrogator: 112, shock: 116, sentinel: 116, halvek: 118, crawler: 92, ostrane: 112, ally: 98,
  welder: 66, foreman: 112, loader: 112, slagger: 114, jailer: 108, sedation: 108, dockguard: 112, gunner: 112, brask: 122, crucible: 128, kell: 116, vane: 116,
  smallbot: 62, bulwark: 62, spotweld: 60, slagrunt: 60, cuffbot: 60, gasbot: 62, mortarbot: 66, deckbot: 60,
  stoker: 110, hookbot: 84, castguard: 116, warder: 116, orderly: 108, customs: 112, tetherdrone: 64, exo: 122,
  dray: 120, slagmother: 132, hale: 120, restraint: 126, voight: 116, venn: 118, pell: 112, gantry: 134, imre: 122 };
// Fighters whose own sheet isn't in yet borrow one that fits, worn in the map's colours. Each lookup checks for the real
// sheet first, so it takes over the moment hd.json lists it, with nothing to change here.
const STAND_IN = { dray: 'halvek', slagmother: 'crucible', hale: 'brask', restraint: 'crawler', voight: 'interrogator', venn: 'kell', pell: 'officer', gantry: 'loader', imre: 'ostrane',
  stoker: 'foreman', hookbot: 'welder', castguard: 'shock', warder: 'riot', orderly: 'jailer', customs: 'dockguard', tetherdrone: 'probe', exo: 'shock' };
const MELEE = new Set(['hound', 'riot', 'loader', 'brask', 'foreman', 'slagger', 'jailer', 'sedation', 'bulwark', 'spotweld', 'cuffbot', 'stoker', 'warder', 'orderly', 'exo', 'hale', 'venn']);
// Charge poses that were drawn to loop from their first frame. The rest settle into a brace and breathe on their last frames.
const CHARGE_LOOPS = new Set(['gunner', 'marksman', 'riot', 'shock']);
const HOVER = new Set(['probe', 'tetherdrone']);
const osCalm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let reduceMotion = osCalm;
export const setCalm = (on) => { reduceMotion = osCalm || on; };
const MAX_PARTICLES = 260; // the stage draws at 3x on a phone: keep the sparks affordable
const BLOOD = ['#a3261e', '#7d1a15', '#c23a2e'], FLECK = ['#9aa4ad', '#5f6a73', '#c6ced4'];
const C = { amber: '#ffb35a', crit: '#fff1c9', red: '#ff5a44', ion: '#8fdcff', heal: '#9be08a', smoke: '#8b949c', spark: '#ffd27a' };

// ---------- sprite sheets ----------
const sheets = {};
// Composited look sheets (look.js) for the player and the co-op partner; they replace sheets.player per side.
const lookSheets = { player: null, partner: null };
export function setLookSheets(player, partner) { lookSheets.player = player || null; lookSheets.partner = partner || null; }
// Art can arrive long after the first fight on a bad connection, so nothing about it is final: every file is retried,
// and whatever comes in late tells the listeners (index.html recomposites operatives; each stage swaps its actors in place).
const artListeners = new Set(), artWaiters = new Set();
export function onArtChange(fn) { artListeners.add(fn); return () => artListeners.delete(fn); }
function artChanged(id) {
  for (const fn of artListeners) { try { fn(id); } catch (e) { console.warn('art change', e); } }
  for (const w of [...artWaiters]) w();
}
// The waits between tries of a file that failed: about a minute in all.
const RETRY_MS = [700, 1800, 4000, 8000, 15000, 30000];
function fetchJson(url, ok, gone, firstFail) {
  let tries = 0;
  const go = () => fetch(tries ? `${url}?retry=${tries}` : url, { cache: 'no-cache' })
    .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
    .then(ok, () => { if (!tries && firstFail) firstFail(); if (tries >= RETRY_MS.length) gone(); else setTimeout(go, RETRY_MS[tries++]); });
  go();
}
function fetchImage(src, job, ok, gone, firstFail) {
  let tries = 0;
  const go = () => {
    if (job.dead) return;
    const img = new Image();
    img.onload = () => { if (!job.dead) ok(img); };
    img.onerror = () => { if (job.dead) return; if (!tries) firstFail(); if (tries >= RETRY_MS.length) gone(); else setTimeout(go, RETRY_MS[tries++]); };
    img.src = tries ? `${src}?retry=${tries}` : src;
  };
  go();
}
const defs = {}, jobs = {};
// 'wait' until hd.json has answered or the retries ran out. Almost every sheet, operatives included, is described only there.
let hdState = 'wait', hdMissed = false, opFirst = null;
// The operative this player will see first loads before anything else.
export function preferOpArt(sex) { opFirst = sex === 'f' || sex === 'm' ? sex : null; }
const NPCS = ['marrow', 'ilse', 'handler', 'dispatcher', 'vendor', 'worker', 'kid'];
const LAZY = (id) => !/^(op_|drone_)|^(prisoner|player|patrol)$/.test(id) && !NPCS.includes(id);
export function loadSheets(base = 'sprites/') {
  return new Promise((resolve) => {
    fetchJson(`${base}manifest.json`, (man) => {
      // Only where hd.json has nothing: its sheets replace older ones of the same name.
      for (const [id, def] of Object.entries(man)) if (!defs[id]) defs[id] = { def, base };
      if (hdState !== 'wait' || hdMissed) ensureSheet('player');
    }, () => {}, null);
    const hdKnown = () => {
      for (const id of Object.keys(tintCache)) delete tintCache[id];
      artChanged('*');
      if (sheetsFor) { const t = sheetsFor; sheetsFor = null; loadMapSheets(t); }
    };
    fetchJson(`${base}hd.json`, (hd) => {
      for (const [id, def] of Object.entries(hd)) {
        if (jobs[id]) { jobs[id].dead = true; delete jobs[id]; }
        delete sheets[id];
        defs[id] = { def: { ...def, hd: true }, base };
      }
      hdState = 'ok';
      hdKnown();
      loadEager().then(resolve);
    }, () => { hdState = 'gone'; hdKnown(); resolve(); },
    // Without hd.json only the stock figure is safe to load: the rest of manifest.json no longer matches its files.
    () => { hdMissed = true; ensureSheet('player'); });
  });
}
// In order of how soon a player sees them, so a slow connection spends itself on the operative first.
async function loadEager() {
  const steps = [opFirst ? [`op_${opFirst}`] : ['op_m', 'op_f'], ['op_m', 'op_f'], ['drone_hornet', 'drone_aegis', 'drone_mender', 'drone_magpie', 'prisoner'], NPCS, ['patrol', 'player']];
  for (const step of steps) {
    await Promise.all(step.map(ensureSheet));
    // A fight's enemy goes ahead of the next batch.
    await Promise.all(Object.values(jobs).filter((j) => !j.firstDone).map((j) => j.first));
  }
}
// The idle row comes first and is enough to go on with: a boss intro or an opening stance needs nothing else, and the
// other moves join the same sheet as they arrive. Listeners hear at idle and at the end of the first pass, so an operative
// (expensive to composite) is rebuilt twice, not once per file.
function startSheet(id) {
  const { def, base } = defs[id], names = Object.keys(def.anims || {});
  const job = jobs[id] = { dead: false, anims: {}, open: names.length, firstDone: false, first: null };
  const publish = () => { if (job.anims.idle && !job.dead) sheets[id] = { size: def.size || job.anims.idle.img.height, anims: job.anims, hd: !!def.hd, fig: def.fig }; };
  job.first = new Promise((done) => {
    let waiting = names.length;
    if (!waiting) { job.firstDone = true; done(); return; }
    const fetchOne = (name, then) => {
      const a = def.anims[name];
      let counted = false;
      const count = () => { if (counted) return; counted = true; if (then) then(); if (--waiting) return; job.firstDone = true; publish(); done(); if (!job.dead) artChanged(id); };
      fetchImage(`${base}${id}/${name}.png`, job, (img) => {
        job.open--;
        // A manifest line can outlive its art: a 250px sheet read as 96px frames would draw a giant. Only hd.json describes those files.
        if (def.hd || !def.size || img.height === def.size) {
          job.anims[name] = { img, frames: a.frames || 1, fps: a.fps || 8, loop: !!a.loop, pad: a.pad, tip: a.tip };
          tintLate(id, name);
        }
        if (name === 'idle') { publish(); artChanged(id); }
        else if (counted) artChanged(id); // came in on a retry
        count();
      }, () => { job.open--; if (job.open <= 0 && job.firstDone) artChanged(id); }, count);
    };
    if (def.anims.idle) fetchOne('idle', () => names.forEach((n) => { if (n !== 'idle') fetchOne(n); }));
    else names.forEach((n) => fetchOne(n));
  });
}
export function ensureSheet(id) {
  if (sheets[id] || !defs[id] || (hdState === 'wait' && id !== 'player')) return Promise.resolve();
  const j = jobs[id];
  if (j && !j.dead && (j.open > 0 || !j.firstDone)) return j.first;
  startSheet(id);
  return jobs[id].first;
}
// Is the real art for this id still on its way? Used to hold a fight briefly rather than show a stand-in.
function artPending(name) {
  const id = artOf(name);
  if (sheets[id] && sheets[id].hd) return false;
  if (hdState === 'wait') return true;
  if (sheets[id] || !defs[id]) return false;
  const j = jobs[id];
  return !j || j.open > 0 || !j.firstDone;
}
// Load this map's fighters ahead of the first fight and let go of the last map's.
let sheetsFor = null;
function loadMapSheets(theme, first) {
  if (theme === sheetsFor) return;
  sheetsFor = theme;
  const map = MAPS.find((m) => m.theme === theme);
  if (!map) return;
  const keep = new Set([...map.pool.map((p) => p[0]), ...map.bosses].flatMap((id) => [id, artOf(id)]));
  for (const id of Object.keys(defs)) if (LAZY(id) && !keep.has(id)) { delete sheets[id]; if (jobs[id]) { jobs[id].dead = true; delete jobs[id]; } }
  for (const k of Object.keys(tintCache)) if (!k.endsWith(`-${theme}`)) delete tintCache[k];
  (async () => { await first; for (const id of keep) await ensureSheet(id); })();
}

export const sheetOf = (id) => sheets[id] || null;
// The sheet to load for an id: its own once hd.json or the manifest knows it, else its stand-in.
const artOf = (id) => (STAND_IN[id] && !defs[id] ? STAND_IN[id] : id);
// The sheet to draw now, and whose it is: its own if loaded, else a loaded stand-in.
function sheetFor(id) {
  if (sheets[id]) return [id, sheets[id]];
  const alt = STAND_IN[id];
  return alt && sheets[alt] ? [alt, sheets[alt]] : [id, null];
}
// Enemies shared between maps wear that map's colours. Recoloured once per enemy and map, in code. Bright glows (eyes, muzzles) keep their colour.
const MAP_TINT = { foundry: [1, 0.72, 0.52, 0.42, 0.86], detention: [0.62, 0.78, 1, 0.48, 0.92], port: [0.96, 1, 1.06, 0.55, 1.28] };
const TINTED = new Set(['probe', 'officer', 'hound', 'riot', 'marksman', 'interrogator', 'shock', 'sentinel', 'crawler', 'ostrane']);
const tintCache = {};
function tintedSheet(id, theme) {
  const [src, base] = sheetFor(id), tint = MAP_TINT[theme];
  if (!base || !base.hd || !tint || !(TINTED.has(src) || src !== id)) return base || null;
  const key = `${src}-${theme}`;
  if (tintCache[key]) return tintCache[key];
  const anims = {};
  for (const [name, a] of Object.entries(base.anims)) anims[name] = tintRow(a, tint);
  return (tintCache[key] = { ...base, anims });
}
// A row that arrives after its sheet was recoloured.
function tintLate(id, name) {
  const base = sheets[id];
  if (!base) return;
  for (const [k, sh] of Object.entries(tintCache)) if (k.startsWith(`${id}-`)) sh.anims[name] = tintRow(base.anims[name], MAP_TINT[k.slice(id.length + 1)]);
}
function tintRow(a, tint) {
  const [r, gr, b, amt, gain] = tint;
  {
    const c = document.createElement('canvas'); c.width = a.img.width; c.height = a.img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(a.img, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx > 170 && (mx - mn) / mx > 0.6) continue;
      const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) * gain;
      d[i] = Math.min(255, d[i] * (1 - amt) + l * r * amt); d[i + 1] = Math.min(255, d[i + 1] * (1 - amt) + l * gr * amt); d[i + 2] = Math.min(255, d[i + 2] * (1 - amt) + l * b * amt);
    }
    g.putImageData(im, 0, 0);
    return { ...a, img: c };
  }
}
// Painted backdrops: per map, an area and then a boss arena for each stretch of five sectors. They load when needed; the code-drawn scene stands in until then.
const BG_OPEN = new Set(['garrison_1', 'garrison_2', 'foundry_1', 'port_1', 'port_2']);
const bgCache = new Map();
function paintedBackdrop(theme, sector, boss) {
  const band = Math.min(3, Math.floor((sector - 1) / 5)), key = `${theme}_${band * 2 + (boss ? 2 : 1)}`;
  let e = bgCache.get(key);
  if (!e) {
    e = { canvas: null, open: BG_OPEN.has(key) };
    bgCache.set(key, e);
    let img = new Image(), tries = 0;
    const paint = () => {
      const c = document.createElement('canvas'); c.width = W * RES; c.height = H * RES;
      const q = c.getContext('2d'); q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high';
      q.drawImage(img, 0, 0, c.width, c.height);
      // Slightly soft and dark, so the fighters read first. Built by scaling, which every phone can do.
      const s = document.createElement('canvas'); s.width = Math.round(c.width / 5); s.height = Math.round(c.height / 5);
      const sq = s.getContext('2d'); sq.imageSmoothingEnabled = true; sq.imageSmoothingQuality = 'high'; sq.drawImage(img, 0, 0, s.width, s.height);
      q.globalAlpha = 0.5; q.drawImage(s, 0, 0, c.width, c.height); q.globalAlpha = 1;
      q.fillStyle = 'rgba(7,11,16,0.26)'; q.fillRect(0, 0, c.width, c.height);
      e.canvas = c;
      // Keep only the last few in memory: each one is about 3 MB on a phone.
      if (bgCache.size > 3) { const old = bgCache.keys().next().value; if (old !== key) bgCache.delete(old); }
    };
    // The code-drawn scene stays up while a failed backdrop is tried again.
    const fail = () => {
      if (tries >= RETRY_MS.length || bgCache.get(key) !== e) return;
      setTimeout(() => { if (bgCache.get(key) !== e) return; tries++; img = new Image(); img.onload = paint; img.onerror = fail; img.src = `bg/${key}.png?retry=${tries}`; }, RETRY_MS[tries]);
    };
    img.onload = paint; img.onerror = fail;
    img.src = `bg/${key}.png`;
  } else { bgCache.delete(key); bgCache.set(key, e); }
  return e;
}
// First idle frame of a character's sheet, cropped to the figure, as a data URL (for victory/death screens).
const stills = {};
export function sheetStill(name) {
  const [id, sh] = sheetFor(name);
  if (stills[id] !== undefined) return stills[id];
  if (!sh || !sh.anims.idle) return null;
  const a = sh.anims.idle, fw = a.img.width / a.frames, fh = a.img.height;
  const c = document.createElement('canvas'); c.width = fw; c.height = fh;
  const g = c.getContext('2d'); g.drawImage(a.img, 0, 0, fw, fh, 0, 0, fw, fh);
  const px = g.getImageData(0, 0, fw, fh).data;
  let x0 = fw, y0 = fh, x1 = 0, y1 = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (px[(y * fw + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) return (stills[id] = null);
  const side = Math.max(x1 - x0, y1 - y0) + 4, out = document.createElement('canvas');
  out.width = out.height = side;
  out.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.round((side - (x1 - x0)) / 2), Math.round((side - (y1 - y0)) / 2), x1 - x0 + 1, y1 - y0 + 1);
  return (stills[id] = out.toDataURL('image/png'));
}

// ---------- helpers ----------
const phoneView = () => typeof matchMedia !== 'undefined' && matchMedia('(orientation: landscape) and (max-height: 600px), (orientation: landscape) and (pointer: coarse) and (max-height: 820px)').matches;
const ease = (p) => 1 - Math.pow(1 - p, 3);
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Actor {
  constructor(id, side, boss) {
    this.id = id; this.side = side; this.boss = boss;
    this.sheet = (id === 'player' && lookSheets[side === 'partner' ? 'partner' : 'player']) || sheetFor(id)[1] || null;
    this.drawn = this.sheet ? null : portraitCanvas(id) || (STAND_IN[id] ? portraitCanvas(STAND_IN[id]) : null);
    this.ox = 0; this.oy = 0; this.alpha = 1; this.flash = 0; this.flashColor = '#ffffff';
    this.anim = 'idle'; this.animStart = 0; this.rest = 'idle';
  }
  get scale() {
    if (this.fixedH && this.sheet && this.sheet.hd) return this.fixedH / this.sheet.fig;
    if (this.sheet && this.sheet.hd) return (HD_HEIGHT[this.side === 'enemy' ? this.id : this.side] || 112) / this.sheet.fig;
    // Sheet characters fill about half their frame, so they're drawn larger than the frame size.
    if (this.sheet) return this.side === 'player' ? 2 : this.side === 'partner' ? 1.7 : this.side === 'ally' ? 1.1 : this.sheet.size >= 128 ? 1.1 : 1.6;
    return this.side === 'player' ? 3 : this.boss ? 2.5 : 2;
  }
  get size() { return (this.sheet ? this.sheet.size : 40) * this.scale; }
  // The figure's height on the stage.
  get tall() { return this.sheet && this.sheet.hd ? this.sheet.fig * this.scale : this.size * 0.8; }
  setAnim(name, t) { if (this.sheet && this.sheet.anims[name]) { this.anim = name; this.animStart = t; } }
  frame(t) {
    if (!this.sheet) return { img: this.drawn, sx: 0, sw: 40, sh: 40 };
    let a = this.sheet.anims[this.anim] || this.sheet.anims.idle;
    let f = Math.max(0, Math.floor(((t - this.animStart) / 1000) * a.fps)); // never negative: the clock stands still during hit-stop
    if (a.loop && this.anim === 'charge' && this.sheet.hd && !CHARGE_LOOPS.has(this.id) && a.frames >= 6) { if (f >= a.frames) f = a.frames - 1 - [3, 2, 1, 0, 1, 2][(f - a.frames) % 6]; }
    // Standing still: a slow, small breath over the first few frames, not the whole idle cycle, which reads as swaying.
    else if (a.loop && this.anim === 'idle' && this.sheet.hd && a.frames >= 6) f = [0, 1, 2, 1][Math.max(0, Math.floor(((t - this.animStart) / 1000) * 2)) % 4];
    else if (a.loop) f %= a.frames;
    else if (f >= a.frames) {
      if (this.anim === 'death') f = a.frames - 1;
      else { this.anim = this.sheet.anims[this.rest] ? this.rest : 'idle'; this.animStart = t; a = this.sheet.anims[this.anim]; f = 0; }
    }
    const fw = a.img.width / a.frames;
    return { img: a.img, sx: f * fw, sw: fw, sh: a.img.height, pad: a.pad };
  }
}

// Boss-move art (bars, container, slag) and the props that stand about the floor. Each loads on first use; until it
// arrives, the old code-drawn version stands in, so a slow connection never shows a hole.
const FX_IMG = {};
function fxImg(name) {
  let e = FX_IMG[name];
  if (!e) { e = FX_IMG[name] = { img: null }; const im = new Image(); im.onload = () => { e.img = im; }; im.onerror = () => {}; im.src = `sprites/fx/${name}.png`; }
  return e.img;
}
let PROP_DEFS = null;
function propDefs() {
  if (PROP_DEFS) return PROP_DEFS;
  PROP_DEFS = {};
  fetch('sprites/props/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((m) => {
    for (const [id, d] of Object.entries(m || {})) { const im = new Image(); im.onload = () => { PROP_DEFS[id] = { ...d, id, img: im }; }; im.src = `sprites/props/${id}.png`; }
  }).catch(() => {});
  return PROP_DEFS;
}
// A few props per map, not every room: about half of the sectors get one, a few get two, boss arenas stay bare.
const PROP_SPOTS = [{ x: 352, y: 158, h: 60 }, { x: 186, y: 140, h: 44 }];
function propsFor(theme, sector, boss) {
  const defs = Object.values(propDefs()).filter((d) => d.theme === theme);
  if (boss || !defs.length) return [];
  const rnd = seeded(sector * 7919 + theme.length * 131), r = rnd(), n = r < 0.14 ? 2 : r < 0.55 ? 1 : 0;
  const out = [], pool = [...defs];
  for (let i = 0; i < n && pool.length; i++) out.push({ ...PROP_SPOTS[i], d: pool.splice(Math.floor(rnd() * pool.length), 1)[0], phase: rnd() * 1000 });
  return out;
}
// Who steps in front of a boss for 'front': foundry hands for Brask, conscripts for Dray.
const FRONT_CREW = { brask: 'stoker', dray: 'patrol' };

const SIG_COLOR = { shutter: '#9aa3ad', confiscate: '#e6d36a', anchor: '#c79a5a', siege: '#ffb347', roll: '#ff8a3c', floor: '#ff8a3c', overtime: '#d4483a', front: '#e6d36a', count: '#e6d36a', lights: '#73b6d4', crane: '#c79a5a', salute: '#fff1c9', redact: '#efe7d6', audit: '#ffffff' };

const ART_HOLD_MS = 4000;
export class Stage {
  constructor() {
    this.holdSince = {}; this.artHold = false; this.holding = null; this.popAt = {};
    this.el = document.createElement('div');
    this.el.className = 'stage';
    this.el.innerHTML = `<canvas width="${W * RES}" height="${H * RES}" aria-hidden="true"></canvas>
      <div class="hud hud-enemy"><div class="hud-row"><b class="hud-name"></b><span class="hud-tag"></span></div><div class="bar enemy"><i></i></div><div class="hud-row"><span class="hud-st"></span><span class="hud-hp num"></span></div></div>
      <div class="hud hud-player"><div class="hud-row"><b class="hud-name"></b><span class="hud-tag"></span></div><div class="bar"><i></i></div><div class="hud-row"><span class="hud-st"></span><span class="hud-hp num"></span></div></div>
      <div class="cine" hidden><i class="bar-top"></i><i class="bar-bot"></i><div class="cine-card"><span class="cine-label"></span><b class="cine-name"></b><span class="cine-epithet"></span><span class="cine-line"></span></div><span class="cine-skip">Tap to skip</span></div>
      <div class="bsay" hidden role="status"><span class="bsay-text"></span><span class="bsay-note"></span></div>
      <div class="art-wait" hidden role="status">Loading fighters\u2026</div>
      <div class="pops" aria-hidden="true"></div>
      <div class="speed" role="group" aria-label="Battle mode"><button data-speed="manual" title="You choose every move">Manual</button><button data-speed="auto1" title="Auto battle: the operative fights with a fixed routine. Tap Manual to take over.">Auto 1\u00D7</button><button data-speed="auto2" title="Auto battle at double speed.">Auto 2\u00D7</button></div>`;
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(RES, RES);
    this.ctx.imageSmoothingEnabled = false;
    this.buf = document.createElement('canvas');
    this.pops = this.el.querySelector('.pops');
    this.hud = { enemy: this.el.querySelector('.hud-enemy'), player: this.el.querySelector('.hud-player') };
    this.max = { enemy: 1, player: 1 };
    this.particles = []; this.bolts = []; this.rings = []; this.projectiles = []; this.tweens = [];
    this.shakeUntil = 0; this.shakeMag = 0; this.shakeLen = 1;
    this.stopAt = 0; this.stopUntil = 0; this.stopBudget = 0; this.frameFlash = null; this.zoom = null; this.enemyTags = [];
    this.sayN = 0; this.sigLog = []; this.bfx = null; this.drop = null; // boss moves: last line shown, animations played (tests/boss.cjs reads it), what's on the stage
    this.fxCount = { shakes: 0, stops: 0, flashes: 0, screenFlashes: 0, casings: 0, metal: 0, flesh: 0 }; // tests/juice.cjs reads these
    this.bgCache = {};
    this.rain = Array.from({ length: 70 }, (_, i) => ({ x: (i * 53) % W, y: (i * 97) % H, v: 3 + (i % 4) }));
    this.enemy = null; this.player = null; this.enemyRef = null; this.runRef = null;
    this.intent = 'attack'; this.stun = 0; this.sector = 1; this.boss = false;
    this.playerShield = false; this.heavyBoost = false;
    // Battle mode: 'manual', 'auto1' (auto battle) or 'auto2' (auto battle, animations at double speed).
    try { this.mode = JSON.parse(localStorage.getItem('cinder-cell-speed')); } catch (e) { this.mode = 'manual'; }
    if (!['manual', 'auto1', 'auto2'].includes(this.mode)) this.mode = this.mode === 'auto' ? 'auto1' : 'manual';
    this.auto = this.mode !== 'manual'; this.speed = this.mode === 'auto2' ? 2 : 1;
    this.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-speed]');
      if (!b) return;
      // On a phone only the current mode shows, and tapping it moves to the next.
      this.setMode(b.dataset.speed === this.mode && matchMedia('(orientation: landscape) and (max-height: 600px), (orientation: landscape) and (pointer: coarse) and (max-height: 820px)').matches ? { manual: 'auto1', auto1: 'auto2', auto2: 'manual' }[this.mode] : b.dataset.speed);
    });
    this.syncSpeed();
    onArtChange((id) => { if (id === '*' && this.enemy) ensureSheet(artOf(this.enemy.id)); this.refreshArt(); });
    const loop = (t) => { try { this.draw(performance.now()); } catch (e) { console.warn('stage draw', e); const g = this.ctx; g.setTransform(RES, 0, 0, RES, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setMode(m) {
    this.mode = m; this.auto = m !== 'manual'; this.applySpeed();
    try { localStorage.setItem('cinder-cell-speed', JSON.stringify(m)); } catch (e) {}
    this.syncSpeed();
    this.el.dispatchEvent(new CustomEvent('automode', { bubbles: true, detail: this.auto }));
  }
  cycleMode() { this.setMode({ manual: 'auto1', auto1: 'auto2', auto2: 'manual' }[this.mode]); }
  setFast(on) { this.fast = on; this.applySpeed(); }
  setSlow(on) { if (this.slow !== on) { this.slow = on; this.applySpeed(); } }
  applySpeed() { this.speed = (this.mode === 'auto2' ? 2 : this.fast ? 1.6 : 1) * (this.slow ? 0.5 : 1); }
  syncSpeed() { this.el.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speed === this.mode))); }
  get skip() { return false; }
  wait(ms) { return this.skip ? Promise.resolve() : new Promise((r) => setTimeout(r, ms / this.speed)); }
  tween(ms, fn) {
    if (this.skip) { fn(1); return Promise.resolve(); }
    return new Promise((done) => this.tweens.push({ start: performance.now(), dur: ms / this.speed, fn, done }));
  }
  // A melee hit in three beats: a low dash that stops at arm's length, the swing, then a hop back. The blow lands on the swing's contact frame.
  async meleeIn(actor, target) {
    const hd = actor.sheet && actor.sheet.hd, fromLeft = actor.side !== 'enemy';
    const anim = hd && actor.sheet.anims.attackM ? 'attackM' : 'attack';
    const a = this.anchor(actor.side, actor), b = this.anchor(target.side, target);
    // Stop short of the target by both figures' half widths, on its line of depth.
    const gap = Math.max(46, (target.tall || 80) * 0.3 + (actor.tall || 100) * 0.26);
    const x = (b.x - a.x) + (fromLeft ? -gap : gap), y = Math.max(-46, Math.min(46, (b.y - a.y) * 0.8));
    if (hd && actor.sheet.anims.walk) actor.setAnim('walk', performance.now());
    if (!reduceMotion) this.burst(a.x + actor.ox, a.y + actor.oy - 2, 5, C.smoke, 0.7, 320, -0.02, 2);
    await this.move(actor, x, y, 190);
    actor.setAnim(anim, performance.now());
    const clip = actor.sheet && actor.sheet.anims[anim];
    // Most swings connect around the middle of the row.
    if (clip && actor.sheet.hd) await this.wait(Math.floor(clip.frames * 0.45) * 1000 / clip.fps);
    await this.move(actor, x + (fromLeft ? 8 : -8), y, 50);
  }
  async meleeOut(actor) {
    await this.wait(90);
    if (actor.sheet && actor.sheet.anims.idle) actor.setAnim('idle', performance.now());
    await this.move(actor, 0, 0, 230);
  }
  move(actor, x, y, ms) { const x0 = actor.ox, y0 = actor.oy; return this.tween(ms, (p) => { const e = ease(p); actor.ox = x0 + (x - x0) * e; actor.oy = y0 + (y - y0) * e; }); }

  // ---------- scene ----------
  // Drawn busts sit on the pad cut off at the bottom; full-body sheets stand on it.
  anchor(side, actor) {
    const sheet = actor ? actor.sheet : (side === 'enemy' ? this.enemy : this.player)?.sheet;
    if (side === 'enemy') return { x: 290, y: sheet ? 160 : 122 };
    if (side === 'partner') return { x: 38, y: 198 };
    return sheet ? { x: 104, y: 206 } : { x: 98, y: 228 };
  }
  // Pixels from the frame's bottom edge to the character's feet (8px in the source sheet).
  footPad(actor) { return actor.sheet ? 8 * actor.scale : 0; }
  // Hovers up above the head and slightly forward, clear of the operative and their partner. Small on purpose: two of them shouldn't crowd a co-op fight.
  dronePos(actor, info, t = performance.now(), seed = 0) {
    const c = this.center(actor), size = actor.tall * 1.1, still = reduceMotion || (info && info.damaged);
    const bob = still ? 0 : Math.sin(t / 310 + seed * 2) * 2, sway = still ? 0 : Math.sin(t / 830 + seed) * 2;
    return { x: Math.round(c.x + size * 0.1 + sway), y: Math.round(c.y - size * 0.62 + bob + (info && info.damaged ? 12 : 0)) };
  }
  // Plays the drone's ability, and waits for the moment it lands.
  async droneMove(actor) {
    if (!this.droneAct) this.droneAct = new Map();
    this.droneAct.set(actor, performance.now());
    await this.wait(300);
  }
  drawDrone(actor, info, t, seed) {
    const g = this.g || this.ctx, p = this.dronePos(actor, info, t, seed), w = DRONE_W * 2, h = DRONE_H * 2;
    g.save();
    g.imageSmoothingEnabled = false;
    g.globalAlpha = actor.alpha === undefined ? 1 : actor.alpha;
    const hf = droneHiFrame(info.type, t, !!info.damaged, this.droneAct && this.droneAct.get(actor));
    if (hf) {
      // Sized from the idle frame so the drone doesn't jump when its ability plays; a little larger while acting, so the move reads.
      // While it acts the drone swoops forward, grows and glows, so the move reads at phone size.
      const start = this.droneAct && this.droneAct.get(actor), swing = hf.acting ? Math.sin(Math.min(1, (t - start) / 820) * Math.PI) : 0;
      const k = Math.min(34 / hf.idleH, 50 / hf.idleW) * (1 + 0.75 * swing), tall = hf.sh * k, wide = hf.sw * k, px = p.x + 30 * swing, py = p.y + 6 * swing;
      if (swing > 0.02) {
        const col = { hornet: '255,150,70', aegis: '120,210,255', mender: '130,240,150', magpie: '255,225,120' }[info.type] || '255,255,255';
        const gl = g.createRadialGradient(px, py, 2, px, py, 46); gl.addColorStop(0, `rgba(${col},${0.42 * swing})`); gl.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gl; g.fillRect(px - 46, py - 46, 92, 92);
      }
      g.drawImage(hf.img, hf.sx, 0, hf.sw, hf.sh, Math.round(px - wide / 2), Math.round(py + (hf.idleH * k) / 2 - tall), Math.round(wide), Math.round(tall));
    }
    else g.drawImage(droneCanvas(info.type, Math.floor(t / 70), !!info.damaged), p.x - w / 2, p.y - h / 2, w, h);
    g.restore();
    if (info.damaged && !reduceMotion && Math.random() < 0.05) this.burst(p.x, p.y - 4, 1, Math.random() < 0.5 ? C.smoke : C.spark, 0.5, 500, -0.02, 1);
  }
  center(actor) {
    const a = this.anchor(actor.side, actor);
    if (actor.sheet && actor.sheet.hd) return { x: a.x + actor.ox, y: a.y + actor.oy - actor.tall * 0.5 };
    if (actor.sheet) return { x: a.x + actor.ox, y: a.y + actor.oy - actor.size * 0.3 };
    return { x: a.x + actor.ox, y: a.y + actor.oy - actor.size * (actor.side === 'player' ? 0.45 : 0.5) };
  }
  muzzle(actor) {
    const a = this.anchor(actor.side, actor), s = actor.size, m = !actor.sheet && (MUZZLE[actor.id] || MUZZLE[STAND_IN[actor.id]]);
    if (actor.sheet && actor.sheet.hd) { const at = actor.sheet.anims.attack, tip = at && at.tip; if (tip) return { x: a.x + actor.ox + (actor.mirror ? -1 : 1) * tip[0] * actor.scale, y: a.y + actor.oy + tip[1] * actor.scale }; return { x: a.x + actor.ox + (actor.side === 'enemy' ? -1 : 1) * actor.tall * 0.25, y: a.y + actor.oy - actor.tall * 0.65 }; }
    if (actor.sheet && actor.sheet.look && actor.sheet.anims.attack && actor.sheet.anims.attack.tip) { const tip = actor.sheet.anims.attack.tip[0] || actor.sheet.anims.attack.tip; if (tip && tip.length === 2) return { x: a.x + actor.ox - s / 2 + (tip[0] / 96) * s, y: a.y + actor.oy - s + (tip[1] / 96) * s + this.footPad(actor) }; }
    if (actor.sheet) return actor.side === 'player' ? { x: a.x + actor.ox + s * 0.18, y: a.y + actor.oy - s * 0.36 } : { x: a.x + actor.ox - s * 0.18, y: a.y + actor.oy - s * 0.36 };
    if (m) return { x: a.x + actor.ox - s / 2 + (m[0] / 40) * s, y: a.y + actor.oy - s + (m[1] / 40) * s };
    return actor.side === 'player' ? { x: a.x + actor.ox + s * 0.35, y: a.y + actor.oy - s * 0.6 } : { x: a.x + actor.ox - s * 0.3, y: a.y + actor.oy - s * 0.5 };
  }

  // High-resolution attacks take a moment to raise the weapon. Start part way in, and let the shot wait for the firing frame.
  async aim(actor) {
    const a = actor.sheet && actor.sheet.hd && (actor.sheet.anims[actor.anim] || actor.sheet.anims.attack);
    if (!a) return;
    actor.animStart -= 2000 / a.fps;
    await this.wait(2600 / a.fps);
  }
  // Called after every render of the combat screen.
  sync({ run, enemy, player, drone = null, partnerDrone = null, partner = null, sector, boss, theme = 'garrison', allies = 0, pst = {}, est = {}, affix = null, quirk = null, label = '' }) {
    const now = performance.now();
    // Co-op: the friend's operative stands at your shoulder. partner = { idx, name, hp, maxHp, acting }.
    this.partnerInfo = partner;
    this.drone = drone; this.partnerDrone = partnerDrone;
    if (partner && !this.partner) this.partner = new Actor('player', 'partner', false);
    if (!partner) this.partner = null;
    this.sector = sector; this.boss = boss; this.theme = theme; this.allies = allies;
    loadMapSheets(theme, ensureSheet(artOf(enemy.id))); // this fight's enemy goes ahead of the rest of the map
    if (!this.allySprite) this.allySprite = portraitCanvas('prisoner');
    if (sheets.prisoner) {
      this.allyActors = this.allyActors || [];
      while (this.allyActors.length < allies) this.allyActors.push(new Actor('prisoner', 'ally', false));
      this.allyActors.length = allies;
    }
    this.intent = enemy.intent; this.stun = enemy.stun; this.enemyTags = enemy.tags || [];
    this.max.enemy = enemy.maxHp; this.max.player = player.maxHp;
    this.setHud('enemy', enemy.name, enemy.boss ? (enemy.phase2 ? 'ENRAGED' : 'BOSS') : enemy.elite ? 'ELITE' : `SECTOR ${sector}`, enemy.hp);
    this.setHud('player', player.name, `LV ${player.level}`, player.hp);
    this.setStatuses('player', pst);
    this.setStatuses('enemy', est, affix, quirk);
    this.label = label;
    this.bfx = enemy.bs ? { shutter: enemy.bs.shutter, floor: enemy.bs.floor, front: enemy.bs.front, lights: enemy.bs.lights, wreck: enemy.bs.wreck, sig: enemy.sig ? enemy.sig.id : null, left: enemy.sig ? enemy.sig.left : 0 } : null;
    this.crewId = FRONT_CREW[enemy.id] || null;
    if (this.crewId) ensureSheet(this.crewId);
    this.props = propsFor(theme, sector, boss);
    let isNewBoss = false, artWait = null;
    const enter = [], newFight = this.runRef !== run || !this.player || this.enemyRef !== enemy;
    if (this.runRef !== run || !this.player) {
      this.runRef = run;
      const P = this.player = new Actor('player', 'player', false);
      P.ox = -150; P.alpha = 0;
      enter.push(() => this.tween(500, (p) => { P.ox = -150 * (1 - ease(p)); P.alpha = p; }));
    }
    // Co-op: a downed operative stays on the floor until they're back up.
    for (const [a, info] of [[this.player, player], [this.partner, partner]]) {
      if (!a || !info) continue;
      if (info.down && a.anim !== 'death') a.setAnim('death', now - 100000);
      else if (!info.down && a.anim === 'death' && info.hp > 0) a.setAnim('idle', now);
    }
    if (this.enemyRef !== enemy) {
      this.enemyRef = enemy;
      this.hideSay(); this.sayN = enemy.say ? enemy.say.n : 0; this.drop = null; // what was said before a reload stays said
      this.enemy = new Actor(enemy.id, 'enemy', enemy.boss);
      if (this.enemy.sheet) this.enemy.sheet = tintedSheet(enemy.id, theme) || this.enemy.sheet;
      const F = this.enemy;
      F.ox = 140; F.alpha = 0;
      if (enemy.boss) { isNewBoss = true; F.alpha = 0; F.ox = 0; }
      else enter.push(() => { if (this.enemy !== F) return; this.tween(450, (p) => { F.ox = 140 * (1 - ease(p)); F.alpha = p; }); play('door'); if (quirk) setTimeout(() => this.popup('enemy', quirk.toUpperCase(), 'quirk'), 450 / (this.speed || 1)); });
    }
    // Nobody walks on in the wrong art: on a slow connection the fight waits a moment for its sheets.
    if (newFight) artWait = this.holdArt(enemy.id);
    if (artWait) artWait.then(() => enter.forEach((f) => f())); else enter.forEach((f) => f());
    this.enemy.rest = enemy.intent === 'heavy' && !enemy.stun ? 'charge' : 'idle';
    if (this.enemy.anim === 'idle' && this.enemy.rest === 'charge') this.enemy.setAnim('charge', now);
    this.playerShield = false;
    return { isNewBoss, artWait };
  }

  // The barracks ring: both operatives in their own art, the friend across the floor, facing you. No drones, no allies,
  // no boss business. me / foe: { name, build, hp, max }. hp is what the bars show until the round plays.
  syncDuel({ key, me, foe }) {
    if (this.duelKey !== key || !this.enemy || !this.enemy.mirror) {
      this.duelKey = key; this.runRef = null; this.enemyRef = null;
      const P = this.player = new Actor('player', 'player', false);
      const F = this.enemy = new Actor('player', 'partner', false); F.side = 'enemy'; F.mirror = true; F.fixedH = 128;
      Object.assign(this, { partner: null, partnerInfo: null, allies: 0, allyActors: [], drone: null, partnerDrone: null, bfx: null, drop: null, props: [], crewId: null, intent: null, stun: 0, heavyBoost: false, boss: false, theme: 'garrison', sector: 6, enemyTags: [] });
      P.ox = -150; P.alpha = 0; F.ox = 150; F.alpha = 0;
      this.tween(500, (p) => { P.ox = -150 * (1 - ease(p)); P.alpha = p; F.ox = 150 * (1 - ease(p)); F.alpha = p; });
      play('door');
    }
    this.max.enemy = foe.max; this.max.player = me.max;
    if (!this.duelBusy) {
      this.setHud('enemy', foe.name, foe.build.toUpperCase(), foe.hp); this.setHud('player', me.name, me.build.toUpperCase(), me.hp);
      for (const [a, hp] of [[this.player, me.hp], [this.enemy, foe.hp]]) { if (hp <= 0 && a.anim !== 'death') a.setAnim('death', performance.now() - 100000); }
    }
    this.setStatuses('player', {}); this.setStatuses('enemy', {});
    this.label = 'Barracks ring';
  }
  // One round of the ring, both sides' moves in turn. r is the engine's duel.last; me is this screen's fighter index.
  async playDuel(r, me) {
    this.duelBusy = true;
    try {
      const fighters = [this.player, this.enemy], side = (i) => (i === me ? 'player' : 'enemy'), actor = (i) => (i === me ? this.player : this.enemy);
      const hpNow = [...r.pre];
      for (const i of [me, 1 - me]) {
        const A = actor(i), T = actor(1 - i), mv = r.moves[i], f = r.fx[i], build = r.builds[i], now = performance.now();
        if (A.anim === 'death') continue;
        if (mv === 'guard' || (mv === 'special' && build === 'warden')) {
          const c = this.center(A); play('shield');
          this.ring(c.x, c.y, 40, C.ion, 380, 2); this.popup(side(i), mv === 'guard' ? 'GUARD' : 'SECOND WIND', 'info');
          if (f.heal) { hpNow[i] = Math.min(this.max[side(i)], hpNow[i] + f.heal); this.burst(c.x, c.y, 10, C.heal, 0.9, 500, -0.04, 1); play('heal'); this.popup(side(i), `+${f.heal}`, 'heal'); this.setHp(side(i), hpNow[i]); }
          await this.wait(380);
          continue;
        }
        const melee = mv === 'strike' || (mv === 'special' && build === 'bruiser');
        if (melee) {
          play('whoosh');
          await this.meleeIn(A, T);
          const c = this.center(T);
          for (const h of f.hits) { this.ring(c.x, c.y, mv === 'special' ? 34 : 18, h.crit ? C.crit : C.amber, 220, 3); hpNow[1 - i] = Math.max(0, hpNow[1 - i] - h.n); this.setHp(side(1 - i), hpNow[1 - i]); await this.hit(T, h.n, { crit: h.crit, heavy: mv === 'special', note: f.guarded ? '(guard)' : '' }); }
          if (mv === 'special') this.shake(7, 260);
          await this.meleeOut(A);
        } else {
          A.setAnim('attack', now); await this.aim(A);
          for (const h of f.hits) {
            play('shot'); const m = this.muzzle(A); this.burst(m.x, m.y, 6, C.amber, 1.5, 120, 0); this.casing(A);
            await this.bolt(m, this.center(T), h.crit ? C.crit : C.amber, mv === 'special' ? 2 : 3, 150);
            hpNow[1 - i] = Math.max(0, hpNow[1 - i] - h.n); this.setHp(side(1 - i), hpNow[1 - i]);
            await this.hit(T, h.n, { crit: h.crit, note: f.guarded ? '(guard)' : '' });
          }
        }
        if (hpNow[1 - i] <= 0) { T.setAnim('death', performance.now()); play('death'); await this.wait(600); }
        await this.wait(160);
      }
      for (const i of [0, 1]) this.setHp(side(i), r.hp[i]);
      fighters.forEach((a) => { if (a.anim !== 'death') { a.ox = 0; a.oy = 0; } });
    } finally { this.duelBusy = false; }
  }
  leaveDuel() { this.duelKey = null; if (this.enemy && this.enemy.mirror) { this.enemy = null; this.enemyRef = null; this.player = null; } }

  // Late art swaps into the fighters already on the stage, keeping what they are doing.
  refreshArt() {
    const swap = (a, sh) => { if (a && sh && sh !== a.sheet) { a.sheet = sh; a.drawn = null; } };
    swap(this.player, lookSheets.player || sheets.player);
    swap(this.partner, lookSheets.partner || sheets.player);
    if (this.enemy && this.enemy.mirror) swap(this.enemy, lookSheets.partner || sheets.player);
    else if (this.enemy) swap(this.enemy, tintedSheet(this.enemy.id, this.theme));
    for (const al of this.allyActors || []) swap(al, sheets.prisoner);
  }
  artMissing(a) {
    if (a.id !== 'player') return artPending(a.id);
    const look = lookSheets[a.side === 'partner' ? 'partner' : 'player'];
    return !(look && look.hd) && (artPending('op_m') || artPending('op_f'));
  }
  // Holds the fight on a "loading" line until its art is in. Each fighter has one allowance of about four seconds, so a
  // file that won't load delays only the first fight it matters to; after that the stand-in shows and the real art swaps in if it comes.
  holdArt(enemyId) {
    const fighters = () => [this.player, this.partner, this.enemy].filter(Boolean), missing = () => fighters().filter((a) => this.artMissing(a));
    const now = performance.now(), left = missing().map((a) => { const k = a.id === 'player' ? 'player' : enemyId; if (this.holdSince[k] === undefined) this.holdSince[k] = now; return ART_HOLD_MS - (now - this.holdSince[k]); });
    if (!left.length || Math.max(...left) <= 0) return null;
    if (this.holding) return this.holding;
    const note = this.el.querySelector('.art-wait');
    this.artHold = true; note.hidden = false;
    return (this.holding = new Promise((done) => {
      let timer = 0;
      const finish = () => { artWaiters.delete(check); clearTimeout(timer); this.artHold = false; this.holding = null; note.hidden = true; done(); };
      const check = () => { if (!missing().length) finish(); };
      artWaiters.add(check);
      timer = setTimeout(finish, Math.max(...left));
    }));
  }

  setStatuses(side, st = {}, affix = null, quirk = null) {
    const el = this.hud[side].querySelector('.hud-st');
    const names = { bleed: 'BLEED', burn: 'BURN', shaken: 'SHAKEN', exposed: 'EXPOSED', pinned: 'PINNED' };
    el.innerHTML = (quirk ? `<i class="st quirk" data-st="quirk">${quirk.toUpperCase()}</i>` : '') + (affix ? `<i class="st affix" data-st="affix">${affix.toUpperCase()}</i>` : '') +
      Object.entries(st).filter(([, n]) => n > 0).map(([k, n]) => `<i class="st st-${k}" data-st="${k}">${names[k] || k} ${n}</i>`).join('');
  }

  // A boss seen already (a reload mid-fight, say) just stands there.
  showBoss() { const E = this.enemy; if (E) { E.alpha = 1; E.ox = 0; E.oy = 0; } }
  // Cinematic boss entrance: letterbox, silhouette slam, reveal in close-up, name card, a line of dialogue. Tap skips.
  // lines: beats shown one after another (a first meeting has several). A tap moves to the next beat, and on the last one closes the card. onFull: the last beat was reached.
  bossIntro({ name, epithet, label, line, lines, onFull }) {
    const E = this.enemy, cine = this.el.querySelector('.cine'), beats = lines && lines.length ? lines : [line || ''];
    if (!E) return Promise.resolve();
    if (this.skip) { E.alpha = 1; E.ox = 0; return Promise.resolve(); }
    this.hideSay();
    return new Promise((done) => {
      let finished = false, beat = -1, beatTimer = 0, closing = false;
      const timers = [];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms / this.speed));
      const live = (fn) => (p) => { if (!finished) fn(p); };
      const finish = () => {
        if (finished) return; finished = true;
        timers.forEach(clearTimeout); clearTimeout(beatTimer);
        cine.hidden = true; cine.className = 'cine';
        this.dim = 0; this.zoom = null; E.alpha = 1; E.ox = 0; E.oy = 0; E.flash = 0;
        this.el.removeEventListener('click', tap);
        done();
      };
      const close = () => {
        if (closing || finished) return; closing = true;
        if (reduceMotion) { finish(); return; }
        cine.classList.add('out');
        const k0 = this.zoom ? this.zoom.k : 1;
        this.tween(380, live((p) => { const e = ease(p); if (this.zoom) this.zoom.k = k0 + (1 - k0) * e; this.dim = 0.3 * (1 - p); }));
        at(400, finish);
      };
      // Long enough to read at phone size. One line keeps the old timing.
      const hold = (text) => (beats.length === 1 ? (reduceMotion ? 2600 : 1800) : Math.max(2400, 46 * text.length));
      const showBeat = (i) => {
        beat = i;
        clearTimeout(beatTimer);
        cine.querySelector('.cine-line').textContent = beats[i];
        cine.classList.add('say');
        if (i === beats.length - 1 && onFull) onFull();
        beatTimer = setTimeout(() => { if (i < beats.length - 1) showBeat(i + 1); else close(); }, hold(beats[i]) / this.speed);
      };
      const tap = () => { if (beats.length > 1 && beat < beats.length - 1) showBeat(beat + 1); else finish(); };
      cine.querySelector('.cine-label').textContent = label;
      cine.querySelector('.cine-name').textContent = name;
      cine.querySelector('.cine-epithet').textContent = epithet || '';
      cine.querySelector('.cine-line').textContent = beats.length > 1 ? '' : beats[0];
      cine.querySelector('.cine-skip').textContent = beats.length > 1 ? 'Tap for next' : 'Tap to skip';
      cine.hidden = false; cine.className = 'cine';
      void cine.offsetWidth;
      cine.classList.add('on');
      play('bossSting');
      setTimeout(() => { if (!finished) this.el.addEventListener('click', tap); }, 250);
      E.alpha = 1; E.ox = 0;
      // Reduced motion: no slam, flash or push-in, just the card, long enough to read.
      if (reduceMotion) {
        E.oy = 0; this.dim = 0.25;
        cine.classList.add('card');
        showBeat(0);
        return;
      }
      // A close-up on the head: zoom about a point that puts the face right of centre, clear of the card.
      const a = this.anchor('enemy', E), hx = a.x, hy = a.y - E.tall * 0.82, K = 2.1;
      // Above the frame by up to 20 stage pixels is fine: the letterbox hides what the zoom leaves bare at the top.
      const px = Math.max(0, Math.min(W, (W * 0.68 - K * hx) / (1 - K))), py = Math.max(-20, Math.min(H, (H * 0.4 - K * hy) / (1 - K)));
      this.zoom = { x: px, y: py, k: 1.5 };
      this.dim = 0.8;
      E.oy = -50;
      this.flash(E, '#000000', 1100);
      this.tween(380, live((p) => { E.oy = -50 * (1 - p * p); }));
      at(380, () => { this.shake(7, 450); const c = this.center(E); this.burst(c.x, c.y + 40, 26, '#8b949c', 2.5, 700, 0.02, 3); });
      at(1000, () => {
        this.flash(E, '#ffffff', 130); this.screenFlash('#ffffff', 0.3, 110);
        this.tween(450, live((p) => { this.dim = 0.8 * (1 - p) + 0.3 * p; }));
        this.tween(2250, live((p) => { if (this.zoom) this.zoom.k = 1.5 + 0.6 * ease(p); }));
      });
      at(1100, () => { cine.classList.add('card'); play('bossName'); });
      at(1500, () => { if (beat < 0) showBeat(0); });
    });
  }

  // A boss's line in the fight. It sits over the bottom of the stage, takes no taps and holds nothing up: the turn carries on underneath.
  speak({ text, kind = 'boss', note = '', n = 0 }) {
    const el = this.el.querySelector('.bsay');
    if (!el || !text) return;
    if (n) this.sayN = n;
    el.querySelector('.bsay-text').textContent = text;
    const nt = el.querySelector('.bsay-note'); nt.textContent = note || ''; nt.hidden = !note;
    el.className = `bsay ${kind === 'narration' ? 'narration' : ''}`;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.hideSay(), Math.max(3000, 60 * (text.length + (note || '').length)));
  }
  hideSay() { clearTimeout(this.sayTimer); const el = this.el.querySelector('.bsay'); if (el) { el.hidden = true; el.classList.remove('on'); } }
  // The move's own animation when its art exists, otherwise the nearest thing the sheet has.
  sigAnim(actor, n) { const a = (actor.sheet && actor.sheet.anims) || {}; return a[`sig${n}`] ? `sig${n}` : a.special ? 'special' : 'attack'; }

  setHud(side, name, tag, hp) {
    const h = this.hud[side];
    const nm = h.querySelector('.hud-name'); nm.textContent = name; nm.classList.remove('xlong'); nm.classList.toggle('long', name.length > 16);
    h.dataset.tip = name;
    if (phoneView()) {
      // A phone has one line for it: smaller first, and only then do the leading words go (the quirk, then the variant). Tapping shows the whole name.
      nm.classList.remove('long');
      const over = () => nm.scrollWidth > nm.clientWidth;
      if (over()) nm.classList.add('long');
      if (over()) nm.classList.add('xlong');
      for (let words = name.split(' '); over() && words.length > 1;) { words.shift(); nm.textContent = words.join(' '); }
    }
    h.querySelector('.hud-tag').textContent = tag;
    this.setHp(side, hp);
  }
  setHp(side, hp) {
    const h = this.hud[side], max = this.max[side], v = Math.max(0, hp);
    h.querySelector('.hud-hp').textContent = side === 'player' ? `${v} / ${max}` : `${v} / ${max}`;
    const bar = h.querySelector('.bar');
    bar.querySelector('i').style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
    bar.classList.toggle('low', v / max < 0.3);
  }

  popup(side, text, cls = '') {
    if (this.skip) return;
    const el = document.createElement('span');
    el.className = `pop ${cls}`;
    el.textContent = text;
    const [x, y] = side === 'enemy' ? [75, 22] : side === 'partner' ? [10, 48] : [26, 52];
    // Several at once from one side stack up instead of printing over each other.
    const at = performance.now(), last = this.popAt[side], n = last && at - last.t < 700 ? last.n + 1 : 0;
    this.popAt[side] = { t: at, n };
    el.style.left = `${x + (Math.random() * 8 - 4)}%`; el.style.top = `${Math.max(3, y + (Math.random() * 4 - 2) + [0, 13, -13, 26, -26][n % 5])}%`;
    // A number has to be readable, so 2x doesn't cut it quite in half. The longer crit keeps its hold.
    const life = (cls.includes('crit') ? 1250 : 1050) / Math.max(1, (this.speed || 1) * 0.8);
    el.style.animationDuration = `${life}ms`;
    if (cls.includes('crit')) el.style.setProperty('--tilt', `${Math.random() < 0.5 ? -5 : 5}deg`);
    this.pops.append(el);
    while (this.pops.childElementCount > 10) this.pops.firstElementChild.remove();
    setTimeout(() => el.remove(), life + 60);
  }

  shake(mag, ms) {
    if (reduceMotion || this.skip) return;
    const t = performance.now();
    if (t < this.shakeUntil && mag < this.shakeMag * ((this.shakeUntil - t) / this.shakeLen)) return; // a small hit doesn't cut a big shake short
    this.shakeMag = mag; this.shakeLen = ms / this.speed; this.shakeUntil = t + this.shakeLen; this.fxCount.shakes++;
  }
  // The whole stage holds still for a moment on a big hit. Each playback has a budget, so a run of crits can't drag a turn.
  hitStop(ms) {
    if (reduceMotion || this.skip) return;
    const d = Math.min(ms / this.speed, this.stopBudget);
    if (d < 10) return;
    const t = performance.now();
    this.stopBudget -= d; this.fxCount.stops++;
    if (t < this.stopUntil) this.stopUntil += d;
    else { this.stopAt = t; this.stopUntil = t + d; }
  }
  // Time stood still, so everything in flight picks up where it was.
  endStop() {
    const at = this.stopAt, until = this.stopUntil, d = until - at;
    for (const tw of this.tweens) tw.start = tw.start <= at ? tw.start + d : until;
    for (const b of this.bolts) b.born = b.born <= at ? b.born + d : until;
    for (const r of this.rings) r.born = r.born <= at ? r.born + d : until;
    for (const pt of this.particles) pt.born = pt.born <= at ? pt.born + d : until;
    for (const a of [this.enemy, this.player, this.partner, ...(this.allyActors || [])]) if (a) { a.animStart += d; if (a.flash > at) a.flash += d; }
    this.stopAt = 0; this.stopUntil = 0;
  }
  screenFlash(color, alpha, ms) {
    if (reduceMotion || this.skip) return;
    this.frameFlash = { color, alpha, until: performance.now() + ms, ms }; this.fxCount.screenFlashes++;
  }
  burst(x, y, n, color, spd = 2, life = 350, grav = 0.05, size = 1) {
    if (this.skip) return;
    n = Math.min(n, MAX_PARTICLES - this.particles.length);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, life: life * (0.6 + Math.random() * 0.6), born: performance.now(), color, g: grav, size });
    }
  }
  ring(x, y, r1, color, ms = 400, w = 2) { if (!this.skip) this.rings.push({ x, y, r1, color, born: performance.now(), life: ms / this.speed, w }); }
  bolt(from, to, color, w = 2, ms = 170) {
    if (this.skip) return Promise.resolve();
    const b = { from, to, color, w, born: performance.now(), dur: ms / this.speed };
    this.bolts.push(b);
    return this.wait(ms);
  }
  flash(actor, color = '#ffffff', ms = 140) { if (reduceMotion) return; actor.flashColor = color; actor.flash = performance.now() + ms / (this.skip ? 1 : this.speed); this.fxCount.flashes++; }
  // Debris thrown back off a hit: dir is the way the shot was travelling, and most of it comes back towards the shooter.
  spray(x, y, dir, n, colors, spd, life, grav, size) {
    if (this.skip) return;
    n = Math.min(n, MAX_PARTICLES - this.particles.length);
    const born = performance.now();
    for (let i = 0; i < n; i++) {
      const v = spd * (0.35 + Math.random());
      this.particles.push({ x, y, vx: (Math.random() < 0.72 ? -dir : dir) * v * (0.3 + Math.random() * 0.7), vy: -v * (0.2 + Math.random() * 0.8), life: life * (0.6 + Math.random() * 0.7), born, color: colors[i % colors.length], g: grav, size });
    }
  }
  // What a hit looks like depends on what got hit: sparks and metal flecks off droids and armour, small dark specks off people and beasts.
  impact(actor, { crit = false, heavy = false, small = false } = {}) {
    const c = this.center(actor), dir = actor.side === 'enemy' ? 1 : -1, k = crit ? 1.9 : heavy ? 1.4 : small ? 0.5 : 1;
    const tags = actor.side === 'enemy' ? this.enemyTags : [], metal = tags.includes('droid') || tags.includes('armored');
    const x = c.x + (Math.random() * 14 - 7) - dir * 4, y = c.y - actor.tall * 0.08 + (Math.random() * 16 - 8);
    if (metal) {
      this.fxCount.metal++;
      this.spray(x, y, dir, Math.round(9 * k), [C.spark, '#fff1c9', C.amber], 3.2, 300, 0.13, 2);
      this.spray(x, y, dir, Math.round(4 * k), FLECK, 2.2, 600, 0.17, 3);
    } else {
      this.fxCount.flesh++;
      this.spray(x, y, dir, Math.round(7 * k), BLOOD, 2.2, 460, 0.15, 2);
      this.spray(x, y, dir, Math.round(2 * k), BLOOD, 1.5, 520, 0.17, 3);
    }
  }
  // A spent case kicked out of the breech, back and up. It tumbles, drops and bounces once on the floor.
  casing(actor, kind = 'brass') {
    if (this.skip || this.particles.length >= MAX_PARTICLES) return;
    const m = this.muzzle(actor), dir = actor.side === 'enemy' ? -1 : 1, a = this.anchor(actor.side, actor);
    this.particles.push({ kind: 'casing', x: m.x - dir * Math.max(8, actor.tall * 0.1), y: m.y + 8, vx: -dir * (0.7 + Math.random() * 0.9), vy: -1.1 - Math.random() * 0.9, g: 0.17, floor: a.y + actor.oy - 4 - Math.random() * 6, life: 950, born: performance.now(), color: kind === 'shell' ? '#b5402e' : '#d8b04a', size: kind === 'shell' ? 1.4 : 1, bounced: 0 });
    this.fxCount.casings++;
    play('casing');
  }

  async hit(actor, dmg, { crit = false, note = '', heavy = false } = {}) {
    const dir = actor.side === 'enemy' ? 1 : -1, big = heavy || dmg >= (this.max[actor.side === 'enemy' ? 'enemy' : 'player'] || 1) * 0.25;
    play(crit ? 'crit' : big ? 'heavy' : actor.side === 'player' ? 'hurt' : 'hit');
    actor.setAnim('hit', performance.now());
    this.flash(actor, '#ffffff', crit ? 190 : 140);
    this.impact(actor, { crit, heavy: big });
    if (crit) {
      const c = this.center(actor);
      this.ring(c.x, c.y, 44, C.crit, 240, 3);
      this.burst(c.x, c.y, 12, C.crit, 3.2, 300, 0.05);
      this.hitStop(80); this.shake(8, 340); this.screenFlash('#fff1c9', 0.24, 95);
    } else if (big) { this.hitStop(50); this.shake(4, 230); }
    if (!dmg && actor.side === 'enemy') { this.popup('enemy', 'Missed', 'info'); return; }
    this.popup(actor.side, `\u2212${dmg}${note ? ` ${note}` : ''}`, crit ? 'crit' : big ? 'heavy' : '');
    if (crit) this.popup(actor.side, 'CRITICAL', 'tag');
    const x0 = actor.ox, kick = crit ? 12 : big ? 9 : 7;
    await this.move(actor, x0 + kick * dir, actor.oy - 2, 70);
    await this.move(actor, x0, actor.oy + 2, 140);
  }

  // After the last blow on an operative: the fall holds while the picture drains. A tap anywhere moves on.
  fallHold(ms = 1200) {
    if (reduceMotion) return Promise.resolve();
    return new Promise((done) => {
      this.el.classList.add('fallen');
      let timer = 0;
      const end = () => { clearTimeout(timer); document.removeEventListener('click', end, true); this.el.classList.remove('fallen'); done(); };
      timer = setTimeout(end, ms);
      document.addEventListener('click', end, true);
    });
  }

  // ---------- turn playback ----------
  async play(events) {
    this.stopBudget = 100; // ms of hit-stop this whole playback may add, however many crits land
    for (const ev of events) {
      if (!this.skip) await this.handle(ev);
      else this.apply(ev);
      await this.wait(110);
    }
    this.playerShield = false;
    // Whatever happened, anyone who hasn't left or fallen is standing there, visible.
    const gone = events.some((ev) => ((ev.type === 'smoke' || ev.type === 'run') && ev.ok !== false) || ev.type === 'down');
    if (!gone) for (const a of [this.player, this.partner]) if (a && a.alpha < 1) { a.alpha = 1; a.ox = 0; }
    if (this.player && this.player.alpha > 0) { this.player.oy = 0; }
  }
  apply(ev) { this.setHp('enemy', ev.ehp); this.setHp('player', ev.php); }

  async handle(ev) {
    // In co-op, events tagged with the friend's index animate the friend's sprite.
    const P = this.partner && this.partnerInfo && ev.actor === this.partnerInfo.idx ? this.partner : this.player, E = this.enemy, now = () => performance.now();
    if (ev.type === 'downed') { P.setAnim('death', now()); play('hurt'); this.popup(P === this.partner ? 'partner' : 'player', 'DOWN', 'crit'); await this.wait(500); return; }
    if (ev.type === 'revived') { P.setAnim('idle', now()); play('heal'); this.popup(P === this.partner ? 'partner' : 'player', 'Back up', 'info'); await this.wait(350); return; }
    if (ev.type === 'handoff' || ev.type === 'target') { if (ev.type === 'target' && this.partnerInfo) this.popup(ev.actor === this.partnerInfo.idx ? 'partner' : 'player', 'Targeted', 'info'); return; }
    const START = { 'player:shoot': 'shot', 'player:burst': 'burst', 'player:blast': 'blast', 'player:smash': 'whoosh', 'player:strike': 'whoosh', 'player:overload': 'zap',
      'player:intimidate': 'status', 'player:defend': 'shield', 'player:stim': 'heal', 'player:thermal': 'throw', 'player:ion': 'zap',
      'player:smoke': 'smoke', 'player:run': 'whoosh', 'player:levelup': 'levelup', 'player:down': 'death', 'ally:shoot': 'shot',
      'enemy:repair': 'repair', 'enemy:down': 'enemyDown', 'enemy:flee': 'whoosh', 'enemy:stunned': 'zap', 'env:vent': 'vent', 'env:sniper': 'sniper',
      'enemy:phase': 'enrage', 'player:deadman': 'heal', 'env:explode': 'explosion' };
    const k = `${ev.who}:${ev.type}`;
    if (START[k]) play(START[k]);
    if (k === 'enemy:attack' || k === 'enemy:heavy') play(ev.type === 'heavy' ? 'heavyCharge' : MELEE.has(E.id) ? 'whoosh' : 'enemyShot');
    switch (`${ev.who}:${ev.type}`) {
      case 'player:shoot': {
        P.setAnim(ev.skill === 'pickcard' && P.sheet && P.sheet.anims.special ? 'special' : 'attack', now());
        await this.aim(P);
        await this.move(P, 6, -4, 70);
        const m = this.muzzle(P);
        this.burst(m.x, m.y, 6, C.amber, 1.5, 120, 0);
        this.casing(P);
        await this.bolt(m, this.center(E), ev.crit ? C.crit : C.amber, ev.ready ? 3 : 2, 170);
        this.move(P, 0, 0, 140);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit, note: ev.guarded ? '(cover)' : '' });
        break;
      }
      case 'player:burst': {
        P.setAnim('attack', now());
        await this.aim(P);
        await this.move(P, 5, -3, 60);
        for (const h of ev.hits) {
          const m = this.muzzle(P), c = this.center(E);
          this.burst(m.x, m.y, 4, C.amber, 1.2, 100, 0);
          this.casing(P);
          await this.bolt(m, { x: c.x + (Math.random() * 16 - 8), y: c.y + (Math.random() * 16 - 8) }, ev.suppress ? C.ion : C.amber, 2, 120);
          this.flash(E); this.impact(E, { crit: h.crit, small: !h.crit });
          if (h.crit) { play('crit'); this.hitStop(50); this.shake(6, 220); this.screenFlash('#fff1c9', 0.18, 80); }
          this.popup('enemy', h.dmg ? `\u2212${h.dmg}` : 'Missed', h.crit ? 'crit' : h.dmg ? '' : 'info');
        }
        this.setHp('enemy', ev.ehp);
        this.move(P, 0, 0, 120);
        if (ev.suppress) this.popup('enemy', 'Pinned', 'info');
        await this.wait(200);
        break;
      }
      case 'player:blast': {
        P.setAnim('attack', now());
        await this.aim(P);
        await this.move(P, 6, -4, 70);
        const m = this.muzzle(P), c = this.center(E);
        this.burst(m.x, m.y, 10, C.amber, 2, 140, 0);
        this.casing(P, 'shell');
        for (let i = 0; i < 5; i++) this.bolt(m, { x: c.x + (i - 2) * 9, y: c.y + (Math.random() * 20 - 10) }, C.amber, 1, 150);
        await this.wait(150);
        this.shake(3, 180);
        this.move(P, -4, 0, 140);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit });
        this.move(P, 0, 0, 120);
        break;
      }
      case 'player:smash': {
        P.setAnim(ev.skill === 'overhaul' && P.sheet && P.sheet.anims.special ? 'special' : P.sheet && P.sheet.anims.attackM ? 'attackM' : 'attack', now());
        await this.move(P, 150, -70, 200);
        const c = this.center(E);
        this.ring(c.x, c.y, 34, C.amber, 260, 3);
        this.shake(5, 240);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit, heavy: true });
        await this.move(P, 0, 0, 260);
        break;
      }
      case 'player:strike': {
        await this.meleeIn(P, E);
        const c = this.center(E);
        this.ring(c.x, c.y, 18, ev.crit ? C.crit : C.amber, 180, 2);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { crit: ev.crit });
        await this.meleeOut(P);
        break;
      }
      case 'enemy:counter': {
        E.setAnim('attack', now());
        this.flash(E, C.red, 180);
        this.popup('enemy', ev.text, 'quirk');
        this.setHp('player', ev.php);
        if (ev.dmg) await this.hit(P, ev.dmg, {});
        else { this.flash(P); await this.wait(200); }
        for (const k of ev.statuses || []) this.popup('player', k.toUpperCase(), `st-${k}`);
        await this.wait(150);
        break;
      }
      case 'player:overload': {
        const from = this.muzzle(P), to = this.center(E);
        this.burst(from.x, from.y, 12, C.ion, 1.5, 200, 0);
        for (let k = 0; k < 3; k++) {
          const pts = [from];
          for (let i = 1; i < 6; i++) pts.push({ x: from.x + ((to.x - from.x) * i) / 6 + (Math.random() * 14 - 7), y: from.y + ((to.y - from.y) * i) / 6 + (Math.random() * 14 - 7) });
          pts.push(to);
          for (let i = 0; i < pts.length - 1; i++) this.bolt(pts[i], pts[i + 1], C.ion, 2, 60 + i * 10);
          await this.wait(70);
        }
        this.ring(to.x, to.y, 36, C.ion, 380, 2);
        this.flash(E, C.ion, 250);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { heavy: true });
        if (ev.droid) this.popup('enemy', 'Stunned', 'ion');
        break;
      }
      case 'player:intimidate': {
        const c = this.center(P);
        this.ring(c.x + 30, c.y - 20, 50, C.amber, 400, 2);
        this.popup('player', '\u201CRun.\u201D', 'level');
        await this.wait(350);
        if (!ev.ok) { this.popup('enemy', 'Shaken \u221225% ATK', 'info'); await this.move(E, 6, 0, 100); await this.move(E, 0, 0, 120); }
        break;
      }
      case 'drone:shoot': {
        const info = P === this.partner ? this.partnerDrone : this.drone, from = this.dronePos(P, info), c = this.center(E);
        await this.droneMove(P);
        play('shot');
        await this.bolt(from, c, C.red, 1, 120);
        this.impact(E, { small: true });
        this.popup('enemy', `\u2212${ev.dmg}`, '');
        this.setHp('enemy', ev.ehp);
        break;
      }
      case 'drone:heal': {
        const info = P === this.partner ? this.partnerDrone : this.drone, from = this.dronePos(P, info), c = this.center(P);
        await this.droneMove(P);
        await this.bolt(from, c, C.heal, 1, 100);
        this.burst(c.x, c.y, 4, C.heal, 0.8, 500, -0.04, 1);
        if (P !== this.partner) this.setHp('player', ev.php);
        this.popup(P === this.partner ? 'partner' : 'player', `+${ev.amt}`, 'heal');
        break;
      }
      case 'drone:block': {
        const info = P === this.partner ? this.partnerDrone : this.drone, from = this.dronePos(P, info), c = this.center(P);
        await this.droneMove(P);
        play('shield');
        this.burst(c.x, c.y, 12, C.ion, 1.8, 350);
        this.popup(P === this.partner ? 'partner' : 'player', 'Intercepted', 'info');
        if (ev.dmg) { const ec = this.center(E); await this.bolt(from, ec, C.ion, 1, 120); this.popup('enemy', `\u2212${ev.dmg}`, ''); this.setHp('enemy', ev.ehp); }
        await this.wait(200);
        break;
      }
      case 'drone:item': {
        const info = P === this.partner ? this.partnerDrone : this.drone, from = this.dronePos(P, info), c = this.center(ev.item === 'stim' ? P : E);
        await this.droneMove(P);
        play(ev.item === 'stim' ? 'heal' : ev.item === 'ion' ? 'zap' : 'throw');
        await this.bolt(from, c, ev.item === 'stim' ? C.heal : ev.item === 'ion' ? C.ion : C.amber, 2, 220);
        this.burst(c.x, c.y, ev.item === 'thermal' ? 18 : 8, ev.item === 'stim' ? C.heal : ev.item === 'ion' ? C.ion : C.amber, 2, 420);
        if (ev.item === 'stim') { if (P !== this.partner) this.setHp('player', ev.php); this.popup(P === this.partner ? 'partner' : 'player', `+${ev.amt}`, 'heal'); }
        else { if (ev.dmg) { this.popup('enemy', `\u2212${ev.dmg}`, 'crit'); this.flash(E); } else this.popup('enemy', 'Stunned', 'info'); this.setHp('enemy', ev.ehp); }
        await this.wait(200);
        break;
      }
      case 'ally:shoot': {
        const from = { x: 20 + Math.random() * 20, y: 150 }, c = this.center(E);
        const ally = (this.allyActors || [])[Math.floor(Math.random() * (this.allyActors || []).length)];
        if (ally) ally.setAnim('attack', now());
        this.burst(from.x, from.y, 4, C.amber, 1, 100, 0);
        await this.bolt(from, c, C.amber, 1, 160);
        this.flash(E); this.impact(E, { small: true });
        this.popup('enemy', `\u2212${ev.dmg}`, '');
        this.setHp('enemy', ev.ehp);
        await this.wait(120);
        break;
      }
      case 'env:vent': {
        this.popup('player', 'Vent!', 'heavy');
        for (let i = 0; i < 26; i++) setTimeout(() => this.burst(Math.random() * W, 130 + Math.random() * 80, 2, i % 3 ? '#c9c2b6' : '#ff8a3c', 0.8, 900, -0.05, 5), i * 18);
        this.shake(4, 400);
        await this.wait(300);
        if (ev.pdmg) { this.flash(P, '#ff8a3c', 250); this.popup('player', `\u2212${ev.pdmg}`, 'heavy'); } else this.popup('player', 'Behind cover', 'info');
        if (ev.edmg) { this.flash(E, '#ff8a3c', 250); this.popup('enemy', `\u2212${ev.edmg}`, 'heavy'); }
        this.setHp('player', ev.php); this.setHp('enemy', ev.ehp);
        await this.wait(450);
        break;
      }
      case 'env:sniper': {
        const target = this.center(P);
        await this.bolt({ x: W * 0.72, y: 0 }, target, C.red, 1, 140);
        if (ev.dmg) { this.flash(P, C.red, 150); this.impact(P, { heavy: true }); this.popup('player', `\u2212${ev.dmg} sniper`, 'heavy'); }
        else { this.burst(target.x + 20, target.y, 8, C.spark, 1.5); this.popup('player', 'Sniper missed', 'info'); }
        this.setHp('player', ev.php);
        await this.wait(300);
        break;
      }
      case 'enemy:quirk':
        play('status');
        this.flash(E, '#e6d36a', 250);
        this.popup('enemy', ev.text, 'quirk');
        await this.move(E, 6, -4, 120); await this.move(E, 0, 0, 160);
        await this.wait(250);
        break;
      case 'enemy:flee':
        this.popup('enemy', 'Fled!', 'info');
        await this.tween(500, (p) => { E.ox = 160 * ease(p); E.alpha = 1 - p; });
        break;
      case 'player:defend':
        P.setAnim('defend', now());
        this.playerShield = true;
        this.popup('player', 'Steady aim +50%', 'info');
        await this.move(P, -4, 8, 160);
        break;
      case 'player:stim': {
        const c = this.center(P);
        for (let i = 0; i < 14; i++) setTimeout(() => this.burst(c.x + (Math.random() * 40 - 20), c.y + 20, 1, C.heal, 0.8, 700, -0.04, 2), i * 30);
        this.flash(P, C.heal, 300);
        this.setHp('player', ev.php);
        this.popup('player', `+${ev.amt}`, 'heal');
        if (ev.adrenal) this.popup('player', 'Adrenal pump', 'info');
        await this.wait(450);
        break;
      }
      case 'player:thermal': {
        P.setAnim('attack', now());
        const from = this.muzzle(P), to = this.center(E);
        const pr = { x: from.x, y: from.y };
        this.projectiles.push(pr);
        await this.tween(420, (p) => { pr.x = from.x + (to.x - from.x) * p; pr.y = from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 50; });
        this.projectiles.splice(this.projectiles.indexOf(pr), 1);
        this.ring(to.x, to.y, 46, C.amber, 380, 3);
        play('explosion');
        this.burst(to.x, to.y, 40, C.amber, 3.5, 500, 0.06, 2);
        this.burst(to.x, to.y, 16, C.smoke, 1.2, 800, -0.01, 3);
        this.shake(6, 350);
        this.setHp('enemy', ev.ehp);
        await this.hit(E, ev.dmg, { heavy: true });
        break;
      }
      case 'player:ion': {
        const c = this.center(E);
        this.ring(c.x, c.y, 40, C.ion, 450, 2);
        setTimeout(() => this.ring(c.x, c.y, 28, C.ion, 350, 1), 120);
        this.burst(c.x, c.y, 20, C.ion, 2.5, 450, 0);
        this.flash(E, C.ion, 250);
        if (ev.dmg) { this.setHp('enemy', ev.ehp); await this.hit(E, ev.dmg, { note: '' }); }
        this.popup('enemy', 'Stunned', 'ion');
        await this.wait(350);
        break;
      }
      case 'player:smoke': {
        const c = this.center(P);
        for (let i = 0; i < 6; i++) setTimeout(() => this.burst(c.x + (Math.random() * 80 - 40), c.y + 20, 4, C.smoke, 0.7, 1100, -0.02, 6), i * 70);
        await this.wait(300);
        // Only a clean getaway hides the operative. If they're still spotted, they stay put.
        if (ev.ok !== false) await this.tween(500, (p) => { P.alpha = 1 - p; });
        else { await this.wait(350); this.popup(P === this.partner ? 'partner' : 'player', 'Still spotted!', 'info'); await this.wait(250); }
        break;
      }
      case 'player:run':
        if (ev.ok) { await this.tween(450, (p) => { P.ox = -140 * ease(p); P.alpha = 1 - p; }); }
        else { await this.move(P, -28, 4, 140); this.popup('player', 'Cut off!', 'info'); await this.move(P, 0, 0, 200); }
        break;
      case 'player:levelup':
        this.flash(P, '#f1d98a', 400);
        this.popup('player', `LEVEL ${ev.level}`, 'level');
        await this.wait(400);
        break;
      case 'player:down':
        P.setAnim('death', now());
        this.flash(P, C.red, 300);
        this.shake(5, 300);
        // The fall stays on screen. Art without a fall animation fades as it always did.
        await this.tween(800, (p) => { if (P.sheet && P.sheet.anims.death) P.oy = 4 * ease(p); else { P.oy = 30 * ease(p); P.alpha = 1 - p; } });
        break;

      case 'enemy:attack':
      case 'enemy:heavy': {
        const heavy = ev.type === 'heavy';
        if (heavy) { this.heavyBoost = true; this.flash(E, C.red, 250); await this.wait(380); }
        if (MELEE.has(E.id)) {
          await this.meleeIn(E, P);
        } else {
          E.setAnim('attack', now());
          await this.aim(E);
          const m = this.muzzle(E), target = ev.ally ? { x: 30, y: 160 } : this.center(P);
          this.burst(m.x, m.y, 6, C.red, 1.5, 120, 0);
          if (!this.enemyTags.includes('droid')) this.casing(E);
          if (heavy) { this.bolt(m, target, C.red, 4, 200); await this.wait(70); this.bolt(m, { x: target.x + 8, y: target.y - 6 }, C.red, 2, 200); await this.wait(130); }
          else await this.bolt(m, target, C.red, 2, 190);
        }
        this.heavyBoost = false;
        if (ev.ally) {
          // It takes a few hits to put a prisoner down: only the last one removes them.
          this.popup('player', ev.allyDown ? 'Ally down' : 'Ally hit', ev.allyDown ? 'heavy' : 'info');
          this.burst(30, 160, ev.allyDown ? 14 : 6, C.red, 2, 400);
          if (ev.allyDown) {
            this.allies = Math.max(0, this.allies - 1);
            if (this.allyActors && this.allyActors.length) this.allyActors.pop();
          }
        } else if (ev.dodged) {
          const x0 = P.ox;
          this.popup(ev.missed ? 'enemy' : 'player', ev.missed ? 'Missed!' : 'Dodged', ev.missed ? 'quirk' : 'info'); play('dodge');
          await this.move(P, x0 - 16, 0, 90); await this.move(P, x0, 0, 160);
        } else {
          if (ev.blocked) { const c = this.center(P); this.ring(c.x + 18, c.y - 10, 30, C.ion, 260, 2); play('block'); }
          this.setHp('player', ev.php);
          await this.hit(P, ev.dmg, { heavy, note: ev.blocked ? '(blocked)' : '' });
        }
        if (MELEE.has(E.id)) await this.meleeOut(E);
        break;
      }
      case 'enemy:stunned': {
        const c = this.center(E);
        this.burst(c.x, c.y - 20, 8, C.ion, 1, 400, 0);
        this.popup('enemy', 'Stunned', 'ion');
        await this.wait(350);
        break;
      }
      case 'enemy:guard':
        this.popup('enemy', 'Holds cover', 'info');
        await this.wait(300);
        break;
      case 'enemy:repair': {
        const c = this.center(E);
        E.setAnim('repair', now());
        this.burst(c.x, c.y, 14, C.ion, 1.5, 500, 0);
        this.flash(E, C.heal, 300);
        this.setHp('enemy', ev.ehp);
        this.popup('enemy', `+${ev.amt}`, 'heal');
        await this.wait(450);
        break;
      }
      case 'enemy:special': {
        const col = (ev.statuses || []).includes('burn') ? '#ff8a3c' : (ev.statuses || []).includes('bleed') ? C.red : '#e6d36a';
        this.flash(E, col, 300);
        this.popup('enemy', ev.name, 'info');
        play('heavyCharge');
        await this.wait(380);
        if (!MELEE.has(E.id)) { E.setAnim(E.sheet && E.sheet.anims.special ? 'special' : 'attack', now()); await this.aim(E); }
        if (MELEE.has(E.id)) { play('whoosh'); await this.meleeIn(E, P); if (E.sheet && E.sheet.anims.special) { E.setAnim('special', now()); } }
        else { const m = this.muzzle(E); play('enemyShot'); this.burst(m.x, m.y, 8, col, 1.5, 150, 0); await this.bolt(m, this.center(P), col, 3, 200); }
        if (ev.blocked) { const c = this.center(P); this.ring(c.x + 18, c.y - 10, 30, C.ion, 260, 2); play('block'); this.popup('player', 'Blocked', 'info'); }
        if (ev.dmg) { this.setHp('player', ev.php); await this.hit(P, ev.dmg, { note: ev.blocked ? '(blocked)' : '' }); }
        for (const st of ev.statuses || []) { play('status'); this.popup('player', st.toUpperCase(), `st-${st}`); this.flash(P, col, 300); }
        if (MELEE.has(E.id)) await this.meleeOut(E);
        await this.wait(200);
        break;
      }
      case 'enemy:phase': {
        const big = ev.enraged !== false;
        this.flash(E, C.red, big ? 900 : 500);
        this.shake(big ? 6 : 4, big ? 600 : 350);
        this.ring(this.center(E).x, this.center(E).y, big ? 60 : 44, C.red, big ? 600 : 400, 3);
        this.popup('enemy', big ? 'ENRAGED' : ev.pct === 25 ? 'DESPERATE' : 'HURT', big ? 'heavy' : 'info');
        this.tween(big ? 600 : 350, (p) => { this.dim = (big ? 0.4 : 0.25) * Math.sin(p * Math.PI); });
        await this.wait(big ? 600 : 300);
        break;
      }
      case 'enemy:say':
        this.speak({ text: ev.text, kind: ev.kind, note: ev.note, n: ev.sayN });
        await this.wait(160);
        break;
      case 'enemy:telegraph': {
        const col = SIG_COLOR[ev.sig] || '#e6d36a', c = this.center(E);
        this.flash(E, col, 260);
        this.popup('enemy', ev.name, 'info');
        play('heavyCharge');
        if (E.sheet && E.sheet.anims.charge) E.setAnim('charge', now());
        this.ring(c.x, c.y, 34, col, 320, 2);
        if (this.bfx) { this.bfx.sig = ev.sig; this.bfx.left = 9; }
        await this.wait(320);
        break;
      }
      case 'enemy:charging': {
        const col = SIG_COLOR[ev.sig] || '#e6d36a', c = this.center(E);
        this.flash(E, col, 220);
        play('heavyCharge');
        this.popup('enemy', ev.sig === 'roll' ? 'Core flaring' : `${ev.left} more`, 'info');
        this.burst(c.x, c.y, 10, col, 1.4, 320, 0);
        await this.wait(260);
        break;
      }
      case 'enemy:sigfail': {
        const c = this.center(E);
        if (this.bfx) this.bfx.sig = null;
        this.popup('enemy', 'Stopped!', 'level');
        play('block');
        this.ring(c.x, c.y, 40, C.ion, 300, 2);
        this.burst(c.x, c.y, 12, C.ion, 2, 320);
        await this.wait(260);
        break;
      }
      case 'enemy:sig': await this.playSig(ev, P, E); break;
      case 'status:tick':
      case 'status:undefined': {
        if (ev.pdmg) { play('bleed'); this.flash(P, C.red, 200); this.popup('player', `\u2212${ev.pdmg}`, 'st-bleed'); this.setHp('player', ev.php); }
        if (ev.edmg) { play('burn'); this.flash(E, '#ff8a3c', 200); this.popup('enemy', `\u2212${ev.edmg}`, 'st-burn'); this.setHp('enemy', ev.ehp); }
        if (ev.regen) { play('repair'); this.popup('enemy', `+${ev.regen}`, 'heal'); this.setHp('enemy', ev.ehp); }
        await this.wait(350);
        break;
      }
      case 'player:deadman':
        this.flash(P, '#ffffff', 500);
        this.popup('player', 'NOT TODAY', 'level');
        this.setHp('player', ev.php);
        await this.wait(400);
        break;
      case 'env:explode': {
        const c = this.center(E);
        this.ring(c.x, c.y, 60, '#ff8a3c', 450, 3);
        this.burst(c.x, c.y, 40, '#ff8a3c', 3.5, 600, 0.05, 2);
        this.shake(7, 400);
        if (ev.pdmg) { this.flash(P, '#ff8a3c', 250); this.popup('player', `\u2212${ev.pdmg}`, 'heavy'); }
        else this.popup('player', 'Behind cover', 'info');
        this.setHp('player', ev.php);
        await this.wait(500);
        break;
      }
      case 'enemy:down': {
        E.setAnim('death', now());
        const c = this.center(E);
        if (E.id === 'probe' || E.id === 'loader' || E.id === 'sentinel' || E.id === 'crawler' || this.enemyTags.includes('droid')) { this.burst(c.x, c.y, 24, C.spark, 2.5, 600, 0.08); this.spray(c.x, c.y, 1, 10, FLECK, 2.4, 700, 0.17, 2); }
        if (ev.boss) { this.shake(6, 900); this.burst(c.x, c.y, 50, C.spark, 3, 900, 0.05, 2); play('explosion'); }
        await this.tween(ev.boss ? 900 : 450, (p) => { E.alpha = Math.floor(p * 9) % 2 ? 0.3 : 1; });
        await this.tween(500, (p) => { E.oy = 14 * ease(p); E.alpha = 1 - p; });
        break;
      }
    }
  }

  // Each signature move's turn on the stage: the sprite's own animation (sig1, sig2, or the fallback), plus effects drawn in code.
  async playSig(ev, P, E) {
    const now = () => performance.now(), col = SIG_COLOR[ev.sig] || '#e6d36a', fx = this.bfx || (this.bfx = {}), side = P === this.partner ? 'partner' : 'player', anim = this.sigAnim(E, ev.n);
    fx.sig = null;
    this.sigLog.push({ sig: ev.sig, n: ev.n, anim });
    E.setAnim(anim, now());
    this.popup('enemy', ev.name, 'info');
    const land = async (opts = {}) => {
      if (ev.blocked) { const c = this.center(P); this.ring(c.x + 18, c.y - 10, 30, C.ion, 260, 2); play('block'); }
      if (ev.dmg) { this.setHp('player', ev.php); await this.hit(P, ev.dmg, { note: ev.blocked ? '(blocked)' : '', ...opts }); }
    };
    const shot = async (w = 3, color = col) => { await this.aim(E); const m = this.muzzle(E); play('enemyShot'); this.burst(m.x, m.y, 10, color, 1.8, 170, 0); await this.bolt(m, this.center(P), color, w, 190); };
    switch (ev.sig) {
      case 'shutter':
        play('heavy');
        fx.shutter = 2;
        this.drop = { kind: 'bars', p: 0 };
        await this.tween(260, (p) => { if (this.drop) this.drop.p = p * p; });
        this.drop = null;
        this.shake(6, 260);
        this.burst(232, 176, 16, '#8b949c', 2, 380, 0.03, 2);
        await this.wait(120);
        break;
      case 'confiscate':
        play('whoosh');
        if (ev.text) { await this.bolt(this.center(P), this.center(E), C.heal, 2, 220); this.popup(side, `Took ${ev.text}`, 'heavy'); }
        else { await shot(2); await land(); }
        break;
      case 'anchor': {
        await this.move(E, 0, -16, 180);
        await this.move(E, 0, 0, 80);
        play('explosion');
        this.shake(9, 340);
        const a = this.anchor('enemy', E);
        this.burst(a.x, a.y, 30, '#8b949c', 3, 520, 0.03, 3);
        await land({ heavy: true });
        break;
      }
      case 'siege':
        await shot(5, '#ffb347');
        play('explosion');
        this.move(E, 14, 0, 70).then(() => this.move(E, 0, 0, 240));
        this.shake(11, 460); this.screenFlash('#ffb347', 0.3, 120);
        await land({ heavy: true });
        break;
      case 'roll': {
        const c = this.center(E);
        this.ring(c.x, c.y, 120, '#ff8a3c', 420, 4);
        this.screenFlash('#ff8a3c', 0.32, 150);
        play('explosion');
        this.shake(7, 320);
        await land({ heavy: true });
        break;
      }
      case 'floor': {
        const c = this.center(E);
        play('burn');
        fx.floor = 3;
        for (let i = 0; i < 5; i++) { this.burst(c.x - 26, c.y + i * 10, 6, '#ff8a3c', 1, 300, 0.1, 2); await this.wait(50); }
        break;
      }
      case 'overtime': {
        const hits = ev.hits || [ev.dmg];
        play('whoosh');
        await this.move(E, -80, 50, 150);
        for (const dmg of hits) { if (!dmg) continue; if (ev.blocked) { play('block'); } this.setHp('player', ev.php); await this.hit(P, dmg, { note: ev.blocked ? '(blocked)' : '' }); }
        await this.move(E, 0, 0, 200);
        if (ev.winded) { this.popup('enemy', 'WINDED', 'info'); await this.wait(120); }
        break;
      }
      case 'front':
        play('alarm');
        fx.front = 2;
        this.popup('enemy', 'Whistle', 'info');
        await this.wait(260);
        break;
      case 'count': {
        const c = this.center(E);
        play('status');
        this.ring(c.x, c.y, 54, '#e6d36a', 360, 2);
        this.popup(side, 'Stand still', 'info');
        await this.wait(240);
        break;
      }
      case 'lights':
        play('zap');
        fx.lights = 2;
        this.screenFlash('#000000', 0.7, 200);
        await this.wait(240);
        break;
      case 'crane': {
        const pc = this.center(P);
        play('whoosh');
        this.drop = { kind: 'box', p: 0, x: pc.x };
        await this.tween(260, (p) => { if (this.drop) this.drop.p = p * p; });
        this.drop = null;
        play('explosion');
        this.shake(11, 460);
        this.burst(pc.x, pc.y + 30, 34, '#8b949c', 3.2, 560, 0.03, 3);
        fx.wreck = 2;
        await land({ heavy: true });
        break;
      }
      case 'salute':
        await this.wait(120);
        await shot(3, C.crit);
        await land({ crit: true });
        break;
      case 'redact': {
        play('zap');
        for (let i = 0; i < 16; i++) this.burst(70 + i * 15, 40 + i * 8, 1, '#efe7d6', 0.4, 300, 0, 2);
        this.screenFlash('#efe7d6', 0.16, 90);
        this.popup(side, `${ev.text || ''} cut`, 'heavy');
        await this.wait(260);
        break;
      }
      case 'audit': {
        this.screenFlash('#ffffff', 0.34, 130);
        if (ev.text) this.popup('enemy', ev.text, 'heavy');
        await shot(4, '#ffffff');
        this.shake(8, 340);
        await land({ heavy: true });
        break;
      }
      default: await this.wait(200);
    }
    for (const st of ev.statuses || []) { play('status'); this.popup(side, st.toUpperCase(), `st-${st}`); this.flash(P, col, 260); }
    await this.wait(140);
  }

  // What a boss has left on the stage: bars, slag, workers, the dark. Drawn in code, so it works for every boss whatever art has arrived.
  drawBossFx(g, t, E, stage) {
    const f = this.bfx, D2 = this.drop;
    if (!f && !D2) return;
    const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t / 170);
    if (stage === 'under' && f) {
      const slag = f.floor > 0 && fxImg('slag');
      if (slag) {
        // The molten floor: the painted strip, tiled, breathing brighter and dimmer, with a heat haze on top.
        const h = 30, w = Math.round(slag.width * h / slag.height);
        g.globalAlpha = 0.78 + 0.22 * pulse;
        for (let x = -((t / 90) % w); x < W; x += w) g.drawImage(slag, Math.round(x), 186, w, h);
        g.globalAlpha = 1;
        const hz = g.createLinearGradient(0, 168, 0, 190); hz.addColorStop(0, 'rgba(255,140,50,0)'); hz.addColorStop(1, `rgba(255,140,50,${0.18 + 0.12 * pulse})`);
        g.fillStyle = hz; g.fillRect(0, 168, W, 22);
      } else if (f.floor > 0) {
        for (let i = 0; i < 16; i++) {
          const x = i * 25, wob = reduceMotion ? 0 : Math.sin(t / 240 + i * 1.7) * 2;
          g.fillStyle = i % 2 ? `rgba(255,120,40,${0.3 + 0.25 * pulse})` : `rgba(255,190,70,${0.22 + 0.2 * pulse})`;
          g.fillRect(x, 186 + wob, 26, 30 - wob);
        }
      }
      const box = f.wreck > 0 && fxImg('container');
      if (box) {
        // The dropped container lies where it landed, tipped a little, half in its own dust.
        g.save(); g.translate(176, 190); g.rotate(-0.06);
        const bw = 72, bh = Math.round(bw * box.height / box.width);
        g.drawImage(box, -bw / 2, -bh, bw, bh); g.restore();
        g.fillStyle = 'rgba(30,26,22,0.35)'; g.beginPath(); g.ellipse(176, 191, 42, 5, 0, 0, Math.PI * 2); g.fill();
      } else if (f.wreck > 0) {
        g.fillStyle = '#5a3a26'; g.fillRect(146, 146, 58, 42);
        g.fillStyle = '#3a261a'; for (let x = 150; x < 204; x += 9) g.fillRect(x, 146, 2, 42);
        g.fillStyle = '#7d5335'; g.fillRect(146, 146, 58, 3);
      }
      if (f.sig === 'crane') {
        const a = this.player ? this.center(this.player) : { x: 104 }, k = f.left <= 1 ? 1 : 0.6;
        g.fillStyle = `rgba(0,0,0,${0.3 + 0.25 * k})`; g.beginPath(); g.ellipse(a.x, 204, 46 * k + 8, 9, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = `rgba(212,72,58,${0.5 + 0.4 * pulse})`; g.lineWidth = 1; g.beginPath(); g.ellipse(a.x, 204, 46 * k + 8, 9, 0, 0, Math.PI * 2); g.stroke();
      }
      return;
    }
    if (stage !== 'over') return;
    if (f) {
      const c = this.center(E);
      const crew = f.front > 0 && this.crewId && sheetFor(this.crewId)[1];
      if (crew) {
        // The boss's people, in the real art: three of them shoulder to shoulder, a beat apart, between you and the boss.
        const a = crew.anims.idle, fw = a.img.width / a.frames, hgt = crew.hd ? 64 : 58, sc = hgt / (crew.hd ? crew.fig : a.img.height * 0.8);
        for (let i = 0; i < 3; i++) {
          const fr = reduceMotion ? 0 : [0, 1, 2, 1][Math.floor(t / 520 + i * 1.3) % 4] % a.frames;
          const w = Math.round(fw * sc), h = Math.round(a.img.height * sc), x = 204 + i * 22, feet = 186 - i % 2 * 3, pad = crew.hd ? (a.pad || 0) * sc : 8 * sc;
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, feet + 1, 12, 3, 0, 0, Math.PI * 2); g.fill();
          g.drawImage(a.img, fr * fw, 0, fw, a.img.height, Math.round(x - w / 2), Math.round(feet - h + pad), w, h);
        }
      } else if (f.front > 0) {
        for (let i = 0; i < 3; i++) {
          const x = 206 + i * 21, bob = reduceMotion ? 0 : Math.round(Math.sin(t / 420 + i * 2) * 1);
          g.fillStyle = '#14171b'; g.fillRect(x - 6, 124 + bob, 12, 42); g.fillRect(x - 4, 166, 3, 16); g.fillRect(x + 1, 166, 3, 16);
          g.fillStyle = '#1b1f24'; g.fillRect(x - 4, 113 + bob, 8, 10);
          g.fillStyle = '#b08a35'; g.fillRect(x - 5, 111 + bob, 10, 3);
        }
      }
      if (f.shutter > 0 && !(D2 && D2.kind === 'bars')) this.drawBars(g, 1);
      if (f.sig === 'siege' || f.sig === 'roll' || f.sig === 'audit') {
        const hot = f.sig === 'audit' ? '255,255,255' : '255,160,60', r = E.size * (f.sig === 'roll' ? 0.34 : 0.22) * (0.8 + 0.3 * pulse);
        const p = f.sig === 'siege' ? this.muzzle(E) : c, rg = g.createRadialGradient(p.x, p.y, 1, p.x, p.y, r);
        rg.addColorStop(0, `rgba(${hot},.85)`); rg.addColorStop(1, `rgba(${hot},0)`);
        g.fillStyle = rg; g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
      if (f.lights > 0) {
        g.fillStyle = 'rgba(4,5,7,.66)'; g.fillRect(0, 0, W, H);
        g.fillStyle = `rgba(230,240,255,${0.5 + 0.5 * pulse})`; g.fillRect(Math.round(c.x - 10), Math.round(c.y - E.tall * 0.34), 3, 2);
      }
    }
    if (D2 && D2.kind === 'bars') this.drawBars(g, D2.p);
    const fall = D2 && D2.kind === 'box' && fxImg('container');
    if (fall) {
      const bw = 76, bh = Math.round(bw * fall.height / fall.width), y = -bh + (200 - 0) * D2.p;
      g.strokeStyle = '#2b3036'; g.lineWidth = 1; g.beginPath(); g.moveTo(D2.x - 20, 0); g.lineTo(D2.x - 20, y); g.moveTo(D2.x + 20, 0); g.lineTo(D2.x + 20, y); g.stroke();
      g.drawImage(fall, Math.round(D2.x - bw / 2), Math.round(y), bw, bh);
    } else if (D2 && D2.kind === 'box') {
      const y = -46 + 200 * D2.p;
      g.fillStyle = '#6d4a30'; g.fillRect(D2.x - 34, y, 68, 46);
      g.fillStyle = '#3a261a'; for (let x = D2.x - 30; x < D2.x + 34; x += 10) g.fillRect(x, y, 2, 46);
    }
  }
  drawBars(g, p) {
    const img = fxImg('shutter');
    if (img) {
      // The shutter art slides down out of the ceiling; at the Port it's a hard-light gate, so it glows.
      const w = 70, h = Math.round(w * img.height / img.width), bottom = 26 + 160 * p, y = Math.round(bottom - h);
      g.save(); g.beginPath(); g.rect(196, 0, w + 8, bottom + 2); g.clip();
      g.drawImage(img, 198, y, w, h);
      if (this.theme === 'port') { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(90,190,255,0.22)'; g.fillRect(198, Math.max(0, y), w, bottom - Math.max(0, y)); }
      g.restore();
      if (p >= 1) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(233, bottom + 1, 38, 3, 0, 0, Math.PI * 2); g.fill(); }
      return;
    }
    const bottom = 30 + 150 * p;
    g.fillStyle = '#6a747e'; for (let x = 204; x < 262; x += 9) g.fillRect(x, 26, 3, bottom - 26); g.fillStyle = '#2a3036'; for (let x = 207; x < 262; x += 9) g.fillRect(x, 26, 1, bottom - 26);
    g.fillStyle = '#8a949e'; g.fillRect(200, 22, 66, 5);
    if (p >= 1) g.fillRect(200, bottom - 3, 66, 4);
  }

  // Props on the floor behind the fighters. Their own frames play slowly; nothing here moves in calm mode.
  drawProps(g, t) {
    for (const p of this.props || []) {
      const d = p.d, img = d.img;
      if (!img) continue;
      const n = d.frames || 1, fw = img.width / n, fr = reduceMotion || n < 2 ? 0 : Math.floor((t + p.phase) / 1000 * (d.fps || 6)) % n;
      const h = p.h, w = Math.round(fw * h / img.height), cx = Math.min(p.x, W - 4 - w / 2), x = Math.round(cx - w / 2), y = Math.round(p.y - h);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, p.y, w * 0.42, 3, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.92; g.drawImage(img, fr * fw, 0, fw, img.height, x, y, w, h); g.globalAlpha = 1;
    }
  }

  // ---------- drawing ----------
  background(sector, boss, theme = 'garrison') {
    const key = `${theme}-${sector}-${boss ? 1 : 0}`;
    if (this.bgCache[key]) return this.bgCache[key];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), rnd = seeded(sector * 977 + 31), Y = 112, band = Math.min(2, Math.floor((sector - 1) / 5));
    const rect = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const grad = (a, b, y0, y1) => { const d = g.createLinearGradient(0, y0, 0, y1); d.addColorStop(0, a); d.addColorStop(1, b); return d; };
    const sky = (a, b, h = Y + 2) => { g.fillStyle = grad(a, b, 0, h); g.fillRect(0, 0, W, h); };
    const glow = (x, y, r, rgb, al) => { const d = g.createRadialGradient(x, y, 1, x, y, r); d.addColorStop(0, `rgba(${rgb},${al})`); d.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = d; g.fillRect(x - r, y - r, r * 2, r * 2); };
    const cone = (x, y, x2, y2, spread, rgb, al) => { g.fillStyle = `rgba(${rgb},${al})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x2 - spread, y2); g.lineTo(x2 + spread, y2); g.fill(); };
    const floor = (a, b) => { g.fillStyle = grad(a, b, Y, H); g.fillRect(0, Y + 2, W, H - Y); };
    const perspective = (col = 'rgba(0,0,0,0.28)', step = 14) => { g.strokeStyle = col; g.lineWidth = 1; for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(W / 2 + i * step, Y + 2); g.lineTo(W / 2 + i * step * 5, H); g.stroke(); } for (let y = Y + 6, d = 4; y < H; y += d, d *= 1.35) { g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(W, Math.round(y) + 0.5); g.stroke(); } };
    const skyline = (far, lit, maxH = 60) => { for (let x = -4; x < W;) { const w = 10 + Math.floor(rnd() * 26), h = 14 + Math.floor(rnd() * maxH); rect(far, x, Y - h, w, h); for (let i = 0; i < w * h * 0.02; i++) rect(`rgba(${lit},${0.35 + rnd() * 0.5})`, x + 1 + Math.floor(rnd() * Math.max(1, w - 2)), Y - h + 2 + Math.floor(rnd() * Math.max(1, h - 4)), 1, 1); x += w + Math.floor(rnd() * 4); } };
    const bars = (x, y, w, h, col, gap = 4) => { for (let bx = x; bx < x + w; bx += gap) rect(col, bx, y, 1, h); rect(col, x, y, w, 2); rect(col, x, y + h - 2, w, 2); };
    const chain = (x, y0, y1, col) => { for (let y = y0; y < y1; y += 4) rect(col, x, y, 2, 3); };
    const banner = (x, y, w, h, col, mark) => { rect(col, x, y, w, h); g.fillStyle = col; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w / 2, y + h + 6); g.lineTo(x + w, y + h); g.fill(); rect(mark, x + w / 2 - 3, y + 5, 6, 10); rect(mark, x + w / 2 - 6, y + 8, 12, 2); };
    let indoor = false;
    const scenes = {
      garrison: [
        () => { // the outer yard: city behind the wall, watchtowers and searchlights
          sky('#0b0f14', '#1d2833'); glow(W * 0.6, Y, 220, '232,151,58', 0.2); skyline('#121820', '232,151,58');
          for (const x of [50 + rnd() * 30, 280 + rnd() * 40]) { rect('#0e1216', x, Y - 62, 5, 62); rect('#0e1216', x + 22, Y - 62, 5, 62); rect('#171d23', x - 5, Y - 78, 42, 18); rect('#232b33', x - 8, Y - 80, 48, 3); rect('rgba(232,190,120,0.8)', x + 2, Y - 74, 24, 6); }
          cone(70, Y - 70, 150 + rnd() * 90, Y + 40, 30, '232,210,150', 0.07); cone(300, Y - 70, 180 + rnd() * 60, Y + 40, 30, '232,210,150', 0.07);
          rect('#1b232b', 0, Y - 14, W, 16); for (let x = 0; x < W; x += 24) rect('rgba(0,0,0,0.35)', x, Y - 14, 1, 16);
          g.strokeStyle = '#4a545c'; for (let x = 0; x < W; x += 8) { g.beginPath(); g.arc(x + 4, Y - 16, 3, 0, Math.PI * 2); g.stroke(); }
          floor('#262d34', '#121519'); perspective(); for (let x = 0; x < W; x += 8) rect((x / 8) % 2 ? '#1a1a1a' : 'rgba(207,149,40,0.55)', x, Y + 2, 8, 2);
        },
        () => { // barracks: lockers, strip lights, the flag
          indoor = true; sky('#1a2024', '#2a3035'); rect('#12161a', 0, 0, W, 16); for (let x = 16; x < W; x += 74) { rect('rgba(225,235,235,0.9)', x, 16, 42, 2); cone(x + 21, 18, x + 21, Y + 40, 46, '220,235,235', 0.06); }
          for (let x = 0; x < W; x += 22) { rect('#39454c', x + 1, 48, 20, Y - 48); rect('#2b353b', x + 1, 48, 1, Y - 48); rect('#1c2328', x + 16, 74, 2, 8); for (let v = 0; v < 3; v++) rect('#1c2328', x + 5, 53 + v * 3, 8, 1); }
          banner(160 + rnd() * 40, 20, 34, 34, '#7a1f1a', '#d8b04a'); rect('#1b2126', 0, Y - 6, W, 8);
          floor('#3a4044', '#1b1f22'); perspective('rgba(0,0,0,0.22)', 18);
        },
        () => { // command deck: tall windows over the city, and screens
          indoor = true; sky('#0a1018', '#142133'); skyline('#0e1826', '115,182,212', 44);
          for (let x = -6; x < W; x += 58) rect('#20282f', x, 0, 12, Y);
          rect('#20282f', 0, 0, W, 14); rect('#20282f', 0, Y - 22, W, 24);
          for (let x = 22; x < W; x += 64) { rect('#0c2333', x, Y - 18, 34, 12); rect('rgba(115,182,212,0.8)', x + 3, Y - 15, 12 + rnd() * 16, 1); rect('rgba(115,182,212,0.5)', x + 3, Y - 12, 8 + rnd() * 20, 1); rect('rgba(232,151,58,0.7)', x + 3, Y - 9, 6 + rnd() * 10, 1); }
          banner(W / 2 - 18, 8, 36, 40, '#7a1f1a', '#d8b04a'); floor('#2a3540', '#10151b'); perspective('rgba(115,182,212,0.12)', 22);
        },
      ],
      foundry: [
        () => { // the furnace hall
          indoor = true; sky('#120a07', '#2c150b'); for (let x = 0; x < W; x += 34) { g.strokeStyle = '#2a1a12'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 17, 20); g.lineTo(x + 34, 0); g.stroke(); } rect('#2a1a12', 0, 19, W, 3);
          for (const x of [40, 170, 300]) { rect('#1d120c', x - 6, 30, 58, Y - 30); rect('#311d12', x, 38, 46, 8); g.fillStyle = grad('#ffd27a', '#ff6a1c', 52, Y - 4); g.fillRect(x + 6, 52, 34, Y - 56); glow(x + 23, Y - 20, 66, '255,120,40', 0.34); }
          chain(120, 22, 56, '#3a261a'); g.fillStyle = '#3a261a'; g.beginPath(); g.moveTo(106, 56); g.lineTo(136, 56); g.lineTo(130, 76); g.lineTo(112, 76); g.fill(); rect('#ffb050', 109, 56, 24, 3);
          floor('#33231a', '#150e09'); perspective('rgba(0,0,0,0.3)', 16); g.fillStyle = grad('#ffcf70', '#d9561a', Y + 4, Y + 10); g.fillRect(0, Y + 5, W, 5); glow(W / 2, Y + 8, 170, '255,120,40', 0.12);
        },
        () => { // the rolling mill: gears, rollers and hot ingots
          indoor = true; sky('#16100c', '#2a1c14');
          for (const [x, r] of [[60, 30], [116, 18], [318, 34]]) { g.strokeStyle = '#3f2c20'; g.lineWidth = 6; g.beginPath(); g.arc(x, 56, r, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; for (let a = 0; a < 8; a++) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x + Math.cos(a * Math.PI / 4) * r, 56 + Math.sin(a * Math.PI / 4) * r); g.stroke(); } rect('#6a4b34', x - 3, 53, 6, 6); }
          rect('#20150f', 0, Y - 20, W, 22); for (let x = 3; x < W; x += 11) { rect('#5a4434', x, Y - 21, 8, 8); rect('#2c1f17', x + 2, Y - 19, 4, 4); }
          for (const x of [34, 190 + rnd() * 40, 340]) { rect('#ff8a34', x, Y - 28, 34, 7); rect('#ffd27a', x + 3, Y - 26, 28, 2); glow(x + 17, Y - 24, 42, '255,120,40', 0.25); }
          floor('#2c2622', '#121010'); perspective('rgba(0,0,0,0.35)', 20); for (let x = 0; x < W; x += 16) rect((x / 16) % 2 ? '#191512' : 'rgba(255,170,60,0.5)', x, Y + 2, 16, 3);
        },
        () => { // the slag yard, outdoors under a burning sky
          sky('#2b0f08', '#a03a14'); glow(W * 0.3, Y, 200, '255,170,70', 0.4);
          for (const x of [48, 96, 300, 346]) { rect('#1a0f0a', x, 16, 14, Y - 16); rect('#3a241a', x, 22, 14, 2); for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(30,18,14,${0.5 - i * 0.05})`; g.beginPath(); g.ellipse(x + 7 + i * 7, 12 - i * 1.2, 5 + i * 2, 3 + i, 0, 0, Math.PI * 2); g.fill(); } }
          for (let x = -30; x < W; x += 72) { g.fillStyle = '#20120c'; g.beginPath(); g.moveTo(x, Y + 2); g.lineTo(x + 40, Y - 22 - rnd() * 22); g.lineTo(x + 90, Y + 2); g.fill(); }
          floor('#2a1a14', '#0e0807'); for (let i = 0; i < 22; i++) { const x = rnd() * W, y = Y + 8 + rnd() * (H - Y - 10), l = 6 + rnd() * 24; g.strokeStyle = 'rgba(255,120,40,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (rnd() - 0.5) * 6); g.stroke(); }
        },
      ],
      detention: [
        () => { // the cell block: two tiers of barred doors under cold light
          indoor = true; sky('#10181d', '#1e2b31');
          for (const tier of [12, 60]) { rect('#1a252b', 0, tier + 40, W, 5); for (let x = 2; x < W; x += 46) { rect('#070b0e', x, tier, 38, 40); if (rnd() < 0.3) rect('rgba(115,182,212,0.28)', x + 6, tier + 8, 26, 26); if (rnd() < 0.25) rect('#2a3840', x + 14, tier + 18, 10, 22); bars(x, tier, 38, 40, '#51626c'); rect('rgba(200,50,40,0.9)', x + 18, tier - 3, 3, 2); } }
          for (let x = 0; x < W; x += 12) rect('#3a4a52', x, 50, 1, 6); rect('#3a4a52', 0, 50, W, 1);
          g.fillStyle = '#1a2428'; g.fillRect(0, Y + 2, W, H - Y); const n = 13; for (let r = 0; r < 7; r++) { const y0 = Y + 2 + Math.pow(r / 7, 1.7) * (H - Y), y1 = Y + 2 + Math.pow((r + 1) / 7, 1.7) * (H - Y); for (let i = -n; i < n; i++) if ((i + r) % 2 === 0) { const s0 = 8 + r * 7, x = W / 2 + i * s0; rect('rgba(130,155,165,0.14)', x, y0, s0, y1 - y0); } }
        },
        () => { // the exercise yard: chain link, guard lights, flat grey sky
          sky('#39433f', '#7d8a84'); skyline('#2a322f', '20,24,22', 34);
          rect('#3b4441', 0, Y - 56, W, 2); for (let x = 0; x < W; x += 6) { g.strokeStyle = 'rgba(40,48,46,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, Y - 56); g.lineTo(x + 56, Y); g.moveTo(x + 56, Y - 56); g.lineTo(x, Y); g.stroke(); }
          for (let x = 8; x < W; x += 62) { rect('#2a322f', x, Y - 66, 3, 68); g.strokeStyle = '#2a322f'; g.beginPath(); g.moveTo(x, Y - 66); g.lineTo(x + 8, Y - 72); g.stroke(); } g.strokeStyle = '#59645f'; for (let x = 0; x < W; x += 7) { g.beginPath(); g.arc(x, Y - 66, 3, 0, Math.PI * 2); g.stroke(); }
          floor('#4b5350', '#1f2422'); for (let i = 0; i < 180; i++) rect(`rgba(${rnd() < 0.5 ? '0,0,0' : '200,210,205'},0.16)`, rnd() * W, Y + 4 + rnd() * (H - Y), 2, 1);
        },
        () => { // the interrogation wing: stained tile, pipes, one hard lamp
          indoor = true; sky('#20282a', '#2f3a3a');
          for (let y = 8; y < Y; y += 10) for (let x = (y % 20 ? 0 : 7); x < W; x += 14) rect('rgba(160,185,180,0.08)', x, y, 13, 9);
          for (const y of [10, 18]) { rect('#4a3a2c', 0, y, W, 4); for (let x = 30; x < W; x += 90) rect('#6a543f', x, y - 1, 6, 6); }
          for (let i = 0; i < 6; i++) { const x = rnd() * W; g.fillStyle = 'rgba(70,40,30,0.3)'; g.fillRect(x, 24, 2 + rnd() * 5, 20 + rnd() * 60); }
          chain(W * 0.5, 22, 42, '#20282a'); rect('#20282a', W * 0.5 - 14, 42, 30, 6); rect('#f4f1dc', W * 0.5 - 10, 48, 22, 2); cone(W * 0.5 + 1, 48, W * 0.5 + 1, H, 110, '240,240,215', 0.09);
          rect('#111719', 300, 44, 56, Y - 44); bars(300, 44, 56, Y - 44, '#51626c', 7);
          floor('#3b4543', '#141a19'); perspective('rgba(0,0,0,0.3)', 18); g.fillStyle = '#0a0e0d'; g.beginPath(); g.ellipse(W * 0.5, Y + 40, 10, 3, 0, 0, Math.PI * 2); g.fill();
        },
      ],
      port: [
        () => { // the landing pad: open sky, a planet, the lift tether
          sky('#050816', '#2a2448', Y + 2); for (let i = 0; i < 90; i++) rect(`rgba(230,230,255,${0.3 + rnd() * 0.7})`, rnd() * W, rnd() * (Y - 10), 1, 1);
          g.fillStyle = '#3a3f76'; g.beginPath(); g.arc(70, 8, 46, 0, Math.PI * 2); g.fill(); g.fillStyle = '#54589a'; g.beginPath(); g.arc(62, 2, 42, 0, Math.PI * 2); g.fill(); glow(70, 8, 80, '160,170,255', 0.16);
          rect('#232a3c', W * 0.72, 0, 4, Y); for (let y = 4; y < Y; y += 11) rect('rgba(210,190,255,0.7)', W * 0.72 - 1, y, 6, 1); rect('#39445c', W * 0.72 - 7, 34, 18, 12);
          rect('#121827', 170, Y - 50, 5, 52); rect('#121827', 170, Y - 50, 90, 5); chain(240, Y - 45, Y - 22, '#121827');
          g.fillStyle = '#1a2233'; g.beginPath(); g.moveTo(190, Y - 4); g.lineTo(205, Y - 22); g.lineTo(254, Y - 22); g.lineTo(272, Y - 8); g.lineTo(272, Y - 2); g.fill(); rect('rgba(115,182,212,0.8)', 208, Y - 18, 12, 3);
          floor('#2a3240', '#10141c'); perspective('rgba(115,182,212,0.13)', 22); for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(232,210,90,0.55)'; g.lineWidth = 2; const y = Y + 18 + i * 14, x = W / 2; g.beginPath(); g.moveTo(x - 40 - i * 8, y + 8); g.lineTo(x, y); g.lineTo(x + 40 + i * 8, y + 8); g.stroke(); }
        },
        () => { // the cargo hold: stacked containers and an overhead crane
          indoor = true; sky('#0d1219', '#1c2533'); rect('#0a0e14', 0, 0, W, 12); rect('#2b3648', 0, 12, W, 4); rect('#3a4860', 200 + rnd() * 60, 16, 36, 6); chain(218 + rnd() * 2, 22, 42, '#2b3648');
          const cols = ['#8a3a2a', '#2f5d76', '#a8842a', '#3f6a4c', '#5a4a78'];
          for (let x = -6; x < W; x += 44) { const stack = 1 + Math.floor(rnd() * 3); for (let s = 0; s < stack; s++) { const y = Y - (s + 1) * 26, col = cols[Math.floor(rnd() * cols.length)]; rect(col, x, y, 42, 25); rect('rgba(0,0,0,0.25)', x, y + 22, 42, 3); for (let v = 4; v < 40; v += 5) rect('rgba(0,0,0,0.2)', x + v, y + 2, 1, 20); rect('rgba(255,255,255,0.28)', x + 5, y + 5, 12, 2); } }
          for (let x = 30; x < W; x += 110) cone(x, 16, x, Y + 40, 50, '140,190,230', 0.07);
          floor('#2a313c', '#11151b'); perspective('rgba(0,0,0,0.3)', 18); for (let x = 0; x < W; x += 12) rect((x / 12) % 2 ? '#14181e' : 'rgba(232,210,90,0.45)', x, Y + 2, 12, 2);
        },
        () => { // the top of the lift: above the clouds, tether right beside you
          sky('#020412', '#3a2a66', Y - 10); for (let i = 0; i < 130; i++) rect(`rgba(240,240,255,${0.3 + rnd() * 0.7})`, rnd() * W, rnd() * (Y - 30), 1, 1);
          g.fillStyle = '#c8a2d8'; g.beginPath(); g.ellipse(W / 2, Y + 60, W, 76, 0, Math.PI, Math.PI * 2); g.fill(); g.fillStyle = '#8f78bc'; g.beginPath(); g.ellipse(W / 2, Y + 66, W, 76, 0, Math.PI, Math.PI * 2); g.fill(); for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(250,235,255,0.35)'; g.beginPath(); g.ellipse(rnd() * W, Y - 6 + rnd() * 10, 8 + rnd() * 26, 2, 0, 0, Math.PI * 2); g.fill(); }
          rect('#39445c', 318, 0, 12, Y + 2); for (let y = 2; y < Y; y += 9) rect('rgba(210,190,255,0.8)', 316, y, 16, 1); rect('#55617e', 306, 30, 36, 18); rect('rgba(115,182,212,0.9)', 310, 35, 28, 4);
          rect('#232a3c', 0, Y - 8, W, 2); for (let x = 0; x < W; x += 20) rect('#232a3c', x, Y - 8, 2, 10);
          floor('#1c2436', '#0a0d16'); perspective('rgba(150,200,255,0.2)', 26);
        },
      ],
    };
    (scenes[theme] || scenes.garrison)[band]();
    if (boss) { g.fillStyle = 'rgba(120,18,12,0.24)'; g.fillRect(0, 0, W, H); glow(W * 0.7, Y - 30, 150, '212,72,58', 0.3); banner(W * 0.7 - 16, 4, 32, 40, '#7a1f1a', '#e8c35a'); }
    c.indoor = indoor;
    return (this.bgCache[key] = c);
  }

  // A faint light behind the figure lifts dark clothes off the scene; a soft shadow grounds the feet.
  groundShadow(x, y, rx, ry) {
    const g = this.ctx;
    const up = g.createRadialGradient(x, y - rx * 0.95, 4, x, y - rx * 0.95, rx * 1.55);
    up.addColorStop(0, 'rgba(205,220,230,0.17)'); up.addColorStop(1, 'rgba(205,220,230,0)');
    g.fillStyle = up; g.fillRect(x - rx * 1.6, y - rx * 2.6, rx * 3.2, rx * 3.2);
    g.save(); g.translate(x, y + 2); g.scale(1, ry / rx);
    const sh = g.createRadialGradient(0, 0, 2, 0, 0, rx * 0.8);
    sh.addColorStop(0, 'rgba(0,0,0,0.62)'); sh.addColorStop(0.6, 'rgba(0,0,0,0.34)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, rx * 0.8, 0, Math.PI * 2); g.fill(); g.restore();
  }
  pad(x, y, rx, ry) {
    const g = this.ctx;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(x, y + 3, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a434b'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a3138'; g.beginPath(); g.ellipse(x, y + 1, rx - 3, ry - 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(232,151,58,0.7)';
    for (let i = 0; i < 4; i++) { const a = Math.PI * (0.15 + i * 0.23); g.fillRect(Math.round(x + Math.cos(a) * (rx - 1)) - 2, Math.round(y + Math.sin(a) * (ry - 1)), 4, 1); }
  }

  drawActor(actor, t) {
    if (!actor || actor.alpha <= 0 || (this.artHold && this.artMissing(actor))) return;
    const g = this.ctx, a = this.anchor(actor.side, actor), f = actor.frame(t), s = actor.scale;
    if (!f.img) return; // art still loading
    const w = Math.round(f.sw * s), h = Math.round(f.sh * s);
    let bob = 0;
    if (!reduceMotion && HOVER.has(actor.id)) bob = Math.sin(t / 380) * 3;
    else if (!reduceMotion && !(actor.sheet && actor.sheet.hd)) bob = actor.side === 'enemy' ? Math.sin(t / 650) : Math.sin(t / 720) * 1.2;
    const feet = actor.sheet && actor.sheet.hd ? (f.pad || 0) * s : this.footPad(actor);
    const x = Math.round(a.x + actor.ox - w / 2), y = Math.round(a.y + actor.oy - h + feet + bob);
    g.globalAlpha = actor.alpha;
    if (actor.mirror) { g.save(); g.translate(x * 2 + w, 0); g.scale(-1, 1); } // the far fighter in the ring faces left
    if (actor.flash > t) {
      const b = this.buf; b.width = f.sw; b.height = f.sh;
      const bg = b.getContext('2d');
      bg.drawImage(f.img, f.sx, 0, f.sw, f.sh, 0, 0, f.sw, f.sh);
      bg.globalCompositeOperation = 'source-atop'; bg.globalAlpha = 0.85; bg.fillStyle = actor.flashColor; bg.fillRect(0, 0, f.sw, f.sh);
      g.drawImage(b, 0, 0, f.sw, f.sh, x, y, w, h);
    } else {
      g.drawImage(f.img, f.sx, 0, f.sw, f.sh, x, y, w, h);
    }
    if (actor.mirror) g.restore();
    g.globalAlpha = 1;
  }

  draw(t) {
    if (!this.el.isConnected || !this.enemy) return;
    const real = t;
    // Hit-stop: while it lasts the scene's clock doesn't move. Only the shake carries on, which is what sells the blow.
    const frozen = this.stopUntil > 0 && t < this.stopUntil;
    if (frozen) t = this.stopAt;
    else if (this.stopUntil > 0) this.endStop();
    if (!frozen) for (const tw of [...this.tweens]) {
      const p = Math.max(0, Math.min(1, (t - tw.start) / tw.dur));
      tw.fn(p);
      if (p >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done(); }
    }
    const g = this.ctx;
    g.save();
    if (real < this.shakeUntil) { const m = this.shakeMag * Math.min(1, (this.shakeUntil - real) / this.shakeLen + 0.25); g.translate(Math.round((Math.random() * 2 - 1) * m), Math.round((Math.random() * 2 - 1) * m)); }
    const Z = this.zoom;
    if (Z) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    if (Z && Z.k > 1.001) { g.translate(Z.x, Z.y); g.scale(Z.k, Z.k); g.translate(-Z.x, -Z.y); }
    const painted = paintedBackdrop(this.theme, this.sector, this.boss);
    const backdrop = painted.canvas ? null : this.background(this.sector, this.boss, this.theme);
    if (painted.canvas) g.drawImage(painted.canvas, 0, 0, W, H); else g.drawImage(backdrop, 0, 0);
    const underRoof = painted.canvas ? !painted.open : backdrop.indoor;
    if (this.boss && !reduceMotion) { g.fillStyle = `rgba(212,72,58,${0.06 + 0.06 * Math.sin(t / 300)})`; g.fillRect(0, 0, W, H); }
    g.fillStyle = this.theme === 'foundry' ? 'rgba(255,150,70,0.35)' : 'rgba(160,180,200,0.22)';
    // Rain outdoors; in the foundry, sparks. Under a roof, neither.
    if (!underRoof || this.theme === 'foundry') for (const d of reduceMotion ? [] : this.rain) { if (!frozen) { d.y += d.v; d.x -= d.v * 0.25; if (d.y > H) { d.y = -6; d.x = Math.random() * (W + 40); } } g.fillRect(Math.round(d.x), Math.round(d.y), 1, 4); }

    this.drawProps(g, frozen ? this.stopAt : t);
    const ea = this.anchor('enemy');
    if (painted.canvas) this.groundShadow(ea.x, ea.y + 1, Math.max(26, (this.enemy ? this.enemy.tall : 100) * 0.5), 11); else this.pad(ea.x, ea.y + 1, 58, 11);
    const E = this.enemy, ec = this.center(E);
    if ((this.intent === 'heavy' && !this.stun) || this.heavyBoost) {
      const pulse = this.heavyBoost ? 0.55 : 0.25 + 0.12 * Math.sin(t / 160);
      const rg = g.createRadialGradient(ec.x, ec.y, 4, ec.x, ec.y, E.size * (E.sheet ? 0.4 : 0.7));
      rg.addColorStop(0, `rgba(212,72,58,${pulse})`); rg.addColorStop(1, 'rgba(212,72,58,0)');
      g.fillStyle = rg; g.fillRect(ec.x - E.size, ec.y - E.size, E.size * 2, E.size * 2);
    }
    this.drawActor(E, t);
    if (this.intent === 'guard' && !this.stun && E.alpha > 0.5) {
      g.strokeStyle = `rgba(190,200,210,${0.35 + 0.15 * Math.sin(t / 240)})`; g.lineWidth = 2;
      const k = E.sheet ? 0.5 : 1; g.beginPath(); g.ellipse(ec.x - 8, ec.y + 6, E.size * 0.55 * k, E.size * 0.6 * k, 0, Math.PI * 0.6, Math.PI * 1.25); g.stroke();
    }
    if (this.stun > 0 && E.alpha > 0.5) {
      for (let i = 0; i < 3; i++) { const a = t / 300 + (i * Math.PI * 2) / 3; g.fillStyle = C.ion; g.fillRect(Math.round(ec.x + Math.cos(a) * 16), Math.round(ec.y - E.size * 0.45 + Math.sin(a) * 4), 2, 2); }
    }

    this.drawBossFx(g, t, E, 'under');
    const pa = this.anchor('player');
    if (painted.canvas) this.groundShadow(pa.x, pa.y - 2, 84, 16); else this.pad(pa.x, this.player && this.player.sheet ? pa.y - 2 : pa.y - 16, 84, 16);
    if (this.artHold) { /* nobody stands around in stand-in art */ }
    else if (this.allies && this.allyActors && this.allyActors.length && this.player && this.player.alpha > 0) {
      // Freed prisoners from the PixelLab sheet stand behind the player's left shoulder.
      this.allyActors.forEach((al, i) => {
        const f = al.frame(t), sc = al.scale, w = Math.round(f.sw * sc), h = Math.round(f.sh * sc);
        g.globalAlpha = this.player.alpha;
        const hd = al.sheet && al.sheet.hd;
        g.drawImage(f.img, f.sx, 0, f.sw, f.sh, Math.round(18 + i * 26 - w / 2), Math.round((hd ? 192 : 184) - h + (hd ? (f.pad || 0) : 8) * sc), w, h);
        g.globalAlpha = 1;
      });
    } else if (this.allies && this.allySprite && this.player && this.player.alpha > 0) {
      for (let i = 0; i < this.allies; i++) {
        const x = 2 + i * 34, y = 216 - 70 + Math.round(Math.sin(t / 650 + i) * 1);
        g.globalAlpha = this.player.alpha; g.drawImage(this.allySprite, 0, 0, 40, 40, x, y, 70, 70); g.globalAlpha = 1;
      }
    }
    if (this.partner && this.player && this.player.alpha > 0) {
      this.partner.alpha = this.player.alpha;
      this.drawActor(this.partner, t);
      if (this.partnerInfo) { const pc = this.center(this.partner); g.fillStyle = this.partnerInfo.acting ? C.amber : 'rgba(221,214,198,.7)'; g.font = '7px monospace'; g.textAlign = 'center'; g.fillText(this.partnerInfo.name.toUpperCase().slice(0, 12), Math.round(pc.x), Math.round(pc.y - this.partner.size * 0.45)); g.textAlign = 'left'; }
    }
    this.drawActor(this.player, t);
    if (this.player && this.player.alpha > 0 && !this.artHold) {
      if (this.partner && this.partnerDrone) this.drawDrone(this.partner, this.partnerDrone, t, 1);
      if (this.drone) this.drawDrone(this.player, this.drone, t, 0);
    }
    if (this.playerShield && this.player) {
      const pc = this.center(this.player);
      g.strokeStyle = `rgba(143,220,255,${0.45 + 0.2 * Math.sin(t / 90)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(pc.x + 10, pc.y, 56, 50, 0, -Math.PI * 0.55, Math.PI * 0.05); g.stroke();
    }

    this.drawBossFx(g, t, E, 'over');
    for (const b of [...this.bolts]) {
      const p = Math.max(0, (t - b.born) / b.dur);
      if (p >= 1) { this.bolts.splice(this.bolts.indexOf(b), 1); continue; }
      const hx = b.from.x + (b.to.x - b.from.x) * p, hy = b.from.y + (b.to.y - b.from.y) * p;
      const len = Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y), tl = Math.min(22, len * p) / len;
      const tx = hx - (b.to.x - b.from.x) * tl, ty = hy - (b.to.y - b.from.y) * tl;
      g.lineCap = 'round';
      g.strokeStyle = b.color; g.globalAlpha = 0.35; g.lineWidth = b.w + 3; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      g.globalAlpha = 1; g.lineWidth = b.w; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo((tx + hx) / 2, (ty + hy) / 2); g.lineTo(hx, hy); g.stroke();
    }
    for (const pr of this.projectiles) { g.fillStyle = '#c39b45'; g.fillRect(Math.round(pr.x) - 2, Math.round(pr.y) - 2, 4, 4); g.fillStyle = '#ff5a44'; g.fillRect(Math.round(pr.x), Math.round(pr.y) - 2, 1, 1); }
    for (const r of [...this.rings]) {
      const p = Math.max(0, (t - r.born) / r.life);
      if (p >= 1) { this.rings.splice(this.rings.indexOf(r), 1); continue; }
      g.strokeStyle = r.color; g.globalAlpha = 1 - p; g.lineWidth = r.w; g.beginPath(); g.ellipse(r.x, r.y, r.r1 * ease(p), r.r1 * ease(p) * 0.8, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    // Backwards and in place: this runs every frame, with up to a few hundred of them.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i], age = Math.max(0, t - pt.born);
      if (age > pt.life) { const last = this.particles.pop(); if (i < this.particles.length) this.particles[i] = last; continue; }
      if (!frozen) {
        pt.vy += pt.g; pt.x += pt.vx; pt.y += pt.vy;
        if (pt.kind === 'casing' && pt.y > pt.floor) { pt.y = pt.floor; pt.vy *= pt.bounced ? 0 : -0.42; pt.vx *= 0.55; pt.g = pt.bounced ? 0 : pt.g; pt.bounced = 1; }
      }
      g.fillStyle = pt.color;
      if (pt.kind === 'casing') {
        // Long then end-on as it tumbles. Not rounded to the stage's grid: these are smaller than a stage pixel's worth of art.
        const flat = pt.bounced && pt.vy === 0, turn = flat || Math.floor(age / 55) % 2 === 0, w = (turn ? 3.4 : 1.6) * pt.size, h = (turn ? 1.5 : 3) * pt.size;
        g.globalAlpha = Math.min(1, (pt.life - age) / (pt.life * 0.3));
        g.fillRect(pt.x - w / 2, pt.y - h / 2, w, h);
        continue;
      }
      g.globalAlpha = 1 - age / pt.life;
      const sz = pt.size > 3 ? pt.size * (1 + age / pt.life) : pt.size;
      g.fillRect(Math.round(pt.x - sz / 2), Math.round(pt.y - sz / 2), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
    }
    g.globalAlpha = 1;
    g.restore();
    if (this.dim > 0) {
      g.fillStyle = `rgba(4,5,7,${this.dim})`; g.fillRect(0, 0, W, H);
      g.save();
      if (Z && Z.k > 1.001) { g.translate(Z.x, Z.y); g.scale(Z.k, Z.k); g.translate(-Z.x, -Z.y); }
      this.drawActor(E, t);
      g.restore();
    }
    const F = this.frameFlash;
    if (F) {
      if (real >= F.until) this.frameFlash = null;
      else { g.globalAlpha = F.alpha * ((F.until - real) / F.ms); g.fillStyle = F.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    }
  }
}
