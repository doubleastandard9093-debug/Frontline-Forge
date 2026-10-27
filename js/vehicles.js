// General vehicle system: every vehicle has seats, an enter/exit control and per-kind weapons.
// v1 kinds: 'mech' (Bulwark walker) and 'tank' (Anvil tank). Aircraft/boat slot in by adding a KIND.
import * as THREE from 'three';
export const KINDS = {
  mech: { name: 'Bulwark Mech', hp: 900, speed: 3.2, turn: 0, seats: ['pilot'], camDist: 7, camH: 4.2, eye: 3.6,
    weapons: [ { name: 'Chaingun', dmg: 14, rpm: 900, spread: 0.03, auto: true, range: 120 },
               { name: 'Rocket Pod', dmg: 140, rpm: 50, splash: 5, range: 200, ammoMax: 6, regen: 2.5 },
               { name: 'Stomp', dmg: 120, cd: 4, splash: 4.5, key: 'stomp' } ] },
  tank: { name: 'Anvil Tank', hp: 1400, speed: 6.5, turn: 1.4, seats: ['driver'], camDist: 9, camH: 4.5, eye: 2.6,
    weapons: [ { name: 'Coax MG', dmg: 12, rpm: 700, spread: 0.02, auto: true, range: 110 },
               { name: 'Main Cannon', dmg: 220, rpm: 20, splash: 6, range: 250, ammoMax: 99, regen: 0 } ] },
};
export function buildVehicleMesh(kind, m, team) {
  const g = new THREE.Group(), armor = m(team === 0 ? 0x4a5a3a : 0x5a3a32, 'metal'), dark = m(0x2a2d31, 'metal'), glow = new THREE.MeshBasicMaterial({ color: 0x66e0ff });
  const box = (w, h, d, x, y, z, mt = armor, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  if (kind === 'mech') {
    const legs = [];
    for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * 0.9, 2.2, 0); g.add(leg);
      box(0.6, 1.4, 0.7, 0, -0.6, 0, dark, leg); box(0.55, 1.2, 0.6, 0, -1.6, 0.25, armor, leg); box(0.9, 0.3, 1.3, 0, -2.1, 0.1, dark, leg); legs.push(leg); }
    const torso = new THREE.Group(); torso.position.y = 2.9; g.add(torso);
    box(2.4, 1.4, 1.8, 0, 0, 0, armor, torso); box(1.2, 0.5, 0.2, 0, 0.25, -0.92, glow, torso); box(2.0, 0.4, 1.4, 0, 0.9, 0.1, dark, torso);
    const gun = box(0.35, 0.35, 1.8, 1.55, -0.1, -0.6, dark, torso); box(0.7, 0.6, 0.9, -1.6, 0.4, 0, armor, torso); box(0.5, 0.4, 0.2, -1.6, 0.4, -0.5, dark, torso);
    g.userData.parts = { legs, torso, gun };
  } else {
    box(3.2, 1.0, 5.2, 0, 0.8, 0); box(0.6, 0.8, 5.4, -1.6, 0.45, 0, dark); box(0.6, 0.8, 5.4, 1.6, 0.45, 0, dark);
    const turret = new THREE.Group(); turret.position.y = 1.6; g.add(turret); box(2.2, 0.8, 2.4, 0, 0, 0.2, armor, turret);
    const barrel = box(0.25, 0.25, 3.2, 0, 0.05, -2.4, dark, turret); box(0.5, 0.3, 0.2, 0.6, 0.2, -0.95, glow, turret);
    g.userData.parts = { turret, barrel };
  }
  return g;
}
export function createVehicle(game, kind, x, z, team, id) {
  const K = KINDS[kind], mesh = buildVehicleMesh(kind, (c, k) => game.m(c, k), team);
  const v = { id, kind, K, team, pos: new THREE.Vector3(x, 0, z), yaw: team === 0 ? 0 : Math.PI, aimYaw: 0, hp: K.hp, seats: K.seats.map(role => ({ role, unit: null })),
    mesh, alive: true, cd: [0, 0, 0], ammo: K.weapons.map(w => w.ammoMax || 0), walk: 0, home: [x, z] };
  mesh.position.copy(v.pos); game.scene.add(mesh);
  mesh.traverse(o => { if (o.isMesh) { o.userData = { kind: 'vehicle', vehicle: v }; game.hitMeshes.push(o); } });
  v.solid = { min: new THREE.Vector3(), max: new THREE.Vector3(), vehicle: v }; syncSolid(v); game.solids.push(v.solid);
  return v;
}
export function syncSolid(v) { const r = v.kind === 'mech' ? 1.3 : 2.4, h = v.kind === 'mech' ? 4 : 2.2; v.solid.min.set(v.pos.x - r, v.pos.y, v.pos.z - r); v.solid.max.set(v.pos.x + r, v.pos.y + h, v.pos.z + r); }
