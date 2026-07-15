/*
 * Service worker for the installable Admin app shell only.
 * It never touches GitHub API requests — those always go straight to the
 * network so saves/edits are never served stale or offline.
 */
const CACHE_NAME = "yukans-recipes-admin-v3";
const SHELL_FILES = [
  "admin.html",
  "assets/css/style.css?v=2",
  "assets/js/admin.js?v=2",
  "assets/js/github-api.js?v=2",
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

const SHELL_PATHS = SHELL_FILES.map((f) => f.split("?")[0]);

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only ever serve the admin app shell from cache. Everything else
  // (GitHub API calls, recipe images, the public site) goes straight
  // to the network untouched. Compare against pathnames only — a
  // cache-busting "?v=2" query string never shows up in url.pathname.
  const isShellRequest =
    url.origin === self.location.origin &&
    SHELL_PATHS.some((p) => url.pathname.endsWith(`/${p}`) || url.pathname.endsWith(p));

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
