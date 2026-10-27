// Grid navigation: 2 m cells, A* with 8-way moves. Blocks solids (static, trees, rocks, player builds)
// and treats water as land-blocked or boat-only. Rebuilt lazily when builds change.
import * as THREE from 'three';
export class Nav {
  constructor(game, cell = 2) { this.g = game; this.c = cell; this.n = Math.ceil(game.map.size / cell); this.dirty = true; this.rebuild(); }
  idx(x, z) { const h = this.g.map.size / 2, i = Math.floor((x + h) / this.c), j = Math.floor((z + h) / this.c); return (i < 0 || j < 0 || i >= this.n || j >= this.n) ? -1 : j * this.n + i; }
  center(k) { const h = this.g.map.size / 2; return new THREE.Vector3((k % this.n + 0.5) * this.c - h, 0, (Math.floor(k / this.n) + 0.5) * this.c - h); }
  rebuild() {
    const n = this.n, h = this.g.map.size / 2; this.block = new Uint8Array(n * n); this.dirty = false; const firstWet = !this.wet; if (firstWet) this.wet = new Uint8Array(n * n);
    for (const s of this.g.solids) { if (s.vehicle || s.max.y < 0.7 || s.min.y > 2) continue; const pad = 0.5;
      const i0 = Math.max(0, Math.floor((s.min.x - pad + h) / this.c)), i1 = Math.min(n - 1, Math.floor((s.max.x + pad + h) / this.c)), j0 = Math.max(0, Math.floor((s.min.z - pad + h) / this.c)), j1 = Math.min(n - 1, Math.floor((s.max.z + pad + h) / this.c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.block[j * n + i] = 1; }
    if (firstWet) for (let k = 0; k < n * n; k++) { const p = this.center(k); if (this.g.isWater(p.x, p.z)) this.wet[k] = 1; }
  }
  ok(k, mode) { if (k < 0 || this.block[k]) return false; if (mode === 'boat') return !!this.wet[k]; if (mode === 'land') return !this.wet[k]; return true; }
  nearestOk(k, mode) { if (this.ok(k, mode)) return k; const n = this.n, i0 = k % n, j0 = Math.floor(k / n);
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < n && j < n && this.ok(j * n + i, mode)) return j * n + i; } return -1; }
  // mode: 'foot' (water allowed, slow), 'land' (vehicles), 'boat'
  find(from, to, mode = 'foot', maxNodes = 5000) {
    if (this.dirty) this.rebuild();
    const n = this.n, s = this.nearestOk(this.idx(from.x, from.z), mode), t = this.nearestOk(this.idx(to.x, to.z), mode); if (s < 0 || t < 0) return null;
    const gs = new Float32Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n);
    const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const ti = t % n, tj = Math.floor(t / n), hfn = k => { const dx = Math.abs(k % n - ti), dz = Math.abs(Math.floor(k / n) - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    gs[s] = 0; push(s, hfn(s)); let count = 0, best = s, bestH = hfn(s);
    while (heap.length && count++ < maxNodes) {
      const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === t) { best = t; break; }
      const hk = hfn(k); if (hk < bestH) { bestH = hk; best = k; }
      const i = k % n, j = Math.floor(k / n);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = nj * n + ni; if (closed[nk] || !this.ok(nk, mode)) continue; if (di && dj && (!this.ok(j * n + ni, mode) || !this.ok(nj * n + i, mode))) continue;
        const cost = gs[k] + (di && dj ? 1.414 : 1) * (mode === 'foot' && this.wet[nk] ? 3 : 1); if (cost < gs[nk]) { gs[nk] = cost; came[nk] = k; push(nk, cost + hfn(nk)); } }
    }
    const path = []; for (let k = best; k !== -1 && k !== s; k = came[k]) path.push(k); path.reverse();
    // string-pull: keep only turning points
    const pts = []; let prevDir = null; for (let a = 0; a < path.length; a++) { const k = path[a], nx = path[a + 1]; const dir = nx === undefined ? null : nx - k; if (dir !== prevDir || nx === undefined) pts.push(this.center(k)); prevDir = dir; }
    if (best === t) pts.push(new THREE.Vector3(to.x, 0, to.z));
    return pts;
  }
}
