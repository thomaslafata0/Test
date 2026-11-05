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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const sv = url.pathname.match(/^\/save\/([A-Z0-9]{12})(\/versions)?$/);
    if (sv) return env.VAULT.get(env.VAULT.idFromName(sv[1])).fetch(request);
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } }); // missing game files must 404: optional art is detected by res.ok
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};
