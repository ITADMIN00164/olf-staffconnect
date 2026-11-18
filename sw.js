/* OLF Staff Connect - service worker.

   Deliberately tiny. It does ONE thing: when someone opens the app with no
   internet, it shows a friendly "You're offline" page instead of the browser's
   error. Everything else - every script, style and request for data - goes
   straight to the network exactly as before, so a new deploy reaches people at
   once and nothing stale is ever served. */
var CACHE = "olf-offline-v2";
var OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll([OFFLINE_URL, "/icon-192.png?v=2"]);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  // Only a page being opened. Scripts, styles, data and uploads are not touched.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(OFFLINE_URL);
    })
  );
});
