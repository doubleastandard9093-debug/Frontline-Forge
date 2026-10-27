# Frontline Forge
Original browser shooter: fast FPS gunplay, grid building (walls, floors, ramps) with harvesting, ranked progression (XP, ranks, GP, gun unlocks, attachments, stat points), and pilotable vehicles. three.js, no build step.

**Play:** https://doubleastandard9093-debug.github.io/Frontline-Forge/ (add to iPhone Home Screen for full-screen play).

Graphics: Low (default, remembered) / High in Settings, or `?gfx=low|high`. Low never creates High-only textures, shadows or grass.
Multiplayer is offline in v1; see `server/README.md`.
All names, models and textures are original and generated in code.

## Gyro aim (phones, landscape)
Settings → Gyro aim: Enable gyro (asks iOS for Motion access; also asked once on your first match start), On, sensitivity, Invert X, Invert Y, ADS only.
Hold the phone sideways (either way round): turn your body or tilt it like a steering wheel to look left/right, tilt the top toward/away from you to look up/down. Adds on top of touch look, smoothed. Portrait pauses gyro and shows a "rotate your phone" hint. Works with rotation lock on (uses gravity to tell which way the phone is held). Needs HTTPS — the GitHub Pages link and its Home Screen app qualify.
