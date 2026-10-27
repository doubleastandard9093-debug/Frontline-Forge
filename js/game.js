import * as THREE from 'three';
import { GUNS, ATTACH, BUILD, GRID } from './data.js';
import { MAPS } from './maps.js';
import { mat, makeRenderer, isPhone } from './gfx.js';
import { Nav } from './nav.js';
import { RARITY, ELEMENTS, genGun } from './loot.js';
import { BACKPACK } from './save.js';
import { CLASSES, lv } from './classes.js';
import { installZombies } from './zombies.js';
import { KINDS, createVehicle, syncSolid } from './vehicles.js';
import { input, pollKeys, consume, endFrame, consumeHeld } from './input.js';

const TICK = 1 / 60, EYE = 1.6, RAD = 0.4, GRAV = 15; // lower gravity, floaty high jumps
const BOT_NAMES = ['Viper','Rook','Hatch','Nomad','Quill','Saber','Ghostline','Tank','Moth','Flint','Ruckus','Jinx','Bolt','Cinder','Drift','Echo','Grim','Halo','Ion','Kestrel','Lynx','Mako','Onyx','Pike'];

export class Game {
  constructor(canvas, tier, save, hooks) {
    this.tier = tier; this.save = save; this.hooks = hooks;
    this.renderer = makeRenderer(canvas, tier);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 600);
    this.ray = new THREE.Raycaster();
    this.matCache = {};
    addEventListener('resize', () => this.resize()); this.resize();
    this.running = false;
  }
  m(color, kind, rep) { const k = `${color}|${kind}|${rep}`; return this.matCache[k] || (this.matCache[k] = mat(this.tier, color, kind, rep)); }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // ---------- match setup ----------
  start(mapId, mode = 'tdm') {
    this.choosing = false; this.sfx = () => {}; this.engine = () => {};
    const M = this.map = MAPS[mapId]; this.mode = mode; const L = M.gen(); this.layout = L;
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(M.sky);
    s.fog = new THREE.Fog(M.sky, M.size * 0.6, M.size * 1.6);
    s.add(new THREE.HemisphereLight(0xdfefff, 0x4a4030, this.tier === 'high' ? 1.1 : 1.4));
    const sun = new THREE.DirectionalLight(0xfff2dd, this.tier === 'high' ? 2.2 : 1.3); sun.position.set(40, 80, 30); s.add(sun);
    if (this.tier === 'high') { sun.castShadow = true; const h = M.size * 0.6; Object.assign(sun.shadow.camera, { left: -h, right: h, top: h, bottom: -h, far: 300 });
      sun.shadow.mapSize.set(isPhone ? 1024 : 2048, isPhone ? 1024 : 2048); sun.shadow.bias = -0.0005; s.add(sun.target); }
    this.solids = []; this.ramps = []; this.hitMeshes = []; this.builds = []; this.harvest = []; this.tracers = [];
    const g = new THREE.Mesh(new THREE.PlaneGeometry(M.size * 2.4, M.size * 2.4), this.m(M.ground, 'ground', M.size / 6));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; g.userData.kind = 'ground'; s.add(g); this.hitMeshes.push(g);
    const half = M.size / 2;
    for (const [x, z, w, d] of [[0, -half - 1, M.size + 4, 2], [0, half + 1, M.size + 4, 2], [-half - 1, 0, 2, M.size + 4], [half + 1, 0, 2, M.size + 4]])
      this.addBox(x, z, w, d, 6, 0x6e6a60, 'concrete');
    for (const w of (L.water || [])) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(w[1] - w[0], w[3] - w[2]), this.tier === 'high' ? new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }) : new THREE.MeshLambertMaterial({ color: 0x3a7896 }));
      wm.rotation.x = -Math.PI / 2; wm.position.set((w[0] + w[1]) / 2, 0.04, (w[2] + w[3]) / 2); wm.userData.kind = 'ground'; s.add(wm); }
    this.capPoints = (L.caps || []).map(c => { const ring = new THREE.Mesh(new THREE.RingGeometry(7.4, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, 0.08, c.z); s.add(ring);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7, 0.2), this.m(0xdddddd)); pole.position.set(c.x, 3.5, c.z); s.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff })); flag.position.set(c.x + 0.8, 6.4, c.z); s.add(flag);
      return Object.assign({}, c, { owner: -1, prog: 0, ring, flag }); });
    this.capTick = 0;
    for (const b of L.boxes) this.addBox(b[0], b[1], b[2], b[3], b[4], { concrete: 0x9a958a, metal: 0x58636e, wood: 0x8d6a3e }[b[5]], b[5]);
    const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 3, 6), leafG = new THREE.ConeGeometry(1.6, 4, this.tier === 'high' ? 8 : 5), rockG = new THREE.DodecahedronGeometry(1.2, 0);
    for (const [x, z] of L.trees) { const t = new THREE.Group(); const tr = new THREE.Mesh(trunkG, this.m(0x5a3d22, 'wood')); tr.position.y = 1.5;
      const lf = new THREE.Mesh(leafG, this.m(0x2f5d2a)); lf.position.y = 4.2; t.add(tr, lf); t.position.set(x, 0, z); s.add(t);
      [tr, lf].forEach(o => { o.castShadow = true; o.userData = { kind: 'harvest', res: 'wood', obj: t }; this.hitMeshes.push(o); });
      t.userData = { hp: 120 }; this.solids.push({ min: new THREE.Vector3(x - 0.4, 0, z - 0.4), max: new THREE.Vector3(x + 0.4, 6, z + 0.4), obj: t }); }
    for (const [x, z] of L.rocks) { const r = new THREE.Mesh(rockG, this.m(0x7d7d78, 'concrete')); r.position.set(x, 0.6, z); r.castShadow = true; s.add(r);
      r.userData = { kind: 'harvest', res: 'stone', obj: r, hp: 180 }; r.userData.obj = r; this.hitMeshes.push(r);
      this.solids.push({ min: new THREE.Vector3(x - 1, 0, z - 1), max: new THREE.Vector3(x + 1, 1.6, z + 1), obj: r }); }
    if (this.tier === 'high') { // High-only decoration
      const grassG = new THREE.ConeGeometry(0.08, 0.5, 3), grassM = new THREE.MeshStandardMaterial({ color: 0x4f7a35, roughness: 1 });
      const n = isPhone ? 1500 : 5000, im = new THREE.InstancedMesh(grassG, grassM, n), d = new THREE.Object3D();
      for (let i = 0; i < n; i++) { d.position.set((Math.random() - 0.5) * M.size, 0.25, (Math.random() - 0.5) * M.size); d.rotation.set(0, Math.random() * 6, (Math.random() - 0.5) * 0.4); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
      s.add(im);
    }
    // weapons viewmodel
    this.view = new THREE.Group(); this.camera.add(this.view); s.add(this.camera);
    // units
    this.nextId = 0; this.units = []; this.score = [0, 0]; this.timeLeft = M.time; this.over = false;
    const st = this.save.stats;
    this.player = this.makeUnit(0, true, 'You'); this.player.maxHp = 100 + st.hp * 5;
    const lowPhone = this.tier === 'low' && isPhone; this.teamSize = lowPhone ? Math.min(M.teamSize, 6) : this.tier === 'low' ? Math.min(M.teamSize, 12) : M.teamSize; // phone Low caps bots
    this.camera.far = this.tier === 'low' ? Math.min(220, M.size * 1.4) : 600; this.camera.updateProjectionMatrix();
    for (let i = 1; i < this.teamSize; i++) this.makeUnit(0, false, BOT_NAMES[i % BOT_NAMES.length]);
    const foes = mode === 'coop' ? Math.round(this.teamSize * 1.5) : this.teamSize; // co-op: your bot squad vs a larger, sharper enemy force
    if (mode !== 'zombies') for (let i = 0; i < foes; i++) { const b = this.makeUnit(1, false, BOT_NAMES[(i + 12) % BOT_NAMES.length]); if (mode === 'coop') b.skill = Math.min(0.95, b.skill + 0.1); }
    this.units.forEach(u => this.spawn(u));
    this.pickups = []; this.racks = (L.racks || []).map(([id, x, z]) => ({ id, x, z, t: 0 }));
    this.nadesLive = []; this.nadeType = 'frag';
    this.vehicles = []; for (const [k, x, z, team] of (L.vehicles || [])) this.vehicles.push(createVehicle(this, k, x, z, team, ++this.nextId));
    // loadout
    const lo = this.save.loadout; this.slots = [lo.primary, lo.secondary, 'pick'].map(id => id === 'pick' ? { id, pick: true } : this.makeWeapon(id));
    this.mats = { wood: 30, stone: 0 }; this.slot = 0; this.buildMode = null; this.buildRot = 0;
    this.stats = { kills: 0, deaths: 0, head: 0, dmg: 0, builds: 0 }; this.recoilP = 0; this.fireT = 0;
    this.lootDrops = []; this.chests = []; this.lastLoot = null; this.dropCap = this.tier === 'low' ? (isPhone ? 10 : 16) : 30;
    if (mode !== 'zombies') { const nC = { small: 3, large: 6, war: 9 }[M.type] || 3, hh = M.size / 2 - 6;
      for (let i = 0, tries = 0; i < nC && tries < 200; tries++) { const p = new THREE.Vector3((Math.random() - 0.5) * hh * 2, 0, (Math.random() - 0.5) * hh * 2); if (this.blocked(p) || this.isWater(p.x, p.z) || Math.abs(p.z) > hh - 8) continue; this.addChest(p); i++; } }
    this.applyClass(); this.turrets = []; this.z = null; this.zPrompt = ''; this.interact = () => this.zInteract();
    if (mode === 'zombies') this.zSetup();
    this.nav = new Nav(this); this.selectSlot(0); this.makeGhost();
    this.running = true; this.last = performance.now(); this.hooks.hud(this);
    if (!this.loopOn) { this.loopOn = true; const loop = t => { requestAnimationFrame(loop); this.frame(t); }; requestAnimationFrame(loop); }
  }
  addBox(x, z, w, d, h, color, kind) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.m(color, kind, Math.max(1, Math.round(w / 4))));
    mesh.position.set(x, h / 2, z); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.kind = 'static'; this.scene.add(mesh); this.hitMeshes.push(mesh);
    this.solids.push({ min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, h, z + d / 2) });
  }
  gunDef(id) { if (typeof id === 'string' && id[0] === 'L') return this.save.inv.find(x => 'L' + x.uid === id) || GUNS.kr4; return GUNS[id] || GUNS.kr4; }
  makeWeapon(id) {
    const base = this.gunDef(id), att = base.loot ? {} : this.save.attach[id] || {}; const w = Object.assign({ id }, base); w.adsZoom = base.zoom || 1.15;
    for (const a of Object.values(att)) { const mod = ATTACH[a]?.mod || {}; for (const k in mod) w[k] = k === 'adsZoom' ? Math.max(w[k], mod[k]) : w[k] * mod[k]; }
    w.mag = Math.round(w.mag); w.reload *= 1 - this.save.stats.reload * 0.04; w.ammo = w.mag; w.reloading = 0; return w;
  }
  makeUnit(team, isPlayer, name) {
    const u = { id: ++this.nextId, team, isPlayer, name, pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, hp: 100, maxHp: 100, sh: 100, maxSh: 100, shT: 9, alive: true, onGround: false, kills: 0, deaths: 0, respawn: 0 };
    if (!isPlayer) {
      const g = new THREE.Group(), col = team === 0 ? 0x3d6fb0 : 0xb5452f;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4), this.m(col)); body.position.y = 1.05;
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.35), this.m(0x34362c)); legs.position.y = 0.28;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), this.m(0xc9a07a)); head.position.y = 1.8;
      const helm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), this.m(team === 0 ? 0x24456e : 0x6e2a1c)); helm.position.y = 2.0;
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), this.m(0x222222)); gun.position.set(0.25, 1.25, -0.4);
      g.add(body, legs, head, helm, gun); this.scene.add(g); u.mesh = g;
      [body, legs, gun].forEach(p => { p.castShadow = true; p.userData = { kind: 'unit', unit: u, head: false }; this.hitMeshes.push(p); });
      [head, helm].forEach(p => { p.castShadow = true; p.userData = { kind: 'unit', unit: u, head: true }; this.hitMeshes.push(p); });
      u.gun = this.makeWeaponBot(); u.think = 0; u.target = null; u.wp = new THREE.Vector3(); u.strafe = 1; u.flanker = Math.random() < 0.35; u.skill = 0.55 + Math.random() * 0.35;
    }
    this.units.push(u); return u;
  }
  makeWeaponBot() { const ids = ['kr4', 'kr4', 'hx2', 'bm12', 'vx9']; const id = ids[Math.floor(Math.random() * ids.length)], b = GUNS[id]; return Object.assign({ id, ammo: b.mag, reloading: 0, cd: 0 }, b); }
  // Spawn options: team base plus held, uncontested capture points.
  spawnOptions(team) { return [{ id: 'base', name: 'Base', x: this.layout.spawns[team][0], z: this.layout.spawns[team][1] }].concat(this.capPoints.filter(c => c.owner === team && !c.contested).map(c => ({ id: c.n, name: `${c.n} ${c.name}`, x: c.x, z: c.z }))); }
  spawn(u, at) {
    if (!at && !u.isPlayer && this.capPoints.length && Math.random() < 0.5) { const o = this.spawnOptions(u.team); at = o[Math.floor(Math.random() * o.length)]; }
    const isBase = !at || at.id === 'base', sp = isBase ? this.layout.spawns[u.team] : [at.x, at.z], h = this.map.size / 2 - 3, spread = isBase ? Math.min(this.map.size * 0.5, 60) : 10;
    for (let tries = 0; tries < 20; tries++) {
      u.pos.set(THREE.MathUtils.clamp(sp[0] + (Math.random() - 0.5) * spread, -h, h), 0, THREE.MathUtils.clamp(sp[1] + (Math.random() - 0.5) * (isBase ? 8 : 10), -h, h));
      if (!this.blocked(u.pos)) break;
    }
    u.vehicle = null; u.goVeh = null; u.hp = u.maxHp; u.nades = { frag: 2, plasma: 2 }; u.sh = u.maxSh; u.shT = 9; u.alive = true; u.vy = 0; u.yaw = u.team === 0 ? 0 : Math.PI; u.pitch = 0; u.spawnProt = 2;
    if (u.mesh) u.mesh.visible = true;
  }
  blocked(p) { for (const s of this.solids) if (p.x > s.min.x - RAD && p.x < s.max.x + RAD && p.z > s.min.z - RAD && p.z < s.max.z + RAD && s.max.y > p.y + 0.5 && s.min.y < p.y + 1.7) return true; return false; }

  // ---------- physics ----------
  groundAt(p) {
    let h = 0;
    for (const s of this.solids) if (!s.vehicle && p.x > s.min.x - 0.2 && p.x < s.max.x + 0.2 && p.z > s.min.z - 0.2 && p.z < s.max.z + 0.2 && s.max.y <= p.y + 0.55 && s.max.y > h) h = s.max.y;
    for (const r of this.ramps) {
      const lx = p.x - r.cx, lz = p.z - r.cz; if (Math.abs(lx) > GRID / 2 || Math.abs(lz) > GRID / 2) continue;
      const t = [(-lz), (lx), (lz), (-lx)][r.dir] / GRID + 0.5; const rh = r.y0 + THREE.MathUtils.clamp(t, 0, 1) * GRID;
      if (rh <= p.y + 0.9 && rh > h) h = rh;
    }
    return h;
  }
  moveUnit(u, dx, dz, dt, jump) {
    const p = u.pos; if (!u.K && this.layout.water && this.isWater(p.x, p.z)) { dx *= 0.45; dz *= 0.45; } // wading
    for (const [ax, az] of [[dx, 0], [0, dz]]) {
      p.x += ax; p.z += az;
      for (const s of this.solids) {
        if (s === u.solid || (u.vehicle && s === u.vehicle.solid)) continue;
        if (s.max.y <= p.y + 0.55 || s.min.y >= p.y + 1.75) continue;
        if (p.x > s.min.x - RAD && p.x < s.max.x + RAD && p.z > s.min.z - RAD && p.z < s.max.z + RAD) { p.x -= ax; p.z -= az; u.bumped = true; break; }
      }
    }
    const lim = this.map.size / 2 - RAD; p.x = THREE.MathUtils.clamp(p.x, -lim, lim); p.z = THREE.MathUtils.clamp(p.z, -lim, lim);
    const gh = this.groundAt(p);
    if (jump && u.onGround) { u.vy = 9.2; u.onGround = false; }
    u.vy -= GRAV * dt; p.y += u.vy * dt;
    // ceiling
    if (u.vy > 0) for (const s of this.solids) if (p.x > s.min.x && p.x < s.max.x && p.z > s.min.z && p.z < s.max.z && s.min.y > p.y + 1 && s.min.y < p.y + 1.85) { u.vy = 0; break; }
    if (p.y <= gh) { if (u.vy < 0 && (gh - p.y < 0.9)) { p.y = gh; u.vy = 0; u.onGround = true; } }
    else if (u.onGround && p.y - gh < 0.5 && u.vy <= 0) { p.y = gh; u.vy = 0; } else u.onGround = false;
  }

  // ---------- weapons ----------
  selectSlot(i) {
    this.slot = i; this.buildMode = null; const w = this.slots[i]; this.view.clear();
    const dark = this.m(0x23252a, 'metal'), add = (geo, x, y, z) => { const o = new THREE.Mesh(geo, dark); o.position.set(x, y, z); this.view.add(o); return o; };
    if (w.pick) { add(new THREE.BoxGeometry(0.05, 0.05, 0.6), 0, 0, -0.1).material = this.m(0x6b4a2a, 'wood'); add(new THREE.BoxGeometry(0.45, 0.06, 0.06), 0, 0, -0.42); }
    else { const L = { pistol: 0.25, smg: 0.45, rifle: 0.65, shotgun: 0.7, sniper: 0.9, lmg: 0.8 }[w.type] || 0.5;
      add(new THREE.BoxGeometry(0.07, 0.1, L), 0, 0, -L / 2); add(new THREE.BoxGeometry(0.06, 0.16, 0.08), 0, -0.1, -0.05);
      if (w.type !== 'pistol') add(new THREE.BoxGeometry(0.05, 0.12, 0.07), 0, -0.1, -L * 0.55);
      if (w.adsZoom > 1.2) add(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), 0, 0.08, -0.15).rotation.x = Math.PI / 2;
      this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a })); this.flash.position.set(0, 0, -L - 0.03); this.flash.visible = false; this.view.add(this.flash); }
    this.view.scale.setScalar(0.45); this.view.position.set(0.22, -0.2, -0.35); this.hooks.hud(this);
  }
  aimRay(spread) {
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    d.x += (Math.random() - 0.5) * spread * 2; d.y += (Math.random() - 0.5) * spread * 2; d.z += (Math.random() - 0.5) * spread * 2; d.normalize();
    this.ray.set(this.camera.position, d); this.ray.far = 400; return d;
  }
  firstHit(exclude) {
    for (const h of this.ray.intersectObjects(this.hitMeshes, false)) { const ud = h.object.userData; if (ud.unit && (ud.unit === exclude || !ud.unit.alive)) continue; if (ud.vehicle && (ud.vehicle === exclude.vehicle || !ud.vehicle.alive)) continue; return h; }
    return null;
  }
  playerFire(dt) {
    const w = this.slots[this.slot]; this.fireT -= dt;
    if (w.pick) { if (input.fire && this.fireT <= 0) { this.fireT = 0.45; this.swing = 0.25; this.aimRay(0); this.ray.far = 3;
        const h = this.firstHit(this.player); if (h) this.damageAt(h, 30, this.player, false, true); } return; }
    if (w.reloading > 0) { w.reloading -= dt; if (w.reloading <= 0) { if (w.reserve !== undefined) { const t = Math.min(w.mag - w.ammo, w.reserve); w.ammo += t; w.reserve -= t; } else w.ammo = w.mag; this.hooks.hud(this); } return; }
    if ((consume('KeyR', 'btn_reload') || w.ammo <= 0) && w.ammo < w.mag && !(w.reserve <= 0)) { w.reloading = w.reload; this.sfx('reload'); this.hooks.toast('Reloading'); return; }
    if (!input.fire || this.fireT > 0) return;
    if (!w.auto) { if (this.semiHeld) return; this.semiHeld = true; }
    this.fireT = 60 / w.rpm; w.ammo--; this.player.firedT = 1.5; this.sfx(Game.gunSound(w));
    const moving = Math.hypot(input.move.x, input.move.y) > 0.1, ads = this.adsT > 0.5;
    const spread = w.spread * (ads ? 0.3 : 1) * (moving ? 1.6 : 1) * (this.player.onGround ? 1 : 2);
    for (let i = 0; i < (w.pellets || 1); i++) {
      const d = this.aimRay(w.pellets ? w.spread : spread); const h = this.firstHit(this.player);
      const end = h ? h.point : this.camera.position.clone().addScaledVector(d, 120);
      if (h && h.distance <= w.range * 1.5) this.damageAt(h, w.dmg * (h.distance > w.range ? 0.6 : 1), this.player, h.object.userData.head);
      this.tracer(this.view.localToWorld(new THREE.Vector3(0, 0, -0.6)), end);
    }
    this.recoilP += w.recoil * (ads ? 0.6 : 1); this.player.yaw += (Math.random() - 0.5) * w.recoil * 0.4; this.kick = 1;
    if (this.flash) { this.flash.visible = true; setTimeout(() => this.flash && (this.flash.visible = false), 40); }
    this.hooks.hud(this);
  }
  damageAt(h, dmg, src, head, pick) {
    const ud = h.object.userData;
    const w = src?.isPlayer ? this.slots[this.slot] : null;
    if (ud.kind === 'unit') { const ch = this.cls === 'sparkwright' ? 0.06 * lv(this.save, 'charged') : 0, el = w?.elem || (ch && !w?.pick ? 'shock' : null);
    if (w && el && ud.unit.team !== src.team && Math.random() < (w.elem ? w.elemChance : 0) + ch) { ud.unit.dot = { elem: el, dps: w.elemDps || Math.round(w.dmg * 0.5), t: 4, acc: 0, src }; } const P = this.player, bonus = src === P ? (head ? 1 + 0.12 * lv(this.save, 'deadeye') * (this.cls === 'ghostwire') : 1) * (P.cloakShot ? 3 : 1) : 1; if (src === P) P.cloakShot = false; this.hurt(ud.unit, dmg * (head ? 2 : 1) * bonus, src, head); }
    else if (ud.kind === 'vehicle') this.hurtVehicle(ud.vehicle, dmg * (w?.elem === 'corrosive' ? 1.5 : 1), src);
    else if (ud.kind === 'build') { const b = ud.build; b.hp -= dmg * (pick ? 2 : 1); b.mesh.material.opacity = 1; if (b.hp <= 0) this.removeBuild(b); }
    else if (ud.kind === 'harvest' && src.isPlayer && pick) {
      const o = ud.obj; o.userData.hp = (o.userData.hp || 120) - 30; const amt = 6 + this.save.stats.build; this.mats[ud.res] += amt;
      this.hooks.toast(`+${amt} ${ud.res}`); o.scale.multiplyScalar(0.96);
      if (o.userData.hp <= 0) { this.scene.remove(o); this.hitMeshes = this.hitMeshes.filter(m => m.userData.obj !== o); this.solids = this.solids.filter(s => s.obj !== o); this.nav.dirty = true; }
      this.hooks.hud(this);
    }
  }
  hurt(u, dmg, src, head, elem) {
    if (!u.alive || u.spawnProt > 0 || (src && src.team === u.team && src !== u)) return;
    if (u.vehicle) { this.hurtVehicle(u.vehicle, dmg, src); return; }
    if (u.downed) return; if (u.zombie) { if (this.z?.insta > 0) dmg = 1e6; this.zHit(u, src); }
    if (elem === 'shock' && u.sh > 0) dmg *= 2; else if (elem === 'fire' && u.sh <= 0) dmg *= 1.5;
    if (u.dmgTaken) dmg *= u.dmgTaken();
    if (src?.isPlayer && u !== src) this.hooks.dmgNum(u.pos, dmg * (head && u.sh <= 0 ? 2 : 1), elem, head);
    // Recharging energy shield over health: absorbs damage first (no headshot bonus on shields), pops when depleted.
    // Halo-style: the shield soaks everything; the headshot bonus only applies once the shield is already down.
    u.shT = 0;
    if (u.sh > 0) { const a = Math.min(u.sh, dmg); u.sh -= a; dmg -= a; if (u.sh <= 0) this.shieldPop(u); } else if (head) dmg *= 2;
    u.hp -= dmg; dmg += 0; if (src.isPlayer) { this.stats.dmg += dmg; this.hooks.hitmark(head); }
    if (u.isPlayer) this.hooks.hurt();
    if (!u.isPlayer && src && !u.target) u.target = src;
    if (u.hp <= 0 && this.mode === 'zombies' && u.team === 0) { this.zDown(u); return; }
    if (u.hp <= 0) {
      if (!u.isPlayer) { if (u.team !== this.player.team && Math.random() < (this.mode === 'zombies' ? 0.04 : 0.3)) this.dropLoot(genGun(this.save.rank + 1), u.pos); else if (this.mode !== 'zombies') this.dropWeapon(u.gun.id || 'kr4', u.pos, 0.6); }
      u.alive = false; u.deaths++; u.respawn = 3; src.kills++; this.score[src.team]++;
      if (u.mesh) u.mesh.visible = false; if (u.zombie) this.zKill(u, src, head);
      if (src.isPlayer && u.zombie) { this.stats.kills++; if (head) this.stats.head++; }
      else if (src.isPlayer) { this.stats.kills++; if (head) this.stats.head++; this.hooks.toast(head ? 'HEADSHOT +150 XP' : 'Eliminated +100 XP'); }
      if (u.isPlayer) { this.stats.deaths++; this.hooks.toast(`Eliminated by ${src.name}`); }
      this.hooks.feed(src, u, head);
      if (this.score[src.team] >= this.map.scoreLimit) this.end();
    }
  }
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.8 }));
    this.scene.add(l); this.tracers.push({ l, t: 0.06 });
  }

  // ---------- building ----------
  makeGhost() {
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.visible = false; this.scene.add(this.ghost);
  }
  pieceGeo(type, dir) {
    if (type === 'wall') return dir % 2 ? [0.2, GRID, GRID] : [GRID, GRID, 0.2];
    if (type === 'floor') return [GRID, 0.2, GRID];
    return [GRID, 0.2, GRID * 1.414];
  }
  ghostPlacement() {
    const p = this.player.pos, f = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    const dir = ((Math.round(-this.player.yaw / (Math.PI / 2)) % 4) + 4) % 4; // 0=-z,1=+x,2=+z,3=-x
    const level = Math.max(0, Math.round((p.y + (this.player.pitch < -0.6 ? -GRID : this.player.pitch > 0.5 ? GRID : 0) * 0.5) / GRID) * GRID);
    let cx = Math.round(p.x / GRID) * GRID, cz = Math.round(p.z / GRID) * GRID;
    const type = this.buildMode;
    if (type !== 'floor' || this.player.pitch > -0.5) { cx = Math.round((p.x + f.x * GRID * 0.9) / GRID) * GRID; cz = Math.round((p.z + f.z * GRID * 0.9) / GRID) * GRID; }
    let x = cx, z = cz, y = level;
    if (type === 'wall') { const off = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir]; x = Math.round(p.x / GRID) * GRID + off[0] * GRID / 2; z = Math.round(p.z / GRID) * GRID + off[1] * GRID / 2; }
    if (type === 'floor' && this.player.pitch < -0.5) y = level; else if (type === 'floor') y = level;
    return { type, x, y, z, dir };
  }
  updateGhost() {
    if (!this.buildMode) { this.ghost.visible = false; return; }
    const g = this.ghostPlacement(), [w, h, d] = this.pieceGeo(g.type, g.dir); this.ghost.visible = true; this.ghost.scale.set(w, h, d); this.ghost.rotation.set(0, 0, 0);
    if (g.type === 'wall') this.ghost.position.set(g.x, g.y + GRID / 2, g.z);
    else if (g.type === 'floor') this.ghost.position.set(g.x, g.y + 0.1, g.z);
    else { this.ghost.position.set(g.x, g.y + GRID / 2, g.z); this.ghost.rotation.set(0, -g.dir * Math.PI / 2, 0, 'YXZ'); this.ghost.rotateX(Math.PI / 4); }
    const ok = this.mats.wood >= BUILD[g.type].cost && !this.builds.some(b => b.key === this.key(g));
    this.ghost.material.color.set(ok ? 0x5ad1ff : 0xff5a5a); this.ghostOk = ok; this.ghostP = g;
  }
  key(g) { return `${g.type}:${g.x}:${g.y}:${g.z}:${g.type === 'wall' ? 0 : g.type === 'ramp' ? g.dir : 0}`; }
  place() {
    if (!this.ghostOk || this.placeCd > 0) return; const g = this.ghostP; this.placeCd = 0.12;
    this.mats.wood -= BUILD[g.type].cost; this.stats.builds++;
    const [w, h, d] = this.pieceGeo(g.type, g.dir), mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.m(0xa77b4a, 'wood'));
    mesh.position.copy(this.ghost.position); mesh.quaternion.copy(this.ghost.quaternion); mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
    const b = { id: ++this.nextId, key: this.key(g), g, mesh, hp: BUILD[g.type].hp * (1 + this.save.stats.build * 0.1) };
    mesh.userData = { kind: 'build', build: b }; this.hitMeshes.push(mesh);
    if (g.type === 'ramp') { b.ramp = { cx: g.x, cz: g.z, y0: g.y, dir: g.dir }; this.ramps.push(b.ramp); }
    else { b.solid = { min: new THREE.Vector3(g.x - w / 2, g.type === 'floor' ? g.y : g.y, g.z - d / 2), max: new THREE.Vector3(g.x + w / 2, g.y + h + (g.type === 'floor' ? 0 : 0), g.z + d / 2) }; this.solids.push(b.solid); }
    this.builds.push(b); this.nav.dirty = true; this.hooks.hud(this);
  }
  removeBuild(b) {
    this.scene.remove(b.mesh); this.hitMeshes = this.hitMeshes.filter(m => m !== b.mesh); this.builds = this.builds.filter(x => x !== b);
    if (b.solid) this.solids = this.solids.filter(s => s !== b.solid); this.nav.dirty = true; if (b.ramp) this.ramps = this.ramps.filter(r => r !== b.ramp);
  }
  editTarget() { // Edit: rotate ramps, open walls into doorways, or remove floors (refunds half)
    this.aimRay(0); this.ray.far = 7; const h = this.firstHit(this.player); if (!h || h.object.userData.kind !== 'build') return;
    const b = h.object.userData.build;
    if (b.g.type === 'ramp') { const g = Object.assign({}, b.g, { dir: (b.g.dir + 1) % 4 }); this.removeBuild(b); this.mats.wood += BUILD.ramp.cost; const save = this.buildMode; this.buildMode = 'ramp';
      this.ghost.position.set(g.x, g.y + GRID / 2, g.z); this.ghost.rotation.set(0, -g.dir * Math.PI / 2, 0, 'YXZ'); this.ghost.rotateX(Math.PI / 4); this.ghostP = g; this.ghostOk = true; this.placeCd = 0; this.place(); this.buildMode = save; this.hooks.toast('Ramp rotated'); }
    else if (b.g.type === 'wall' && !b.door) { b.door = true; b.solid.max.y = b.solid.min.y + 0.01; b.mesh.scale.y = 0.25; b.mesh.position.y = b.g.y + GRID - GRID * 0.125; b.solid.min.y = b.g.y + GRID * 0.75; b.solid.max.y = b.g.y + GRID; this.hooks.toast('Doorway cut'); }
    else { this.removeBuild(b); this.mats.wood += 5; this.hooks.toast('Piece removed (+5 wood)'); }
    this.hooks.hud(this);
  }

  // ---------- bots ----------
  canSee(a, b) {
    const from = a.pos.clone(); from.y += EYE; const to = b.pos.clone(); to.y += EYE - 0.2; const d = to.clone().sub(from); const dist = d.length();
    if (dist > 90) return false; this.ray.set(from, d.normalize()); this.ray.far = dist;
    for (const h of this.ray.intersectObjects(this.hitMeshes, false)) { const vh = h.object.userData.vehicle; if (vh && (vh === b.vehicle || vh === a.vehicle || !vh.alive)) continue; const u = h.object.userData.unit; if (u === a || u === b || (u && !u.alive)) continue; if (u) continue; return h; }
    return true;
  }
  // ---- bot navigation helpers ----
  pathTo(u, goal, mode) { // throttled A* requests; returns next waypoint (or goal)
    u.repathT = (u.repathT || 0) - this.lastDt;
    const far = !u.pathGoal || u.pathGoal.distanceTo(goal) > 4;
    if ((far || u.repathT <= 0 || u.bumped) && this.navBudget > 0) { this.navBudget--; u.path = this.nav.find(u.pos, goal, mode) || []; u.pathI = 0; u.pathGoal = goal.clone(); u.repathT = 2.5 + Math.random(); u.bumped = false; }
    const r = u.K ? 4 : 1.2; while (u.path && u.pathI < u.path.length && Math.hypot(u.path[u.pathI].x - u.pos.x, u.path[u.pathI].z - u.pos.z) < r) u.pathI++;
    return u.path && u.pathI < u.path.length ? u.path[u.pathI] : goal;
  }
  losBlocked(from, to) { const d = to.clone().sub(from), L = d.length(); this.ray.set(from, d.normalize()); this.ray.far = L; for (const h of this.ray.intersectObjects(this.hitMeshes, false)) { const k = h.object.userData.kind; if (k === 'unit' || k === 'vehicle' || k === 'ground') continue; return true; } return false; }
  findCover(u, threat) {
    const te = threat.pos.clone(); te.y += EYE; let best = null, bd = 1e9;
    for (let a = 0; a < 12; a++) for (const r of [4, 7, 10]) { const ang = a / 12 * Math.PI * 2, p = new THREE.Vector3(u.pos.x + Math.cos(ang) * r, 1.2, u.pos.z + Math.sin(ang) * r);
      const k = this.nav.idx(p.x, p.z); if (!this.nav.ok(k, 'land')) continue; const d = p.distanceTo(u.pos); if (d >= bd) continue; if (this.losBlocked(te, p)) { bd = d; best = p.setY(0); } }
    return best;
  }
  botThink(u, dt) {
    if (u.vehicle) return this.botDrive(u, dt);
    if (u.reviveFor) { const d = u.reviveFor; if (!d.downed || !d.alive) u.reviveFor = null; else { const wp = this.pathTo(u, d.pos, 'foot'), v = wp.clone().sub(u.pos); v.y = 0; const l = v.length();
      if (l > 1.2) { v.normalize(); u.yaw = Math.atan2(-v.x, -v.z); this.moveUnit(u, v.x * 5 * dt, v.z * 5 * dt, dt, false); } u.mesh.position.copy(u.pos); u.mesh.rotation.y = u.yaw; return; } }
    if (u.goVeh) { const v = u.goVeh; if (!v.alive || !v.seats.some(s => !s.unit)) u.goVeh = null; else if (v.pos.distanceTo(u.pos) < v.K.r + 2.5) { if (this.enterVehicle(u, v)) return; } }
    u.think -= dt; const g = u.gun;
    if (u.think <= 0) {
      u.think = 0.3 + Math.random() * 0.3; let best = null, bd = 1e9;
      for (const e of this.units) if (e.alive && e.team !== u.team && !(e.cloakT > 0)) { const d = e.pos.distanceTo(u.pos); if (d < bd && d < 80 && this.canSee(u, e) === true) { bd = d; best = e; } }
      u.target = best; u.seeT = best ? (u.seeT || 0) : 0;
      if (!best && !u.goVeh && Math.random() < 0.15) { for (const v of this.vehicles) if (v.alive && v.team === u.team && v.pos.distanceTo(u.pos) < 35 && v.seats.some(s => !s.unit) && !this.units.some(o => o.goVeh === v)) { u.goVeh = v; break; } }
      if (u.goVeh && !best) u.wp.copy(u.goVeh.pos);
      if (this.z && !best && (u.pos.distanceTo(this.player.pos) > 7 || Math.random() < 0.1)) { u.wp.set(this.player.pos.x + (Math.random() - 0.5) * 8, 0, this.player.pos.z + (Math.random() - 0.5) * 8); u.bumped = false; }
      if (!this.z && !best && (u.pos.distanceTo(u.wp) < 3 || Math.random() < 0.05 || u.bumped)) {
        const caps = this.capPoints.filter(c => c.owner !== u.team); const enemies = this.units.filter(e => e.alive && e.team !== u.team);
        const e = caps.length && Math.random() < 0.75 ? { pos: new THREE.Vector3(caps[Math.floor(Math.random() * caps.length)].x, 0, caps[Math.floor(Math.random() * caps.length)].z) } : enemies[Math.floor(Math.random() * enemies.length)];
        const h = this.map.size / 2 - 4; const sc = this.capPoints.length ? 10 : 30; u.wp.set(THREE.MathUtils.clamp((e ? e.pos.x : 0) + (Math.random() - 0.5) * sc, -h, h), 0, THREE.MathUtils.clamp((e ? e.pos.z : 0) + (Math.random() - 0.5) * sc, -h, h));
        u.bumped = false;
      }
      if (Math.random() < 0.3) u.strafe *= -1;
    }
    let mx = 0, mz = 0, jump = false; const speed = (u.speed || 4.2) * (u.dot?.elem === 'cryo' ? 0.5 : 1);
    if (u.target && u.target.alive) {
      const t = u.target, d = t.pos.clone().sub(u.pos); u.yaw = Math.atan2(-d.x, -d.z); u.seeT += dt;
      const dist = d.length(), side = new THREE.Vector3(Math.cos(u.yaw), 0, -Math.sin(u.yaw));
      mx = side.x * u.strafe * 0.6; mz = side.z * u.strafe * 0.6;
      if (dist > g.range * 0.7) { mx += -Math.sin(u.yaw); mz += -Math.cos(u.yaw); }
      if (dist < 2.2) this.melee(u);
      u.nadeCd = (u.nadeCd || 6 + Math.random() * 6) - dt;
      if (u.nadeCd <= 0 && dist > 8 && dist < 24 && u.seeT > 1) { u.nadeCd = 10 + Math.random() * 8; const type = Math.random() < 0.5 ? 'frag' : 'plasma'; const dir = t.pos.clone().sub(u.pos); const flat = Math.hypot(dir.x, dir.z); dir.y = flat * 0.18; dir.normalize();
        const n = this.throwNade(u, type, dir); if (n) { const last = this.nadesLive[this.nadesLive.length - 1]; last.vel.multiplyScalar(Math.min(1, flat / 20) * 0.95 + 0.05); } }
      g.cd -= dt;
      if (g.reloading > 0) { g.reloading -= dt; if (g.reloading <= 0) g.ammo = g.mag; }
      else if (g.ammo <= 0) g.reloading = g.reload * 1.2;
      else if (g.cd <= 0 && u.seeT > 0.45) {
        g.cd = 60 / g.rpm * (g.auto ? 1.6 : 1.2); g.ammo--; u.firedT = 1.5; this.sfx(Game.gunSound(g), u.pos);
        const vis = this.canSee(u, t); const from = u.pos.clone(); from.y += 1.3;
        if (vis === false) {}
        else if (vis !== true) { if (['build', 'vehicle'].includes(vis.object?.userData.kind)) this.damageAt(vis, g.dmg, u); this.tracer(from, vis.point); }
        else { const chance = u.skill * (1 - Math.min(dist / (g.range * 1.6), 0.8)) * (t.isPlayer ? 0.55 : 0.6);
          const hits = g.pellets ? Math.round(g.pellets * chance) : (Math.random() < chance ? 1 : 0);
          const to = t.pos.clone(); to.y += 1.3; to.x += (Math.random() - 0.5) * (hits ? 0.3 : 2); to.z += (Math.random() - 0.5) * (hits ? 0.3 : 2);
          this.tracer(from, to); if (hits) this.hurt(t, g.dmg * hits * (t.isPlayer ? 0.8 : 1), u, Math.random() < 0.1); }
      }
      // cover when shield breaks; flankers swing wide instead of strafing
      if (!u.cover && u.sh <= 0 && Math.random() < 0.5) { u.cover = this.findCover(u, t); u.coverT = 6; }
      let goal = null;
      if (u.cover) { goal = u.cover; u.coverT -= dt; if (u.sh >= u.maxSh * 0.8 || u.coverT <= 0) u.cover = null; }
      else if (u.flanker && dist > 16) { const sgn = u.id % 2 ? 1 : -1; goal = t.pos.clone().add(new THREE.Vector3(Math.cos(u.yaw) * 14 * sgn, 0, -Math.sin(u.yaw) * 14 * sgn)); }
      if (goal) { const wp = this.pathTo(u, goal, 'foot'), d2 = wp.clone().sub(u.pos); d2.y = 0; if (d2.length() > 0.4) { d2.normalize(); mx = d2.x; mz = d2.z; } }
    } else {
      const wp = this.pathTo(u, u.wp, 'foot'); const d = wp.clone().sub(u.pos); d.y = 0; if (d.length() > 0.5) { d.normalize(); mx = d.x; mz = d.z; u.yaw = Math.atan2(-d.x, -d.z); }
    }
    if (u.bumped && Math.random() < 0.05) jump = true;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    this.moveUnit(u, mx * speed * dt, mz * speed * dt, dt, jump);
    u.mesh.position.copy(u.pos); u.mesh.rotation.y = u.yaw;
  }

  // ---------- frame ----------
  // Fixed-rate simulation: the render frame collects local input, then the sim advances in
  // TICK steps. Every entity has a stable id, so a server can run tick() authoritatively later.
  frame(t) {
    const fdt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    if (!this.running || !this.scene) { endFrame(); return; }
    if (this.paused) { this.renderer.render(this.scene, this.camera); endFrame(); return; }
    this.navBudget = 0; pollKeys(); this.acc = (this.acc || 0) + fdt; let n = 0;
    while (this.acc >= TICK && n < 6) { this.acc -= TICK; this.tickNo = (this.tickNo || 0) + 1; this.tick(TICK, n === 0); n++; if (!this.running) break; }
    this.renderer.render(this.scene, this.camera); if (n) endFrame();
  }
  tick(dt, first) {
    this.lastDt = dt; this.navBudget += 3;
    { const p = this.player; if (p?.alive && !p.vehicle && p.onGround) { const m = Math.hypot(p.pos.x - (this.stepX ?? p.pos.x), p.pos.z - (this.stepZ ?? p.pos.z)); this.stepD = (this.stepD || 0) + m; if (this.stepD > 2.4) { this.stepD = 0; this.sfx('step'); } } if (p) { this.stepX = p.pos.x; this.stepZ = p.pos.z; }
      const v = p?.vehicle; if (first) this.engine(v && this.seatOf(p).role === 'driver' ? v.kind : null, v ? Math.min(1, Math.hypot(v.vx || 0, v.vz || 0) / 25) : 0); }
    if (!first) { input.look.x = input.look.y = 0; } const P = this.player, w = this.slots[this.slot];
    this.timeLeft -= dt; if (this.timeLeft <= 0 && !this.over) this.end();
    // input actions
    if (consume('Digit1')) this.selectSlot(0); if (consume('Digit2')) this.selectSlot(1); if (consume('Digit3')) this.selectSlot(2);
    if (consume('btn_weapon', 'WheelDown')) this.selectSlot((this.slot + 1) % 3); if (consume('WheelUp')) this.selectSlot((this.slot + 2) % 3);
    const bm = consume('KeyZ') ? 'wall' : consume('KeyX') ? 'floor' : consume('KeyC') ? 'ramp' : null;
    if (bm) { this.buildMode = this.buildMode === bm ? null : bm; this.hooks.hud(this); }
    if (consume('btn_build')) { this.buildMode = { null: 'wall', wall: 'floor', floor: 'ramp', ramp: null }[this.buildMode]; this.hooks.hud(this); }
    if (consume('KeyE', 'btn_edit')) this.editTarget();
    if (consume('KeyQ')) { this.buildMode = this.buildMode ? null : 'wall'; this.hooks.hud(this); }
    if (consume('Escape', 'btn_menu')) { this.hooks.pause(); }
    this.hooks.board(input.pressed.has('Tab'));
    if (!input.fire) this.semiHeld = false;
    // look
    const sens = 0.0022 * (this.save.sens || 1) / (1 + (this.adsT || 0) * (w.adsZoom - 1 || 0));
    P.yaw -= input.look.x * sens; P.pitch = THREE.MathUtils.clamp(P.pitch - input.look.y * sens - this.recoilP, -1.5, 1.5);
    this.recoilP *= 0.6; P.pitch += 0; 
    if (consume('KeyM', 'btn_map')) { this.overview = !this.overview; this.hooks.maps(this, this.overview); }
    this.updatePickups(dt); this.updateNades(dt); for (const u of this.units) u.meleeCd = (u.meleeCd || 0) - dt;
    if (consume('KeyF', 'btn_enter')) { if (this.interact?.()) {} else if (!P.vehicle && !this.near && this.nearChest) this.openChest(this.nearChest); else if (!P.vehicle && !this.near && !this.nearPick && this.lastLoot && this.lastLoot.t > 0) this.equipLoot(this.lastLoot.uid); else if (P.vehicle || this.near || !this.nearPick) this.toggleVehicle(); else this.swapWeapon(); }
    if (P.alive && P.vehicle) { this.buildMode = null; this.pilot(P.vehicle, dt); }
    else if (P.alive) {
      P.spawnProt = Math.max(0, (P.spawnProt || 0) - dt);
      const sp = 5.5 * (P.speedMul || 1) * (P.zSpeed || 1) * (P.downed ? 0.25 : 1) * (1 + this.save.stats.speed * 0.03) * (input.sprint && input.move.y > 0 && !input.ads ? 1.45 : 1) * (input.ads ? 0.6 : 1);
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      let mx = fx * input.move.y + rx * input.move.x, mz = fz * input.move.y + rz * input.move.x; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
      this.moveUnit(P, mx * sp * dt, mz * sp * dt, dt, input.jump);
      if (consume('KeyV', 'btn_melee')) this.melee(P);
      if (consume('KeyH', 'btn_skill')) this.useSkill();
      if (consume('KeyT', 'btn_ntype')) { this.nadeType = this.nadeType === 'frag' ? 'plasma' : 'frag'; this.hooks.hud(this); }
      if (consume('KeyG', 'btn_nade')) { const d = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion); d.y += 0.15; d.normalize(); if (!this.throwNade(P, this.nadeType, d)) this.hooks.toast(`No ${this.nadeType} grenades`); }
      if (this.buildMode) { this.placeCd = (this.placeCd || 0) - dt; this.updateGhost(); if (input.fire) this.place(); if (consume('KeyR', 'btn_reload')) this.buildRot++; }
      else { this.ghost.visible = false; this.playerFire(dt); }
    } else { this.ghost.visible = false; }
    // ADS
    const wantAds = input.ads && !w.pick && !this.buildMode && P.alive; this.adsT = THREE.MathUtils.clamp((this.adsT || 0) + (wantAds ? dt : -dt) * 6, 0, 1);
    const zoom = 1 + this.adsT * ((w.adsZoom || 1) - 1); this.camera.fov = 75 / zoom; this.camera.updateProjectionMatrix();
    this.hooks.scope(w.adsZoom >= 2 && this.adsT > 0.9);
    this.kick = (this.kick || 0) * 0.8; this.swing = Math.max(0, (this.swing || 0) - dt);
    this.view.position.set(THREE.MathUtils.lerp(0.16, 0, this.adsT), THREE.MathUtils.lerp(-0.15, -0.085, this.adsT), -0.3 + this.kick * 0.05);
    this.view.rotation.x = this.swing * 3; this.view.visible = !this.buildMode && !(w.adsZoom >= 2 && this.adsT > 0.9) && P.alive;
    this.camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    if (P.vehicle) { const K = P.vehicle.K, f = new THREE.Vector3(0, 0, 1).applyEuler(this.camera.rotation);
      const r = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
      this.camera.position.set(P.pos.x, P.pos.y + K.camH, P.pos.z).addScaledVector(f, K.camDist).addScaledVector(r, 1.8); this.view.visible = false; this.hooks.scope(false); }
    else this.camera.position.set(P.pos.x, P.pos.y + EYE, P.pos.z);
    this.near = null; if (!P.vehicle && P.alive) for (const v of this.vehicles) if (v.alive && v.team === P.team && v.pos.distanceTo(P.pos) < 5 && v.seats.some(s => !s.unit)) { this.near = v; break; }
    for (const v of this.vehicles) if (!v.alive) { v.respawn -= dt; if (v.respawn <= 0) this.respawnVehicle(v); }
    // view-distance LOD: skip drawing far bots
    const lod = this.tier === 'low' ? 85 : 160; for (const u of this.units) if (u.mesh && u.alive) u.mesh.visible = !u.vehicle && u.pos.distanceTo(P.pos) < lod;
    for (const v of this.vehicles) if (v.alive) v.mesh.visible = v.pos.distanceTo(P.pos) < lod * 2.2;
    this.updateCaps(dt); if (this.z && !this.over) this.zUpdate(dt);
    this.updateSkill(dt); this.updateDots(dt); this.regenShields(dt); this.updateLoot(dt);
    // bots & respawns
    for (const u of this.units) {
      if (!u.alive) { if (u.zombie || (this.mode === 'zombies' && u.team === 0)) continue; u.respawn -= dt; if (u.respawn <= 0 && !this.over) {
        if (u.isPlayer && this.capPoints.length) { if (!this.choosing) { this.choosing = true; document.exitPointerLock?.(); this.hooks.spawnSelect(this.spawnOptions(u.team)); } else this.hooks.spawnRefresh?.(this.spawnOptions(u.team)); }
        else this.spawn(u); } continue; }
      if (!u.isPlayer) { u.spawnProt = Math.max(0, u.spawnProt - dt); if (u.zombie) this.zombieThink(u, dt); else if (!u.downed) this.botThink(u, dt); }
    }
    for (const tr of this.tracers) { tr.t -= dt; if (tr.t <= 0) { this.scene.remove(tr.l); tr.l.geometry.dispose(); } } this.tracers = this.tracers.filter(t => t.t > 0);
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.hudT = 0.2; this.hooks.hud(this); }
    this.trkT = (this.trkT || 0) - dt; if (this.trkT <= 0) { this.trkT = 0.1; // motion tracker: allies always, enemies only when moving or firing
      for (const u of this.units) { u.firedT = (u.firedT || 0) - 0.1; u.spd = u.prev ? Math.hypot(u.pos.x - u.prev.x, u.pos.z - u.prev.z) / 0.1 : 0; u.prev = { x: u.pos.x, z: u.pos.z }; }
      this.hooks.tracker(this); { this.mapT = (this.mapT || 0) + 1; if (this.overview || this.mapT % 2 === 0) this.hooks.maps(this, this.overview); } }
    if (first) input.pressed.clear();
  }
  // Weapon pickups: two-gun carry limit; F swaps the gun in hand for one on the ground.
  dropWeapon(id, pos, ammoFrac = 1, rack) {
    const L = { pistol: 0.3, smg: 0.5, rifle: 0.7, shotgun: 0.75, sniper: 1.0, lmg: 0.9 }[this.gunDef(id).type] || 0.6;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, L), this.m(rack ? 0xe0b040 : 0x2a2c30, 'metal')); mesh.position.set(pos.x, (pos.y || 0) + 0.5, pos.z);
    this.scene.add(mesh); const p = { id, mesh, ammo: Math.max(1, Math.round(this.gunDef(id).mag * ammoFrac)), life: rack ? 1e9 : 25, rack };
    this.pickups.push(p); while (this.pickups.length > 24) this.removePickup(this.pickups.find(q => !q.rack) || this.pickups[0]); return p;
  }
  removePickup(p) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); this.pickups = this.pickups.filter(q => q !== p); if (p.rack) p.rack.t = 30; }
  updatePickups(dt) {
    for (const r of this.racks) if (!r.p && (r.t -= dt) <= 0) { r.p = this.dropWeapon(r.id, { x: r.x, z: r.z }, 1, r); }
    const P = this.player; this.nearPick = null;
    for (const p of this.pickups.slice()) { p.mesh.rotation.y += dt * 2; if ((p.life -= dt) <= 0) { this.removePickup(p); continue; }
      if (!P.alive || P.vehicle) continue; const d = Math.hypot(p.mesh.position.x - P.pos.x, p.mesh.position.z - P.pos.z);
      if (d < 1.6) { const held = this.slots.find(w => w.id === p.id); // same gun: take its ammo (refill)
        if (held && held.ammo < held.mag) { held.ammo = held.mag; this.hooks.toast(`Ammo: ${held.name}`); if (p.rack) p.rack.p = null; this.removePickup(p); continue; }
        if (!held && (!this.nearPick || d < this.nearPick.d)) this.nearPick = Object.assign(p, { d }); }
    }
  }
  swapWeapon() {
    const p = this.nearPick; if (!p) return; const i = this.slot === 2 ? 0 : this.slot, old = this.slots[i];
    this.dropWeapon(old.id, this.player.pos, old.ammo / old.mag); const w = this.makeWeapon(p.id); w.ammo = p.ammo; this.slots[i] = w;
    if (p.rack) p.rack.p = null; this.removePickup(p); this.selectSlot(i); this.hooks.toast(`Picked up ${w.name}`);
  }
  // Grenades: frag bounces on a fuse; plasma sticks to whatever it touches first.
  throwNade(u, type, dir) {
    if (u.isPlayer) this.sfx("nade");
    if (!u.nades[type]) return false; u.nades[type]--;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(type === 'plasma' ? 0.16 : 0.13, 8, 6), type === 'plasma' ? new THREE.MeshBasicMaterial({ color: 0x6fd0ff }) : this.m(0x3a4a2a));
    const pos = u.pos.clone(); pos.y += EYE; pos.addScaledVector(dir, 0.6); mesh.position.copy(pos); this.scene.add(mesh);
    this.nadesLive.push({ u, type, mesh, pos, vel: dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0)), fuse: type === 'plasma' ? 1.8 : 2.4, stuck: null, stuckOff: null, landed: false });
    if (u.isPlayer) this.hooks.hud(this); return true;
  }
  updateNades(dt) {
    for (const n of this.nadesLive.slice()) {
      if (n.stuck) { if (n.stuck.alive) n.pos.copy(n.stuck.pos).add(n.stuckOff); }
      else if (n.stuckSurf) {}
      else {
        n.vel.y -= GRAV * dt; const next = n.pos.clone().addScaledVector(n.vel, dt);
        if (n.type === 'plasma') { for (const t of this.units) if (t.alive && t !== n.u && t.pos.distanceTo(next.clone().setY(next.y - 1)) < 1.0) { n.stuck = t; n.stuckOff = new THREE.Vector3(0, 1.2, 0); if (t.isPlayer) this.hooks.toast('YOU ARE STUCK!'); else if (n.u.isPlayer) this.hooks.toast('Stuck!'); break; } }
        if (!n.stuck) {
          const hitSolid = this.solids.find(s2 => next.x > s2.min.x && next.x < s2.max.x && next.z > s2.min.z && next.z < s2.max.z && next.y > s2.min.y && next.y < s2.max.y);
          if (hitSolid) { if (n.type === 'plasma') n.stuckSurf = true; else { const inX = n.pos.x <= hitSolid.min.x || n.pos.x >= hitSolid.max.x; if (inX) n.vel.x *= -0.4; else n.vel.z *= -0.4; if (n.pos.y >= hitSolid.max.y) { n.vel.y *= -0.35; n.vel.x *= 0.7; n.vel.z *= 0.7; } } }
          else if (next.y < 0.13) { if (n.type === 'plasma') { n.stuckSurf = true; n.pos.y = 0.13; } else { n.pos.y = 0.13; n.vel.y *= -0.35; n.vel.x *= 0.7; n.vel.z *= 0.7; } }
          else n.pos.copy(next);
        }
      }
      n.mesh.position.copy(n.pos); if (n.type === 'plasma') n.mesh.scale.setScalar(1 + Math.sin(n.fuse * 30) * 0.2);
      if ((n.fuse -= dt) <= 0) { this.scene.remove(n.mesh); this.nadesLive = this.nadesLive.filter(q => q !== n); this.explode(n.pos.clone(), n.type === 'plasma' ? 140 : 115, n.type === 'plasma' ? 4.5 : 6, n.u); }
    }
  }
  // Melee: quick strike, triple damage from behind.
  melee(u) {
    this.sfx("melee", u.isPlayer ? null : u.pos);
    if ((u.meleeCd || 0) > 0) return; u.meleeCd = 0.8; let best = null, bd = 2.6;
    const f = new THREE.Vector3(-Math.sin(u.yaw), 0, -Math.cos(u.yaw));
    for (const t of this.units) if (t.alive && t.team !== u.team) { const d = t.pos.clone().sub(u.pos); const dist = d.length(); d.y = 0; d.normalize(); if (dist < bd && d.dot(f) > 0.5) { bd = dist; best = t; } }
    if (u.isPlayer) { this.swing = 0.25; this.kick = 2; }
    if (!best) return; const tf = new THREE.Vector3(-Math.sin(best.yaw), 0, -Math.cos(best.yaw)); const behind = tf.dot(f) > 0.5;
    if (u.isPlayer && bd > 1.2) { const d = best.pos.clone().sub(u.pos).setY(0).normalize(); this.moveUnit(u, d.x * (bd - 1), d.z * (bd - 1), 0, false); }
    this.hurt(best, behind ? 300 : 70, u, false); if (u.isPlayer) this.hooks.toast(behind ? 'ASSASSINATION' : 'Melee');
  }
  // ---------- vehicles (shared by player and bots) ----------
  seatOf(u) { return u.vehicle ? u.vehicle.seats.find(s => s.unit === u) : null; }
  enterVehicle(u, v) {
    const seat = v.seats.find(s => !s.unit); if (!seat || !v.alive) return false; seat.unit = u; u.vehicle = v; u.pos.copy(v.pos); if (u.mesh) u.mesh.visible = false; u.goVeh = null;
    if (u.isPlayer) { u.yaw = v.yaw; this.buildMode = null; const w = seat.role === 'gunner' || v.K.mode !== 'car' ? v.K.weapons : [];
      this.hooks.toast(`${v.K.name} (${seat.role})${w.length ? ': ' + w.map((x, i) => ['Fire', 'Aim', 'G'][i] + ' = ' + x.name).join(' · ') : ''}`); this.hooks.hud(this); }
    return true;
  }
  exitVehicle(u) {
    const v = u.vehicle; if (!v) return; v.seats.forEach(s => { if (s.unit === u) s.unit = null; }); u.vehicle = null;
    u.pos.set(v.pos.x + Math.cos(v.yaw) * (v.K.r + 1.2), Math.max(0, v.pos.y - 1), v.pos.z - Math.sin(v.yaw) * (v.K.r + 1.2)); if (this.blocked(u.pos)) u.pos.set(v.pos.x, v.solid.max.y, v.pos.z);
    u.vy = 0; if (u.mesh) u.mesh.visible = true;
    if (u.isPlayer) { this.selectSlot(this.slot); this.hooks.toast('Exited vehicle'); this.hooks.hud(this); }
  }
  toggleVehicle() { const P = this.player; if (P.vehicle) return this.exitVehicle(P); if (this.near) this.enterVehicle(P, this.near); }
  isWater(x, z) { const w = this.layout.water; return !!w && w.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]); }
  // ctrl: { mx, my (-1..1), aimYaw, aimPitch, up, down, fire, alt, special }
  drive(v, c, dt) {
    const K = v.K, mode = K.mode; let mx = 0, mz = 0;
    v.cd = v.cd.map(t => t - dt); K.weapons.forEach((w, i) => { if (w.regen && v.ammo[i] < w.ammoMax) v.ammo[i] = Math.min(w.ammoMax, v.ammo[i] + dt / w.regen); });
    const fwd = y => [-Math.sin(y), -Math.cos(y)];
    if (mode === 'walker') { v.yaw = c.aimYaw; const [fx, fz] = fwd(v.yaw); mx = (fx * c.my + Math.cos(v.yaw) * c.mx) * K.speed * dt; mz = (fz * c.my - Math.sin(v.yaw) * c.mx) * K.speed * dt; }
    else if (mode === 'tracked' || mode === 'car' || mode === 'boat') {
      const target = c.my * K.speed; v.speed += THREE.MathUtils.clamp(target - v.speed, -K.speed * 1.5 * dt, K.speed * (mode === 'tracked' ? 1 : 0.8) * dt);
      v.yaw -= c.mx * K.turn * dt * (mode === 'tracked' ? 1 : THREE.MathUtils.clamp(Math.abs(v.speed) / 5, 0, 1) * Math.sign(v.speed || 1));
      const [fx, fz] = fwd(v.yaw); mx = fx * v.speed * dt; mz = fz * v.speed * dt;
      const nx = v.pos.x + mx * 3, nz = v.pos.z + mz * 3, wet = this.isWater(nx, nz);
      if (mode === 'boat' ? !wet : wet) { mx = mz = 0; v.speed *= -0.3; }
    }
    if (mode === 'heli' || mode === 'jet') this.fly(v, c, dt);
    else { const before = v.pos.clone(); this.moveUnit(v, mx, mz, dt, false); if (v.pos.distanceTo(before) < Math.hypot(mx, mz) * 0.5 && mode !== 'walker') v.speed *= 0.5; }
    syncSolid(v); for (const s of v.seats) if (s.unit) s.unit.pos.copy(v.pos);
    // animate
    const P = v.mesh.userData.parts; v.mesh.position.copy(v.pos); v.mesh.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
    if (mode === 'boat') v.mesh.position.y = 0.1 + Math.sin(performance.now() / 400 + v.id) * 0.08;
    if (P.legs) { v.walk += Math.hypot(mx, mz) * 1.6; P.legs[0].rotation.x = Math.sin(v.walk) * 0.5; P.legs[1].rotation.x = -Math.sin(v.walk) * 0.5; P.torso.rotation.x = c.aimPitch * 0.3; P.torso.position.y = 2.9 + Math.abs(Math.sin(v.walk)) * 0.12; }
    if (P.turret) { const gunner = v.seats.find(s => s.role === 'gunner'); const aimY = gunner ? (gunner.unit ? gunner.aimYaw ?? v.yaw : v.yaw) : c.aimYaw; P.turret.rotation.y = aimY - v.yaw; }
    if (P.rotor) P.rotor.rotation.y += dt * 25;
    // weapons: driver fires unless the vehicle has a dedicated gunner seat (buggy/boat/heli gunner)
    if (K.mode !== 'car' && c.fire) this.vfire(v, 0, c);
    if (c.alt && K.weapons[1]) this.vfire(v, 1, c);
    if (c.special && K.weapons[2]) this.vfire(v, 2, c);
    // mech polish: smoke + warning when armor is low
    if (v.hp < K.hp * 0.3 && Math.random() < dt * 8) this.smoke(v);
  }
  fly(v, c, dt) {
    const K = v.K;
    if (K.mode === 'heli') {
      v.yaw += THREE.MathUtils.clamp(((c.aimYaw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2 * dt, 2 * dt);
      const [fx, fz] = [-Math.sin(v.yaw), -Math.cos(v.yaw)], rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
      v.vx = THREE.MathUtils.lerp(v.vx || 0, (fx * c.my + rx * c.mx) * K.speed, dt * 1.5); v.vz = THREE.MathUtils.lerp(v.vz || 0, (fz * c.my + rz * c.mx) * K.speed, dt * 1.5);
      v.vy = THREE.MathUtils.lerp(v.vy, (c.up ? 7 : 0) - (c.down ? 7 : 0), dt * 2);
      v.pitch = THREE.MathUtils.lerp(v.pitch, -c.my * 0.2, dt * 3); v.roll = THREE.MathUtils.lerp(v.roll, -c.mx * 0.25, dt * 3);
      const n = v.pos.clone().add(new THREE.Vector3(v.vx * dt, v.vy * dt, v.vz * dt)); n.y = THREE.MathUtils.clamp(n.y, 1.2, K.ceiling);
      if (this.airHit(v, n)) { v.vx *= -0.3; v.vz *= -0.3; v.vy = 0; this.hurtVehicle(v, 15, null, true); v.pos.y += 1; } else v.pos.copy(n);
    } else { // jet: always moving forward; mouse/aim steers, W/S throttle
      v.speed = THREE.MathUtils.clamp((v.speed || K.minSpeed * 0.0) + c.my * 12 * dt, 0, K.speed);
      const dy = ((c.aimYaw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; v.yaw += THREE.MathUtils.clamp(dy, -1.2 * dt, 1.2 * dt); v.roll = THREE.MathUtils.lerp(v.roll, THREE.MathUtils.clamp(dy, -1, 1) * 0.9, dt * 3);
      const lift = v.speed >= K.minSpeed; const tp = lift ? THREE.MathUtils.clamp(c.aimPitch, -0.7, 0.7) : Math.min(0, v.pitch); v.pitch += THREE.MathUtils.clamp(tp - v.pitch, -1 * dt, 1 * dt);
      const d = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(v.pitch, v.yaw, 0, 'YXZ')); const n = v.pos.clone().addScaledVector(d, v.speed * dt);
      if (!lift) n.y -= (v.pos.y > 0.9 ? 6 : 0) * dt; n.y = Math.min(n.y, K.ceiling);
      const half = this.map.size / 2 - 4; if (Math.abs(n.x) > half || Math.abs(n.z) > half) { v.yaw += Math.PI * dt; n.x = THREE.MathUtils.clamp(n.x, -half, half); n.z = THREE.MathUtils.clamp(n.z, -half, half); }
      if (n.y < 0.8) { if (v.pitch < -0.25 && v.speed > 25) { this.hurtVehicle(v, 9999, null, true); return; } n.y = 0.8; v.pitch = Math.max(0, v.pitch); }
      if (this.airHit(v, n)) { this.hurtVehicle(v, 9999, null, true); return; }
      v.pos.copy(n);
    }
    const lim = this.map.size / 2 - 3; v.pos.x = THREE.MathUtils.clamp(v.pos.x, -lim, lim); v.pos.z = THREE.MathUtils.clamp(v.pos.z, -lim, lim);
  }
  airHit(v, n) { for (const s of this.solids) if (s !== v.solid && n.x > s.min.x - 1 && n.x < s.max.x + 1 && n.z > s.min.z - 1 && n.z < s.max.z + 1 && n.y > s.min.y - 0.5 && n.y < s.max.y + 0.5) return true; return false; }
  vfire(v, i, c, shooter) {
    const w = v.K.weapons[i]; if (v.cd[i] > 0) return; if (w.ammoMax && v.ammo[i] < 1) return; v.cd[i] = w.cd || 60 / w.rpm; if (w.ammoMax) v.ammo[i]--;
    const src = shooter || v.seats[0].unit || { team: v.team, name: v.K.name }; this.sfx(w.splash || w.key === 'stomp' ? 'cannon' : 'chain', v.pos);
    if (w.key === 'stomp') { this.explode(v.pos, w.dmg, w.splash, src, true); if (src.isPlayer) this.hooks.toast('STOMP'); return; }
    const muzzle = v.pos.clone(); muzzle.y += v.K.eye + (v.K.mode === 'heli' || v.K.mode === 'jet' ? -0.6 : 0);
    let h;
    if (src.isPlayer) { this.aimRay(w.spread || 0.002); h = this.firstHit(src); }
    else { const d = c.aimDir.clone(); d.x += (Math.random() - 0.5) * (w.spread || 0.01) * 4; d.y += (Math.random() - 0.5) * (w.spread || 0.01) * 4; d.normalize(); this.ray.set(muzzle, d); this.ray.far = w.range * 1.5; h = this.firstHit(src); }
    const end = h ? h.point : muzzle.clone().addScaledVector(this.ray.ray.direction, 150); this.tracer(muzzle, end);
    if (h && h.distance < w.range * 1.5) { if (w.splash) this.explode(h.point, w.dmg, w.splash, src); else this.damageAt(h, w.dmg, src, h.object.userData.head); }
    if (src.isPlayer && v.K.mode !== 'jet' && v.K.mode !== 'heli') this.recoilP += w.splash ? 0.02 : 0.002;
  }
  smoke(v) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.6, depthWrite: false }));
    s.position.copy(v.pos); s.position.y += v.K.h; this.scene.add(s); let t = 0; const st = () => { t += 0.03; s.position.y += 0.06; s.scale.setScalar(1 + t * 3); s.material.opacity = 0.6 * (1 - t); if (t < 1 && this.scene) requestAnimationFrame(st); else this.scene?.remove(s); }; st(); }
  playerCtrl() { return { mx: input.move.x, my: input.move.y, aimYaw: this.player.yaw, aimPitch: this.player.pitch, up: input.jump, down: input.sprint || consumeHeld('KeyC'), fire: input.fire, alt: input.ads, special: consume('KeyG', 'btn_edit') }; }
  pilot(v, dt) {
    const seat = this.seatOf(this.player);
    if (seat.role === 'gunner') { seat.aimYaw = this.player.yaw; v.cd = v.cd.map(t => t); if (input.fire) this.vfire(v, 0, {}, this.player); if (input.ads && v.K.weapons[1]) this.vfire(v, 1, {}, this.player);
      if (!v.seats[0].unit) this.drive(v, { mx: 0, my: 0, aimYaw: v.yaw, aimPitch: 0 }, dt); return; }
    const c = this.playerCtrl(); if (v.K.mode === 'car' && v.seats[1].unit && !v.seats[1].unit.isPlayer) this.botGunner(v, v.seats[1], dt);
    this.drive(v, c, dt);
  }
  // Bot vehicle AI: drivers steer toward enemies and fire; gunners track the nearest visible enemy.
  botGunner(v, seat, dt) {
    const u = seat.unit; let best = null, bd = 90; for (const e of this.units) if (e.alive && e.team !== v.team) { const d = e.pos.distanceTo(v.pos); if (d < bd && this.canSee(u, e) === true) { bd = d; best = e; } }
    if (!best) return; const d = best.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(v.pos.clone().setY(v.pos.y + v.K.eye)); seat.aimYaw = Math.atan2(-d.x, -d.z);
    v.gcd = (v.gcd || 0) - dt; if (v.gcd <= 0) { v.gcd = 60 / v.K.weapons[0].rpm * 1.8; v.cd[0] = 0; this.vfire(v, 0, { aimDir: d.normalize() }, u); }
  }
  botDrive(u, dt) {
    const v = u.vehicle, seat = this.seatOf(u);
    if (seat.role === 'gunner') { this.botGunner(v, seat, dt); if (!v.seats[0].unit) this.drive(v, { mx: 0, my: 0, aimYaw: v.yaw, aimPitch: 0 }, dt); return; }
    u.think -= dt; if (u.think <= 0) { u.think = 0.5; let best = null, bd = v.K.mode === 'jet' ? 200 : 120;
      for (const e of this.units) if (e.alive && e.team !== u.team) { const d = e.pos.distanceTo(v.pos); if (d < bd && this.canSee(u, e) === true) { bd = d; best = e; } }
      u.target = best; if (!best && (!u.wp || v.pos.distanceTo(u.wp) < 8 || Math.random() < 0.05)) { const cp = this.capPoints?.filter(p => p.owner !== u.team); const tgt = cp && cp.length ? cp[Math.floor(Math.random() * cp.length)] : null;
        const h = this.map.size / 2 - 10; u.wp = tgt ? new THREE.Vector3(tgt.x, 0, tgt.z) : new THREE.Vector3((Math.random() - 0.5) * h * 2, 0, (Math.random() - 0.5) * h * 2);
        if (v.K.mode === 'boat') { const w = this.layout.water[Math.floor(Math.random() * this.layout.water.length)]; u.wp.set(THREE.MathUtils.lerp(w[0], w[1], Math.random()), 0, THREE.MathUtils.lerp(w[2], w[3], Math.random())); } } }
    let tp = u.target?.alive ? u.target.pos : u.wp; const mode0 = v.K.mode;
    if (mode0 === 'tracked' || mode0 === 'car' || mode0 === 'boat' || mode0 === 'walker') { const vu = { pos: v.pos, K: v.K, bumped: v.speed !== undefined && Math.abs(v.speed) < 0.5 && (u.stuckT = (u.stuckT || 0) + dt) > 2 }; if (vu.bumped) u.stuckT = 0;
      Object.assign(vu, u.vnav || {}); tp = this.pathTo(vu, tp, mode0 === 'boat' ? 'boat' : 'land'); u.vnav = { path: vu.path, pathI: vu.pathI, pathGoal: vu.pathGoal, repathT: vu.repathT }; }
    const d = tp.clone().sub(v.pos); const flat = Math.hypot(d.x, d.z); const yaw = Math.atan2(-d.x, -d.z);
    const aimDir = u.target?.alive ? u.target.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(v.pos.clone().setY(v.pos.y + v.K.eye)).normalize() : null;
    const dyaw = ((yaw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, mode = v.K.mode, c = { mx: 0, my: 0, aimYaw: yaw, aimPitch: 0, aimDir, fire: false, alt: false };
    if (mode === 'walker') { c.my = flat > 25 ? 1 : 0; c.mx = u.target ? Math.sin(performance.now() / 1500 + u.id) : 0; }
    else if (mode === 'tracked' || mode === 'car' || mode === 'boat') { c.mx = THREE.MathUtils.clamp(-dyaw * 2, -1, 1); c.my = flat > (u.target ? 30 : 6) ? (Math.abs(dyaw) > 1.8 ? -0.5 : 1) : 0; if (mode === 'car' && u.target) c.my = flat > 15 ? 1 : 0.4; }
    else if (mode === 'heli') { c.my = v.pos.y < 12 ? 0 : flat > 40 ? 1 : flat < 20 ? -0.4 : 0; c.up = v.pos.y < 18; c.down = v.pos.y > 24; const ah = v.pos.clone().add(new THREE.Vector3(-Math.sin(v.yaw) * 12, 0, -Math.cos(v.yaw) * 12)); if (this.airHit(v, ah)) { c.up = true; c.down = false; c.my = 0; } }
    else if (mode === 'jet') { c.my = 1; const alt = u.target?.alive ? u.target.pos.y + 25 : 40; c.aimPitch = THREE.MathUtils.clamp((alt - v.pos.y) * 0.03, -0.5, 0.5); if (u.target && flat < 120 && v.pos.y > 30) c.aimPitch = Math.max(-0.35, Math.atan2(d.y - 0.5, flat)); if (v.pos.y < 35 && c.aimPitch < 0) c.aimPitch = 0.25; if (v.pos.y < 20) c.aimPitch = 0.4;
      // terrain/obstacle lookahead + safe minimum altitude
      const fwd3 = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(v.pitch, v.yaw, 0, 'YXZ'));
      for (const tt of [0.5, 1, 1.5, 2.5]) { const q = v.pos.clone().addScaledVector(fwd3, Math.max(Math.hypot(v.vx || 0, v.vy || 0, v.vz || 0), 20) * tt); if (q.y < 22 || this.airHit(v, q)) { c.aimPitch = 0.6; break; } }
      const edge = this.map.size / 2 - 30; if (Math.abs(v.pos.x) > edge || Math.abs(v.pos.z) > edge) c.aimYaw = Math.atan2(v.pos.x, v.pos.z); }
    if (aimDir) { const fwd = new THREE.Vector3(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)); const facing = mode === 'tracked' || mode === 'walker' || mode === 'heli' ? true : fwd.dot(new THREE.Vector3(aimDir.x, 0, aimDir.z).normalize()) > 0.93;
      if (facing && mode !== 'car') { u.vcd = (u.vcd || 0) - dt; if (u.vcd <= 0) { u.vcd = 0.12; c.fire = Math.random() < 0.6; c.alt = Math.random() < 0.08; } } }
    if (mode === 'car' && v.seats[1].unit) this.botGunner(v, v.seats[1], dt);
    this.drive(v, c, dt);
  }
  static gunSound(g) { return { pistol: 'pistol', smg: 'smg', shotgun: 'shotgun', sniper: 'sniper' }[g.type] || 'rifle'; }
  explode(pt, dmg, r, src, ground) {
    this.sfx('explode', pt);
    const fx = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.7 }));
    fx.position.copy(pt); this.scene.add(fx); setTimeout(() => this.scene && this.scene.remove(fx), 180);
    for (const u of this.units) if (u.alive && u !== src) { const d = u.pos.distanceTo(pt); if (d < r) this.hurt(u, dmg * (1 - d / r * 0.6), src, false); }
    for (const v of this.vehicles) if (v.alive && v.team !== src.team) { const d = v.pos.distanceTo(pt); if (d < r + 1.5) this.hurtVehicle(v, dmg * 0.8, src); }
    for (const b of this.builds.slice()) { if (b.mesh.position.distanceTo(pt) < r + 1) { b.hp -= dmg * 1.5; if (b.hp <= 0) this.removeBuild(b); } }
  }
  // Capture points (Conquest): stand in the ring to flip it; each held point ticks score for its team.
  chooseSpawn(id) { const o = this.spawnOptions(this.player.team).find(x => x.id === id); if (!o) return false; this.choosing = false; this.spawn(this.player, o); this.hooks.hud(this); return true; }
  updateCaps(dt) {
    if (!this.capPoints.length) return; this.capTick += dt; const tick = this.capTick >= 3; if (tick) this.capTick = 0;
    for (const c of this.capPoints) {
      let n0 = 0, n1 = 0; for (const u of this.units) if (u.alive && Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < 8 && u.pos.y < 6) u.team ? n1++ : n0++;
      c.contested = n0 > 0 && n1 > 0; const push = (n0 - n1) * 0.12 * dt; const before = c.owner;
      if (push) { c.prog = THREE.MathUtils.clamp(c.prog + push, -1, 1); if (c.prog >= 1) c.owner = 0; else if (c.prog <= -1) c.owner = 1; else if ((c.owner === 0 && c.prog < 0) || (c.owner === 1 && c.prog > 0)) c.owner = -1; }
      if (before !== c.owner && (n0 && this.player.team === 0 && Math.hypot(this.player.pos.x - c.x, this.player.pos.z - c.z) < 8)) { this.hooks.toast(c.owner === 0 ? `Captured ${c.n} ${c.name} +200 XP` : `${c.n} neutralized`); if (c.owner === 0) this.stats.caps = (this.stats.caps || 0) + 1; }
      if (before !== c.owner && c.owner !== -1) this.sfx(c.owner === this.player.team ? 'capture' : 'lost'); else if (before === this.player.team && c.owner === -1) this.sfx('lost');
      const col = c.owner === 0 ? 0x4f8fff : c.owner === 1 ? 0xff6a4a : 0xffffff; c.flag.material.color.set(col); c.ring.material.color.set(col);
      if (tick && c.owner >= 0) { this.score[c.owner]++; if (this.score[c.owner] >= this.map.scoreLimit) this.end(); }
    }
  }
  shieldPop(u) {
    this.sfx('shieldBreak', u.isPlayer ? null : u.pos); if (u.isPlayer) { this.hooks.shieldPop(); return; }
    const fx = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.55, depthWrite: false }));
    fx.position.copy(u.pos); fx.position.y += 1.1; this.scene.add(fx); let t = 0; const step = () => { t += 0.05; fx.scale.setScalar(1 + t * 2); fx.material.opacity = 0.55 * (1 - t / 0.3); if (t < 0.3 && this.scene) requestAnimationFrame(step); else this.scene?.remove(fx); }; step();
  }
  updateDots(dt) { for (const u of this.units) { const d = u.dot; if (!d) continue; if (!u.alive) { u.dot = null; continue; }
      d.t -= dt; d.acc += dt; if (d.acc >= 0.5) { d.acc -= 0.5; this.hurt(u, d.dps * 0.5, d.src, false, d.elem); } if (d.t <= 0) u.dot = null; } }
  regenShields(dt) { for (const u of this.units) if (u.alive) { u.shT += dt; if (u.shT > (u.shDelay || 3) && u.sh < u.maxSh) { const was = u.sh; u.sh = Math.min(u.maxSh, u.sh + 60 * dt); if (u.isPlayer && was === 0) { this.sfx('shieldUp'); this.hooks.toast('Shield recharging'); } } } }
  hurtVehicle(v, dmg, src) {
    if (!v.alive || (src && src.team === v.team && !arguments[3])) return; v.hp -= dmg; if (src?.isPlayer) this.hooks.hitmark(false);
    if (v.seats.some(s => s.unit === this.player)) this.hooks.hurt();
    if (v.hp <= 0) { v.alive = false; v.respawn = 30; v.mesh.visible = false; this.solids = this.solids.filter(s => s !== v.solid);
      for (const s of v.seats) if (s.unit) { const u = s.unit; s.unit = null; u.vehicle = null; u.hp = Math.min(u.hp, 50); u.sh = 0; u.pos.y = 0; if (u.mesh) u.mesh.visible = true; if (v.K.mode === 'jet' || v.K.mode === 'heli') { u.vehicle = null; this.hurt(u, 9999, src || u, false); } if (u === this.player) { this.selectSlot(this.slot); this.hooks.toast(`${v.K.name} destroyed!`); } }
      this.explode(v.pos.clone().setY(v.pos.y + 1), 60, 5, src || { team: -1, name: v.K.name }); if (src?.isPlayer) { this.stats.kills++; this.hooks.toast(`${v.K.name} destroyed +100 XP`); } }
    this.hooks.hud(this);
  }
  respawnVehicle(v) { v.alive = true; v.hp = v.K.hp; v.speed = 0; v.pitch = v.roll = 0; v.vy = 0; v.pos.set(v.home[0], v.kind === 'jet' ? 0.8 : v.kind === 'heli' ? 1.2 : 0, v.home[1]); v.yaw = v.team === 0 ? 0 : Math.PI; v.mesh.visible = true; v.mesh.position.copy(v.pos); v.mesh.rotation.set(0, v.yaw, 0); syncSolid(v); this.solids.push(v.solid); }
  snapshot() { // network-ready state: what a server would broadcast each tick
    return { tick: this.tickNo, score: this.score, time: this.timeLeft, vehicles: this.vehicles.map(v => ({ id: v.id, kind: v.kind, x: v.pos.x, z: v.pos.z, yaw: v.yaw, hp: v.hp, seats: v.seats.map(s => s.unit?.id || 0) })),
      units: this.units.map(u => ({ id: u.id, team: u.team, x: u.pos.x, y: u.pos.y, z: u.pos.z, yaw: u.yaw, hp: u.hp, alive: u.alive })),
      builds: this.builds.map(b => ({ id: b.id, ...b.g, hp: b.hp })) };
  }
  // ---- loot ----
  lootMat(ri) { this.lootMats = this.lootMats || {}; return this.lootMats[ri] || (this.lootMats[ri] = new THREE.MeshBasicMaterial({ color: RARITY[ri].color, transparent: true, opacity: 0.55, depthWrite: false })); }
  dropLoot(gun, pos) {
    const g = new THREE.Group(); const L = { pistol: 0.3, smg: 0.5, rifle: 0.7, shotgun: 0.75, sniper: 1.0 }[gun.type] || 0.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, L), this.m(RARITY[gun.rarity].color)); body.position.y = 0.5; g.add(body);
    const bh = (this.tier === 'low' ? 1.6 : 2.5) + gun.rarity * (this.tier === 'low' ? 0.8 : 1.4); // rarity beam
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + gun.rarity * 0.015, 0.05 + gun.rarity * 0.015, bh, 5, 1, true), this.lootMat(gun.rarity)); beam.position.y = bh / 2; g.add(beam);
    g.position.set(pos.x + (Math.random() - 0.5), Math.max(0, (pos.y || 0) - 0), pos.z + (Math.random() - 0.5)); this.scene.add(g);
    this.lootDrops.push({ gun, mesh: g, life: 90 }); while (this.lootDrops.length > this.dropCap) this.removeLoot(this.lootDrops.sort((a, b) => a.gun.rarity - b.gun.rarity)[0]);
  }
  removeLoot(d) { this.scene.remove(d.mesh); d.mesh.traverse(o => o.isMesh && o.geometry.dispose()); this.lootDrops = this.lootDrops.filter(x => x !== d); }
  updateLoot(dt) {
    const P = this.player; if (this.lastLoot) this.lastLoot.t -= dt;
    for (const d of this.lootDrops.slice()) { d.mesh.children[0].rotation.y += dt * 2; if ((d.life -= dt) <= 0) { this.removeLoot(d); continue; }
      if (P.alive && !P.vehicle && Math.hypot(d.mesh.position.x - P.pos.x, d.mesh.position.z - P.pos.z) < 1.5) {
        if (this.save.inv.length >= BACKPACK) { if (!d.warned) { d.warned = true; this.hooks.toast('Backpack full: sell guns in the Armory'); } continue; }
        const gun = Object.assign({ uid: this.save.uid++ }, d.gun); this.save.inv.push(gun); this.hooks.persist(); this.removeLoot(d); this.sfx('capture');
        this.lastLoot = { uid: gun.uid, t: 8 }; this.hooks.toast(`<span style="color:${RARITY[gun.rarity].css}">${RARITY[gun.rarity].name} ${gun.name}</span>${gun.elem ? ' · ' + ELEMENTS[gun.elem].name : ''} added to backpack (F / ENTER to equip now)`, true); } }
    this.nearChest = null; if (P.alive && !P.vehicle) for (const c of this.chests) if (!c.open && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 2.6) { this.nearChest = c; break; }
  }
  equipLoot(uid) { const gun = this.save.inv.find(x => x.uid === uid); if (!gun) return; const i = gun.type === 'pistol' ? 1 : 0; this.slots[i] = this.makeWeapon('L' + uid); this.save.loadout[i ? 'secondary' : 'primary'] = 'L' + uid; this.hooks.persist(); this.lastLoot = null; this.selectSlot(i); this.hooks.toast(`Equipped ${gun.name}`); }
  addChest(p) { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.8), this.m(0x5b3d1e, 'wood')); base.position.y = 0.35;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.2, 0.85), this.m(0xd4a63a, 'metal')); lid.position.y = 0.8; g.add(base, lid); g.position.copy(p); this.scene.add(g);
    this.chests.push({ x: p.x, z: p.z, mesh: g, lid, open: false }); this.solids.push({ min: new THREE.Vector3(p.x - 0.7, 0, p.z - 0.4), max: new THREE.Vector3(p.x + 0.7, 0.9, p.z + 0.4) }); }
  openChest(c) { c.open = true; c.lid.rotation.x = -1.2; c.lid.position.set(0, 1.0, 0.35); this.sfx('capture'); const n = 2 + (Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) { const g = genGun(this.save.rank + 2); if (g.rarity === 0 && Math.random() < 0.6) Object.assign(g, genGun(this.save.rank + 2, 1)); this.dropLoot(g, { x: c.x, y: 0, z: c.z + 1.2 }); }
    this.hooks.toast('Chest opened'); }
  // ---- classes ----
  applyClass() { const S = this.save, P = this.player; this.cls = CLASSES[S.cls] ? S.cls : 'vanguard'; const C = CLASSES[this.cls];
    P.maxSh = 100 + (this.cls === 'vanguard' ? 12 * lv(S, 'ironhide') : 0); P.sh = P.maxSh; P.shDelay = 3 - (this.cls === 'vanguard' ? 0.6 * lv(S, 'secondwind') : 0);
    P.speedMul = 1 + (this.cls === 'ghostwire' ? 0.05 * lv(S, 'quickstep') : 0);
    this.skill = { name: C.action.name, dur: C.action.dur + (this.cls === 'vanguard' ? 1.5 * lv(S, 'longwall') : this.cls === 'ghostwire' ? lv(S, 'linger') : 0), cd: C.action.cd - (this.cls === 'sparkwright' ? 4 * lv(S, 'overclock') : 0), t: 0, cdT: 0 };
    P.dmgTaken = () => this.cls === 'vanguard' && this.skill.t > 0 ? 0.4 : 1; }
  useSkill() { const k = this.skill, P = this.player; if (!P.alive || P.vehicle) return; if (k.cdT > 0) { this.hooks.toast(`${k.name} ready in ${Math.ceil(k.cdT)}s`); return; }
    k.t = k.dur; k.cdT = k.cd; this.sfx('shieldUp'); this.hooks.toast(k.name.toUpperCase());
    if (this.cls === 'vanguard') { P.sh = P.maxSh; }
    else if (this.cls === 'ghostwire') { P.cloakT = k.dur; P.cloakShot = true; for (const u of this.units) if (u.target === P) u.target = null; }
    else { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1, 6), this.m(0x4a5560, 'metal')); b.position.y = 0.5;
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.6), this.m(0x4fc3ff)); h.position.y = 1.15; g.add(b, h); const f = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
      g.position.set(P.pos.x + f.x * 1.5, P.pos.y, P.pos.z + f.z * 1.5); this.scene.add(g); this.turrets.push({ mesh: g, head: h, t: k.dur, cd: 0, pos: g.position, team: P.team, isPlayer: true, name: 'Arc Turret', kills: 0, dmgMul: 1 + 0.25 * lv(this.save, 'twincoil') }); } }
  updateSkill(dt) { const k = this.skill, P = this.player; if (!k) return; k.cdT = Math.max(0, k.cdT - dt); k.t = Math.max(0, k.t - dt);
    if (P.cloakT > 0) { P.cloakT -= dt; if (P.firedT > 1.4) P.cloakT = 0; } // firing breaks cloak
    for (const t of this.turrets.slice()) { t.t -= dt; t.cd -= dt;
      if (t.t <= 0) { this.scene.remove(t.mesh); this.turrets = this.turrets.filter(x => x !== t); continue; }
      if (t.cd > 0) continue; let best = null, bd = 30; for (const e of this.units) if (e.alive && e.team !== t.team && !e.vehicle) { const d = e.pos.distanceTo(t.pos); if (d < bd && this.canSee({ pos: t.pos }, e) === true) { bd = d; best = e; } }
      if (best) { t.cd = 0.25; t.head.rotation.y = Math.atan2(-(best.pos.x - t.pos.x), -(best.pos.z - t.pos.z)); const a = t.pos.clone(); a.y += 1.2; const b = best.pos.clone(); b.y += 1.2; this.tracer(a, b);
        this.sfx('smg', t.pos); this.hurt(best, 9 * t.dmgMul, P, false, 'shock'); if (Math.random() < 0.15) best.dot = { elem: 'shock', dps: 10 * t.dmgMul, t: 3, acc: 0, src: P }; } } }
  end() {
    if (this.over) return; this.over = true; this.running = false; document.exitPointerLock?.();
    if (this.z) return this.hooks.end(this.zEnd());
    const won = this.score[0] > this.score[1], s = this.stats, big = this.map.type === 'war' ? 1.6 : this.map.type === 'large' ? 1.3 : 1;
    const xp = Math.round(((s.caps || 0) * 200 + s.kills * 100 + s.head * 50 + Math.round(s.dmg / 10) + s.builds * 2 + (won ? 500 : 150)) * big);
    const gp = Math.round((s.kills * 25 + s.head * 10 + (won ? 300 : 100)) * big);
    this.hooks.end({ won, xp, gp, stats: s, score: this.score.slice() });
  }
  dispose() { this.running = false; this.scene = null; }
}
installZombies(Game);
