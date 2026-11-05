// Cinder Cell co-op relay: a Cloudflare Worker with one Durable Object per room code.
// It holds at most two WebSocket connections (host and friend) and forwards every message from one to the other.
// Deploy from this folder: `npx wrangler login` then `npx wrangler deploy`. The printed URL goes into the game's Settings > Co-op.

export class Room {
  constructor(state) {
    this.state = state;
    this.sockets = new Map(); // role -> WebSocket
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    if (this.sockets.has(role) && this.sockets.get(role).readyState === 1) return new Response('room full', { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.set(role, server);
    const other = () => this.sockets.get(role === 'host' ? 'guest' : 'host');
    server.addEventListener('message', (ev) => { const o = other(); if (o && o.readyState === 1) o.send(ev.data); });
    const bye = () => { this.sockets.delete(role); const o = other(); if (o && o.readyState === 1) o.send(JSON.stringify({ t: 'peer-left', role })); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    const o = other();
    if (o && o.readyState === 1) { o.send(JSON.stringify({ t: 'peer-joined', role })); server.send(JSON.stringify({ t: 'peer-joined', role: role === 'host' ? 'guest' : 'host' })); }
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Cinder Cell co-op relay. Connect to /room/CODE?role=host|guest', { status: 200, headers: { 'content-type': 'text/plain' } });
    const id = env.ROOMS.idFromName(m[1].toUpperCase());
    return env.ROOMS.get(id).fetch(request);
  },
};
