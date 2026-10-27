// General vehicle system: every vehicle has seats (driver/pilot + optional gunner), one enter/exit
// control, a movement mode and per-kind weapons. All designs are original.
import * as THREE from 'three';
const MG = (dmg = 12, rpm = 750) => ({ name: 'Machine Gun', dmg, rpm, spread: 0.022, auto: true, range: 120 });
export const KINDS = {
  mech:  { name: 'Bulwark Mech', mode: 'walker', hp: 900, speed: 3.2, seats: ['pilot'], camDist: 7, camH: 4.2, eye: 3.6, r: 1.3, h: 4,
    weapons: [ { name: 'Chaingun', dmg: 14, rpm: 900, spread: 0.03, auto: true, range: 120 }, { name: 'Rocket Pod', dmg: 140, rpm: 50, splash: 5, range: 200, ammoMax: 6, regen: 2.5 }, { name: 'Stomp', dmg: 120, cd: 4, splash: 4.5, key: 'stomp' } ] },
  tank:  { name: 'Anvil Tank', mode: 'tracked', hp: 1400, speed: 6.5, turn: 1.4, seats: ['driver'], camDist: 9, camH: 4.5, eye: 2.6, r: 2.4, h: 2.2,
    weapons: [ MG(12, 700), { name: 'Main Cannon', dmg: 220, rpm: 20, splash: 6, range: 250, ammoMax: 99 } ] },
  buggy: { name: 'Jackal Buggy', mode: 'car', hp: 450, speed: 17, turn: 2.2, seats: ['driver', 'gunner'], camDist: 7, camH: 3.2, eye: 2.2, r: 1.6, h: 1.8,
    weapons: [ MG(13, 800) ] }, // driver has no gun; gunner seat fires the turret (bots fill it)
  boat:  { name: 'Riptide Boat', mode: 'boat', hp: 600, speed: 14, turn: 1.6, seats: ['driver', 'gunner'], camDist: 9, camH: 3.6, eye: 2.0, r: 2.0, h: 1.8,
    weapons: [ MG(14, 700), { name: 'Rocket Launcher', dmg: 150, rpm: 40, splash: 5, range: 200, ammoMax: 4, regen: 3 } ] },
  heli:  { name: 'Hornet Gunship', mode: 'heli', hp: 700, speed: 16, seats: ['pilot', 'gunner'], camDist: 11, camH: 3, eye: 0.5, r: 2.2, h: 2.4, ceiling: 70,
    weapons: [ MG(13, 900), { name: 'Rocket Pods', dmg: 120, rpm: 120, splash: 4.5, range: 220, ammoMax: 8, regen: 1.5 } ] },
  jet:   { name: 'Skylance Jet', mode: 'jet', hp: 550, speed: 45, minSpeed: 16, seats: ['pilot'], camDist: 14, camH: 3, eye: 0, r: 2.5, h: 1.5, ceiling: 120,
    weapons: [ { name: 'Cannon', dmg: 18, rpm: 1100, spread: 0.012, auto: true, range: 220 }, { name: 'Missiles', dmg: 200, rpm: 30, splash: 6, range: 300, ammoMax: 4, regen: 4 } ] },
};
export function buildVehicleMesh(kind, m, team) {
  const g = new THREE.Group(), armor = m(team === 0 ? 0x5a6e48 : 0x7a4a3c, 'metal'), dark = m(0x30343a, 'metal'), glow = new THREE.MeshBasicMaterial({ color: team === 0 ? 0x66e0ff : 0xff9a50 });
  const box = (w, h, d, x, y, z, mt = armor, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const parts = {};
  if (kind === 'mech') {
    parts.legs = [];
    for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * 0.9, 2.2, 0); g.add(leg);
      box(0.6, 1.4, 0.7, 0, -0.6, 0, dark, leg); box(0.55, 1.2, 0.6, 0, -1.6, 0.25, armor, leg); box(0.9, 0.3, 1.3, 0, -2.1, 0.1, dark, leg); parts.legs.push(leg); }
    const torso = parts.torso = new THREE.Group(); torso.position.y = 2.9; g.add(torso);
    box(2.4, 1.4, 1.8, 0, 0, 0, armor, torso); box(1.2, 0.5, 0.2, 0, 0.25, -0.92, glow, torso); box(2.0, 0.4, 1.4, 0, 0.9, 0.1, dark, torso);
    parts.gun = box(0.35, 0.35, 1.8, 1.55, -0.1, -0.6, dark, torso); box(0.7, 0.6, 0.9, -1.6, 0.4, 0, armor, torso); box(0.5, 0.4, 0.2, -1.6, 0.4, -0.5, dark, torso);
    for (const s of [-1, 1]) box(0.3, 0.6, 0.3, s * 0.7, 1.1, 0.6, dark, torso); // exhaust stacks
  } else if (kind === 'tank') {
    box(3.2, 1.0, 5.2, 0, 0.8, 0); box(0.6, 0.8, 5.4, -1.6, 0.45, 0, dark); box(0.6, 0.8, 5.4, 1.6, 0.45, 0, dark);
    const turret = parts.turret = new THREE.Group(); turret.position.y = 1.6; g.add(turret); box(2.2, 0.8, 2.4, 0, 0, 0.2, armor, turret);
    parts.barrel = box(0.25, 0.25, 3.2, 0, 0.05, -2.4, dark, turret); box(0.5, 0.3, 0.2, 0.6, 0.2, -0.95, glow, turret);
  } else if (kind === 'buggy') {
    box(1.8, 0.4, 3.4, 0, 0.7, 0); box(1.6, 0.6, 1.0, 0, 1.1, 0.9, armor); box(1.7, 0.08, 0.08, 0, 1.9, -0.2, dark); box(0.08, 0.9, 0.08, -0.8, 1.45, -0.2, dark); box(0.08, 0.9, 0.08, 0.8, 1.45, -0.2, dark);
    for (const [x, z] of [[-1, -1.2], [1, -1.2], [-1, 1.2], [1, 1.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w); }
    const turret = parts.turret = new THREE.Group(); turret.position.set(0, 2.0, 0.9); g.add(turret); box(0.5, 0.4, 0.5, 0, 0, 0, dark, turret); parts.barrel = box(0.12, 0.12, 1.2, 0, 0.05, -0.7, dark, turret);
    box(1.4, 0.1, 0.1, 0, 0.75, -1.75, glow);
  } else if (kind === 'boat') {
    box(2.6, 0.9, 6, 0, 0.3, 0); box(1.6, 0.9, 1.4, 0, 0.9, -2.8, armor); box(2.0, 0.9, 1.6, 0, 1.2, 0.6, dark); box(1.8, 0.1, 0.1, 0, 1.0, -3.4, glow);
    const turret = parts.turret = new THREE.Group(); turret.position.set(0, 1.9, -1.6); g.add(turret); box(0.5, 0.4, 0.5, 0, 0, 0, dark, turret); parts.barrel = box(0.12, 0.12, 1.3, 0, 0.05, -0.7, dark, turret);
  } else if (kind === 'heli') {
    box(1.8, 1.6, 3.6, 0, 0, 0); box(1.4, 0.9, 0.2, 0, 0.2, -1.85, glow); box(0.4, 0.4, 4, 0, 0.3, 3.6, armor); box(0.1, 1.2, 0.8, 0, 0.8, 5.4, dark);
    box(0.2, 0.2, 2.6, -0.9, -1.0, 0, dark); box(0.2, 0.2, 2.6, 0.9, -1.0, 0, dark); box(2.6, 0.12, 0.5, 0, -0.2, 0.3, dark);
    parts.rotor = new THREE.Group(); parts.rotor.position.y = 1.0; g.add(parts.rotor); box(9, 0.06, 0.3, 0, 0, 0, dark, parts.rotor); box(0.3, 0.06, 9, 0, 0, 0, dark, parts.rotor);
  } else if (kind === 'jet') {
    box(1.2, 0.9, 7, 0, 0, 0); box(0.7, 0.5, 1.4, 0, 0.55, -1.6, glow); box(7, 0.12, 2.0, 0, 0, 0.6, armor); box(2.8, 0.1, 1.0, 0, 0.1, 3.2, armor); box(0.12, 1.4, 1.2, 0, 0.8, 3.0, dark);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 6), armor); nose.rotation.x = -Math.PI / 2; nose.position.z = -4.3; g.add(nose);
    box(0.8, 0.6, 0.4, 0, 0, 3.6, glow);
  }
  g.userData.parts = parts; return g;
}
export function createVehicle(game, kind, x, z, team, id) {
  const K = KINDS[kind], mesh = buildVehicleMesh(kind, game.hf ? game.hf.vmat : (c, k) => game.m(c, k), team); if (game.hf) game.hf.detailVehicle(kind, mesh, team);
  const v = { id, kind, K, team, pos: new THREE.Vector3(x, kind === 'jet' ? 0.8 : kind === 'heli' ? 1.2 : 0, z), vy: 0, yaw: team === 0 ? 0 : Math.PI, pitch: 0, roll: 0, aimYaw: 0, aimPitch: 0,
    speed: 0, hp: K.hp, seats: K.seats.map(role => ({ role, unit: null })), mesh, alive: true, cd: [0, 0, 0], ammo: K.weapons.map(w => w.ammoMax || 0), walk: 0, home: [x, z] };
  mesh.position.copy(v.pos); game.scene.add(mesh);
  mesh.traverse(o => { if (o.isMesh) { o.userData = { kind: 'vehicle', vehicle: v }; game.hitMeshes.push(o); } });
  v.solid = { min: new THREE.Vector3(), max: new THREE.Vector3(), vehicle: v }; syncSolid(v); game.solids.push(v.solid);
  return v;
}
export function syncSolid(v) { const r = v.K.r, h = v.K.h, y = v.K.mode === 'heli' || v.K.mode === 'jet' ? v.pos.y - h / 2 : v.pos.y; v.solid.min.set(v.pos.x - r, y, v.pos.z - r); v.solid.max.set(v.pos.x + r, y + h, v.pos.z + r); }
