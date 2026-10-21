const CACHE_NAME = 'dmg-sport-ausdauer-v8';
const ASSETS = ['./', './index.html'];
const NETWORK_TIMEOUT_MS = 3000; // bei schwachem Netz nach 3 s auf den Cache ausweichen

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Network-First mit Zeitlimit und Offline-Cache-Fallback:
// - Mit Netz wird die neueste Version geladen und der Cache aktualisiert.
// - Nur erfolgreiche Antworten (200, gleiche Herkunft) landen im Cache, Fehlerseiten nie.
// - Hängt das Netz (schwacher Empfang im Stadion), kommt nach 3 s die gecachte Version.
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const fromCache = function() {
    return caches.match(event.request).then(function(cached) {
      return cached || caches.match('./index.html');
    });
  };

  const fromNetwork = fetch(event.request).then(function(response) {
    if (response && response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
        return cache.put(event.request, copy);
      }));
    }
    return response;
  });

  const timeout = new Promise(function(resolve) {
    setTimeout(function() {
      fromCache().then(function(cached) { if (cached) resolve(cached); });
    }, NETWORK_TIMEOUT_MS);
  });

  event.respondWith(
    Promise.race([
      fromNetwork.catch(function() {
        return fromCache().then(function(cached) {
          return cached || Response.error();
        });
      }),
      timeout
    ])
  );
});
