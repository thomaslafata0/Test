// Co-op networking. The host runs the game; the friend ("guest") sends actions and receives the whole state back.
// Two transports: a WebSocket relay (coop/worker.js on Cloudflare) for two devices, and a BroadcastChannel for
// two tabs in the same browser (handy for testing without a server).

const PREFS_KEY = 'cinder-cell-coop';
const ROOM_KEY = 'cinder-cell-room';
// On the deployed site the same Worker serves the game and the relay, so no Relay URL needs entering.
const DEFAULT_RELAY = typeof location !== 'undefined' && location.hostname.endsWith('.workers.dev') ? location.origin : '';
export function getCoopPrefs() {
  let p = { relay: '', name: '' };
  try { p = Object.assign(p, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch (e) {}
  if (!p.relay) p.relay = DEFAULT_RELAY;
  return p;
}
export function setCoopPrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.assign(getCoopPrefs(), p))); } catch (e) {} }
export const makeCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
// The room this tab is in, so a reload rejoins it. Per tab, so two test tabs in one browser don't fight over it.
export function getRoom() { try { return JSON.parse(sessionStorage.getItem(ROOM_KEY)) || null; } catch (e) { return null; } }
// The last room this browser was in, kept across closing it, so the title screen can offer to go back.
export function getLastRoom() { try { return JSON.parse(localStorage.getItem('cinder-cell-lastroom')) || null; } catch (e) { return null; } }
export function setLastRoom(r) { try { if (r) localStorage.setItem('cinder-cell-lastroom', JSON.stringify(r)); else localStorage.removeItem('cinder-cell-lastroom'); } catch (e) {} }
export function setRoom(r) { try { if (r) sessionStorage.setItem(ROOM_KEY, JSON.stringify(r)); else sessionStorage.removeItem(ROOM_KEY); } catch (e) {} }
// Identifies this tab to the relay, so a reconnect replaces its own stale socket instead of being refused as a third player.
export function clientId() {
  try {
    let id = sessionStorage.getItem('cinder-cell-client');
    if (!id) { id = makeCode() + makeCode(); sessionStorage.setItem('cinder-cell-client', id); }
    return id;
  } catch (e) { return makeCode() + makeCode(); }
}

class LocalTransport {
  constructor(code, role) {
    this.ch = new BroadcastChannel(`cinder-coop-${code}`);
    this.role = role;
    this.ch.onmessage = (ev) => { const m = ev.data; if (m && m.from !== role && this.onmessage) this.onmessage(m.data); };
    setTimeout(() => { this.send({ t: 'peer-joined', role }); if (this.onopen) this.onopen(); }, 0);
  }
  send(data) { this.ch.postMessage({ from: this.role, data }); }
  close() { this.send({ t: 'peer-left', role: this.role }); this.ch.close(); }
}

const BEAT_MS = 15000, DEAD_MS = 40000, RETRY_MAX_MS = 8000;
class WsTransport {
  constructor(url, code, role) {
    this.url = `${url.replace(/\/+$/, '').replace(/^http/, 'ws')}/room/${code}?role=${role}&id=${clientId()}`;
    this.closed = false; this.tries = 0;
    // A phone that wakes up or a laptop back on wifi shouldn't wait out the retry timer.
    this.wake = () => { if (!this.closed && document.visibilityState === 'visible' && !this.isOpen()) this.reconnectNow(); };
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
    this.connect();
  }
  isOpen() { return !!this.ws && this.ws.readyState === 1; }
  connect() {
    clearTimeout(this.retry);
    const ws = this.ws = new WebSocket(this.url);
    ws.onopen = () => {
      if (ws !== this.ws) return;
      this.tries = 0; this.seen = Date.now();
      // The relay answers each ping; silence means the connection is dead even if the browser hasn't noticed.
      this.beat = setInterval(() => {
        if (Date.now() - this.seen > DEAD_MS) return this.drop(ws);
        if (ws.readyState === 1) ws.send('ping');
      }, BEAT_MS);
      if (this.onopen) this.onopen();
    };
    ws.onmessage = (ev) => {
      if (ws !== this.ws) return;
      this.seen = Date.now();
      if (ev.data === 'pong') return;
      try { const m = JSON.parse(ev.data); if (this.onmessage) this.onmessage(m); } catch (e) {}
    };
    ws.onclose = () => this.drop(ws);
    ws.onerror = () => {};
  }
  // Forget this socket and try again, with a growing delay.
  drop(ws) {
    if (ws !== this.ws) return;
    clearInterval(this.beat);
    ws.onopen = ws.onmessage = ws.onclose = null;
    try { ws.close(); } catch (e) {}
    this.ws = null;
    if (this.closed) return;
    if (this.onlost) this.onlost();
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.connect(), Math.min(RETRY_MAX_MS, 500 * 2 ** this.tries++));
  }
  reconnectNow() { clearTimeout(this.retry); this.tries = 0; if (this.ws) this.drop(this.ws); this.connect(); }
  send(data) { if (this.isOpen()) this.ws.send(JSON.stringify(data)); }
  close() {
    this.closed = true;
    clearInterval(this.beat); clearTimeout(this.retry);
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    if (this.ws) { this.ws.onclose = null; try { this.ws.close(); } catch (e) {} }
  }
}

export class Net {
  // role: 'host' | 'guest' | 'watch'. A watcher only receives what the host sends (spectating; the relay takes several).
  // local: true for the two-tab transport.
  // status: connecting | waiting (no partner yet) | connected | reconnecting | full | closed.
  constructor({ role, code, relay, local = false, name = '', helloExtra = null }) {
    this.role = role; this.code = code; this.name = name; this.local = local; this.helloExtra = helloExtra;
    const hello = () => this.send({ t: 'hello', name: this.name, ...(this.helloExtra ? this.helloExtra() : {}) });
    this.peer = false; this.online = false; this.status = 'connecting';
    this.handlers = {};
    this.t = local ? new LocalTransport(code, role) : new WsTransport(relay, code, role);
    this.t.onopen = () => { this.online = true; this.status = 'waiting'; this.emit('status'); if (role !== 'host') hello(); };
    this.t.onlost = () => { this.online = false; this.peer = false; this.status = 'reconnecting'; this.emit('status'); };
    this.t.onmessage = (m) => {
      if (!m || !m.t) return;
      // Watchers come and go without touching the host's partner: the host counts them from their own messages.
      if ((m.t === 'peer-joined' || m.t === 'peer-left') && m.role === 'watch') return;
      if (m.t === 'room-full') { this.status = 'full'; this.close(); this.status = 'full'; this.emit('status'); this.emit('room-full'); return; }
      if (m.t === 'peer-joined') { this.peer = true; this.status = 'connected'; this.emit('status'); if (role !== 'host') hello(); return; }
      if (m.t === 'peer-left') { this.peer = false; this.status = 'waiting'; this.emit('status'); this.emit('peer-left'); return; }
      if (m.t === 'hello') this.peerName = m.name;
      // Anything from the other side means they're here (the two-tab transport has no relay to announce them).
      if (!this.peer || m.t === 'hello') { this.peer = true; this.status = 'connected'; this.emit('status'); }
      this.emit(m.t, m);
    };
  }
  on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); return this; }
  emit(t, m) { for (const fn of this.handlers[t] || []) fn(m); }
  send(data) { this.t.send(data); }
  close() { this.t.close(); this.online = false; this.peer = false; this.status = 'closed'; }
}
