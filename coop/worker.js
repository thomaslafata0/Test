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

// The global leaderboard: one Durable Object with one row per operative, for their whole life. The game sends the row after every raid.
// The score is worked out here from how far the operative got (same formula as groundWorth in engine.js). Limits keep out nonsense,
// but the numbers come from the player's browser, so someone determined could still fake a run.
// Operative ids are never sent back out, because the id is what lets a row be updated. Rows carry a tag derived from it instead.
const BOARD_SHOW = 100, BOARD_MAX_SHOW = 500, BOARD_KEEP = 500000, BOARD_MAX_BODY = 6000, BOARD_RATE = 40;
const whole = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };
const label = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '');
const groundWorth = (best, threat) => Math.round((best * 100 + Math.floor(best / 5) * 400 + (best >= 15 ? 1000 : 0)) * (1 + 0.5 * threat));
function cleanRow(e) {
  if (!e || typeof e !== 'object' || !/^[A-Za-z0-9_-]{6,64}$/.test(e.id || '') || !['alive', 'died'].includes(e.status)) return null;
  if (!Array.isArray(e.progress) || !e.progress.length || e.progress.length > 40) return null;
  const progress = [];
  for (const p of e.progress) {
    const map = label(p && p.map, 24), threat = whole(p && p.threat, 9), best = whole(p && p.best, 999);
    if (!map || threat === null || best === null || progress.some((x) => x.map === map && x.threat === threat)) return null;
    if (best > 0) progress.push({ map, threat, best });
  }
  const name = label(e.name, 40), nums = { number: whole(e.number, 1e6), level: whole(e.level, 999), raids: whole(e.raids, 1e5), kills: whole(e.kills, 1e7), bosses: whole(e.bosses, 1e5) };
  if (!name || !progress.length || Object.values(nums).includes(null)) return null;
  const top = progress.slice().sort((a, b) => b.threat - a.threat || b.best - a.best)[0];
  return { id: e.id, name, background: label(e.background, 24), status: e.status, killer: e.status === 'died' ? label(e.killer, 40) : '', ...nums,
    map: top.map, threat: top.threat, deepest: top.best, freed: progress.filter((x) => x.threat === 0 && x.best >= 15).length,
    score: progress.reduce((t, x) => t + groundWorth(x.best, x.threat), 0) };
}
async function tagOf(id) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cinder-cell:${id}`));
  return [...new Uint8Array(hash)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export class Board {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('DROP TABLE IF EXISTS runs'); // the old board ranked single raids
    this.sql.exec('CREATE TABLE IF NOT EXISTS ops (id TEXT PRIMARY KEY, score INTEGER NOT NULL, status TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS ops_score ON ops (score DESC, at ASC)');
    this.hits = new Map();
  }
  count() { return this.sql.exec('SELECT COUNT(*) AS n FROM ops').one().n; }
  limited(ip) {
    const now = Date.now(), minute = this.hits.get(ip);
    if (!minute || now - minute.t > 60000) { if (this.hits.size > 5000) this.hits.clear(); this.hits.set(ip, { t: now, n: 1 }); return false; }
    return ++minute.n > BOARD_RATE;
  }
  async fetch(request) {
    if (request.method === 'GET') {
      const limit = Math.min(BOARD_MAX_SHOW, Math.max(1, +new URL(request.url).searchParams.get('limit') || BOARD_SHOW));
      const rows = this.sql.exec('SELECT at, data FROM ops ORDER BY score DESC, at ASC LIMIT ?', limit).toArray().map((r) => ({ ...JSON.parse(r.data), when: r.at }));
      return json({ rows, total: this.count() });
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    if (this.limited(request.headers.get('CF-Connecting-IP') || 'local')) return json({ error: 'slow down' }, 429);
    const text = await request.text();
    if (text.length > BOARD_MAX_BODY) return json({ error: 'too big' }, 413);
    let row;
    try { row = cleanRow(JSON.parse(text)); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (!row) return json({ error: 'bad row' }, 400);
    const { id, ...shown } = row, tag = await tagOf(id), cur = this.sql.exec('SELECT score, status, at, data FROM ops WHERE id = ?', id).toArray()[0];
    // A dead operative's row is final. A living one's score only goes up, and its place in a tie dates from when it got there.
    if (!cur || cur.status !== 'died') {
      const score = cur ? Math.max(cur.score, row.score) : row.score, at = cur && score === cur.score ? cur.at : Date.now();
      this.sql.exec('INSERT OR REPLACE INTO ops (id, score, status, at, data) VALUES (?, ?, ?, ?, ?)', id, score, row.status, at, JSON.stringify({ ...shown, score, tag }));
    }
    const total = this.count();
    if (total > BOARD_KEEP) this.sql.exec('DELETE FROM ops WHERE id IN (SELECT id FROM ops ORDER BY score ASC, at DESC LIMIT ?)', total - BOARD_KEEP);
    const now = this.sql.exec('SELECT score, at FROM ops WHERE id = ?', id).toArray()[0];
    const rank = now ? this.sql.exec('SELECT COUNT(*) AS n FROM ops WHERE score > ? OR (score = ? AND at < ?)', now.score, now.score, now.at).one().n + 1 : 0;
    return json({ rank, total, score: now ? now.score : 0, tag });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Lets iOS open invite links (?join=CODE) in the Cinder Cell app when it's installed; Safari otherwise.
    if (url.pathname === '/.well-known/apple-app-site-association' || url.pathname === '/apple-app-site-association') {
      return new Response(JSON.stringify({ applinks: { details: [{ appIDs: ['39BW6948KL.com.thomaslafata.cindercell'], components: [{ '/': '/', '?': { join: '?*' }, comment: 'co-op invites' }] }] } }), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } });
    }
    if (url.pathname === '/board') return env.BOARD.get(env.BOARD.idFromName('global')).fetch(request);
    const sv = url.pathname.match(/^\/save\/([A-Z0-9]{12})(\/versions)?$/);
    if (sv) return env.VAULT.get(env.VAULT.idFromName(sv[1])).fetch(request);
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } }); // missing game files must 404: optional art is detected by res.ok
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};
