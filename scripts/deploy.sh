#!/usr/bin/env bash
# Aktualisiert die dauerhaft online stehende Website (GitHub Pages).
# Voraussetzung: Änderungen sind committet.
set -e
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Es gibt noch nicht committete Änderungen. Erst committen, dann erneut ausführen."
  git status --short
  exit 1
fi

echo "⬆️   Lade Quellcode hoch (main)…"
git push origin main

echo "🌍  Veröffentliche die Website (gh-pages)…"
git subtree push --prefix site origin gh-pages

echo ""
echo "✅  Fertig. In ~1 Minute ist die Aktualisierung live unter:"
echo "        https://dkay95.github.io/spanko/"
