// Cinder Cell co-op relay: a Cloudflare Worker with one Durable Object per room code.
// It holds at most two players (host and friend) and forwards every message from one to the other.
// A spectator room (an 8-character code) also takes a few watchers: they get everything the host sends, and only the host hears them.
// The same Worker serves the game's files as static assets; only /room/* reaches this code (see wrangler.toml).
// Deploy from the repo root: `npx wrangler login` then `npx wrangler deploy`.

const STALE_MS = 45000; // clients ping every 15 s, so this long without a word means the socket is dead
const MAX_WATCHERS = 8;

export class Room {
  constructor(state) {
    this.state = state;
    this.slots = new Map(); // role -> { ws, id, seen }
    this.watchers = new Map(); // client id -> { ws, id, seen }
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const asked = url.searchParams.get('role');
    const role = asked === 'host' ? 'host' : asked === 'watch' ? 'watch' : 'guest';
    const id = url.searchParams.get('id') || '';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    if (role === 'watch') { this.watch(server, id, (url.pathname.split('/').pop() || '').length); return new Response(null, { status: 101, webSocket: client }); }
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
      if (role === 'host') this.toWatchers(ev.data);
    });
    const bye = () => {
      if (this.slots.get(role) !== slot) return; // already replaced by a reconnect
      this.slots.delete(role);
      const o = other(); if (live(o)) o.ws.send(JSON.stringify({ t: 'peer-left', role }));
      if (role === 'host') this.toWatchers(JSON.stringify({ t: 'peer-left', role }));
    };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    const o = other();
    if (live(o)) { o.ws.send(JSON.stringify({ t: 'peer-joined', role })); server.send(JSON.stringify({ t: 'peer-joined', role: otherRole })); }
    if (role === 'host') this.toWatchers(JSON.stringify({ t: 'peer-joined', role }));
    return new Response(null, { status: 101, webSocket: client });
  }
  toWatchers(data) { for (const w of this.watchers.values()) if (w.ws.readyState === 1) { try { w.ws.send(data); } catch (e) {} } }
  // A watcher hears the host, says only hello and heartbeats to the host, and never takes a player's seat.
  // Only spectator rooms (8-character codes) take watchers, so nobody can sit in on a co-op room by guessing its 4-letter code.
  watch(server, id, codeLen) {
    const now = Date.now();
    for (const [k, w] of this.watchers) if (w.ws.readyState !== 1 || now - w.seen > STALE_MS) this.watchers.delete(k);
    if (codeLen < 8 || !id || (this.watchers.size >= MAX_WATCHERS && !this.watchers.has(id))) {
      server.send(JSON.stringify({ t: 'room-full' }));
      server.close(4009, 'room full');
      return;
    }
    const cur = this.watchers.get(id), slot = { ws: server, id, seen: now };
    this.watchers.set(id, slot);
    if (cur) { try { cur.ws.close(4000, 'replaced'); } catch (e) {} }
    const host = () => this.slots.get('host'), live = (s) => s && s.ws.readyState === 1;
    server.addEventListener('message', (ev) => {
      slot.seen = Date.now();
      if (ev.data === 'ping') { server.send('pong'); return; }
      if (typeof ev.data !== 'string' || ev.data.length > 2000) return;
      const h = host(); if (live(h)) h.ws.send(ev.data);
    });
    const bye = () => {
      if (this.watchers.get(id) !== slot) return;
      this.watchers.delete(id);
      const h = host(); if (live(h)) h.ws.send(JSON.stringify({ t: 'watch-left', id }));
    };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    if (live(host())) server.send(JSON.stringify({ t: 'peer-joined', role: 'host' }));
  }
}

// Friends: who is online and what they're doing, for the friends list. One object holds it all in memory: nothing is written to
// disk, and an entry is gone 90 s after the last word from that device. A device proves its friend code with the key it was made from.
// POST { key, name, op, where, coop, open, room, watchers, want: [codes], watch: code } -> { code, friends: { CODE: entry | null }, asks }.
// What's kept: the player name and what they're playing. A spectator room code only goes to friends who asked to watch.
const PRES_TTL = 90000, PRES_ASK_MS = 60000, PRES_SEEN_ASK_MS = 600000, PRES_WANT = 50, PRES_RATE = 40, PRES_MAX_BODY = 4000;
const FRIEND_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function friendCodeOf(key) {
  if (typeof key !== 'string' || !/^[0-9a-f]{32}$/.test(key)) return '';
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cinder-cell-friend:${key}`)));
  return Array.from(hash.slice(0, 8), (b) => FRIEND_ALPHABET[b % 32]).join('');
}
const SCREENS = ['town', 'raid', 'menu', 'watching'];
export class Presence {
  constructor() {
    this.seen = new Map();  // code -> entry
    this.asks = new Map();  // code -> Map(from code -> { name, at }): watch requests not yet picked up
    this.asked = new Map(); // code -> Map(from code -> at): who asked lately, and so may be told the spectator room
    this.hits = new Map();
    this.calls = 0;
  }
  prune(now) {
    for (const [k, e] of this.seen) if (now - e.at > PRES_TTL) this.seen.delete(k);
    for (const [map, ttl] of [[this.asks, PRES_ASK_MS], [this.asked, PRES_SEEN_ASK_MS]]) {
      for (const [k, m] of map) { for (const [f, v] of m) if (now - (typeof v === 'number' ? v : v.at) > ttl) m.delete(f); if (!m.size) map.delete(k); }
    }
    for (const [k, h] of this.hits) if (now - h.t > 60000) this.hits.delete(k);
  }
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const text = await request.text();
    if (text.length > PRES_MAX_BODY) return json({ error: 'too big' }, 413);
    let b; try { b = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
    const code = await friendCodeOf(b && b.key);
    if (!code) return json({ error: 'bad key' }, 400);
    const now = Date.now(), m = this.hits.get(code);
    if (!m || now - m.t > 60000) this.hits.set(code, { t: now, n: 1 }); else if (++m.n > PRES_RATE) return json({ error: 'slow down' }, 429);
    if (++this.calls % 50 === 0) this.prune(now);
    const op = b.op && typeof b.op === 'object' ? { name: label(b.op.name, 40), cls: label(b.op.cls, 24), level: whole(b.op.level, 999) || 0 } : null;
    const w = b.where && typeof b.where === 'object' ? b.where : {};
    const where = { screen: SCREENS.includes(w.screen) ? w.screen : 'menu', map: label(w.map, 24), sector: whole(w.sector, 99) || 0 };
    const room = typeof b.room === 'string' && /^[A-Z0-9]{8}$/.test(b.room) ? b.room : '';
    const name = label(b.name, 16) || 'Someone';
    if (b.off) this.seen.delete(code);
    else this.seen.set(code, { name, op: op && op.name ? op : null, where, coop: ['host', 'guest'].includes(b.coop) ? b.coop : '', open: !!b.open, room, watchers: whole(b.watchers, 99) || 0, at: now });
    // A watch request waits for the friend's next check-in.
    const target = typeof b.watch === 'string' ? b.watch.toUpperCase() : '';
    if (/^[A-Z0-9]{8}$/.test(target) && target !== code && !b.off) {
      const q = this.asks.get(target) || new Map();
      if (q.size < 10 || q.has(code)) { q.set(code, { name, at: now }); this.asks.set(target, q); }
      const a = this.asked.get(target) || new Map();
      if (a.size < 50 || a.has(code)) { a.set(code, now); this.asked.set(target, a); }
    }
    const friends = {};
    const want = Array.isArray(b.want) ? [...new Set(b.want.filter((c) => typeof c === 'string' && /^[A-Z0-9]{8}$/.test(c)))].slice(0, PRES_WANT) : [];
    for (const c of want) {
      const e = this.seen.get(c);
      if (!e || now - e.at > PRES_TTL) { friends[c] = null; continue; }
      const mayWatch = e.open && e.room && (this.asked.get(c) || new Map()).has(code);
      friends[c] = { name: e.name, op: e.op, where: e.where, coop: e.coop, open: e.open, watchers: e.watchers, room: mayWatch ? e.room : '', ago: Math.round((now - e.at) / 1000) };
    }
    const mine = this.asks.get(code), asks = mine ? [...mine].filter(([, v]) => now - v.at < PRES_ASK_MS).map(([from, v]) => ({ code: from, name: v.name })) : [];
    this.asks.delete(code);
    return json({ code, friends, asks });
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
  return { id: e.id, name, player: label(e.player, 16), background: label(e.background, 24), status: e.status, killer: e.status === 'died' ? label(e.killer, 40) : '', ...nums,
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

// Crash and lock-up reports from the game: what broke and on which screen. No names, ids or saves.
// GET /bug lists the latest 200 for whoever is fixing things.
const BUG_KEEP = 2000, BUG_MAX_BODY = 4000, BUG_RATE = 20;
export class Bugs {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS bugs (at INTEGER NOT NULL, data TEXT NOT NULL)');
    this.hits = new Map();
  }
  async fetch(request) {
    if (request.method === 'GET') return json({ rows: this.sql.exec('SELECT at, data FROM bugs ORDER BY at DESC LIMIT 200').toArray().map((r) => ({ at: r.at, ...JSON.parse(r.data) })) });
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const ip = request.headers.get('CF-Connecting-IP') || 'local', now = Date.now(), m = this.hits.get(ip);
    if (!m || now - m.t > 60000) { if (this.hits.size > 5000) this.hits.clear(); this.hits.set(ip, { t: now, n: 1 }); } else if (++m.n > BUG_RATE) return json({ error: 'slow down' }, 429);
    const text = await request.text();
    if (text.length > BUG_MAX_BODY) return json({ error: 'too big' }, 413);
    let b; try { b = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
    const row = { kind: label(b.kind, 20), msg: label(b.msg, 300), stack: label(b.stack, 1500), screen: label(b.screen, 20), coop: label(b.coop, 10), ver: label(b.ver, 20), ua: label(b.ua, 120) };
    if (!row.kind || !row.msg) return json({ error: 'bad row' }, 400);
    this.sql.exec('INSERT INTO bugs (at, data) VALUES (?, ?)', now, JSON.stringify(row));
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM bugs').one().n;
    if (n > BUG_KEEP) this.sql.exec('DELETE FROM bugs WHERE at IN (SELECT at FROM bugs ORDER BY at ASC LIMIT ?)', n - BUG_KEEP);
    return json({ ok: true });
  }
}

// Anonymous end-of-raid stats for balancing: class, district, how deep, how it ended, what killed you. No names, ids or saves.
// GET /stat: totals by class and district plus the top killers; GET /stat?rows=1 adds the latest 300 rows.
const STAT_KEEP = 50000, STAT_RATE = 30;
export class Stats {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS runs (at INTEGER NOT NULL, how TEXT, cls TEXT, map TEXT, sector INTEGER, threat INTEGER, level INTEGER, credits INTEGER, killer TEXT, boss INTEGER, coop INTEGER, mut TEXT, daily TEXT, ver TEXT)');
    this.hits = new Map();
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const days = Math.min(90, +(url.searchParams.get('days') || 14)), since = Date.now() - days * 864e5;
      const q = (sql) => this.sql.exec(sql, since).toArray();
      const out = {
        days,
        byClass: q('SELECT cls, COUNT(*) AS runs, ROUND(AVG(sector),1) AS avgSector, SUM(how = \'died\') AS deaths, ROUND(AVG(level),1) AS avgLevel, ROUND(AVG(credits)) AS avgCredits FROM runs WHERE at > ? GROUP BY cls ORDER BY runs DESC'),
        byMap: q('SELECT map, threat, COUNT(*) AS runs, ROUND(AVG(sector),1) AS avgSector, SUM(how = \'died\') AS deaths FROM runs WHERE at > ? GROUP BY map, threat ORDER BY map, threat'),
        killers: q('SELECT killer, boss, COUNT(*) AS kills FROM runs WHERE at > ? AND how = \'died\' GROUP BY killer ORDER BY kills DESC LIMIT 30'),
        mutators: q('SELECT mut, COUNT(*) AS runs, ROUND(AVG(sector),1) AS avgSector, SUM(how = \'died\') AS deaths FROM runs WHERE at > ? AND mut != \'\' GROUP BY mut ORDER BY runs DESC LIMIT 30'),
      };
      if (url.searchParams.get('rows')) out.rows = q('SELECT * FROM runs WHERE at > ? ORDER BY at DESC LIMIT 300');
      return json(out);
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const ip = request.headers.get('CF-Connecting-IP') || 'local', now = Date.now(), m = this.hits.get(ip);
    if (!m || now - m.t > 60000) { if (this.hits.size > 5000) this.hits.clear(); this.hits.set(ip, { t: now, n: 1 }); } else if (++m.n > STAT_RATE) return json({ error: 'slow down' }, 429);
    const text = await request.text();
    if (text.length > 2000) return json({ error: 'too big' }, 413);
    let b; try { b = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
    const n = (v, max) => Math.max(0, Math.min(max, Math.round(+v || 0)));
    const how = ['extracted', 'escaped', 'died'].includes(b.how) ? b.how : '';
    if (!how) return json({ error: 'bad row' }, 400);
    this.sql.exec('INSERT INTO runs (at, how, cls, map, sector, threat, level, credits, killer, boss, coop, mut, daily, ver) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      now, how, label(b.cls, 20), label(b.map, 20), n(b.sector, 99), n(b.threat, 20), n(b.level, 999), n(b.credits, 1e9), label(b.killer, 30), b.boss ? 1 : 0, b.coop ? 1 : 0, label(b.mut, 120), label(b.daily, 10), label(b.ver, 20));
    if (Math.random() < 0.01) { const c = this.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n; if (c > STAT_KEEP) this.sql.exec('DELETE FROM runs WHERE at IN (SELECT at FROM runs ORDER BY at ASC LIMIT ?)', c - STAT_KEEP); }
    return json({ ok: true });
  }
}

// Daily and weekly contract boards, one object per contract id (d20261109, w202646). One row per device: the first attempt counts.
// GET: top 50 and the total. POST {id, player, cls, score, sectors, bosses, kills, done}.
const CONTRACT_MAX = 15000;
export class Contracts {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS rows (id TEXT PRIMARY KEY, score INTEGER NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL)');
    this.hits = new Map();
  }
  async fetch(request) {
    const total = () => this.sql.exec('SELECT COUNT(*) AS n FROM rows').one().n;
    if (request.method === 'GET') return json({ rows: this.sql.exec('SELECT score, at, data FROM rows ORDER BY score DESC, at ASC LIMIT 50').toArray().map((r) => ({ ...JSON.parse(r.data), score: r.score, when: r.at })), total: total() });
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const ip = request.headers.get('CF-Connecting-IP') || 'local', now = Date.now(), m = this.hits.get(ip);
    if (!m || now - m.t > 60000) { if (this.hits.size > 5000) this.hits.clear(); this.hits.set(ip, { t: now, n: 1 }); } else if (++m.n > 10) return json({ error: 'slow down' }, 429);
    const text = await request.text();
    if (text.length > 1000) return json({ error: 'too big' }, 413);
    let b; try { b = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(b.id || '')) return json({ error: 'bad row' }, 400);
    const n = (v, max) => Math.max(0, Math.min(max, Math.round(+v || 0)));
    const score = n(b.score, CONTRACT_MAX), row = { player: label(b.player, 16) || 'Someone', cls: label(b.cls, 20), sectors: n(b.sectors, 10), bosses: n(b.bosses, 2), kills: n(b.kills, 300), done: b.done ? 1 : 0 };
    this.sql.exec('INSERT OR IGNORE INTO rows (id, score, at, data) VALUES (?, ?, ?, ?)', b.id, score, now, JSON.stringify(row));
    const me = this.sql.exec('SELECT score, at FROM rows WHERE id = ?', b.id).one();
    const rank = this.sql.exec('SELECT COUNT(*) AS n FROM rows WHERE score > ? OR (score = ? AND at < ?)', me.score, me.score, me.at).one().n + 1;
    return json({ rank, total: total(), score: me.score });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Lets iOS open invite links (?join=CODE) in the Cinder Cell app when it's installed; Safari otherwise.
    if (url.pathname === '/.well-known/apple-app-site-association' || url.pathname === '/apple-app-site-association') {
      return new Response(JSON.stringify({ applinks: { details: [{ appIDs: ['39BW6948KL.com.thomaslafata.cindercell'], components: [{ '/': '/', '?': { join: '?*' }, comment: 'co-op invites' }] }] } }), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } });
    }
    if (url.pathname === '/bug') return env.BUGS.get(env.BUGS.idFromName('all')).fetch(request);
    if (url.pathname === '/presence') return env.PRESENCE.get(env.PRESENCE.idFromName('all')).fetch(request);
    if (url.pathname === '/stat') return env.STATS.get(env.STATS.idFromName('all')).fetch(request);
    const ct = url.pathname.match(/^\/contract\/(d\d{8}|w\d{6})$/);
    if (ct) return env.CONTRACTS.get(env.CONTRACTS.idFromName(ct[1])).fetch(request);
    if (url.pathname === '/board') return env.BOARD.get(env.BOARD.idFromName('season2'))  // season 1's board is kept under 'global'
     .fetch(request);
    const sv = url.pathname.match(/^\/save\/([A-Z0-9]{12})(\/versions)?$/);
    if (sv) return env.VAULT.get(env.VAULT.idFromName(sv[1])).fetch(request);
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } }); // missing game files must 404: optional art is detected by res.ok
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};
