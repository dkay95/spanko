#!/usr/bin/env bash
# Aktualisiert die dauerhaft online stehende Website (GitHub Pages).
# GitHub baut nach dem Push automatisch (GitHub Actions) und veröffentlicht site/.
set -e
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Es gibt noch nicht committete Änderungen. Erst committen, dann erneut ausführen."
  git status --short
  exit 1
fi

echo "⬆️   Push nach main — GitHub baut und veröffentlicht automatisch…"
git push origin main

echo ""
echo "✅  Fertig. In ~1 Minute ist die Aktualisierung live unter:"
echo "        https://dkay95.github.io/spanko/"
echo "    Status: https://github.com/dkay95/spanko/actions"
