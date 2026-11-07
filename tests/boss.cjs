// Boss fights on a phone held sideways: the fallen line, first meetings, signature moves on the stage, the speech card, defeat scenes, area lines, the Codex, reduced motion, a co-op friend's view.
// Screenshots go to tests/shots/boss-*.png. Halvek's art is what exists at full resolution, so the visuals are checked on him.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
const SAVE = 'cinder-cell-save-v1';
let failed = 0;
const errs = [];
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };

const TO_BOSS = (map, sector) => `s.meta.bestSector = 99; E.deploy(s, '${map}', 1, rng); s.run.sector = ${sector}; s.run.room = 2; s.run.choices = null; s.run.bulletin = 'quiet'; E.offerRoute(s, rng); for (let i = 0; i < 8 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); } s.char.hp = E.stats(s).maxHp;`;
async function load(p, src) {
  await p.evaluate(async ([src, SAVE]) => {
    const E = await import('./engine.js'), D = await import('./data.js'), rng = E.seededRng(11), s = E.newGame(rng);
    E.createChar(s, rng); s.screen = 'town'; const c = s.char;
    await eval(`(async () => { ${src} })()`);
    localStorage.setItem(SAVE, JSON.stringify(s));
    localStorage.removeItem('cinder-cell-boss-seen');
  }, [src, SAVE]);
  await p.reload(); await p.waitForTimeout(350);
  await p.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {});
  await p.waitForTimeout(200);
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/boss-${n}.png` });
// Past the intro and into the fight.
async function pastIntro(p) {
  for (let i = 0; i < 8 && await p.evaluate(() => !document.querySelector('.cine').hidden); i++) { await p.click('.cine', { force: true }).catch(() => {}); await p.waitForTimeout(300); }
}
// Bring a move up on the intent line, in the page's own game, and let the page draw it.
const force = (p, move, phase) => p.evaluate(async ([move, phase]) => {
  const g = globalThis.cinderGame, s = g.state(), e = s.run.enemy, E = await import('./engine.js'), D = await import('./data.js');
  e.sig = null; e.intent = 'attack'; e.hp = e.maxHp; e.stun = 0;
  if (phase) e.bs.phase = phase;
  s.char.hp = E.stats(s).maxHp;
  const id = e.id, m = D.BOSS_KIT[id].moves[move];
  if (e.bs.phase > m.from) e.bs.phase = m.from;
  e.next = `sig:${move}`;
  g.after();
}, [move, phase]);
const press = async (p, sel = 'button[data-a="act"][data-v="defend"]') => { await p.click(sel); };
const idle = (p) => p.waitForFunction(() => !document.getElementById('app').classList.contains('busy'), null, { timeout: 12000 });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: false });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(400);
  await p.evaluate(() => { localStorage.setItem('cinder-cell-speed', JSON.stringify('manual')); });

  // --- The fallen line: a real death, then the next operative.
  await load(p, TO_BOSS('garrison', 5).replace(/s\.char\.hp = .*$/, '') + `s.run.enemy.atk = 1e6; s.run.enemy.intent = 'attack'; for (let i = 0; i < 30 && s.screen === 'combat'; i++) { s.run.enemy.intent = 'attack'; s.char.hp = 1; E.playerAct(s, 'defend', rng, 0); } s.screen = s.screen;`);
  check('fallen: the death screen came up', await p.evaluate(() => globalThis.cinderGame.state().screen === 'death'));
  await p.evaluate(() => { const d = globalThis.cinderGame.death; if (d.playing) document.body.click(); });
  await p.waitForTimeout(150);
  await p.click('button[data-a="recruit"]'); await p.waitForTimeout(200);
  await p.click('button[data-a="step"][data-v="4"]'); await p.waitForTimeout(150);
  await p.click('button[data-a="create"]'); await p.waitForTimeout(300);
  let t = await p.evaluate(() => { const b = document.querySelector('.scene-beat'), l = document.querySelector('.scene-wrap .label'); return { beat: b && b.textContent, label: l && l.textContent, size: b ? parseFloat(getComputedStyle(b).fontSize) : 0, fallen: (globalThis.cinderGame.state().meta.feats.counters.fallen) }; });
  check('fallen: a new operative gets the line, big', t.beat && t.beat.length > 20 && t.size >= 16 && t.fallen === 1, JSON.stringify(t));
  check('fallen: it reads as one dead, not several', !/\b1 operatives\b|\{|\bno operatives\b/.test(t.beat || ''));
  await shot(p, 'fallen');
  await p.click('button[data-a="scenenext"]'); await p.waitForTimeout(150);
  check('fallen: a tap goes on to the yard', await p.evaluate(() => !document.querySelector('.scene-wrap') && globalThis.cinderGame.state().screen === 'town'));

  // A brand-new cell: the first operative hears that the wall is bare.
  await p.evaluate(() => localStorage.removeItem('cinder-cell-save-v1')); await p.reload(); await p.waitForTimeout(400);
  await p.click('button[data-a="continue-title"]', { timeout: 1500 }).catch(() => {}); await p.click('button[data-a="begin"]', { timeout: 1000 }).catch(() => {}); await p.waitForTimeout(250);
  if (await p.$('button[data-a="step"][data-v="4"]')) {
    await p.click('button[data-a="step"][data-v="4"]'); await p.waitForTimeout(100); await p.click('button[data-a="create"]'); await p.waitForTimeout(250);
    const beat = await p.evaluate(() => (document.querySelector('.scene-beat') || {}).textContent);
    check('fallen: a new cell has no names yet', /wall|Nobody|No one|No names/i.test(beat || '') && !/\d/.test(beat || ''), beat);
    await p.click('button[data-a="scenenext"]');
  } else check('fallen: reached creation on a new cell', false);

  // --- First meeting: the beats, one at a time. A tap moves on.
  await load(p, TO_BOSS('garrison', 5));
  await p.waitForFunction(() => document.querySelector('.cine.say'), null, { timeout: 5000 });
  const beats = await p.evaluate(() => globalThis.cinderGame.state().run.enemy.intro.beats);
  check('first meeting: more than one beat', beats.length > 1 && (await p.evaluate(() => globalThis.cinderGame.state().run.enemy.intro.first)), JSON.stringify(beats));
  await p.waitForTimeout(500); await shot(p, 'intro-1');
  check('first meeting: the card is on screen', await p.evaluate(() => { const c = document.querySelector('.cine-card'), r = c.getBoundingClientRect(), s = document.querySelector('.stage').getBoundingClientRect(); return getComputedStyle(c).opacity === '1' && r.height > 20 && r.bottom <= s.bottom + 1 && parseFloat(getComputedStyle(document.querySelector('.cine-line')).opacity) > 0.5; }));
  check('first meeting: the first beat shows', (await p.evaluate(() => document.querySelector('.cine-line').textContent)) === beats[0]);
  await p.click('.cine', { force: true }); await p.waitForTimeout(120);
  check('first meeting: a tap shows the next', (await p.evaluate(() => document.querySelector('.cine-line').textContent)) === beats[1]);
  await shot(p, 'intro-2');
  check('first meeting: reaching the end marks the scene for the cell', await p.evaluate(() => !!(globalThis.cinderGame.state().meta.sceneSeen || {})['intro:halvek:garrison']));
  await p.click('.cine', { force: true }); await p.waitForTimeout(200);
  check('first meeting: the last tap closes it', await p.evaluate(() => document.querySelector('.cine').hidden && !document.getElementById('app').classList.contains('busy')));
  await p.reload(); await p.waitForTimeout(350); await p.click('button[data-a="continue-title"]', { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(400);
  check('first meeting: a reload mid-fight does not replay it', await p.evaluate(() => document.querySelector('.cine').hidden && !!globalThis.cinderGame.state().run.enemy));

  // --- A move on the stage, with the sheet's fallback, then with sig art present.
  const sheetAnims = await p.evaluate(() => Object.keys(globalThis.cinderGame.stage.enemy.sheet.anims));
  console.log('halvek anims:', sheetAnims.join(','));
  await force(p, 'shutter'); await press(p); await idle(p); await p.waitForTimeout(150);
  let v = await p.evaluate(() => { const i = document.querySelector('.intent'), s = globalThis.cinderGame.state(); return { label: i.querySelector('b').textContent, tip: i.querySelector('.tip').textContent, sig: s.run.enemy.sig && s.run.enemy.sig.id, say: document.querySelector('.bsay:not([hidden]) .bsay-text') ? document.querySelector('.bsay .bsay-text').textContent : '' }; });
  check('shutter: telegraphed on the intent line', v.sig === 'shutter' && /Shutter/.test(v.label) && /half/.test(v.tip), JSON.stringify(v));
  check('shutter: a shout in the speech card', /shutter|chain/i.test(v.say), v.say);
  await shot(p, 'telegraph-shutter');
  // The card must never sit between a thumb and a button.
  const blocked = await p.evaluate(() => { const c = document.querySelector('.bsay'), r = c.getBoundingClientRect(); const seen = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { pe: getComputedStyle(c).pointerEvents, h: r.height, w: r.width, size: parseFloat(getComputedStyle(c.querySelector('.bsay-text')).fontSize), hit: seen && seen.className }; });
  check('speech card: takes no taps', blocked.pe === 'none' && blocked.hit !== 'bsay', JSON.stringify(blocked));
  check('speech card: readable size', blocked.size >= 12);
  const overlap = await p.evaluate(() => { const c = document.querySelector('.bsay').getBoundingClientRect(); return [...document.querySelectorAll('.actions .btn, .skills .btn, .items .btn')].filter((x) => { const r = x.getBoundingClientRect(); return r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top; }).length; });
  check('speech card: not over the action buttons', overlap === 0, `${overlap}`);
  const fit = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth, btn: [...document.querySelectorAll('.actions .btn')].every((x) => { const r = x.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height >= 38; }) }));
  check('telegraph: the screen still fits, buttons on it and big enough', fit.h <= fit.ih + 1 && fit.w <= fit.iw + 1 && fit.btn, JSON.stringify(fit));
  await press(p); await idle(p); await p.waitForTimeout(200);
  const after = await p.evaluate(() => { const g = globalThis.cinderGame, s = g.state(); return { log: g.stage.sigLog.slice(-1)[0], shutter: s.run.enemy.bs.shutter, run: document.querySelector('button[data-a="act"][data-v="run"]').disabled, chip: [...document.querySelectorAll('.intent-side .chip')].map((x) => x.textContent).join(',') }; });
  const wantFallback = sheetAnims.includes('sig1') ? 'sig1' : sheetAnims.includes('special') ? 'special' : 'attack';
  check('shutter: plays the right animation', after.log && after.log.anim === wantFallback, JSON.stringify(after.log));
  check('shutter: in force, Run disabled, chip shown', after.shutter === 2 && after.run && /Shutter 2/.test(after.chip), JSON.stringify(after));
  await shot(p, 'shutter-down');

  await p.evaluate(() => { const st = globalThis.cinderGame.stage, a = st.enemy.sheet.anims; a.sig2 = { ...(a.special || a.attack) }; });
  await force(p, 'confiscate'); await press(p); await idle(p);
  const stim0 = await p.evaluate(() => globalThis.cinderGame.state().char.items.stim);
  await p.evaluate(() => { const s = globalThis.cinderGame.state(); s.run.enemy.next = 'attack'; });
  await press(p); await idle(p); await p.waitForTimeout(100);
  const c2 = await p.evaluate(() => { const g = globalThis.cinderGame; return { log: g.stage.sigLog.slice(-1)[0], stim: g.state().char.items.stim, played: g.stage.enemy.anim }; });
  check('confiscate: sig2 art plays when the sheet has it', c2.log && c2.log.anim === 'sig2' && c2.log.sig === 'confiscate', JSON.stringify(c2.log));
  check('confiscate: the stim is gone', c2.stim === stim0 - 1);
  await p.evaluate(() => { const a = globalThis.cinderGame.stage.enemy.sheet.anims; delete a.sig2; });

  const chain = await p.evaluate(() => { const st = globalThis.cinderGame.stage, f = (...k) => st.sigAnim({ sheet: { anims: Object.fromEntries(k.map((x) => [x, {}])) } }, 1); return [f('sig1', 'special', 'attack'), f('special', 'attack'), f('attack'), f('sig2', 'attack')]; });
  check('art fallback: sigN, then special, then attack', JSON.stringify(chain) === JSON.stringify(['sig1', 'special', 'attack', 'attack']), JSON.stringify(chain));
  // Counter on the real buttons.
  await force(p, 'confiscate'); await press(p); await idle(p);
  const s1 = await p.evaluate(() => globalThis.cinderGame.state().char.items.stim);
  await p.evaluate(() => { globalThis.cinderGame.state().run.enemy.next = 'attack'; });
  await press(p, 'button[data-a="act"][data-v="strike"]'); await idle(p); await p.waitForTimeout(100);
  check('confiscate: Strike on the button stops it', await p.evaluate((s1) => { const s = globalThis.cinderGame.state(); return s.char.items.stim === s1 && !s.run.enemy.sig; }, s1));

  // --- Phase line: a card with the mechanical note, at 844 x 390.
  await p.evaluate(() => { const g = globalThis.cinderGame, s = g.state(), e = s.run.enemy; e.sig = null; e.intent = 'attack'; e.next = 'attack'; e.bs.phase = 100; e.bs.shutter = 0; e.hp = Math.round(e.maxHp * 0.55); e.atk = 1; s.char.hp = 300; e.def = 0; g.after(); });
  await press(p, 'button[data-a="act"][data-v="shoot"]');
  await p.waitForFunction(() => { const c = document.querySelector('.bsay:not([hidden])'); return c && globalThis.cinderGame.state().run.enemy.bs.phase < 100; }, null, { timeout: 5000 });
  await idle(p); await p.waitForTimeout(100); await shot(p, 'phase');
  const ph = await p.evaluate(() => { const c = document.querySelector('.bsay'), n = c.querySelector('.bsay-note'), r = c.getBoundingClientRect(), st = document.querySelector('.stage').getBoundingClientRect(); return { text: c.querySelector('.bsay-text').textContent, note: n.textContent, noteSize: parseFloat(getComputedStyle(n).fontSize), inside: r.top >= st.top && r.bottom <= st.bottom + 1, phase: globalThis.cinderGame.state().run.enemy.bs.phase, h: r.height, sh: st.height }; });
  check('phase: the line and what changed', ph.text.length > 5 && ph.note.length > 5 && ph.noteSize >= 11, JSON.stringify(ph));
  check('phase: card inside the stage', ph.inside);

  // Desktop: the HUD floats over the picture, and the card must not hide it.
  await p.setViewportSize({ width: 1200, height: 800 }); await p.waitForTimeout(150);
  await p.evaluate(() => { const g = globalThis.cinderGame; g.stage.speak({ text: 'Halvek checks his watch. \u201CYou\u2019re making me late for the count.\u201D', note: 'Gatehouse Shutter opens up.', n: 999 }); });
  await p.waitForTimeout(250); await shot(p, 'desktop');
  const dk = await p.evaluate(() => { const c = document.querySelector('.bsay').getBoundingClientRect(), hud = [...document.querySelectorAll('.hud')].filter((h) => { const r = h.getBoundingClientRect(); return r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top; }); return hud.length; });
  check('desktop: the card leaves the HP bars clear', dk === 0, `${dk}`);
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(150);

  // --- Auto battle: lines don't hold it up.
  await load(p, TO_BOSS('garrison', 5) + `s.char.bossMet = { 'halvek:garrison': 1 };`);
  await pastIntro(p);
  await p.evaluate(() => { const g = globalThis.cinderGame, s = g.state(), e = s.run.enemy; e.maxHp = e.hp = 100000; e.atk = 1; s.char.hp = E_max(); function E_max() { return s.char.hp; } g.stage.setMode('auto2'); });
  const t0 = Date.now(); let acts = 0; const r0 = await p.evaluate(() => globalThis.cinderGame.state().run.round);
  await p.waitForTimeout(9000);
  const r1 = await p.evaluate(() => globalThis.cinderGame.state().run.round);
  acts = r1 - r0;
  check('auto battle: keeps moving through a boss fight', acts >= 4, `${acts} rounds in ${Date.now() - t0}ms`);
  await p.evaluate(() => globalThis.cinderGame.stage.setMode('manual')); await idle(p);

  // --- First defeat: a scene that can be read or skipped; once seen, only its last beat.
  const win = `const e = s.run.enemy; e.hp = 1; e.intent = 'guard'; e.next = 'guard'; s.char.hp = 500;`;
  await load(p, TO_BOSS('garrison', 5) + `s.char.bossMet = { 'halvek:garrison': 1 }; ${win}`);
  await pastIntro(p); await idle(p);
  await press(p, 'button[data-a="act"][data-v="strike"]');
  await p.waitForSelector('.scene-wrap', { timeout: 8000 });
  await p.waitForTimeout(600);
  const sc = await p.evaluate(() => ({ beat: document.querySelector('.scene-beat').textContent, n: globalThis.cinderGame.state().scene.beats.length, btn: [...document.querySelectorAll('.scene .btn')].map((x) => x.textContent), h: Math.max(...[...document.querySelectorAll('.scene .btn')].map((x) => x.getBoundingClientRect().height)) }));
  check('first defeat: the scene shows', sc.n >= 3 && sc.beat.length > 10 && sc.h >= 38, JSON.stringify(sc));
  await shot(p, 'defeat-1');
  for (let i = 0; i < sc.n - 1; i++) { await p.click('.scene button[data-a="scenenext"]'); await p.waitForTimeout(120); }
  const lastBeat = await p.evaluate(() => ({ note: (document.querySelector('.scene-note') || {}).textContent, over: document.querySelector('.scene').scrollHeight <= document.querySelector('.scene').clientHeight + 1 }));
  check('first defeat: ends on the note', lastBeat.note && lastBeat.note.length > 10 && lastBeat.over, JSON.stringify(lastBeat));
  await shot(p, 'defeat-note');
  check('first defeat: the cell has now seen it', await p.evaluate(() => !!globalThis.cinderGame.state().meta.sceneSeen['defeat:halvek:garrison']));
  await p.click('.scene button[data-a="scenenext"]'); await p.waitForTimeout(200);
  check('first defeat: closes and stays closed', await p.evaluate(() => !document.querySelector('.scene-wrap') && !globalThis.cinderGame.state().scene));
  // A later operative: only the last beat. The same operative again: no scene.
  await load(p, `s.meta.sceneSeen = { 'defeat:halvek:garrison': 1 }; ` + TO_BOSS('garrison', 5) + `s.char.bossMet = { 'halvek:garrison': 1 }; ${win}`);
  await pastIntro(p); await idle(p);
  await press(p, 'button[data-a="act"][data-v="strike"]'); await p.waitForSelector('.scene-wrap', { timeout: 8000 });
  const later = await p.evaluate(() => ({ n: globalThis.cinderGame.state().scene.beats.length, note: !!document.querySelector('.scene-note'), skip: !!document.querySelector('button[data-a="sceneskip"]') }));
  check('later operative: last beat only, with the note', later.n === 1 && later.note, JSON.stringify(later));
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  await load(p, TO_BOSS('garrison', 5) + `s.char.bossMet = { 'halvek:garrison': 1 }; s.char.bossBeat = { 'halvek:garrison': 1 }; ${win}`);
  await pastIntro(p); await idle(p);
  await press(p, 'button[data-a="act"][data-v="strike"]');
  await p.waitForFunction(() => globalThis.cinderGame.state().screen !== 'combat' && !document.getElementById('app').classList.contains('busy'), null, { timeout: 8000 });
  await p.waitForTimeout(250);
  const rep = await p.evaluate(() => ({ scene: !!document.querySelector('.scene-wrap'), line: globalThis.cinderGame.state().lastResult && globalThis.cinderGame.state().lastResult.defeatLine, screen: globalThis.cinderGame.state().screen }));
  check('repeat win: no scene, a defeat line', !rep.scene && rep.line, JSON.stringify(rep));
  await shot(p, 'repeat-win');
  // Skip works.
  await load(p, TO_BOSS('garrison', 5) + `s.char.bossMet = { 'halvek:garrison': 1 }; ${win}`);
  await pastIntro(p); await idle(p);
  await press(p, 'button[data-a="act"][data-v="strike"]'); await p.waitForSelector('button[data-a="sceneskip"]', { timeout: 8000 });
  await p.click('button[data-a="sceneskip"]'); await p.waitForTimeout(150);
  check('skip: ends it, and it plays in full next time', await p.evaluate(() => !document.querySelector('.scene-wrap') && !(globalThis.cinderGame.state().meta.sceneSeen || {})['defeat:halvek:garrison']));

  // --- Area lines on the route screen.
  await load(p, `E.deploy(s, 'garrison', 1, rng);`);
  await p.waitForTimeout(150);
  const al = await p.evaluate(() => { const a = document.querySelector('.area-line'), doors = [...document.querySelectorAll('.door')]; const sec = document.querySelector('.screen-route'); return { text: a && a.textContent, size: a ? parseFloat(getComputedStyle(a).fontSize) : 0, doorsIn: doors.length && doors.every((d) => d.getBoundingClientRect().bottom <= innerHeight + 1), scrolls: sec.scrollHeight > sec.clientHeight + 1 }; });
  check('area line: on arrival', /Floodlights/.test(al.text || '') && al.size >= 12, JSON.stringify(al));
  check('area line: the doors still fit', al.doorsIn && !al.scrolls, JSON.stringify(al));
  await shot(p, 'area-line');

  // --- Codex: from the menu, notice on a new entry, the phone's rules.
  await load(p, `s.meta.codexSeen = ['yard', 'name']; s.meta.feats.counters.fallen = 1; s.char.number = 2;`);
  await p.waitForTimeout(100);
  const toastT = await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
  check('codex: a notice when an entry opens', /Codex: The Wall/.test(toastT), toastT);
  await p.click('button[data-a="modal"][data-v="menu"]'); await p.waitForTimeout(150);
  check('codex: in the menu, flagged new', /Codex \(1 new\)/.test(await p.textContent('button[data-a="modal"][data-v="codex"]')));
  await p.click('.menu-modal button[data-a="modal"][data-v="codex"]'); await p.waitForTimeout(200);
  const cx = await p.evaluate(() => { const m = document.querySelector('.modal.codex'), small = [...m.querySelectorAll('*')].filter((x) => x.children.length === 0 && x.textContent.trim() && parseFloat(getComputedStyle(x).fontSize) < 11).length; const tap = [...m.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().height < 38).length; return { entries: m.querySelectorAll('.codex-entry').length, locked: m.querySelectorAll('.locked').length, small, tap, sx: m.scrollWidth <= m.clientWidth + 1, sy: m.scrollHeight > m.clientHeight, overflowX: getComputedStyle(m).overflowX, hasNew: /New/.test(m.textContent) }; });
  check('codex: entries, some sealed', cx.entries > 15 && cx.locked > 5 && cx.hasNew, JSON.stringify(cx));
  check('codex: phone rules (11px, 38px, vertical only)', cx.small === 0 && cx.tap === 0 && cx.sx && cx.sy, JSON.stringify(cx));
  await shot(p, 'codex');
  await p.evaluate(() => { document.querySelector('.modal.codex').scrollTop = 1e6; }); await p.waitForTimeout(80);
  await shot(p, 'codex-end');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('codex: closing clears the new flag', await p.evaluate(() => !globalThis.cinderGame.state().meta.codexNew.length));

  // --- Reduced motion: the card stops moving, the words stay.
  await p.evaluate(() => { const u = JSON.parse(localStorage.getItem('cinder-cell-ui') || '{}'); u.calm = true; localStorage.setItem('cinder-cell-ui', JSON.stringify(u)); });
  await load(p, TO_BOSS('garrison', 5));
  await p.waitForFunction(() => document.querySelector('.cine.say'), null, { timeout: 2000 });
  check('calm: first meeting is a still card', await p.evaluate(() => document.documentElement.classList.contains('calm') && globalThis.cinderGame.stage.zoom === null));
  await pastIntro(p); await idle(p);
  await force(p, 'shutter'); await press(p); await idle(p); await p.waitForTimeout(100);
  const calm = await p.evaluate(() => { const c = document.querySelector('.bsay'); return { on: !c.hidden, anim: getComputedStyle(c).transitionDuration, text: c.querySelector('.bsay-text').textContent, op: getComputedStyle(c).opacity }; });
  check('calm: the line still shows, no transition', calm.on && calm.text.length > 3 && /^0s/.test(calm.anim) && calm.op === '1', JSON.stringify(calm));
  await p.evaluate(() => { const u = JSON.parse(localStorage.getItem('cinder-cell-ui') || '{}'); u.calm = false; localStorage.setItem('cinder-cell-ui', JSON.stringify(u)); });

  // --- Every boss's moves through the page, without their art being checked: nothing throws, the intent reads true.
  for (const [id, map, sec, moves] of [['crawler', 'garrison', 10, ['anchor', 'siege']], ['ostrane', 'garrison', 15, ['redact', 'audit']], ['brask', 'foundry', 5, ['overtime', 'front']], ['crucible', 'foundry', 10, ['roll', 'floor']], ['kell', 'detention', 5, ['count', 'lights']], ['vane', 'port', 5, ['crane', 'salute']]]) {
    await load(p, TO_BOSS(map, sec) + `s.char.bossMet = { '${id}:${map}': 1 }; s.char.hp = 9000;`);
    await pastIntro(p); await idle(p);
    for (const mv of moves) {
      await force(p, mv); await p.evaluate(() => { const s = globalThis.cinderGame.state(); s.char.hp = 9000; s.run.enemy.atk = 1; });
      await press(p); await idle(p);
      const see = await p.evaluate(() => { const s = globalThis.cinderGame.state(), i = document.querySelector('.intent'); return { sig: s.run.enemy.sig && s.run.enemy.sig.id, label: i.querySelector('b').textContent }; });
      check(`${id}: ${mv} shows on the intent line`, see.sig === mv && see.label.length > 2, JSON.stringify(see));
      for (let i = 0; i < 3 && await p.evaluate(() => { const s = globalThis.cinderGame.state(); return s.screen === 'combat' && !!s.run.enemy.sig; }); i++) { await p.evaluate(() => { const s = globalThis.cinderGame.state(); s.char.hp = 9000; }); await press(p); await idle(p); }
      check(`${id}: ${mv} went off on the stage`, await p.evaluate((mv) => globalThis.cinderGame.stage.sigLog.some((x) => x.sig === mv), mv));
    }
  }
  await ctx.close();

  // --- Co-op: the friend sees the same lines, moves and scene.
  const c2x = await b.newContext({ viewport: { width: 844, height: 390 } });
  const host = await c2x.newPage(), guest = await c2x.newPage();
  for (const [q, n] of [[host, 'host'], [guest, 'guest']]) { q.on('pageerror', (e) => errs.push(`${n}: ${e.message}`)); q.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load/.test(m.text())) errs.push(`${n}: ${m.text()}`); }); }
  await host.goto(URL);
  await host.evaluate(async () => { const E = await import('./engine.js'), rng = E.seededRng(21), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 300; s.meta.tips = { town: 1, combat: 1, route: 1 }; s.meta.bestSector = 99; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); localStorage.setItem('cinder-cell-speed', JSON.stringify('manual')); });
  await host.reload(); await host.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await host.waitForTimeout(800);
  await host.evaluate(() => {});
  await host.click('button[data-a="modal"][data-v="menu"]'); await host.waitForTimeout(150);
  await host.click('.menu-modal button[data-a="modal"][data-v="settings"]'); await host.waitForTimeout(200);
  await host.click('button[data-a="coophost"]'); await host.waitForTimeout(400);
  const code = await host.evaluate(() => document.querySelector('.settings b.num').textContent);
  await host.keyboard.press('Escape');
  await guest.goto(URL); await guest.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await guest.waitForTimeout(800);
  await guest.click('button[data-a="modal"][data-v="menu"]'); await guest.waitForTimeout(150);
  await guest.click('.menu-modal button[data-a="modal"][data-v="settings"]'); await guest.waitForTimeout(200);
  await guest.fill('#coop-name', 'Buddy'); await guest.fill('#coop-code', code);
  await guest.click('button[data-a="coopjoin"]'); await guest.waitForTimeout(800);
  await guest.keyboard.press('Escape'); await guest.waitForTimeout(400);
  await guest.click('button[data-a="step"][data-v="4"]').catch(() => {}); await guest.waitForTimeout(120);
  await guest.click('button[data-a="create"]').catch(() => {}); await guest.waitForTimeout(700);
  const gf = await guest.evaluate(() => (document.querySelector('.scene-beat') || {}).textContent || '');
  check('co-op: the friend gets a fallen line', gf.length > 15, gf);
  await guest.keyboard.press('Enter'); await guest.waitForTimeout(150);
  // The host's game walks to Halvek; both screens follow.
  await host.evaluate(async () => { const g = globalThis.cinderGame, s = g.state(), E = await import('./engine.js'), rng = g.rng(); E.deploy(s, 'garrison', 1, rng); s.run.sector = 5; s.run.room = 2; s.run.choices = null; s.run.bulletin = 'quiet'; E.offerRoute(s, rng); for (let i = 0; i < 8 && s.screen !== 'combat'; i++) { if (s.run.choices && s.run.choices.length) E.enterRoom(s, 0, rng); else E.offerRoute(s, rng); } s.char.hp = 900; if (s.char2) s.char2.hp = 900; g.after(); });
  await host.waitForTimeout(600);
  const gi = await guest.evaluate(() => { const s = globalThis.cinderGame.state(); return { screen: s.screen, coop: !!s.char2, intro: s.run && s.run.enemy && s.run.enemy.intro && s.run.enemy.intro.first, cine: !document.querySelector('.cine').hidden }; });
  check('co-op: the friend gets the first meeting too', gi.screen === 'combat' && gi.coop && gi.intro && gi.cine, JSON.stringify(gi));
  await pastIntro(host); await pastIntro(guest); await idle(host);
  await host.evaluate(() => { const g = globalThis.cinderGame, s = g.state(), e = s.run.enemy; e.maxHp = e.hp = 90000; e.atk = 1; e.sig = null; e.intent = 'attack'; e.bs.phase = 75; e.next = 'sig:shutter'; s.run.actor = 0; s.run.acted = {}; g.after(); });
  await host.waitForTimeout(300);
  await host.click('button[data-a="act"][data-v="defend"]'); await idle(host); await host.waitForTimeout(300);
  await guest.click('button[data-a="act"][data-v="defend"]').catch(() => {}); await guest.waitForTimeout(300); await idle(host); await idle(guest); await guest.waitForTimeout(600);
  const both = await Promise.all([host, guest].map((q) => q.evaluate(() => { const s = globalThis.cinderGame.state(), c = document.querySelector('.bsay'); return { sig: s.run.enemy.sig && s.run.enemy.sig.id, label: document.querySelector('.intent b').textContent, say: s.run.enemy.say && s.run.enemy.say.text, shown: !c.hidden && c.querySelector('.bsay-text').textContent, disabled: !!document.querySelector('button[data-v="run"]:disabled') }; })));
  check('co-op: both read the same telegraph', both[0].sig === 'shutter' && both[1].sig === 'shutter' && both[0].label === both[1].label, JSON.stringify(both));
  check('co-op: both see the same line', both[0].say && both[0].say === both[1].say && both[1].shown === both[1].say, JSON.stringify(both.map((x) => x.shown)));
  await guest.screenshot({ path: `${OUT}/boss-coop-guest.png` });
  await host.evaluate(() => { const g = globalThis.cinderGame, s = g.state(), e = s.run.enemy; e.sig = null; e.intent = 'guard'; e.next = 'guard'; e.hp = 1; s.run.actor = 0; s.run.acted = {}; g.after(); });
  await host.waitForTimeout(300); await host.click('button[data-a="act"][data-v="strike"]');
  await host.waitForSelector('.scene-wrap', { timeout: 8000 }); await guest.waitForSelector('.scene-wrap', { timeout: 8000 });
  const sc2 = await Promise.all([host, guest].map((q) => q.evaluate(() => document.querySelector('.scene-beat').textContent)));
  check('co-op: both get the defeat scene', sc2[0] && sc2[0] === sc2[1], JSON.stringify(sc2));
  await guest.waitForTimeout(500); await guest.screenshot({ path: `${OUT}/boss-coop-guest-defeat.png` });
  await host.keyboard.press('Escape'); await host.waitForTimeout(300);
  check('co-op: the friend reads on after the host has moved on', await guest.evaluate(() => !!document.querySelector('.scene-wrap')));
  await guest.keyboard.press('Escape'); await guest.waitForTimeout(250);
  check('co-op: and closes it without it coming back', await guest.evaluate(() => !document.querySelector('.scene-wrap')));
  await c2x.close();
  await b.close();
  if (errs.length) console.log('console errors:', errs.slice(0, 8));
  console.log(failed || errs.length ? `${failed} failed, ${errs.length} console errors` : 'no errors');
  process.exit(failed || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
