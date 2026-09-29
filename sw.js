const CACHE_NAME = "xau-signal-v2";

const FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/app.js",
  "./src/chart.js",
  "./src/data.js",
  "./src/i18n.js",
  "./src/indicators.js",
  "./src/journal.js",
  "./src/patterns.js",
  "./src/sessions.js",
  "./src/strategy.js",
  "./src/ui.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
