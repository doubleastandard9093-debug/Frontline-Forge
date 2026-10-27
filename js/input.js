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
      else input.pressed.add('btn_' + name);
    }, { passive: false });
    b.addEventListener('touchend', e => { e.preventDefault(); if (name === 'fire') input.fire = false; }, { passive: false });
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
  input.jump = keys.has('Space') || input.pressed.has('btn_jump');
}
export function consume(...codes) { for (const c of codes) if (input.pressed.has(c)) { input.pressed.delete(c); return true; } return false; }
export function endFrame() { input.pressed.clear(); input.look.x = input.look.y = 0; }
