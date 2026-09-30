const CACHE = "appfinanza-static-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([
  caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("appfinanza-") && name !== CACHE).map((name) => caches.delete(name)))),
  self.clients.claim(),
])));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !/\.(?:css|js|png|svg|ico|woff2?)$/i.test(url.pathname)) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
