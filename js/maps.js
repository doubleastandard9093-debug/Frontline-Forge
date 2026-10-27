// Original map layouts. Boxes: [x, z, w, d, h, kind]. Props: trees/rocks for harvesting.
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
export const MAPS = {
  outpost: {
    name: 'Outpost Nine', type: 'small', mode: 'Team Deathmatch', desc: 'Tight compound. 4v4, short rounds.',
    size: 56, teamSize: 4, scoreLimit: 30, time: 240, ground: 0x6b6a52, sky: 0x9cb7cf,
    gen() { const r = rng(9), b = [];
      b.push([0, 0, 8, 8, 5, 'concrete'], [-14, -12, 6, 4, 3, 'metal'], [14, 12, 6, 4, 3, 'metal'], [-14, 12, 3, 8, 2.2, 'concrete'], [14, -12, 3, 8, 2.2, 'concrete']);
      for (let i = 0; i < 14; i++) b.push([(r() - 0.5) * 44, (r() - 0.5) * 44, 1.6, 1.6, 1.4 + r(), 'wood']);
      const trees = [], rocks = []; for (let i = 0; i < 10; i++) trees.push([(r() - 0.5) * 50, (r() - 0.5) * 50]);
      for (let i = 0; i < 6; i++) rocks.push([(r() - 0.5) * 48, (r() - 0.5) * 48]);
      return { boxes: b.filter(x => Math.hypot(x[0], x[1] - 22) > 6 && Math.hypot(x[0], x[1] + 22) > 6 || x[4] === 5), trees, rocks,
        spawns: [[0, 24], [0, -24]], vehicles: [['mech', 8, 22, 0], ['mech', -8, -22, 1]], racks: [['lr50', 0, 6], ['bm12', -20, 0], ['tg7', 20, 0]] }; },
  },
  ridgeback: {
    name: 'Ridgeback Valley', type: 'large', mode: 'Large Team Battle', desc: 'Open valley, room to build. 10v10, long matches.',
    size: 160, teamSize: 10, scoreLimit: 75, time: 600, ground: 0x5d6b43, sky: 0xa9c4dc,
    gen() { const r = rng(42), b = [];
      for (let i = 0; i < 9; i++) { const x = (r() - 0.5) * 120, z = (r() - 0.5) * 100; b.push([x, z, 6 + r() * 8, 6 + r() * 8, 3 + r() * 6, r() > 0.5 ? 'concrete' : 'metal']); }
      for (let i = 0; i < 30; i++) b.push([(r() - 0.5) * 140, (r() - 0.5) * 140, 1.6, 1.6, 1.3 + r(), 'wood']);
      const trees = [], rocks = []; for (let i = 0; i < 60; i++) trees.push([(r() - 0.5) * 150, (r() - 0.5) * 150]);
      for (let i = 0; i < 25; i++) rocks.push([(r() - 0.5) * 150, (r() - 0.5) * 150]);
      const ok = p => Math.abs(p[1]) < 60 || Math.abs(p[0]) > 14;
      return { boxes: b.filter(ok), trees: trees.filter(ok), rocks: rocks.filter(ok), spawns: [[0, 70], [0, -70]], vehicles: [['mech', -10, 66, 0], ['tank', 10, 64, 0], ['buggy', 22, 66, 0], ['mech', 10, -66, 1], ['tank', -10, -64, 1], ['buggy', -22, -66, 1]], racks: [['lr50', 0, 0], ['tg7', -40, 0], ['bm12', 40, 0], ['hx2', 0, 30], ['hx2', 0, -30]] }; },
  },
  tidebreak: {
    name: 'Tidebreak Isles', type: 'war', mode: 'Conquest', desc: 'Full-scale land, sea and air war. Hold capture points, use tanks, mechs, buggies, boats, gunships and jets.',
    size: 320, teamSize: 16, scoreLimit: 250, time: 900, ground: 0x6d7650, sky: 0xa3c3de,
    gen() { const r = rng(77), b = [];
      const water = [[-160, -112, -160, 160], [-112, -12, -24, 24], [12, 160, -24, 24]];
      const wet = (x, z, pad = 4) => water.some(w => x > w[0] - pad && x < w[1] + pad && z > w[2] - pad && z < w[3] + pad);
      const caps = [{ n: 'A', name: 'Harbor', x: -85, z: 60 }, { n: 'B', name: 'Bridge', x: 0, z: 0 }, { n: 'C', name: 'Radar', x: 95, z: 70 }, { n: 'D', name: 'Dunes', x: -85, z: -60 }, { n: 'E', name: 'Refinery', x: 95, z: -70 }];
      for (const s of [1, -1]) { // team bases: bunkers + hangar
        b.push([-30, 128 * s, 14, 8, 6, 'concrete'], [30, 128 * s, 14, 8, 6, 'concrete'], [0, 145 * s, 30, 6, 4, 'metal'], [55, 140 * s, 4, 26, 7, 'metal']); }
      for (const c of caps) { b.push([c.x + 9, c.z, 2, 8, 2.4, 'concrete'], [c.x - 9, c.z, 2, 8, 2.4, 'concrete'], [c.x, c.z + 10, 8, 2, 2.4, 'concrete']); if (c.n === 'C') b.push([c.x + 4, c.z - 6, 3, 3, 14, 'metal']); if (c.n === 'E') b.push([c.x - 4, c.z - 8, 6, 6, 9, 'metal'], [c.x + 6, c.z - 8, 4, 4, 12, 'metal']); }
      for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 290, z = (r() - 0.5) * 290; if (!wet(x, z) && Math.abs(z) < 115) b.push([x, z, 1.6, 1.6, 1.3 + r(), 'wood']); }
      for (let i = 0; i < 14; i++) { const x = (r() - 0.5) * 260, z = (r() - 0.5) * 200; if (!wet(x, z, 8) && caps.every(c => Math.hypot(c.x - x, c.z - z) > 18)) b.push([x, z, 6 + r() * 10, 6 + r() * 10, 3 + r() * 5, r() > 0.5 ? 'concrete' : 'metal']); }
      const trees = [], rocks = []; for (let i = 0; i < 90; i++) { const x = (r() - 0.5) * 300, z = (r() - 0.5) * 300; if (!wet(x, z) && Math.abs(z) < 118 && caps.every(c => Math.hypot(c.x - x, c.z - z) > 14)) trees.push([x, z]); }
      for (let i = 0; i < 35; i++) { const x = (r() - 0.5) * 300, z = (r() - 0.5) * 300; if (!wet(x, z) && Math.abs(z) < 118) rocks.push([x, z]); }
      const V = []; for (const [t, s] of [[0, 1], [1, -1]]) V.push(['mech', -12, 120 * s, t], ['tank', 12, 118 * s, t], ['tank', -45, 112 * s, t], ['buggy', 20, 108 * s, t], ['buggy', -20, 108 * s, t],
        ['boat', -60, 14 * s, t], ['boat', 60, 14 * s, t], ['boat', -135, 100 * s, t], ['heli', -60, 140 * s, t], ['jet', 78, 122 * s, t]);
      return { boxes: b, trees, rocks, water, caps, spawns: [[0, 132], [0, -132]], vehicles: V, racks: [['lr50', 0, 6], ['tg7', -85, 66], ['tg7', 95, -64], ['bm12', 95, 76], ['hx2', -85, -54]] }; },
  },
};
