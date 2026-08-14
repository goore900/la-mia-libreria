/* La Mia Libreria — service worker.
   L'app deve funzionare offline, ma senza mai restare indietro rispetto al sito:
   quindi si prova sempre la rete e si ricade sulla copia locale solo se non c'è.
   La versione in fondo al nome della cache va alzata a ogni pubblicazione. */
const CACHE = 'lml-v2';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/seed.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* rete per prima, con la cache come rete di sicurezza:
   online si ha sempre l'ultima versione, offline si continua a lavorare */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req.mode === 'navigate' ? './index.html' : req);
      if (hit) return hit;
      throw new Error('non disponibile offline');
    }
  })());
});

/* la pagina può chiedere di ripulire tutto quando si accorge di file disallineati */
self.addEventListener('message', e => {
  if (e.data === 'svuota-cache') {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});
