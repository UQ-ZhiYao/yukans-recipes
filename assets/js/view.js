/*
 * View pathway (read-only). Fetches data/recipes.json and renders it.
 * No GitHub API calls, no auth, no edit affordances live here.
 */
async function loadRecipes() {
  // "no-cache" (not "no-store") - always revalidates with the server so
  // edits show up right away, but lets the browser reuse the cached body
  // on a 304 instead of re-downloading the whole file every single visit.
  const res = await fetch("data/recipes.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load recipes.json");
  const recipes = await res.json();
  return recipes.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
}

function formatDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function renderRecipeList() {
  const listEl = document.getElementById("recipe-list");
  try {
    const recipes = await loadRecipes();
    if (recipes.length === 0) {
      listEl.innerHTML = '<p class="state-message">No recipes yet — check back soon!</p>';
      return;
    }
    listEl.innerHTML = recipes
      .map((r) => {
        const thumb = r.thumbnail || r.image;
        return `
      <li>
        <a class="recipe-card" href="recipe.html?slug=${encodeURIComponent(r.slug)}">
          ${
            thumb
              ? `<img class="recipe-card-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" width="140" height="140">`
              : ""
          }
          <div class="recipe-card-body">
            <span class="recipe-card-date">${formatDate(r.date)}</span>
            <h3 class="recipe-card-title">${escapeHtml(r.title)}</h3>
          </div>
        </a>
      </li>`;
      })
      .join("");
  } catch (err) {
    listEl.innerHTML = `<p class="state-message is-error">Couldn't load recipes: ${escapeHtml(err.message)}</p>`;
  }
}

// Clicking the site title on the main page shows a QR code for the current
// site's URL instead of navigating — an easy way to hand this page to
// someone else in person. Detects the URL at runtime so it's correct
// whether the site is on the default GitHub Pages domain, a custom domain,
// or running locally.
function initQrModal() {
  const link = document.getElementById("site-title-link");
  const modal = document.getElementById("qr-modal");
  if (!link || !modal) return;

  const container = document.getElementById("qr-code-container");
  const urlText = document.getElementById("qr-url-text");
  const closeBtn = document.getElementById("qr-modal-close");

  function openModal() {
    const siteUrl = new URL(".", window.location.href).href;
    const qr = qrcode(0, "M");
    qr.addData(siteUrl);
    qr.make();
    container.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    urlText.textContent = siteUrl;
    modal.hidden = false;
    closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    link.focus();
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });
  closeBtn.addEventListener("click", closeModal);
  modal.querySelector(".qr-modal-backdrop").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
}

async function renderRecipeDetail() {
  const container = document.getElementById("recipe-detail");
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (!slug) {
    container.innerHTML = '<p class="state-message is-error">No recipe specified.</p>';
    return;
  }
  try {
    const recipes = await loadRecipes();
    const recipe = recipes.find((r) => r.slug === slug);
    if (!recipe) {
      container.innerHTML = '<p class="state-message is-error">Recipe not found.</p>';
      return;
    }
    document.title = `${recipe.title} — Yukan's recipes`;
    container.innerHTML = `
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(recipe.title)}</h1>
        <p class="post-meta">${formatDate(recipe.date)}</p>
      </header>
      ${
        recipe.image
          ? `<p class="recipe-hero"><img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.imageAlt || recipe.title)}" decoding="async"></p>`
          : ""
      }
      ${
        recipe.instagramUrl
          ? `<p class="recipe-instagram-link"><a href="${escapeHtml(recipe.instagramUrl)}" target="_blank" rel="noopener">View this post on Instagram &rarr;</a></p>`
          : ""
      }
      <div class="post-content">${marked.parse(recipe.body || "")}</div>
      <a class="back-link" href="index.html">&larr; Back to all recipes</a>
    `;
  } catch (err) {
    container.innerHTML = `<p class="state-message is-error">Couldn't load recipe: ${escapeHtml(err.message)}</p>`;
  }
}

// Installable "Member" app (view only) — separate PWA from the Admin app,
// with its own manifest/icons/service worker so the two installs never mix.
let deferredInstallPrompt = null;

function initInstallPrompt() {
  const installBtn = document.getElementById("install-btn");
  if (!installBtn) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* offline install support is a nice-to-have, not required for the app to work */
  });
}
