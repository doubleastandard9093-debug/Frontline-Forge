// Gamepad test: mocks navigator.getGamepads, then checks connect toast, menu nav, in-match move/look/fire/actions, touch hide.
// usage: node tools/headless-test.js http://localhost:8765/?gfx=low /tmp/pad.png "$(node tools/pad-test.js)"
console.log(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = {};
  const mk = () => ({ id: 'Xbox Wireless Controller (mock)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { n: 0, playEffect() { this.n++; return Promise.resolve('complete'); } } });
  const g = mk(); navigator.getGamepads = () => [g];
  const press = async (i, ms = 60) => { g.buttons[i] = { pressed: true, value: 1 }; await sleep(ms); g.buttons[i] = { pressed: false, value: 0 }; await sleep(60); };
  document.body.classList.add('touch');
  await press(0); await sleep(1200);
  R.toast = document.getElementById('toast').textContent; R.padClass = document.body.classList.contains('pad'); R.touchHidden = !document.body.classList.contains('touch');
  // menu nav: D-pad down moves focus, A clicks
  await press(13); R.focused = document.activeElement?.tagName === 'BUTTON';
  // start a match via the play screen
  document.querySelector('[data-go="play"]').click(); await sleep(200); document.querySelector('[data-map]').click(); await sleep(2500);
  const G = window.__game || null;
  g.axes = [0, -1, 1, 0]; await sleep(600); R.hud = !document.getElementById('hud').classList.contains('hidden');
  g.axes = [0, 0, 0, 0];
  g.buttons[7] = { pressed: true, value: 1 }; await sleep(400); R.rumbles = g.vibrationActuator.n; g.buttons[7] = { pressed: false, value: 0 }; await sleep(100);
  await press(9); await sleep(300); R.paused = !document.getElementById('pause').classList.contains('hidden');
  await press(9); await sleep(300); R.resumed = document.getElementById('pause').classList.contains('hidden');
  window.dispatchEvent(new TouchEvent('touchstart')); R.touchBack = document.body.classList.contains('touch');
  return R; })()`);
