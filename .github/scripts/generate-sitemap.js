// Regenerates sitemap.xml from data/recipes.json on every deploy, so search
// engines always see the current list of recipes without anyone having to
// remember to update a hand-written file. Runs in CI only (see
// .github/workflows/static.yml) - the site itself has no build step.
const fs = require("fs");
const path = require("path");

const SITE_URL = "https://yukans-recipes.com";
const repoRoot = path.join(__dirname, "..", "..");

const recipes = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/recipes.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: `${SITE_URL}/`, lastmod: today },
  ...recipes.map((r) => ({
    loc: `${SITE_URL}/recipe.html?slug=${encodeURIComponent(r.slug)}`,
    lastmod: r.date,
  })),
];

const body = urls
  .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

fs.writeFileSync(path.join(repoRoot, "sitemap.xml"), xml);
console.log(`Wrote sitemap.xml with ${urls.length} URLs`);
