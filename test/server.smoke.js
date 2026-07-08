const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4399;
const srv = spawn('node', [path.join(__dirname, '../server/server.js')], {
  env: { ...process.env, PORT: String(PORT), CHAT_DIR: path.join(__dirname, '../.chat-test') },
  stdio: 'inherit',
});

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: PORT, path: urlPath, method,
      headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  await new Promise(r => setTimeout(r, 500));
  let ok = true;
  try {
    const posted = await req('POST', '/api/chat', { text: 'hallo test' });
    const obj = JSON.parse(posted.body);
    if (obj.from !== 'colleague' || obj.text !== 'hallo test' || typeof obj.ts !== 'number') { ok = false; console.error('POST bad:', posted.body); }
    const got = await req('GET', '/api/chat?since=0');
    const msgs = JSON.parse(got.body).messages;
    if (!msgs.some(m => m.text === 'hallo test')) { ok = false; console.error('GET bad:', got.body); }
    const home = await req('GET', '/');
    if (home.status !== 200) { ok = false; console.error('home status', home.status); }
  } catch (e) { ok = false; console.error(e); }
  srv.kill();
  require('fs').rmSync(path.join(__dirname, '../.chat-test'), { recursive: true, force: true });
  console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
  process.exit(ok ? 0 : 1);
})();
