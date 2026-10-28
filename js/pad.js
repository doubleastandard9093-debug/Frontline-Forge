// Xbox / standard gamepad support (Bluetooth or USB) via the Gamepad API. Works in Safari iOS, Chrome, Edge, Firefox.
// Cheap when unused: only a 1 s probe runs until a pad appears; then one rAF poll per frame.
import { input } from './input.js';
export const pad = { connected: false, active: false, id: '', sens: 1, invertY: false, dz: 0.15, rumbleOn: true,
  move: { x: 0, y: 0 }, held: {}, onConnect: null, onDisconnect: null, isActive: () => false, inVehicle: () => false, onMenu: null };
// standard mapping indices
export const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
let prev = [], loopOn = false, last = 0, xDown = 0, backDown = 0, sprintLatch = false, crouchLatch = false, gp = null;
const getPads = () => { try { return Array.from(navigator.getGamepads?.() || []).filter(Boolean); } catch (e) { return []; } };
export function deadzone(x, y, dz = pad.dz) { const m = Math.hypot(x, y); if (m < dz) return [0, 0]; const s = Math.min(1, (m - dz) / (1 - dz)) / m; return [x * s, y * s]; }
function setActive(on) {
  if (pad.active === on) return; pad.active = on;
  if (on) { document.body.classList.remove('touch'); document.body.classList.add('pad'); input.touch = false; } else document.body.classList.remove('pad');
}
export function rumble(strong = 0.6, weak = 0.3, ms = 80) {
  if (!pad.rumbleOn || !pad.active || !gp) return; const a = gp.vibrationActuator;
  try { if (a?.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); else gp.hapticActuators?.[0]?.pulse?.(strong, ms); } catch (e) {}
}
function connect(g) { if (pad.connected) return; pad.connected = true; pad.id = g.id; setActive(true); pad.onConnect?.(g); startLoop(); }
export function initPad() {
  addEventListener('gamepadconnected', e => connect(e.gamepad));
  addEventListener('gamepaddisconnected', () => { if (!getPads().length) { pad.connected = false; setActive(false); releaseAll(); pad.onDisconnect?.(); } });
  addEventListener('touchstart', () => { if (pad.active) { setActive(false); document.body.classList.add('touch'); } }, { passive: true, capture: true });
  setInterval(() => { if (!pad.connected) { const g = getPads()[0]; if (g) connect(g); } }, 1000);
}
function releaseAll() { if (pad.held.fire) input.fire = false; if (pad.held.ads) input.ads = false; if (pad.held.jump) input.jumpHeld = false; pad.held = {}; pad.move.x = pad.move.y = 0; input.crouch = false; }
function startLoop() { if (loopOn) return; loopOn = true; last = performance.now(); requestAnimationFrame(tick); }
function tick(now) {
  if (!pad.connected) { loopOn = false; return; } requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; pollPad(dt);
}
const btn = (g, i) => { const b = g.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
const val = (g, i) => g.buttons[i]?.value ?? 0;
export function pollPad(dt = 1 / 60) {
  gp = getPads()[0]; if (!gp) return; const g = gp, now = performance.now();
  const cur = g.buttons.map((_, i) => btn(g, i)), down = i => cur[i] && !prev[i], up = i => !cur[i] && prev[i];
  const [lx, ly] = deadzone(g.axes[0] || 0, g.axes[1] || 0), [rx, ry] = deadzone(g.axes[2] || 0, g.axes[3] || 0);
  const any = cur.some(Boolean) || lx || ly || rx || ry; if (any) setActive(true);
  if (!pad.isActive()) { // menus: D-pad / left stick to move focus, A select, B back
    const nav = d => pad.onMenu?.(d);
    if (down(B.UP)) nav('up'); if (down(B.DOWN)) nav('down'); if (down(B.LEFT)) nav('left'); if (down(B.RIGHT)) nav('right');
    const sy = Math.abs(ly) > 0.6 ? Math.sign(ly) : 0, sx = Math.abs(lx) > 0.6 ? Math.sign(lx) : 0;
    if ((sy || sx) && now - (pad.stickT || 0) > 220) { pad.stickT = now; nav(sy ? (sy > 0 ? 'down' : 'up') : (sx > 0 ? 'right' : 'left')); }
    if (down(B.A)) nav('ok'); if (down(B.B)) nav('back'); if (down(B.START)) nav('start');
    releaseAll(); prev = cur; return;
  }
  const veh = pad.inVehicle();
  // sticks
  pad.move.x = lx; pad.move.y = -ly;
  if (veh && Math.abs(ly) < 0.2) pad.move.y = val(g, B.RT) - val(g, B.LT); // RT throttle / LT brake-reverse
  const curve = v => v * Math.abs(v), k = 1400 * pad.sens * dt; // ~3 rad/s at full tilt, sens 1
  input.look.x += curve(rx) * k; input.look.y += curve(ry) * k * (pad.invertY ? -1 : 1);
  // held
  const hold = (name, on, apply) => { if (on !== !!pad.held[name]) { pad.held[name] = on; apply(on); } };
  hold('fire', val(g, B.RT) > 0.3, v => input.fire = v);
  hold('ads', val(g, B.LT) > 0.3 && !veh, v => input.ads = v);
  hold('jump', cur[B.A], v => input.jumpHeld = v);
  if (down(B.L3)) sprintLatch = !sprintLatch; if (Math.hypot(lx, ly) < 0.3) sprintLatch = false;
  pad.sprint = sprintLatch || (veh && cur[B.B]); // in helicopters B = descend
  // B: crouch toggle; while sprinting = slide
  if (down(B.B) && !veh) { if (sprintLatch) { input.pressed.add('pad_slide'); sprintLatch = false; } else crouchLatch = !crouchLatch; }
  if (sprintLatch) crouchLatch = false; input.crouch = crouchLatch && !veh;
  // X: tap reload, hold interact / enter-exit vehicle
  if (down(B.X)) xDown = now; if (cur[B.X] && xDown && now - xDown > 350) { input.pressed.add('KeyF'); xDown = 0; rumble(0.2, 0.2, 40); }
  if (up(B.X) && xDown) { input.pressed.add(veh ? 'KeyF' : 'KeyR'); xDown = 0; }
  if (down(B.Y)) input.pressed.add('btn_weapon');
  if (down(B.LB)) input.pressed.add(veh ? 'KeyG' : 'KeyG');
  if (down(B.RB)) input.pressed.add('KeyQ');
  if (down(B.R3)) input.pressed.add('KeyV');
  if (down(B.UP)) input.pressed.add('KeyZ'); if (down(B.RIGHT)) input.pressed.add('KeyX'); if (down(B.DOWN)) input.pressed.add('KeyC'); if (down(B.LEFT)) input.pressed.add('KeyH');
  if (down(B.START)) input.pressed.add('Escape');
  // Back: tap = overview map, hold = scoreboard
  if (down(B.BACK)) backDown = now; if (cur[B.BACK] && now - backDown > 250) input.pressed.add('Tab');
  if (up(B.BACK) && now - backDown <= 250) input.pressed.add('KeyM');
  prev = cur;
}
// Merge into the per-tick input (called from pollKeys): analog stick wins over keys when pushed.
export function applyPad() {
  if (!pad.active) return;
  if (pad.move.x || pad.move.y) { input.move.x = pad.move.x; input.move.y = pad.move.y; }
  if (pad.sprint) input.sprint = true;
  if (pad.held.Tab) input.pressed.add('Tab');
}
// Generic menu navigation over visible buttons/inputs of the current screen.
export function menuNav(root, dir, back) {
  const els = [...root.querySelectorAll('button:not([disabled]),input,select,[data-go]')].filter(e => e.offsetParent !== null);
  if (!els.length) return; let i = els.indexOf(document.activeElement);
  if (dir === 'ok') { const e = els[i] || els[0]; if (e.type === 'checkbox') e.click(); else if (e.type === 'range') {} else e.click(); return; }
  if (dir === 'back') { back?.(); return; }
  const cur = els[i];
  if (cur?.type === 'range' && (dir === 'left' || dir === 'right')) { cur.value = +cur.value + (dir === 'right' ? 1 : -1) * (+cur.step || 0.1); cur.dispatchEvent(new Event('input')); return; }
  if (i < 0) { els[0].focus(); return; }
  // spatial: pick nearest element in direction
  const r = cur.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2; let best = null, bd = 1e9;
  for (const e of els) { if (e === cur) continue; const q = e.getBoundingClientRect(), dx = q.x + q.width / 2 - cx, dy = q.y + q.height / 2 - cy;
    const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4; if (!ok) continue;
    const d = (dir === 'up' || dir === 'down') ? Math.abs(dy) + Math.abs(dx) * 2 : Math.abs(dx) + Math.abs(dy) * 2; if (d < bd) { bd = d; best = e; } }
  (best || els[(i + (dir === 'down' || dir === 'right' ? 1 : els.length - 1)) % els.length]).focus();
  document.activeElement?.scrollIntoView?.({ block: 'nearest' });
}
