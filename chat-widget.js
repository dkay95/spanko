(async function () {
  // Nur aktivieren, wenn ein Chat-Server erreichbar ist (lokal).
  // Auf dem Dauer-Hoster gibt es keinen (404) — dann bleibt der Chat unsichtbar.
  // Bei Netzwerk-Wacklern (z.B. direkt nach einem Auto-Reload) mehrfach versuchen.
  const reopen = sessionStorage.getItem('spankoChatOpen') === '1';
  let reachable = false;
  for (let attempt = 0; attempt < (reopen ? 6 : 3); attempt++) {
    try {
      const probe = await fetch('/api/chat?since=' + Date.now());
      if (probe.status === 404) return;        // statischer Host: kein Chat
      if (probe.ok) { await probe.json(); reachable = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 1500));
  }
  if (!reachable) return;

  const box = document.createElement('div');
  box.className = 'spanko-chat';
  box.innerHTML = `
    <button id="chatFab" aria-label="Chat">💬</button>
    <div id="chatPanel" hidden>
      <div id="chatHead">
        <span data-i18n="chat_title">Spanko — Design-Chat</span>
        <button id="chatClose" aria-label="close">×</button>
      </div>
      <div id="chatLog"></div>
      <div id="chatDrop" hidden>📷 Foto hier ablegen / upuść zdjęcie</div>
      <form id="chatForm">
        <label id="chatAttach" title="Foto / Zdjęcie">📎<input id="chatFile" type="file" accept="image/*" hidden></label>
        <input id="chatInput" autocomplete="off" data-i18n-ph="chat_placeholder" placeholder="Nachricht schreiben…" />
        <button aria-label="send">➤</button>
      </form>
    </div>`;
  document.body.appendChild(box);

  const log = box.querySelector('#chatLog');
  const panel = box.querySelector('#chatPanel');
  const drop = box.querySelector('#chatDrop');
  const input = box.querySelector('#chatInput');
  let since = 0;
  let booted = false;        // erste Abfrage = alte Historie (löst kein Neuladen aus)
  let typingEl = null;
  let typingTimeout = null;
  const seen = new Set();

  // Nach einem automatischen Neuladen: Chat wieder öffnen + Entwurf zurückholen
  if (reopen) {
    sessionStorage.removeItem('spankoChatOpen');
    panel.hidden = false;
  }
  const draft = sessionStorage.getItem('spankoChatDraft');
  if (draft) {
    sessionStorage.removeItem('spankoChatDraft');
    input.value = draft;
  }

  box.querySelector('#chatFab').onclick = () => { panel.hidden = !panel.hidden; };
  box.querySelector('#chatClose').onclick = () => { panel.hidden = true; };

  function showTyping() {
    clearTimeout(typingTimeout);
    // Sicherheitsnetz: nach 2,5 min ohne Server-Signal Indikator ersetzen
    typingTimeout = setTimeout(() => {
      hideTyping();
      add({ ts: Date.now(), from: 'assistant', text: '⚠️ brak odpowiedzi / keine Antwort — połączenie? / Verbindung prüfen' }, false);
    }, 150_000);
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'msg assistant typing';
    typingEl.textContent = '🦥 …';
    log.appendChild(typingEl);
    log.scrollTop = log.scrollHeight;
  }
  function hideTyping() {
    clearTimeout(typingTimeout);
    typingTimeout = null;
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  function add(m, live) {
    const key = m.ts + m.from + (m.text || '') + (m.image || '');
    if (seen.has(key)) return;
    seen.add(key);
    const d = document.createElement('div');
    d.className = 'msg ' + m.from;
    if (m.image) {
      const img = document.createElement('img');
      img.className = 'msg-img';
      img.src = m.image;
      d.appendChild(img);
    }
    if (m.text) {
      const t = document.createElement('div');
      t.textContent = m.text;
      d.appendChild(t);
    }
    // Indikator ans Ende rücken, falls er gerade sichtbar ist
    if (typingEl) log.insertBefore(d, typingEl);
    else log.appendChild(d);
    log.scrollTop = log.scrollHeight;

    // Nach einer angewendeten Design-Änderung Seite neu laden (nur bei frisch
    // eingetroffenen Nachrichten, nicht beim Nachladen der Historie)
    if (live && m.reload && m.from === 'assistant') {
      sessionStorage.setItem('spankoChatOpen', panel.hidden ? '0' : '1');
      if (input.value.trim()) sessionStorage.setItem('spankoChatDraft', input.value);
      setTimeout(() => location.reload(), 1600);
    }
  }

  // Text senden
  box.querySelector('#chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const m = await r.json();
      add(m, true);
      if (m.aiPending) showTyping();
    } catch {
      add({ ts: Date.now(), from: 'assistant', text: '(offline — serwer niedostępny / Server nicht erreichbar)' }, false);
    }
  };

  // Foto hochladen
  async function upload(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(file);
    });
    try {
      const r = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: file.name, dataUrl }),
      });
      if (!r.ok) throw new Error();
      const m = await r.json();
      add(m, true);
      if (m.aiPending) showTyping();
    } catch {
      add({ ts: Date.now(), from: 'assistant', text: '(błąd zdjęcia / Foto-Upload fehlgeschlagen)' }, false);
    }
  }

  const fileInput = box.querySelector('#chatFile');
  fileInput.onchange = () => { upload(fileInput.files[0]); fileInput.value = ''; };

  // Drag & Drop auf das Chat-Fenster
  panel.addEventListener('dragover', e => { e.preventDefault(); drop.hidden = false; });
  panel.addEventListener('dragleave', e => { if (e.target === panel || e.target === drop) drop.hidden = true; });
  panel.addEventListener('drop', e => {
    e.preventDefault(); drop.hidden = true;
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files[0]);
  });

  async function poll() {
    try {
      const r = await fetch('/api/chat?since=' + since);
      const { messages, aiBusy } = await r.json();
      const live = booted;
      messages.forEach(m => { add(m, live); since = Math.max(since, m.ts); });
      booted = true;
      // Tipp-Anzeige folgt dem Server-Zustand (überlebt Reloads & echte Menschen-Antworten)
      if (aiBusy) showTyping();
      else hideTyping();
    } catch {}
  }
  setInterval(poll, 3000);
  poll();
})();
