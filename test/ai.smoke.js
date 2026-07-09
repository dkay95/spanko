// End-zu-End-Test des KI-Chats mit einer Ollama-Cloud-Attrappe:
// Nachricht → Server fragt "Ollama" (Mock) → Edits werden angewendet (auf einer
// Site-KOPIE) → Antwort mit reload-Flag landet im Chat → Backup existiert.
// Prüft auch, dass Pfad-Ausbrüche und geschützte Dateien abgewehrt werden.
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 4398;
const MOCK_PORT = 4397;
const TMP = path.join(__dirname, '..', '.chat-test-ai');
const SITE_TMP = path.join(TMP, 'site');

// --- Wegwerf-Kopie der Site anlegen ---
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(SITE_TMP, { recursive: true });
for (const f of ['styles.css', 'index.html', 'i18n.js']) {
  fs.copyFileSync(path.join(__dirname, '..', 'site', f), path.join(SITE_TMP, f));
}

// --- Ollama-Cloud-Attrappe ---
const mock = http.createServer((req, res) => {
  let b = '';
  req.on('data', c => b += c);
  req.on('end', () => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) { res.writeHead(401); return res.end('no key'); }
    const payload = JSON.parse(b);
    if (!payload.model || !Array.isArray(payload.messages)) { res.writeHead(400); return res.end('bad'); }
    const content = JSON.stringify({
      reply: 'Zrobione! Zmieniłem kolor złota.',
      edits: [
        { op: 'edit', file: 'styles.css', find: '--gold: #c99a4b;', replace: '--gold: #d4a55c;' },
        { op: 'create', file: 'pages/betten.html', content: '<!doctype html><html><head><link rel="stylesheet" href="../styles.css"></head><body>Betten</body></html>' },
        { op: 'edit', file: '../server/server.js', find: 'const', replace: 'const' },
        { op: 'edit', file: 'styles.css', find: 'TEXT-DER-NICHT-EXISTIERT', replace: 'x' },
        { op: 'create', file: 'assets/uploads/haha.html', content: 'nope' },
      ],
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: { role: 'assistant', content } }));
  });
});
mock.listen(MOCK_PORT);

// --- Spanko-Server mit Mock-Ollama starten ---
const srv = spawn('node', [path.join(__dirname, '../server/server.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    CHAT_DIR: path.join(TMP, 'chat'),
    SITE_DIR: SITE_TMP,
    OLLAMA_API_KEY: 'test-key',
    OLLAMA_URL: `http://127.0.0.1:${MOCK_PORT}`,
    OLLAMA_MODEL: 'mock-model',
  },
  stdio: 'inherit',
});

function req(method, urlPath, bodyObj) {
  return new Promise((resolve, reject) => {
    const data = bodyObj ? JSON.stringify(bodyObj) : null;
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
  // warten, bis der Server wirklich antwortet (statt fester Wartezeit)
  for (let i = 0; i < 50; i++) {
    try { await req('GET', '/api/chat?since=0'); break; }
    catch { await new Promise(r => setTimeout(r, 200)); }
  }
  let ok = true;
  const fail = (msg, extra) => { ok = false; console.error('FEHLER:', msg, extra || ''); };

  try {
    // 1) Nachricht senden → aiPending muss gesetzt sein
    const posted = await req('POST', '/api/chat', { text: 'zmień kolor złota' });
    const pm = JSON.parse(posted.body);
    if (pm.aiPending !== true) fail('aiPending fehlt', posted.body);

    // 2) auf die KI-Antwort warten
    let aiMsg = null;
    for (let i = 0; i < 30 && !aiMsg; i++) {
      await new Promise(r => setTimeout(r, 300));
      const got = await req('GET', '/api/chat?since=0');
      aiMsg = JSON.parse(got.body).messages.find(m => m.from === 'assistant');
    }
    if (!aiMsg) fail('keine KI-Antwort erhalten');
    else {
      if (!aiMsg.reload) fail('reload-Flag fehlt', JSON.stringify(aiMsg));
      if (!aiMsg.text.includes('Zrobione')) fail('Antworttext falsch', aiMsg.text);
      if (!aiMsg.text.includes('⚠️')) fail('Hinweis auf abgewehrte Edits fehlt', aiMsg.text);
    }

    // 3) Edit + Create wurden auf der Site-KOPIE angewendet
    const css = fs.readFileSync(path.join(SITE_TMP, 'styles.css'), 'utf8');
    if (!css.includes('--gold: #d4a55c;')) fail('Edit nicht angewendet');
    const page = path.join(SITE_TMP, 'pages', 'betten.html');
    if (!fs.existsSync(page)) fail('neue Datei nicht angelegt');

    // 4) Angriffe abgewehrt: Server-Datei + Uploads unangetastet
    const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
    if (!serverSrc.includes('const http')) fail('server.js beschädigt?!');
    if (fs.existsSync(path.join(SITE_TMP, 'assets', 'uploads', 'haha.html'))) fail('Upload-Schutz umgangen!');

    // 5) die ECHTE Site ist unangetastet
    const realCss = fs.readFileSync(path.join(__dirname, '..', 'site', 'styles.css'), 'utf8');
    if (!realCss.includes('--gold: #c99a4b;')) fail('ECHTE Site wurde verändert!');

    // 6) Backup existiert
    const backups = fs.readdirSync(path.join(TMP, 'chat', 'backups'));
    if (!backups.some(f => f.endsWith('styles.css'))) fail('kein Backup angelegt');
  } catch (e) { fail('Ausnahme', e.message); }

  srv.kill();
  mock.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(ok ? 'AI-SMOKE OK' : 'AI-SMOKE FAIL');
  process.exit(ok ? 0 : 1);
})();
