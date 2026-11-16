/* La Mia Libreria — service worker.
   L'app deve funzionare offline, ma senza mai restare indietro rispetto al sito:
   quindi si prova sempre la rete e si ricade sulla copia locale solo se non c'è.
   La versione in fondo al nome della cache va alzata a ogni pubblicazione. */
const CACHE = 'lml-v4';
/* le copertine collegate stanno in una cache a parte: sopravvivono agli aggiornamenti */
const COPERTINE = 'lml-copertine';
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== COPERTINE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* rete per prima, con la cache come rete di sicurezza:
   online si ha sempre l'ultima versione, offline si continua a lavorare */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* copertine collegate da internet: prima la copia salvata, così si vedono
     anche senza rete e non si riscaricano ogni volta */
  if (new URL(req.url).origin !== location.origin) {
    if (req.destination !== 'image') return;
    e.respondWith((async () => {
      const cache = await caches.open(COPERTINE);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      return fetch(req);
    })());
    return;
  }

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
    /* si butta via tutto tranne le copertine salvate dall'utente */
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== COPERTINE).map(k => caches.delete(k)))));
  }
});
