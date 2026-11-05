// Cinder Cell co-op relay: a Cloudflare Worker with one Durable Object per room code.
// It holds at most two WebSocket connections (host and friend) and forwards every message from one to the other.
// The same Worker serves the game's files as static assets; only /room/* reaches this code (see wrangler.toml).
// Deploy from the repo root: `npx wrangler login` then `npx wrangler deploy`.

const STALE_MS = 45000; // clients ping every 15 s, so this long without a word means the socket is dead

export class Room {
  constructor(state) {
    this.state = state;
    this.slots = new Map(); // role -> { ws, id, seen }
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const id = url.searchParams.get('id') || '';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const cur = this.slots.get(role);
    // A live socket from another client holds the seat. The same client reconnecting, or a silent socket, gives it up.
    if (cur && cur.ws.readyState === 1 && cur.id !== id && Date.now() - cur.seen < STALE_MS) {
      server.send(JSON.stringify({ t: 'room-full' }));
      server.close(4009, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    const slot = { ws: server, id, seen: Date.now() };
    this.slots.set(role, slot);
    if (cur) { try { cur.ws.close(4000, 'replaced'); } catch (e) {} }
    const otherRole = role === 'host' ? 'guest' : 'host';
    const other = () => this.slots.get(otherRole);
    const live = (s) => s && s.ws.readyState === 1;
    server.addEventListener('message', (ev) => {
      slot.seen = Date.now();
      if (ev.data === 'ping') { server.send('pong'); return; }
      const o = other(); if (live(o)) o.ws.send(ev.data);
    });
    const bye = () => {
      if (this.slots.get(role) !== slot) return; // already replaced by a reconnect
      this.slots.delete(role);
      const o = other(); if (live(o)) o.ws.send(JSON.stringify({ t: 'peer-left', role }));
    };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    const o = other();
    if (live(o)) { o.ws.send(JSON.stringify({ t: 'peer-joined', role })); server.send(JSON.stringify({ t: 'peer-joined', role: otherRole })); }
    return new Response(null, { status: 101, webSocket: client });
  }
}

// Cloud saves: one Durable Object per cell code. The code is the only key, so anyone holding it can load that cell.
// Keeps the last few versions, so a bad save can be rolled back.
const KEEP_VERSIONS = 6, MAX_SAVE = 2000000, MIN_WRITE_MS = 3000;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export class Vault {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS saves (rev INTEGER PRIMARY KEY, at INTEGER NOT NULL, data TEXT NOT NULL)');
    this.lastWrite = 0;
  }
  latest() { return this.sql.exec('SELECT rev, at FROM saves ORDER BY rev DESC LIMIT 1').toArray()[0] || null; }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.pathname.endsWith('/versions')) return json({ versions: this.sql.exec('SELECT rev, at, length(data) AS bytes FROM saves ORDER BY rev DESC').toArray() });
      const want = url.searchParams.get('rev');
      const row = (want ? this.sql.exec('SELECT rev, at, data FROM saves WHERE rev = ?', +want) : this.sql.exec('SELECT rev, at, data FROM saves ORDER BY rev DESC LIMIT 1')).toArray()[0];
      return row ? json(row) : json({ error: 'none' }, 404);
    }
    if (request.method !== 'PUT') return json({ error: 'method' }, 405);
    const text = await request.text();
    if (text.length > MAX_SAVE) return json({ error: 'too big' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (typeof body.data !== 'string' || !Number.isFinite(body.at)) return json({ error: 'bad save' }, 400);
    const now = Date.now();
    if (now - this.lastWrite < MIN_WRITE_MS) return json({ error: 'slow down' }, 429);
    const cur = this.latest();
    if (cur && !body.force && (body.base || 0) < cur.rev) return json({ error: 'newer', rev: cur.rev, at: cur.at }, 409);
    const rev = (cur ? cur.rev : 0) + 1;
    this.sql.exec('INSERT INTO saves (rev, at, data) VALUES (?, ?, ?)', rev, body.at, body.data);
    this.sql.exec('DELETE FROM saves WHERE rev <= ?', rev - KEEP_VERSIONS);
    this.lastWrite = now;
    return json({ rev, at: body.at });
  }
}

// The global leaderboard: one Durable Object holding every raid from everyone. The game sends each raid when it ends.
// Scores are worked out here from the raid's numbers, and the limits below keep out nonsense, but the numbers come from the
// player's browser, so someone determined could still fake a run.
const BOARD_SHOW = 100, BOARD_MAX_SHOW = 500, BOARD_KEEP = 500000, BOARD_MAX_BODY = 3000, BOARD_RATE = 40;
const WORTH = { cleared: 150, kills: 25, elites: 75, bosses: 500, freed: 100 };
const whole = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };
const label = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '');
function cleanRaid(e) {
  if (!e || typeof e !== 'object' || !/^[a-z0-9]{8,32}$/.test(e.id || '') || !['extracted', 'escaped', 'died'].includes(e.how)) return null;
  const name = label(e.name, 40), background = label(e.background, 24), map = label(e.map, 24), p = e.parts || {};
  const nums = { number: whole(e.number, 1e6), level: whole(e.level, 999), from: whole(e.from, 9999), to: whole(e.to, 9999), kills: whole(e.kills, 1e5), bosses: whole(e.bosses, 5000), cleared: whole(e.cleared, 9999), elites: whole((p.elites || 0) / WORTH.elites, 1e5), freed: whole((p.freed || 0) / WORTH.freed, 1e4), haul: whole(p.haul || 0, 1e8) };
  if (!name || !map || Object.values(nums).includes(null)) return null;
  const parts = { haul: nums.haul, cleared: nums.cleared * WORTH.cleared, kills: nums.kills * WORTH.kills, elites: nums.elites * WORTH.elites, bosses: nums.bosses * WORTH.bosses, freed: nums.freed * WORTH.freed };
  const score = Object.values(parts).reduce((t, v) => t + v, 0);
  if (score <= 0) return null;
  return { id: e.id, name, number: nums.number, background, level: nums.level, map, from: nums.from, to: nums.to, how: e.how, score, parts, kills: nums.kills, bosses: nums.bosses, cleared: nums.cleared };
}
export class Board {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, score INTEGER NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS runs_score ON runs (score DESC, at ASC)');
    this.hits = new Map();
  }
  count() { return this.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n; }
  limited(ip) {
    const now = Date.now(), minute = this.hits.get(ip);
    if (!minute || now - minute.t > 60000) { if (this.hits.size > 5000) this.hits.clear(); this.hits.set(ip, { t: now, n: 1 }); return false; }
    return ++minute.n > BOARD_RATE;
  }
  async fetch(request) {
    if (request.method === 'GET') {
      const limit = Math.min(BOARD_MAX_SHOW, Math.max(1, +new URL(request.url).searchParams.get('limit') || BOARD_SHOW));
      const rows = this.sql.exec('SELECT at, data FROM runs ORDER BY score DESC, at ASC LIMIT ?', limit).toArray().map((r) => ({ ...JSON.parse(r.data), when: r.at }));
      return json({ rows, total: this.count() });
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    if (this.limited(request.headers.get('CF-Connecting-IP') || 'local')) return json({ error: 'slow down' }, 429);
    const text = await request.text();
    if (text.length > BOARD_MAX_BODY) return json({ error: 'too big' }, 413);
    let raid;
    try { raid = cleanRaid(JSON.parse(text)); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (!raid) return json({ error: 'bad raid' }, 400);
    // The same id twice (a retry after a dropped connection) keeps the first copy.
    this.sql.exec('INSERT OR IGNORE INTO runs (id, score, at, data) VALUES (?, ?, ?, ?)', raid.id, raid.score, Date.now(), JSON.stringify(raid));
    const total = this.count();
    if (total > BOARD_KEEP) this.sql.exec('DELETE FROM runs WHERE id IN (SELECT id FROM runs ORDER BY score ASC, at DESC LIMIT ?)', total - BOARD_KEEP);
    const row = this.sql.exec('SELECT score, at FROM runs WHERE id = ?', raid.id).toArray()[0];
    const rank = row ? this.sql.exec('SELECT COUNT(*) AS n FROM runs WHERE score > ? OR (score = ? AND at < ?)', row.score, row.score, row.at).one().n + 1 : 0;
    return json({ rank, total, score: raid.score });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/board') return env.BOARD.get(env.BOARD.idFromName('global')).fetch(request);
    const sv = url.pathname.match(/^\/save\/([A-Z0-9]{12})(\/versions)?$/);
    if (sv) return env.VAULT.get(env.VAULT.idFromName(sv[1])).fetch(request);
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } }); // missing game files must 404: optional art is detected by res.ok
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};
