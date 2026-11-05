// Co-op networking. The host runs the game; the friend ("guest") sends actions and receives the whole state back.
// Two transports: a WebSocket relay (coop/worker.js on Cloudflare) for two devices, and a BroadcastChannel for
// two tabs in the same browser (handy for testing without a server).

const PREFS_KEY = 'cinder-cell-coop';
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

class WsTransport {
  constructor(url, code, role) {
    const base = url.replace(/\/+$/, '').replace(/^http/, 'ws');
    this.ws = new WebSocket(`${base}/room/${code}?role=${role}`);
    this.ws.onopen = () => {
      // Heartbeat so a long think between turns doesn't let the connection idle out. The relay drops these.
      this.beat = setInterval(() => { if (this.ws.readyState === 1) this.ws.send('ping'); }, 30000);
      if (this.onopen) this.onopen();
    };
    this.ws.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (this.onmessage) this.onmessage(m); } catch (e) {} };
    this.ws.onclose = () => { clearInterval(this.beat); if (this.onclose) this.onclose(); };
    this.ws.onerror = () => { if (this.onerror) this.onerror(); };
  }
  send(data) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(data)); }
  close() { clearInterval(this.beat); try { this.ws.close(); } catch (e) {} }
}

export class Net {
  // role: 'host' | 'guest'. local: true for the two-tab transport.
  constructor({ role, code, relay, local = false, name = '' }) {
    this.role = role; this.code = code; this.name = name;
    this.peer = false; this.status = 'connecting';
    this.handlers = {};
    this.t = local ? new LocalTransport(code, role) : new WsTransport(relay, code, role);
    this.t.onopen = () => { this.status = 'waiting'; this.emit('status'); if (role === 'guest') this.send({ t: 'hello', name }); };
    this.t.onmessage = (m) => {
      if (!m || !m.t) return;
      if (m.t === 'peer-joined') { this.peer = true; this.status = 'connected'; this.emit('status'); if (role === 'guest') this.send({ t: 'hello', name }); return; }
      if (m.t === 'peer-left') { this.peer = false; this.status = 'waiting'; this.emit('status'); this.emit('peer-left'); return; }
      if (m.t === 'hello') { this.peer = true; this.status = 'connected'; this.peerName = m.name; this.emit('status'); }
      this.emit(m.t, m);
    };
    this.t.onclose = () => { this.status = 'closed'; this.emit('status'); };
    this.t.onerror = () => { this.status = 'error'; this.emit('status'); };
  }
  on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); return this; }
  emit(t, m) { for (const fn of this.handlers[t] || []) fn(m); }
  send(data) { this.t.send(data); }
  close() { this.t.close(); this.status = 'closed'; }
}
