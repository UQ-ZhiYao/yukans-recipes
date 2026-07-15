Website: https://uq-zhiyao.github.io/yukans-recipes/

Plain HTML/CSS/JS — no build step, no server, no Jekyll/Ruby. GitHub Pages just
serves the files in this repo as-is.

## Two pathways

- **Admin (edit only):** [`admin.html`](admin.html) — a form for creating,
  editing, and deleting recipes (including adding, replacing, or removing the
  hero image). Saves go straight to this repo via the GitHub Contents API. It
  never renders the public site. The layout is responsive (comfortable on
  desktop, single-column on phone) and installable as an app — see below.
- **Result output (view only):** [`index.html`](index.html) (recipe list) and
  [`recipe.html`](recipe.html) (single recipe) — read `data/recipes.json` and
  render it. No edit controls anywhere on these pages.

## How it works

- `data/recipes.json` is the single source of truth: an array of recipe
  objects (`slug`, `title`, `date`, `image`, `imageAlt`, `instagramUrl`, `body`
  — `body` is Markdown, rendered client-side with [marked](https://marked.js.org/)).
- `index.html`/`recipe.html` fetch that JSON file directly (same-origin, no
  GitHub API calls, no auth) and render it — this is the read-only output.
- `admin.html` reads/writes `data/recipes.json` and uploads images to
  `images/<slug>/` directly through the GitHub REST API, authenticated with a
  personal access token you paste in once (kept in `localStorage`, never
  committed).

## One-time admin setup

1. On GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.**
2. Restrict it to the **`uq-zhiyao/yukans-recipes`** repository only.
3. Under Repository permissions, grant **Contents: Read and write**.
4. Copy the generated token, open `/admin.html` on the live site, and paste it
   into the login field.

The token only ever lives in your browser's local storage — it is never
written to any file in this repo. Treat it like a password: don't paste it
into a shared/public computer, and revoke it from GitHub's settings if you
ever suspect it's leaked.

## Installing the Admin app (PWA)

`admin.html` is an installable Progressive Web App, separate from the public
site — installing it does not affect `index.html`/`recipe.html`.

- **Desktop Chrome/Edge:** an install icon appears in the address bar, or use
  the "Install app" button in the admin page's top bar.
- **Android:** browser will show an "Install app"/"Add to Home screen" prompt,
  or use the in-page "Install app" button.
- **iOS Safari:** use Share → "Add to Home Screen" (iOS doesn't support the
  automatic install prompt).

The app icons at `assets/icons/icon-192.png`, `icon-512.png`, and
`icon-maskable-512.png` are placeholders (a plain monogram). Swap them for a
real logo whenever you have one — same filenames, same sizes (192×192 and
512×512), and the manifest picks them up automatically.

## Running locally

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/index.html`. `admin.html` works the same way
locally — it always talks to the real GitHub repo, there's no "local" data
store.
