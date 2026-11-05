// Synthesised sound effects and ambience (Web Audio, no sound files).
// Audio can only start after the player interacts with the page, so everything is lazy.

let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null;
let ambNodes = null;
const prefs = { sfx: true, ambience: true, rain: false, volume: 0.7 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('cinder-cell-audio')) || {}); } catch (e) {}

function save() { try { localStorage.setItem('cinder-cell-audio', JSON.stringify(prefs)); } catch (e) {} }
export const getPrefs = () => ({ ...prefs });

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = prefs.volume; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 1 : 0; sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// Call from any user gesture: unlocks audio and starts ambience if enabled.
export function unlock() { if (ensure()) setAmbience(currentTheme); }

export function setPref(k, v) {
  prefs[k] = v; save();
  if (!ensure()) return;
  master.gain.value = prefs.volume;
  sfxBus.gain.value = prefs.sfx ? 1 : 0;
  if (ambNodes) ambNodes.rainGain.gain.setTargetAtTime(prefs.rain ? 0.35 : 0, ctx.currentTime, 0.3);
  setAmbience(currentTheme);
}

// ---------- building blocks ----------
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function tone({ type = 'square', f0 = 440, f1 = null, a = 0.005, d = 0.15, vol = 0.2, delay = 0, bus = sfxBus, detune = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.detune.value = detune;
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
  env(g, t, a, vol, d);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + a + d + 0.05);
}
function noise({ a = 0.002, d = 0.2, vol = 0.3, filter = 'lowpass', f0 = 2000, f1 = null, q = 1, delay = 0, bus = sfxBus }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = filter; f.frequency.setValueAtTime(f0, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
  env(g, t, a, vol, d);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t, Math.random()); src.stop(t + a + d + 0.05);
}

// ---------- effects ----------
const SFX = {
  step:    () => noise({ d: 0.035, vol: 0.04, filter: 'lowpass', f0: 600 + Math.random() * 300 }),
  click:   () => tone({ type: 'square', f0: 1400, f1: 900, d: 0.03, vol: 0.05 }),
  hover:   () => tone({ type: 'sine', f0: 900, d: 0.02, vol: 0.02 }),
  shot:    () => { noise({ d: 0.08, vol: 0.25, filter: 'highpass', f0: 1800 }); tone({ type: 'square', f0: 1400, f1: 180, d: 0.14, vol: 0.12 }); },
  burst:   () => { for (let i = 0; i < 3; i++) { noise({ d: 0.05, vol: 0.2, filter: 'highpass', f0: 2000, delay: i * 0.07 }); tone({ type: 'square', f0: 1300, f1: 220, d: 0.08, vol: 0.08, delay: i * 0.07 }); } },
  blast:   () => { noise({ d: 0.25, vol: 0.45, filter: 'lowpass', f0: 3000, f1: 300 }); tone({ type: 'sawtooth', f0: 160, f1: 50, d: 0.2, vol: 0.18 }); },
  enemyShot: () => { noise({ d: 0.08, vol: 0.2, filter: 'bandpass', f0: 1200, q: 2 }); tone({ type: 'sawtooth', f0: 700, f1: 120, d: 0.16, vol: 0.1 }); },
  heavyCharge: () => tone({ type: 'sawtooth', f0: 80, f1: 400, a: 0.3, d: 0.1, vol: 0.12 }),
  heavy:   () => { noise({ d: 0.35, vol: 0.5, filter: 'lowpass', f0: 1200, f1: 80 }); tone({ type: 'sine', f0: 120, f1: 40, d: 0.35, vol: 0.4 }); },
  hit:     () => { noise({ d: 0.09, vol: 0.35, filter: 'lowpass', f0: 1600, f1: 200 }); tone({ type: 'sine', f0: 180, f1: 60, d: 0.1, vol: 0.3 }); },
  crit:    () => { SFX.hit(); tone({ type: 'square', f0: 1800, f1: 2600, d: 0.12, vol: 0.08, delay: 0.02 }); tone({ type: 'triangle', f0: 2400, d: 0.25, vol: 0.06, delay: 0.05 }); },
  hurt:    () => { noise({ d: 0.12, vol: 0.3, filter: 'lowpass', f0: 900, f1: 120 }); tone({ type: 'square', f0: 220, f1: 90, d: 0.15, vol: 0.12 }); },
  dodge:   () => noise({ a: 0.03, d: 0.15, vol: 0.15, filter: 'bandpass', f0: 600, f1: 2400, q: 3 }),
  block:   () => { tone({ type: 'triangle', f0: 880, d: 0.15, vol: 0.12 }); tone({ type: 'triangle', f0: 1320, d: 0.2, vol: 0.06, delay: 0.02 }); noise({ d: 0.05, vol: 0.12, filter: 'highpass', f0: 3000 }); },
  shield:  () => { tone({ type: 'sine', f0: 400, f1: 900, a: 0.05, d: 0.25, vol: 0.1 }); tone({ type: 'sine', f0: 600, f1: 1300, a: 0.05, d: 0.25, vol: 0.06 }); },
  heal:    () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'sine', f0: f, d: 0.18, vol: 0.09, delay: i * 0.06 })),
  explosion: () => { noise({ a: 0.005, d: 0.8, vol: 0.7, filter: 'lowpass', f0: 2400, f1: 60 }); tone({ type: 'sine', f0: 90, f1: 30, d: 0.6, vol: 0.5 }); },
  throw:   () => noise({ a: 0.05, d: 0.3, vol: 0.08, filter: 'bandpass', f0: 400, f1: 1200, q: 4 }),
  zap:     () => { tone({ type: 'sawtooth', f0: 2200, f1: 300, d: 0.3, vol: 0.12 }); tone({ type: 'square', f0: 60, d: 0.3, vol: 0.06 }); noise({ d: 0.3, vol: 0.12, filter: 'highpass', f0: 4000 }); },
  smash:   () => { noise({ d: 0.2, vol: 0.5, filter: 'lowpass', f0: 800, f1: 60 }); tone({ type: 'sine', f0: 100, f1: 35, d: 0.3, vol: 0.5 }); },
  whoosh:  () => noise({ a: 0.08, d: 0.25, vol: 0.18, filter: 'bandpass', f0: 300, f1: 1500, q: 2 }),
  smoke:   () => noise({ a: 0.1, d: 0.9, vol: 0.25, filter: 'lowpass', f0: 1200, f1: 200 }),
  status:  () => { tone({ type: 'triangle', f0: 300, f1: 180, d: 0.2, vol: 0.1 }); tone({ type: 'triangle', f0: 310, f1: 190, d: 0.2, vol: 0.08 }); },
  bleed:   () => { noise({ d: 0.12, vol: 0.18, filter: 'lowpass', f0: 500 }); },
  burn:    () => noise({ a: 0.02, d: 0.35, vol: 0.2, filter: 'bandpass', f0: 2500, q: 0.6 }),
  repair:  () => [0, 1, 2].forEach((i) => { noise({ d: 0.04, vol: 0.12, filter: 'highpass', f0: 5000, delay: i * 0.1 }); tone({ type: 'square', f0: 1200 + i * 200, d: 0.05, vol: 0.05, delay: i * 0.1 }); }),
  vent:    () => { noise({ a: 0.15, d: 1.0, vol: 0.4, filter: 'highpass', f0: 600, f1: 2500 }); noise({ a: 0.05, d: 0.6, vol: 0.3, filter: 'lowpass', f0: 300 }); },
  sniper:  () => { noise({ d: 0.04, vol: 0.4, filter: 'highpass', f0: 4000 }); tone({ type: 'sine', f0: 3000, f1: 800, d: 0.25, vol: 0.06, delay: 0.02 }); },
  alarm:   () => [0, 1, 2, 3].forEach((i) => tone({ type: 'square', f0: i % 2 ? 660 : 880, d: 0.14, vol: 0.06, delay: i * 0.16 })),
  coin:    () => { tone({ type: 'square', f0: 1318, d: 0.06, vol: 0.06 }); tone({ type: 'square', f0: 1760, d: 0.18, vol: 0.06, delay: 0.06 }); },
  buy:     () => { SFX.coin(); noise({ d: 0.05, vol: 0.08, filter: 'highpass', f0: 3000, delay: 0.03 }); },
  denied:  () => tone({ type: 'square', f0: 180, d: 0.15, vol: 0.08 }),
  levelup: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ type: 'square', f0: f, d: 0.16, vol: 0.06, delay: i * 0.07 })),
  perk:    () => [392, 523, 659, 988].forEach((f, i) => tone({ type: 'triangle', f0: f, d: 0.35, vol: 0.09, delay: i * 0.09 })),
  door:    () => { tone({ type: 'sine', f0: 70, f1: 45, d: 0.4, vol: 0.35 }); noise({ a: 0.02, d: 0.3, vol: 0.12, filter: 'lowpass', f0: 500 }); },
  enemyDown: () => { tone({ type: 'sawtooth', f0: 400, f1: 60, d: 0.45, vol: 0.12 }); noise({ d: 0.3, vol: 0.2, filter: 'lowpass', f0: 800, f1: 100, delay: 0.1 }); },
  victory: () => [392, 494, 587, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, d: 0.25, vol: 0.1, delay: i * 0.08 })),
  death:   () => { [392, 311, 262, 196].forEach((f, i) => tone({ type: 'sawtooth', f0: f, d: 0.4, vol: 0.08, delay: i * 0.22 })); noise({ a: 0.2, d: 1.2, vol: 0.2, filter: 'lowpass', f0: 400, delay: 0.4 }); },
  bossSting: () => {
    tone({ type: 'sine', f0: 55, f1: 40, a: 0.01, d: 1.6, vol: 0.6 });
    noise({ d: 0.9, vol: 0.5, filter: 'lowpass', f0: 600, f1: 50 });
    [110, 131, 165].forEach((f, i) => { tone({ type: 'sawtooth', f0: f, a: 0.08, d: 1.4, vol: 0.07, delay: 0.25 }); tone({ type: 'sawtooth', f0: f, a: 0.08, d: 1.4, vol: 0.05, delay: 0.25, detune: 12 }); });
  },
  bossName: () => { tone({ type: 'square', f0: 220, d: 0.08, vol: 0.06 }); noise({ d: 0.12, vol: 0.12, filter: 'highpass', f0: 2500 }); },
  enrage:  () => { tone({ type: 'sawtooth', f0: 90, f1: 60, a: 0.05, d: 0.8, vol: 0.2 }); noise({ a: 0.05, d: 0.6, vol: 0.3, filter: 'lowpass', f0: 1000, f1: 100 }); },
  liberate: () => [262, 330, 392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, d: 0.6, vol: 0.08, delay: i * 0.12 })),
};

export function play(name) {
  if (!prefs.sfx || !ensure() || !SFX[name]) return;
  try { SFX[name](); } catch (e) {}
}

// ---------- ambience: a low drone that changes per map, plus optional filtered rain (off by default) ----------
let currentTheme = null;
const DRONES = { garrison: [55, 82.4], foundry: [49, 73.4], detention: [61.7, 92.5], port: [65.4, 98], town: [58.3, 87.3] };
export function setAmbience(theme) {
  currentTheme = theme;
  if (!ctx) return;
  const on = prefs.ambience && theme;
  ambBus.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.6);
  if (!on) return;
  if (ambNodes && ambNodes.theme === theme) return;
  if (ambNodes) { const old = ambNodes; setTimeout(() => old.stop(), 1500); old.fade(); }
  const t = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 1.5); g.connect(ambBus);
  const rain = ctx.createBufferSource(), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
  rain.buffer = noiseBuf; rain.loop = true; rf.type = 'bandpass'; rf.frequency.value = theme === 'foundry' ? 500 : 2500; rf.Q.value = 0.4; rg.gain.value = prefs.rain ? 0.35 : 0;
  rain.connect(rf); rf.connect(rg); rg.connect(g); rain.start();
  const oscs = (DRONES[theme] || DRONES.town).map((f, i) => {
    const o = ctx.createOscillator(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = i ? 'triangle' : 'sine'; o.frequency.value = f; og.gain.value = i ? 0.12 : 0.3;
    lfo.frequency.value = 0.07 + i * 0.05; lg.gain.value = 0.08; lfo.connect(lg); lg.connect(og.gain);
    o.connect(og); og.connect(g); o.start(); lfo.start();
    return [o, lfo];
  });
  ambNodes = {
    theme, rainGain: rg,
    fade: () => g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4),
    stop: () => { try { rain.stop(); oscs.forEach(([o, l]) => { o.stop(); l.stop(); }); g.disconnect(); } catch (e) {} },
  };
}
