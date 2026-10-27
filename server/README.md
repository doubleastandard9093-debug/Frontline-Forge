# Multiplayer server (stub, offline)
Not deployed. The client never connects; the Multiplayer menu says "coming soon".

To turn online play on:
1. Split `js/game.js` so the simulation (units, builds, vehicles, `tick()`, `snapshot()`) runs in Node without three.js rendering (keep math/raycasts on plain geometry).
2. Client: send input commands each tick with a sequence number; predict locally, reconcile against server snapshots, interpolate other entities by `id`.
3. Server: run `tick()` authoritatively per room, validate inputs (fire rate, ammo, build cost), fill empty seats with bots.
4. Add lobby/matchmaking + room codes; deploy with `fly launch --no-deploy && fly deploy` (needs a Fly.io account and billing).
5. Serve over `wss://`, add a server URL setting, and enable the Multiplayer button.
