// Hors ligne : sert le réseau en priorité, le cache si pas de réseau (utile au fond du supermarché).
const C = "courses-v5";
const FILES = ["./", "index.html", "app.js", "data.js", "recettes.js", "journal.js", "cuisine.js", "placard.js", "planner.js", "tickets.js", "cloud.js", "zxing.min.js", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
