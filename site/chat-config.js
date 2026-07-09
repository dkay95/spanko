// Chat-Betriebsart:
// - endpoint LEER  → lokaler Modus (Server auf deinem Mac)
// - endpoint GESETZT (Cloudflare-Worker-URL) → Cloud-Modus: immer verfügbar,
//   die KI ändert die Website direkt über GitHub.
//
// Im Cloud-Modus erscheint der Chat NUR, wenn der Link den geheimen Token
// enthält:  https://dkay95.github.io/spanko/?studio=DEIN-TOKEN
// Ganz normale Shop-Besucher (ohne ?studio=…) sehen kein Chat-Fenster.
window.SPANKO_CHAT = {
  endpoint: 'https://spanko-chat.spanko-dkay.workers.dev',
};
