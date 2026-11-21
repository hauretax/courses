// Hors ligne d'abord : l'appli s'ouvre tout de suite depuis sa copie locale, même avec un réseau faible au fond du magasin.
// Chaque mise en ligne a son propre cache (deploy.sh remplace « courses-dev » par une empreinte des fichiers) : le navigateur voit
// un nouveau sw.js, télécharge la nouvelle version en arrière-plan, puis la page passe dessus (app.js, « controllerchange »).
const C = "courses-dev";
// « ./ » = la page (index.html redirige vers « / » sur le serveur : on ne garde que « ./ »)
const FILES = ["./", "app.js", "data.js", "recettes.js", "journal.js", "cuisine.js", "placard.js", "planner.js", "tickets.js", "cloud.js", "zxing.min.js", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("courses-") && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || /^\/(api|mcp)\//.test(u.pathname)) return; // données du serveur : toujours en direct
  const key = r.mode === "navigate" ? "./" : r;
  e.respondWith(caches.match(key, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(C).then(c => c.put(r, copy)); }
    return res;
  })));
});
