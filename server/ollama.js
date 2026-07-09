// Anbindung an Ollama Cloud: beantwortet Chat-Nachrichten und darf die ganze
// Website (alles unter site/) über exakte Suchen-und-Ersetzen-Änderungen
// bearbeiten sowie neue Dateien anlegen. Aktiv nur, wenn ein API-Schlüssel
// vorhanden ist (Datei ollama.key oder Umgebungsvariable OLLAMA_API_KEY).
// Vor jeder Änderung wird ein Backup angelegt; Pfade sind strikt auf site/
// begrenzt, Foto-Uploads (assets/uploads) bleiben unantastbar.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = process.env.SITE_DIR || path.join(ROOT, 'site');
const KEY_FILE = path.join(ROOT, 'ollama.key');
const BACKUP_DIR = path.join(process.env.CHAT_DIR || path.join(ROOT, '.chat'), 'backups');

const TEXT_EXT = ['.html', '.css', '.js', '.svg', '.json', '.txt', '.md'];
const MAX_EDITS = 10;
const MAX_FIND = 4000;
const MAX_CONTENT = 120_000;
const MAX_PROMPT_FILE = 100_000;

function apiKey() {
  // Explizit gesetzte (auch leere) Umgebungsvariable hat Vorrang vor der
  // Schlüssel-Datei — so können Tests die KI sicher abschalten.
  if ('OLLAMA_API_KEY' in process.env) return process.env.OLLAMA_API_KEY.trim() || null;
  try { return fs.readFileSync(KEY_FILE, 'utf8').trim() || null; } catch { return null; }
}

function enabled() { return !!apiKey(); }
function model() { return process.env.OLLAMA_MODEL || 'gpt-oss:120b'; }
function baseUrl() { return (process.env.OLLAMA_URL || 'https://ollama.com').replace(/\/+$/, ''); }

// Pfad prüfen: muss innerhalb von site/ liegen, Textdatei sein, kein Upload
function resolveSite(rel) {
  if (typeof rel !== 'string' || !rel.trim()) throw new Error('Datei fehlt');
  const p = path.resolve(SITE, rel);
  if (!p.startsWith(SITE + path.sep)) throw new Error('Pfad außerhalb der Website');
  if (!TEXT_EXT.includes(path.extname(p).toLowerCase())) throw new Error('Dateityp nicht erlaubt');
  const relNorm = path.relative(SITE, p);
  if (relNorm.split(path.sep).includes('uploads')) throw new Error('Uploads sind geschützt');
  return p;
}

// Alle bearbeitbaren Dateien der Website (relative Pfade)
function listSiteFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'uploads') walk(p);
      } else if (TEXT_EXT.includes(path.extname(entry.name).toLowerCase())) {
        out.push(path.relative(SITE, p));
      }
    }
  })(SITE);
  return out.sort();
}

// Antwortformat, das dem Modell vorgeschrieben wird (Structured Output)
const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['edit', 'create'] },
          file: { type: 'string' },
          find: { type: 'string' },
          replace: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['op', 'file'],
      },
    },
  },
  required: ['reply'],
};

function systemPrompt() {
  const files = listSiteFiles().map(f => {
    const p = path.join(SITE, f);
    const stat = fs.statSync(p);
    if (stat.size > MAX_PROMPT_FILE) return `===== ${f} ===== (zu groß, ausgelassen)`;
    return `===== ${f} =====\n${fs.readFileSync(p, 'utf8')}`;
  }).join('\n\n');

  return `You are the design assistant for the Spanko website (a Polish bedroom/mattress shop; navy+gold theme; sloth mascot; slogan "Sen ma znaczenie"). Site visitors send design change requests in Polish or German. You can edit the entire website: every file below, and you can create new files (e.g. sub-pages) inside the site folder.

How to change things — return "edits", each item is one of:
- {"op":"edit","file":"<path>","find":"<exact substring copied verbatim from the file below>","replace":"<new text>"} — replaces the first occurrence. "find" must be short but unique within its file. Never invent text that is not literally in the file.
- {"op":"create","file":"<new path like pages/betten.html>","content":"<full file content>"} — creates a new file (fails if it already exists; to change an existing file use "edit").

Rules:
- Reply in the same language as the user's last message (Polish or German). Keep replies short and friendly.
- At most ${MAX_EDITS} edits per reply. Change only what the user asked for.
- Page texts exist in Polish AND German (i18n.js, data-i18n attributes): when changing wording, update both languages.
- New HTML pages must include <link rel="stylesheet" href="styles.css"> (adjust the relative path if in a subfolder) and follow the existing design language.
- BE CAREFUL with chat-widget.js and sloth-buddy.js: if you break them, the chat itself dies. Prefer not to touch them unless explicitly asked.
- If a request is unclear, dangerous, or not about the website, ask back or decline politely — without edits.
- If no file change is needed, reply without "edits".

Current website files:

${files}`;
}

async function chat(history) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${baseUrl()}/api/chat`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: model(),
        stream: false,
        format: SCHEMA,
        messages: [
          { role: 'system', content: systemPrompt() },
          ...history
            .filter(m => m.text || m.image)
            .map(m => ({
              role: m.from === 'colleague' ? 'user' : 'assistant',
              content: m.image ? `${m.text} [Bild hochgeladen, Pfad für die Website: ${m.image}]` : m.text,
            })),
        ],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`Ollama HTTP ${res.status} ${detail}`);
    }
    const data = await res.json();
    return JSON.parse(data.message.content);
  } finally {
    clearTimeout(timer);
  }
}

// Wendet die vom Modell vorgeschlagenen Änderungen an — streng validiert,
// mit Backup der Vorversion bei jeder Bearbeitung.
function applyEdits(edits) {
  const applied = [];
  const failed = [];
  if (!Array.isArray(edits)) return { applied, failed };
  for (const e of edits.slice(0, MAX_EDITS)) {
    try {
      if (!e || typeof e !== 'object') throw new Error('ungültige Änderung');
      const p = resolveSite(e.file);
      const rel = path.relative(SITE, p);

      if (e.op === 'create') {
        if (typeof e.content !== 'string' || !e.content) throw new Error('content fehlt');
        if (e.content.length > MAX_CONTENT) throw new Error('Datei zu groß');
        if (fs.existsSync(p)) throw new Error('Datei existiert schon (op:edit benutzen)');
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, e.content);
        applied.push(rel + ' (neu)');
      } else if (e.op === 'edit') {
        if (typeof e.find !== 'string' || typeof e.replace !== 'string') throw new Error('find/replace fehlt');
        if (!e.find || e.find.length > MAX_FIND || e.replace.length > MAX_FIND) throw new Error('Änderung zu groß');
        const src = fs.readFileSync(p, 'utf8');
        const i = src.indexOf(e.find);
        if (i < 0) throw new Error('Suchtext nicht gefunden');
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        fs.writeFileSync(path.join(BACKUP_DIR, `${Date.now()}-${rel.replace(/[\\/]/g, '_')}`), src);
        fs.writeFileSync(p, src.slice(0, i) + e.replace + src.slice(i + e.find.length));
        applied.push(rel);
      } else {
        throw new Error('unbekannte Operation');
      }
    } catch (err) {
      failed.push(`${(e && e.file) || '?'}: ${err.message}`);
    }
  }
  return { applied, failed };
}

module.exports = { enabled, chat, applyEdits, model };
