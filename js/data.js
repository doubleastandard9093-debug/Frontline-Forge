// Original content: all names are invented for Frontline Forge.
export const GUNS = {
  vx9:   { name: 'VX-9 Sidearm',  type: 'pistol', dmg: 17, rpm: 380, mag: 12, reload: 1.2, spread: 0.012, recoil: 0.018, range: 60,  price: 0,    rank: 0, auto: false },
  kr4:   { name: 'KR-4 Carbine',  type: 'rifle',  dmg: 19, rpm: 640, mag: 30, reload: 2.0, spread: 0.020, recoil: 0.012, range: 120, price: 0,    rank: 0, auto: true },
  hx2:   { name: 'Hornet HX-2',   type: 'smg',    dmg: 13, rpm: 900, mag: 35, reload: 1.7, spread: 0.032, recoil: 0.008, range: 50,  price: 1500, rank: 2, auto: true },
  bm12:  { name: 'Breaker M12',   type: 'shotgun',dmg: 14, rpm: 80,  mag: 6,  reload: 2.6, spread: 0.07,  recoil: 0.06,  range: 25,  price: 2500, rank: 3, auto: false, pellets: 9 },
  lr50:  { name: 'Longreach LR-50',type:'sniper', dmg: 95, rpm: 45,  mag: 5,  reload: 3.0, spread: 0.002, recoil: 0.09,  range: 300, price: 5000, rank: 5, auto: false, zoom: 4 },
  ll9:   { name: 'Skyhook LL-9', type: 'launcher', dmg: 90, rpm: 40, mag: 2, reload: 3.2, spread: 0.004, recoil: 0.08, range: 200, price: 4000, rank: 3, auto: false, lock: true, zoom: 1.6 },
  tg7:   { name: 'Tempest TG-7',  type: 'lmg',    dmg: 18, rpm: 720, mag: 80, reload: 4.2, spread: 0.035, recoil: 0.010, range: 110, price: 8000, rank: 7, auto: true },
};
export const ATTACH = {
  dot:   { name: 'Pinpoint Sight',  slot: 'optic',  price: 600,  rank: 1, mod: { adsZoom: 1.25 } },
  scope: { name: 'Falcon 3x Scope', slot: 'optic',  price: 1800, rank: 4, mod: { adsZoom: 2.2 } },
  grip:  { name: 'Steady Grip',     slot: 'under',  price: 900,  rank: 2, mod: { recoil: 0.7 } },
  laser: { name: 'Hipfire Laser',   slot: 'under',  price: 1200, rank: 3, mod: { spread: 0.65 } },
  ext:   { name: 'Extended Mag',    slot: 'mag',    price: 1000, rank: 2, mod: { mag: 1.5 } },
  fast:  { name: 'Quickdraw Mag',   slot: 'mag',    price: 1100, rank: 3, mod: { reload: 0.7 } },
  barrel:{ name: 'Heavy Barrel',    slot: 'barrel', price: 1500, rank: 4, mod: { dmg: 1.15, range: 1.3 } },
};
export const RANKS = ['Recruit','Private','Private 1st Class','Corporal','Sergeant','Staff Sergeant','Sgt. 1st Class','Master Sergeant','Warrant Officer','2nd Lieutenant','1st Lieutenant','Captain','Major','Lt. Colonel','Colonel','Brigadier','General'];
export const xpForRank = r => Math.round(400 * Math.pow(r + 1, 1.6));
export const STATS = {
  hp:     { name: 'Toughness', desc: '+5 max HP',          max: 10 },
  speed:  { name: 'Agility',   desc: '+3% move speed',     max: 10 },
  reload: { name: 'Handling',  desc: '-4% reload time',    max: 10 },
  build:  { name: 'Engineer',  desc: '+10% build HP, +1 harvest', max: 10 },
};
export const BUILD = { wall: { cost: 10, hp: 150 }, floor: { cost: 10, hp: 140 }, ramp: { cost: 10, hp: 140 } };
export const GRID = 4;

// Bot difficulty, chosen per match. react = seconds on target before first shot; aim scales hit chance;
// nade/veh scale how often bots throw grenades and take vehicles.
export const BOT_TIERS = {
  recruit: { name: 'Recruit', react: 0.8, aim: 0.6, nade: 0.4, veh: 0.06 },
  regular: { name: 'Regular', react: 0.45, aim: 1, nade: 1, veh: 0.15 },
  veteran: { name: 'Veteran', react: 0.3, aim: 1.25, nade: 1.5, veh: 0.25 },
  legend: { name: 'Legend', react: 0.18, aim: 1.5, nade: 2.2, veh: 0.35 },
};
