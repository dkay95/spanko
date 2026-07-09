const http = require('http');
const fs = require('fs');
const path = require('path');
const { appendMessage, readSince } = require('./chat-store');
const ai = require('./ollama');

const PORT = process.env.PORT || 4321;
const SITE = process.env.SITE_DIR || path.join(__dirname, '..', 'site');
const UPLOADS = path.join(SITE, 'assets', 'uploads');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
};
const IMG_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
};

// KI-Runde: nimmt den jüngsten Chat-Verlauf, fragt Ollama Cloud, wendet
// Design-Änderungen an und schreibt die Antwort in den Chat. Läuft immer nur
// einmal gleichzeitig; kommt währenddessen eine neue Nachricht, folgt eine Runde.
let aiBusy = false;
let aiAgain = false;
async function runAi() {
  if (aiBusy) { aiAgain = true; return; }
  aiBusy = true;
  try {
    const history = readSince(0).slice(-14);
    const out = await ai.chat(history);
    const { applied, failed } = ai.applyEdits(out.edits);
    const notes = [];
    if (applied.length) notes.push('🔧 geändert: ' + [...new Set(applied)].join(', '));
    if (failed.length) notes.push('⚠️ nicht angewendet: ' + failed.join(' | '));
    appendMessage({
      from: 'assistant',
      text: [String(out.reply || '').trim(), ...notes].filter(Boolean).join('\n'),
      reload: applied.length > 0,
    });
  } catch (e) {
    appendMessage({ from: 'assistant', text: '⚠️ KI gerade nicht erreichbar (' + String(e.message || e).slice(0, 140) + ')' });
  } finally {
    aiBusy = false;
    if (aiAgain) { aiAgain = false; runAi(); }
  }
}

function body(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let b = ''; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { req.destroy(); reject(new Error('too large')); }
      else b += c;
    });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  if (u.pathname === '/api/chat' && req.method === 'POST') {
    try {
      const { text } = JSON.parse(await body(req) || '{}');
      const msg = appendMessage({ from: 'colleague', text });
      if (ai.enabled()) runAi();
      return json(res, 200, { ...msg, aiPending: ai.enabled() });
    } catch {
      return json(res, 400, { error: 'bad request' });
    }
  }
  if (u.pathname === '/api/chat' && req.method === 'GET') {
    return json(res, 200, { messages: readSince(Number(u.searchParams.get('since') || 0)) });
  }

  if (u.pathname === '/api/upload' && req.method === 'POST') {
    try {
      const raw = await body(req, 14_000_000);
      const { name, dataUrl } = JSON.parse(raw || '{}');
      const m = /^data:([\w/+.-]+);base64,(.+)$/i.exec(dataUrl || '');
      const ext = m && IMG_EXT[m[1].toLowerCase()];
      if (!m || !ext) return json(res, 400, { error: 'not an image' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 10_000_000) return json(res, 413, { error: 'too large' });
      fs.mkdirSync(UPLOADS, { recursive: true });
      const safe = String(name || 'foto').replace(/\.[^.]*$/, '').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 40) || 'foto';
      const file = `${Date.now()}-${safe}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS, file), buf);
      const rel = 'assets/uploads/' + file;
      const msg = appendMessage({ from: 'colleague', text: '📷 ' + (name || 'Foto'), image: rel });
      if (ai.enabled()) runAi();
      return json(res, 200, { ...msg, aiPending: ai.enabled() });
    } catch {
      return json(res, 400, { error: 'upload failed' });
    }
  }

  // static files
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(SITE, path.normalize(p));
  if (!file.startsWith(SITE)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Spanko läuft auf http://localhost:${PORT}`);
  console.log(ai.enabled()
    ? `KI-Chat aktiv (Ollama Cloud, Modell: ${ai.model()})`
    : 'KI-Chat inaktiv — Schlüssel in "ollama.key" legen, um ihn zu aktivieren.');
});
