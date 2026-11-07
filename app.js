/* 3DMOLL-App: Aufgaben (Issues) und Projekte (PROJEKTE.md, projekte/*.md) direkt im Repo 3DMOLL.
   Kein Server: der Browser spricht mit api.github.com, der Schlüssel bleibt in diesem Gerät. */
'use strict';

const REPO = 'MagellBinell/3DMOLL';
const API = 'https://api.github.com';
const SPEICHER = { token: '3dmoll-token', projekte: '3dmoll-projekte', aufgaben: '3dmoll-aufgaben', schritte: '3dmoll-schritte' };
const L = window.LOGIK;

const zustand = {
  ansicht: 'aufgaben', fuer: 'daniel', status: 'aktiv', suche: '',
  projekte: [], aufgaben: [], schritte: {}, offen: null,
};

/* ---------- kleine Helfer ---------- */

const $ = (id) => document.getElementById(id);
function el(tag, attr, ...kinder) {
  const e = document.createElement(tag);
  Object.entries(attr || {}).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  });
  kinder.flat().forEach((k) => { if (k !== null && k !== undefined) e.append(k); });
  return e;
}
function lesen(k, ersatz) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : ersatz; } catch { return ersatz; } }
function merken(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* voll oder gesperrt: dann eben ohne Zwischenspeicher */ } }
function token() { try { return localStorage.getItem(SPEICHER.token) || ''; } catch { return ''; } }

let meldungUhr = 0;
function melden(text, fehler) {
  const m = $('meldung');
  m.textContent = text; m.className = 'meldung' + (fehler ? ' fehler' : ''); m.hidden = false;
  clearTimeout(meldungUhr); meldungUhr = setTimeout(() => { m.hidden = true; }, fehler ? 6000 : 2500);
}

/* ---------- GitHub ---------- */

async function api(pfad, opt = {}) {
  const t = token();
  if (!t) { zeige('einstellungen'); throw new Error('Noch kein Schlüssel eingetragen.'); }
  const antwort = await fetch(API + pfad, {
    ...opt,
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
               Authorization: 'Bearer ' + t, ...(opt.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (antwort.status === 401) throw new Error('GitHub kennt den Schlüssel nicht (abgelaufen?). Unter ⚙ neu eintragen.');
  if (antwort.status === 403) throw new Error('Keine Berechtigung. Braucht der Schlüssel „Contents“ und „Issues“ mit Read and write?');
  if (antwort.status === 409) throw new Error('Die Datei wurde inzwischen geändert. Neu laden (⟳) und noch einmal speichern.');
  if (!antwort.ok) throw new Error('GitHub antwortet mit ' + antwort.status + '.');
  return antwort.status === 204 ? null : antwort.json();
}

async function dateiHolen(pfad) {
  const d = await api('/repos/' + REPO + '/contents/' + encodeURI(pfad) + '?ref=main', { cache: 'no-store' });
  return { text: L.b64dekodieren(d.content), sha: d.sha };
}
async function dateiSchreiben(pfad, text, sha, nachricht) {
  return api('/repos/' + REPO + '/contents/' + encodeURI(pfad), {
    method: 'PUT', body: JSON.stringify({ message: nachricht, content: L.b64kodieren(text), sha, branch: 'main' }),
  });
}

async function aufgabenLaden() {
  const liste = await api('/repos/' + REPO + '/issues?state=open&per_page=100', { cache: 'no-store' });
  zustand.aufgaben = liste.filter((i) => !i.pull_request).map(L.aufgabeZerlegen);
  merken(SPEICHER.aufgaben, zustand.aufgaben);
}

async function projekteLaden() {
  const { text } = await dateiHolen('PROJEKTE.md');
  zustand.projekte = L.projekteLesen(text);
  merken(SPEICHER.projekte, zustand.projekte);
  // Nächste Schritte im Hintergrund nachladen, je Datei eine Anfrage, höchstens 6 gleichzeitig.
  const warte = [...zustand.projekte];
  const arbeiter = Array.from({ length: 6 }, async () => {
    while (warte.length) {
      const p = warte.shift();
      try {
        const d = L.projektDateiLesen((await dateiHolen(p.datei)).text);
        zustand.schritte[p.projekt] = d.naechster.join(' · ');
      } catch { /* einzelne Datei fehlt: Karte bleibt ohne Schritt */ }
    }
  });
  await Promise.all(arbeiter);
  merken(SPEICHER.schritte, zustand.schritte);
}

async function allesLaden() {
  try {
    await Promise.all([aufgabenLaden().then(zeichneAufgaben), projekteLaden().then(zeichneProjekte)]);
    zeichneAlles();
  } catch (e) { melden(e.message, true); }
}

async function aufgabeAnlegen(projekt, text, fuer) {
  if (!text.trim()) { melden('Erst schreiben, was passieren soll.', true); return false; }
  const p = zustand.projekte.find((x) => x.projekt === projekt);
  const labels = [fuer];
  if (p && p.bereich) labels.push(p.bereich);
  try {
    const i = await api('/repos/' + REPO + '/issues', { method: 'POST', body: JSON.stringify({ title: L.aufgabeTitel(projekt, text), labels }) });
    zustand.aufgaben.unshift(L.aufgabeZerlegen(i));
    merken(SPEICHER.aufgaben, zustand.aufgaben);
    melden(fuer === 'claude' ? 'An Claude übergeben (#' + i.number + ').' : 'Gemerkt (#' + i.number + ').');
    zeichneAlles();
    return true;
  } catch (e) { melden(e.message, true); return false; }
}

async function aufgabeAbhaken(a, li, box) {
  box.disabled = true;
  try {
    await api('/repos/' + REPO + '/issues/' + a.nr, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
    li.classList.add('erledigt');
    zustand.aufgaben = zustand.aufgaben.filter((x) => x.nr !== a.nr);
    merken(SPEICHER.aufgaben, zustand.aufgaben);
    melden('Erledigt: #' + a.nr);
    setTimeout(zeichneAlles, 900);
  } catch (e) { box.checked = false; box.disabled = false; melden(e.message, true); }
}

/* Status und nächsten Schritt speichern: PROJEKTE.md und Projektdatei immer zusammen (Regel in 3DMOLL). */
async function projektSpeichern(p, { status, naechster }) {
  const datum = L.heute();
  const knopf = $('p-speichern'); knopf.disabled = true;
  try {
    const liste = await dateiHolen('PROJEKTE.md');
    const datei = await dateiHolen(p.datei);
    let neuDatei = L.kopfSetzen(datei.text, { status, zuletzt: datum });
    if (naechster !== undefined) neuDatei = L.naechsterSchrittSetzen(neuDatei, naechster);
    const neuListe = L.projektZeileSetzen(liste.text, p.projekt, { status, zuletzt: datum });
    const was = [status && status !== p.status ? 'Status ' + status : '', naechster !== undefined ? 'nächster Schritt' : ''].filter(Boolean).join(', ');
    if (neuDatei !== datei.text) await dateiSchreiben(p.datei, neuDatei, datei.sha, p.projekt + ': ' + (was || 'Datum') + ' (App)');
    if (neuListe !== liste.text) await dateiSchreiben('PROJEKTE.md', neuListe, liste.sha, 'PROJEKTE: ' + p.projekt + ' ' + (was || 'Datum') + ' (App)');
    p.status = status || p.status; p.zuletzt = datum;
    if (naechster !== undefined) zustand.schritte[p.projekt] = L.projektDateiLesen(neuDatei).naechster.join(' · ');
    merken(SPEICHER.projekte, zustand.projekte); merken(SPEICHER.schritte, zustand.schritte);
    melden('Gespeichert.');
    zeichneProjekte(); zeigeProjektKopf(p);
  } catch (e) { melden(e.message, true); }
  knopf.disabled = false;
}

/* ---------- Zeichnen ---------- */

function aufgabeZeile(a) {
  const box = el('input', { type: 'checkbox', 'aria-label': 'Erledigt' });
  const li = el('li', {}, box, el('div', { class: 'text' },
    el('a', { href: a.link, target: '_blank', rel: 'noopener' }, a.text),
    el('div', { class: 'unter' }, ['#' + a.nr, a.projekt, a.fuer === 'claude' ? 'Claude' : a.fuer === 'daniel' ? 'du' : ''].filter(Boolean).join(' · '))));
  box.addEventListener('change', () => aufgabeAbhaken(a, li, box));
  return li;
}

function zeichneAufgaben() {
  const liste = zustand.aufgaben.filter((a) => !zustand.fuer || a.fuer === zustand.fuer);
  $('aufgaben-liste').replaceChildren(...liste.map(aufgabeZeile));
  $('aufgaben-leer').hidden = liste.length > 0;
}

function zeichneProjekte() {
  const q = zustand.suche.trim().toLowerCase();
  const liste = zustand.projekte
    .filter((p) => !zustand.status || p.status === zustand.status)
    .filter((p) => !q || [p.projekt, p.bereich, zustand.schritte[p.projekt] || ''].join(' ').toLowerCase().includes(q))
    .sort((a, b) => String(b.zuletzt).localeCompare(String(a.zuletzt)));
  $('projekt-liste').replaceChildren(...liste.map((p) => {
    const offen = zustand.aufgaben.filter((a) => a.projekt === p.projekt).length;
    return el('li', { class: 'karte', tabindex: '0', onclick: () => oeffneProjekt(p.projekt), onkeydown: (e) => { if (e.key === 'Enter') oeffneProjekt(p.projekt); } },
      el('div', { class: 'oben' }, el('span', { class: 'name' }, p.projekt), el('span', { class: 'chip ' + p.status }, p.status)),
      el('div', { class: 'unter' }, [p.bereich, 'zuletzt ' + p.zuletzt, offen ? offen + ' offen' : ''].filter(Boolean).join(' · ')),
      zustand.schritte[p.projekt] ? el('div', { class: 'schritt' }, zustand.schritte[p.projekt]) : null);
  }));
  const sel = $('n-projekt'), alt = sel.value;
  sel.replaceChildren(el('option', { value: '' }, '– ohne Projekt –'),
    ...[...zustand.projekte].sort((a, b) => a.projekt.localeCompare(b.projekt)).map((p) => el('option', { value: p.projekt }, p.projekt)));
  sel.value = alt;
}

function zeigeProjektKopf(p) {
  $('p-titel').textContent = p.projekt;
  $('p-meta').textContent = [p.bereich, 'zuletzt ' + p.zuletzt, p.live].filter(Boolean).join(' · ');
  $('p-status').value = p.status;
}

async function oeffneProjekt(name) {
  const p = zustand.projekte.find((x) => x.projekt === name);
  if (!p) return;
  zustand.offen = p;
  zeige('projekt');
  zeigeProjektKopf(p);
  $('p-link').href = 'https://github.com/' + REPO + '/blob/main/' + p.datei;
  $('p-ziel').textContent = ''; $('p-naechster').value = zustand.schritte[p.projekt] ? zustand.schritte[p.projekt].split(' · ').join('\n') : '';
  $('p-stand').replaceChildren(); $('p-offen').replaceChildren(); $('p-auftrag').value = '';
  const offen = zustand.aufgaben.filter((a) => a.projekt === p.projekt);
  $('p-aufgaben').replaceChildren(...offen.map(aufgabeZeile));
  $('p-aufgaben-leer').hidden = offen.length > 0;
  try {
    const d = L.projektDateiLesen((await dateiHolen(p.datei)).text);
    if (zustand.offen !== p) return;
    $('p-ziel').textContent = d.ziel;
    $('p-naechster').value = d.naechster.join('\n');
    $('p-stand').replaceChildren(...d.stand.map((t) => el('li', {}, L.klartext(t))));
    $('p-offen').replaceChildren(...d.offen.map((t) => el('li', {}, L.klartext(t))));
  } catch (e) { melden(e.message, true); }
}

function zeichneAlles() { zeichneAufgaben(); zeichneProjekte(); }

function zeige(name) {
  zustand.ansicht = name;
  document.querySelectorAll('.ansicht').forEach((s) => { s.hidden = s.id !== 'ansicht-' + name; });
  const reiter = name === 'projekt' ? 'projekte' : name;
  document.querySelectorAll('.leiste button').forEach((b) => {
    if (b.dataset.ansicht === reiter) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

/* ---------- Verdrahtung ---------- */

document.querySelectorAll('.leiste button').forEach((b) => b.addEventListener('click', () => zeige(b.dataset.ansicht)));
document.querySelectorAll('#ansicht-aufgaben .segmente button').forEach((b) => b.addEventListener('click', () => {
  zustand.fuer = b.dataset.fuer;
  document.querySelectorAll('#ansicht-aufgaben .segmente button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  zeichneAufgaben();
}));
document.querySelectorAll('#ansicht-projekte .segmente button').forEach((b) => b.addEventListener('click', () => {
  zustand.status = b.dataset.status;
  document.querySelectorAll('#ansicht-projekte .segmente button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  zeichneProjekte();
}));
$('projekt-suche').addEventListener('input', (e) => { zustand.suche = e.target.value; zeichneProjekte(); });
$('zurueck').addEventListener('click', () => zeige('projekte'));
$('neu-laden').addEventListener('click', () => { melden('Lade …'); allesLaden(); });
$('zu-einstellungen').addEventListener('click', () => zeige('einstellungen'));

$('p-speichern').addEventListener('click', () => {
  const p = zustand.offen; if (!p) return;
  projektSpeichern(p, { status: $('p-status').value, naechster: $('p-naechster').value });
});
$('p-status').addEventListener('change', () => {
  const p = zustand.offen; if (!p) return;
  projektSpeichern(p, { status: $('p-status').value });
});
$('p-an-claude').addEventListener('click', async () => {
  if (await aufgabeAnlegen(zustand.offen.projekt, $('p-auftrag').value, 'claude')) { $('p-auftrag').value = ''; oeffneProjekt(zustand.offen.projekt); }
});
$('p-fuer-mich').addEventListener('click', async () => {
  if (await aufgabeAnlegen(zustand.offen.projekt, $('p-auftrag').value, 'daniel')) { $('p-auftrag').value = ''; oeffneProjekt(zustand.offen.projekt); }
});
$('n-an-claude').addEventListener('click', async () => {
  if (await aufgabeAnlegen($('n-projekt').value, $('n-text').value, 'claude')) { $('n-text').value = ''; zeige('aufgaben'); }
});
$('n-fuer-mich').addEventListener('click', async () => {
  if (await aufgabeAnlegen($('n-projekt').value, $('n-text').value, 'daniel')) { $('n-text').value = ''; zeige('aufgaben'); }
});

$('e-speichern').addEventListener('click', async () => {
  const t = $('e-token').value.trim();
  if (!t) { melden('Erst den Schlüssel einfügen.', true); return; }
  try { localStorage.setItem(SPEICHER.token, t); } catch { melden('Der Browser lässt nichts speichern (privates Fenster?).', true); return; }
  $('e-token').value = '';
  try {
    const r = await api('/repos/' + REPO);
    if (!r.permissions || !r.permissions.push) throw new Error('Der Schlüssel darf nur lesen. „Contents: Read and write“ fehlt.');
    $('e-stand').textContent = 'Verbunden mit ' + r.full_name + '.';
    melden('Verbunden.'); zeige('aufgaben'); allesLaden();
  } catch (e) { $('e-stand').textContent = e.message; melden(e.message, true); }
});
$('e-loeschen').addEventListener('click', () => {
  try { Object.values(SPEICHER).forEach((k) => localStorage.removeItem(k)); } catch { /* nichts zu tun */ }
  zustand.projekte = []; zustand.aufgaben = []; zustand.schritte = {};
  zeichneAlles(); $('e-stand').textContent = 'Schlüssel und Zwischenspeicher entfernt.';
});

/* ---------- Start ---------- */

zustand.projekte = lesen(SPEICHER.projekte, []);
zustand.aufgaben = lesen(SPEICHER.aufgaben, []);
zustand.schritte = lesen(SPEICHER.schritte, {});
zeichneAlles();
if (token()) allesLaden(); else zeige('einstellungen');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
