// Spanko Cloud-Gehirn (Cloudflare Worker)
// ---------------------------------------
// Immer-verfügbarer KI-Design-Chat für die auf GitHub Pages gehostete Website.
// Ablauf pro Nachricht:
//   1. Passwort prüfen
//   2. aktuelle Website-Dateien FRISCH aus dem GitHub-Repo lesen
//   3. Ollama Cloud fragen (Struktur-Antwort mit reply + edits)
//   4. Änderungen anwenden (edit = eindeutiges Suchen/Ersetzen, create = neue Datei)
//   5. geänderte Dateien in EINEM Commit ins Repo schreiben  → Pages baut neu
//
// Secrets (via `wrangler secret put`):
//   CHAT_PASSWORD   – geteiltes Passwort für den Chat
//   OLLAMA_API_KEY  – Ollama-Cloud-Schlüssel
//   GH_TOKEN        – GitHub-Token mit contents:write auf dem Repo
// Variablen (wrangler.toml [vars]):
//   GH_OWNER, GH_REPO, GH_BRANCH, SITE_PREFIX, ALLOWED_ORIGIN, OLLAMA_MODEL

const TEXT_EXT = ['.html', '.css', '.js', '.svg', '.json', '.txt', '.md'];
const IMG_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_EDITS = 10;
const MAX_FIND = 4000;
const MAX_CONTENT = 120_000;
const MAX_CONTEXT_FILE = 60_000;
const MAX_CONTEXT_TOTAL = 300_000;
const MAX_TEXT = 4000;
const MAX_IMAGE_BYTES = 5_000_000;

// ---------- reine Logik (auch per Node-Test prüfbar) ----------

export function parseModelJson(content) {
  const clean = String(content || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { const o = JSON.parse(clean); if (o && typeof o === 'object' && 'reply' in o) return o; } catch {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { const o = JSON.parse(m[0]); if (o && typeof o === 'object' && 'reply' in o) return o; } catch {} }
  return { reply: clean };
}

// Pfad relativ zum Site-Ordner prüfen (kein Ausbruch, Textdatei, keine Uploads)
export function safeRelPath(rel) {
  if (typeof rel !== 'string' || !rel.trim()) throw new Error('Datei fehlt');
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.some(p => p === '..' || p === '.')) throw new Error('Pfad ungültig');
  const clean = parts.join('/');
  const ext = clean.slice(clean.lastIndexOf('.')).toLowerCase();
  if (!TEXT_EXT.includes(ext)) throw new Error('Dateityp nicht erlaubt');
  if (parts.includes('uploads')) throw new Error('Uploads sind geschützt');
  return clean;
}

// Wendet edits auf eine Map {relPfad: Inhalt} an. Gibt geänderte Dateien +
// Protokoll zurück. knownPaths = alle vorhandenen Pfade (für create-Check).
export function applyEditsToFiles(files, edits, knownPaths) {
  const changed = {};
  const applied = [];
  const failed = [];
  if (!Array.isArray(edits)) return { changed, applied, failed };
  if (edits.length > MAX_EDITS) failed.push(`${edits.length - MAX_EDITS} pominięto / verworfen (Limit ${MAX_EDITS})`);
  // Arbeitskopie, damit mehrere Edits derselben Datei aufeinander aufbauen
  const work = { ...files };
  for (const e of edits.slice(0, MAX_EDITS)) {
    try {
      if (!e || typeof e !== 'object') throw new Error('ungültige Änderung');
      const rel = safeRelPath(e.file);
      if (e.op === 'create') {
        if (typeof e.content !== 'string' || !e.content) throw new Error('content fehlt');
        if (e.content.length > MAX_CONTENT) throw new Error('Datei zu groß');
        if (knownPaths.has(rel) || rel in work) throw new Error('Datei existiert schon (op:edit benutzen)');
        work[rel] = e.content;
        changed[rel] = e.content;
        applied.push(rel + ' (neu)');
      } else if (e.op === 'edit') {
        if (typeof e.find !== 'string' || typeof e.replace !== 'string') throw new Error('find/replace fehlt');
        if (!e.find || e.find.length > MAX_FIND || e.replace.length > MAX_FIND) throw new Error('Änderung zu groß');
        if (!(rel in work)) throw new Error('nie znaleziono pliku / Datei nicht gefunden');
        const src = work[rel];
        const i = src.indexOf(e.find);
        if (i < 0) throw new Error('nie znaleziono / Suchtext nicht gefunden');
        if (src.indexOf(e.find, i + e.find.length) !== -1) throw new Error('Suchtext nicht eindeutig — längeren wählen');
        const next = src.slice(0, i) + e.replace + src.slice(i + e.find.length);
        work[rel] = next;
        changed[rel] = next;
        applied.push(rel);
      } else {
        throw new Error('unbekannte Operation');
      }
    } catch (err) {
      failed.push(`${(e && e.file) || '?'}: ${err.message}`);
    }
  }
  return { changed, applied, failed };
}

export function systemPrompt(files) {
  let budget = MAX_CONTEXT_TOTAL;
  const blocks = [];
  for (const [rel, content] of Object.entries(files)) {
    if (content.length > MAX_CONTEXT_FILE) { blocks.push(`===== ${rel} ===== (zu groß, ausgelassen)`); continue; }
    if (budget - content.length < 0) { blocks.push(`===== ${rel} ===== (Kontext voll, ausgelassen)`); continue; }
    budget -= content.length;
    blocks.push(`===== ${rel} =====\n${content}`);
  }
  return `You are the design assistant for the Spanko website (a Polish bedroom/mattress shop; navy+gold theme; sloth mascot; slogan "Sen ma znaczenie"). Visitors send design change requests in Polish or German. You can edit the whole website and create new files (e.g. sub-pages) inside the site folder.

CRITICAL OUTPUT FORMAT: Respond with EXACTLY ONE JSON object and nothing else — no prose around it, no markdown fences:
{"reply": "<short message to the user in their language>", "edits": [ ... ]}
Omit "edits" (or use []) when no file change is needed.

Each edit is one of:
- {"op":"edit","file":"<path>","find":"<exact substring copied verbatim from the file>","replace":"<new text>"} — "find" MUST occur EXACTLY ONCE in that file (ambiguous finds are rejected → then retry with a longer unique snippet). Never invent text that is not literally in the file.
- {"op":"create","file":"<new path e.g. pages/betten.html>","content":"<full file content>"} — creates a new file (fails if it exists).

Rules:
- Reply in the same language as the user's last message (Polish or German). Keep replies short and friendly.
- At most ${MAX_EDITS} edits per reply. Change only what the user asked for.
- Page texts exist in Polish AND German (i18n.js): when changing wording, update BOTH languages.
- New HTML pages must include <link rel="stylesheet" href="styles.css"> (adjust the relative path in subfolders) and follow the existing design.
- BE CAREFUL with chat-widget.js, chat-config.js and sloth-buddy.js: breaking them breaks the chat itself. Avoid unless explicitly asked.
- If a request is unclear, off-topic or dangerous, ask back or decline — without edits.

Current website files:

${blocks.join('\n\n')}`;
}

// ---------- GitHub-Anbindung ----------

function ghHeaders(env) {
  return {
    authorization: `Bearer ${env.GH_TOKEN}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'spanko-worker',
    'x-github-api-version': '2022-11-28',
  };
}
function ghUrl(env, p) { return `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/${p}`; }

async function ghGet(env, p) {
  const r = await fetch(ghUrl(env, p), { headers: ghHeaders(env) });
  if (!r.ok) throw new Error(`GitHub GET ${p} → ${r.status}`);
  return r.json();
}
async function ghPost(env, p, bodyObj, method = 'POST') {
  const r = await fetch(ghUrl(env, p), { method, headers: { ...ghHeaders(env), 'content-type': 'application/json' }, body: JSON.stringify(bodyObj) });
  if (!r.ok) throw new Error(`GitHub ${method} ${p} → ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// Frische Website-Textdateien + Basis-Commit/Tree laden
async function loadSite(env) {
  const prefix = (env.SITE_PREFIX || 'site').replace(/\/+$/, '');
  const branch = env.GH_BRANCH || 'main';
  const ref = await ghGet(env, `git/ref/heads/${branch}`);
  const headSha = ref.object.sha;
  const commit = await ghGet(env, `git/commits/${headSha}`);
  const baseTreeSha = commit.tree.sha;
  const tree = await ghGet(env, `git/trees/${baseTreeSha}?recursive=1`);

  const knownPaths = new Set();
  const textBlobs = [];
  for (const entry of tree.tree) {
    if (entry.type !== 'blob') continue;
    if (!entry.path.startsWith(prefix + '/')) continue;
    const rel = entry.path.slice(prefix.length + 1);
    if (rel.split('/').includes('uploads')) continue;
    knownPaths.add(rel);
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
    if (TEXT_EXT.includes(ext)) textBlobs.push({ rel, sha: entry.sha });
  }
  // wichtige Dateien zuerst (kommen zuerst in den Kontext-Budget)
  const rank = r => (r === 'index.html' ? 0 : r === 'styles.css' ? 1 : r === 'i18n.js' ? 2 : r.endsWith('.html') ? 3 : 4);
  textBlobs.sort((a, b) => rank(a.rel) - rank(b.rel) || a.rel.localeCompare(b.rel));

  const files = {};
  for (const b of textBlobs) {
    const blob = await ghGet(env, `git/blobs/${b.sha}`);
    files[b.rel] = decodeBase64Utf8(blob.content);
  }
  return { headSha, baseTreeSha, prefix, branch, files, knownPaths };
}

// Geänderte/erzeugte Dateien als EIN Commit schreiben
async function commitFiles(env, base, textChanges, binaryChanges, message) {
  const treeItems = [];
  for (const [rel, content] of Object.entries(textChanges)) {
    const blob = await ghPost(env, 'git/blobs', { content, encoding: 'utf-8' });
    treeItems.push({ path: `${base.prefix}/${rel}`, mode: '100644', type: 'blob', sha: blob.sha });
  }
  for (const [rel, b64] of Object.entries(binaryChanges || {})) {
    const blob = await ghPost(env, 'git/blobs', { content: b64, encoding: 'base64' });
    treeItems.push({ path: `${base.prefix}/${rel}`, mode: '100644', type: 'blob', sha: blob.sha });
  }
  if (!treeItems.length) return null;
  const newTree = await ghPost(env, 'git/trees', { base_tree: base.baseTreeSha, tree: treeItems });
  const newCommit = await ghPost(env, 'git/commits', { message, tree: newTree.sha, parents: [base.headSha] });
  await ghPost(env, `git/refs/heads/${base.branch}`, { sha: newCommit.sha }, 'PATCH');
  return newCommit.sha;
}

// ---------- Ollama ----------

async function askOllama(env, systemMsg, history) {
  const SCHEMA = {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      edits: {
        type: 'array', maxItems: MAX_EDITS,
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['edit', 'create'] },
            file: { type: 'string' }, find: { type: 'string' },
            replace: { type: 'string' }, content: { type: 'string' },
          },
          required: ['op', 'file'],
        },
      },
    },
    required: ['reply'],
  };
  const r = await fetch('https://ollama.com/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OLLAMA_API_KEY}` },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL || 'gpt-oss:120b',
      stream: false, format: SCHEMA,
      messages: [{ role: 'system', content: systemMsg }, ...history],
    }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status} ${(await r.text()).slice(0, 160)}`);
  const data = await r.json();
  return parseModelJson(data.message && data.message.content);
}

// ---------- Hilfsfunktionen ----------

function decodeBase64Utf8(b64) {
  const bin = atob(String(b64).replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function cors(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
}
function json(obj, status, env) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...cors(env) } });
}

// ---------- HTTP-Handler ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (url.pathname === '/health') return json({ ok: true }, 200, env);

    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'bad request' }, 400, env); }
    if (!env.CHAT_PASSWORD || payload.password !== env.CHAT_PASSWORD) {
      return json({ error: 'unauthorized' }, 401, env);
    }

    try {
      if (url.pathname === '/chat' && request.method === 'POST') {
        const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, MAX_TEXT) : '';
        if (!text) return json({ error: 'empty text' }, 400, env);
        const base = await loadSite(env);
        const sys = systemPrompt(base.files);
        const out = await askOllama(env, sys, [{ role: 'user', content: text }]);
        const { changed, applied, failed } = applyEditsToFiles(base.files, out.edits, base.knownPaths);
        let committed = false;
        if (Object.keys(changed).length) {
          await commitFiles(env, base, changed, null, `chat: ${text.slice(0, 60)}`);
          committed = true;
        }
        return json({ reply: String(out.reply || '').trim(), applied, failed, committed }, 200, env);
      }

      if (url.pathname === '/upload' && request.method === 'POST') {
        const m = /^data:([\w/+.-]+);base64,(.+)$/i.exec(payload.dataUrl || '');
        const ext = m && IMG_MIME[m[1].toLowerCase()];
        if (!m || !ext) return json({ error: 'not an image' }, 400, env);
        const bytes = atob(m[2]).length;
        if (bytes > MAX_IMAGE_BYTES) return json({ error: 'too large' }, 413, env);
        const safe = String(payload.name || 'foto').replace(/\.[^.]*$/, '').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 40) || 'foto';
        const rel = `assets/uploads/${Date.now()}-${safe}.${ext}`;
        const base = await loadSite(env);
        await commitFiles(env, base, {}, { [rel]: m[2] }, `chat: Foto ${safe}`);
        return json({ reply: `📷 ${payload.name || 'Foto'} → ${rel}`, applied: [rel], failed: [], committed: true, image: rel }, 200, env);
      }

      return json({ error: 'not found' }, 404, env);
    } catch (e) {
      return json({ reply: '⚠️ Fehler: ' + String(e.message || e).slice(0, 180), applied: [], failed: [], committed: false }, 200, env);
    }
  },
};
