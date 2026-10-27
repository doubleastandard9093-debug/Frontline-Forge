// Save format v2 (loot backpack, classes, zombies records). Same storage key as v1 so old saves are found and upgraded in place.
const KEY = 'frontline-forge-save-v1';
export const SAVE_VERSION = 2;
export const BACKPACK = 20;
export const fresh = () => ({ v: SAVE_VERSION, xp: 0, rank: 0, gp: 500, points: 0, stats: { hp: 0, speed: 0, reload: 0, build: 0 },
  owned: ['vx9', 'kr4'], attach: {}, ownedAttach: [], loadout: { primary: 'kr4', secondary: 'vx9' },
  totals: { kills: 0, deaths: 0, matches: 0, wins: 0 }, gfx: 'low', sens: 1,
  // v2
  inv: [], uid: 1, cls: 'vanguard', skills: {}, zbest: 0, ztotal: 0 });
// Upgrade any older save to the current version without losing progress.
export function migrate(s) {
  if (!s || typeof s !== 'object' || !s.v) return null;
  if (s.v > SAVE_VERSION) return null;
  const out = Object.assign(fresh(), s);
  if (s.v < 2) { out.inv = []; out.uid = 1; out.cls = 'vanguard'; out.skills = {}; out.zbest = 0; out.ztotal = 0; out.migratedFrom = s.v; }
  out.v = SAVE_VERSION; return out;
}
export function load() {
  try { const s = migrate(JSON.parse(localStorage.getItem(KEY))); if (s) return s; } catch (e) {}
  return fresh();
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
export function exportCode(s) { return btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
export function importCode(code) {
  const s = migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim())))));
  if (!s) throw new Error('Not a Frontline Forge save');
  return s;
}
