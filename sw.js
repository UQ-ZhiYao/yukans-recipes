/*
 * Service worker for the installable Member (public, view-only) app shell.
 * Scoped to the site root, but /admin/ registers its own more specific
 * service worker, which always wins for admin pages — the two installable
 * apps stay independent even though this scope technically covers /admin/.
 *
 * Only the static shell is cached. data/recipes.json and recipe images
 * always go straight to the network so content is never served stale.
 */
const CACHE_NAME = "yukans-recipes-member-v4";
const SHELL_FILES = [
  "index.html",
  "recipe.html",
  "assets/css/style.css?v=4",
  "assets/js/view.js?v=4",
  "assets/vendor/marked.min.js?v=2",
  "assets/vendor/qrcode.js?v=2",
  "manifest.webmanifest",
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
