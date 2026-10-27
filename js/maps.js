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
      return { boxes: b.filter(ok), trees: trees.filter(ok), rocks: rocks.filter(ok), spawns: [[0, 70], [0, -70]], vehicles: [['mech', -10, 66, 0], ['tank', 10, 64, 0], ['mech', 10, -66, 1], ['tank', -10, -64, 1]], racks: [['lr50', 0, 0], ['tg7', -40, 0], ['bm12', 40, 0], ['hx2', 0, 30], ['hx2', 0, -30]] }; },
  },
};
