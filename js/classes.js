// Three original classes, each with an action skill and a 3-skill tree (3 points max per skill). 1 skill point per rank.
export const CLASSES = {
  vanguard: { name: 'Vanguard', role: 'Frontline tank', color: '#4f8fff',
    action: { name: 'Bulwark', desc: 'Refill shields and take 60% less damage', dur: 6, cd: 30 },
    skills: { ironhide: { name: 'Iron Hide', desc: '+12 max shield', max: 3 }, secondwind: { name: 'Second Wind', desc: 'Shields start recharging 0.6s sooner', max: 3 }, longwall: { name: 'Long Wall', desc: '+1.5s Bulwark', max: 3 } } },
  ghostwire: { name: 'Ghostwire', role: 'Stealth marksman', color: '#b05cff',
    action: { name: 'Phase Cloak', desc: 'Turn invisible to enemies; your first shot deals x3', dur: 5, cd: 28 },
    skills: { deadeye: { name: 'Deadeye', desc: '+12% headshot damage', max: 3 }, quickstep: { name: 'Quickstep', desc: '+5% move speed', max: 3 }, linger: { name: 'Lingering Veil', desc: '+1s cloak', max: 3 } } },
  sparkwright: { name: 'Sparkwright', role: 'Elemental engineer', color: '#4fc3ff',
    action: { name: 'Arc Turret', desc: 'Deploy a shock turret that fires at enemies', dur: 12, cd: 35 },
    skills: { charged: { name: 'Charged Rounds', desc: '+6% elemental chance (any gun gains Shock)', max: 3 }, overclock: { name: 'Overclock', desc: '-4s action skill cooldown', max: 3 }, twincoil: { name: 'Twin Coil', desc: '+25% turret damage', max: 3 } } },
};
export const skillPts = S => S.rank + 1 - Object.values(S.skills || {}).reduce((a, b) => a + b, 0);
export const lv = (S, k) => (S.skills || {})[k] || 0;
