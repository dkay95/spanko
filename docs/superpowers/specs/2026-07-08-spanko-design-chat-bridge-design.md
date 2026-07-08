# Spanko — Design-Website mit Chat-Brücke

**Datum:** 2026-07-08
**Status:** Konzept freigegeben, bereit für Implementierungsplan

## Ziel

Eine reine **Design-Website** für den Schlafzimmer-/Bettwaren-Shop „Spanko" (Sen ma
znaczenie). Noch **keine** echte Shop-Funktion (kein Warenkorb, kein Bezahlen). Die
Website dient als Design-Vorlage zum Anschauen, Herzeigen und gemeinsamen Verfeinern.

Dazu kommt eine **Chat-Brücke**: Ein Kollege öffnet einen Link, klickt auf einen
Chat-Button und schreibt Änderungswünsche. Diese Nachrichten erreichen die laufende
Claude-Code-Session (dieses Fenster), wo die Änderungen am Design umgesetzt und dem
Kollegen beantwortet werden.

## Nicht-Ziele (bewusst weggelassen — YAGNI)

- Keine E-Commerce-Funktion (Warenkorb, Checkout, Zahlung, Bestellungen).
- Keine Produkt-Datenbank / kein Admin-Panel.
- Kein autonomer KI-Chat auf der Seite (die Antworten kommen aus dieser Session, nicht
  von einem eigenständigen Modell auf dem Server).
- Kein Dauerbetrieb 24/7 — läuft nur, solange der Mac + diese Session aktiv sind.

## Design der Website

- **Stil:** Eigener Mix aus den drei gelieferten Vorlagen — dunkler, edler Grundton mit
  Gold-Akzenten (aus Foto 1 & 2), kombiniert mit warmen, freundlichen hellen Sektionen
  (aus Foto 3). Faultier-Maskottchen als Marke. Slogan „Sen ma znaczenie".
- **Sprachen:** Zweisprachig **Polnisch / Deutsch**, per Umschalt-Knopf im Header. Alle
  Texte liegen in einem i18n-Objekt (PL + DE), Umschaltung ohne Neuladen.
- **Sektionen (an den Vorlagen orientiert):** Header mit Navigation + Sprachwahl, Hero
  mit Slogan + Buttons, Kategorien (Łóżka/Betten, Materace/Matratzen, Pościel/Bettwäsche,
  Poduszki/Kissen, Dla dzieci/Für Kinder, Akcesoria/Zubehör), Vorteile-Leiste
  (100 Nächte Test, Garantie, Lieferung, Qualität, Beratung), empfohlene Produkte
  (nur Design/Platzhalter), „Über den Laden", Kundenmeinungen, Kontakt, Footer.
- **Technik:** Einfache, saubere statische Web-Seite (HTML/CSS/JS ohne schweres
  Framework), damit sie sich per Chat schnell und zuverlässig ändern lässt.

## Design der Chat-Brücke

```
Kollege (Browser) ──Link/Tunnel──► lokaler Server auf dem Mac
                                        │  serviert die Website
                                        │  nimmt Chat-Nachrichten an
                                        ▼
                                   Chat-Datei (auf Platte)
                                        ▲   │
                                        │   ▼
                                   Claude-Code-Session (dieses Fenster):
                                   liest neue Nachricht → ändert Design →
                                   schreibt Antwort zurück
```

**Komponenten (je eine klare Aufgabe):**

1. **Statische Website** — die Design-Dateien. Weiß nichts von der Brücke außer dem
   Chat-Widget.
2. **Chat-Widget** (auf der Seite) — Button unten rechts, öffnet Chatfenster. Sendet
   Nachrichten an den Server, fragt regelmäßig neue Antworten ab (Polling), zeigt sie an.
3. **Lokaler Server** (klein, Node) — serviert die Website und bietet zwei Endpunkte:
   Nachricht entgegennehmen (anhängen an Chat-Datei) und neue Nachrichten ausliefern.
   Kennt keine KI-Logik, ist nur Briefkasten + Auslieferung.
4. **Chat-Datei** — gemeinsame Ablage (z.B. JSON-Lines) für alle Nachrichten von Kollege
   und Session. Die einzige Schnittstelle zwischen Server und Session.
5. **Session-Wächter** — ein Hintergrund-Mechanismus, der diese Session weckt, sobald
   eine neue Kollegen-Nachricht in der Chat-Datei liegt, damit zeitnah reagiert wird.
6. **Tunnel** — macht den lokalen Server über einen öffentlichen Link erreichbar
   (Cloudflare Quick Tunnel, ohne Anmeldung). Diese Adresse geht an den Kollegen.

## Datenfluss

1. Kollege tippt Wunsch → Widget POSTet an Server → Server hängt Eintrag an Chat-Datei.
2. Session-Wächter erkennt neuen Eintrag → weckt diese Session.
3. Session liest den Wunsch, ändert die Design-Dateien, hängt eine Antwort an die
   Chat-Datei an.
4. Widget fragt per Polling neue Einträge ab, zeigt die Antwort. Kollege lädt Seite neu
   (oder Auto-Reload) → sieht die Design-Änderung.

## Fehlerbehandlung / Randfälle

- **Mac/Session aus:** Link tot — bewusst akzeptiert (siehe Nicht-Ziele). Widget zeigt
  „gerade offline", wenn der Server nicht erreichbar ist.
- **Kaputte Design-Änderung:** Änderungen klein und überprüfbar halten; bei Fehler
  zurückrollen. Kein automatisches Zerstören funktionierender Seiten.
- **Mehrere Nachrichten schnell hintereinander:** Chat-Datei ist append-only mit Zeit-
  stempel + Absender; Reihenfolge bleibt erhalten.

## Erfolgskriterien

- Die Spanko-Design-Website ist im Browser sichtbar, zweisprachig umschaltbar, sieht
  edel/stimmig aus.
- Ein per Link geöffneter Chat nimmt eine Nachricht an; diese erscheint in dieser
  Session; eine Design-Änderung und eine Chat-Antwort kommen beim Kollegen an.

## Späterer Ausbau (nicht jetzt)

- Echte Shop-Funktion (Warenkorb/Checkout/Zahlung) — separates Projekt.
- Dauerhafter Betrieb auf echtem Server statt lokalem Mac.
- Optional: autonomer KI-Chat direkt auf dem Server (Variante 🅰️).
