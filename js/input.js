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

// ---- Gyro aim (phones), landscape-based. Uses DeviceMotion rotationRate (angular velocity, deg/s), so it never drifts
// and adds on top of touch look. iOS 13+ needs DeviceMotionEvent.requestPermission() from a tap, plus HTTPS (GitHub Pages is fine).
// Device frame (W3C): x = right edge in portrait, y = top edge, z = out of the screen; alpha/beta/gamma = rates about z/x/y.
export const gyro = { on: false, sens: 1, invertX: false, invertY: false, adsOnly: false, granted: false, active: false, portrait: false, angle: 0, forceAngle: null, sx: 0, sy: 0 };
let gyroBound = false, gyroActive = () => false; const isIOS = () => typeof window.DeviceMotionEvent?.requestPermission === 'function';
export function gyroSupported() { return 'DeviceMotionEvent' in window && window.isSecureContext !== false; }
export function enableGyro() { // call synchronously inside a tap handler
  if (!gyroSupported()) return Promise.resolve(false);
  const p = isIOS() ? window.DeviceMotionEvent.requestPermission().then(r => r === 'granted').catch(() => false) : Promise.resolve(true);
  return p.then(ok => { gyro.granted = ok; if (ok) bindGyro(); return ok; });
}
export function setGyroActive(fn) { gyroActive = fn; }
// Which landscape is the phone in? 90 = top edge to the LEFT, 270 (= -90) = top edge to the RIGHT, 0 = portrait.
// Uses the screen angle when the page rotated; if the phone has rotation lock on (page stays portrait), falls back to gravity.
let gx = 0, gy = 0;
const appleGravity = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
function landscapeAngle() {
  if (gyro.forceAngle !== null) return ((gyro.forceAngle % 360) + 360) % 360;
  const a = ((((screen.orientation?.angle ?? window.orientation ?? 0)) % 360) + 360) % 360; if (a === 90 || a === 270) return a;
  if (Math.abs(gx) > 4 && Math.abs(gx) > Math.abs(gy) * 1.3) { const down = appleGravity() ? gx : -gx; return down < 0 ? 90 : 270; } // iOS reports gravity, Android reports its reaction
  return 0;
}
function bindGyro() {
  if (gyroBound) return; gyroBound = true; let last = 0;
  addEventListener('devicemotion', e => {
    const g = e.accelerationIncludingGravity; if (g && g.x != null) { gx += (g.x - gx) * 0.2; gy += (g.y - gy) * 0.2; }
    const r = e.rotationRate; if (!r) return; const now = performance.now(), dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; if (!dt) return;
    gyro.active = true; const ang = landscapeAngle(); gyro.angle = ang; gyro.portrait = ang === 0;
    const al = r.alpha || 0, be = r.beta || 0, ga = r.gamma || 0;
    // Landscape: world-up is device +x (angle 90) or -x (270), so turning your body left/right = +/-beta,
    // tilting the top of the screen toward/away from you = -/+gamma. Tilting like a steering wheel (about z) also steers.
    let yawR = 0, pitchR = 0;
    if (ang === 90) { yawR = be + al * 0.8; pitchR = -ga; } else if (ang === 270) { yawR = -be + al * 0.8; pitchR = ga; }
    const k = 1 - Math.exp(-dt * 25); gyro.sx += (yawR - gyro.sx) * k; gyro.sy += (pitchR - gyro.sy) * k; // smoothing
    if (gyro.portrait) { gyro.sx = gyro.sy = 0; return; } // landscape-only
    const dz = v => Math.abs(v) < 1.2 ? 0 : v - Math.sign(v) * 1.2; // jitter deadzone (deg/s)
    if (!gyro.on || !gyroActive() || (gyro.adsOnly && !input.ads)) return;
    const toLook = Math.PI / 180 / 0.0022 * gyro.sens * dt; // degrees -> look units used by touch/mouse
    input.look.x -= dz(gyro.sx) * toLook * (gyro.invertX ? -1 : 1); input.look.y -= dz(gyro.sy) * toLook * (gyro.invertY ? -1 : 1);
  });
}
