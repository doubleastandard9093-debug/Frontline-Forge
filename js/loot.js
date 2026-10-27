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
  halvorsen: { name: 'Halvorsen', gimmick: null, bias: { dmg: 1.18, rpm: 0.85, spread: 0.7 }, models: ['Warden', 'Spire', 'Verdict'], elem: 0.15 },
  kessly: { name: 'Kessly Arms', bias: { rpm: 1.25, mag: 1.4, dmg: 0.88 }, models: ['Hailstorm', 'Rattler', 'Swarm'], elem: 0.2 },
  torvik: { name: 'Torvik Labs', gimmick: 'ricochet', gdesc: 'Shots can ricochet to a nearby enemy', bias: { dmg: 0.95 }, models: ['Catalyst', 'Ion', 'Ember'], elem: 0.85 },
  brakka: { name: 'Brakka', gimmick: 'throw', gdesc: 'Reload by throwing the gun: it explodes where it lands', bias: { dmg: 1.4, spread: 1.6, recoil: 1.5, mag: 0.75 }, models: ['Mauler', 'Bonebreak', 'Hammer'], elem: 0.1 },
  nimbus: { name: 'Nimbus', gimmick: 'homing', gdesc: 'Rounds curve toward enemies near the crosshair', bias: { reload: 0.65, spread: 0.85 }, models: ['Glide', 'Drift', 'Halo'], elem: 0.3 },
};
const BASES = {
  pistol: { dmg: 17, rpm: 380, mag: 12, reload: 1.2, spread: 0.012, recoil: 0.018, range: 60, auto: false },
  smg: { dmg: 12, rpm: 880, mag: 34, reload: 1.7, spread: 0.03, recoil: 0.008, range: 50, auto: true },
  rifle: { dmg: 18, rpm: 620, mag: 30, reload: 2.0, spread: 0.02, recoil: 0.012, range: 120, auto: true },
  shotgun: { dmg: 13, rpm: 85, mag: 6, reload: 2.6, spread: 0.07, recoil: 0.06, range: 25, auto: false, pellets: 9 },
  sniper: { dmg: 90, rpm: 48, mag: 5, reload: 3.0, spread: 0.002, recoil: 0.09, range: 300, auto: false, zoom: 4 },
};
// Parts: barrel / grip / stock / sight, each a small named modifier.
const PARTS = [
  { n: 'Long Barrel', m: { range: 1.3, spread: 0.8 } }, { n: 'Hot Barrel', m: { dmg: 1.12 } }, { n: 'Drum Mag', m: { mag: 1.5, reload: 1.15 } },
  { n: 'Quick Grip', m: { reload: 0.8 } }, { n: 'Heavy Stock', m: { recoil: 0.6, spread: 0.85 } }, { n: 'Hair Trigger', m: { rpm: 1.15 } },
  { n: 'Twin Feed', m: { mag: 1.25, rpm: 1.08 } }, { n: 'Scope', m: { zoom: 2 } },
];
const PREFIX = { dmg: 'Brutal', rpm: 'Frenzied', mag: 'Hungry', reload: 'Nimble', spread: 'Steady' };
// Affixes: rare and better guns roll 2 (epic/legendary 2 + legendary perk).
export const AFFIXES = {
  vampiric: { name: 'Vampiric', desc: '4% of damage heals you' }, headhunter: { name: 'Headhunter', desc: '+25% headshot damage' },
  breaker: { name: 'Shieldbreaker', desc: '+25% damage to shields' }, executioner: { name: 'Executioner', desc: '+20% damage to targets under 35% health' },
  tempo: { name: 'Tempo', desc: '+10% fire rate' }, bloodrush: { name: 'Bloodrush', desc: 'Kills give +20% speed for 3s' }, steadfast: { name: 'Steadfast', desc: '-25% recoil' } };
// Legendary perks (red text): each named legendary has one.
export const LEGENDS = {
  'Seventh Sun': { red: 'Burn bright, burn brief.', desc: 'Every 7th shot deals x3' }, 'Widow Maker': { red: 'Leaves no one behind.', desc: 'Headshot kills explode' },
  'Last Laugh': { red: 'Not yet.', desc: 'When your shield breaks, the magazine refills' }, 'Grudgeholder': { red: 'It remembers.', desc: '+10% damage per hit on the same target (max +50%)' },
  'Thunderclap': { red: 'Hear it twice.', desc: 'Kills arc shock to 2 nearby enemies' }, 'Gravesinger': { red: 'Every kill a verse.', desc: 'Kills restore 25 health' } };
const LEGEND = Object.keys(LEGENDS);
export const reqRank = g => g.req ?? 0;
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
  const affixes = []; if (ri >= 2) { const ks = Object.keys(AFFIXES); while (affixes.length < 2) { const a = pick(ks, r); if (!affixes.includes(a)) affixes.push(a); } }
  if (affixes.includes('tempo')) g.rpm *= 1.1; if (affixes.includes('steadfast')) g.recoil *= 0.75;
  return { loot: true, type, maker: M.name, gimmick: M.gimmick, rarity: ri, name, lvl: level, req: Math.max(0, Math.min(16, Math.floor(level * 0.8) - 2)), affixes, legend: ri === 4 ? name : null, parts, elem, elemChance: elem ? 0.18 + ri * 0.06 : 0, elemDps: elem ? Math.round(g.dmg * (0.5 + ri * 0.15)) : 0,
    dmg: Math.round(g.dmg), rpm: Math.round(g.rpm), mag: g.mag, reload: +g.reload.toFixed(2), spread: +g.spread.toFixed(4), recoil: +g.recoil.toFixed(3), range: Math.round(g.range), auto: g.auto, pellets: g.pellets, zoom: g.zoom };
}
export const sellValue = g => Math.round((40 + g.dmg * (g.pellets || 1) * 0.8 + g.rpm * 0.05) * [1, 1.6, 2.6, 4.2, 7][g.rarity] * (g.elem ? 1.3 : 1));
export const gunLine = g => `${g.maker} ${g.type.toUpperCase()} · DMG ${g.dmg}${g.pellets ? 'x' + g.pellets : ''} · ${g.rpm} RPM · MAG ${g.mag} · RLD ${g.reload}s${g.elem ? ` · ${ELEMENTS[g.elem].name} ${Math.round(g.elemChance * 100)}% (${g.elemDps}/s)` : ''}${g.parts.length ? ' · ' + g.parts.join(', ') : ''}${g.affixes?.length ? ' · ' + g.affixes.map(a => AFFIXES[a].name + ' (' + AFFIXES[a].desc + ')').join(', ') : ''}${g.gimmick ? ' · ' + MAKERS[Object.keys(MAKERS).find(k => MAKERS[k].name === g.maker)].gdesc : ''}`;
export const redText = g => g.legend && LEGENDS[g.legend] ? `<i style="color:#ff4a3a">“${LEGENDS[g.legend].red}” — ${LEGENDS[g.legend].desc}</i>` : '';
