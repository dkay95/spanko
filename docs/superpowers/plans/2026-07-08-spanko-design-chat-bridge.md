# Spanko Design-Website mit Chat-Brücke — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual (PL/DE) design-only landing page for the "Spanko" bedroom shop, plus a local chat bridge that relays a colleague's design-change requests into this Claude Code session.

**Architecture:** A dependency-free Node `http` server serves a static single-page site and exposes a tiny chat API backed by an append-only JSONL file. A background watcher wakes this session when a new colleague message arrives; the session edits the site files and appends a reply to the same file. A Cloudflare quick tunnel exposes the local server via a public link.

**Tech Stack:** Plain HTML/CSS/JS (no framework, no build step), Node.js built-in `http`/`fs` (zero npm dependencies), `cloudflared` quick tunnel.

## Global Constraints

- Zero runtime npm dependencies — use only Node built-ins (`http`, `fs`, `path`, `url`).
- Site is **design only** — no cart, checkout, payment, product DB, or admin.
- Fully bilingual **Polish + German**, toggled client-side without page reload; PL is default.
- Brand: name "Spanko", slogan "Sen ma znaczenie" (PL) / "Schlaf hat Bedeutung" (DE), sloth mascot, dark+gold theme with warm light sections.
- Chat file is append-only JSONL; each line `{"ts": <number ms>, "from": "colleague"|"assistant", "text": <string>}`.
- All chat/state files live under `.chat/` (gitignored). Node `Date.now()` is used for timestamps (normal Node process — allowed).

---

## File Structure

- `server/server.js` — static file server + chat API (`POST /api/chat`, `GET /api/chat?since=`). Single responsibility: HTTP + file I/O, no design logic.
- `server/chat-store.js` — read/append helpers for `.chat/messages.jsonl`. Shared by server and reply script.
- `site/index.html` — single-page design markup, sectioned, with `data-i18n` keys.
- `site/styles.css` — Spanko theme (dark/gold + light sections), responsive.
- `site/i18n.js` — PL/DE string table + language toggle logic.
- `site/chat-widget.js` — chat button, panel, send + poll wiring.
- `site/assets/` — SVG mascot/logo placeholders (real photos dropped in later).
- `scripts/wait-for-message.js` — blocks until a new `colleague` message appears, then exits (session waker).
- `scripts/reply.js` — appends an `assistant` message to the chat file.
- `scripts/start.sh` — starts the server (and prints tunnel instructions).
- `test/server.smoke.js` — Node smoke test: boot server, POST a message, GET it back.
- `README.md` — how to run + how to send the colleague a link.

---

## Task 1: Chat store + server with smoke test

**Files:**
- Create: `server/chat-store.js`
- Create: `server/server.js`
- Create: `test/server.smoke.js`
- Create: `.chat/.gitkeep`

**Interfaces:**
- Produces: `chat-store.js` exports `appendMessage({from, text}) -> messageObject` and `readSince(ts) -> messageObject[]`, where `messageObject = {ts:number, from:string, text:string}`. File path is `.chat/messages.jsonl` at repo root.
- Produces: server listens on `PORT` env (default `4321`), serves `site/` statically (`/` → `site/index.html`), `POST /api/chat` `{text}` → appends `{from:"colleague"}` and returns the stored object as JSON, `GET /api/chat?since=<ts>` → `{messages: [...]}` with `ts > since`.

- [ ] **Step 1: Write the failing smoke test** — `test/server.smoke.js`

```js
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
    const r = http.request({ host: '127.0.0.1', port: PORT, path: urlPath, method,
      headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {} },
      (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node test/server.smoke.js`
Expected: FAIL (server.js does not exist yet → spawn error / SMOKE FAIL).

- [ ] **Step 3: Implement `server/chat-store.js`**

```js
const fs = require('fs');
const path = require('path');

const CHAT_DIR = process.env.CHAT_DIR || path.join(__dirname, '..', '.chat');
const FILE = path.join(CHAT_DIR, 'messages.jsonl');

function ensure() { fs.mkdirSync(CHAT_DIR, { recursive: true }); if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, ''); }

function appendMessage({ from, text }) {
  ensure();
  const msg = { ts: Date.now(), from, text: String(text || '') };
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
```

- [ ] **Step 4: Implement `server/server.js`**

```js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { appendMessage, readSince } = require('./chat-store');

const PORT = process.env.PORT || 4321;
const SITE = path.join(__dirname, '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function body(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); }); }
function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/chat' && req.method === 'POST') {
    try { const { text } = JSON.parse(await body(req) || '{}'); return json(res, 200, appendMessage({ from: 'colleague', text })); }
    catch { return json(res, 400, { error: 'bad request' }); }
  }
  if (u.pathname === '/api/chat' && req.method === 'GET') {
    return json(res, 200, { messages: readSince(Number(u.searchParams.get('since') || 0)) });
  }
  // static
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

server.listen(PORT, () => console.log(`Spanko läuft auf http://localhost:${PORT}`));
```

- [ ] **Step 5: Create `site/index.html` minimal stub** (so `GET /` returns 200 for the smoke test)

```html
<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Spanko</title></head><body>Spanko</body></html>
```

- [ ] **Step 6: Create `.chat/.gitkeep`** (empty file) so the dir exists.

- [ ] **Step 7: Run the smoke test to verify it passes**

Run: `node test/server.smoke.js`
Expected: `SMOKE OK`, exit 0.

- [ ] **Step 8: Commit**

```bash
git add server test site/index.html .chat/.gitkeep
git commit -m "feat: chat bridge server + store with smoke test"
```

---

## Task 2: Site theme + i18n scaffold with language toggle

**Files:**
- Modify: `site/index.html` (replace stub with header + skeleton + script includes)
- Create: `site/styles.css`
- Create: `site/i18n.js`
- Create: `site/assets/logo.svg` (simple sloth-on-bed line mark)

**Interfaces:**
- Produces: `i18n.js` reads `data-i18n="key"` attributes and swaps `textContent` from a `STRINGS = { pl: {...}, de: {...} }` table; exposes `setLang('pl'|'de')` on a header toggle; persists choice in `localStorage.spankoLang`; default `pl`.
- Consumes: Task 1 server serving `site/`.

- [ ] **Step 1: Create `site/styles.css` theme tokens + base**

Define CSS variables in `:root`: `--navy:#0f1c33; --gold:#c99a4b; --cream:#f5efe3; --ink:#1a1a1a; --text-on-dark:#e9ecf2`. Base resets, container `max-width:1200px`, header styling (sticky, navy bg, gold accents), buttons (`.btn-gold`, `.btn-outline`), section rhythm. Responsive: single column under 768px. (Full styling refined during Task 3 build.)

- [ ] **Step 2: Create `site/assets/logo.svg`** — a simple line-art sloth-on-a-bed with crescent moon, gold stroke on transparent, ~48px. Inline SVG paths (hand-drawn simple mark).

- [ ] **Step 3: Create `site/i18n.js`**

```js
const STRINGS = {
  pl: { nav_home:'Strona główna', nav_beds:'Łóżka', nav_mattresses:'Materace',
        nav_accessories:'Akcesoria', nav_about:'O nas', nav_contact:'Kontakt',
        hero_tag:'Sen ma znaczenie', hero_title:'Dobry sen zaczyna się tutaj',
        cta_products:'Zobacz produkty', cta_visit:'Umów wizytę' },
  de: { nav_home:'Startseite', nav_beds:'Betten', nav_mattresses:'Matratzen',
        nav_accessories:'Zubehör', nav_about:'Über uns', nav_contact:'Kontakt',
        hero_tag:'Schlaf hat Bedeutung', hero_title:'Guter Schlaf beginnt hier',
        cta_products:'Produkte ansehen', cta_visit:'Termin vereinbaren' },
};
function setLang(lang) {
  const dict = STRINGS[lang] || STRINGS.pl;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = dict[el.getAttribute('data-i18n')]; if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-lang-btn]').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-lang-btn') === lang));
  localStorage.setItem('spankoLang', lang);
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-lang-btn]').forEach(b =>
    b.addEventListener('click', () => setLang(b.getAttribute('data-lang-btn'))));
  setLang(localStorage.getItem('spankoLang') || 'pl');
});
```

- [ ] **Step 4: Replace `site/index.html`** with header (logo, nav using `data-i18n`, PL/DE toggle buttons `data-lang-btn`), an empty `<main>`, and `<link>`/`<script>` includes for `styles.css`, `i18n.js`, `chat-widget.js`.

- [ ] **Step 5: Verify in browser**

Run: `PORT=4321 node server/server.js` then open `http://localhost:4321`.
Expected: header renders; clicking DE swaps nav + slogan to German, PL swaps back; choice persists on reload.

- [ ] **Step 6: Commit**

```bash
git add site
git commit -m "feat: Spanko theme + PL/DE i18n toggle"
```

---

## Task 3: Content sections (bilingual)

**Files:**
- Modify: `site/index.html` (fill `<main>` + footer)
- Modify: `site/i18n.js` (add all section keys for pl + de)
- Modify: `site/styles.css` (section styling)
- Create: `site/assets/mascot.svg`, category icon SVGs as needed.

**Interfaces:**
- Consumes: `setLang`/`data-i18n` mechanism from Task 2.
- Produces: complete design page; no new JS interfaces.

Sections to build, each with `data-i18n` keys added to BOTH `pl` and `de` in `i18n.js`:
1. **Hero** — slogan tag, big title, subtitle ("Tworzymy produkty…" / "Wir schaffen Produkte…"), two buttons, mascot image.
2. **Kategorie** — heading "Wybierz kategorię"/"Kategorie wählen"; 6 cards: Łóżka/Betten, Materace/Matratzen, Pościel/Bettwäsche, Poduszki/Kissen, Dla dzieci/Für Kinder, Akcesoria/Zubehör — each icon + label + "Zobacz więcej"/"Mehr ansehen".
3. **Vorteile** — 5 items: 100 nocy na test/100 Nächte Test, 10 lat gwarancji/10 Jahre Garantie, Darmowa dostawa/Gratis-Lieferung, Polska jakość/Polnische Qualität, Profesjonalne doradztwo/Professionelle Beratung.
4. **Polecane produkty / Empfohlene Produkte** — 4 placeholder product cards (Łóżko Luna, Materac Premium, Stelaż Comfort, Poduszka Cloud) with "od X zł"/"ab X zł" and star rating. Design only.
5. **O salonie / Über den Laden** — image + paragraph + button.
6. **Opinie klientów / Kundenmeinungen** — 3 testimonial cards, 5 stars.
7. **Kontakt** — address (TANIEC 1, 32-800 Brzesko), phone 123 456 789, email biuro@spanko.pl, hours (Pon–Pt 9–17 / Sob 9–13), static map placeholder box.
8. **Footer** — logo, slogan, link columns (PRODUKTY/INFORMACJE/POMOC translated), social icons, copyright.

- [ ] **Step 1:** Add all bilingual keys to `site/i18n.js` (`pl` + `de`), one key per text above.
- [ ] **Step 2:** Build the 8 sections in `site/index.html` using those `data-i18n` keys and placeholder SVG/`assets` imagery.
- [ ] **Step 3:** Style all sections in `site/styles.css` — alternating dark (navy/gold) and light (cream) bands, cards with hover, responsive grid collapsing to 1–2 columns on mobile.
- [ ] **Step 4: Verify in browser** — page matches the Spanko look; DE/PL toggle swaps every visible text; layout holds on a narrow (mobile) viewport.
- [ ] **Step 5: Commit**

```bash
git add site
git commit -m "feat: full bilingual Spanko landing sections"
```

---

## Task 4: Chat widget

**Files:**
- Create: `site/chat-widget.js`
- Modify: `site/styles.css` (widget styling)

**Interfaces:**
- Consumes: server `POST /api/chat` and `GET /api/chat?since=` from Task 1.
- Produces: floating button + panel injected into the page; polls every 3s; renders `colleague` messages right-aligned, `assistant` left-aligned.

- [ ] **Step 1: Implement `site/chat-widget.js`**

```js
(function () {
  const box = document.createElement('div');
  box.innerHTML = `
    <button id="chatFab" aria-label="Chat">💬</button>
    <div id="chatPanel" hidden>
      <div id="chatHead"><span>Spanko — Design-Chat</span><button id="chatClose">×</button></div>
      <div id="chatLog"></div>
      <form id="chatForm"><input id="chatInput" autocomplete="off"
        placeholder="Napisz / Schreiben…" /><button>➤</button></form>
    </div>`;
  document.body.appendChild(box);
  const log = box.querySelector('#chatLog');
  const panel = box.querySelector('#chatPanel');
  let since = 0, seen = new Set();
  box.querySelector('#chatFab').onclick = () => { panel.hidden = !panel.hidden; };
  box.querySelector('#chatClose').onclick = () => { panel.hidden = true; };
  function add(m) {
    const key = m.ts + m.from + m.text; if (seen.has(key)) return; seen.add(key);
    const d = document.createElement('div'); d.className = 'msg ' + m.from; d.textContent = m.text; log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  box.querySelector('#chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const input = box.querySelector('#chatInput'); const text = input.value.trim(); if (!text) return;
    input.value = '';
    try { const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }); add(await r.json()); }
    catch { add({ ts: Date.now(), from: 'assistant', text: '(offline — Server nicht erreichbar)' }); }
  };
  async function poll() {
    try { const r = await fetch('/api/chat?since=' + since); const { messages } = await r.json();
      messages.forEach(m => { add(m); since = Math.max(since, m.ts); }); } catch {}
  }
  setInterval(poll, 3000); poll();
})();
```

- [ ] **Step 2: Style the widget** in `site/styles.css` — fixed bottom-right FAB (gold circle), panel 320×420, message bubbles (`.msg.colleague` gold/right, `.msg.assistant` navy/left), mobile-friendly.
- [ ] **Step 3: Verify** — open site, click FAB, type a message; it appears right-aligned and a line lands in `.chat/messages.jsonl`.

Run: `cat .chat/messages.jsonl`
Expected: a JSON line with `"from":"colleague"` and your text.

- [ ] **Step 4: Commit**

```bash
git add site
git commit -m "feat: on-site design chat widget"
```

---

## Task 5: Session waker + reply helper

**Files:**
- Create: `scripts/wait-for-message.js`
- Create: `scripts/reply.js`

**Interfaces:**
- `wait-for-message.js`: reads `.chat/messages.jsonl`, records current last `ts`, then polls every 1s; exits 0 and prints the new colleague message(s) as JSON when a `colleague` message with `ts >` baseline appears. Used as a background job that returns control to this session.
- `reply.js`: `node scripts/reply.js "<text>"` appends `{from:"assistant", text}` via `chat-store.appendMessage`.

- [ ] **Step 1: Implement `scripts/reply.js`**

```js
const { appendMessage } = require('../server/chat-store');
const text = process.argv.slice(2).join(' ');
if (!text) { console.error('usage: node scripts/reply.js "<text>"'); process.exit(1); }
console.log(JSON.stringify(appendMessage({ from: 'assistant', text })));
```

- [ ] **Step 2: Implement `scripts/wait-for-message.js`**

```js
const { readSince } = require('../server/chat-store');
const start = Math.max(0, ...readSince(0).map(m => m.ts));
const timeoutMs = Number(process.env.WAIT_TIMEOUT || 0); // 0 = no timeout
const began = Date.now();
const iv = setInterval(() => {
  const fresh = readSince(start).filter(m => m.from === 'colleague');
  if (fresh.length) { clearInterval(iv); console.log(JSON.stringify(fresh)); process.exit(0); }
  if (timeoutMs && Date.now() - began > timeoutMs) { clearInterval(iv); console.log('[]'); process.exit(0); }
}, 1000);
```

- [ ] **Step 3: Verify roundtrip manually**
  - Terminal A: `node scripts/wait-for-message.js`
  - Terminal B: `node -e "require('./server/chat-store').appendMessage({from:'colleague',text:'test wach'})"`
  - Expected: Terminal A prints the colleague message JSON and exits 0.
  - Then: `node scripts/reply.js "alles klar"` → appends an assistant line (verify with `cat .chat/messages.jsonl`).

- [ ] **Step 4: Commit**

```bash
git add scripts
git commit -m "feat: session waker + reply helper for chat bridge"
```

---

## Task 6: Start script, tunnel, README

**Files:**
- Create: `scripts/start.sh`
- Create: `README.md`

**Interfaces:** operational glue only.

- [ ] **Step 1: Implement `scripts/start.sh`**

```bash
#!/usr/bin/env bash
set -e
PORT="${PORT:-4321}"
echo "Starte Spanko-Server auf http://localhost:$PORT"
node server/server.js &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
if command -v cloudflared >/dev/null 2>&1; then
  echo "Öffne öffentlichen Tunnel (Link unten weitergeben)…"
  cloudflared tunnel --url "http://localhost:$PORT"
else
  echo "cloudflared nicht installiert — nur lokal unter http://localhost:$PORT erreichbar."
  echo "Für öffentlichen Link:  brew install cloudflared"
  wait $SRV
fi
```

- [ ] **Step 2:** `chmod +x scripts/start.sh`.

- [ ] **Step 3: Write `README.md`** — non-technical, German: what the project is, how to start (`bash scripts/start.sh`), how to get the public link, how to send it to the colleague, the "only runs while Mac + session are on" caveat, and how the design-chat works.

- [ ] **Step 4: Verify** — `bash scripts/start.sh` serves the site locally; if `cloudflared` present, a `https://…trycloudflare.com` link appears and loads the site.

- [ ] **Step 5: Commit**

```bash
git add scripts README.md
git commit -m "feat: start script, tunnel, README"
```

---

## Self-Review Notes

- **Spec coverage:** Website design → Tasks 2–3; bilingual PL/DE toggle → Task 2/3; chat widget → Task 4; local server + chat file → Task 1; session waker → Task 5; tunnel/link → Task 6; "offline when Mac off" → widget offline state (Task 4) + README caveat (Task 6). All spec sections mapped.
- **Placeholders:** none — every code step contains full code; design sections list exact bilingual labels.
- **Type consistency:** `appendMessage`/`readSince`/message shape `{ts,from,text}` are consistent across `chat-store.js`, `server.js`, `reply.js`, `wait-for-message.js`, and the widget. Endpoints `POST/GET /api/chat` consistent between server and widget.
