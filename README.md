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
  `instagramUrl`, `body` — `body` is HTML from the admin's rich text editor
  (older recipes have plain Markdown instead; both render fine, see below),
  rendered client-side with [marked](https://marked.js.org/)).
- `index.html`/`recipe.html` fetch that JSON file directly (same-origin, no
  GitHub API calls, no auth) and render it — this is the read-only output.
  The recipe list uses `thumbnail` (small); the recipe page uses `image`
  (full-size) for the hero photo.
- `admin/index.html` reads/writes `data/recipes.json` and uploads images to
  `images/<slug>/` directly through the GitHub REST API, authenticated with a
  personal access token you paste in once (kept in `localStorage`, never
  committed).

### Speed

`data/recipes.json` is preloaded (`<link rel="preload">`) so the fetch starts
immediately instead of waiting for scripts to download and run first, and
`sw.js` caches it with a stale-while-revalidate strategy — same as the rest
of the app shell: serve instantly from cache if we have it, refresh that
cache in the background for next time. Verified this directly by blocking
`data/recipes.json`'s network entirely on a repeat visit and confirming the
recipe list/detail pages still rendered in ~100ms from cache.

Trade-off: right after editing a recipe, a returning visitor's very next
load can briefly show the previous version before the background refresh
catches up on the load after that. Given this is a personal recipe blog
rather than anything real-time, that's the right side to err on for making
the common case (repeat visits) feel instant.

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

### Recipe text formatting

The "Recipe" field in the admin is a real rich text editor (bold, italic,
underline, strikethrough, font size, headings, quote, code block, bullet/
numbered lists, links) — not a plain Markdown textarea. It's built on the
browser's own `contenteditable` + `execCommand`, so there's no editor
library to vendor; its output is plain HTML, saved directly into
`recipes.json`'s `body` field.

Recipes written before this existed have plain Markdown in `body` instead
of HTML. Both work, forever: [marked](https://marked.js.org/) (used to
render `body` on the public pages) passes well-formed raw HTML straight
through unchanged, so it renders Markdown and HTML bodies identically well.
The admin editor does the same thing in reverse when you open an older
recipe — it runs the stored Markdown through `marked.parse()` before
displaying it, so it always shows up correctly formatted (not literal
`**asterisks**`) regardless of which format that recipe happens to be
stored in. Saving from the editor always writes HTML from then on, so
recipes quietly upgrade format the next time they're edited — no manual
migration needed.

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
