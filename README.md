# Spanko — Design-Website mit Chat-Brücke

Eine zweisprachige (Polnisch / Deutsch) Design-Website für den Schlafzimmer-Shop
**Spanko**. Noch ohne echte Shop-Funktion — es geht um das Aussehen. Dazu ein
Chat-Fenster, über das ein Kollege Änderungswünsche schicken kann, die direkt in der
laufenden Claude-Code-Session (bei dir) ankommen.

## Was du brauchst
- **Node.js** (schon installiert, wenn dieses Projekt gebaut wurde).
- Optional für den öffentlichen Link: **cloudflared** → `brew install cloudflared`

## Starten

```bash
bash scripts/start.sh
```

- Die Seite läuft dann lokal auf **http://localhost:4321**.
- Ist `cloudflared` installiert, erscheint zusätzlich ein öffentlicher Link wie
  `https://irgendwas.trycloudflare.com`. **Diesen Link schickst du deinem Kollegen.**

## Wie der Design-Chat funktioniert

1. Dein Kollege öffnet den Link und klickt unten rechts auf **💬**.
2. Er tippt einen Wunsch, z.B. *„die Überschrift soll größer sein"* oder
   *„die Betten-Kategorie ganz nach oben"*.
3. **Fotos:** Über den 📎-Knopf (oder per Drag & Drop ins Chat-Fenster) kann er ein
   Foto hochladen. Es landet in `site/assets/uploads/` und erscheint im Chat — Claude
   sieht es und baut es an der gewünschten Stelle ein.
4. Seine Nachricht landet in `.chat/messages.jsonl` — und damit bei Claude in der
   offenen Session.
5. Claude ändert das Design und schreibt eine Antwort zurück, die der Kollege im
   Chat sieht. Nach einem Neuladen der Seite sieht er die Änderung.

## Dauerhaft online (GitHub Pages)

Die **Design-Website** liegt dauerhaft (24/7, ohne deinen Mac) unter:

> **https://dkay95.github.io/spanko/**

Dort ist der Chat automatisch ausgeblendet (es gibt keinen Server). Nach Design-
Änderungen aktualisierst du die öffentliche Seite mit **einem Befehl**:

```bash
bash scripts/deploy.sh
```

(Änderungen vorher committen.) Nach ~1 Minute ist die neue Version live.

Der **lokale Server + Chat** (unten beschrieben) ist weiterhin nur zum gemeinsamen
Bearbeiten gedacht und läuft nur, solange dein Mac + die Claude-Session an sind.

## Wichtig (die eine Einschränkung – gilt nur für den lokalen Chat)

Alles läuft auf **deinem Mac**. Der Link funktioniert nur, **solange dein Mac an ist,
das Start-Skript läuft und die Claude-Session offen ist**. Machst du den Laptop zu, ist
der Chat offline (das Chat-Fenster zeigt dann „offline"). Für Dauerbetrieb müsste das
Projekt später auf einen echten Server umziehen.

## Projektaufbau

| Ordner / Datei            | Aufgabe                                              |
|---------------------------|-----------------------------------------------------|
| `site/`                   | Die Website (HTML, CSS, JS, Bilder)                 |
| `site/i18n.js`            | Alle Texte auf Polnisch **und** Deutsch             |
| `server/server.js`        | Kleiner Server: liefert die Seite + Chat-Postfach   |
| `scripts/start.sh`        | Startet Server (und Tunnel, falls vorhanden)        |
| `scripts/wait-for-message.js` | Weckt die Claude-Session bei neuer Nachricht    |
| `scripts/reply.js`        | Claude antwortet dem Kollegen                        |
| `.chat/messages.jsonl`    | Der gemeinsame Nachrichten-Verlauf                   |

## Später möglich
- Echte Shop-Funktion (Warenkorb, Bezahlen).
- Dauerhafter Betrieb auf einem echten Server (24/7 erreichbar).
- Echte Produktfotos in `site/assets/` einsetzen (aktuell stilvolle Platzhalter).
