# 3DMOLL-App

Projekte und Aufgaben aus dem Repo `MagellBinell/3DMOLL` auf dem Handy: ansehen, abhaken, Aufträge an Claude geben,
Status und nächsten Schritt ändern. Die Daten bleiben in 3DMOLL; die App liest und schreibt dort direkt.

- **Aufgaben** sind die offenen Issues in 3DMOLL. „Für mich“ = Label `daniel`, „Für Claude“ = Label `claude`.
  Abhaken schließt das Issue.
- **Projekte** kommen aus `PROJEKTE.md`, der nächste Schritt aus `projekte/<name>.md`. Status und nächster Schritt
  lassen sich ändern; die App schreibt dann `PROJEKTE.md` und die Projektdatei zusammen, wie es die Regeln in 3DMOLL
  verlangen.
- **Neu**: Aufgabe für dich oder Auftrag an Claude, mit Projekt und Bereichs-Label.

## Datenschutz und Sicherheit

- Kein Server: Die Seite ist nur HTML/JS (GitHub Pages). Der Browser spricht direkt mit `api.github.com`.
- Der GitHub-Schlüssel bleibt im Browser des Geräts (`localStorage`) und geht nur an GitHub. Wer das Handy entsperrt
  in der Hand hat, kommt an ihn heran; deshalb darf er nur das Repo 3DMOLL und nur Contents und Issues.
- In diesem Repo stehen keine Projektdaten. Die Testdaten in `tests/fixtures` sind erfunden.

## Einrichten (einmal)

1. App öffnen: https://magellbinell.github.io/3dmoll-app/ und im Browser „Zum Startbildschirm hinzufügen“.
2. Auf github.com einen **Fine-grained token** anlegen: nur Repo **3DMOLL**, Permissions **Contents** und
   **Issues** je *Read and write*, Ablauf 1 Jahr.
3. In der App unter ⚙ einfügen. Fertig.

Läuft der Schlüssel ab, meldet die App das; dann einen neuen anlegen und eintragen.

## Grenzen

- Ändern kann die App Status und nächsten Schritt. Alles andere in den Projektdateien schreibt Claude.
- Zwei Änderungen gleichzeitig an derselben Datei (App und Claude) werden erkannt: die App meldet es, neu laden, noch
  einmal speichern.
- Beim Öffnen der Projektliste holt die App jede Projektdatei einmal (rund 30 Anfragen); GitHub erlaubt 5.000 pro
  Stunde.

## Prüfen

```
node --test tests/logik.test.mjs
python3 tests/oberflaeche.test.py     # braucht: pip install playwright && playwright install chromium
```
