// Lantern Hearts: the free pack, rising pack prices, the deck (edit, best, fuse), a whole match at a table, the binder, and a phone.
const { chromium } = require('playwright');
const URL = process.env.U || 'http://localhost:8765/index.html';
const OUT = require('path').join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch(), errors = [];
  const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) errors.push('FAIL ' + name); };
  const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.evaluate(async () => { localStorage.clear(); for (const k of ['afterhours', 'reach', 'contracts']) localStorage.setItem('cinder-cell-news', k); const E = await import('./engine.js'), rng = E.seededRng(4), s = E.newGame(rng); E.createChar(s, rng); s.char.credits = 2000; s.screen = 'town'; s.meta.tips = { town: true, combat: true, route: true }; localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s)); });
  await p.reload(); await p.click('button[data-a="continue-title"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(900);
  await p.click('.shortcuts button[data-v="bar"]'); await p.waitForTimeout(300);
  const tab = p.locator('.pop-tabs [data-v="cards"]');
  check('the card table is a Lantern tab', await tab.count() === 1);
  await tab.click(); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => { const s = cinderGame.state(); return { cr: s.char.credits, cards: Object.values(s.meta.cards || {}).reduce((a, b) => a + b, 0), free: s.meta.cardsFree, packs: s.meta.cardPacks || 0, match: s.cardMatch, deck: s.meta.deck, deckSet: !!s.meta.deckSet }; });
  check('three tables to sit at', await p.locator('.tc-table').count() === 3);
  await p.click('button[data-a="cardfree"]'); await p.waitForTimeout(300);
  let s = await st();
  check('the starter pack is free: three cards, shown flipping', s.cards === 3 && s.cr === 2000 && s.free && await p.locator('.tc-reveal .tcard.flip').count() === 3, JSON.stringify(s));
  await p.click('button[data-a="cardpack"]'); await p.waitForTimeout(250); s = await st();
  check('the first pack costs 60', s.cards === 6 && s.cr === 1940, JSON.stringify(s));
  await p.click('button[data-a="cardpack"]'); await p.waitForTimeout(250); s = await st();
  check('the next costs 10% more (66)', s.cards === 9 && s.cr === 1874, JSON.stringify(s));
  for (let i = 0; i < 6; i++) { await p.click('button[data-a="cardpack"]'); await p.waitForTimeout(120); }
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${OUT}/cards-packs.png` });
  // Deck.
  await p.click('button[data-a="cardtab"][data-v="deck"]'); await p.waitForTimeout(250);
  check('the deck holds six cards', await p.locator('.tc-shelf.deck .tcard:not(.empty)').count() === 6);
  await p.locator('.tc-shelf.deck button[data-a="cardout"]').first().click(); await p.waitForTimeout(200); s = await st();
  check('taking a card out sticks', s.deckSet && s.deck.length === 5 && await p.locator('.tc-shelf.deck .tcard.empty').count() === 1, JSON.stringify(s.deck));
  await p.locator('button[data-a="cardin"]').first().click(); await p.waitForTimeout(200); s = await st();
  check('putting one in fills it', s.deck.length === 6, JSON.stringify(s.deck));
  const fuse = p.locator('button[data-a="cardfuse"]');
  if (await fuse.count()) { const before = (await st()).cards; await fuse.first().click(); await p.waitForTimeout(200); check('three copies fuse into one', (await st()).cards === before - 2); }
  else console.log('(no card with three copies this seed)');
  await p.click('button[data-a="cardbest"]'); await p.waitForTimeout(200); s = await st();
  check('best deck goes back to automatic', !s.deckSet);
  await p.screenshot({ path: `${OUT}/cards-deck.png` });
  // A match at the Back Booth.
  await p.click('button[data-a="cardtab"][data-v="table"]'); await p.waitForTimeout(200);
  const c0 = (await st()).cr;
  await p.click('button[data-a="cardplay"][data-v="booth"]'); await p.waitForTimeout(300); s = await st();
  check('a match takes the stake, shows the calls and deals three', s.cr === c0 - 25 && s.match && await p.locator('button[data-a="cardpick"]').count() === 3 && await p.locator('.tc-col').count() === 3 && await p.locator('.tcard.back').count() === 3, JSON.stringify(s.match && s.match.hand));
  await p.screenshot({ path: `${OUT}/cards-match.png` });
  await p.locator('button[data-a="cardpick"]').first().click(); await p.waitForTimeout(700);
  check('the played round flips both cards', await p.locator('.tc-col .tc-res').count() === 1 && await p.locator('.tcard.back').count() === 2);
  await p.screenshot({ path: `${OUT}/cards-round.png` });
  for (let i = 0; i < 2; i++) { const b = p.locator('button[data-a="cardpick"]').first(); if (!(await b.count())) break; await b.click(); await p.waitForTimeout(400); }
  s = await st();
  const paid = s.match && s.match.paid;
  check('the match ends and pays by the result', s.match && s.match.over && s.cr === c0 - 25 + paid && [0, 25, 50].includes(paid), JSON.stringify({ result: s.match && s.match.result, paid, cr: s.cr }));
  await p.screenshot({ path: `${OUT}/cards-result.png` });
  await p.click('button[data-a="cardplay"][data-v="booth"]'); await p.waitForTimeout(250); s = await st();
  check('deal again starts a fresh match', s.match && !s.match.over && s.match.rounds.length === 0);
  for (let i = 0; i < 3; i++) { const b = p.locator('button[data-a="cardpick"]').first(); if (!(await b.count())) break; await b.click(); await p.waitForTimeout(250); }
  await p.click('button[data-a="cardclose"]'); await p.waitForTimeout(250);
  check('back to the tables', !(await st()).match && await p.locator('.tc-table').count() === 3);
  // Binder.
  await p.click('button[data-a="cardtab"][data-v="binder"]'); await p.waitForTimeout(250);
  const rows = await p.locator('.tc-binder-row').count();
  check('the binder lists every girl in all six printings', rows >= 3 && await p.locator('.tc-binder-row').first().locator('.tcard').count() === 6, String(rows));
  await p.screenshot({ path: `${OUT}/cards-binder.png` });
  // Rarer cards look the part.
  await p.evaluate(() => { const s = cinderGame.state(); Object.assign(s.meta.cards, { 'vex:prism': 1, 'pixie:neon': 1, 'rook:gilded': 1 }); cinderGame.after(); });
  await p.click('button[data-a="cardtab"][data-v="deck"]'); await p.waitForTimeout(400);
  check('Prism, Neon and Gilded cards make the deck', await p.locator('.tc-shelf.deck .r-prism').count() === 1 && await p.locator('.tc-shelf.deck .r-neon').count() === 1);
  await p.screenshot({ path: `${OUT}/cards-rare.png` });
  // Phone.
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(300);
  await p.click('button[data-a="cardtab"][data-v="table"]'); await p.waitForTimeout(200);
  await p.click('button[data-a="cardplay"][data-v="floor"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/cards-phone.png` });
  const fit = await p.evaluate(() => { const b = document.querySelector('button[data-a="cardpick"]'); if (!b) return false; b.scrollIntoView(); const r = b.getBoundingClientRect(); return r.right <= innerWidth && r.width > 20 && document.documentElement.scrollWidth <= innerWidth + 1; });
  check('phone: cards can be played, nothing spills sideways', fit);
  await browser.close();
  console.log(errors.length ? errors.join('\n') + '\nFAILED' : 'ALL PASS');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
