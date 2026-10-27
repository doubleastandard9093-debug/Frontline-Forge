// Graphics tiers. Low is default and remembered. High-only assets (procedural textures,
// shadow maps, extra props) are created ONLY inside the High branches below, so Low never builds them.
import * as THREE from 'three';
export function pickTier(save) {
  const q = new URLSearchParams(location.search).get('gfx');
  if (q === 'low' || q === 'high') return q;
  return save.gfx === 'high' ? 'high' : 'low';
}
export const isPhone = /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
export function makeRenderer(canvas, tier) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: tier === 'high', powerPreference: tier === 'high' ? 'high-performance' : 'low-power' });
  const dpr = window.devicePixelRatio || 1;
  r.setPixelRatio(tier === 'high' ? Math.min(dpr, isPhone ? 2 : 2) : Math.min(dpr, isPhone ? 1.25 : 1));
  if (tier === 'high') { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; }
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}
// High-only procedural textures (never called on Low).
export function highTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const base = { ground: '#5d6b43', concrete: '#8a8a86', wood: '#8a6236', metal: '#5b6670', sand: '#b9a27a' }[kind] || '#888';
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = (Math.random() - 0.5) * 50; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 400})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4); }
  if (kind === 'wood') { g.strokeStyle = 'rgba(40,20,5,.35)'; for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } }
  if (kind === 'concrete') { g.strokeStyle = 'rgba(0,0,0,.18)'; g.strokeRect(2, 2, 252, 252); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function mat(tier, color, kind, repeat = 1) {
  if (tier !== 'high') return new THREE.MeshLambertMaterial({ color });
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: kind === 'metal' ? 0.15 : 0 });
  if (kind) { m.map = highTexture(kind); m.map.repeat.set(repeat, repeat); m.color.set(0xffffff).lerp(new THREE.Color(color), 0.35); }
  return m;
}
