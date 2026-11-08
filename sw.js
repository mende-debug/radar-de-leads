// Service worker: o app abre offline; arquivos do app são atualizados em segundo plano.
const CACHE = "radar-crm-v2.0.0";
const SHELL = ["./", "index.html", "captar.html", "css/app.css", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png",
  "js/app.js", "js/util.js", "js/i18n.js", "js/store.js", "js/sync.js", "js/ui.js", "js/components.js", "js/charts.js",
  "js/views/dashboard.js", "js/views/pipeline.js", "js/views/leads.js", "js/views/tasks.js", "js/views/prospect.js",
  "js/views/messages.js", "js/views/capture.js", "js/views/settings.js", "js/vendor/qrcode.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: u.pathname.endsWith(".html") || u.pathname.endsWith("/") });
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com/.test(u.host)) {
    e.respondWith(caches.open(CACHE + "-ext").then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
  }
});
