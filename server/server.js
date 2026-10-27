// Frontline Forge authoritative server — STUB. Not deployed; multiplayer is offline in v1.
// Plan: clients send input commands {seq, move, look, fire, ads, actions[]} per tick; the server runs the
// same fixed 60 Hz Game.tick() headlessly (js/game.js, no renderer) and broadcasts Game.snapshot() at 20 Hz.
import { WebSocketServer } from 'ws';
const PORT = process.env.PORT || 8080, TICK_MS = 1000 / 60, SNAP_EVERY = 3;
const wss = new WebSocketServer({ port: PORT });
const rooms = new Map(); // roomId -> { players: Map<id, {ws, inputs: []}>, tick }
let nextId = 1;
wss.on('connection', ws => {
  const id = nextId++; let room = null;
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join') { room = rooms.get(msg.room) || { players: new Map(), tick: 0 }; rooms.set(msg.room, room); room.players.set(id, { ws, inputs: [] }); ws.send(JSON.stringify({ t: 'welcome', id })); }
    else if (msg.t === 'input' && room) room.players.get(id)?.inputs.push(msg); // TODO validate + apply in sim
  });
  ws.on('close', () => room?.players.delete(id));
});
setInterval(() => { for (const room of rooms.values()) { room.tick++;
  // TODO: game.tick(1/60) with each player's queued input (bots fill empty seats)
  if (room.tick % SNAP_EVERY === 0) { const snap = JSON.stringify({ t: 'snap', tick: room.tick /*, ...game.snapshot() */ }); for (const p of room.players.values()) p.ws.send(snap); } } }, TICK_MS);
console.log(`Frontline Forge stub server on :${PORT} (offline stub)`);
