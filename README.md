# Frontline Forge
Original browser shooter: fast FPS gunplay, grid building (walls, floors, ramps) with harvesting, ranked progression (XP, ranks, GP, gun unlocks, attachments, stat points), and pilotable vehicles. three.js, no build step.

**Play:** https://doubleastandard9093-debug.github.io/Frontline-Forge/ (add to iPhone Home Screen for full-screen play).

Graphics: Low (default, remembered) / High in Settings, or `?gfx=low|high`. Low never creates High-only textures, shadows or grass.
Multiplayer is offline in v1; see `server/README.md`.
All names, models and textures are original and generated in code.

## Gyro aim (phones, landscape)
Settings → Gyro aim: Enable gyro (asks iOS for Motion access; also asked once on your first match start), On, sensitivity, Invert X, Invert Y, ADS only.
Hold the phone sideways (either way round): turn your body or tilt it like a steering wheel to look left/right, tilt the top toward/away from you to look up/down. Adds on top of touch look, smoothed. Portrait pauses gyro and shows a "rotate your phone" hint. Works with rotation lock on (uses gravity to tell which way the phone is held). Needs HTTPS — the GitHub Pages link and its Home Screen app qualify.

## Loot, Classes & Zombies (save v2)
- **Loot guns**: procedural guns from 5 makers (Halvorsen, Kessly Arms, Torvik Labs, Brakka, Nimbus), Common→Legendary with colored beams, random stats, elements (fire / shock / corrosive / cryo DoT), damage numbers. Drop from enemies and chests (**F** to open). Walk over to auto-collect into the 20-slot backpack; **F** within 8 s equips it. Equip/sell in the Armory → Backpack.
- **Classes** (menu → Class & Skills): Vanguard (Bulwark), Ghostwire (Phase Cloak), Sparkwright (Arc Turret). **H** / SKILL button uses the action skill. 1 skill point per rank, 3 skills × 3 points each, respec for 100 GP.
- **Zombies** (mode → Zombies, map Gravewatch Abbey): co-op with 3 bots, escalating rounds, points for hits and kills. **F** buys doors, wall guns and ammo, perk drinks (Ironclad Stout, Quickdraw Cola, Doubletap Tonic, Swiftstep Spritz, Second Chance Soda), the Mystery Crate (950) and the Forge upgrade (5000). Power-ups: Max Ammo, Insta-Kill, Double Points, Nuke. When downed, a teammate revives you; bleeding out ends the run. The zombie cap is 10 on phone Low, 16 on Low and 24 on High.
- Old v1 saves are migrated automatically.

## Combat update (save v3)
- **TTK & shields:** 100 shield + 100 HP, shields refill after 3 s; headshots ×2 only once the shield is down.
- **Recoil & bloom:** each gun has its own learnable recoil pattern; sustained fire and moving widen spread.
- **Career loop:** prestige (P1–P10 from rank 16), 3 weekly challenges, daily first win, gun rentals (Valkyr, Warden, Scythe), durability on lr50/tg7 (repair 400 GP), camo/reticle crates.
- **Zombies:** Forge tiers, runners, bloaters, Bellwarden boss every 5 rounds, the Gravewatch escape Easter egg.
- **Class trees:** 3 branches × 5 tiers per class with capstones, 2 build slots.
- **Loot:** affixes, maker gimmicks (Torvik ricochet, Brakka throw, Nimbus homing), red-text legendaries, rank requirements.
- **Vehicle counterplay:** Skyhook LL-9 lock-on launcher (hold on a vehicle 1.2 s), EMP grenade (T to cycle; stalls vehicles 3 s, strips shields), Sparkwright pickaxe repairs friendly vehicles, F next to an enemy ground vehicle hijacks it, per-type respawn timers (buggy 20 s … tank/jet 60 s).
- **Bot difficulty:** pick Recruit / Regular / Veteran / Legend on the Play screen (reaction time, aim, grenade and vehicle use).
