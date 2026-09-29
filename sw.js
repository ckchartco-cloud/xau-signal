const CACHE_NAME = 'xau-signal-v3';

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './src/app.js',
  './src/chart.js',
  './src/data.js',
  './src/i18n.js',
  './src/indicators.js',
  './src/journal.js',
  './src/patterns.js',
  './src/sessions.js',
  './src/strategy.js',
  './src/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }).then((response) => {
    const url = new URL(event.request.url);
    if (response.ok && url.origin === self.location.origin) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  }));
});
