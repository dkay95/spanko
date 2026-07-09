// Chat-Betriebsart:
// - endpoint LEER  → lokaler Modus (Server auf deinem Mac, Brücke/Ollama lokal)
// - endpoint GESETZT (Cloudflare-Worker-URL) → Cloud-Modus: immer verfügbar,
//   die KI ändert die Website direkt über GitHub (passwortgeschützt)
window.SPANKO_CHAT = {
  endpoint: '', // z.B. 'https://spanko-chat.DEIN-SUBDOMAIN.workers.dev'
};
