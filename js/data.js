// Original content: all names are invented for Frontline Forge.
export const GUNS = {
  vx9:   { name: 'VX-9 Sidearm',  type: 'pistol', dmg: 22, rpm: 380, mag: 12, reload: 1.2, spread: 0.012, recoil: 0.018, range: 60,  price: 0,    rank: 0, auto: false },
  kr4:   { name: 'KR-4 Carbine',  type: 'rifle',  dmg: 26, rpm: 640, mag: 30, reload: 2.0, spread: 0.020, recoil: 0.012, range: 120, price: 0,    rank: 0, auto: true },
  hx2:   { name: 'Hornet HX-2',   type: 'smg',    dmg: 17, rpm: 900, mag: 35, reload: 1.7, spread: 0.032, recoil: 0.008, range: 50,  price: 1500, rank: 2, auto: true },
  bm12:  { name: 'Breaker M12',   type: 'shotgun',dmg: 12, rpm: 80,  mag: 6,  reload: 2.6, spread: 0.07,  recoil: 0.06,  range: 25,  price: 2500, rank: 3, auto: false, pellets: 9 },
  lr50:  { name: 'Longreach LR-50',type:'sniper', dmg: 95, rpm: 45,  mag: 5,  reload: 3.0, spread: 0.002, recoil: 0.09,  range: 300, price: 5000, rank: 5, auto: false, zoom: 4 },
  tg7:   { name: 'Tempest TG-7',  type: 'lmg',    dmg: 24, rpm: 720, mag: 80, reload: 4.2, spread: 0.035, recoil: 0.010, range: 110, price: 8000, rank: 7, auto: true },
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
