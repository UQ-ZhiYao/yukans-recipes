Website: https://uq-zhiyao.github.io/yukans-recipes/

## Two pathways

- **Admin (edit only):** `/admin/` — a [Decap CMS](https://decapcms.org/) editor for
  writing and updating recipes. Requires GitHub login; only repo collaborators
  can save changes. It only ever shows editing forms, never the rendered site.
- **Result output (view only):** everything else — the public Jekyll site.
  Visitors can only read recipes here; there is no edit UI on these pages.

## One-time setup for Admin login (GitHub OAuth)

GitHub Pages can't run the OAuth callback itself, so the Admin pathway
authenticates through a free Netlify OAuth proxy (you don't need to host
anything on Netlify — it's only used for the login handshake):

1. Create a GitHub OAuth App: **GitHub → Settings → Developer settings →
   OAuth Apps → New OAuth App**
   - Homepage URL: `https://uq-zhiyao.github.io/yukans-recipes/`
   - Authorization callback URL: `https://api.netlify.com/auth/done`
   - Save the generated **Client ID** and **Client Secret**.
2. Create a free Netlify account and a new site (it doesn't need to deploy
   anything real — an empty/placeholder site is fine).
3. In that Netlify site: **Site configuration → Access & security → OAuth →
   Install provider**, and paste in the GitHub Client ID/Secret from step 1.
4. That's it — visiting `/admin/` on the live site will now show a
   "Login with GitHub" button.

Only GitHub accounts with write access to this repo can log in and save
recipes.
