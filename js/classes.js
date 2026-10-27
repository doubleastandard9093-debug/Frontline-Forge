// Three original classes. Each has an action skill and 3 branches x 5 tiers (2 points per tier, 1 for the capstone; 27 points per class).
// A tier unlocks once 2 points per earlier tier are spent in that branch. The branch-A capstone changes the action skill.
const T = (name, desc, br, tier, max = 2) => ({ name, desc, br, tier, max });
export const CLASSES = {
  vanguard: { name: 'Vanguard', role: 'Frontline tank', color: '#4f8fff', branches: ['Bulwark', 'Iron', 'Assault'],
    action: { name: 'Bulwark', desc: 'Refill shields and take 60% less damage', dur: 6, cd: 30 },
    skills: {
      longwall: T('Long Wall', '+1.5s Bulwark', 0, 1), bastion: T('Bastion', '-3s Bulwark cooldown', 0, 2), rally: T('Rally', 'Bulwark refills allies\' shields within 10m (pt 2: +25 overshield)', 0, 3), tough: T('Unbreakable', '-5% more damage taken during Bulwark', 0, 4), dome: T('Aegis Dome', 'CAPSTONE: Bulwark becomes a deployable dome; everyone on your side inside takes 60% less damage', 0, 5, 1),
      ironhide: T('Iron Hide', '+12 max shield', 1, 1), secondwind: T('Second Wind', 'Shields start recharging 0.6s sooner', 1, 2), plating: T('Plating', '+10 max health', 1, 3), fastcharge: T('Capacitors', '+20% shield refill speed', 1, 4), siphon: T('Siphon', 'CAPSTONE: kills restore 40 shield', 1, 5, 1),
      brawler: T('Brawler', '+25% melee damage', 2, 1), stopping: T('Stopping Power', '+4% gun damage', 2, 2), grenadier: T('Grenadier', '+1 frag grenade', 2, 3), adrenaline: T('Adrenaline', '+4% move speed', 2, 4), juggernaut: T('Juggernaut', 'CAPSTONE: kills cut Bulwark cooldown by 5s', 2, 5, 1) } },
  ghostwire: { name: 'Ghostwire', role: 'Stealth marksman', color: '#b05cff', branches: ['Cloak', 'Marksman', 'Agility'],
    action: { name: 'Phase Cloak', desc: 'Turn invisible to enemies; your first shot deals x3', dur: 5, cd: 28 },
    skills: {
      linger: T('Lingering Veil', '+1s cloak', 0, 1), shadowstep: T('Shadowstep', '-3s cloak cooldown', 0, 2), ambush: T('Ambush', '+0.5x first-shot multiplier', 0, 3), ghostrun: T('Ghost Run', '+10% speed while cloaked', 0, 4), decoy: T('Mirage', 'CAPSTONE: Cloak also drops a decoy that draws enemy fire', 0, 5, 1),
      deadeye: T('Deadeye', '+12% headshot damage', 1, 1), steady: T('Steady Hands', '-15% recoil', 1, 2), longshot: T('Long Shot', '+5% rifle and sniper damage', 1, 3), nimble: T('Nimble Hands', '-8% reload time', 1, 4), execution: T('Execution', 'CAPSTONE: +50% headshot damage on unshielded targets', 1, 5, 1),
      quickstep: T('Quickstep', '+5% move speed', 2, 1), evasion: T('Evasion', '-5% damage taken while moving', 2, 2), scavenger: T('Scavenger', 'Kills refill 10% of your magazine', 2, 3), fleet: T('Fleet', 'Shields recharge 0.5s sooner', 2, 4), phantom: T('Phantom', 'CAPSTONE: kills while cloaked reset the cloak cooldown', 2, 5, 1) } },
  sparkwright: { name: 'Sparkwright', role: 'Elemental engineer', color: '#4fc3ff', branches: ['Turret', 'Elements', 'Engineering'],
    action: { name: 'Arc Turret', desc: 'Deploy a shock turret that fires at enemies', dur: 12, cd: 35 },
    skills: {
      twincoil: T('Twin Coil', '+25% turret damage', 0, 1), overclock: T('Overclock', '-4s action skill cooldown', 0, 2), longcoil: T('Long Coil', '+3s turret duration', 0, 3), rapid: T('Rapid Arc', 'Turret fires 20% faster', 0, 4), link: T('Arc Link', 'CAPSTONE: deploy 2 linked turrets; an arc between them shocks enemies who cross it', 0, 5, 1),
      charged: T('Charged Rounds', '+6% elemental chance (any gun gains Shock)', 1, 1), conductor: T('Conductor', '+20% elemental damage over time', 1, 2), catalyst: T('Catalyst', '+1s elemental effect', 1, 3), amp: T('Amplify', '+5% damage to burning/shocked/corroded/frozen targets', 1, 4), nova: T('Nova', 'CAPSTONE: kills on elementally-affected enemies explode', 1, 5, 1),
      tinker: T('Tinker', '+1 harvest per hit', 2, 1), fortify: T('Fortify', '+15% build health', 2, 2), recharge: T('Recharge', '+15% shield refill speed', 2, 3), salvage: T('Salvage', '+10% loot sell value', 2, 4), overcharge: T('Overcharge', 'CAPSTONE: action skill cooldown -30%', 2, 5, 1) } },
};
const ALL = Object.assign({}, ...Object.values(CLASSES).map(c => c.skills));
export const lv = (S, k) => Math.min((S.skills || {})[k] || 0, ALL[k]?.max ?? 3);
export const spent = S => Object.keys(S.skills || {}).reduce((a, k) => a + lv(S, k), 0);
export const skillPts = S => S.rank + 1 + 2 * (S.prestige || 0) - spent(S);
export const branchSpent = (S, cls, br) => Object.entries(CLASSES[cls].skills).filter(([, x]) => x.br === br).reduce((a, [k]) => a + lv(S, k), 0);
export const canLearn = (S, cls, k) => { const X = CLASSES[cls].skills[k]; return skillPts(S) > 0 && lv(S, k) < X.max && branchSpent(S, cls, X.br) >= 2 * (X.tier - 1); };
// Two saved builds per player; the active one lives in S.skills.
export function switchBuild(S, i) { S.builds = S.builds || [{}, {}]; S.builds[S.build || 0] = S.skills; S.build = i; S.skills = S.builds[i] || {}; }
