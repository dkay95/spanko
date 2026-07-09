(async function () {
  // Nur aktivieren, wenn ein Chat-Server erreichbar ist (lokal).
  // Auf dem Dauer-Hoster gibt es keinen — dann bleibt der Chat unsichtbar.
  try {
    const probe = await fetch('/api/chat?since=' + Date.now());
    if (!probe.ok) return;
    await probe.json();
  } catch { return; }

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
  let since = 0;
  const seen = new Set();

  box.querySelector('#chatFab').onclick = () => { panel.hidden = !panel.hidden; };
  box.querySelector('#chatClose').onclick = () => { panel.hidden = true; };

  function add(m) {
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
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  // send text
  box.querySelector('#chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const input = box.querySelector('#chatInput');
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
      add(m); since = Math.max(since, m.ts);
    } catch {
      add({ ts: Date.now(), from: 'assistant', text: '(offline — Server nicht erreichbar)' });
    }
  };

  // upload a photo
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
      add(m); since = Math.max(since, m.ts);
    } catch {
      add({ ts: Date.now(), from: 'assistant', text: '(Foto-Upload fehlgeschlagen)' });
    }
  }

  const fileInput = box.querySelector('#chatFile');
  fileInput.onchange = () => { upload(fileInput.files[0]); fileInput.value = ''; };

  // drag & drop onto the panel
  panel.addEventListener('dragover', e => { e.preventDefault(); drop.hidden = false; });
  panel.addEventListener('dragleave', e => { if (e.target === panel || e.target === drop) drop.hidden = true; });
  panel.addEventListener('drop', e => {
    e.preventDefault(); drop.hidden = true;
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files[0]);
  });

  async function poll() {
    try {
      const r = await fetch('/api/chat?since=' + since);
      const { messages } = await r.json();
      messages.forEach(m => { add(m); since = Math.max(since, m.ts); });
    } catch {}
  }
  setInterval(poll, 3000);
  poll();
})();
