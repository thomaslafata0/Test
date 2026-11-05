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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } }); // missing game files must 404: optional art is detected by res.ok
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};
