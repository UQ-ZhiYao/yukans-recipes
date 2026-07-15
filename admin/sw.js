/*
 * Service worker for the installable Admin app shell only.
 * Scoped to /admin/ (this file's own location), so it never controls the
 * public Member app's pages — the two installable apps stay independent.
 * It never touches GitHub API requests — those always go straight to the
 * network so saves/edits are never served stale or offline.
 */
const CACHE_NAME = "yukans-recipes-admin-v8";
const SHELL_FILES = [
  "index.html",
  "../assets/css/style.css?v=7",
  "../assets/js/admin.js?v=3",
  "../assets/js/github-api.js?v=2",
  "../assets/vendor/marked.min.js?v=2",
  "manifest.webmanifest",
  "../assets/icons/icon-admin-192.png",
  "../assets/icons/icon-admin-512.png",
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

const SHELL_PATHS = SHELL_FILES.map((f) => f.split("?")[0].replace(/^\.\.\//, ""));

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
