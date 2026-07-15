/*
 * Admin pathway (edit only). Everything here talks to the GitHub Contents
 * API via GitHubRepo (assets/js/github-api.js) using a token the admin
 * pastes in once. This page never renders the public site — it only ever
 * shows forms for creating/editing/deleting recipes.
 */
const RECIPES_PATH = "data/recipes.json";

const els = {};
let recipesCache = null; // { list, sha }
let selectedImageFile = null; // { name, dataBase64 }

function $(id) {
  return document.getElementById(id);
}

function cacheEls() {
  [
    "login-panel",
    "token-input",
    "login-btn",
    "login-status",
    "editor-panel",
    "logout-btn",
    "recipe-select",
    "new-recipe-btn",
    "delete-btn",
    "recipe-form",
    "title-input",
    "date-input",
    "image-input",
    "image-alt-input",
    "instagram-input",
    "body-input",
    "body-preview",
    "current-image",
    "save-btn",
    "save-status",
  ].forEach((id) => {
    els[id] = $(id);
  });
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "recipe";
}

function uniqueSlug(baseSlug, existing, ignoreSlug) {
  let slug = baseSlug;
  let n = 2;
  const taken = new Set(existing.map((r) => r.slug).filter((s) => s !== ignoreSlug));
  while (taken.has(slug)) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
  return slug;
}

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = `status-line${kind ? ` is-${kind}` : ""}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function tryAutoLogin() {
  if (!GitHubRepo.getToken()) return;
  await handleLoginSuccess();
}

async function handleLogin() {
  const token = els["token-input"].value.trim();
  if (!token) {
    setStatus(els["login-status"], "Please paste a token first.", "error");
    return;
  }
  GitHubRepo.setToken(token);
  els["login-btn"].disabled = true;
  setStatus(els["login-status"], "Checking token…");
  try {
    await GitHubRepo.verifyToken();
    await handleLoginSuccess();
  } catch (err) {
    GitHubRepo.clearToken();
    setStatus(els["login-status"], `Login failed: ${err.message}`, "error");
  } finally {
    els["login-btn"].disabled = false;
  }
}

async function handleLoginSuccess() {
  els["login-panel"].hidden = true;
  els["editor-panel"].hidden = false;
  setStatus(els["login-status"], "");
  await refreshRecipeList();
  resetForm();
}

function handleLogout() {
  GitHubRepo.clearToken();
  recipesCache = null;
  els["editor-panel"].hidden = true;
  els["login-panel"].hidden = false;
  els["token-input"].value = "";
}

async function refreshRecipeList() {
  const file = await GitHubRepo.getTextFile(RECIPES_PATH);
  recipesCache = file
    ? { list: JSON.parse(file.text), sha: file.sha }
    : { list: [], sha: null };
  const select = els["recipe-select"];
  select.innerHTML =
    '<option value="">-- New recipe --</option>' +
    recipesCache.list
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((r) => `<option value="${r.slug}">${r.date} — ${r.title}</option>`)
      .join("");
}

function resetForm() {
  els["recipe-form"].reset();
  els["date-input"].value = todayIso();
  els["recipe-select"].value = "";
  selectedImageFile = null;
  els["current-image"].innerHTML = "";
  els["delete-btn"].hidden = true;
  els["body-preview"].innerHTML = "";
  setStatus(els["save-status"], "");
}

function loadRecipeIntoForm(slug) {
  const recipe = recipesCache.list.find((r) => r.slug === slug);
  if (!recipe) {
    resetForm();
    return;
  }
  selectedImageFile = null;
  els["title-input"].value = recipe.title || "";
  els["date-input"].value = recipe.date || todayIso();
  els["image-alt-input"].value = recipe.imageAlt || "";
  els["instagram-input"].value = recipe.instagramUrl || "";
  els["body-input"].value = recipe.body || "";
  els["image-input"].value = "";
  els["current-image"].innerHTML = recipe.image
    ? `<img class="thumb-preview" src="${recipe.image}" onerror="this.remove()" alt="">`
    : "";
  els["delete-btn"].hidden = false;
  updatePreview();
  setStatus(els["save-status"], "");
}

function updatePreview() {
  els["body-preview"].innerHTML = marked.parse(els["body-input"].value || "");
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleImageChange(e) {
  const file = e.target.files[0];
  if (!file) {
    selectedImageFile = null;
    return;
  }
  const base64 = await readFileAsBase64(file);
  selectedImageFile = { name: file.name, base64 };
}

async function handleSave(e) {
  e.preventDefault();
  const title = els["title-input"].value.trim();
  const date = els["date-input"].value;
  if (!title || !date) {
    setStatus(els["save-status"], "Title and date are required.", "error");
    return;
  }

  els["save-btn"].disabled = true;
  setStatus(els["save-status"], "Saving…");
  try {
    const editingSlug = els["recipe-select"].value || null;
    const baseSlug = slugify(title);
    const slug = editingSlug || uniqueSlug(baseSlug, recipesCache.list, editingSlug);

    const existing = recipesCache.list.find((r) => r.slug === slug);
    let imagePath = existing ? existing.image : "";

    if (selectedImageFile) {
      imagePath = `images/${slug}/${selectedImageFile.name}`;
      const sha = await GitHubRepo.getFileSha(imagePath);
      await GitHubRepo.putBinaryFile(
        imagePath,
        selectedImageFile.base64,
        `Add image for ${title}`,
        sha
      );
    }

    const updatedRecipe = {
      slug,
      title,
      date,
      image: imagePath,
      imageAlt: els["image-alt-input"].value.trim(),
      instagramUrl: els["instagram-input"].value.trim(),
      body: els["body-input"].value,
    };

    // Refetch recipes.json right before writing, to minimise the chance
    // of clobbering a change made from another tab/session.
    const latest = await GitHubRepo.getTextFile(RECIPES_PATH);
    const list = latest ? JSON.parse(latest.text) : [];
    const idx = list.findIndex((r) => r.slug === slug);
    if (idx >= 0) list[idx] = updatedRecipe;
    else list.push(updatedRecipe);
    list.sort((a, b) => (a.date < b.date ? 1 : -1));

    await GitHubRepo.putTextFile(
      RECIPES_PATH,
      `${JSON.stringify(list, null, 2)}\n`,
      `${existing ? "Update" : "Add"} recipe: ${title}`,
      latest ? latest.sha : undefined
    );

    setStatus(els["save-status"], "Saved.", "success");
    await refreshRecipeList();
    els["recipe-select"].value = slug;
    loadRecipeIntoForm(slug);
  } catch (err) {
    setStatus(els["save-status"], `Save failed: ${err.message}`, "error");
  } finally {
    els["save-btn"].disabled = false;
  }
}

async function handleDelete() {
  const slug = els["recipe-select"].value;
  if (!slug) return;
  const recipe = recipesCache.list.find((r) => r.slug === slug);
  if (!recipe) return;
  if (!window.confirm(`Delete "${recipe.title}"? This cannot be undone.`)) return;

  els["delete-btn"].disabled = true;
  setStatus(els["save-status"], "Deleting…");
  try {
    const latest = await GitHubRepo.getTextFile(RECIPES_PATH);
    const list = (latest ? JSON.parse(latest.text) : []).filter((r) => r.slug !== slug);
    await GitHubRepo.putTextFile(
      RECIPES_PATH,
      `${JSON.stringify(list, null, 2)}\n`,
      `Delete recipe: ${recipe.title}`,
      latest ? latest.sha : undefined
    );
    setStatus(els["save-status"], "Deleted.", "success");
    await refreshRecipeList();
    resetForm();
  } catch (err) {
    setStatus(els["save-status"], `Delete failed: ${err.message}`, "error");
  } finally {
    els["delete-btn"].disabled = false;
  }
}

function initAdmin() {
  cacheEls();
  els["login-btn"].addEventListener("click", handleLogin);
  els["logout-btn"].addEventListener("click", handleLogout);
  els["new-recipe-btn"].addEventListener("click", resetForm);
  els["recipe-select"].addEventListener("change", (e) => loadRecipeIntoForm(e.target.value));
  els["recipe-form"].addEventListener("submit", handleSave);
  els["delete-btn"].addEventListener("click", handleDelete);
  els["image-input"].addEventListener("change", handleImageChange);
  els["body-input"].addEventListener("input", updatePreview);
  els["date-input"].value = todayIso();
  tryAutoLogin();
}

document.addEventListener("DOMContentLoaded", initAdmin);
