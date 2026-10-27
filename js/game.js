import * as THREE from 'three';
import { GUNS, ATTACH, BUILD, GRID } from './data.js';
import { MAPS } from './maps.js';
import { mat, makeRenderer, isPhone } from './gfx.js';
import { KINDS, createVehicle, syncSolid } from './vehicles.js';
import { input, pollKeys, consume, endFrame } from './input.js';

const TICK = 1 / 60, EYE = 1.6, RAD = 0.4, GRAV = 22;
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
    const lowPhone = this.tier === 'low' && isPhone; this.teamSize = lowPhone ? Math.min(M.teamSize, 6) : M.teamSize; // phone Low caps bots
    this.camera.far = this.tier === 'low' ? Math.min(220, M.size * 1.4) : 600; this.camera.updateProjectionMatrix();
    for (let i = 1; i < this.teamSize; i++) this.makeUnit(0, false, BOT_NAMES[i % BOT_NAMES.length]);
    const foes = mode === 'coop' ? Math.round(this.teamSize * 1.5) : this.teamSize; // co-op: your bot squad vs a larger, sharper enemy force
    for (let i = 0; i < foes; i++) { const b = this.makeUnit(1, false, BOT_NAMES[(i + 12) % BOT_NAMES.length]); if (mode === 'coop') b.skill = Math.min(0.95, b.skill + 0.1); }
    this.units.forEach(u => this.spawn(u));
    this.vehicles = []; for (const [k, x, z, team] of (L.vehicles || [])) this.vehicles.push(createVehicle(this, k, x, z, team, ++this.nextId));
    // loadout
    const lo = this.save.loadout; this.slots = [lo.primary, lo.secondary, 'pick'].map(id => id === 'pick' ? { id, pick: true } : this.makeWeapon(id));
    this.mats = { wood: 30, stone: 0 }; this.slot = 0; this.buildMode = null; this.buildRot = 0;
    this.stats = { kills: 0, deaths: 0, head: 0, dmg: 0, builds: 0 }; this.recoilP = 0; this.fireT = 0;
    this.selectSlot(0); this.makeGhost();
    this.running = true; this.last = performance.now(); this.hooks.hud(this);
    if (!this.loopOn) { this.loopOn = true; const loop = t => { requestAnimationFrame(loop); this.frame(t); }; requestAnimationFrame(loop); }
  }
  addBox(x, z, w, d, h, color, kind) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.m(color, kind, Math.max(1, Math.round(w / 4))));
    mesh.position.set(x, h / 2, z); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.kind = 'static'; this.scene.add(mesh); this.hitMeshes.push(mesh);
    this.solids.push({ min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, h, z + d / 2) });
  }
  makeWeapon(id) {
    const base = GUNS[id], att = this.save.attach[id] || {}; const w = Object.assign({ id }, base); w.adsZoom = base.zoom || 1.15;
    for (const a of Object.values(att)) { const mod = ATTACH[a]?.mod || {}; for (const k in mod) w[k] = k === 'adsZoom' ? Math.max(w[k], mod[k]) : w[k] * mod[k]; }
    w.mag = Math.round(w.mag); w.reload *= 1 - this.save.stats.reload * 0.04; w.ammo = w.mag; w.reloading = 0; return w;
  }
  makeUnit(team, isPlayer, name) {
    const u = { id: ++this.nextId, team, isPlayer, name, pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, hp: 100, maxHp: 100, alive: true, onGround: false, kills: 0, deaths: 0, respawn: 0 };
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
      u.gun = this.makeWeaponBot(); u.think = 0; u.target = null; u.wp = new THREE.Vector3(); u.strafe = 1; u.skill = 0.55 + Math.random() * 0.35;
    }
    this.units.push(u); return u;
  }
  makeWeaponBot() { const ids = ['kr4', 'kr4', 'hx2', 'bm12', 'vx9']; const b = GUNS[ids[Math.floor(Math.random() * ids.length)]]; return Object.assign({ ammo: b.mag, reloading: 0, cd: 0 }, b); }
  spawn(u) {
    const sp = this.layout.spawns[u.team], h = this.map.size / 2 - 3;
    for (let tries = 0; tries < 20; tries++) {
      u.pos.set(THREE.MathUtils.clamp(sp[0] + (Math.random() - 0.5) * this.map.size * 0.5, -h, h), 0, THREE.MathUtils.clamp(sp[1] + (Math.random() - 0.5) * 8, -h, h));
      if (!this.blocked(u.pos)) break;
    }
    u.hp = u.maxHp; u.alive = true; u.vy = 0; u.yaw = u.team === 0 ? 0 : Math.PI; u.pitch = 0; u.spawnProt = 2;
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
    const p = u.pos;
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
    if (jump && u.onGround) { u.vy = 8; u.onGround = false; }
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
    this.view.scale.setScalar(0.6); this.view.position.set(0.22, -0.2, -0.35); this.hooks.hud(this);
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
    if (w.reloading > 0) { w.reloading -= dt; if (w.reloading <= 0) { w.ammo = w.mag; this.hooks.hud(this); } return; }
    if ((consume('KeyR', 'btn_reload') || w.ammo <= 0) && w.ammo < w.mag) { w.reloading = w.reload; this.hooks.toast('Reloading'); return; }
    if (!input.fire || this.fireT > 0) return;
    if (!w.auto) { if (this.semiHeld) return; this.semiHeld = true; }
    this.fireT = 60 / w.rpm; w.ammo--;
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
    if (ud.kind === 'unit') this.hurt(ud.unit, dmg * (head ? 2 : 1), src, head);
    else if (ud.kind === 'vehicle') this.hurtVehicle(ud.vehicle, dmg, src);
    else if (ud.kind === 'build') { const b = ud.build; b.hp -= dmg * (pick ? 2 : 1); b.mesh.material.opacity = 1; if (b.hp <= 0) this.removeBuild(b); }
    else if (ud.kind === 'harvest' && src.isPlayer && pick) {
      const o = ud.obj; o.userData.hp = (o.userData.hp || 120) - 30; const amt = 6 + this.save.stats.build; this.mats[ud.res] += amt;
      this.hooks.toast(`+${amt} ${ud.res}`); o.scale.multiplyScalar(0.96);
      if (o.userData.hp <= 0) { this.scene.remove(o); this.hitMeshes = this.hitMeshes.filter(m => m.userData.obj !== o); this.solids = this.solids.filter(s => s.obj !== o); }
      this.hooks.hud(this);
    }
  }
  hurt(u, dmg, src, head) {
    if (!u.alive || u.spawnProt > 0 || (src && src.team === u.team && src !== u)) return;
    if (u.vehicle) { this.hurtVehicle(u.vehicle, dmg, src); return; }
    u.hp -= dmg; if (src.isPlayer) { this.stats.dmg += dmg; this.hooks.hitmark(head); }
    if (u.isPlayer) this.hooks.hurt();
    if (!u.isPlayer && src && !u.target) u.target = src;
    if (u.hp <= 0) {
      u.alive = false; u.deaths++; u.respawn = 3; src.kills++; this.score[src.team]++;
      if (u.mesh) u.mesh.visible = false;
      if (src.isPlayer) { this.stats.kills++; if (head) this.stats.head++; this.hooks.toast(head ? 'HEADSHOT +150 XP' : 'Eliminated +100 XP'); }
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
    this.builds.push(b); this.hooks.hud(this);
  }
  removeBuild(b) {
    this.scene.remove(b.mesh); this.hitMeshes = this.hitMeshes.filter(m => m !== b.mesh); this.builds = this.builds.filter(x => x !== b);
    if (b.solid) this.solids = this.solids.filter(s => s !== b.solid); if (b.ramp) this.ramps = this.ramps.filter(r => r !== b.ramp);
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
  botThink(u, dt) {
    u.think -= dt; const g = u.gun;
    if (u.think <= 0) {
      u.think = 0.3 + Math.random() * 0.3; let best = null, bd = 1e9;
      for (const e of this.units) if (e.alive && e.team !== u.team) { const d = e.pos.distanceTo(u.pos); if (d < bd && d < 80 && this.canSee(u, e) === true) { bd = d; best = e; } }
      u.target = best; u.seeT = best ? (u.seeT || 0) : 0;
      if (!best && (u.pos.distanceTo(u.wp) < 3 || Math.random() < 0.05 || u.bumped)) {
        const enemies = this.units.filter(e => e.alive && e.team !== u.team), e = enemies[Math.floor(Math.random() * enemies.length)];
        const h = this.map.size / 2 - 4; u.wp.set(THREE.MathUtils.clamp((e ? e.pos.x : 0) + (Math.random() - 0.5) * 30, -h, h), 0, THREE.MathUtils.clamp((e ? e.pos.z : 0) + (Math.random() - 0.5) * 30, -h, h));
        u.bumped = false;
      }
      if (Math.random() < 0.3) u.strafe *= -1;
    }
    let mx = 0, mz = 0, jump = false; const speed = 4.2;
    if (u.target && u.target.alive) {
      const t = u.target, d = t.pos.clone().sub(u.pos); u.yaw = Math.atan2(-d.x, -d.z); u.seeT += dt;
      const dist = d.length(), side = new THREE.Vector3(Math.cos(u.yaw), 0, -Math.sin(u.yaw));
      mx = side.x * u.strafe * 0.6; mz = side.z * u.strafe * 0.6;
      if (dist > g.range * 0.7) { mx += -Math.sin(u.yaw); mz += -Math.cos(u.yaw); }
      g.cd -= dt;
      if (g.reloading > 0) { g.reloading -= dt; if (g.reloading <= 0) g.ammo = g.mag; }
      else if (g.ammo <= 0) g.reloading = g.reload * 1.2;
      else if (g.cd <= 0 && u.seeT > 0.45) {
        g.cd = 60 / g.rpm * (g.auto ? 1.6 : 1.2); g.ammo--;
        const vis = this.canSee(u, t); const from = u.pos.clone(); from.y += 1.3;
        if (vis !== true) { if (['build', 'vehicle'].includes(vis.object?.userData.kind)) this.damageAt(vis, g.dmg, u); this.tracer(from, vis.point); }
        else { const chance = u.skill * (1 - Math.min(dist / (g.range * 1.6), 0.8)) * (t.isPlayer ? 0.55 : 0.6);
          const hits = g.pellets ? Math.round(g.pellets * chance) : (Math.random() < chance ? 1 : 0);
          const to = t.pos.clone(); to.y += 1.3; to.x += (Math.random() - 0.5) * (hits ? 0.3 : 2); to.z += (Math.random() - 0.5) * (hits ? 0.3 : 2);
          this.tracer(from, to); if (hits) this.hurt(t, g.dmg * hits * (t.isPlayer ? 0.8 : 1), u, Math.random() < 0.1); }
      }
    } else {
      const d = u.wp.clone().sub(u.pos); d.y = 0; if (d.length() > 0.5) { d.normalize(); mx = d.x; mz = d.z; u.yaw = Math.atan2(-d.x, -d.z); }
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
    pollKeys(); this.acc = (this.acc || 0) + fdt; let n = 0;
    while (this.acc >= TICK && n < 6) { this.acc -= TICK; this.tickNo = (this.tickNo || 0) + 1; this.tick(TICK, n === 0); n++; if (!this.running) break; }
    this.renderer.render(this.scene, this.camera); if (n) endFrame();
  }
  tick(dt, first) {
    if (!first) { input.look.x = input.look.y = 0; } const P = this.player, w = this.slots[this.slot];
    this.timeLeft -= dt; if (this.timeLeft <= 0 && !this.over) this.end();
    // input actions
    if (consume('Digit1')) this.selectSlot(0); if (consume('Digit2')) this.selectSlot(1); if (consume('Digit3', 'KeyV')) this.selectSlot(2);
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
    if (consume('KeyF', 'btn_enter')) this.toggleVehicle();
    if (P.alive && P.vehicle) { this.pilot(P.vehicle, dt); }
    else if (P.alive) {
      P.spawnProt = Math.max(0, (P.spawnProt || 0) - dt);
      const sp = 5.5 * (1 + this.save.stats.speed * 0.03) * (input.sprint && input.move.y > 0 && !input.ads ? 1.45 : 1) * (input.ads ? 0.6 : 1);
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      let mx = fx * input.move.y + rx * input.move.x, mz = fz * input.move.y + rz * input.move.x; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
      this.moveUnit(P, mx * sp * dt, mz * sp * dt, dt, input.jump);
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
    const lod = this.tier === 'low' ? 85 : 160; for (const u of this.units) if (u.mesh && u.alive) u.mesh.visible = u.pos.distanceTo(P.pos) < lod;
    // bots & respawns
    for (const u of this.units) {
      if (!u.alive) { u.respawn -= dt; if (u.respawn <= 0 && !this.over) this.spawn(u); continue; }
      if (!u.isPlayer) { u.spawnProt = Math.max(0, u.spawnProt - dt); this.botThink(u, dt); }
    }
    for (const tr of this.tracers) { tr.t -= dt; if (tr.t <= 0) { this.scene.remove(tr.l); tr.l.geometry.dispose(); } } this.tracers = this.tracers.filter(t => t.t > 0);
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.hudT = 0.2; this.hooks.hud(this); }
    if (first) input.pressed.clear();
  }
  toggleVehicle() {
    const P = this.player;
    if (P.vehicle) { const v = P.vehicle; v.seats.forEach(s => { if (s.unit === P) s.unit = null; }); P.vehicle = null;
      P.pos.set(v.pos.x + Math.cos(v.yaw) * 3, v.pos.y, v.pos.z - Math.sin(v.yaw) * 3); if (this.blocked(P.pos)) P.pos.set(v.pos.x, v.solid.max.y, v.pos.z);
      P.vy = 0; this.selectSlot(this.slot); this.hooks.toast('Exited vehicle'); this.hooks.hud(this); return; }
    const v = this.near; if (!v) return; const seat = v.seats.find(s => !s.unit); seat.unit = P; P.vehicle = v; P.pos.copy(v.pos); P.yaw = v.yaw; this.buildMode = null;
    this.hooks.toast(`${v.K.name}: ${v.K.weapons.map((w, i) => ['Fire', 'Aim/Alt', 'Edit/G'][i] + ' = ' + w.name).join(' · ')}`); this.hooks.hud(this);
  }
  pilot(v, dt) {
    const P = this.player, K = v.K;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    let mx, mz;
    if (v.kind === 'tank') { v.yaw -= input.move.x * K.turn * dt; const s = input.move.y * K.speed * dt; mx = -Math.sin(v.yaw) * s; mz = -Math.cos(v.yaw) * s; v.aimYaw = P.yaw - v.yaw; }
    else { v.yaw = P.yaw; mx = (fx * input.move.y + rx * input.move.x) * K.speed * dt; mz = (fz * input.move.y + rz * input.move.x) * K.speed * dt; }
    v.vy = v.vy || 0; this.moveUnit(v, mx, mz, dt, false); syncSolid(v); P.pos.copy(v.pos);
    const parts = v.mesh.userData.parts; v.mesh.position.copy(v.pos); v.mesh.rotation.y = v.yaw;
    if (parts.legs) { v.walk += Math.hypot(mx, mz) * 1.6; parts.legs[0].rotation.x = Math.sin(v.walk) * 0.5; parts.legs[1].rotation.x = -Math.sin(v.walk) * 0.5; parts.torso.rotation.x = P.pitch * 0.3; }
    if (parts.turret) { parts.turret.rotation.y = v.aimYaw; parts.barrel.rotation.x = Math.max(-0.1, P.pitch) * 0.5; }
    v.cd = v.cd.map(c => c - dt); K.weapons.forEach((w, i) => { if (w.regen && v.ammo[i] < w.ammoMax) v.ammo[i] = Math.min(w.ammoMax, v.ammo[i] + dt / w.regen); });
    const shoot = (i) => { const w = K.weapons[i]; if (v.cd[i] > 0) return; if (w.ammoMax && v.ammo[i] < 1) return; v.cd[i] = w.cd || 60 / w.rpm; if (w.ammoMax) v.ammo[i]--;
      if (w.key === 'stomp') { this.explode(v.pos, w.dmg, w.splash, P, true); this.hooks.toast('STOMP'); return; }
      this.aimRay(w.spread || 0.002); const h = this.firstHit(P); const muzzle = v.pos.clone(); muzzle.y += K.eye;
      const end = h ? h.point : this.camera.position.clone().addScaledVector(this.ray.ray.direction, 150); this.tracer(muzzle, end);
      if (h && h.distance < w.range * 1.5) { if (w.splash) this.explode(h.point, w.dmg, w.splash, P); else this.damageAt(h, w.dmg, P, h.object.userData.head); }
      this.recoilP += w.splash ? 0.03 : 0.003; };
    if (input.fire) shoot(0);
    if (input.ads) shoot(1);
    if (K.weapons[2] && consume('KeyG', 'btn_edit')) shoot(2);
  }
  explode(pt, dmg, r, src, ground) {
    const fx = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.7 }));
    fx.position.copy(pt); this.scene.add(fx); setTimeout(() => this.scene && this.scene.remove(fx), 180);
    for (const u of this.units) if (u.alive && u !== src) { const d = u.pos.distanceTo(pt); if (d < r) this.hurt(u, dmg * (1 - d / r * 0.6), src, false); }
    for (const v of this.vehicles) if (v.alive && v.team !== src.team) { const d = v.pos.distanceTo(pt); if (d < r + 1.5) this.hurtVehicle(v, dmg * 0.8, src); }
    for (const b of this.builds.slice()) { if (b.mesh.position.distanceTo(pt) < r + 1) { b.hp -= dmg * 1.5; if (b.hp <= 0) this.removeBuild(b); } }
  }
  hurtVehicle(v, dmg, src) {
    if (!v.alive || (src && src.team === v.team)) return; v.hp -= dmg; if (src?.isPlayer) this.hooks.hitmark(false);
    if (v.seats.some(s => s.unit === this.player)) this.hooks.hurt();
    if (v.hp <= 0) { v.alive = false; v.respawn = 30; v.mesh.visible = false; this.solids = this.solids.filter(s => s !== v.solid);
      for (const s of v.seats) if (s.unit) { const u = s.unit; s.unit = null; u.vehicle = null; u.hp = Math.min(u.hp, 50); if (u === this.player) { this.selectSlot(this.slot); this.hooks.toast(`${v.K.name} destroyed!`); } }
      this.explode(v.pos.clone().setY(v.pos.y + 1), 60, 5, src || v); if (src?.isPlayer) { this.stats.kills++; this.hooks.toast(`${v.K.name} destroyed +100 XP`); } }
    this.hooks.hud(this);
  }
  respawnVehicle(v) { v.alive = true; v.hp = v.K.hp; v.pos.set(v.home[0], 0, v.home[1]); v.yaw = v.team === 0 ? 0 : Math.PI; v.mesh.visible = true; v.mesh.position.copy(v.pos); v.mesh.rotation.y = v.yaw; syncSolid(v); this.solids.push(v.solid); }
  snapshot() { // network-ready state: what a server would broadcast each tick
    return { tick: this.tickNo, score: this.score, time: this.timeLeft, vehicles: this.vehicles.map(v => ({ id: v.id, kind: v.kind, x: v.pos.x, z: v.pos.z, yaw: v.yaw, hp: v.hp, seats: v.seats.map(s => s.unit?.id || 0) })),
      units: this.units.map(u => ({ id: u.id, team: u.team, x: u.pos.x, y: u.pos.y, z: u.pos.z, yaw: u.yaw, hp: u.hp, alive: u.alive })),
      builds: this.builds.map(b => ({ id: b.id, ...b.g, hp: b.hp })) };
  }
  end() {
    if (this.over) return; this.over = true; this.running = false; document.exitPointerLock?.();
    const won = this.score[0] > this.score[1], s = this.stats, big = this.map.type === 'large' ? 1.3 : 1;
    const xp = Math.round((s.kills * 100 + s.head * 50 + Math.round(s.dmg / 10) + s.builds * 2 + (won ? 500 : 150)) * big);
    const gp = Math.round((s.kills * 25 + s.head * 10 + (won ? 300 : 100)) * big);
    this.hooks.end({ won, xp, gp, stats: s, score: this.score.slice() });
  }
  dispose() { this.running = false; this.scene = null; }
}
