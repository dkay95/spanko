const fs = require('fs');
const path = require('path');

const CHAT_DIR = process.env.CHAT_DIR || path.join(__dirname, '..', '.chat');
const FILE = path.join(CHAT_DIR, 'messages.jsonl');

const MAX_TEXT = 4000;   // Zeichen pro Nachricht
const MAX_LINES = 800;   // ab hier wird das Log gekürzt …
const KEEP_LINES = 500;  // … auf die jüngsten Zeilen

// strikt monoton steigende Zeitstempel, damit `ts > since` nie etwas verliert
let lastTs = 0;

function ensure() {
  fs.mkdirSync(CHAT_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '');
}

function rotate() {
  try {
    const lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > MAX_LINES) {
      fs.writeFileSync(FILE, lines.slice(-KEEP_LINES).join('\n') + '\n');
    }
  } catch {}
}

function appendMessage({ from, text, image, reload }) {
  ensure();
  const ts = Math.max(Date.now(), lastTs + 1);
  lastTs = ts;
  const msg = { ts, from, text: String(text || '').slice(0, MAX_TEXT) };
  if (image) msg.image = image;
  if (reload) msg.reload = true;
  fs.appendFileSync(FILE, JSON.stringify(msg) + '\n');
  rotate();
  return msg;
}

function readSince(ts) {
  ensure();
  try {
    return fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(m => m && m.ts > ts);
  } catch {
    return [];
  }
}

module.exports = { appendMessage, readSince, FILE };
