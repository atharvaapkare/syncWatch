const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.send('ok'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const rooms = new Map();

const getRoom = id => {
  if (!rooms.has(id)) {
    rooms.set(id, { clients: new Set(), source: null, state: { playing: false, time: 0, at: Date.now() } });
  }
  return rooms.get(id);
};
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const broadcast = (r, m, except) => r.clients.forEach(c => c !== except && send(c, m));
const userList = r => [...r.clients].map(c => c.name);
const cleanUrl = u => {
  try {
    const x = new URL(String(u).slice(0, 2000));
    return /^https?:$/.test(x.protocol) ? x.href : null;
  } catch { return null; }
};

wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === 'ping') return send(ws, { type: 'pong', t: m.t, server: Date.now() });

    if (m.type === 'join') {
      const id = String(m.room || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
      if (!id) return;
      ws.room = id;
      ws.name = String(m.name || 'Guest').slice(0, 24);
      const r = getRoom(id);
      if (r.clients.size >= 20) return send(ws, { type: 'error', text: 'Room is full' });
      r.clients.add(ws);
      send(ws, { type: 'welcome', source: r.source, state: r.state, server: Date.now() });
      broadcast(r, { type: 'users', users: userList(r) });
      send(ws, { type: 'users', users: userList(r) });
      return;
    }

    const r = rooms.get(ws.room);
    if (!r) return;

    switch (m.type) {
      case 'state': {
        if (typeof m.time !== 'number' || !isFinite(m.time)) return;
        r.state = { playing: !!m.playing, time: Math.max(0, m.time), at: Date.now() };
        broadcast(r, { type: 'state', ...r.state, by: ws.name }, ws);
        break;
      }
      case 'source': {
        const mode = m.mode;
        if (!['file', 'link', 'site'].includes(mode)) return;
        const src = { mode, label: String(m.label || '').slice(0, 200), by: ws.name };
        if (mode !== 'file') {
          src.url = cleanUrl(m.url);
          if (!src.url) return;
        }
        r.source = src;
        r.state = { playing: false, time: 0, at: Date.now() };
        broadcast(r, { type: 'source', source: src, state: r.state }, ws);
        break;
      }
      case 'meta':
        broadcast(r, { type: 'meta', name: ws.name, duration: m.duration, file: String(m.file || '').slice(0, 200) }, ws);
        break;
      case 'chat':
        broadcast(r, { type: 'chat', name: ws.name, text: String(m.text || '').slice(0, 500) });
        break;
      case 'countdown':
        broadcast(r, { type: 'countdown', startAt: Date.now() + 5000, by: ws.name });
        break;
    }
  });

  ws.on('close', () => {
    const r = rooms.get(ws.room);
    if (!r) return;
    r.clients.delete(ws);
    if (!r.clients.size) rooms.delete(ws.room);
    else broadcast(r, { type: 'users', users: userList(r) });
  });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.alive) return ws.terminate();
    ws.alive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => console.log(`SyncWatch running on http://localhost:${PORT}`));
