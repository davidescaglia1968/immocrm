/* Service worker ImmoCRM Pro — offline-first per la shell, dati sempre locali.
   Strategia:
   - navigazione e file dell'app: prima la rete (aggiornamento), fallback cache
   - icone: cache-first
   Nessun dato del CRM passa dal service worker: resta in localStorage/IndexedDB/cloud cifrato.
*/
const CACHE = 'immocrm-shell-v23'; // v10.6.5 — schede senza doppioni
const CORE = ['./', './index.html', './style.css', './app.js', './sync.js', './promemoria.js', './recupero-dati.js', './automazioni.js', './fonti.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* v10.6.2: quando l'app dice "Aggiorna ora", la nuova versione prende subito il posto. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Mai in cache: API GitHub (sincronizzazione) e qualunque endpoint dati esterno.
  if (url.hostname !== self.location.hostname) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const isShell = /\.(js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isShell) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // icone e asset statici: cache-first
  e.respondWith(
    caches.match(req).then((r) => r || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
      return res;
    }))
  );
});
