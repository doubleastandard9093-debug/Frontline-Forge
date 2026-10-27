import { GUNS, ATTACH, RANKS, STATS, xpForRank } from './data.js';
import { MAPS } from './maps.js';
import { load, save, exportCode, importCode, fresh } from './save.js';
import { pickTier } from './gfx.js';
import { initInput } from './input.js';
import { Game } from './game.js';

const $ = id => document.getElementById(id);
let S = load(); const tier = pickTier(S);
const canvas = $('game'); let mode = 'tdm', game;
const screens = ['menu', 'play', 'armory', 'stats', 'settings', 'pause', 'results'];
function show(id) { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); $('hud').classList.toggle('hidden', id !== null); render(id); }
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === 'menu' && game) { game.dispose(); } show(b.dataset.go); });
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

const toastEl = $('toast'); let toastT;
const hooks = {
  hud(g) {
    const P = g.player, w = g.slots[g.slot];
    $('sc0').textContent = g.score[0]; $('sc1').textContent = g.score[1];
    const t = Math.max(0, Math.ceil(g.timeLeft)); $('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    $('shfill').style.width = Math.max(0, P.sh / P.maxSh * 100) + '%'; $('shbar').classList.toggle('low', P.sh < P.maxSh * 0.25);
    $('hpfill').style.width = Math.max(0, P.hp / P.maxHp * 100) + '%'; $('hptext').textContent = Math.max(0, Math.ceil(P.hp));
    $('wname').textContent = w.pick ? 'Breacher Pick' : w.name;
    $('ammo').textContent = w.pick ? '—' : w.reloading > 0 ? 'RELOAD' : `${w.ammo} / ${w.mag}`;
    $('mats').textContent = `Wood ${g.mats.wood}  ·  Stone ${g.mats.stone}`;
    $('bmode').textContent = g.buildMode ? `BUILD: ${g.buildMode.toUpperCase()} (10 wood)` : '';
    const v = P.vehicle; if (v) { $('wname').textContent = `${v.K.name} · Armor ${Math.ceil(v.hp)}/${v.K.hp}`; $('ammo').textContent = v.K.weapons[1].ammoMax < 50 ? `${v.K.weapons[1].name} ${Math.floor(v.ammo[1])}` : v.K.weapons[1].name; }
    $('prompt').textContent = g.near ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to pilot ${g.near.K.name}` : g.nearPick ? `${matchMedia('(pointer: coarse)').matches ? 'Tap ENTER' : 'Press F'} to swap for ${GUNS[g.nearPick.id].name}` : '';
    $('dead').classList.toggle('hidden', P.alive);
    $('goal').textContent = `${g.map.name} · ${g.mode === 'coop' ? 'Co-op vs Bots' : g.map.mode} · first to ${g.map.scoreLimit}`;
  },
  toast(m) { toastEl.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => toastEl.textContent = '', 1200); },
  hitmark(head) { const h = $('hitm'); h.classList.toggle('head', head); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 120); },
  shieldPop() { const h = $('pop'); h.classList.remove('go'); void h.offsetWidth; h.classList.add('go'); },
  hurt() { const h = $('hurt'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 200); },
  feed(a, b, head) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = `<span class="${a.team ? 'red' : 'blue'}">${a.name}</span> ${head ? '◎' : '›'} <span class="${b.team ? 'red' : 'blue'}">${b.name}</span>`;
    f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); setTimeout(() => d.remove(), 5000); },
  scope(on) { $('scope').classList.toggle('hidden', !on); $('cross').style.display = on ? 'none' : ''; },
  board(on) { const b = $('board'); b.classList.toggle('hidden', !on); if (!on || !game) return;
    const rows = game.units.slice().sort((a, c) => c.kills - a.kills).map(u => `<tr class="${u.team ? 'red' : 'blue'}"><td>${u.name}</td><td>${u.kills}</td><td>${u.deaths}</td></tr>`).join('');
    b.innerHTML = `<table><tr><td>Soldier</td><td>K</td><td>D</td></tr>${rows}</table>`; },
  pause() { game.paused = true; document.exitPointerLock?.(); show('pause'); },
  end(r) { applyResult(r); },
};
$('resume').onclick = () => { show(null); game.paused = false; };
$('quit').onclick = () => { game.dispose(); show('menu'); };
initInput(canvas, () => game && game.running && !game.paused);

function applyResult(r) {
  S.xp += r.xp; S.gp += r.gp; S.totals.kills += r.stats.kills; S.totals.deaths += r.stats.deaths; S.totals.matches++; if (r.won) S.totals.wins++;
  const before = S.rank; while (S.rank < RANKS.length - 1 && S.xp >= xpForRank(S.rank)) { S.rank++; S.points += 1; S.gp += 250; }
  save(S);
  $('rtitle').textContent = r.won ? 'VICTORY' : 'DEFEAT';
  $('rbody').innerHTML = `<p>Score ${r.score[0]} – ${r.score[1]}</p><p>Kills ${r.stats.kills} · Deaths ${r.stats.deaths} · Headshots ${r.stats.head} · Builds ${r.stats.builds}</p>
    <p><b>+${r.xp} XP</b> · <b>+${r.gp} GP</b></p>${S.rank > before ? `<h3>RANK UP! You are now ${RANKS[S.rank]}</h3><p>+${S.rank - before} stat point(s), +${(S.rank - before) * 250} GP bonus</p>` : ''}`;
  show('results');
}

function startMatch(id) { game = game || new Game(canvas, tier, S, hooks); game.paused = false; show(null); game.start(id, mode); }

function rankHtml() {
  const prev = S.rank ? xpForRank(S.rank - 1) : 0, next = xpForRank(S.rank), pct = Math.min(100, (S.xp - prev) / (next - prev) * 100);
  return `<div><b>${RANKS[S.rank]}</b> · ${S.xp} XP · ${S.gp} GP</div><div class="bar"><i style="width:${pct}%"></i></div><small>${next - S.xp} XP to ${RANKS[S.rank + 1] || 'max'}</small>`;
}
function render(id) {
  if (id === 'menu') $('profile').innerHTML = rankHtml();
  if (id === 'play') {
    document.querySelectorAll('#modes button').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.onclick = () => { mode = b.dataset.mode; render('play'); }; });
    $('maps').innerHTML = Object.entries(MAPS).map(([k, m]) => `<button class="card" data-map="${k}"><span class="tag">${m.type === 'small' ? 'SMALL · QUICK' : 'LARGE · BIG BATTLE'}</span><b>${m.name}</b><small>${m.desc} ${m.teamSize}v${mode === 'coop' ? Math.round(m.teamSize * 1.5) : m.teamSize}, first to ${m.scoreLimit}, ${m.time / 60} min</small></button>`).join('');
    document.querySelectorAll('[data-map]').forEach(b => b.onclick = () => startMatch(b.dataset.map));
  }
  if (id === 'armory') renderShop();
  if (id === 'stats') renderStats();
  if (id === 'settings') {
    $('gLow').classList.toggle('on', tier === 'low'); $('gHigh').classList.toggle('on', tier === 'high'); $('sens').value = S.sens || 1;
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
$('sens').oninput = e => { S.sens = +e.target.value; save(S); };
$('exp').onclick = () => { $('code').value = exportCode(S); $('code').select(); navigator.clipboard?.writeText($('code').value).catch(() => {}); };
$('imp').onclick = () => { try { S = importCode($('code').value); save(S); alert('Save imported'); location.reload(); } catch (e) { alert('Invalid save code'); } };
$('wipe').onclick = () => { if (confirm('Reset all progress?')) { S = fresh(); save(S); location.reload(); } };
window.__ff = { get game() { return game; }, get save() { return S; }, tier, startMatch, setMode: m => mode = m };
show('menu');
