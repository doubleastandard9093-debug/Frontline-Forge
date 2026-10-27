// headless smoke test via CDP
const { spawn } = require('child_process');
const http = require('http');
const url = process.argv[2], out = process.argv[3], script = process.argv[4] || '';
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9333', '--window-size=1280,720', 'about:blank']);
setTimeout(async () => {
  const list = await new Promise(r => http.get('http://127.0.0.1:9333/json', res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d))); }));
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); let id = 0; const pend = {};
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) pend[m.id](m.result || m);
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Network.requestWillBeSent') reqs.push(m.params.request.url); };
  const reqs = [];
  ws.onopen = async () => {
    await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
    await send('Page.navigate', { url }); await new Promise(r => setTimeout(r, 5000));
    let res = null; if (script) { res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true }); }
    const shot = await send('Page.captureScreenshot', { format: 'png' }); require('fs').writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(JSON.stringify({ errs, result: res?.result?.value ?? res?.exceptionDetails?.exception?.description, reqs: reqs.filter(u => !u.startsWith('data:')).map(u => u.replace(/^.*\//, '')) }, null, 1));
    ch.kill(); process.exit(0);
  };
}, 1500);
