const { readSince } = require('../server/chat-store');
const ai = require('../server/ollama');

// Wenn der KI-Chat aktiv ist, antwortet Ollama selbst — die Mensch-Brücke
// würde Doppel-Antworten erzeugen. Nur mit ALLOW_WITH_AI=1 erzwingbar.
if (ai.enabled() && process.env.ALLOW_WITH_AI !== '1') {
  console.error('KI-Chat ist aktiv (ollama.key vorhanden) — Brücke nicht gestartet, um Doppel-Antworten zu vermeiden. Erzwingen: ALLOW_WITH_AI=1');
  process.exit(2);
}

// baseline = latest ts currently in the file; we only report colleague
// messages that arrive AFTER this script starts.
const start = Math.max(0, ...readSince(0).map(m => m.ts));
const timeoutMs = Number(process.env.WAIT_TIMEOUT || 0); // 0 = wait forever
const began = Date.now();

const iv = setInterval(() => {
  const fresh = readSince(start).filter(m => m.from === 'colleague');
  if (fresh.length) {
    clearInterval(iv);
    console.log(JSON.stringify(fresh));
    process.exit(0);
  }
  if (timeoutMs && Date.now() - began > timeoutMs) {
    clearInterval(iv);
    console.log('[]');
    process.exit(0);
  }
}, 1000);
