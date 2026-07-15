/*
 * Service worker for the installable Admin app shell only.
 * It never touches GitHub API requests — those always go straight to the
 * network so saves/edits are never served stale or offline.
 */
const CACHE_NAME = "yukans-recipes-admin-v2";
const SHELL_FILES = [
  "admin.html",
  "assets/css/style.css",
  "assets/js/admin.js",
  "assets/js/github-api.js",
  "admin-manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only ever serve the admin app shell from cache. Everything else
  // (GitHub API calls, recipe images, the public site) goes straight
  // to the network untouched.
  const isShellRequest =
    url.origin === self.location.origin &&
    SHELL_FILES.some((f) => url.pathname.endsWith(`/${f}`) || url.pathname.endsWith(f));

  if (!isShellRequest || event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
