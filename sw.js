/* Hält nur die App selbst vor (startet ohne Netz). Daten von GitHub werden nie zwischengespeichert. */
const STAND = '3dmoll-app-2';
const DATEIEN = ['./', 'index.html', 'app.css', 'logik.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(STAND).then((c) => c.addAll(DATEIEN))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== STAND).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  // Netz zuerst, damit ein neuer Stand sofort ankommt; ohne Netz die gespeicherte Fassung.
  e.respondWith(fetch(e.request).then((r) => {
    const kopie = r.clone(); caches.open(STAND).then((c) => c.put(e.request, kopie)); return r;
  }).catch(() => caches.match(e.request)));
});
