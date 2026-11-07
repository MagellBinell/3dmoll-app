import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../logik.js');
const lies = (n) => readFileSync(new URL('./fixtures/' + n, import.meta.url), 'utf8');

test('PROJEKTE.md: alle Projekte, ohne Archiv', () => {
  const p = L.projekteLesen(lies('PROJEKTE.md'));
  assert.equal(p.length, 7);
  assert.ok(!p.some((x) => x.projekt === 'altprojekt'), 'Archiv darf nicht mitkommen');
  const s = p.find((x) => x.projekt === 'solarsketch');
  assert.equal(s.status, 'aktiv');
  assert.equal(s.bereich, 'software');
  assert.equal(s.datei, 'projekte/solarsketch.md');
  for (const x of p) assert.ok(L.STATUS.includes(x.status), x.projekt + ': ' + x.status);
});

test('Zeile setzen ändert nur Status und Datum dieser Zeile', () => {
  const md = lies('PROJEKTE.md');
  const neu = L.projektZeileSetzen(md, 'zaehlanlage', { status: 'ruht', zuletzt: '2026-11-07' });
  const a = md.split('\n'), b = neu.split('\n');
  assert.equal(a.length, b.length);
  const diff = a.map((z, i) => (z === b[i] ? null : i)).filter((i) => i !== null);
  assert.equal(diff.length, 1);
  const z = L.projekteLesen(neu).find((x) => x.projekt === 'zaehlanlage');
  assert.equal(z.status, 'ruht');
  assert.equal(z.zuletzt, '2026-11-07');
  assert.equal(z.code, L.projekteLesen(md).find((x) => x.projekt === 'zaehlanlage').code);
  assert.throws(() => L.projektZeileSetzen(md, 'gibtsnicht', { status: 'ruht' }));
});

test('Projektdatei lesen', () => {
  const p = L.projektDateiLesen(lies('geschaeft.md'));
  assert.match(p.titel, /Geschäft/);
  assert.ok(p.ziel.length > 10);
  assert.ok(p.naechster.length >= 1);
  assert.ok(p.offen.length >= 1);
});

test('Nächster Schritt ersetzen, Rest bleibt', () => {
  const md = lies('zaehlanlage.md');
  const neu = L.naechsterSchrittSetzen(md, 'Board testen\n- Servo einstellen');
  const p = L.projektDateiLesen(neu);
  assert.deepEqual(p.naechster, ['Board testen', 'Servo einstellen']);
  const vorher = L.projektDateiLesen(md);
  assert.deepEqual(p.stand, vorher.stand);
  assert.deepEqual(p.offen, vorher.offen);
  assert.ok(!/\n{3,}/.test(neu));
});

test('Kopfzeile nachziehen', () => {
  const md = lies('charmilles-edm.md');
  const neu = L.kopfSetzen(md, { status: 'aktiv', zuletzt: '2026-11-07' });
  assert.match(neu, /Status: aktiv · Zuletzt: 2026-11-07/);
  assert.equal(neu.split('\n').length, md.split('\n').length);
});

test('Aufgaben', () => {
  assert.equal(L.aufgabeTitel('solarsketch', ' Logo tauschen '), '[solarsketch] Logo tauschen');
  const a = L.aufgabeZerlegen({ number: 5, title: '[3dmoll] Mem trennen', labels: [{ name: 'daniel' }], html_url: 'u' });
  assert.equal(a.projekt, '3dmoll'); assert.equal(a.text, 'Mem trennen'); assert.equal(a.fuer, 'daniel');
});

test('Base64 mit Umlauten hin und zurück', () => {
  const t = 'Nächster Schritt: Größe prüfen – „ok“ ✓';
  assert.equal(L.b64dekodieren(L.b64kodieren(t)), t);
});
