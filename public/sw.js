const CACHE_NAME = "gtt-transport-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo.png",
];

const HTTP_STATUS_OK = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) => console.warn("Cache addAll failed:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .catch((err) => console.warn("Cache cleanup failed:", err))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse.status === HTTP_STATUS_OK &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            })
            .catch((err) => console.warn("Cache put failed:", err));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (event.request.headers.get("accept")?.includes("text/html")) {
              return caches.match("/");
            }
            return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
          })
          .catch((err) => {
            console.warn("Cache match failed:", err);
            return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
          });
      })
  );
});
