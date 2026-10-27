// Unified input: keyboard+mouse (pointer lock) and touch twin-stick + buttons.
export const input = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, fire: false, ads: false, jump: false, sprint: false,
  pressed: new Set(), touch: false };
const keys = new Set();
export function initInput(canvas, isActive) {
  addEventListener('keydown', e => { if (!isActive()) return; if (!keys.has(e.code)) input.pressed.add(e.code); keys.add(e.code); if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('mousedown', e => {
    if (!isActive()) return;
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
    if (e.button === 0) input.fire = true; if (e.button === 2) input.ads = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; if (e.button === 2) input.ads = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { input.look.x += e.movementX; input.look.y += e.movementY; } });
  addEventListener('wheel', e => { if (isActive()) input.pressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); });

  // Touch
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let moveId = null, lookIds = new Map(), sx = 0, sy = 0;
  const btns = document.querySelectorAll('[data-btn]');
  btns.forEach(b => {
    const name = b.dataset.btn;
    b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); input.touch = true;
      const t = e.changedTouches[0];
      if (name === 'fire') { input.fire = true; lookIds.set(t.identifier, { x: t.clientX, y: t.clientY, btn: 'fire' }); }
      else if (name === 'ads') input.ads = !input.ads, b.classList.toggle('on', input.ads);
      else { input.pressed.add('btn_' + name); if (name === 'jump') input.jumpHeld = true; }
    }, { passive: false });
    b.addEventListener('touchend', e => { e.preventDefault(); if (name === 'fire') input.fire = false; if (name === 'jump') input.jumpHeld = false; }, { passive: false });
  });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault(); input.touch = true; document.body.classList.add('touch');
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.42 && moveId === null) { moveId = t.identifier; sx = t.clientX; sy = t.clientY;
        stick.style.left = (sx - 60) + 'px'; stick.style.top = (sy - 60) + 'px'; stick.style.opacity = 1; }
      else lookIds.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) { let dx = t.clientX - sx, dy = t.clientY - sy; const l = Math.hypot(dx, dy), m = 50;
        if (l > m) { dx *= m / l; dy *= m / l; } input.move.x = dx / m; input.move.y = -dy / m; input.sprint = l > 70;
        knob.style.transform = `translate(${dx}px,${dy}px)`; }
      else if (lookIds.has(t.identifier)) { const p = lookIds.get(t.identifier); input.look.x += (t.clientX - p.x) * 2.2; input.look.y += (t.clientY - p.y) * 2.2; p.x = t.clientX; p.y = t.clientY; }
    }
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) {
    if (t.identifier === moveId) { moveId = null; input.move.x = input.move.y = 0; input.sprint = false; knob.style.transform = ''; stick.style.opacity = 0.35; }
    const p = lookIds.get(t.identifier); if (p && p.btn === 'fire') input.fire = false; lookIds.delete(t.identifier); } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
}
export function pollKeys() {
  if (!input.touch) {
    input.move.x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    input.move.y = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    input.sprint = keys.has('ShiftLeft');
  }
  input.jump = keys.has('Space') || input.pressed.has('btn_jump') || !!input.jumpHeld;
}
export function consumeHeld(code) { return keys.has(code); }
export function consume(...codes) { for (const c of codes) if (input.pressed.has(c)) { input.pressed.delete(c); return true; } return false; }
export function endFrame() { input.pressed.clear(); input.look.x = input.look.y = 0; }

// ---- Gyro aim (phones). Uses DeviceMotion rotationRate (angular velocity), so it never drifts and adds on top of touch look.
// iOS 13+ needs DeviceMotionEvent.requestPermission() called from a tap, and a secure context (HTTPS, e.g. GitHub Pages).
export const gyro = { on: false, sens: 1, invert: false, adsOnly: false, granted: false, active: false, sx: 0, sy: 0 };
let gyroBound = false, gyroActive = () => false;
export function gyroSupported() { return 'DeviceMotionEvent' in window && window.isSecureContext !== false; }
export function enableGyro() { // call synchronously inside a tap handler
  if (!gyroSupported()) return Promise.resolve(false);
  const req = window.DeviceMotionEvent.requestPermission;
  const p = typeof req === 'function' ? req.call(window.DeviceMotionEvent).then(r => r === 'granted').catch(() => false) : Promise.resolve(true);
  return p.then(ok => { gyro.granted = ok; if (ok) bindGyro(); return ok; });
}
export function setGyroActive(fn) { gyroActive = fn; }
function screenAngle() { const a = screen.orientation?.angle ?? window.orientation ?? 0; return ((a % 360) + 360) % 360; }
function bindGyro() {
  if (gyroBound) return; gyroBound = true; let last = 0;
  addEventListener('devicemotion', e => {
    const r = e.rotationRate; if (!r) return; const now = performance.now(), dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; if (!dt) return;
    gyro.active = true;
    // rotationRate is in deg/s in the device frame: beta = about device x, gamma = about device y.
    const bx = r.beta || 0, gy = r.gamma || 0, ang = screenAngle(); let yawR, pitchR;
    if (ang === 90) { yawR = bx; pitchR = -gy; } else if (ang === 270) { yawR = -bx; pitchR = gy; } else if (ang === 180) { yawR = -gy; pitchR = -bx; } else { yawR = gy; pitchR = bx; }
    // smoothing: low-pass + small deadzone to kill hand jitter
    const k = 1 - Math.exp(-dt * 25); gyro.sx += (yawR - gyro.sx) * k; gyro.sy += (pitchR - gyro.sy) * k;
    const dz = v => Math.abs(v) < 1.2 ? 0 : v - Math.sign(v) * 1.2;
    if (!gyro.on || !gyroActive() || (gyro.adsOnly && !input.ads)) return;
    const toLook = Math.PI / 180 / 0.0022 * gyro.sens * dt; // degrees -> look units used by touch/mouse
    input.look.x -= dz(gyro.sx) * toLook; input.look.y -= dz(gyro.sy) * toLook * (gyro.invert ? -1 : 1);
  });
}
