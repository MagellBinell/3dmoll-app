"""Klicktest der App gegen eine nachgebaute GitHub-API (kein echter Zugriff).

    python tests/oberflaeche.test.py
"""
import base64, json, re, sys, threading, http.server, functools
from pathlib import Path
from playwright.sync_api import sync_playwright

HIER = Path(__file__).resolve().parent.parent
FIX = HIER / "tests" / "fixtures"

dateien = {"PROJEKTE.md": (FIX / "PROJEKTE.md").read_text(encoding="utf-8")}
for f in FIX.glob("*.md"):
    if f.name != "PROJEKTE.md":
        dateien["projekte/" + f.name] = f.read_text(encoding="utf-8")
issues = [
    {"number": 5, "title": "[3dmoll] Mem-Connector trennen", "labels": [{"name": "daniel"}], "html_url": "https://x/5", "created_at": "2026-11-01"},
    {"number": 9, "title": "[zaehlanlage] Inbetriebnahme Schritt 1", "labels": [{"name": "claude"}], "html_url": "https://x/9", "created_at": "2026-11-02"},
    {"number": 10, "title": "Setup", "labels": [], "html_url": "https://x/10", "created_at": "2026-11-02", "pull_request": {}},
]
geschrieben, angelegt, geschlossen = {}, [], []
sha = lambda t: "sha" + str(abs(hash(t)) % 10**8)

def route(r):
    url, m = r.request.url, r.request.method
    assert r.request.headers.get("authorization") == "Bearer test-token", "kein Schlüssel im Kopf"
    if re.search(r"/repos/MagellBinell/3DMOLL$", url):
        return r.fulfill(json={"full_name": "MagellBinell/3DMOLL", "permissions": {"push": True}})
    if "/issues?" in url and m == "GET":
        return r.fulfill(json=issues)
    if url.endswith("/issues") and m == "POST":
        b = json.loads(r.request.post_data); angelegt.append(b)
        return r.fulfill(json={"number": 99, "title": b["title"], "labels": [{"name": l} for l in b["labels"]], "html_url": "https://x/99"})
    mm = re.search(r"/issues/(\d+)$", url)
    if mm and m == "PATCH":
        geschlossen.append(int(mm.group(1))); return r.fulfill(json={})
    mm = re.search(r"/contents/(.+?)(\?|$)", url)
    if mm:
        pfad = mm.group(1).replace("%C3%A4", "ä")
        if m == "GET":
            if pfad not in dateien: return r.fulfill(status=404, json={})
            t = dateien[pfad]
            return r.fulfill(json={"content": base64.b64encode(t.encode()).decode(), "sha": sha(t)})
        if m == "PUT":
            b = json.loads(r.request.post_data)
            assert b["sha"] == sha(dateien[pfad]), "falsche sha"
            dateien[pfad] = base64.b64decode(b["content"]).decode(); geschrieben[pfad] = b["message"]
            return r.fulfill(json={"content": {"sha": sha(dateien[pfad])}})
    return r.fulfill(status=500, json={"unbekannt": url})

class Still(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Still, directory=str(HIER)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
adr = f"http://127.0.0.1:{srv.server_address[1]}/index.html"

fehler = []
def pruef(name, ok, info=""):
    print(("ok   " if ok else "FEHL ") + name + ("" if ok else "  -> " + str(info)))
    if not ok: fehler.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    s = b.new_page(viewport={"width": 390, "height": 800})
    js_fehler = []; s.on("pageerror", lambda e: js_fehler.append(str(e)))
    s.route("https://api.github.com/**", route)
    s.goto(adr)
    pruef("ohne Schlüssel: Einstellungen offen", s.is_visible("#ansicht-einstellungen"))
    s.fill("#e-token", "test-token"); s.click("#e-speichern")
    s.wait_for_selector("#aufgaben-liste li")
    pruef("Aufgaben für mich: genau Mem-Connector", s.locator("#aufgaben-liste li").count() == 1 and "Mem-Connector" in s.inner_text("#aufgaben-liste"), s.inner_text("#aufgaben-liste"))
    s.click("#ansicht-aufgaben .segmente button[data-fuer='']")
    pruef("Alle: ohne Pull Request", s.locator("#aufgaben-liste li").count() == 2)
    s.locator("#aufgaben-liste input[type=checkbox]").first.check()
    s.wait_for_timeout(300)
    pruef("Abhaken schließt das Issue", geschlossen == [5], geschlossen)

    s.click(".leiste button[data-ansicht='projekte']")
    s.wait_for_selector("#projekt-liste .karte")
    pruef("Projekte aktiv sichtbar", s.locator("#projekt-liste .karte").count() == 4)
    s.wait_for_function("document.querySelector('#projekt-liste').innerText.includes('Nächster') || document.querySelectorAll('#projekt-liste .schritt').length > 0")
    pruef("Nächste Schritte nachgeladen", s.locator("#projekt-liste .schritt").count() >= 1)
    s.fill("#projekt-suche", "zaehlanlage")
    s.click("#projekt-liste .karte")
    s.wait_for_function("document.querySelector('#p-ziel').textContent.length > 5")
    pruef("Detail zeigt Ziel", len(s.inner_text("#p-ziel")) > 5)
    pruef("Detail zeigt offene Aufgabe #9", "Inbetriebnahme" in s.inner_text("#p-aufgaben"))
    s.fill("#p-naechster", "Board per USB testen\nServo einstellen")
    s.click("#p-speichern"); s.wait_for_timeout(500)
    pruef("Speichern schreibt Projektdatei", "projekte/zaehlanlage.md" in geschrieben, geschrieben)
    pruef("Speichern schreibt PROJEKTE.md", "PROJEKTE.md" in geschrieben, geschrieben)
    pruef("Schritt steht in der Datei", "- Board per USB testen\n- Servo einstellen" in dateien["projekte/zaehlanlage.md"])
    s.select_option("#p-status", "ruht"); s.wait_for_timeout(500)
    zeile = [z for z in dateien["PROJEKTE.md"].splitlines() if "[zaehlanlage]" in z][0]
    pruef("Status ruht in PROJEKTE.md", "| ruht |" in zeile, zeile)
    pruef("Status ruht im Kopf der Datei", "Status: ruht ·" in dateien["projekte/zaehlanlage.md"])
    s.fill("#p-auftrag", "Pinbelegung gegen Board-Doku prüfen"); s.click("#p-an-claude"); s.wait_for_timeout(300)
    pruef("Auftrag an Claude angelegt", angelegt and angelegt[-1]["title"] == "[zaehlanlage] Pinbelegung gegen Board-Doku prüfen" and angelegt[-1]["labels"][0] == "claude" and "elektronik" in angelegt[-1]["labels"], angelegt)

    s.click(".leiste button[data-ansicht='neu']")
    s.fill("#n-text", "Lasermodell prüfen"); s.select_option("#n-projekt", "3dmoll"); s.click("#n-fuer-mich"); s.wait_for_timeout(300)
    pruef("Neue Aufgabe für mich", angelegt[-1]["title"] == "[3dmoll] Lasermodell prüfen" and angelegt[-1]["labels"] == ["daniel", "zentrale"], angelegt[-1])
    pruef("Übrige Zeilen von PROJEKTE.md unverändert", len(dateien["PROJEKTE.md"].splitlines()) == len((FIX / "PROJEKTE.md").read_text(encoding="utf-8").splitlines()))
    pruef("keine Skriptfehler", not js_fehler, js_fehler)
    s.screenshot(path="/tmp/app-detail.png", full_page=True)
    b.close()
srv.shutdown()
print("\n" + ("ALLES GRÜN" if not fehler else f"{len(fehler)} Fehler"))
sys.exit(1 if fehler else 0)
