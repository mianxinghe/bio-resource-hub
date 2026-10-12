/* Service worker: cache app shell; network-first for files (small only). */
const VERSION = "biohub-v2";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./supabase.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // app shell: cache-first
  if (SHELL.includes(url.pathname) || url.pathname.endsWith("/")) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request))
    );
    return;
  }
  // files: network-first, cache only small responses
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(VERSION).then((c) => {
            // only cache files under 3MB to avoid filling storage
            if ((Number(res.headers.get("content-length") || 0) || 0) < 3 * 1048576) {
              c.put(e.request, clone);
            }
          });
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
