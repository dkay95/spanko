const fs = require('fs');
const path = require('path');

const CHAT_DIR = process.env.CHAT_DIR || path.join(__dirname, '..', '.chat');
const FILE = path.join(CHAT_DIR, 'messages.jsonl');

function ensure() {
  fs.mkdirSync(CHAT_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '');
}

function appendMessage({ from, text, image }) {
  ensure();
  const msg = { ts: Date.now(), from, text: String(text || '') };
  if (image) msg.image = image;
  fs.appendFileSync(FILE, JSON.stringify(msg) + '\n');
  return msg;
}

function readSince(ts) {
  ensure();
  return fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(m => m && m.ts > ts);
}

module.exports = { appendMessage, readSince, FILE };
