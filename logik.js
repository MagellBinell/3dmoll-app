/* Reine Logik ohne Browser: PROJEKTE.md und Projektdateien lesen und ändern.
   Läuft im Browser (global LOGIK) und in Node (Tests). */
(function (wurzel) {
  'use strict';

  const STATUS = ['aktiv', 'idee', 'ruht', 'fertig'];

  function klartext(s) {
    return String(s || '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`/g, '').replace(/\*\*/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  /* Eine Zeile der Projekttabelle: | [name](projekte/name.md) | bereich | status | code | live | stand | zuletzt | */
  const ZEILE = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|(.*)\|\s*$/;

  function projekteLesen(md) {
    const teil = md.split('\n## Archiv')[0];
    const aus = [];
    teil.split('\n').forEach((z, i) => {
      const m = z.match(ZEILE);
      if (!m) return;
      const spalten = m[3].split('|').map((t) => t.trim());
      if (spalten.length < 6) return;
      aus.push({
        projekt: m[1], datei: m[2], zeile: i,
        bereich: klartext(spalten[0]), status: klartext(spalten[1]),
        code: klartext(spalten[2]), live: klartext(spalten[3]),
        standIn: klartext(spalten[4]), zuletzt: klartext(spalten[5]),
      });
    });
    return aus;
  }

  /* Status und Datum einer Zeile ersetzen, alles andere bleibt Zeichen für Zeichen stehen. */
  function projektZeileSetzen(md, projekt, { status, zuletzt }) {
    const zeilen = md.split('\n');
    let gefunden = false;
    for (let i = 0; i < zeilen.length; i++) {
      const m = zeilen[i].match(ZEILE);
      if (!m || m[1] !== projekt) continue;
      const spalten = m[3].split('|');
      if (status) spalten[1] = ' ' + status + ' ';
      if (zuletzt) spalten[5] = ' ' + zuletzt + ' ';
      zeilen[i] = '| [' + m[1] + '](' + m[2] + ') |' + spalten.join('|') + '|';
      gefunden = true;
      break;
    }
    if (!gefunden) throw new Error('Projekt ' + projekt + ' steht nicht in PROJEKTE.md.');
    return zeilen.join('\n');
  }

  /* Abschnitte einer Projektdatei: { titel: [zeilen] } in Reihenfolge. */
  function abschnitte(md) {
    const aus = [];
    let akt = { titel: '', zeilen: [] };
    md.split('\n').forEach((z) => {
      if (z.startsWith('## ')) { aus.push(akt); akt = { titel: z.slice(3).trim(), zeilen: [] }; }
      else akt.zeilen.push(z);
    });
    aus.push(akt);
    return aus;
  }

  function punkte(zeilen) {
    const aus = [];
    zeilen.forEach((z) => {
      if (/^\s*- /.test(z)) aus.push(z.replace(/^\s*- /, '').trim());
      else if (/^\s{2,}\S/.test(z) && aus.length) aus[aus.length - 1] += ' ' + z.trim();
    });
    return aus;
  }

  function projektDateiLesen(md) {
    const ab = abschnitte(md);
    const kopf = ab[0].zeilen.join('\n');
    const titel = (kopf.match(/^# (.+)$/m) || [])[1] || '';
    const ziel = ab.find((a) => a.titel.toLowerCase().startsWith('ziel'));
    const finde = (name) => {
      const a = ab.find((x) => x.titel.toLowerCase().startsWith(name));
      return a ? punkte(a.zeilen) : [];
    };
    return {
      titel,
      ziel: ziel ? ziel.zeilen.join(' ').replace(/\s+/g, ' ').trim() : '',
      stand: finde('stand'),
      offen: finde('offene punkte'),
      naechster: finde('nächster schritt'),
    };
  }

  /* „Nächster Schritt" ersetzen; fehlt der Abschnitt, kommt er vor „Quellen" oder ans Ende. */
  function naechsterSchrittSetzen(md, text) {
    const neu = text.split('\n').map((t) => t.trim()).filter(Boolean).map((t) => '- ' + t.replace(/^- /, ''));
    const zeilen = md.split('\n');
    const start = zeilen.findIndex((z) => /^## Nächster Schritt/.test(z));
    if (start < 0) {
      const quellen = zeilen.findIndex((z) => /^## Quellen/.test(z));
      const block = ['## Nächster Schritt', '', ...neu, ''];
      if (quellen < 0) return md.replace(/\s*$/, '') + '\n\n' + block.join('\n');
      zeilen.splice(quellen, 0, ...block);
      return zeilen.join('\n');
    }
    let ende = zeilen.findIndex((z, i) => i > start && z.startsWith('## '));
    if (ende < 0) ende = zeilen.length;
    const danach = zeilen.slice(ende);
    return [...zeilen.slice(0, start + 1), '', ...neu, '', ...danach].join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
  }

  /* Kopfzeile „Status: x · Zuletzt: y" der Projektdatei nachziehen. */
  function kopfSetzen(md, { status, zuletzt }) {
    let s = md;
    if (status) s = s.replace(/(Status: )[^·\n]+/, '$1' + status + ' ');
    if (zuletzt) s = s.replace(/(Zuletzt: )[^·\n]+/, '$1' + zuletzt);
    return s.replace(/ +·/g, ' ·');
  }

  function aufgabeTitel(projekt, text) {
    const t = String(text || '').trim();
    return projekt ? '[' + projekt + '] ' + t : t;
  }

  function aufgabeZerlegen(issue) {
    const m = String(issue.title || '').match(/^\[([^\]]+)\]\s*(.*)$/);
    const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
    return {
      nr: issue.number, projekt: m ? m[1] : '', text: m ? m[2] : issue.title,
      fuer: labels.includes('claude') ? 'claude' : labels.includes('daniel') ? 'daniel' : '',
      labels, link: issue.html_url, erstellt: issue.created_at,
    };
  }

  function heute(d) {
    const x = d || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
  }

  /* UTF-8 sicher nach/aus Base64 (GitHub-Contents-API). */
  function b64kodieren(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64dekodieren(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  const LOGIK = { STATUS, klartext, projekteLesen, projektZeileSetzen, projektDateiLesen,
    naechsterSchrittSetzen, kopfSetzen, aufgabeTitel, aufgabeZerlegen, heute, b64kodieren, b64dekodieren };
  if (typeof module !== 'undefined' && module.exports) module.exports = LOGIK;
  else wurzel.LOGIK = LOGIK;
})(typeof window !== 'undefined' ? window : globalThis);
