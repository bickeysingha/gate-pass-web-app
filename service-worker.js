// Gate Pass App - Service Worker

const CACHE_NAME = "gatepass-cache-v1";

const URLS_TO_CACHE = [
  "/gate-pass-web-app/",
  "/gate-pass-web-app/index.html",
  "/gate-pass-web-app/style.css",
  "/gate-pass-web-app/script.js",
  "/gate-pass-web-app/firebase-config.js",
  "/gate-pass-web-app/manifest.json",
  "/gate-pass-web-app/icons/icon-192.png",
  "/gate-pass-web-app/icons/icon-512.png"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

// Activate (cleanup old caches if needed)
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});

// Fetch (cache first)
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
