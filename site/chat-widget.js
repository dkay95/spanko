(async function () {
  const CLOUD = (window.SPANKO_CHAT && window.SPANKO_CHAT.endpoint || '').replace(/\/+$/, '');

  // --- Erreichbarkeit klären ---
  // Cloud-Modus: Worker konfiguriert → Chat immer anzeigen.
  // Lokaler Modus: /api/chat auf demselben Server probieren; auf dem statischen
  // Host (404) bleibt der Chat unsichtbar.
  if (!CLOUD) {
    const reopen = sessionStorage.getItem('spankoChatOpen') === '1';
    let reachable = false;
    for (let attempt = 0; attempt < (reopen ? 6 : 3); attempt++) {
      try {
        const probe = await fetch('/api/chat?since=' + Date.now());
        if (probe.status === 404) return;
        if (probe.ok) { await probe.json(); reachable = true; break; }
      } catch {}
      await new Promise(r => setTimeout(r, 1500));
    }
    if (!reachable) return;
  }

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
  let booted = false;
  let typingEl = null;
  let typingTimeout = null;
  const seen = new Set();

  if (sessionStorage.getItem('spankoChatOpen') === '1') {
    sessionStorage.removeItem('spankoChatOpen');
    panel.hidden = false;
  }
  const draft = sessionStorage.getItem('spankoChatDraft');
  if (draft) { sessionStorage.removeItem('spankoChatDraft'); input.value = draft; }

  box.querySelector('#chatFab').onclick = () => { panel.hidden = !panel.hidden; };
  box.querySelector('#chatClose').onclick = () => { panel.hidden = true; };

  function showTyping() {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      hideTyping();
      addLocal('⚠️ brak odpowiedzi / keine Antwort — połączenie? / Verbindung prüfen');
    }, 150_000);
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'msg assistant typing';
    typingEl.textContent = '🦥 …';
    log.appendChild(typingEl);
    log.scrollTop = log.scrollHeight;
  }
  function hideTyping() {
    clearTimeout(typingTimeout); typingTimeout = null;
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  function render(m, opts) {
    opts = opts || {};
    const d = document.createElement('div');
    d.className = 'msg ' + m.from;
    if (m.image) {
      const img = document.createElement('img');
      img.className = 'msg-img'; img.src = m.image; d.appendChild(img);
    }
    if (m.text) {
      const t = document.createElement('div'); t.textContent = m.text; d.appendChild(t);
    }
    if (typingEl) log.insertBefore(d, typingEl); else log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  // sofortige lokale UI-Nachricht (kein Server)
  function addLocal(text, from) {
    render({ from: from || 'assistant', text });
  }

  // ======================= CLOUD-MODUS =======================
  if (CLOUD) {
    let pw = localStorage.getItem('spankoChatPw') || '';

    function ensurePw() {
      if (pw) return true;
      const entered = prompt('Hasło / Passwort für den Design-Chat:');
      if (entered == null || !entered.trim()) return false;
      pw = entered.trim();
      localStorage.setItem('spankoChatPw', pw);
      return true;
    }

    async function callCloud(path, extra) {
      const r = await fetch(CLOUD + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw, ...extra }),
      });
      if (r.status === 401) {
        pw = ''; localStorage.removeItem('spankoChatPw');
        throw new Error('unauthorized');
      }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }

    function afterReply(res) {
      const parts = [String(res.reply || '').trim()];
      if (res.applied && res.applied.length) parts.push('🔧 ' + res.applied.join(', '));
      if (res.failed && res.failed.length) parts.push('⚠️ ' + res.failed.join(' | '));
      addLocal(parts.filter(Boolean).join('\n'));
      if (res.committed) {
        addLocal('⏳ Zmiany będą widoczne za ~1 min / Änderung ist in ~1 Min live. Odświeżę stronę / Ich lade neu…');
        sessionStorage.setItem('spankoChatOpen', panel.hidden ? '0' : '1');
        setTimeout(() => location.reload(), 75_000);
      }
    }

    box.querySelector('#chatForm').onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (!ensurePw()) return;
      input.value = '';
      render({ from: 'colleague', text });
      showTyping();
      try { hideTyping(); afterReply(await callCloud('/chat', { text })); }
      catch (err) {
        hideTyping();
        addLocal(err.message === 'unauthorized'
          ? '🔒 Błędne hasło / Falsches Passwort — bitte erneut senden.'
          : '⚠️ Fehler — Server nicht erreichbar.');
      }
    };

    async function upload(file) {
      if (!file || !file.type.startsWith('image/')) return;
      if (!ensurePw()) return;
      const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
      render({ from: 'colleague', image: dataUrl, text: '📷 ' + file.name });
      showTyping();
      try { hideTyping(); afterReply(await callCloud('/upload', { name: file.name, dataUrl })); }
      catch { hideTyping(); addLocal('⚠️ Foto-Upload fehlgeschlagen.'); }
    }
    const fileInput = box.querySelector('#chatFile');
    fileInput.onchange = () => { upload(fileInput.files[0]); fileInput.value = ''; };
    panel.addEventListener('dragover', e => { e.preventDefault(); drop.hidden = false; });
    panel.addEventListener('dragleave', e => { if (e.target === panel || e.target === drop) drop.hidden = true; });
    panel.addEventListener('drop', e => { e.preventDefault(); drop.hidden = true; if (e.dataTransfer.files.length) upload(e.dataTransfer.files[0]); });
    return;
  }

  // ======================= LOKALER MODUS =======================
  function add(m, live) {
    const key = m.ts + m.from + (m.text || '') + (m.image || '');
    if (seen.has(key)) return;
    seen.add(key);
    render(m);
    if (live && m.reload && m.from === 'assistant') {
      sessionStorage.setItem('spankoChatOpen', panel.hidden ? '0' : '1');
      if (input.value.trim()) sessionStorage.setItem('spankoChatDraft', input.value);
      setTimeout(() => location.reload(), 1600);
    }
  }

  box.querySelector('#chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      const m = await r.json();
      add(m, true);
      if (m.aiPending) showTyping();
    } catch {
      add({ ts: Date.now(), from: 'assistant', text: '(offline — serwer niedostępny / Server nicht erreichbar)' }, false);
    }
  };

  async function upload(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
    try {
      const r = await fetch('/api/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, dataUrl }) });
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
  panel.addEventListener('dragover', e => { e.preventDefault(); drop.hidden = false; });
  panel.addEventListener('dragleave', e => { if (e.target === panel || e.target === drop) drop.hidden = true; });
  panel.addEventListener('drop', e => { e.preventDefault(); drop.hidden = true; if (e.dataTransfer.files.length) upload(e.dataTransfer.files[0]); });

  async function poll() {
    try {
      const r = await fetch('/api/chat?since=' + since);
      const { messages, aiBusy } = await r.json();
      const live = booted;
      messages.forEach(m => { add(m, live); since = Math.max(since, m.ts); });
      booted = true;
      if (aiBusy) showTyping(); else hideTyping();
    } catch {}
  }
  setInterval(poll, 3000);
  poll();
})();
