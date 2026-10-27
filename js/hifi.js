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
    const v = 205 - dirt * 80 - panel * 110; const c = chip ? [120, 120, 118] : [v, v, v]; return { c, h: -panel * 0.7 - chip * 0.3 + h * 0.05, r: clamp(0.45 + dirt * 0.4 + chip * 0.3) }; }, 37, 4),
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

// ---------- buildings: world-scaled PBR, trim, decals ----------
// Re-map a BoxGeometry's UVs so textures keep real-world scale (one tile = `tile` meters) on every face.
export function worldUV(geo, w, h, d, tile = 3) {
  const uv = geo.attributes.uv, nrm = geo.attributes.normal, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), x = pos.getX(i) + w / 2, y = pos.getY(i) + h / 2, z = pos.getZ(i) + d / 2;
    if (nx > 0.5) uv.setXY(i, z / tile, y / tile); else if (ny > 0.5) uv.setXY(i, x / tile, z / tile); else uv.setXY(i, x / tile, y / tile); }
  uv.needsUpdate = true; return geo;
}
const BMAT = {};
function bmat(kind, color) { const k = kind + color; if (BMAT[k]) return BMAT[k];
  const set = { concrete: 'concrete', metal: 'metal', wood: 'wood' }[kind] || 'concrete';
  return (BMAT[k] = pbr(set, new THREE.Color(color).lerp(new THREE.Color(0xffffff), set === 'metal' ? 0.45 : 0.25), { metalness: set === 'metal' ? 0.45 : 0, roughness: 1, env: set === 'metal' ? 1.4 : 1, normalScale: set === 'wood' ? 1.2 : 1 })); }
let grimeTex = null, signTex = null;
function grime() { if (grimeTex) return grimeTex; const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(30,25,18,0)'); gr.addColorStop(0.7, 'rgba(30,25,18,.25)'); gr.addColorStop(1, 'rgba(25,20,12,.6)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(20,16,10,${Math.random() * 0.25})`; g.fillRect(Math.random() * 64, Math.random() * 120, 1 + Math.random() * 2, 30 + Math.random() * 90); } // rain streaks
  grimeTex = new THREE.CanvasTexture(c); grimeTex.colorSpace = THREE.SRGBColorSpace; grimeTex.wrapS = THREE.RepeatWrapping; return grimeTex; }
function sign() { if (signTex) return signTex; const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#d8b13a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#1b1b1b'; for (let x = -128; x < 256; x += 36) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 18, 128); g.lineTo(x + 146, 0); g.lineTo(x + 128, 0); g.fill(); }
  g.fillStyle = '#1b1b1b'; g.fillRect(36, 34, 184, 60); g.fillStyle = '#e8e2d0'; g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.fillText('FF-07', 128, 78);
  signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace; return signTex; }
let trimM = null, grimeM = null, signM = null;
export function building(x, z, w, d, h, color, kind) {
  const geo = worldUV(new THREE.BoxGeometry(w, h, d), w, h, d, kind === 'wood' ? 2 : 3), mesh = new THREE.Mesh(geo, bmat(kind, color));
  mesh.position.set(x, h / 2, z); mesh.castShadow = mesh.receiveShadow = true;
  trimM = trimM || pbr('metal', 0x5a5e62, { metalness: 0.8, roughness: 0.8 });
  grimeM = grimeM || new THREE.MeshStandardMaterial({ map: grime(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  signM = signM || new THREE.MeshStandardMaterial({ map: sign(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const extras = [];
  if (h > 1.2 && kind !== 'wood') { // roof coping + base plinth
    const cap = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16), w + 0.16, 0.14, d + 0.16), bmat('concrete', 0x6f6c66)); cap.position.set(x, h + 0.07, z); extras.push(cap);
    const base = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w + 0.08, 0.3, d + 0.08), w + 0.08, 0.3, d + 0.08), bmat('concrete', 0x77736b)); base.position.set(x, 0.15, z); extras.push(base); }
  if (kind === 'wood' && h > 1) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), trimM); post.position.set(x + sx * (w / 2 - 0.02), h / 2, z + sz * (d / 2 - 0.02)); extras.push(post); }
  if (h > 1.5 && !isPhone) for (const [nx, nz, len] of [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]]) { // grime/streak decals on each face
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, h), grimeM); p.position.set(x + nx * (w / 2 + 0.01), h / 2, z + nz * (d / 2 + 0.01)); p.rotation.y = Math.atan2(nx, nz); p.material.map.repeat.x = 1; extras.push(p); }
  if (h > 2.5 && w > 3 && ((x * 7 + z * 13) & 3) === 0) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), signM); s.position.set(x, Math.min(h - 0.8, 2.2), z + d / 2 + 0.02); extras.push(s); }
  for (const e of extras) { e.castShadow = e.geometry.type === 'BoxGeometry'; e.receiveShadow = true; }
  return { mesh, extras };
}

// ---------- vehicles: PBR paint + real metal, extra detail, damage states ----------
const VM = {};
// Drop-in for game.m inside buildVehicleMesh: 'metal' at the team colors = painted armor, dark = bare metal.
export function vmat(color, kind) { const k = color + ':' + kind; if (VM[k]) return VM[k];
  const dark = color === 0x30343a;
  return (VM[k] = dark ? pbr('metal', 0x8a9099, { metalness: 0.85, roughness: 1, env: 1.3 }) : pbr('paint', color, { physical: true, clearcoat: 0.5, metalness: 0.25, roughness: 1, env: 1.1 })); }
let lightM = null, rubberM = null;
export function detailVehicle(kind, g, team) {
  const P = g.userData.parts, dark = vmat(0x30343a, 'metal');
  lightM = lightM || new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff0c0, emissiveIntensity: 1.5, roughness: 0.2 });
  rubberM = rubberM || new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });
  const add = (geo, m, x, y, z, parent = g, rot) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (rot) o.rotation.set(rot[0], rot[1], rot[2]); o.castShadow = true; parent.add(o); return o; };
  const cyl = (r, l, s = 10) => new THREE.CylinderGeometry(r, r, l, s), box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  if (kind === 'tank') {
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) add(cyl(0.36, 0.3, 12), rubberM, s * 1.6, 0.42, -2.1 + i * 0.84, g, [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) add(box(0.7, 0.06, 5.5), dark, s * 1.6, 0.88, 0); // track guards
    add(cyl(0.34, 0.6, 12), dark, 0, 0.05, -3.9, P.turret, [Math.PI / 2, 0, 0]); // muzzle brake
    add(box(0.6, 0.3, 0.5), dark, -0.7, 0.55, 0.6, P.turret); add(cyl(0.01, 1.4, 4), dark, -0.8, 1.2, 1.0, P.turret);
    for (const s of [-1, 1]) add(box(0.2, 0.12, 0.08), lightM, s * 1.1, 0.95, -2.62);
    add(box(1.6, 0.4, 0.6), dark, 0, 1.1, 2.4); // engine deck
  } else if (kind === 'buggy') {
    for (const s of [-1, 1]) { add(box(0.2, 0.1, 0.05), lightM, s * 0.6, 0.85, -1.72); add(box(0.08, 0.5, 0.08), dark, s * 0.85, 1.2, 1.4); }
    add(box(1.7, 0.08, 0.08), dark, 0, 1.45, 1.4); add(box(1.8, 0.25, 0.4), dark, 0, 0.6, -1.8); // roll bar + bumper
    add(cyl(0.06, 0.6, 8), dark, 0.7, 0.9, 1.75, g, [Math.PI / 2, 0, 0]);
  } else if (kind === 'mech') {
    for (const s of [-1, 1]) { add(cyl(0.07, 1.2, 8), dark, s * 1.25, 2.2, -0.35, g, [0.2, 0, 0]); add(box(0.4, 0.18, 0.06), lightM, s * 0.45, 2.85, -0.95); }
    add(cyl(0.12, 0.5, 10), dark, 1.55, -0.1, -1.6, P.torso, [Math.PI / 2, 0, 0]);
  } else if (kind === 'boat') {
    add(box(2.7, 0.15, 6.1), rubberM, 0, -0.05, 0); add(box(0.25, 0.1, 0.05), lightM, 0, 1.4, -3.5); add(cyl(0.02, 1.6, 4), dark, 0.6, 2.3, 0.8);
  } else if (kind === 'heli') {
    add(cyl(0.25, 0.4, 10), dark, 0, 0.85, 0); add(box(0.5, 0.5, 1.2), dark, 0, 0.6, 1.4); add(box(0.15, 0.08, 0.05), lightM, 0, -0.5, -1.86);
    for (const s of [-1, 1]) add(cyl(0.18, 1.0, 8), dark, s * 1.3, -0.2, 0.3, g, [Math.PI / 2, 0, 0]); // rocket pods
  } else if (kind === 'jet') {
    for (const s of [-1, 1]) { add(cyl(0.12, 1.4, 8), dark, s * 2.2, -0.2, 0.4, g, [Math.PI / 2, 0, 0]); add(box(0.4, 0.5, 2.2), vmat(team === 0 ? 0x5a6e48 : 0x7a4a3c, 'metal'), s * 0.75, 0, 1.0); }
    add(cyl(0.45, 0.6, 12), dark, 0, 0, 3.75, g, [Math.PI / 2, 0, 0]);
  }
}
// damage: smoke under 60% hp, fire under 30%, scorched paint; pooled sprites, capped on phones.
let fxTex = null; const puffs = []; const MAXP = isPhone ? 24 : 80;
function puffTex() { if (fxTex) return fxTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (fxTex = new THREE.CanvasTexture(c)); }
function puff(scene, pos, fire) { let p = puffs.find(q => q.life <= 0);
  if (!p) { if (puffs.length >= MAXP) return; p = { s: new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), transparent: true, depthWrite: false })), life: 0 }; puffs.push(p); }
  if (p.s.parent !== scene) scene.add(p.s); p.fire = fire; p.life = p.max = fire ? 0.6 : 2.2; p.s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)); p.s.visible = true;
  p.s.material.color.set(fire ? 0xffa040 : 0x3a3a3a); p.s.material.blending = fire ? THREE.AdditiveBlending : THREE.NormalBlending; }
export function vehicleFx(game, dt) {
  for (const v of game.vehicles) { const f = v.alive ? v.hp / v.K.hp : 1, st = f < 0.3 ? 2 : f < 0.6 ? 1 : 0;
    if (st !== (v.dmgState || 0)) { v.dmgState = st; v.mesh.traverse(o => { if (!o.isMesh || !o.material.isMeshStandardMaterial) return; if (!o.userData.m0) o.userData.m0 = o.material;
      if (st === 2) { const m = o.userData.m0.clone(); m.color.multiplyScalar(0.45); m.roughness = 1; if (m.clearcoat) m.clearcoat = 0; o.material = m; } else o.material = o.userData.m0; }); }
    if (!v.alive || !st) continue; v.fxT = (v.fxT || 0) - dt; if (v.fxT > 0) continue; v.fxT = st === 2 ? 0.08 : 0.2;
    const top = v.pos.clone(); top.y += v.K.h * 0.9; puff(game.scene, top, false); if (st === 2) puff(game.scene, top, true); }
  for (const p of puffs) { if (p.life <= 0) continue; p.life -= dt; const t = 1 - p.life / p.max; p.s.position.y += dt * (p.fire ? 2.5 : 1.6); p.s.scale.setScalar((p.fire ? 0.8 : 1.2) + t * (p.fire ? 0.6 : 3));
    p.s.material.opacity = (p.fire ? 0.9 : 0.55) * (1 - t); if (p.life <= 0) p.s.visible = false; }
}

// ---------- environment: blended terrain, wind grass, layered foliage, sky, fog, water, sun-following shadows ----------
SETS.ground = () => makeSet('ground', (x, y, n, h) => { const blade = Math.sin(x * 1.7 + h * 9) * Math.cos(y * 1.3) * 0.5 + 0.5, v = 0.75 + blade * 0.25;
  return { c: [180 * v, 180 * v, 180 * v], h: blade * 0.4 + h * 0.3, r: 0.95 }; }, 71, 2);
SETS.water = () => makeSet('water', (x, y, n, h) => ({ c: [255, 255, 255], h: h, r: 0.05 }), 83, 1.2);
SETS.leaf = () => makeSet('leaf', (x, y, n, h) => { const v = 0.7 + h * 0.4; return { c: [200 * v, 220 * v, 190 * v], h: (h > 0.5 ? 1 : 0) * 0.5 + h * 0.3, r: 0.8 }; }, 97, 3);
function splat(size, seed) { // terrain albedo: grass / dry grass / dirt / gravel blended by noise
  const n = isPhone ? 512 : 1024, a = noiseField(n, seed, 6), b = noiseField(n, seed + 5, 4), px = new Uint8ClampedArray(n * n * 4);
  const grass = [88, 112, 58], dry = [128, 124, 72], dirt = [112, 92, 66], grav = [130, 126, 118];
  for (let i = 0; i < n * n; i++) { const t1 = clamp((a[i] - 0.55) * 4), t2 = clamp((b[i] - 0.62) * 5), t3 = clamp((a[i] * b[i] - 0.42) * 6), j = (Math.random() - 0.5) * 10;
    for (let k = 0; k < 3; k++) { let c = mix(grass[k], dry[k], t1); c = mix(c, dirt[k], t2); c = mix(c, grav[k], t3 * 0.7); px[i * 4 + k] = c + j; } px[i * 4 + 3] = 255; }
  const t = toTex(px, n, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
let waterMats = [], skyDome = null;
export function environment(game) {
  const s = game.scene, M = game.map, L = game.layout, size = M.size;
  // terrain
  const ground = s.children.find(o => o.userData.kind === 'ground' && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width >= size * 2);
  if (ground) { const det = SETS.ground(), nm = det.normalMap.clone(), rm = det.roughnessMap.clone(); nm.repeat.set(size / 2, size / 2); rm.repeat.copy(nm.repeat); nm.needsUpdate = rm.needsUpdate = true;
    ground.material = new THREE.MeshStandardMaterial({ map: splat(size, 5), normalMap: nm, roughnessMap: rm, roughness: 1, color: new THREE.Color(M.ground).lerp(new THREE.Color(0xffffff), 0.55) }); }
  // sky dome + exponential fog matched to the horizon
  const hor = new THREE.Color(M.sky).lerp(new THREE.Color(0xe8eef2), 0.4);
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(0x3d6fb8) }, hor: { value: hor } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = max(vP.y, 0.); vec3 c = mix(hor, top, pow(h, .55)); vec3 sd = normalize(vec3(.45,.8,.35)); float d = max(dot(vP, sd), 0.); c += vec3(1.,.9,.7) * (pow(d, 900.) * 6. + pow(d, 12.) * .25); gl_FragColor = vec4(c, 1.); }' }));
  skyDome.renderOrder = -1; skyDome.frustumCulled = false; s.add(skyDome); s.background = hor; s.fog = new THREE.FogExp2(hor, 1.1 / size);
  // layered conifers + PBR bark + rock material
  const tiers = []; for (let i = 0; i <= 4; i++) { const y = i / 4; tiers.push(new THREE.Vector2(0.01, -2 + y * 4)); }
  const prof = [[0, -2.1], [1.75, -1.9], [0.9, -1.0], [1.4, -0.9], [0.6, 0.1], [1.05, 0.2], [0.35, 1.1], [0.6, 1.2], [0.01, 2.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const leafG = new THREE.LatheGeometry(prof, isPhone ? 7 : 11), leafM = pbr('leaf', 0x3d6a32, { roughness: 1 }), barkM = pbr('wood', 0x7a5a3c, { normalScale: 2 }), rockM = pbr('concrete', 0x8c8a84, { normalScale: 1.6 });
  for (const o of s.children) { if (o.userData.hp === 120 && o.children.length === 2) { const [tr, lf] = o.children; tr.material = barkM; lf.geometry = leafG; lf.material = leafM; lf.rotation.y = Math.random() * 6; lf.scale.setScalar(0.9 + Math.random() * 0.3); }
    else if (o.userData.res === 'stone') { o.material = rockM; o.receiveShadow = true; } }
  // wind-animated grass blades (instanced, tapered, color-varied)
  const bg = new THREE.PlaneGeometry(0.09, 0.6, 1, 3); bg.translate(0, 0.3, 0); const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.6; p.setX(i, p.getX(i) * (1 - y * 0.9)); }
  const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  gm.onBeforeCompile = sh => { sh.uniforms.uTime = game.grassTime = { value: 0 }; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.); float sway = sin(uTime*1.8 + wp.x*.35 + wp.z*.27) * .18 + sin(uTime*3.1 + wp.x) * .05; transformed.x += sway * position.y * position.y; transformed.z += sway * .5 * position.y * position.y;'); };
  const n = isPhone ? 3000 : 14000, im = new THREE.InstancedMesh(bg, gm, n), d = new THREE.Object3D(), col = new THREE.Color();
  const block = (x, z) => L.boxes.some(b => Math.abs(x - b[0]) < b[2] / 2 + 0.3 && Math.abs(z - b[1]) < b[3] / 2 + 0.3) || (L.water || []).some(w => x > w[0] && x < w[1] && z > w[2] && z < w[3]);
  let k = 0; for (let tries = 0; k < n && tries < n * 3; tries++) { const x = (Math.random() - 0.5) * size, z = (Math.random() - 0.5) * size; if (block(x, z)) continue;
    d.position.set(x, 0, z); d.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 6.3, 0); d.scale.set(1, 0.6 + Math.random() * 0.9, 1); d.updateMatrix(); im.setMatrixAt(k, d.matrix);
    im.setColorAt(k++, col.setHSL(0.24 + Math.random() * 0.06, 0.5 + Math.random() * 0.2, 0.1 + Math.random() * 0.08)); }
  im.count = k; im.receiveShadow = true; s.add(im);
  // bushes
  const bushG = new THREE.IcosahedronGeometry(0.7, 1), bushes = new THREE.InstancedMesh(bushG, leafM, isPhone ? 40 : 160); let bk = 0;
  for (const [x, z] of L.trees) for (let j = 0; j < 2 && bk < bushes.count; j++) { d.position.set(x + (Math.random() - 0.5) * 4, 0.3, z + (Math.random() - 0.5) * 4); if (block(d.position.x, d.position.z)) continue; d.rotation.set(0, Math.random() * 6, 0); d.scale.set(1 + Math.random(), 0.6 + Math.random() * 0.5, 1 + Math.random()); d.updateMatrix(); bushes.setMatrixAt(bk++, d.matrix); }
  bushes.count = bk; bushes.castShadow = bushes.receiveShadow = true; s.add(bushes);
  // water: reflective, scrolling double normal maps
  waterMats = []; for (const o of s.children) if (o.userData.kind === 'ground' && o !== ground && o.geometry.type === 'PlaneGeometry') { const w = SETS.water(), a = w.normalMap.clone(), pw = o.geometry.parameters;
    a.repeat.set(pw.width / 6, pw.height / 6); a.needsUpdate = true; o.material = new THREE.MeshPhysicalMaterial({ color: 0x1f5a70, roughness: 0.06, metalness: 0.0, normalMap: a, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.86, clearcoat: 1, envMapIntensity: 1.4 }); waterMats.push(o.material); }
  // shadows: tight frustum that follows the player = crisp shadows without a giant map
  game.sunLight = s.children.find(o => o.isDirectionalLight); if (game.sunLight) { const c = game.sunLight.shadow.camera; Object.assign(c, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 }); c.updateProjectionMatrix(); game.sunLight.shadow.normalBias = 0.03; }
  game.renderer.toneMappingExposure = 1.0;
}
export function tick(game, dt) {
  if (game.grassTime) game.grassTime.value += dt; for (const m of waterMats) { m.normalMap.offset.x += dt * 0.02; m.normalMap.offset.y += dt * 0.013; }
  const P = game.player, L = game.sunLight; if (P && L) { L.target.position.set(P.pos.x, 0, P.pos.z); L.position.set(P.pos.x + 40, 80, P.pos.z + 30); L.target.updateMatrixWorld(); }
  if (skyDome) skyDome.position.copy(game.camera.position);
}
