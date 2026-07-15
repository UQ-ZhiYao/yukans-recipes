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
  `instagramUrl`, `body`, `issueNumber` — `body` is Markdown, rendered
  client-side with [marked](https://marked.js.org/); `issueNumber` is the
  companion GitHub Issue used for reactions, see below).
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
3. Under Repository permissions, grant **Contents: Read and write** and
   **Issues: Read and write** (issues are needed for the reactions feature
   below — saving a new recipe creates its companion issue automatically).
4. Copy the generated token, open `/admin/` on the live site, and paste it
   into the login field.

The token only ever lives in your browser's local storage — it is never
written to any file in this repo. Treat it like a password: don't paste it
into a shared/public computer, and revoke it from GitHub's settings if you
ever suspect it's leaked.

## Reactions (like/love counts)

Each recipe page shows 👍/❤️ counts, and no other platform is involved —
just this GitHub repo. GitHub has no public API for anonymously
incrementing an arbitrary counter, so this piggybacks on something GitHub
already provides: **native reactions on GitHub Issues**. Every recipe has
a companion Issue (its number is stored as `issueNumber` in
`data/recipes.json`); `assets/js/reactions.js` reads that issue's reaction
counts through GitHub's public REST API (no auth needed - works for any
visitor) and shows a "React on GitHub ↗" link to the issue itself.

- **Reading counts** needs nothing from you - it's a public, unauthenticated
  API call.
- **Reacting** requires the visitor to have a GitHub account, since that's
  the only way GitHub lets anyone react to anything. There's no way around
  this without introducing another platform (like Firebase) or a server of
  our own - see the earlier discussion in this project's history if you
  want that trade-off instead.
- GitHub enforces one reaction of each kind per account itself, so unlike
  a homemade counter, this can't be inflated by repeat-clicking.
- The Admin panel creates a recipe's companion issue automatically the
  first time it's saved (titled "Reactions: <title>", linking back to the
  recipe page), and keeps the issue title in sync if the recipe is
  renamed. This is why the admin token needs **Issues: Read and write**
  (see above) in addition to Contents.
- A recipe with no `issueNumber` yet (e.g. very old data) just hides the
  reactions section instead of showing a broken widget.

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
