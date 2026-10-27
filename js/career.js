// Combat Arms-style long loop: prestige, weekly challenges, daily first win, gun rentals + durability, cosmetic supply crates.
export const MAX_PRESTIGE = 10;
export const gpMult = S => 1 + 0.05 * (S.prestige || 0);
export const RENTALS = {
  vr3: { name: 'Valkyr VR-3', type: 'rifle', dmg: 22, rpm: 700, mag: 32, reload: 1.8, spread: 0.016, recoil: 0.010, range: 140, auto: true, rental: true },
  dm8: { name: 'Warden DM-8', type: 'sniper', dmg: 62, rpm: 160, mag: 12, reload: 2.4, spread: 0.004, recoil: 0.04, range: 220, auto: false, zoom: 2.5, rental: true },
  sx4: { name: 'Scythe SX-4', type: 'smg', dmg: 15, rpm: 1000, mag: 40, reload: 1.5, spread: 0.026, recoil: 0.007, range: 60, auto: true, rental: true },
};
export const RENT_PLANS = [{ matches: 5, price: 1200 }, { matches: 20, price: 4000 }];
export const DURABLE = ['lr50', 'tg7']; // top classic guns wear out
export const REPAIR = 400;
export const CAMOS = { stock: { name: 'Factory Black', color: 0x23252a }, desert: { name: 'Dune', color: 0x9a7b4f }, forest: { name: 'Thicket', color: 0x3f5a35 }, arctic: { name: 'Glacier', color: 0xc8d4dc }, crimson: { name: 'Crimson', color: 0x8a1f24 }, cobalt: { name: 'Cobalt', color: 0x2a4f9a }, gold: { name: 'Forged Gold', color: 0xd4a640, rare: true }, void: { name: 'Voidglass', color: 0x4b2a6e, rare: true } };
export const RETICLES = { cross: 'Classic cross', dot: 'Red dot', ring: 'Ring', chevron: 'Chevron', tight: 'Tight cross' };
export const CRATE_PRICE = 800;
const CHAL = [
  { k: 'kills', n: 60, d: 'Get 60 kills' }, { k: 'head', n: 20, d: 'Land 20 headshot kills' }, { k: 'wins', n: 4, d: 'Win 4 matches' },
  { k: 'zrounds', n: 25, d: 'Survive 25 Zombies rounds' }, { k: 'matches', n: 8, d: 'Play 8 matches' }, { k: 'builds', n: 40, d: 'Build 40 pieces' }, { k: 'loot', n: 10, d: 'Find 10 loot guns' }];
export const week = (d = new Date()) => Math.floor((d.getTime() / 864e5 + 3) / 7);
export const today = (d = new Date()) => d.toISOString().slice(0, 10);
export function weekly(S) {
  const w = week(); if (!S.weekly || S.weekly.week !== w) { const pick = [w % 7, (w + 2) % 7, (w + 4) % 7]; S.weekly = { week: w, list: pick.map(i => CHAL[i].k), prog: {}, done: [] }; }
  return S.weekly.list.map(k => ({ ...CHAL.find(c => c.k === k), p: S.weekly.prog[k] || 0, done: S.weekly.done.includes(k) }));
}
// Applies a match result to the long-term loop. Returns lines to show on the results screen.
export function careerResult(S, r) {
  const out = []; weekly(S); const st = r.stats, add = { kills: st.kills, head: st.head, wins: r.won ? 1 : 0, zrounds: r.zombies ? Math.max(0, r.round - 1) : 0, matches: 1, builds: st.builds, loot: st.loot || 0 };
  for (const c of weekly(S)) if (!c.done) { const p = S.weekly.prog[c.k] = (S.weekly.prog[c.k] || 0) + (add[c.k] || 0);
    if (p >= c.n) { S.weekly.done.push(c.k); S.xp += 1500; S.gp += 1500; out.push(`Weekly challenge done: ${c.d} (+1500 XP, +1500 GP)`); } }
  if ((r.won || (r.zombies && r.round > 5)) && S.dailyWin !== today()) { S.dailyWin = today(); S.xp += 1000; S.gp += 500; out.push('First win of the day: +1000 XP, +500 GP'); }
  const lo = S.loadout;
  for (const id of [lo.primary, lo.secondary]) {
    if (S.rent?.[id] !== undefined) { S.rent[id]--; if (S.rent[id] <= 0) { delete S.rent[id]; out.push(`Rental expired: ${RENTALS[id].name}`); if (lo.primary === id) lo.primary = 'kr4'; if (lo.secondary === id) lo.secondary = 'vx9'; } else out.push(`${RENTALS[id].name}: ${S.rent[id]} matches left`); }
    if (DURABLE.includes(id)) { S.dura = S.dura || {}; S.dura[id] = Math.max(0, (S.dura[id] ?? 100) - 5); if (S.dura[id] <= 25) out.push(`${id.toUpperCase()} durability ${S.dura[id]}% — repair in the Armory`); }
  }
  return out;
}
export function prestige(S) {
  if (S.rank < 16 || (S.prestige || 0) >= MAX_PRESTIGE) return false;
  S.prestige = (S.prestige || 0) + 1; S.rank = 0; S.xp = 0; S.gp += 2000; return true;
}
export function openCrate(S) {
  if (S.gp < CRATE_PRICE) return null; S.gp -= CRATE_PRICE; S.cos = S.cos || { camos: ['stock'], rets: ['cross'], camo: 'stock', ret: 'cross' };
  const pool = [...Object.keys(CAMOS).filter(k => k !== 'stock').flatMap(k => CAMOS[k].rare ? [['camo', k]] : [['camo', k], ['camo', k], ['camo', k]]), ...Object.keys(RETICLES).filter(k => k !== 'cross').map(k => ['ret', k]), ...Object.keys(RETICLES).filter(k => k !== 'cross').map(k => ['ret', k])];
  const [kind, k] = pool[Math.floor(Math.random() * pool.length)]; const list = kind === 'camo' ? S.cos.camos : S.cos.rets;
  if (list.includes(k)) { S.gp += 300; return { kind, k, dup: true }; } list.push(k); return { kind, k };
}
export const durMult = (S, id) => DURABLE.includes(id) && (S.dura?.[id] ?? 100) <= 0 ? 0.8 : 1;
