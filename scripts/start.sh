#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-4321}"

echo "🦥  Starte Spanko-Server auf http://localhost:$PORT"
PORT="$PORT" node server/server.js &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT

sleep 1

if command -v cloudflared >/dev/null 2>&1; then
  echo ""
  echo "🌍  Öffne öffentlichen Link (den findest du gleich unten als https://...trycloudflare.com)."
  echo "    Diesen Link schickst du deinem Kollegen."
  echo ""
  cloudflared tunnel --url "http://localhost:$PORT"
else
  echo ""
  echo "ℹ️   'cloudflared' ist nicht installiert — die Seite läuft nur lokal:"
  echo "        http://localhost:$PORT"
  echo ""
  echo "    Für einen öffentlichen Link (zum Weitergeben an den Kollegen):"
  echo "        brew install cloudflared"
  echo "    danach dieses Skript erneut starten."
  echo ""
  wait $SRV
fi
