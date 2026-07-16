/*
 * Service worker for the installable Member (public, view-only) app shell.
 * Scoped to the site root, but /admin/ registers its own more specific
 * service worker, which always wins for admin pages — the two installable
 * apps stay independent even though this scope technically covers /admin/.
 *
 * The app shell AND data/recipes.json use stale-while-revalidate (see the
 * fetch handler below): serve instantly from cache if we have it, while
 * always kicking off a background fetch to refresh that cache for next
 * time. Trade-off: right after a recipe is edited, a returning visitor's
 * very next load can briefly show the previous version before the
 * background refresh catches up on the load after that - in exchange for
 * the list/detail pages rendering immediately instead of waiting on a
 * network round trip every single visit. Recipe images are NOT cached
 * here; the browser's normal HTTP cache already handles those well (see
 * their Cache-Control header) and this avoids ever going stale on a new
 * upload replacing the same filename.
 */
const CACHE_NAME = "yukans-recipes-member-v9";
const SHELL_FILES = [
  "index.html",
  "recipe.html",
  "assets/css/style.css?v=7",
  "assets/js/view.js?v=6",
  "assets/vendor/marked.min.js?v=2",
  "assets/vendor/qrcode.js?v=2",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "data/recipes.json",
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
