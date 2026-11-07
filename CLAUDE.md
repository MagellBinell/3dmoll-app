# 3DMOLL-App

## Allgemeine Regeln (aus 3DMOLL)

- Gesamte Regeln: `REGELN.md` im Repo `MagellBinell/3DMOLL`, am PC unter `~/Projekte/3dmoll/`. Alle Projekte und ihr Stand: `PROJEKTE.md` dort.
- Deutsch, per du, knapp und technisch. Ergebnis zuerst, Ungetestetes offen nennen.
- Lauffähiger Code ohne Platzhalter, Tests nach jedem Abschnitt.
- Eigener Branch, Pull Request mit: was geändert, was getestet, was live geht. Mergen nur bei grünen Prüfungen und wenn nichts Gelbes oder Rotes aus `REGELN.md` betroffen ist (Hosting-Einstellungen, Live-Datenbanken, Löschen, Zugangsdaten).
- Nie: Zugangsdaten anfassen oder committen, Sicherheitsfunktionen aufweichen.
- Sitzungsende: Stand, offene Punkte und nächsten Schritt in `docs/STATUS.md` nachtragen, dazu die Zeile in `PROJEKTE.md` im Repo `3DMOLL`.

## Was das Projekt ist

Handy-App (PWA, nur HTML/JS, GitHub Pages) für Projekte und Aufgaben in `MagellBinell/3DMOLL`. Kein eigener Server,
keine eigene Datenhaltung: 3DMOLL bleibt die einzige Wahrheit.

## Regeln für dieses Repo

- **Das Repo ist öffentlich** (GitHub Pages kostenlos nur so). Nie Projektdaten, Namen von Kunden, Schlüssel oder
  echte Inhalte aus 3DMOLL hier ablegen. Testdaten sind erfunden.
- Der Schlüssel steht nur im `localStorage` des Geräts und geht nur an `api.github.com`. Keine weitere Adresse
  anfragen, keine Analyse, keine Fremdskripte.
- Alles, was aus GitHub kommt, über `textContent` ins DOM, nie über `innerHTML`.
- Änderungen an Projekten schreiben `PROJEKTE.md` und die Projektdatei zusammen; nur die betroffene Zeile ändern
  (`logik.js`, geprüft in `tests/logik.test.mjs`).
- Neuer Stand der App: `STAND` in `sw.js` hochzählen, sonst hängt das Handy am alten.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html`, `app.css` | Oberfläche (mobil zuerst, hell und dunkel) |
| `logik.js` | Lesen und Ändern von `PROJEKTE.md` und Projektdateien, ohne Browser testbar |
| `app.js` | GitHub-Zugriffe, Zeichnen, Verdrahtung |
| `sw.js`, `manifest.webmanifest`, `icon*` | Installierbar, startet ohne Netz |
| `tests/` | `logik.test.mjs` (Node), `oberflaeche.test.py` (Playwright gegen nachgebaute GitHub-API) |
