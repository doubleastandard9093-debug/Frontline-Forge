// Procedural loot guns: original manufacturers, parts, rarities and elements.
export const RARITY = [
  { id: 'common', name: 'Common', color: 0xd8d8d8, css: '#d8d8d8', mult: 1.0, w: 50, parts: 0 },
  { id: 'uncommon', name: 'Uncommon', color: 0x3fd25a, css: '#3fd25a', mult: 1.12, w: 28, parts: 1 },
  { id: 'rare', name: 'Rare', color: 0x3d8bff, css: '#3d8bff', mult: 1.26, w: 14, parts: 2 },
  { id: 'epic', name: 'Epic', color: 0xb05cff, css: '#b05cff', mult: 1.42, w: 6, parts: 2 },
  { id: 'legendary', name: 'Legendary', color: 0xff9a1f, css: '#ff9a1f', mult: 1.65, w: 2, parts: 3 },
];
export const ELEMENTS = {
  fire: { name: 'Incendiary', css: '#ff6a2a', color: 0xff6a2a, note: '+50% vs health' },
  shock: { name: 'Shock', css: '#4fc3ff', color: 0x4fc3ff, note: 'x2 vs shields' },
  corrosive: { name: 'Corrosive', css: '#9be22d', color: 0x9be22d, note: '+50% vs vehicles' },
  cryo: { name: 'Cryo', css: '#bfefff', color: 0xbfefff, note: 'slows targets' },
};
// Manufacturers: each biases stats and names its own models.
export const MAKERS = {
  halvorsen: { name: 'Halvorsen', bias: { dmg: 1.18, rpm: 0.85, spread: 0.7 }, models: ['Warden', 'Spire', 'Verdict'], elem: 0.15 },
  kessly: { name: 'Kessly Arms', bias: { rpm: 1.25, mag: 1.4, dmg: 0.88 }, models: ['Hailstorm', 'Rattler', 'Swarm'], elem: 0.2 },
  torvik: { name: 'Torvik Labs', bias: { dmg: 0.95 }, models: ['Catalyst', 'Ion', 'Ember'], elem: 0.85 },
  brakka: { name: 'Brakka', bias: { dmg: 1.4, spread: 1.6, recoil: 1.5, mag: 0.75 }, models: ['Mauler', 'Bonebreak', 'Hammer'], elem: 0.1 },
  nimbus: { name: 'Nimbus', bias: { reload: 0.65, spread: 0.85 }, models: ['Glide', 'Drift', 'Halo'], elem: 0.3 },
};
const BASES = {
  pistol: { dmg: 22, rpm: 380, mag: 12, reload: 1.2, spread: 0.012, recoil: 0.018, range: 60, auto: false },
  smg: { dmg: 16, rpm: 880, mag: 34, reload: 1.7, spread: 0.03, recoil: 0.008, range: 50, auto: true },
  rifle: { dmg: 25, rpm: 620, mag: 30, reload: 2.0, spread: 0.02, recoil: 0.012, range: 120, auto: true },
  shotgun: { dmg: 11, rpm: 85, mag: 6, reload: 2.6, spread: 0.07, recoil: 0.06, range: 25, auto: false, pellets: 9 },
  sniper: { dmg: 90, rpm: 48, mag: 5, reload: 3.0, spread: 0.002, recoil: 0.09, range: 300, auto: false, zoom: 4 },
};
// Parts: barrel / grip / stock / sight, each a small named modifier.
const PARTS = [
  { n: 'Long Barrel', m: { range: 1.3, spread: 0.8 } }, { n: 'Hot Barrel', m: { dmg: 1.12 } }, { n: 'Drum Mag', m: { mag: 1.5, reload: 1.15 } },
  { n: 'Quick Grip', m: { reload: 0.8 } }, { n: 'Heavy Stock', m: { recoil: 0.6, spread: 0.85 } }, { n: 'Hair Trigger', m: { rpm: 1.15 } },
  { n: 'Twin Feed', m: { mag: 1.25, rpm: 1.08 } }, { n: 'Scope', m: { zoom: 2 } },
];
const PREFIX = { dmg: 'Brutal', rpm: 'Frenzied', mag: 'Hungry', reload: 'Nimble', spread: 'Steady' };
const LEGEND = ['Seventh Sun', 'Widow Maker', 'Last Laugh', 'Grudgeholder', 'Thunderclap', 'Gravesinger'];
const pick = (a, r) => a[Math.floor(r() * a.length)];
export function rollRarity(r = Math.random, luck = 0) { const tot = RARITY.reduce((a, x, i) => a + x.w * (1 + luck * i * 0.15), 0); let t = r() * tot;
  for (let i = 0; i < RARITY.length; i++) { t -= RARITY[i].w * (1 + luck * i * 0.15); if (t <= 0) return i; } return 0; }
export function genGun(level = 1, rarityIdx = null, r = Math.random) {
  const ri = rarityIdx ?? rollRarity(r, level / 10), R = RARITY[ri], type = pick(Object.keys(BASES), r), mk = pick(Object.keys(MAKERS), r), M = MAKERS[mk];
  const g = Object.assign({}, BASES[type]); const lvl = 1 + level * 0.06;
  const apply = m => { for (const k in m) g[k] = k === 'zoom' ? Math.max(g[k] || 1, m[k]) : (g[k] ?? 1) * m[k]; };
  apply(M.bias); const parts = []; for (let i = 0; i < R.parts; i++) { const p = pick(PARTS, r); if (!parts.includes(p.n)) { parts.push(p.n); apply(p.m); } }
  // random rolls on top
  const roll = () => 0.9 + r() * 0.2; g.dmg *= R.mult * lvl * roll(); g.rpm *= roll(); g.mag = Math.max(2, Math.round(g.mag * roll())); g.reload *= roll(); g.spread *= roll();
  const elem = r() < M.elem + ri * 0.08 ? pick(Object.keys(ELEMENTS), r) : null;
  const best = Object.entries({ dmg: g.dmg / BASES[type].dmg / (R.mult * lvl), rpm: g.rpm / BASES[type].rpm, mag: g.mag / BASES[type].mag, reload: BASES[type].reload / g.reload, spread: BASES[type].spread / g.spread }).sort((a, b) => b[1] - a[1])[0][0];
  const name = ri === 4 ? `${pick(LEGEND, r)}` : `${PREFIX[best]} ${pick(M.models, r)}`;
  return { loot: true, type, maker: M.name, rarity: ri, name, lvl: level, parts, elem, elemChance: elem ? 0.18 + ri * 0.06 : 0, elemDps: elem ? Math.round(g.dmg * (0.5 + ri * 0.15)) : 0,
    dmg: Math.round(g.dmg), rpm: Math.round(g.rpm), mag: g.mag, reload: +g.reload.toFixed(2), spread: +g.spread.toFixed(4), recoil: +g.recoil.toFixed(3), range: Math.round(g.range), auto: g.auto, pellets: g.pellets, zoom: g.zoom };
}
export const sellValue = g => Math.round((40 + g.dmg * (g.pellets || 1) * 0.8 + g.rpm * 0.05) * [1, 1.6, 2.6, 4.2, 7][g.rarity] * (g.elem ? 1.3 : 1));
export const gunLine = g => `${g.maker} ${g.type.toUpperCase()} · DMG ${g.dmg}${g.pellets ? 'x' + g.pellets : ''} · ${g.rpm} RPM · MAG ${g.mag} · RLD ${g.reload}s${g.elem ? ` · ${ELEMENTS[g.elem].name} ${Math.round(g.elemChance * 100)}% (${g.elemDps}/s)` : ''}${g.parts.length ? ' · ' + g.parts.join(', ') : ''}`;
