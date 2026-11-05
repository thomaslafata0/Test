const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 900, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8765/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(800);
  const meta = () => page.evaluate(() => JSON.parse(localStorage.getItem('cinder-cell-save-v1')).meta);
  let m = await meta(); console.log('seeded', m.boardSeeded, 'entries', m.board.length, 'bots', m.board.filter((e) => e.bot).length);
  await page.click('button[data-a="modal"][data-v="board"]'); await page.waitForTimeout(200);
  console.log('rows shown', await page.$$eval('.board-table tbody tr', (r) => r.length));
  await page.screenshot({ path: `${OUT}/board.png` });
  await page.keyboard.press('Escape');
  // simulate a strong raid in the engine and end it by extraction, then one death
  const res = await page.evaluate(async () => {
    const E = await import('./engine.js'); const rng = E.seededRng(3);
    const s = JSON.parse(localStorage.getItem('cinder-cell-save-v1'));
    E.createChar(s, rng); s.char.credits = 50; E.deploy(s, 'garrison', 1, rng);
    s.run.kills = 30; s.run.bosses = 2; s.run.cleared = 12; s.run.sector = 12; s.char.credits = 6000;
    E.endRun(s, 'extracted', rng);
    const r1 = s.char.rank, n1 = s.notice;
    E.deploy(s, 'garrison', 1, rng); s.run.kills = 4; s.run.cleared = 2; s.run.sector = 3; s.char.credits = 9000;
    const e = s.run.enemy || { name: 'x', id: 'patrol' };
    // death path via the engine's exported die? not exported: use playerAct with a lethal enemy
    s.run.enemy = E.makeEnemy(15, true, rng); s.run.enemy.atk = 9999; s.char.hp = 1; s.screen = 'combat';
    E.playerAct(s, 'defend', rng);
    localStorage.setItem('cinder-cell-save-v1', JSON.stringify(s));
    return { r1, n1, screen: s.screen, r2: s.outcome && s.outcome.rank, top: s.meta.board.slice(0, 3).map((x) => [x.name, x.score, x.bot]) };
  });
  console.log(JSON.stringify(res));
  await page.reload(); await page.click('button[data-a="continue-title"]', { timeout: 2500 }).catch(() => {}); await page.waitForTimeout(600);
  console.log('death screen rank text:', await page.$eval('dl.kv', (d) => d.textContent.includes('Leaderboard')));
  await page.screenshot({ path: `${OUT}/board-death.png` });
  // new cell keeps the board
  await page.evaluate(() => { localStorage.setItem('cinder-cell-save-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('cinder-cell-save-v1')), screen: 'town' })); });
  await page.reload(); await page.waitForTimeout(500);
  await page.click('button[data-a="newcell"]'); await page.click('button[data-a="newcell"]'); await page.waitForTimeout(300);
  m = await meta(); console.log('after new cell: entries', m.board.length, 'real', m.board.filter((e) => !e.bot).length, 'seeded', m.boardSeeded);
  console.log(errors.length ? errors : 'no errors');
  await b.close();
})();
