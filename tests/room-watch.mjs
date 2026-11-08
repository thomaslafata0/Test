// The relay with watchers, on fake sockets: a co-op pair works as before, watchers hear only the host, a watcher's words reach
// only the host, 4-letter co-op rooms refuse watchers, and the host hears when a watcher leaves. Also the Presence object's rules.
// Run: node tests/room-watch.mjs
import { Room, Presence, friendCodeOf } from '../coop/worker.js';

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };

class FakeSocket {
  constructor() { this.readyState = 1; this.sent = []; this.ls = {}; }
  accept() {}
  send(d) { this.sent.push(d); }
  close() { if (this.readyState !== 1) return; this.readyState = 3; (this.ls.close || []).forEach((f) => f()); }
  addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); }
  recv(d) { (this.ls.message || []).forEach((f) => f({ data: d })); }
  msgs() { return this.sent.filter((d) => d !== 'pong').map((d) => JSON.parse(d)); }
}
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket(); } };
// Response with status 101 isn't allowed in Node: the room only needs to build one.
const RealResponse = globalThis.Response;
globalThis.Response = class { constructor(body, init = {}) { this.status = init.status; this.webSocket = init.webSocket; } };
const connect = async (room, code, role, id) => {
  const req = { url: `https://x/room/${code}?role=${role}&id=${id}`, headers: { get: (h) => (h === 'Upgrade' ? 'websocket' : null) } };
  const before = globalThis.WebSocketPair;
  let server;
  globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = server = new FakeSocket(); } };
  await room.fetch(req);
  globalThis.WebSocketPair = before;
  return server;
};

// A co-op room is unchanged.
{
  const room = new Room({});
  const h = await connect(room, 'ABCD', 'host', 'h1'), g = await connect(room, 'ABCD', 'guest', 'g1');
  check('co-op: both hear the other join', h.msgs().some((m) => m.t === 'peer-joined') && g.msgs().some((m) => m.t === 'peer-joined'));
  h.recv(JSON.stringify({ t: 'state', s: '1' })); g.recv(JSON.stringify({ t: 'act', a: 'x' }));
  check('co-op: messages cross', g.msgs().some((m) => m.t === 'state') && h.msgs().some((m) => m.t === 'act'));
  const w = await connect(room, 'ABCD', 'watch', 'w1');
  check('co-op: a 4-letter room refuses watchers', w.msgs().some((m) => m.t === 'room-full') && w.readyState === 3);
  const g2 = await connect(room, 'ABCD', 'guest', 'g2');
  check('co-op: a third player is still refused', g2.msgs().some((m) => m.t === 'room-full'));
}
// A spectator room.
{
  const room = new Room({}), code = 'ABCDEFGH';
  const h = await connect(room, code, 'host', 'h1');
  const w1 = await connect(room, code, 'watch', 'w1'), w2 = await connect(room, code, 'watch', 'w2');
  check('spectate: a watcher is told the host is there', w1.msgs().some((m) => m.t === 'peer-joined' && m.role === 'host'));
  check('spectate: the host isn\u2019t told a partner joined', !h.msgs().some((m) => m.t === 'peer-joined'));
  h.recv(JSON.stringify({ t: 'state', s: 'x' }));
  check('spectate: every watcher gets the host\u2019s game', w1.msgs().some((m) => m.t === 'state') && w2.msgs().some((m) => m.t === 'state'));
  w1.recv(JSON.stringify({ t: 'hello', id: 'w1' }));
  check('spectate: the host hears a watcher', h.msgs().some((m) => m.t === 'hello' && m.id === 'w1'));
  check('spectate: watchers don\u2019t hear each other', !w2.msgs().some((m) => m.t === 'hello'));
  w1.recv('ping');
  check('spectate: pings are answered', w1.sent.includes('pong'));
  const g = await connect(room, code, 'guest', 'g1');
  g.recv(JSON.stringify({ t: 'act', a: 'deploy' }));
  check('spectate: a guest seat doesn\u2019t reach watchers', !w2.msgs().some((m) => m.t === 'act'));
  w2.close();
  check('spectate: the host hears a watcher leave', h.msgs().some((m) => m.t === 'watch-left' && m.id === 'w2'));
  for (let i = 0; i < 9; i++) await connect(room, code, 'watch', `x${i}`);
  const late = await connect(room, code, 'watch', 'late');
  check('spectate: watchers are capped', late.msgs().some((m) => m.t === 'room-full'));
  h.close();
  check('spectate: watchers hear the host leave', w1.msgs().some((m) => m.t === 'peer-left' && m.role === 'host'));
}
// Presence.
{
  globalThis.Response = RealResponse;
  const p = new Presence();
  const post = async (b) => { const r = await p.fetch(new Request('https://x/presence', { method: 'POST', body: JSON.stringify(b) })); return { status: r.status, body: await r.json() }; };
  const ka = 'a'.repeat(32), kb = 'b'.repeat(32), A = await friendCodeOf(ka), B = await friendCodeOf(kb);
  check('codes come from keys', /^[A-Z2-9]{8}$/.test(A) && A !== B, `${A} ${B}`);
  check('a bad key is refused', (await post({ key: 'nope' })).status === 400);
  let r = await post({ key: ka, name: 'Ann', op: { name: 'Vex', cls: 'Runner', level: 3 }, where: { screen: 'town' }, open: true, want: [B] });
  check('an offline friend reads null', r.body.code === A && r.body.friends[B] === null);
  r = await post({ key: kb, name: 'Bo<b>', email: 'x@y.z', want: [A], watch: A });
  check('a friend reads name and game, cleaned', r.body.friends[A].name === 'Ann' && r.body.friends[A].op.level === 3 && r.body.friends[A].where.screen === 'town' && r.body.friends[A].room === '', JSON.stringify(r.body.friends[A]));
  check('nothing but known fields is kept', !JSON.stringify(p.seen.get(B)).includes('x@y.z') && p.seen.get(B).name === 'Bob');
  r = await post({ key: ka, name: 'Ann', op: { name: 'Vex', level: 3 }, where: { screen: 'town' }, open: true, want: [B] });
  check('the friend gets the watch ask', r.body.asks.length === 1 && r.body.asks[0].code === B && r.body.asks[0].name === 'Bob');
  r = await post({ key: ka, name: 'Ann', op: { name: 'Vex', level: 3 }, where: { screen: 'town' }, open: true, room: 'QWERTYUP', want: [] });
  check('an ask is handed over once', r.body.asks.length === 0);
  r = await post({ key: kb, name: 'Bob', want: [A] });
  check('who asked is told the room', r.body.friends[A].room === 'QWERTYUP');
  const C = 'c'.repeat(32);
  r = await post({ key: C, name: 'Cy', want: [A] });
  check('who didn\u2019t ask isn\u2019t told the room', r.body.friends[A].room === '');
  p.seen.get(A).at -= 91000;
  r = await post({ key: kb, name: 'Bob', want: [A] });
  check('a friend quiet for 90 s is offline', r.body.friends[A] === null);
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
