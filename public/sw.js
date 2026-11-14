// Replaced with a content hash in the exported build by scripts/validate-pwa.mjs.
const BASE = new URL("./", self.location.href);
const PREFIX = `appfinanza-${BASE.pathname}-`;
const CACHE = `${PREFIX}__BUILD_VERSION__`;
const OFFLINE = new URL("offline.html", BASE).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([
    OFFLINE, new URL("icon-192.png", BASE).href, new URL("icon-512.png", BASE).href,
  ])));
});
// Activate updates after user acceptance or after all old tabs close.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names.filter((name) =>
      (name.startsWith(PREFIX) && name !== CACHE) || name === "appfinanza-static-v2"
    ).map((name) => caches.delete(name)))),
    self.clients.claim(),
  ]));
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (request.mode === "navigate") {
    // Never store authenticated pages, callback URLs, or financial responses.
    event.respondWith(fetch(request).catch(async () =>
      (await (await caches.open(CACHE)).match(OFFLINE)) || Response.error()
    ));
    return;
  }
  const asset = url.pathname.slice(BASE.pathname.length);
  if (url.search || !(asset.startsWith("_next/static/") || /^icon-(192|512)\.png$/.test(asset))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  })());
});
