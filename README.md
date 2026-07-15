Website: https://uq-zhiyao.github.io/yukans-recipes/

Plain HTML/CSS/JS — no build step, no server, no Jekyll/Ruby. GitHub Pages just
serves the files in this repo as-is.

## Two pathways

- **Admin (edit only):** [`admin/index.html`](admin/index.html) — a form for
  creating, editing, and deleting recipes (including adding, replacing, or
  removing the hero image). Saves go straight to this repo via the GitHub
  Contents API. It never renders the public site. The layout is responsive
  (comfortable on desktop, single-column on phone) and installable as its own
  app — see below.
- **Result output (view only):** [`index.html`](index.html) (recipe list) and
  [`recipe.html`](recipe.html) (single recipe) — read `data/recipes.json` and
  render it. No edit controls anywhere on these pages. Clicking the site
  title on the recipe list shows a QR code for the current site URL
  (detected at runtime), for handing the page to someone in person. Also
  installable as its own app — see below.

## How it works

- `data/recipes.json` is the single source of truth: an array of recipe
  objects (`slug`, `title`, `date`, `image`, `thumbnail`, `imageAlt`,
  `instagramUrl`, `body` — `body` is Markdown, rendered client-side with
  [marked](https://marked.js.org/)).
- `index.html`/`recipe.html` fetch that JSON file directly (same-origin, no
  GitHub API calls, no auth) and render it — this is the read-only output.
  The recipe list uses `thumbnail` (small); the recipe page uses `image`
  (full-size) for the hero photo.
- `admin/index.html` reads/writes `data/recipes.json` and uploads images to
  `images/<slug>/` directly through the GitHub REST API, authenticated with a
  personal access token you paste in once (kept in `localStorage`, never
  committed).

### Image handling

Uploading a hero image in the admin page doesn't ship the original file —
a camera photo can be several MB, and the recipe list only ever displays it
at thumbnail size. Instead, the browser (via `<canvas>`, no server involved)
generates and uploads two JPEGs per image:

- the **main** image, capped at 1600px on its long edge, used on the recipe
  page;
- a **thumbnail**, capped at 480px, used on the recipe list.

This is why "Remove image" deletes two files, and why `recipes.json` has
both an `image` and a `thumbnail` field per recipe. Paths in `recipes.json`
are stored relative to the repo root (for the public pages); the admin page
prefixes them with `../` since it lives one folder down, at `/admin/`.

## One-time admin setup

1. On GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.**
2. Restrict it to the **`uq-zhiyao/yukans-recipes`** repository only.
3. Under Repository permissions, grant **Contents: Read and write**.
4. Copy the generated token, open `/admin/` on the live site, and paste it
   into the login field.

The token only ever lives in your browser's local storage — it is never
written to any file in this repo. Treat it like a password: don't paste it
into a shared/public computer, and revoke it from GitHub's settings if you
ever suspect it's leaked.

## Setting up reactions (like/love counts)

Each recipe page has like/love buttons with a shared count that every
visitor sees — not just a per-browser tally. Since this site has no
backend and nobody except you holds write credentials to this repo, that
shared number lives in a free [Firebase](https://firebase.google.com)
Firestore database instead, called directly from the browser via
Firestore's plain REST API (no SDK to download — `assets/js/reactions.js`
is a few small `fetch()` calls). Until you complete this setup, the
reactions section quietly doesn't render — nothing else on the site is
affected.

1. Go to the [Firebase console](https://console.firebase.google.com),
   create a free project (no billing required for this).
2. **Build → Firestore Database → Create database.** Start in production
   mode (any region is fine).
3. In Firestore, go to the **Rules** tab and replace the rules with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /reactions/{slug} {
         allow get: if true;
         allow list: if false;
         allow create: if request.resource.data.keys().hasOnly(['likes', 'loves'])
                       && request.resource.data.likes is int && request.resource.data.likes >= 0 && request.resource.data.likes <= 1
                       && request.resource.data.loves is int && request.resource.data.loves >= 0 && request.resource.data.loves <= 1;
         allow update: if request.resource.data.keys().hasOnly(['likes', 'loves'])
                       && request.resource.data.likes is int && request.resource.data.loves is int
                       && (
                            (request.resource.data.likes == resource.data.likes + 1 && request.resource.data.loves == resource.data.loves)
                         || (request.resource.data.loves == resource.data.loves + 1 && request.resource.data.likes == resource.data.likes)
                          );
         allow delete: if false;
       }
     }
   }
   ```

   This only ever allows creating a recipe's reaction doc with 0/1 counts,
   or bumping exactly one of `likes`/`loves` by exactly 1 per request —
   nothing else is ever writable, and nobody can list/enumerate all
   documents. It can't stop someone from clicking rapidly with a script
   (there's no login to rate-limit against), but it can't be used to
   tamper with anything beyond these two small counters either.
4. **Project settings (gear icon) → General → Your apps → Web app (`</>`).**
   Register an app (no Firebase Hosting needed). Copy the `projectId` and
   `apiKey` from the shown config object — these are public identifiers,
   not secrets; Firebase's security model relies on the Rules above, not
   on hiding them.
5. Paste both into `assets/js/reactions.js`:

   ```js
   const FIRESTORE_CONFIG = {
     projectId: "your-project-id",
     apiKey: "your-web-api-key",
   };
   ```

That's it — no other files need to change. Reaction counts start at 0/0
for every recipe the first time someone reacts to it.

## Installing as apps (PWA)

There are **two separate installable apps**, so a phone or desktop can have
both at once without them being confused for each other:

|              | Member app                          | Admin app                         |
|--------------|--------------------------------------|------------------------------------|
| Pages        | `index.html`, `recipe.html`          | `admin/index.html`                 |
| Icon         | logo on a white background           | same logo, plus a diagonal blue "ADMIN" ribbon |
| Manifest     | `manifest.webmanifest` (scope `/`)   | `admin/manifest.webmanifest` (scope `/admin/`) |
| Service worker | `sw.js`                            | `admin/sw.js`                      |

Each has its own manifest, icon set, and service worker, scoped so installing
one never affects the other.

- **Desktop Chrome/Edge:** an install icon appears in the address bar, or use
  the "Install app" button in that app's header.
- **Android:** the browser shows an "Install app"/"Add to Home screen"
  prompt, or use the in-page "Install app" button.
- **iOS Safari:** use Share → "Add to Home Screen" (iOS doesn't support the
  automatic install prompt).

The app icons live at `assets/icons/icon-*.png` (Member) and
`assets/icons/icon-admin-*.png` (Admin). Replace them the same way if you
ever want different artwork — same filenames, same sizes (192×192 and
512×512), and both manifests pick them up automatically.

## Running locally

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/index.html`. `admin/index.html` works the
same way locally — it always talks to the real GitHub repo, there's no
"local" data store.
