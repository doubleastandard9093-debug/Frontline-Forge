// High-only realism pack. main.js imports this file ONLY when the graphics tier is High,
// so Low never downloads, parses or builds any of it. Every texture here is generated
// procedurally at runtime (self-made, no third-party assets).
import * as THREE from 'three';
import { isPhone } from './gfx.js';

const TEX = isPhone ? 256 : 512;
const cache = {};
let envTex = null;

// ---------- procedural PBR texture sets (albedo + normal + roughness) ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function noiseField(n, seed, octaves = 5) { // tileable value noise, 0..1
  const r = rng(seed), out = new Float32Array(n * n);
  for (let o = 0; o < octaves; o++) { const cells = 4 << o, amp = 1 / (1 << o), grid = [];
    for (let i = 0; i < cells * cells; i++) grid.push(r());
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const fx = x / n * cells, fy = y / n * cells, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), g = (a, b) => grid[(b % cells) * cells + (a % cells)];
      out[y * n + x] += amp * ((g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy); } }
  let mn = 1e9, mx = -1e9; for (const v of out) { mn = Math.min(mn, v); mx = Math.max(mx, v); } for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn); return out;
}
function toTex(px, n, srgb) { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), id = g.createImageData(n, n); id.data.set(px); g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = isPhone ? 2 : 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
// recipe(x, y, n, h) -> { c: [r,g,b], h: height 0..1, r: roughness 0..1 }
function makeSet(key, recipe, seed, bump = 2.5) {
  if (cache[key]) return cache[key];
  const n = TEX, h = noiseField(n, seed), alb = new Uint8ClampedArray(n * n * 4), rough = new Uint8ClampedArray(n * n * 4), hh = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * n + x, s = recipe(x, y, n, h[i]); hh[i] = s.h;
    alb.set([s.c[0], s.c[1], s.c[2], 255], i * 4); const rv = s.r * 255; rough.set([rv, rv, rv, 255], i * 4); }
  const nrm = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const H = (a, b) => hh[((b + n) % n) * n + ((a + n) % n)];
    const dx = (H(x + 1, y) - H(x - 1, y)) * bump, dy = (H(x, y + 1) - H(x, y - 1)) * bump, l = Math.hypot(dx, dy, 1);
    nrm.set([(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], (y * n + x) * 4); }
  return (cache[key] = { map: toTex(alb, n, true), normalMap: toTex(nrm, n, false), roughnessMap: toTex(rough, n, false) });
}
const mix = (a, b, t) => a + (b - a) * t, clamp = v => Math.max(0, Math.min(1, v));
export const SETS = {
  concrete: () => makeSet('concrete', (x, y, n, h) => { const pit = h > 0.82 ? 0.25 : 0, seam = (y % (n / 2) < 2 || x % (n / 2) < 2) ? 0.35 : 0; const v = 150 + (h - 0.5) * 50 - seam * 120 - pit * 60;
    return { c: [v, v * 0.99, v * 0.95], h: h * 0.4 - seam - pit, r: clamp(0.82 + h * 0.15 - seam * 0.2) }; }, 11, 3),
  metal: () => makeSet('metal', (x, y, n, h) => { const brush = Math.sin(y * 0.9 + h * 6) * 0.04, panel = (x % (n / 2) < 2 || y % (n / 2) < 2) ? 1 : 0, rivet = ((x % (n / 2) - 10) ** 2 + (y % (n / 4) - 10) ** 2 < 9) ? 1 : 0;
    const v = 120 + (h - 0.5) * 40 + brush * 200 - panel * 60 + rivet * 30; return { c: [v * 0.92, v * 0.96, v], h: h * 0.15 - panel * 0.6 + rivet * 0.8 + brush, r: clamp(0.35 + h * 0.3 + panel * 0.2) }; }, 23, 4),
  paint: () => makeSet('paint', (x, y, n, h) => { const panel = (x % (n / 2) < 2 || y % (n / 3 | 0) < 2) ? 1 : 0, chip = h > 0.86 ? 1 : 0, dirt = clamp((y / n) * 0.6 + h * 0.4 - 0.55);
    const v = 235 - dirt * 90 - panel * 120; const c = chip ? [120, 120, 118] : [v, v, v]; return { c, h: -panel * 0.7 - chip * 0.3 + h * 0.05, r: clamp(0.45 + dirt * 0.4 + chip * 0.3) }; }, 37, 4),
  wood: () => makeSet('wood', (x, y, n, h) => { const plank = (y % (n / 4)) < 2 ? 1 : 0, grain = Math.sin(x * 0.08 + h * 14) * 0.5 + 0.5, v = 0.75 + grain * 0.25 - plank * 0.5;
    return { c: [150 * v, 104 * v, 60 * v], h: grain * 0.3 - plank, r: clamp(0.75 + grain * 0.1) }; }, 41, 3),
  fabric: () => makeSet('fabric', (x, y, n, h) => { const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.08 : -0.08, v = 200 + weave * 200 + (h - 0.5) * 50; return { c: [v, v, v], h: weave + h * 0.2, r: 0.95 }; }, 53, 2),
  armor: () => makeSet('armor', (x, y, n, h) => { const scratch = h > 0.78 && (x + y) % 9 < 2 ? 1 : 0, edge = (y % (n / 2) < 3) ? 1 : 0, v = 225 - edge * 80 + scratch * 25 + (h - 0.5) * 30;
    return { c: [v, v, v], h: -edge * 0.5 + h * 0.1 - scratch * 0.2, r: clamp(0.4 + h * 0.2 - scratch * 0.2) }; }, 67, 3),
};
// PBR material: tint multiplies a neutral albedo so one texture set serves every team color.
export function pbr(kind, color, o = {}) {
  const s = SETS[kind](); const m = new (o.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ color, map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: o.roughness ?? 1, metalness: o.metalness ?? 0, envMapIntensity: o.env ?? 1 });
  if (o.clearcoat) { m.clearcoat = o.clearcoat; m.clearcoatRoughness = 0.35; }
  if (o.repeat) { for (const k of ['map', 'normalMap', 'roughnessMap']) { m[k] = m[k].clone(); m[k].needsUpdate = true; m[k].repeat.set(o.repeat[0], o.repeat[1]); } }
  if (o.normalScale) m.normalScale.setScalar(o.normalScale);
  return m;
}

// ---------- environment map (fixes dark metal: metals need something to reflect) ----------
export function init(game) {
  if (!envTex) { const pm = new THREE.PMREMGenerator(game.renderer), sc = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(.36,.55,.85), hor = vec3(.85,.88,.9), gnd = vec3(.28,.26,.22); vec3 c = h > 0. ? mix(hor, top, pow(h,.6)) : mix(hor, gnd, pow(-h,.4)); float sun = pow(max(dot(vP, normalize(vec3(.45,.8,.35))),0.), 600.); gl_FragColor = vec4(c + sun*20., 1.); }' }));
    sc.add(sky); envTex = pm.fromScene(sc, 0.02).texture; pm.dispose(); }
  game.scene.environment = envTex;
}

// ---------- characters: armored soldier with a jointed rig and reflective visor ----------
const G = {}; // shared geometries
function geo() { if (G.torso) return G;
  G.torso = new THREE.CapsuleGeometry(0.27, 0.42, 6, 12); G.plate = new THREE.BoxGeometry(0.5, 0.42, 0.12, 2, 2, 1); G.pelvis = new THREE.BoxGeometry(0.46, 0.22, 0.28);
  G.thigh = new THREE.CapsuleGeometry(0.1, 0.28, 4, 8); G.shin = new THREE.CapsuleGeometry(0.085, 0.3, 4, 8); G.knee = new THREE.SphereGeometry(0.065, 10, 8); G.boot = new THREE.BoxGeometry(0.16, 0.12, 0.3);
  G.upper = new THREE.CapsuleGeometry(0.075, 0.22, 4, 8); G.fore = new THREE.CapsuleGeometry(0.065, 0.22, 4, 8); G.pad = new THREE.SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); G.glove = new THREE.SphereGeometry(0.07, 8, 6);
  G.head = new THREE.SphereGeometry(0.15, 16, 12); G.helm = new THREE.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62); G.visor = new THREE.SphereGeometry(0.212, 20, 10, Math.PI * 1.2, Math.PI * 0.6, Math.PI * 0.36, Math.PI * 0.2);
  G.pack = new THREE.BoxGeometry(0.38, 0.45, 0.18); G.pouch = new THREE.BoxGeometry(0.1, 0.12, 0.07); G.ant = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4);
  G.rRecv = new THREE.BoxGeometry(0.07, 0.11, 0.42); G.rBar = new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8); G.rMag = new THREE.BoxGeometry(0.05, 0.16, 0.08); G.rStock = new THREE.BoxGeometry(0.05, 0.1, 0.2); G.rSight = new THREE.BoxGeometry(0.04, 0.05, 0.1);
  return G; }
const M = {};
function mats(team) { const k = 't' + team; if (M[k]) return M[k];
  const paint = team === 0 ? 0x4a78b8 : 0xb8503a;
  return (M[k] = { armor: pbr('armor', paint, { physical: true, clearcoat: 0.4, roughness: 1 }), suit: pbr('fabric', 0x3a3d36, { normalScale: 0.6 }), dark: pbr('metal', 0x2c3036, { metalness: 0.7, roughness: 0.9 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb98c6c, roughness: 0.7 }), helm: pbr('armor', team === 0 ? 0x2d4f80 : 0x7a2e20, { physical: true, clearcoat: 0.6 }),
    visor: new THREE.MeshPhysicalMaterial({ color: team === 0 ? 0xffc65a : 0x7fe3ff, metalness: 1, roughness: 0.08, clearcoat: 1, emissive: team === 0 ? 0x3a2600 : 0x00303a, envMapIntensity: 1.6 }),
    gun: pbr('metal', 0x26282b, { metalness: 0.8, roughness: 0.8 }), glow: new THREE.MeshBasicMaterial({ color: team === 0 ? 0x66e0ff : 0xff9a50 }) }); }
const mk = (g, m, x, y, z, parent, opt = {}) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); if (opt.rx) o.rotation.x = opt.rx; if (opt.rz) o.rotation.z = opt.rz; o.castShadow = true; o.userData = { hit: !!opt.hit, head: !!opt.head, armor: !!opt.armor }; parent.add(o); return o; };
// Children 0..4 keep the Low layout's roles (body, legs, head, helm, gun) so zombies/other code keep working.
export function soldier(team) {
  const g = geo(), m = mats(team), root = new THREE.Group();
  const body = mk(g.torso, m.suit, 0, 1.22, 0, root, { hit: true });
  const legs = mk(g.pelvis, m.suit, 0, 0.88, 0, root, { hit: true });
  const head = mk(g.head, m.skin, 0, 1.72, 0, root, { hit: true, head: true });
  const helm = mk(g.helm, m.helm, 0, 1.74, 0.01, root, { hit: true, head: true, armor: true });
  const gun = new THREE.Mesh(g.rRecv, m.gun); gun.position.set(0.18, 1.3, -0.38); gun.castShadow = true; gun.userData = { hit: true }; root.add(gun);
  mk(g.rBar, m.gun, 0, 0.01, -0.36, gun, { rx: Math.PI / 2 }); mk(g.rMag, m.dark, 0, -0.12, -0.06, gun, { rx: 0.2 }); mk(g.rStock, m.gun, 0, -0.02, 0.3, gun); mk(g.rSight, m.dark, 0, 0.08, -0.05, gun);
  mk(g.visor, m.visor, 0, 1.73, 0.0, root, { head: true, armor: true });
  mk(g.plate, m.armor, 0, 1.3, -0.24, root, { armor: true }); mk(g.plate, m.armor, 0, 1.3, 0.22, root, { armor: true }).scale.set(0.9, 0.95, 0.8);
  mk(g.pack, m.dark, 0, 1.28, 0.34, root, { armor: true }); mk(g.ant, m.dark, 0.14, 1.65, 0.38, root, { armor: true });
  for (const x of [-0.14, 0, 0.14]) mk(g.pouch, m.suit, x, 0.98, -0.2, root, { armor: true });
  mk(new THREE.BoxGeometry(0.08, 0.03, 0.02), m.glow, -0.12, 1.42, -0.31, root, { armor: true });
  const limbs = {};
  for (const s of [-1, 1]) { // legs: hip pivot -> thigh -> knee pivot -> shin -> boot
    const hip = new THREE.Group(); hip.position.set(s * 0.13, 0.86, 0); root.add(hip); mk(g.thigh, m.suit, 0, -0.2, 0, hip, { hit: true }); mk(g.pad, m.armor, 0, -0.08, -0.08, hip, { rx: -Math.PI / 2, armor: true }).scale.set(0.8, 1, 1.2);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee); mk(g.knee, m.armor, 0, 0, -0.06, knee, { armor: true }); mk(g.shin, m.suit, 0, -0.2, 0, knee, { hit: true }); mk(g.boot, m.dark, 0, -0.4, -0.05, knee);
    const sh = new THREE.Group(); sh.position.set(s * 0.34, 1.5, 0); root.add(sh); mk(g.pad, m.armor, 0, 0.02, 0, sh, { armor: true }); mk(g.upper, m.suit, 0, -0.16, 0, sh, { hit: true, armor: true });
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el); mk(g.fore, m.suit, 0, -0.14, 0, el, { armor: true }); mk(g.glove, m.dark, 0, -0.3, 0, el, { armor: true });
    limbs[s < 0 ? 'L' : 'R'] = { hip, knee, sh, el }; }
  // rifle-holding pose
  limbs.R.sh.rotation.set(-0.9, 0, -0.15); limbs.R.el.rotation.x = -0.6; limbs.L.sh.rotation.set(-1.2, 0, 0.45); limbs.L.el.rotation.x = -0.5;
  root.userData.rig = { limbs, phase: Math.random() * 6, last: new THREE.Vector3(), body, base: body.position.y };
  return root;
}
export function zombify(root) { root.traverse(o => { if (o.userData.armor) o.visible = false; }); }
// Procedural walk/run cycle driven by actual ground speed (works for bots and zombies).
export function animate(u, dt) {
  const rig = u.mesh.userData.rig; if (!rig || dt <= 0) return; const p = u.mesh.position, sp = Math.hypot(p.x - rig.last.x, p.z - rig.last.z) / dt; rig.last.copy(p);
  const w = Math.min(sp / 5, 1.3); rig.phase += dt * (4 + sp * 1.6); const s = Math.sin(rig.phase), c = Math.cos(rig.phase), L = rig.limbs.L, R = rig.limbs.R;
  L.hip.rotation.x = s * 0.7 * w; R.hip.rotation.x = -s * 0.7 * w; L.knee.rotation.x = Math.max(0, -c) * 1.0 * w; R.knee.rotation.x = Math.max(0, c) * 1.0 * w;
  rig.body.position.y = rig.base + Math.abs(s) * 0.04 * w; if (u.zombie) { L.hip.rotation.x *= 0.6; R.hip.rotation.x *= 0.6; }
}
