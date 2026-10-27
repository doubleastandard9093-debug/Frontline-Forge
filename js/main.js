import { GUNS, ATTACH, RANKS, STATS, xpForRank } from './data.js';
import { MAPS } from './maps.js';
import { load, save, exportCode, importCode, fresh } from './save.js';
import { pickTier } from './gfx.js';
import { initInput, gyro, enableGyro, gyroSupported, setGyroActive } from './input.js';
import { Game } from './game.js';
import { Sfx } from './audio.js';

const $ = id => document.getElementById(id);
let S = load(); const tier = pickTier(S);
const sfx = new Sfx(tier, S.vol ?? 0.7); window.__sfx = sfx;
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => sfx.unlock(), { capture: true, passive: true });
document.addEventListener('click', e => { if (e.target.closest('button')) sfx.play('ui'); });
const canvas = $('game'); let mode = 'tdm', game;
const screens = ['menu', 'play', 'armory', 'stats', 'settings', 'pause', 'results'];
function show(id) { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); $('hud').classList.toggle('hidden', id !== null); render(id); }
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === 'menu' && game) { game.dispose(); } show(b.dataset.go); });
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

const toastEl = $('toast'); let toastT;
const hooks = {
  hud(g) {
    $('gyroHint').classList.toggle('hidden', !(gyro.on && gyro.active && gyro.portrait));
    const P = g.player, w = g.slots[g.slot];
    $('sc0').textContent = g.score[0]; $('sc1').textContent = g.score[1];
    const t = Math.max(0, Math.ceil(g.timeLeft)); $('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    $('shfill').style.width = Math.max(0, P.sh / P.maxSh * 100) + '%'; $('shbar').classList.toggle('low', P.sh < P.maxSh * 0.25);
    $('hpfill').style.width = Math.max(0, P.hp / P.maxHp * 100) + '%'; $('hptext').textContent = Math.max(0, Math.ceil(P.hp));
    $('wname').textContent = w.pick ? 'Breacher Pick' : w.name;
    $('ammo').textContent = w.pick ? '—' : w.reloading > 0 ? 'RELOAD' : `${w.ammo} / ${w.mag}`;
    $('mats').textContent = `Wood ${g.mats.wood} · Stone ${g.mats.stone} · ${g.nadeType === 'frag' ? '▶' : ''}Frag ${P.nades.frag} ${g.nadeType === 'plasma' ? '▶' : ''}Plasma ${P.nades.plasma}`;
    $('bmode').textContent = g.buildMode ? `BUILD: ${g.buildMode.toUpperCase()} (10 wood)` : '';
    const v = P.vehicle; if (v) { $('wname').textContent = `${v.K.name} · Armor ${Math.ceil(v.hp)}/${v.K.hp}`; const seat = v.seats.find(s => s.unit === P), w1 = v.K.weapons[1]; $('ammo').textContent = seat.role === 'driver' && v.K.mode === 'car' ? `${Math.round(Math.abs(v.speed) * 3.6)} km/h` : w1 ? (w1.ammoMax < 50 ? `${w1.name} ${Math.floor(v.ammo[1])}` : w1.name) : v.K.weapons[0].name;
      if (v.K.mode === 'jet' || v.K.mode === 'heli') $('ammo').textContent += ` · ALT ${Math.round(v.pos.y)}m${v.K.mode === 'jet' ? ` · ${Math.round(v.speed * 3.6)} km/h` : ''}`;
      $('wname').classList.toggle('warn', v.hp < v.K.hp * 0.3); if (v.hp < v.K.hp * 0.3) $('wname').textContent += ' · ARMOR CRITICAL'; }
    $('caps').innerHTML = g.capPoints.map(c => `<span class="cap o${c.owner}">${c.n}</span>`).join('');
    $('prompt').textContent = g.near ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to pilot ${g.near.K.name}` : g.nearPick ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to swap for ${GUNS[g.nearPick.id].name}` : '';
    $('dead').classList.toggle('hidden', P.alive);
    $('goal').textContent = `${g.map.name} · ${g.mode === 'coop' ? 'Co-op vs Bots' : g.map.mode}${g.capPoints.length ? ' (hold points)' : ''} · first to ${g.map.scoreLimit}`;
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
  toast(m) { toastEl.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => toastEl.textContent = '', 1200); },
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
  S.xp += r.xp; S.gp += r.gp; S.totals.kills += r.stats.kills; S.totals.deaths += r.stats.deaths; S.totals.matches++; if (r.won) S.totals.wins++;
  const before = S.rank; while (S.rank < RANKS.length - 1 && S.xp >= xpForRank(S.rank)) { S.rank++; S.points += 1; S.gp += 250; }
  save(S);
  $('rtitle').textContent = r.won ? 'VICTORY' : 'DEFEAT';
  $('rbody').innerHTML = `<p>Score ${r.score[0]} – ${r.score[1]}</p><p>Kills ${r.stats.kills} · Deaths ${r.stats.deaths} · Headshots ${r.stats.head} · Builds ${r.stats.builds}</p>
    <p><b>+${r.xp} XP</b> · <b>+${r.gp} GP</b></p>${S.rank > before ? `<h3>RANK UP! You are now ${RANKS[S.rank]}</h3><p>+${S.rank - before} stat point(s), +${(S.rank - before) * 250} GP bonus</p>` : ''}`;
  show('results');
}

function startMatch(id) {
  if (isTouch && !S.gyroAsked && gyroSupported()) { S.gyroAsked = true; save(S); askGyro(); } /* first match start: ask inside this tap */ $('spawnsel').classList.add('hidden'); $('spawnsel').dataset.k = ''; game = game || new Game(canvas, tier, S, hooks); game.paused = false; show(null); game.start(id, mode); game.sfx = (n, p) => sfx.play(n, p, p && game.camera.position); game.engine = (k, t) => sfx.setEngine(k, t); }

function rankHtml() {
  const prev = S.rank ? xpForRank(S.rank - 1) : 0, next = xpForRank(S.rank), pct = Math.min(100, (S.xp - prev) / (next - prev) * 100);
  return `<div><b>${RANKS[S.rank]}</b> · ${S.xp} XP · ${S.gp} GP</div><div class="bar"><i style="width:${pct}%"></i></div><small>${next - S.xp} XP to ${RANKS[S.rank + 1] || 'max'}</small>`;
}
function render(id) {
  if (id === 'menu') $('profile').innerHTML = rankHtml();
  if (id === 'play') {
    document.querySelectorAll('#modes button').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.onclick = () => { mode = b.dataset.mode; render('play'); }; });
    $('maps').innerHTML = Object.entries(MAPS).map(([k, m]) => `<button class="card" data-map="${k}"><span class="tag">${{ small: 'SMALL · QUICK', large: 'ARENA · BIG BATTLE', war: 'FULL-SCALE · LAND, SEA & AIR' }[m.type]}</span><b>${m.name}</b><small>${m.desc} ${m.teamSize}v${mode === 'coop' ? Math.round(m.teamSize * 1.5) : m.teamSize}, first to ${m.scoreLimit}, ${m.time / 60} min</small></button>`).join('');
    document.querySelectorAll('[data-map]').forEach(b => b.onclick = () => startMatch(b.dataset.map));
  }
  if (id === 'armory') renderShop();
  if (id === 'stats') renderStats();
  if (id === 'settings') {
    $('gLow').classList.toggle('on', tier === 'low'); $('gHigh').classList.toggle('on', tier === 'high'); $('sens').value = S.sens || 1; $('vol').value = S.vol ?? 0.7; renderGyro();
  }
}
function renderShop() {
  $('gp').innerHTML = rankHtml();
  $('shop').innerHTML = Object.entries(GUNS).map(([id, g]) => {
    const own = S.owned.includes(id), lock = S.rank < g.rank, slot = g.type === 'pistol' ? 'secondary' : 'primary', eq = S.loadout[slot] === id;
    const att = own ? `<div class="att">${Object.entries(ATTACH).map(([a, A]) => { const has = S.ownedAttach.includes(a), on = (S.attach[id] || {})[A.slot] === a, lk = S.rank < A.rank;
      return `<button data-att="${id}:${a}" class="${on ? 'on' : ''} ${lk ? 'locked' : ''}">${A.name}<small>${lk ? 'Rank ' + RANKS[A.rank] : has ? (on ? 'Equipped' : 'Equip') : A.price + ' GP'}</small></button>`; }).join('')}</div>` : '';
    return `<div class="item ${lock ? 'locked' : ''}"><div class="nm"><b>${g.name}</b> <small>${g.type.toUpperCase()} · DMG ${g.dmg} · ${g.rpm} RPM · MAG ${g.mag}</small></div>
      ${own ? `<button data-eq="${id}" class="${eq ? 'on' : ''}">${eq ? 'Equipped' : 'Equip ' + slot}</button>` : lock ? `<span>Unlocks at ${RANKS[g.rank]}</span>` : `<button data-buy="${id}">Buy ${g.price} GP</button>`}${att}</div>`;
  }).join('');
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const g = GUNS[b.dataset.buy]; if (S.gp < g.price) return alert('Not enough GP'); S.gp -= g.price; S.owned.push(b.dataset.buy); save(S); renderShop(); });
  document.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const id = b.dataset.eq; S.loadout[GUNS[id].type === 'pistol' ? 'secondary' : 'primary'] = id; save(S); renderShop(); });
  document.querySelectorAll('[data-att]').forEach(b => b.onclick = () => { const [id, a] = b.dataset.att.split(':'), A = ATTACH[a]; if (S.rank < A.rank) return;
    if (!S.ownedAttach.includes(a)) { if (S.gp < A.price) return alert('Not enough GP'); S.gp -= A.price; S.ownedAttach.push(a); }
    const cur = S.attach[id] || (S.attach[id] = {}); cur[A.slot] = cur[A.slot] === a ? undefined : a; save(S); renderShop(); });
}
function renderStats() {
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
show('menu');
