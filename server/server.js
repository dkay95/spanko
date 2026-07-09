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
// Uploads: nur Raster-Bilder (kein SVG — kann Skripte enthalten, Stored-XSS)
const IMG_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/webp': 'webp', 'image/gif': 'gif',
};
const MAX_TEXT = 4000;                    // Zeichen pro Chat-Nachricht
const MAX_UPLOAD_BYTES = 5_000_000;       // pro Foto
const MAX_UPLOADS_TOTAL = 300_000_000;    // Gesamt-Quota für den Upload-Ordner
const MAX_UPLOADS_COUNT = 500;            // maximale Anzahl Dateien
const UPLOADS_PER_MINUTE = 10;            // Frequenz-Limit

// KI-Runde: nimmt den jüngsten Chat-Verlauf, fragt Ollama Cloud, wendet
// Design-Änderungen an und schreibt die Antwort in den Chat. Läuft immer nur
// einmal gleichzeitig; kommt währenddessen eine neue Nachricht, folgt eine Runde.
let aiBusy = false;
let aiAgain = false;
async function runAi() {
  if (aiBusy) { aiAgain = true; return; }
  aiBusy = true;
  try {
    const history = readSince(0).slice(-24);
    const out = await ai.chat(history);
    const { applied, failed } = ai.applyEdits(out.edits);
    const notes = [];
    if (applied.length) notes.push('🔧 zmieniono / geändert: ' + [...new Set(applied)].join(', '));
    if (failed.length) notes.push('⚠️ nie zastosowano / nicht angewendet: ' + failed.join(' | '));
    appendMessage({
      from: 'assistant',
      text: [String(out.reply || '').trim(), ...notes].filter(Boolean).join('\n'),
      reload: applied.length > 0,
    });
  } catch (e) {
    appendMessage({ from: 'assistant', text: '⚠️ AI niedostępne / KI nicht erreichbar (' + String(e.message || e).slice(0, 140) + ')' });
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

// Upload-Kontingente: Frequenz + Gesamtgröße + Anzahl
let uploadWindowStart = 0;
let uploadWindowCount = 0;
function uploadAllowed() {
  const now = Date.now();
  if (now - uploadWindowStart > 60_000) { uploadWindowStart = now; uploadWindowCount = 0; }
  if (uploadWindowCount >= UPLOADS_PER_MINUTE) return 'za dużo naraz / zu viele Uploads, bitte kurz warten';
  try {
    const files = fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS) : [];
    if (files.length >= MAX_UPLOADS_COUNT) return 'limit plików osiągnięty / Datei-Limit erreicht';
    const total = files.reduce((s, f) => {
      try { return s + fs.statSync(path.join(UPLOADS, f)).size; } catch { return s; }
    }, 0);
    if (total >= MAX_UPLOADS_TOTAL) return 'limit miejsca osiągnięty / Speicher-Limit erreicht';
  } catch {}
  return null;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  if (u.pathname === '/api/chat' && req.method === 'POST') {
    try {
      const { text } = JSON.parse(await body(req, 64_000) || '{}');
      const t = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT) : '';
      if (!t) return json(res, 400, { error: 'empty text' });
      const msg = appendMessage({ from: 'colleague', text: t });
      if (ai.enabled()) runAi();
      return json(res, 200, { ...msg, aiPending: ai.enabled() });
    } catch {
      return json(res, 400, { error: 'bad request' });
    }
  }
  if (u.pathname === '/api/chat' && req.method === 'GET') {
    try {
      return json(res, 200, {
        messages: readSince(Number(u.searchParams.get('since') || 0)),
        aiBusy: aiBusy || aiAgain,
      });
    } catch {
      return json(res, 500, { error: 'read failed' });
    }
  }

  if (u.pathname === '/api/upload' && req.method === 'POST') {
    try {
      const quotaError = uploadAllowed();
      if (quotaError) return json(res, 429, { error: quotaError });
      const raw = await body(req, 8_000_000);
      const { name, dataUrl } = JSON.parse(raw || '{}');
      const m = /^data:([\w/+.-]+);base64,(.+)$/i.exec(dataUrl || '');
      const ext = m && IMG_EXT[m[1].toLowerCase()];
      if (!m || !ext) return json(res, 400, { error: 'not an image' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > MAX_UPLOAD_BYTES) return json(res, 413, { error: 'too large' });
      fs.mkdirSync(UPLOADS, { recursive: true });
      const safe = String(name || 'foto').replace(/\.[^.]*$/, '').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 40) || 'foto';
      const file = `${Date.now()}-${safe}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS, file), buf);
      uploadWindowCount++;
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
    const headers = { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' };
    // hochgeladene Dateien nie als aktives Dokument interpretieren lassen
    if (file.startsWith(UPLOADS + path.sep)) headers['x-content-type-options'] = 'nosniff';
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Spanko läuft auf http://localhost:${PORT}`);
  console.log(ai.enabled()
    ? `KI-Chat aktiv (Ollama Cloud, Modell: ${ai.model()})`
    : 'KI-Chat inaktiv — Schlüssel in "ollama.key" legen, um ihn zu aktivieren.');
});
