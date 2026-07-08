(function () {
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
      <form id="chatForm">
        <input id="chatInput" autocomplete="off" data-i18n-ph="chat_placeholder" placeholder="Nachricht schreiben…" />
        <button aria-label="send">➤</button>
      </form>
    </div>`;
  document.body.appendChild(box);

  const log = box.querySelector('#chatLog');
  const panel = box.querySelector('#chatPanel');
  let since = 0;
  const seen = new Set();

  box.querySelector('#chatFab').onclick = () => { panel.hidden = !panel.hidden; };
  box.querySelector('#chatClose').onclick = () => { panel.hidden = true; };

  function add(m) {
    const key = m.ts + m.from + m.text;
    if (seen.has(key)) return;
    seen.add(key);
    const d = document.createElement('div');
    d.className = 'msg ' + m.from;
    d.textContent = m.text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

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
      add(await r.json());
    } catch {
      add({ ts: Date.now(), from: 'assistant', text: '(offline — Server nicht erreichbar)' });
    }
  };

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
