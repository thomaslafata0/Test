// Synthesised sound effects and ambience (Web Audio, no sound files).
// Audio can only start after the player interacts with the page, so everything is lazy.

let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null;
let ambNodes = null;
const prefs = { muted: false, muteHidden: false, haptics: true, sfx: true, ambience: false, rain: false, music: true, musicVolume: 0.2, volume: 0.7 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('cinder-cell-audio')) || {}); } catch (e) {}

function save() { try { localStorage.setItem('cinder-cell-audio', JSON.stringify(prefs)); } catch (e) {} }
export const getPrefs = () => ({ ...prefs });

function ensure() {
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return ctx; } // iOS rejects resume() while the app is in the background
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = prefs.muted ? 0 : prefs.volume; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 1 : 0; sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// Call from any user gesture: unlocks audio and starts ambience and music if enabled.
export function unlock() { unlocked = true; if (ensure()) setAmbience(currentTheme); startMusic(); }

export function setPref(k, v) {
  prefs[k] = v; save();
  if (!ensure()) return;
  master.gain.value = prefs.muted ? 0 : prefs.volume;
  sfxBus.gain.value = prefs.sfx ? 1 : 0;
  if (ambNodes) ambNodes.rainGain.gain.setTargetAtTime(prefs.rain ? 0.35 : 0, ctx.currentTime, 0.3);
  setAmbience(currentTheme);
  startMusic();
}

// ---------- music: two looping tracks (town, raid), crossfaded. Quiet by design. ----------
const TRACKS = { town: 'music/town.mp3', raid: 'music/raid.mp3' };
const music = {}; // id -> HTMLAudioElement
let unlocked = false, wantTrack = 'town', duck = 1;
// The death screen pulls the music right down while the record reads out.
export function duckMusic(on) { const d = on ? 0.2 : 1; if (d === duck) return; duck = d; startMusic(); }
function trackFor(theme) { return theme === 'town' || !theme ? 'town' : 'raid'; }
export function setMusic(theme) { wantTrack = trackFor(theme); startMusic(); }
// iPhones ignore an audio element's volume, so the tracks go through the mixer. The old track is always stopped once it has faded.
const musicGain = {};
let musicStop = null;
function startMusic() {
  if (!unlocked) return;
  const on = prefs.music && !prefs.muted, c = ensure();
  for (const id of Object.keys(TRACKS)) {
    if (!music[id]) { const a = new Audio(TRACKS[id]); a.loop = true; a.preload = 'auto'; a.volume = c ? 1 : 0; music[id] = a; }
    const a = music[id];
    if (c && !musicGain[id]) {
      try { const g = c.createGain(); g.gain.value = 0; c.createMediaElementSource(a).connect(g); g.connect(master); musicGain[id] = g; a.volume = 1; } catch (e) {}
    }
    const wanted = on && id === wantTrack;
    if (musicGain[id]) musicGain[id].gain.setTargetAtTime(wanted ? prefs.musicVolume * duck : 0, c.currentTime, 0.25);
    else a.volume = wanted ? prefs.musicVolume * prefs.volume * duck : 0;
    if (wanted && a.paused) a.play().catch(() => {});
  }
  clearTimeout(musicStop);
  musicStop = setTimeout(() => { for (const id of Object.keys(music)) if (!(on && id === wantTrack) && !music[id].paused) music[id].pause(); }, 1400);
  applyBoss();
}

// ---------- boss layer: only two music files exist, so tension is synthesised. A low pulsing drone and a heartbeat, on the music's volume and mute. ----------
let bossWant = false, bossFast = false, boss = null, bossBeat = null, bossOff = null;
const bossLevel = () => (prefs.music && !prefs.muted ? Math.min(0.9, prefs.musicVolume * 2.4) : 0);
const bossActive = () => bossWant && unlocked && bossLevel() > 0 && !(typeof document !== 'undefined' && document.hidden);
function heartbeat() {
  bossBeat = null;
  if (!boss || !ctx) return;
  if (ctx.state === 'running') {
    tone({ type: 'sine', f0: 62, f1: 36, a: 0.008, d: 0.16, vol: 0.85, bus: boss.gain });
    tone({ type: 'sine', f0: 54, f1: 32, a: 0.008, d: 0.2, vol: 0.55, delay: 0.24, bus: boss.gain });
    tone({ type: 'triangle', f0: 190, f1: 95, a: 0.004, d: 0.08, vol: 0.32, bus: boss.gain }); // the part a phone speaker can actually play
    tone({ type: 'triangle', f0: 160, f1: 85, a: 0.004, d: 0.09, vol: 0.2, delay: 0.24, bus: boss.gain });
  }
  bossBeat = setTimeout(heartbeat, bossFast ? 780 : 1150);
}
function bossStart() {
  clearTimeout(bossOff); bossOff = null;
  if (boss) return;
  const t = ctx.currentTime, gain = ctx.createGain(), filter = ctx.createBiquadFilter(), pulse = ctx.createGain(), lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
  gain.gain.setValueAtTime(0, t); gain.connect(master);
  // A phone's speaker has next to nothing below about 200Hz, so the filter lets some of the saws' upper harmonics through.
  filter.type = 'lowpass'; filter.frequency.value = 400; filter.Q.value = 1.5;
  pulse.gain.value = 0.2; pulse.connect(filter); filter.connect(gain);
  lfo.frequency.value = 0.85; lfoAmt.gain.value = 0.09; lfo.connect(lfoAmt); lfoAmt.connect(pulse.gain);
  const oscs = [[41.2, 'sawtooth', 0], [41.2, 'sawtooth', 9], [82.4, 'sawtooth', 5], [61.7, 'triangle', -6]].map(([f, type, det]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(pulse); o.start(); return o; });
  lfo.start();
  boss = { gain, lfo, oscs };
  heartbeat();
}
function bossStop() {
  if (!boss || bossOff) return;
  bossOff = setTimeout(() => {
    bossOff = null;
    if (!boss) return;
    const b = boss; boss = null; clearTimeout(bossBeat); bossBeat = null;
    try { b.oscs.forEach((o) => o.stop()); b.lfo.stop(); b.gain.disconnect(); } catch (e) {}
  }, 2500);
}
function applyBoss() {
  if (!unlocked || !ctx) return;
  if (bossActive()) { bossStart(); boss.gain.gain.setTargetAtTime(bossLevel(), ctx.currentTime, 0.9); }
  else if (boss) { boss.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5); bossStop(); }
}
// Safe to call on every render: nothing happens unless the answer changed.
export function setBossLayer(on, fast = false) {
  bossFast = !!fast;
  if (on === bossWant) return;
  bossWant = !!on; applyBoss();
}
export const bossLayerState = () => ({ want: bossWant, running: !!boss, fading: !!bossOff, level: bossActive() ? bossLevel() : 0 });

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
  crit:    () => { SFX.hit(); tone({ type: 'sine', f0: 110, f1: 38, d: 0.28, vol: 0.42 }); noise({ d: 0.05, vol: 0.2, filter: 'highpass', f0: 3200 }); tone({ type: 'square', f0: 1800, f1: 2600, d: 0.12, vol: 0.08, delay: 0.02 }); tone({ type: 'triangle', f0: 2400, d: 0.3, vol: 0.07, delay: 0.05 }); },
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
  // Button presses, matched to what's being pressed. Short, so they don't sit on top of what the button then does.
  press:    () => tone({ type: 'square', f0: 1500, f1: 1000, d: 0.025, vol: 0.045 }),
  pressBig: () => { tone({ type: 'square', f0: 620, f1: 300, d: 0.05, vol: 0.06 }); noise({ d: 0.03, vol: 0.05, filter: 'lowpass', f0: 1800 }); },
  pressTab: () => tone({ type: 'triangle', f0: 1050, f1: 1250, d: 0.03, vol: 0.06 }),
  pressDoor: () => { tone({ type: 'sine', f0: 150, f1: 80, d: 0.08, vol: 0.2 }); noise({ d: 0.05, vol: 0.09, filter: 'bandpass', f0: 900, q: 1.5 }); },
  casing:  () => [0, 0.09].forEach((d, i) => tone({ type: 'triangle', f0: 3600 - i * 500, d: 0.03, vol: 0.018, delay: 0.22 + d })),
  rareDrop: () => {
    tone({ type: 'sine', f0: 110, f1: 55, d: 0.5, vol: 0.28 });
    [659, 880, 1109, 1319, 1760].forEach((f, i) => { tone({ type: 'triangle', f0: f, d: 0.5, vol: 0.075, delay: 0.05 + i * 0.07 }); tone({ type: 'sine', f0: f * 2, d: 0.3, vol: 0.022, delay: 0.05 + i * 0.07 }); });
  },
  levelBurst: () => { SFX.levelup(); tone({ type: 'sine', f0: 196, f1: 392, a: 0.02, d: 0.35, vol: 0.2 }); noise({ a: 0.01, d: 0.3, vol: 0.09, filter: 'highpass', f0: 4000, delay: 0.32 }); },
  deathTick: () => { tone({ type: 'sine', f0: 92, f1: 70, d: 0.2, vol: 0.2 }); noise({ d: 0.03, vol: 0.035, filter: 'highpass', f0: 2600 }); },
  deathToll: () => { tone({ type: 'sine', f0: 65, f1: 49, a: 0.02, d: 1.5, vol: 0.45 }); tone({ type: 'triangle', f0: 196, f1: 185, a: 0.01, d: 1.1, vol: 0.05 }); },
  tally:   () => tone({ type: 'square', f0: 1000, d: 0.02, vol: 0.022 }),
  tallyDone: () => { tone({ type: 'square', f0: 880, d: 0.04, vol: 0.045 }); tone({ type: 'square', f0: 1320, d: 0.08, vol: 0.045, delay: 0.04 }); },
};

// In the iPhone app, the big moments buzz too. Works with the sound off; throttled so autoplay doesn't rattle.
const BUZZ = { click: 'selection', buy: 'light', coin: 'light', hit: 'light', block: 'soft', dodge: 'soft', hurt: 'medium', blast: 'medium', crit: 'rigid', heavy: 'heavy', smash: 'heavy', explosion: 'heavy', enrage: 'heavy', denied: 'warning', alarm: 'warning', death: 'error', levelup: 'success', perk: 'success', victory: 'success', liberate: 'success' };
const buzzer = () => (typeof window !== 'undefined' && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic) || null;
let lastBuzz = 0;
// The big hits are a short pattern, not one tap. Steps sit further apart than the throttle in haptic().
const BUZZ_SEQ = { crit: ['heavy', 'rigid', 'rigid'], heavy: ['heavy', 'medium'], smash: ['heavy', 'rigid'], explosion: ['heavy', 'heavy', 'medium'], enrage: ['heavy', 'heavy'], death: ['error', 'heavy', 'heavy'], rareDrop: ['rigid', 'success'], levelBurst: ['medium', 'success'] };
export const hasHaptics = () => !!buzzer();
export function haptic(kind) {
  const b = buzzer(), now = Date.now();
  if (!b || !prefs.haptics || now - lastBuzz < 70) return;
  lastBuzz = now;
  try { b.postMessage(kind); } catch (e) {}
}

export function play(name) {
  if (BUZZ_SEQ[name]) { if (buzzer()) BUZZ_SEQ[name].forEach((k, i) => { if (i) setTimeout(() => haptic(k), i * 90); else haptic(k); }); }
  else if (BUZZ[name]) haptic(BUZZ[name]);
  // A press already made its own sound; the click that follows it shouldn't repeat it. (The buzz above still fires.)
  if (name === 'click' && Date.now() - lastPress < 600) return;
  if (prefs.muted || !prefs.sfx || !ensure() || !SFX[name]) return;
  try { SFX[name](); } catch (e) {}
}
let lastPress = 0;
export function press(kind) { lastPress = Date.now(); play(kind); }

// ---------- ambience: a low drone that changes per map, plus optional filtered rain (off by default) ----------
let currentTheme = null;
const DRONES = { garrison: [55, 82.4], foundry: [49, 73.4], detention: [61.7, 92.5], port: [65.4, 98], reach: [43.7, 65.4], town: [58.3, 87.3] };
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

// On a phone, going to the background silences the game; coming back picks up where it was. Elsewhere that's a setting.
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', applyBoss); // the boss layer never plays while the app is hidden
if (typeof document !== 'undefined' && typeof matchMedia === 'function') {
  const phone = matchMedia('(pointer: coarse)').matches;
  document.addEventListener('visibilitychange', () => {
    if (!phone && !prefs.muteHidden) return;
    if (document.visibilityState === 'hidden') {
      for (const a of Object.values(music)) a.pause();
      if (ctx && ctx.state === 'running') ctx.suspend();
    } else {
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); // iOS can leave it 'interrupted' after a call
      startMusic();
    }
  });
}
