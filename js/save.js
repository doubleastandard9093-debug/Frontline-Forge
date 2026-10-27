const KEY = 'frontline-forge-save-v1';
export const fresh = () => ({ v: 1, xp: 0, rank: 0, gp: 500, points: 0, stats: { hp: 0, speed: 0, reload: 0, build: 0 },
  owned: ['vx9', 'kr4'], attach: {}, ownedAttach: [], loadout: { primary: 'kr4', secondary: 'vx9' },
  totals: { kills: 0, deaths: 0, matches: 0, wins: 0 }, gfx: 'low', sens: 1 });
export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) {}
  return fresh();
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
export function exportCode(s) { return btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
export function importCode(code) {
  const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!s || s.v !== 1) throw new Error('Not a Frontline Forge save');
  return Object.assign(fresh(), s);
}
