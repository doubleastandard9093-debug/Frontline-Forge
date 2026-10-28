import { GUNS, ATTACH, RANKS, STATS, xpForRank, BOT_TIERS } from './data.js';
import { MAPS } from './maps.js';
import { load, save, exportCode, importCode, fresh } from './save.js';
import { pickTier } from './gfx.js';
import { pad, initPad, menuNav } from './pad.js';
import { initInput, gyro, enableGyro, gyroSupported, setGyroActive } from './input.js';
import { Game } from './game.js';
import { Sfx } from './audio.js';
import { RARITY, ELEMENTS, sellValue, gunLine, redText, reqRank } from './loot.js';
import { BACKPACK } from './save.js';
import { CLASSES, skillPts, lv, branchSpent, canLearn, switchBuild } from './classes.js';
import { RENTALS, RENT_PLANS, DURABLE, REPAIR, CAMOS, RETICLES, CRATE_PRICE, MAX_PRESTIGE, gpMult, careerResult, weekly, prestige, openCrate, today } from './career.js';

const $ = id => document.getElementById(id);
let S = load(); const tier = pickTier(S);
// High-only realism pack: loaded only on High, so Low never fetches it.
const HF = tier === 'high' ? await import('./hifi.js').catch(e => (console.warn('hifi', e), null)) : null;
const sfx = new Sfx(tier, S.vol ?? 0.7); window.__sfx = sfx;
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => sfx.unlock(), { capture: true, passive: true });
document.addEventListener('click', e => { if (e.target.closest('button')) sfx.play('ui'); });
const canvas = $('game'); let mode = 'tdm', game;
const screens = ['menu', 'play', 'armory', 'stats', 'classes', 'settings', 'pause', 'results'];
function show(id) { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); $('hud').classList.toggle('hidden', id !== null); render(id); }
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === 'menu' && game) { game.dispose(); } show(b.dataset.go); });
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

const toastEl = $('toast'); let toastT, dmgLive = 0;
const hooks = { hf: HF,
  hud(g) {
    $('gyroHint').classList.toggle('hidden', !(gyro.on && gyro.active && gyro.portrait));
    const P = g.player, w = g.slots[g.slot];
    if (g.z) { $('sc0').textContent = 'R' + g.z.round; $('sc1').textContent = g.z.alive + g.z.toSpawn; $('goal').textContent = `${g.map.name} · Zombies · Round ${g.z.round} · ${g.z.alive + g.z.toSpawn} left`; }
    else { $('sc0').textContent = g.score[0]; $('sc1').textContent = g.score[1]; }
    const t = Math.max(0, Math.ceil(g.timeLeft)); $('timer').textContent = g.z ? `${g.z.pts} pts${g.z.insta > 0 ? ' · INSTA ' + Math.ceil(g.z.insta) : ''}${g.z.dbl > 0 ? ' · 2X ' + Math.ceil(g.z.dbl) : ''}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    $('shfill').style.width = Math.max(0, P.sh / P.maxSh * 100) + '%'; $('shbar').classList.toggle('low', P.sh < P.maxSh * 0.25);
    $('hpfill').style.width = Math.max(0, P.hp / P.maxHp * 100) + '%'; $('hptext').textContent = Math.max(0, Math.ceil(P.hp));
    $('wname').textContent = w.pick ? 'Breacher Pick' : w.name;
    $('ammo').textContent = w.pick ? '—' : w.reloading > 0 ? 'RELOAD' : w.reserve !== undefined ? `${w.ammo} | ${w.reserve}` : `${w.ammo} / ${w.mag}`;
    $('mats').textContent = `Wood ${g.mats.wood} · Stone ${g.mats.stone} · ${g.nadeType === 'frag' ? '▶' : ''}Frag ${P.nades.frag} ${g.nadeType === 'plasma' ? '▶' : ''}Plasma ${P.nades.plasma} ${g.nadeType === 'emp' ? '▶' : ''}EMP ${P.nades.emp || 0}`;
    if (g.skill) { const k = g.skill; $('skill').textContent = `[${matchMedia('(pointer: coarse)').matches ? 'SKILL' : 'H'}] ${k.name}: ${k.t > 0 ? 'ACTIVE ' + Math.ceil(k.t) + 's' : k.cdT > 0 ? Math.ceil(k.cdT) + 's' : 'READY'}`; $('skill').classList.toggle('ready', !k.cdT); }
    document.body.classList.toggle('cloaked', g.player.cloakT > 0);
    $('bmode').textContent = g.buildMode ? `BUILD: ${g.buildMode.toUpperCase()} (10 wood)` : '';
    const v = P.vehicle; if (v) { $('wname').textContent = `${v.K.name} · Armor ${Math.ceil(v.hp)}/${v.K.hp}`; const seat = v.seats.find(s => s.unit === P), w1 = v.K.weapons[1]; $('ammo').textContent = seat.role === 'driver' && v.K.mode === 'car' ? `${Math.round(Math.abs(v.speed) * 3.6)} km/h` : w1 ? (w1.ammoMax < 50 ? `${w1.name} ${Math.floor(v.ammo[1])}` : w1.name) : v.K.weapons[0].name;
      if (v.K.mode === 'jet' || v.K.mode === 'heli') $('ammo').textContent += ` · ALT ${Math.round(v.pos.y)}m${v.K.mode === 'jet' ? ` · ${Math.round(v.speed * 3.6)} km/h` : ''}`;
      $('wname').classList.toggle('warn', v.hp < v.K.hp * 0.3); if (v.hp < v.K.hp * 0.3) $('wname').textContent += ' · ARMOR CRITICAL'; }
    $('caps').innerHTML = g.capPoints.map(c => `<span class="cap o${c.owner}">${c.n}</span>`).join('');
    $('prompt').textContent = g.hijack && !g.near ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to hijack ${g.hijack.K.name}` : g.near ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to pilot ${g.near.K.name}` : g.nearPick ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to swap for ${GUNS[g.nearPick.id].name}` : g.nearChest ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to open chest` : (g.zPrompt || '');
    $('dead').classList.toggle('hidden', P.alive);
    $('goal').textContent = g.z ? `${g.map.name} · Zombies · Round ${g.z.round} · ${g.z.alive + g.z.toSpawn} left` : `${g.map.name} · ${g.mode === 'coop' ? 'Co-op vs Bots' : g.map.mode}${g.capPoints.length ? ' (hold points)' : ''} · first to ${g.map.scoreLimit}`;
  },
  tracker(g) {
    const c = $('tracker'), x = c.getContext('2d'), R = c.width / 2, range = 25, P = g.player; x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(10,40,60,.45)'; x.beginPath(); x.arc(R, R, R - 1, 0, 7); x.fill(); x.strokeStyle = 'rgba(127,216,255,.6)'; x.lineWidth = 1;
    for (const r of [0.33, 0.66, 1]) { x.beginPath(); x.arc(R, R, (R - 2) * r, 0, 7); x.stroke(); }
    x.beginPath(); x.moveTo(R, 2); x.lineTo(R, c.height - 2); x.moveTo(2, R); x.lineTo(c.width - 2, R); x.stroke();
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    for (const u of g.units) { if (u === P || !u.alive) continue; const dx = u.pos.x - P.pos.x, dz = u.pos.z - P.pos.z; if (Math.hypot(dx, dz) > range) continue;
      if (u.team !== P.team && u.spd < 1.2 && u.firedT <= 0) continue; // crouch-walking/still enemies stay off the tracker
      const rx = dx * cy - dz * sy, rz = dx * sy + dz * cy; x.fillStyle = u.team === P.team ? '#ffd84a' : '#ff3b30';
      x.beginPath(); x.arc(R + rx / range * (R - 4), R + rz / range * (R - 4), 4, 0, 7); x.fill(); }
    for (const v of g.vehicles) if (v.alive) { const dx = v.pos.x - P.pos.x, dz = v.pos.z - P.pos.z; if (Math.hypot(dx, dz) > range) continue; const rx = dx * cy - dz * sy, rz = dx * sy + dz * cy;
      x.fillStyle = v.team === P.team ? '#ffd84a' : '#ff3b30'; x.fillRect(R + rx / range * (R - 4) - 5, R + rz / range * (R - 4) - 5, 10, 10); }
  },
  // Minimap (player-centred) and full overview map. Enemies only appear while firing.
  maps(g, showOverview) {
    drawMap(g, $('minimap'), false); const ov = $('overview'); ov.classList.toggle('hidden', !showOverview); if (showOverview) drawMap(g, ov, true);
  },
  toast(m, html) { if (html) toastEl.innerHTML = m; else toastEl.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => toastEl.textContent = '', html ? 3000 : 1200); },
  persist() { save(S); },
  dmgNum(pos, n, elem, head) { // floating damage numbers, pooled and capped (fewer on Low)
    if (dmgLive >= (tier === 'low' ? 10 : 24) || !game) return; const v = pos.clone(); v.y += 2.1 + Math.random() * 0.3; v.x += (Math.random() - 0.5) * 0.6; v.project(game.camera); if (v.z > 1) return;
    const d = document.createElement('div'); d.className = 'dmgn' + (head ? ' crit' : ''); d.textContent = Math.max(1, Math.round(n)); d.style.color = elem ? ELEMENTS[elem].css : head ? '#ffd23a' : '#fff';
    d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; document.body.appendChild(d); dmgLive++; setTimeout(() => { d.remove(); dmgLive--; }, 750); },
  hitmark(head) { sfx.play(head ? 'head' : 'hit'); const h = $('hitm'); h.classList.toggle('head', head); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 120); },
  shieldPop() { const h = $('pop'); h.classList.remove('go'); void h.offsetWidth; h.classList.add('go'); },
  hurt() { const h = $('hurt'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 200); },
  feed(a, b, head) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = `<span class="${a.team ? 'red' : 'blue'}">${a.name}</span> ${head ? '◎' : '›'} <span class="${b.team ? 'red' : 'blue'}">${b.name}</span>`;
    f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); setTimeout(() => d.remove(), 5000); },
  scope(on) { $('scope').classList.toggle('hidden', !on); $('cross').style.display = on ? 'none' : ''; },
  board(on) { const b = $('board'); b.classList.toggle('hidden', !on); if (!on || !game) return;
    const rows = game.units.slice().sort((a, c) => c.kills - a.kills).map(u => `<tr class="${u.team ? 'red' : 'blue'}"><td>${u.name}</td><td>${u.kills}</td><td>${u.deaths}</td></tr>`).join('');
    b.innerHTML = `<table><tr><td>Soldier</td><td>K</td><td>D</td></tr>${rows}</table>`; },
  spawnSelect(opts) { $('spawnsel').classList.remove('hidden'); hooks.spawnRefresh(opts); },
  spawnRefresh(opts) { const key = opts.map(o => o.id).join(); if ($('spawnsel').dataset.k === key) return; $('spawnsel').dataset.k = key;
    $('spawnopts').innerHTML = opts.map(o => `<button data-sp="${o.id}">${o.name}</button>`).join('');
    document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { if (game.chooseSpawn(b.dataset.sp)) { $('spawnsel').classList.add('hidden'); $('spawnsel').dataset.k = ''; } else b.disabled = true; }); },
  pause() { game.paused = true; document.exitPointerLock?.(); show('pause'); },
  end(r) { applyResult(r); },
};
$('resume').onclick = () => { show(null); game.paused = false; };
$('quit').onclick = () => { game.dispose(); show('menu'); };
initInput(canvas, () => game && game.running && !game.paused);
// Xbox controller (Bluetooth/USB)
Object.assign(pad, { sens: S.padSens ?? 1, invertY: !!S.padInv, dz: S.padDz ?? 0.15, rumbleOn: S.padRumble ?? true,
  isActive: () => !!(game && game.running && !game.paused), inVehicle: () => !!game?.player?.vehicle,
  onConnect: () => { hooks.toast('🎮 Controller connected'); renderPad(); }, onDisconnect: () => { hooks.toast('Controller disconnected'); renderPad(); },
  onMenu: d => { const scr = screens.map($).find(e => !e.classList.contains('hidden')); if (!scr) return;
    if (d === 'start' && scr.id === 'pause') { $('pause').querySelector('button')?.click(); return; }
    menuNav(scr, d, () => { const b = scr.querySelector('[data-go="menu"],[data-go="play"]'); if (scr.id === 'pause') scr.querySelector('button')?.click(); else if (b) b.click(); }); } });
initPad();
function renderPad() { if (!$('padSens')) return; $('padSens').value = pad.sens; $('padInv').checked = pad.invertY; $('padRumble').checked = pad.rumbleOn; $('padDz').value = pad.dz;
  $('padNote').textContent = pad.connected ? 'Connected: ' + pad.id : 'No controller. Pair an Xbox controller over Bluetooth (iPhone: Settings > Bluetooth), then press any button.'; }
$('padSens').oninput = e => { pad.sens = S.padSens = +e.target.value; save(S); };
$('padDz').oninput = e => { pad.dz = S.padDz = +e.target.value; save(S); };
$('padInv').onchange = e => { pad.invertY = S.padInv = e.target.checked; save(S); };
$('padRumble').onchange = e => { pad.rumbleOn = S.padRumble = e.target.checked; save(S); };
setGyroActive(() => game && game.running && !game.paused && !game.choosing);
Object.assign(gyro, { on: !!S.gyro, sens: S.gyroSens ?? 1, invertX: !!S.gyroInvX, invertY: !!S.gyroInv, adsOnly: !!S.gyroAds });
const isTouch = matchMedia('(pointer: coarse)').matches;
function gyroStatus(t) { $('gyroNote').textContent = t || (!gyroSupported() ? 'Gyro needs a phone and HTTPS (the GitHub Pages link works; add to Home Screen from Safari).' : gyro.granted ? 'Gyro ready. Hold the phone sideways (landscape): turn or tilt left/right to look around, tilt toward/away to look up/down. Touch look still works.' : 'Tap Enable gyro to allow motion access.'); }
function askGyro() { return enableGyro().then(ok => { if (ok) { S.gyro = true; gyro.on = true; S.gyroAsked = true; save(S); } else gyroStatus('Motion access was denied. On iPhone: remove and re-add the Home Screen app, or allow Motion & Orientation for Safari, then tap Enable gyro again.'); renderGyro(); return ok; }); }
function renderGyro() { $('gyroOn').checked = gyro.on; $('gyroSens').value = gyro.sens; $('gyroInv').checked = gyro.invertY; $('gyroInvX').checked = gyro.invertX; $('gyroAds').checked = gyro.adsOnly; gyroStatus(); }
$('gyroBtn').onclick = () => askGyro();
$('gyroOn').onchange = e => { if (e.target.checked && !gyro.granted) { askGyro(); return; } gyro.on = S.gyro = e.target.checked; save(S); };
$('gyroSens').oninput = e => { gyro.sens = S.gyroSens = +e.target.value; save(S); };
$('gyroInv').onchange = e => { gyro.invertY = S.gyroInv = e.target.checked; save(S); };
$('gyroInvX').onchange = e => { gyro.invertX = S.gyroInvX = e.target.checked; save(S); };
$('gyroAds').onchange = e => { gyro.adsOnly = S.gyroAds = e.target.checked; save(S); };
// returning players who already enabled it: re-request on the first tap (iOS forgets per session, prompt shows only once)
if (S.gyro) addEventListener('touchend', function once() { removeEventListener('touchend', once); enableGyro(); }, { passive: true });

function drawMap(g, c, full) {
  const x = c.getContext('2d'), W = c.width, H = c.height, P = g.player, size = g.map.size;
  const span = full ? size + 10 : Math.min(size, 110), cx = full ? 0 : P.pos.x, cz = full ? 0 : P.pos.z, k = W / span;
  const tx = wx => W / 2 + (wx - cx) * k, tz = wz => H / 2 + (wz - cz) * k;
  x.clearRect(0, 0, W, H); x.save(); if (!full) { x.beginPath(); x.arc(W / 2, H / 2, W / 2 - 1, 0, 7); x.clip(); }
  x.fillStyle = 'rgba(60,72,48,.85)'; x.fillRect(tx(-size / 2), tz(-size / 2), size * k, size * k);
  x.fillStyle = 'rgba(50,110,150,.9)'; for (const w of (g.layout.water || [])) x.fillRect(tx(w[0]), tz(w[2]), (w[1] - w[0]) * k, (w[3] - w[2]) * k);
  x.fillStyle = 'rgba(170,170,160,.85)'; for (const s of g.solids) if (!s.vehicle && !s.obj && s.max.x - s.min.x < size) x.fillRect(tx(s.min.x), tz(s.min.z), Math.max(1, (s.max.x - s.min.x) * k), Math.max(1, (s.max.z - s.min.z) * k));
  x.fillStyle = 'rgba(200,150,90,.9)'; for (const b of g.builds) x.fillRect(tx(b.g.x) - 2, tz(b.g.z) - 2, 4, 4);
  x.font = `bold ${full ? 14 : 10}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const p of g.capPoints) { x.fillStyle = p.owner === 0 ? '#2f6fd8' : p.owner === 1 ? '#d84a2f' : '#999'; x.beginPath(); x.arc(tx(p.x), tz(p.z), full ? 11 : 7, 0, 7); x.fill();
    if (p.contested) { x.strokeStyle = '#ff0'; x.lineWidth = 2; x.stroke(); } x.fillStyle = '#fff'; x.fillText(p.n, tx(p.x), tz(p.z)); }
  for (const v of g.vehicles) if (v.alive && (v.team === P.team || v.seats.some(s => s.unit && s.unit.firedT > 0))) { x.fillStyle = v.team === P.team ? '#ffd84a' : '#ff3b30'; x.fillRect(tx(v.pos.x) - 4, tz(v.pos.z) - 4, 8, 8); }
  for (const u of g.units) if (u.alive && u !== P && !u.vehicle && (u.team === P.team || u.firedT > 0)) { x.fillStyle = u.team === P.team ? '#ffd84a' : '#ff3b30'; x.beginPath(); x.arc(tx(u.pos.x), tz(u.pos.z), full ? 4 : 3, 0, 7); x.fill(); }
  x.translate(tx(P.pos.x), tz(P.pos.z)); x.rotate(-P.yaw); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -8); x.lineTo(5, 6); x.lineTo(-5, 6); x.fill(); x.restore();
  if (!full) { x.strokeStyle = 'rgba(127,216,255,.7)'; x.lineWidth = 2; x.beginPath(); x.arc(W / 2, H / 2, W / 2 - 1, 0, 7); x.stroke(); }
}
function applyResult(r) {
  $('spawnsel').classList.add('hidden'); $('spawnsel').dataset.k = '';
  if (r.escaped) S.zescapes = (S.zescapes || 0) + 1; if (r.zombies) { S.zbest = Math.max(S.zbest || 0, r.round); S.ztotal = (S.ztotal || 0) + r.round; }
  r.gp = Math.round(r.gp * gpMult(S)); const extra = careerResult(S, r);
  S.xp += r.xp; S.gp += r.gp; S.totals.kills += r.stats.kills; S.totals.deaths += r.stats.deaths; S.totals.matches++; if (r.won) S.totals.wins++;
  const before = S.rank; while (S.rank < RANKS.length - 1 && S.xp >= xpForRank(S.rank)) { S.rank++; S.points += 1; S.gp += 250; }
  save(S);
  $('rtitle').textContent = r.escaped ? `ESCAPED GRAVEWATCH (round ${r.round})` : r.zombies ? `SURVIVED ${Math.max(0, r.round - 1)} ROUND${r.round === 2 ? '' : 'S'}` : r.won ? 'VICTORY' : 'DEFEAT';
  $('rbody').innerHTML = `<p>${r.zombies ? `Reached round ${r.round} · Best ${S.zbest}` : `Score ${r.score[0]} – ${r.score[1]}`}</p><p>Kills ${r.stats.kills} · Deaths ${r.stats.deaths} · Headshots ${r.stats.head} · Builds ${r.stats.builds}</p>
    <p><b>+${r.xp} XP</b> · <b>+${r.gp} GP</b></p>${extra.map(t => `<p class="note">${t}</p>`).join('')}${S.rank > before ? `<h3>RANK UP! You are now ${RANKS[S.rank]}</h3><p>+${S.rank - before} stat point(s), +${(S.rank - before) * 250} GP bonus</p>` : ''}`;
  show('results');
}

function startMatch(id) {
  for (const k of ['primary', 'secondary']) if (RENTALS[S.loadout[k]] && !S.rent[S.loadout[k]]) S.loadout[k] = k === 'primary' ? 'kr4' : 'vx9';
  if (isTouch && !S.gyroAsked && gyroSupported()) { S.gyroAsked = true; save(S); askGyro(); } /* first match start: ask inside this tap */ $('spawnsel').classList.add('hidden'); $('spawnsel').dataset.k = ''; game = game || new Game(canvas, tier, S, hooks); game.paused = false; show(null); game.start(id, mode); game.sfx = (n, p) => sfx.play(n, p, p && game.camera.position); game.engine = (k, t) => sfx.setEngine(k, t); }

function rankHtml() {
  const prev = S.rank ? xpForRank(S.rank - 1) : 0, next = xpForRank(S.rank), pct = Math.min(100, (S.xp - prev) / (next - prev) * 100);
  return `<div>${S.prestige ? `<span class="badge">★P${S.prestige}</span> ` : ''}<b>${RANKS[S.rank]}</b> · ${S.xp} XP · ${S.gp} GP</div><div class="bar"><i style="width:${pct}%"></i></div><small>${next - S.xp} XP to ${RANKS[S.rank + 1] || 'max'}</small>`;
}
function render(id) {
  if (id === 'menu') $('profile').innerHTML = rankHtml();
  if (id === 'play') {
    $('bottier').innerHTML = Object.entries(BOT_TIERS).map(([k, t]) => `<button data-bt="${k}" class="${(S.botTier || 'regular') === k ? 'on' : ''}">${t.name}<small>${Math.round(t.react * 1000)}ms react · aim ×${t.aim}</small></button>`).join('');
    document.querySelectorAll('#bottier button').forEach(b => b.onclick = () => { S.botTier = b.dataset.bt; save(S); render('play'); });
    document.querySelectorAll('#modes button').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.onclick = () => { mode = b.dataset.mode; render('play'); }; });
    $('maps').innerHTML = Object.entries(MAPS).filter(([k, m]) => (m.type === 'zombies') === (mode === 'zombies')).map(([k, m]) => `<button class="card" data-map="${k}"><span class="tag">${{ small: 'SMALL · QUICK', large: 'ARENA · BIG BATTLE', war: 'FULL-SCALE · LAND, SEA & AIR', zombies: 'ZOMBIES · ROUND SURVIVAL' }[m.type]}</span><b>${m.name}</b><small>${m.type === 'zombies' ? `${m.desc} You + ${m.teamSize - 1} bot squadmates. Best: round ${S.zbest || 0}` : `${m.desc} ${m.teamSize}v${mode === 'coop' ? Math.round(m.teamSize * 1.5) : m.teamSize}, first to ${m.scoreLimit}, ${m.time / 60} min`}</small></button>`).join('');
    document.querySelectorAll('[data-map]').forEach(b => b.onclick = () => startMatch(b.dataset.map));
  }
  if (id === 'armory') renderShop();
  if (id === 'stats') renderStats();
  if (id === 'classes') renderClasses();
  if (id === 'settings') {
    $('gLow').classList.toggle('on', tier === 'low'); $('gHigh').classList.toggle('on', tier === 'high'); $('sens').value = S.sens || 1; $('vol').value = S.vol ?? 0.7; renderGyro(); renderPad();
  }
}
function renderShop() {
  $('gp').innerHTML = rankHtml();
  const eqName = id => id[0] === 'L' ? (S.inv.find(x => 'L' + x.uid === id)?.name || '?') : (GUNS[id] || RENTALS[id])?.name;
  $('backpack').innerHTML = `<h3>Backpack ${S.inv.length}/${BACKPACK}</h3><p class="note">Loot drops from enemies and chests. Equipped: ${eqName(S.loadout.primary)} / ${eqName(S.loadout.secondary)}</p>` + (S.inv.length ? '' : '<p class="note">Empty. Kill enemies and open chests to find loot guns.</p>') +
    S.inv.slice().sort((a, b) => b.rarity - a.rarity).map(g => { const id = 'L' + g.uid, slot = g.type === 'pistol' ? 'secondary' : 'primary', eq = S.loadout[slot] === id;
      return `<div class="item loot" style="border-left:4px solid ${RARITY[g.rarity].css}"><div class="nm"><b style="color:${RARITY[g.rarity].css}">${g.name}</b> <small>${RARITY[g.rarity].name} · Lv ${g.lvl}${reqRank(g) ? ` · Req. ${RANKS[reqRank(g)]}` : ''} · ${gunLine(g)}</small>${redText(g) ? '<br>' + redText(g) : ''}</div>
      <button data-leq="${id}" class="${eq ? 'on' : ''}" ${S.rank < reqRank(g) && !S.prestige ? 'disabled' : ''}>${eq ? 'Equipped' : S.rank < reqRank(g) && !S.prestige ? 'Locked' : 'Equip ' + slot}</button><button data-sell="${g.uid}" class="danger">Sell ${sellValue(g)} GP</button></div>`; }).join('');
  document.querySelectorAll('[data-leq]').forEach(b => b.onclick = () => { const g = S.inv.find(x => 'L' + x.uid === b.dataset.leq); S.loadout[g.type === 'pistol' ? 'secondary' : 'primary'] = b.dataset.leq; save(S); renderShop(); });
  document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const uid = +b.dataset.sell, g = S.inv.find(x => x.uid === uid); S.gp += Math.round(sellValue(g) * (S.cls === 'sparkwright' ? 1 + 0.1 * lv(S, 'salvage') : 1)); S.inv = S.inv.filter(x => x !== g);
    if (S.loadout.primary === 'L' + uid) S.loadout.primary = 'kr4'; if (S.loadout.secondary === 'L' + uid) S.loadout.secondary = 'vx9'; save(S); renderShop(); });
  $('shop').innerHTML = Object.entries(GUNS).map(([id, g]) => {
    const own = S.owned.includes(id), lock = S.rank < g.rank, slot = g.type === 'pistol' ? 'secondary' : 'primary', eq = S.loadout[slot] === id;
    const att = own ? `<div class="att">${Object.entries(ATTACH).map(([a, A]) => { const has = S.ownedAttach.includes(a), on = (S.attach[id] || {})[A.slot] === a, lk = S.rank < A.rank;
      return `<button data-att="${id}:${a}" class="${on ? 'on' : ''} ${lk ? 'locked' : ''}">${A.name}<small>${lk ? 'Rank ' + RANKS[A.rank] : has ? (on ? 'Equipped' : 'Equip') : A.price + ' GP'}</small></button>`; }).join('')}</div>` : '';
    return `<div class="item ${lock ? 'locked' : ''}"><div class="nm"><b>${g.name}</b> <small>${g.type.toUpperCase()} · DMG ${g.dmg} · ${g.rpm} RPM · MAG ${g.mag}</small></div>
      ${own ? `<button data-eq="${id}" class="${eq ? 'on' : ''}">${eq ? 'Equipped' : 'Equip ' + slot}</button>` : lock ? `<span>Unlocks at ${RANKS[g.rank]}</span>` : `<button data-buy="${id}">Buy ${g.price} GP</button>`}${att}</div>`;
  }).join('');
  $('rentals').innerHTML = '<p class="note">Top-tier guns for a limited number of matches.</p>' + Object.entries(RENTALS).map(([id, g]) => { const left = S.rent[id], slot = g.type === 'pistol' ? 'secondary' : 'primary', eq = S.loadout[slot] === id;
    return `<div class="item"><div class="nm"><b>${g.name}</b> <small>${g.type.toUpperCase()} · DMG ${g.dmg} · ${g.rpm} RPM · MAG ${g.mag}${left ? ` · ${left} matches left` : ''}</small></div>${left ? `<button data-eq="${id}" class="${eq ? 'on' : ''}">${eq ? 'Equipped' : 'Equip'}</button>` : ''}${RENT_PLANS.map((p, i) => `<button data-rent="${id}:${i}">Rent ${p.matches} matches · ${p.price} GP</button>`).join('')}</div>`; }).join('') +
    DURABLE.filter(id => S.owned.includes(id)).map(id => `<div class="item"><div class="nm"><b>${GUNS[id].name}</b> <small>Durability ${S.dura[id] ?? 100}% (−5% per match used; at 0% it does −20% damage)</small></div><button data-rep="${id}" ${(S.dura[id] ?? 100) < 100 ? '' : 'disabled'}>Repair ${REPAIR} GP</button></div>`).join('');
  document.querySelectorAll('[data-rent]').forEach(b => b.onclick = () => { const [id, i] = b.dataset.rent.split(':'), p = RENT_PLANS[i]; if (S.gp < p.price) return alert('Not enough GP'); S.gp -= p.price; S.rent[id] = (S.rent[id] || 0) + p.matches; save(S); renderShop(); });
  document.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { if (S.gp < REPAIR) return alert('Not enough GP'); S.gp -= REPAIR; S.dura[b.dataset.rep] = 100; save(S); renderShop(); });
  const C = S.cos;
  $('cosmetics').innerHTML = `<p class="note">Supply crate: a random camo or reticle (duplicates refund 300 GP). Camos are flat color swaps, so they cost nothing on Low.</p><button id="crate">Open supply crate · ${CRATE_PRICE} GP</button><p id="crateRes" class="note"></p>
    <div class="att">${C.camos.map(k => `<button data-camo="${k}" class="${C.camo === k ? 'on' : ''}"><span style="display:inline-block;width:10px;height:10px;background:#${CAMOS[k].color.toString(16).padStart(6, '0')}"></span> ${CAMOS[k].name}</button>`).join('')}</div>
    <div class="att">${C.rets.map(k => `<button data-reticle="${k}" class="${C.ret === k ? 'on' : ''}">${RETICLES[k]}</button>`).join('')}</div>`;
  $('crate').onclick = () => { const r = openCrate(S); if (!r) return alert('Not enough GP'); save(S); renderShop(); $('crateRes').textContent = `Crate: ${r.kind === 'camo' ? 'Camo ' + CAMOS[r.k].name : 'Reticle ' + RETICLES[r.k]}${r.dup ? ' (duplicate, +300 GP)' : ' — new!'}`; };
  document.querySelectorAll('[data-camo]').forEach(b => b.onclick = () => { C.camo = b.dataset.camo; save(S); renderShop(); });
  document.querySelectorAll('[data-reticle]').forEach(b => b.onclick = () => { C.ret = b.dataset.reticle; $('cross').dataset.ret = C.ret; save(S); renderShop(); });
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const g = GUNS[b.dataset.buy]; if (S.gp < g.price) return alert('Not enough GP'); S.gp -= g.price; S.owned.push(b.dataset.buy); save(S); renderShop(); });
  document.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const id = b.dataset.eq; S.loadout[(GUNS[id] || RENTALS[id]).type === 'pistol' ? 'secondary' : 'primary'] = id; save(S); renderShop(); });
  document.querySelectorAll('[data-att]').forEach(b => b.onclick = () => { const [id, a] = b.dataset.att.split(':'), A = ATTACH[a]; if (S.rank < A.rank) return;
    if (!S.ownedAttach.includes(a)) { if (S.gp < A.price) return alert('Not enough GP'); S.gp -= A.price; S.ownedAttach.push(a); }
    const cur = S.attach[id] || (S.attach[id] = {}); cur[A.slot] = cur[A.slot] === a ? undefined : a; save(S); renderShop(); });
}
function renderClasses() {
  const pts = skillPts(S), b = S.build || 0;
  $('classlist').innerHTML = `<p>${rankHtml()}</p><p>Skill points: <b>${pts}</b> (1 per rank, +2 per prestige). Each class has 3 branches × 5 tiers; a tier opens after 2 points per earlier tier in that branch. Capstones (tier 5) change how your class plays.</p>
    <div class="att">Build: ${[0, 1].map(i => `<button data-build="${i}" class="${b === i ? 'on' : ''}">Loadout ${i + 1}</button>`).join('')}</div>` + Object.entries(CLASSES).map(([k, C]) =>
    `<div class="item cls ${S.cls === k ? 'on' : ''}" style="border-left:4px solid ${C.color}"><div class="nm"><b style="color:${C.color}">${C.name}</b> <small>${C.role} · Action skill (H / SKILL): <b>${C.action.name}</b> — ${C.action.desc}, ${C.action.dur}s, ${C.action.cd}s cooldown</small>
      ${S.cls === k ? `<div class="tree">${C.branches.map((bn, bi) => `<div class="branch"><h4>${bn} <small>${branchSpent(S, k, bi)} pts</small></h4>${Object.entries(C.skills).filter(([, X]) => X.br === bi).map(([sk, X]) => { const open = branchSpent(S, k, bi) >= 2 * (X.tier - 1);
        return `<div class="row ${open ? '' : 'locked'} ${X.tier === 5 ? 'cap' : ''}"><span>T${X.tier} ${X.name} ${lv(S, sk)}/${X.max} <small>${X.desc}</small></span><button data-sk="${sk}" ${canLearn(S, k, sk) ? '' : 'disabled'}>+1</button></div>`; }).join('')}</div>`).join('')}</div>` : ''}</div>
      <button data-cls="${k}" class="${S.cls === k ? 'on' : ''}">${S.cls === k ? 'Selected' : 'Select'}</button></div>`).join('') +
    `<button id="respec" class="danger">Reset this loadout's skill points (100 GP)</button>`;
  document.querySelectorAll('[data-build]').forEach(x => x.onclick = () => { switchBuild(S, +x.dataset.build); save(S); renderClasses(); });
  document.querySelectorAll('[data-cls]').forEach(x => x.onclick = () => { S.cls = x.dataset.cls; save(S); renderClasses(); });
  document.querySelectorAll('[data-sk]').forEach(x => x.onclick = () => { if (!canLearn(S, S.cls, x.dataset.sk)) return; S.skills[x.dataset.sk] = lv(S, x.dataset.sk) + 1; save(S); renderClasses(); });
  $('respec').onclick = () => { if (S.gp < 100) return alert('Not enough GP'); S.gp -= 100; S.skills = {}; save(S); renderClasses(); };
}
function renderStats() {
  const wk = weekly(S);
  $('career').innerHTML = `<h3>Weekly challenges</h3>${wk.map(c => `<div class="item"><div class="nm"><b>${c.done ? '✔ ' : ''}${c.d}</b> <small>${Math.min(c.p, c.n)}/${c.n} · reward 1500 XP + 1500 GP</small></div></div>`).join('')}
    <p class="note">First win of the day: ${S.dailyWin === today() ? 'claimed today ✔' : '+1000 XP, +500 GP (or reach Zombies round 6)'} · GP bonus from prestige: +${Math.round((gpMult(S) - 1) * 100)}%</p>
    <h3>Prestige ${S.prestige || 0}/${MAX_PRESTIGE}</h3><p class="note">At General you can prestige: rank resets to Recruit, you keep guns, loot and stats, and gain a badge, +5% GP, +2 skill points and 2000 GP.</p>
    <button id="prestige" class="danger" ${S.rank >= 16 && (S.prestige || 0) < MAX_PRESTIGE ? '' : 'disabled'}>Prestige</button>`;
  $('prestige').onclick = () => { if (confirm('Reset your rank to Recruit for a prestige badge?') && prestige(S)) { save(S); renderStats(); } };
  $('statlist').innerHTML = `<p>${rankHtml()}</p><p>Unspent points: <b>${S.points}</b> (1 per rank up)</p>` + Object.entries(STATS).map(([k, s]) =>
    `<div class="item"><div class="nm"><b>${s.name}</b> ${S.stats[k]}/${s.max}<small>${s.desc} per level</small></div><button data-st="${k}" ${S.points && S.stats[k] < s.max ? '' : 'disabled'}>+1</button></div>`).join('') +
    `<p class="note">Career: ${S.totals.matches} matches · ${S.totals.wins} wins · ${S.totals.kills} kills · ${S.totals.deaths} deaths</p>`;
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { S.points--; S.stats[b.dataset.st]++; save(S); renderStats(); });
}
$('gLow').onclick = () => { S.gfx = 'low'; save(S); location.search = ''; };
$('gHigh').onclick = () => { S.gfx = 'high'; save(S); location.search = ''; };
$('vol').oninput = e => { S.vol = +e.target.value; sfx.setVol(S.vol); save(S); };
$('sens').oninput = e => { S.sens = +e.target.value; save(S); };
$('exp').onclick = () => { $('code').value = exportCode(S); $('code').select(); navigator.clipboard?.writeText($('code').value).catch(() => {}); };
$('imp').onclick = () => { try { S = importCode($('code').value); save(S); alert('Save imported'); location.reload(); } catch (e) { alert('Invalid save code'); } };
$('wipe').onclick = () => { if (confirm('Reset all progress?')) { S = fresh(); save(S); location.reload(); } };
window.__ff = { get game() { return game; }, get save() { return S; }, tier, startMatch, setMode: m => mode = m };
$('cross').dataset.ret = S.cos.ret;
show('menu');
