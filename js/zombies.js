// Zombies mode (round survival), installed onto Game.prototype. Original names: drinks, machines, map.
import * as THREE from 'three';
import { GUNS } from './data.js';
import { genGun, RARITY, ELEMENTS } from './loot.js';
import { isPhone } from './gfx.js';
import { input } from './input.js';

export const PERKS = {
  ironclad: { name: 'Ironclad Stout', cost: 2500, color: 0xc0392b, desc: '250 max health' },
  quickdraw: { name: 'Quickdraw Cola', cost: 3000, color: 0x27ae60, desc: 'Reload 50% faster' },
  doubletap: { name: 'Doubletap Tonic', cost: 2000, color: 0xe67e22, desc: '+33% fire rate' },
  swiftstep: { name: 'Swiftstep Spritz', cost: 2000, color: 0x2e86de, desc: '+15% move speed' },
  secondchance: { name: 'Second Chance Soda', cost: 1500, color: 0x8e44ad, desc: 'Revive yourself once; revive allies 2x faster' },
};
const FORGE_COST = [5000, 5000, 10000];
const POWER = { maxammo: { name: 'MAX AMMO', color: 0xffffff }, insta: { name: 'INSTA-KILL', color: 0xff3b30 }, double: { name: 'DOUBLE POINTS', color: 0xffd84a }, nuke: { name: 'NUKE', color: 0x9be22d } };

export function installZombies(G) {
  const P = G.prototype;
  P.zSetup = function () {
    const Z = this.layout.z; this.timeLeft = 1e9;
    this.z = { round: 0, toSpawn: 0, alive: 0, betweenT: 4, spawnT: 0, pts: 500, insta: 0, dbl: 0, perks: new Set(), open: new Set(['start']), powers: [], powerN: 0, kills: 0, downs: 0, boxT: 0,
      cap: this.tier === 'low' ? (isPhone ? 10 : 24) : 48, egg: 0, runes: 0 };
    this.zDoors = Z.doors.map(d => { const h = d.debris ? 1.8 : 3.6; const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.w, h, d.d), this.m(d.debris ? 0x6b5a45 : 0x5a3b22, d.debris ? 'concrete' : 'wood'));
      mesh.position.set(d.x, h / 2, d.z); this.scene.add(mesh); mesh.userData.kind = 'static'; this.hitMeshes.push(mesh);
      const solid = { min: new THREE.Vector3(d.x - d.w / 2, 0, d.z - d.d / 2), max: new THREE.Vector3(d.x + d.w / 2, 4, d.z + d.d / 2) }; this.solids.push(solid); return Object.assign({ mesh, solid, open: false }, d); });
    this.zStations = Z.stations.map(st => { const g = new THREE.Group(); let mk = (w, h, d, c, y, basic) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic ? new THREE.MeshBasicMaterial({ color: c }) : this.m(c)); o.position.y = y; g.add(o); return o; };
      if (st.kind === 'wall') { const o = mk(1.4, 0.5, 0.06, 0xe8e2c8, 1.6, true); if (st.face) o.rotation.y = Math.PI / 2; }
      else if (st.kind === 'perk') { mk(1.1, 2.1, 0.8, PERKS[st.perk].color, 1.05); mk(1.0, 0.25, 0.82, 0xfff2c0, 2.25, true); }
      else if (st.kind === 'box') { mk(1.8, 0.8, 0.9, 0x3a2a18, 0.4); mk(1.85, 0.12, 0.95, 0x6fd3ff, 0.86, true); }
      else if (st.kind === 'forge') { mk(1.4, 1.1, 1.0, 0x2b2b2e, 0.55); mk(1.0, 0.3, 0.6, 0xff7a1a, 1.25, true); }
      g.position.set(st.x, 0, st.z); this.scene.add(g); if (st.kind !== 'wall') this.solids.push({ min: new THREE.Vector3(st.x - 0.8, 0, st.z - 0.6), max: new THREE.Vector3(st.x + 0.8, 2.2, st.z + 0.6) }); return Object.assign({ mesh: g }, st); });
    this.zombiePool = [];
    // Easter egg: shoot 3 hidden runestones -> ring the abbey bell -> kill the Bellwarden -> escape through the crypt gate
    this.zRunes = [[-38, 2.6, 30], [-38, 2.2, -25], [38, 2.2, -25]].map(([x, y, zz]) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0x7affd4 }));
      m.position.set(x, y, zz); m.userData = { kind: 'rune' }; this.scene.add(m); this.hitMeshes.push(m); return m; });
    this.zStations.push(Object.assign({ mesh: null, kind: 'bell', x: 0, z: -22, hidden: true }));
    for (const w of this.slots) if (!w.pick) w.reserve = w.mag * 4;
    // light the scene for night
    this.scene.fog.near = 18; this.scene.fog.far = 70;
  };
  P.zZoneOf = function (x, z) { return z > 15 ? 'start' : x < -10 ? 'west' : x > 10 ? 'east' : 'center'; };
  P.zNextRound = function () {
    const z = this.z; z.round++; if (z.round % 5 === 0) z.bossDue = (z.bossDue || 0) + 1; z.toSpawn = Math.min(6 + z.round * 3 + (this.units.filter(u => u.team === 0).length - 1) * 2, 120); z.spawnT = 2; z.powerN = 0;
    for (const u of this.units) if (u.team === 0 && !u.isPlayer && (!u.alive || u.downed)) { u.downed = false; if (u.mesh) u.mesh.rotation.z = 0; this.spawn(u, { id: 'p', x: this.player.pos.x, z: this.player.pos.z }); }
    this.hooks.toast(`ROUND ${z.round}`); this.sfx('lost'); this.score = [z.round, z.toSpawn];
  };
  P.zSpawnZombie = function () {
    const z = this.z, opts = []; for (const k of z.open) for (const s of this.layout.z.spawns[k]) { const d = Math.hypot(s[0] - this.player.pos.x, s[1] - this.player.pos.z); if (d > 10) opts.push(s); }
    if (!opts.length) return; const s = opts[Math.floor(Math.random() * opts.length)];
    let u = this.zombiePool.find(x => !x.alive);
    if (!u) { u = this.makeUnit(1, false, 'Shambler'); u.zombie = true; const [body, legs, head, helm, gun] = u.mesh.children;
      body.material = this.m(0x4c5a3a); legs.material = this.m(0x2e2a24); head.material = this.m(0x8f9d76); helm.visible = false; gun.visible = false;
      const armG = new THREE.BoxGeometry(0.14, 0.14, 0.7), am = this.m(0x8f9d76); for (const x of [-0.3, 0.3]) { const a = new THREE.Mesh(armG, am); a.position.set(x, 1.35, -0.35); u.mesh.add(a); }
      this.zombiePool.push(u); }
    const R = z.round; u.maxHp = Math.round(R < 10 ? 60 + R * 40 : (60 + 9 * 40) * Math.pow(1.1, R - 9)); u.maxSh = 0;
    u.speed = R < 3 ? 2.2 : R < 6 ? 3.2 + Math.random() * 1.2 : 4.4 + Math.random() * 1.4; u.dmg = 35 + R * 2;
    // special zombies: runners (R4+), bloaters that burst (R6+), an armored boss every 5th round (or summoned by the bell)
    const boss = z.bossDue > 0, t = boss ? 'boss' : R >= 6 && Math.random() < 0.1 ? 'bloater' : R >= 4 && Math.random() < 0.15 ? 'runner' : 'shambler'; if (boss) z.bossDue--;
    u.ztype = t; u.name = { shambler: 'Shambler', runner: 'Runner', bloater: 'Bloater', boss: 'Bellwarden' }[t];
    const [body] = u.mesh.children; body.material = this.m({ shambler: 0x4c5a3a, runner: 0x8a8f7a, bloater: 0x6b7a2a, boss: 0x3a3f4a }[t]);
    u.mesh.scale.setScalar(t === 'boss' ? 1.6 : t === 'bloater' ? 1.25 : 1);
    if (t === 'runner') { u.maxHp = Math.round(u.maxHp * 0.6); u.speed = 6.2 + Math.random(); }
    if (t === 'bloater') { u.maxHp = Math.round(u.maxHp * 1.8); u.speed = 2.4; }
    if (t === 'boss') { u.maxHp = Math.round(u.maxHp * 12 + 1500); u.speed = 3.6; u.dmg = 70; u.armored = true; this.hooks.toast(z.summoned ? 'THE BELLWARDEN ANSWERS' : 'BOSS: Bellwarden'); }
    this.spawn(u, { id: 'z', x: s[0], z: s[1] }); u.sh = 0; u.spawnProt = 0; u.target = null; u.atkCd = 0; u.dot = null; u.pos.x = s[0] + (Math.random() - 0.5) * 2; u.pos.z = s[1] + (Math.random() - 0.5) * 2;
    z.toSpawn--; z.alive++;
  };
  P.zombieThink = function (u, dt) {
    u.think -= dt; if (u.think <= 0 || !u.target?.alive || u.target.downed) { u.think = 0.5; let best = null, bd = 1e9;
      for (const e of this.units) if (e.alive && e.team === 0 && !e.downed && !(e.cloakT > 0)) { const d = e.pos.distanceTo(u.pos); if (d < bd) { bd = d; best = e; } } u.target = best; }
    const t = u.target; if (!t) return; const dist = t.pos.distanceTo(u.pos);
    const wp = dist < 5 ? t.pos : this.pathTo(u, t.pos, 'foot'); const d = wp.clone().sub(u.pos); d.y = 0; const l = d.length();
    let mx = 0, mz = 0; if (l > 0.9) { mx = d.x / l; mz = d.z / l; } u.yaw = Math.atan2(-(t.pos.x - u.pos.x), -(t.pos.z - u.pos.z));
    const sp = u.speed * (u.dot?.elem === 'cryo' ? 0.5 : 1); this.moveUnit(u, mx * sp * dt, mz * sp * dt, dt, u.bumped && Math.random() < 0.03);
    u.atkCd -= dt; if (dist < 1.4 && u.atkCd <= 0) { u.atkCd = 1.1; this.sfx('melee', u.pos); this.hurt(t, u.dmg, u, false); }
    u.mesh.position.copy(u.pos); u.mesh.rotation.y = u.yaw; u.mesh.position.y += Math.abs(Math.sin(performance.now() / 180 + u.id)) * 0.06;
  };
  // hit/kill points and drops
  P.zHit = function (u, src) { if (src?.isPlayer) this.zPts(10); };
  // Guns keep pace with exponential zombie HP: x1.08 per round after 10. Armored bosses take half damage to the body.
  P.zDmgMul = function (u, src, head) { const R = this.z.round; return (src?.team === 0 ? Math.pow(1.08, Math.max(0, R - 10)) : 1) * (u.armored && !head ? 0.5 : 1); };
  P.zRune = function (m) { const z = this.z; if (!m.visible) return; m.visible = false; this.hitMeshes = this.hitMeshes.filter(x => x !== m); z.runes++; this.sfx('capture');
    this.hooks.toast(z.runes < 3 ? `A runestone shatters (${z.runes}/3)` : 'The abbey bell stirs…'); if (z.runes >= 3) { z.egg = 1; const b = this.zStations.find(s => s.kind === 'bell'); b.hidden = false;
      const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 1.1, 8), this.m(0xb08a3a, 'metal')); c.position.y = 2.2; g.add(c); const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 0.2), this.m(0x3a2a18, 'wood')); p.position.y = 1.4; g.add(p); g.position.set(b.x, 0, b.z); this.scene.add(g); b.mesh = g; } };
  P.zKill = function (u, src, head) {
    const z = this.z; z.alive--; z.kills++; this.score = [z.round, z.toSpawn + z.alive];
    if (src?.isPlayer) this.zPts(head ? 100 : 60);
    if (u.ztype === 'bloater') { this.explode(u.pos.clone().setY(1), 40, 3.2, u); }
    if (u.ztype === 'boss') { this.zDropPower(u.pos, 'maxammo'); if (src?.isPlayer) this.zPts(1000); if (z.egg === 2) { z.egg = 3; this.zOpenExit(); } }
    else if (z.powerN < 4 && Math.random() < 0.035) { z.powerN++; this.zDropPower(u.pos); }
  };
  P.zPts = function (n) { this.z.pts += n * (this.z.dbl > 0 ? 2 : 1); };
  P.zOpenExit = function () { const g = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 0.4), new THREE.MeshBasicMaterial({ color: 0x7affd4, transparent: true, opacity: 0.6 }));
    g.position.set(0, 1.7, -38); this.scene.add(g); this.zExit = g; this.hooks.toast('The crypt gate is open — ESCAPE (center, north wall)'); };
  P.zDropPower = function (pos, force) {
    const k = force || Object.keys(POWER)[Math.floor(Math.random() * 4)]; const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: POWER[k].color }));
    m.position.set(pos.x, 1.2, pos.z); this.scene.add(m); this.z.powers.push({ k, mesh: m, life: 25 });
  };
  P.zPower = function (k) {
    const z = this.z; this.hooks.toast(POWER[k].name); this.sfx('capture');
    if (k === 'maxammo') for (const w of this.slots) if (!w.pick) { w.ammo = w.mag; w.reserve = w.mag * 4; }
    if (k === 'insta') z.insta = 30; if (k === 'double') z.dbl = 30;
    if (k === 'nuke') { for (const u of this.units) if (u.zombie && u.alive) { u.alive = false; u.mesh.visible = false; z.alive--; } this.score = [z.round, z.toSpawn + z.alive]; this.zPts(400); this.explode(this.player.pos.clone().setY(30), 0, 1, this.player); }
  };
  P.zDown = function (u) {
    u.downed = true; u.hp = 1; u.sh = 0; u.bleed = 30; u.revT = 0; u.target = null; this.z.downs++;
    if (u.mesh) u.mesh.rotation.z = 1.4;
    if (u.isPlayer) { this.hooks.toast('YOU ARE DOWN'); this.zLostPerks = [...this.z.perks]; this.zSelfRevive = this.z.perks.has('secondchance'); this.z.perks.clear(); this.applyPerks(); this.selectSlot(1); }
  };
  P.zRevive = function (u) { u.downed = false; u.hp = u.maxHp; u.revT = 0; if (u.mesh) u.mesh.rotation.z = 0; if (u.isPlayer) this.hooks.toast('Revived'); };
  P.applyPerks = function () { const pk = this.z.perks, Pl = this.player;
    Pl.maxHp = (100 + this.save.stats.hp * 5) * (pk.has('ironclad') ? 2.5 : 1); Pl.hp = Math.min(Pl.hp, Pl.maxHp); if (pk.has('ironclad')) Pl.hp = Pl.maxHp;
    Pl.zSpeed = pk.has('swiftstep') ? 1.15 : 1;
    for (const w of this.slots) if (!w.pick) { w.baseReload = w.baseReload || w.reload; w.baseRpm = w.baseRpm || w.rpm; w.reload = w.baseReload * (pk.has('quickdraw') ? 0.5 : 1); w.rpm = w.baseRpm * (pk.has('doubletap') ? 1.33 : 1); } };
  P.zGive = function (w) { // put a weapon into the current gun slot
    const i = this.slot === 2 ? 0 : this.slot; w.reserve = w.mag * 4; this.slots[i] = w; w.baseReload = 0; w.baseRpm = 0; this.applyPerks(); this.selectSlot(i); };
  P.zNear = function () { const Pl = this.player; let best = null, bd = 1e9;
    for (const s of this.zStations) { if (s.hidden) continue; const d = Math.hypot(s.x - Pl.pos.x, s.z - Pl.pos.z); if (d < 2.6 && d < bd) { bd = d; best = s; } }
    for (const d of this.zDoors) if (!d.open) { const dd = Math.hypot(d.x - Pl.pos.x, d.z - Pl.pos.z); if (dd < 3.2 && dd < bd) { bd = dd; best = d; } }
    for (const u of this.units) if (u.downed && !u.isPlayer && u.alive) { const dd = u.pos.distanceTo(Pl.pos); if (dd < 2 && dd < bd) { bd = dd; best = { kind: 'revive', u }; } }
    return best; };
  P.zInteract = function () {
    if (this.mode !== 'zombies' || this.player.downed || !this.player.alive) return false; const s = this.zNear(); if (!s) return false; const z = this.z, pay = c => { if (z.pts < c) { this.hooks.toast(`Need ${c} points`); return false; } z.pts -= c; this.sfx('ui'); return true; };
    if (s.kind === 'revive') { s.u.reviver = this.player; return true; }
    if (s.zone) { if (pay(s.cost)) { for (const d of this.zDoors.filter(d => d.zone === s.zone && !d.open)) { d.open = true; this.scene.remove(d.mesh); this.solids = this.solids.filter(x => x !== d.solid); this.hitMeshes = this.hitMeshes.filter(x => x !== d.mesh); }
      z.open.add(s.zone); this.nav.dirty = true; this.hooks.toast(`${s.name} opened`); } return true; }
    if (s.kind === 'wall') { const have = this.slots.find(w => w.id === s.gun);
      if (have) { if (pay(Math.round(s.cost / 2))) { have.ammo = have.mag; have.reserve = have.mag * 4; this.hooks.toast('Ammo bought'); } }
      else if (pay(s.cost)) { this.zGive(this.makeWeapon(s.gun)); this.hooks.toast(`Bought ${GUNS[s.gun].name}`); } return true; }
    if (s.kind === 'perk') { const pk = PERKS[s.perk]; if (z.perks.has(s.perk)) { this.hooks.toast(`Already drinking ${pk.name}`); return true; } if (z.perks.size >= 4) { this.hooks.toast('Max 4 drinks'); return true; }
      if (pay(pk.cost)) { z.perks.add(s.perk); this.applyPerks(); this.hooks.toast(`${pk.name}: ${pk.desc}`); } return true; }
    if (s.kind === 'box') { if (z.boxT > 0) return true; if (pay(s.cost)) { z.boxT = 1.4; setTimeout(() => { if (this.mode !== 'zombies') return;
        let w; if (Math.random() < 0.5) { const ids = Object.keys(GUNS); w = this.makeWeapon(ids[Math.floor(Math.random() * ids.length)]); }
        else { const g = genGun(this.save.rank + 4 + z.round, Math.random() < 0.15 ? 4 : Math.random() < 0.5 ? 3 : 2); Object.assign(g, { uid: 0 }); w = Object.assign({ id: 'box' + Math.random() }, g); w.adsZoom = g.zoom || 1.15; w.ammo = w.mag; w.reloading = 0; }
        this.zGive(w); this.hooks.toast(`Mystery Crate: ${w.name}`); }, 1400); } return true; }
    if (s.kind === 'bell') { if (s.hidden || z.egg !== 1) return false; z.egg = 2; z.summoned = true; z.bossDue = (z.bossDue || 0) + 1; z.toSpawn++; this.sfx('lost'); this.hooks.toast('The bell tolls… something comes'); return true; }
    if (s.kind === 'forge') { const i = this.slot === 2 ? 0 : this.slot, w = this.slots[i], tier = w.forged || 0; if (tier >= 3) { this.hooks.toast('Fully forged (III)'); return true; }
      // Forge tiers: I 5000 (x2.2 dmg, element), II 5000 (x1.6, +50% element DoT), III 10000 (x1.6, +25% mag, +fire rate)
      const cost = FORGE_COST[tier]; if (pay(cost)) { const el = Object.keys(ELEMENTS)[Math.floor(Math.random() * 4)], base = w.baseName || w.name; w.baseName = base;
        if (tier === 0) Object.assign(w, { dmg: w.dmg * 2.2, mag: Math.round(w.mag * 1.5), elem: w.elem || el, elemChance: Math.max(w.elemChance || 0, 0.3), elemDps: Math.max(w.elemDps || 0, Math.round(w.dmg * 1.5)) });
        if (tier === 1) Object.assign(w, { dmg: w.dmg * 1.6, elemChance: w.elemChance + 0.1, elemDps: Math.round(w.elemDps * 1.5) });
        if (tier === 2) { Object.assign(w, { dmg: w.dmg * 1.6, mag: Math.round(w.mag * 1.25) }); w.baseRpm = (w.baseRpm || w.rpm) * 1.15; this.applyPerks(); }
        w.forged = tier + 1; w.name = `Forged${['', ' II', ' III'][tier]} ${base}`;
        w.ammo = w.mag; w.reserve = w.mag * 6; this.selectSlot(i); this.hooks.toast(`${w.name} (${ELEMENTS[w.elem].name})`); } return true; }
    return false;
  };
  P.zUpdate = function (dt) {
    const z = this.z, Pl = this.player; z.insta = Math.max(0, z.insta - dt); z.dbl = Math.max(0, z.dbl - dt); z.boxT = Math.max(0, z.boxT - dt);
    if (z.toSpawn <= 0 && z.alive <= 0) { z.betweenT -= dt; if (z.betweenT <= 0) { z.betweenT = 9; this.zNextRound(); } }
    else { z.spawnT -= dt; if (z.spawnT <= 0 && z.toSpawn > 0 && z.alive < z.cap) { z.spawnT = Math.max(0.4, 1.8 - z.round * 0.08); this.zSpawnZombie(); } }
    for (const p of z.powers.slice()) { p.mesh.rotation.y += dt * 2; p.life -= dt; p.mesh.visible = p.life > 6 || Math.floor(p.life * 4) % 2 === 0;
      if (Math.hypot(p.mesh.position.x - Pl.pos.x, p.mesh.position.z - Pl.pos.z) < 1.6 && Pl.alive && !Pl.downed) { p.life = 0; this.zPower(p.k); }
      if (p.life <= 0) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); z.powers = z.powers.filter(x => x !== p); } }
    // downed: bleed out, revives (bots go to downed allies; player can revive bots with F)
    const allies = this.units.filter(u => u.team === 0 && u.alive);
    for (const d of allies) { if (!d.downed) continue; d.bleed -= dt;
      if (d.isPlayer && this.zSelfRevive && d.bleed < 26) { this.zSelfRevive = false; this.zRevive(d); continue; }
      let r = d.reviver; if (!r || !r.alive || r.downed || (r !== Pl && r.reviveFor !== d)) { r = null; let bd = 40; for (const b of allies) if (!b.isPlayer && !b.downed && !b.reviveFor) { const dd = b.pos.distanceTo(d.pos); if (dd < bd) { bd = dd; r = b; } } if (r) { r.reviveFor = d; d.reviver = r; } }
      if (r && r.pos.distanceTo(d.pos) < 1.8) { d.revT += dt * (r === Pl && z.perks.has('secondchance') ? 2 : 1); if (d.revT >= 3) { this.zRevive(d); if (r.reviveFor === d) r.reviveFor = null; d.reviver = null; } } else d.revT = 0;
      if (d.bleed <= 0) { d.downed = false; d.alive = false; d.respawn = 1e9; if (d.mesh) d.mesh.visible = false; if (r && r.reviveFor === d) r.reviveFor = null; if (d.isPlayer) return this.end(); } }
    if (Pl.downed && !allies.some(u => !u.downed)) return this.end();
    if (this.zExit && !Pl.downed && Math.hypot(Pl.pos.x, Pl.pos.z + 38) < 2.5) { z.escaped = true; return this.end(); }
    for (const m of this.zRunes) if (m.visible) m.rotation.y += dt;
    // prompt
    const s = Pl.downed ? null : this.zNear(), tap = matchMedia('(pointer: coarse)').matches ? 'ENTER' : 'F';
    this.zPrompt = Pl.downed ? `DOWN · bleeding out ${Math.ceil(Pl.bleed)}s${this.zSelfRevive ? ' · Second Chance kicking in…' : ' · hold on for a revive'}` : !s ? '' :
      s.kind === 'revive' ? `${tap}: revive ${s.u.name}${s.u.revT > 0 ? ' ' + Math.round(s.u.revT / 3 * 100) + '%' : ''}` : s.zone ? `${tap}: open ${s.name} [${s.cost}]` :
      s.kind === 'wall' ? (this.slots.find(w => w.id === s.gun) ? `${tap}: ammo for ${GUNS[s.gun].name} [${Math.round(s.cost / 2)}]` : `${tap}: buy ${GUNS[s.gun].name} [${s.cost}]`) :
      s.kind === 'perk' ? `${tap}: ${PERKS[s.perk].name} — ${PERKS[s.perk].desc} [${PERKS[s.perk].cost}]` : s.kind === 'box' ? `${tap}: Mystery Crate [${s.cost}]` : s.kind === 'bell' ? `${tap}: ring the abbey bell` : (() => { const t = this.slots[this.slot === 2 ? 0 : this.slot].forged || 0; return t >= 3 ? 'Forge Anvil: fully forged' : `${tap}: Forge Anvil — tier ${['I', 'II', 'III'][t]} [${FORGE_COST[t]}]`; })();
  };
  P.zEnd = function () { const z = this.z, s = this.stats; const xp = Math.round(z.round * 180 + z.kills * 40), gp = Math.round(z.round * 70 + z.kills * 6);
    return { won: !!z.escaped, escaped: !!z.escaped, zombies: true, round: z.round, xp: xp + (z.escaped ? 5000 : 0), gp: gp + (z.escaped ? 2500 : 0), stats: s, score: [z.round, z.kills] }; };
}
