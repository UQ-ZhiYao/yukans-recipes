/*
 * Admin pathway (edit only). Everything here talks to the GitHub Contents
 * API via GitHubRepo (assets/js/github-api.js) using a token the admin
 * pastes in once. This page never renders the public site — it only ever
 * shows forms for creating/editing/deleting recipes.
 */
const RECIPES_PATH = "data/recipes.json";
const IMAGE_MAIN_MAX_DIM = 1600;
const IMAGE_MAIN_QUALITY = 0.82;
const IMAGE_THUMB_MAX_DIM = 480;
const IMAGE_THUMB_QUALITY = 0.78;

const els = {};
let recipesCache = null; // { list, sha }
let selectedImageFile = null; // { mainName, thumbName, mainBase64, thumbBase64 }

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
    "install-btn",
    "recipe-select",
    "delete-btn",
    "recipe-form",
    "title-input",
    "date-input",
    "image-input",
    "remove-image-btn",
    "image-alt-input",
    "instagram-input",
    "body-input",
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
  els["logout-btn"].hidden = false;
  setStatus(els["login-status"], "");
  await refreshRecipeList();
  resetForm();
}

function handleLogout() {
  GitHubRepo.clearToken();
  recipesCache = null;
  els["editor-panel"].hidden = true;
  els["login-panel"].hidden = false;
  els["logout-btn"].hidden = true;
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
  els["body-input"].innerHTML = ""; // not a form control, .reset() doesn't touch it
  selectedImageFile = null;
  els["current-image"].innerHTML = "";
  els["remove-image-btn"].hidden = true;
  els["delete-btn"].hidden = true;
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
  // recipe.body may be plain Markdown (older recipes) or HTML (already
  // saved by this rich text editor) - marked.parse() passes well-formed
  // HTML straight through unchanged, so this line handles both uniformly.
  els["body-input"].innerHTML = marked.parse(recipe.body || "");
  els["image-input"].value = "";
  // recipe.image is stored repo-root-relative (for the public site, which
  // lives at the repo root); this admin page lives one level down at
  // /admin/, so the preview needs a "../" prefix to resolve to the same file.
  els["current-image"].innerHTML = recipe.image
    ? `<img class="thumb-preview" src="../${recipe.image}" onerror="this.remove()" alt="">`
    : "";
  els["remove-image-btn"].hidden = !recipe.image;
  els["delete-btn"].hidden = false;
  setStatus(els["save-status"], "");
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Downscales an uploaded photo to `maxDim` on its long edge and re-encodes it
// as JPEG, so a multi-megabyte camera photo doesn't get shipped to every
// visitor of the (much smaller) rendered image. Runs entirely client-side —
// there's no server to do this for us.
async function resizeImageToBase64(file, maxDim, quality) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blobToBase64(blob);
}

async function handleImageChange(e) {
  const file = e.target.files[0];
  if (!file) {
    selectedImageFile = null;
    return;
  }
  setStatus(els["save-status"], "Processing image…");
  try {
    const [mainBase64, thumbBase64] = await Promise.all([
      resizeImageToBase64(file, IMAGE_MAIN_MAX_DIM, IMAGE_MAIN_QUALITY),
      resizeImageToBase64(file, IMAGE_THUMB_MAX_DIM, IMAGE_THUMB_QUALITY),
    ]);
    const baseName = (file.name.replace(/\.[^./]+$/, "") || "image").toLowerCase();
    selectedImageFile = {
      mainName: `${baseName}.jpg`,
      thumbName: `${baseName}_thumb.jpg`,
      mainBase64,
      thumbBase64,
    };
    els["current-image"].innerHTML = `<img class="thumb-preview" src="data:image/jpeg;base64,${mainBase64}" alt="">`;
    els["remove-image-btn"].hidden = false;
    setStatus(els["save-status"], "");
  } catch (err) {
    selectedImageFile = null;
    setStatus(els["save-status"], `Couldn't process image: ${err.message}`, "error");
  }
}

async function handleRemoveImage() {
  const slug = els["recipe-select"].value;
  const recipe = slug ? recipesCache.list.find((r) => r.slug === slug) : null;

  // A locally-picked file that hasn't been saved yet just gets un-picked,
  // no repo changes needed.
  if (!recipe || !recipe.image) {
    selectedImageFile = null;
    els["image-input"].value = "";
    els["current-image"].innerHTML = "";
    els["remove-image-btn"].hidden = true;
    return;
  }

  if (!window.confirm("Remove this recipe's image? The file will be deleted from the repo.")) return;

  els["remove-image-btn"].disabled = true;
  setStatus(els["save-status"], "Removing image…");
  try {
    for (const path of [recipe.image, recipe.thumbnail]) {
      if (!path) continue;
      const sha = await GitHubRepo.getFileSha(path);
      if (sha) {
        await GitHubRepo.deleteFile(path, `Remove image for ${recipe.title}`, sha);
      }
    }

    const latest = await GitHubRepo.getTextFile(RECIPES_PATH);
    const list = latest ? JSON.parse(latest.text) : [];
    const idx = list.findIndex((r) => r.slug === slug);
    if (idx >= 0) {
      list[idx].image = "";
      list[idx].thumbnail = "";
      list[idx].imageAlt = "";
    }
    await GitHubRepo.putTextFile(
      RECIPES_PATH,
      `${JSON.stringify(list, null, 2)}\n`,
      `Remove image for ${recipe.title}`,
      latest ? latest.sha : undefined
    );

    setStatus(els["save-status"], "Image removed.", "success");
    await refreshRecipeList();
    els["recipe-select"].value = slug;
    loadRecipeIntoForm(slug);
  } catch (err) {
    setStatus(els["save-status"], `Remove failed: ${err.message}`, "error");
  } finally {
    els["remove-image-btn"].disabled = false;
  }
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
    let thumbnailPath = existing ? existing.thumbnail : "";

    if (selectedImageFile) {
      imagePath = `images/${slug}/${selectedImageFile.mainName}`;
      thumbnailPath = `images/${slug}/${selectedImageFile.thumbName}`;
      const [mainSha, thumbSha] = await Promise.all([
        GitHubRepo.getFileSha(imagePath),
        GitHubRepo.getFileSha(thumbnailPath),
      ]);
      await GitHubRepo.putBinaryFile(imagePath, selectedImageFile.mainBase64, `Add image for ${title}`, mainSha);
      await GitHubRepo.putBinaryFile(
        thumbnailPath,
        selectedImageFile.thumbBase64,
        `Add thumbnail for ${title}`,
        thumbSha
      );
    }

    const updatedRecipe = {
      slug,
      title,
      date,
      image: imagePath,
      thumbnail: thumbnailPath,
      imageAlt: els["image-alt-input"].value.trim(),
      instagramUrl: els["instagram-input"].value.trim(),
      body: els["body-input"].innerHTML,
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

// Rich text toolbar for the recipe body. Uses the browser's built-in
// execCommand editing commands - deprecated from the spec, but still the
// only cross-browser way to do basic contenteditable formatting (bold,
// underline, font size, lists, ...) without pulling in a whole editor
// library for what's otherwise a plain HTML/CSS/JS project.
function initRichEditor() {
  const editor = els["body-input"];
  const toolbar = document.querySelector(".editor-toolbar");
  if (!editor || !toolbar) return;

  let savedRange = null;

  function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0);
    }
  }

  function restoreSelection() {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  editor.addEventListener("keyup", saveSelection);
  editor.addEventListener("mouseup", saveSelection);

  function updateActiveStates() {
    toolbar.querySelectorAll(".toolbar-btn[data-cmd]").forEach((btn) => {
      let active = false;
      try {
        active = document.queryCommandState(btn.dataset.cmd);
      } catch (err) {
        active = false;
      }
      btn.classList.toggle("is-active", active);
    });
  }

  editor.addEventListener("keyup", updateActiveStates);
  editor.addEventListener("mouseup", updateActiveStates);
  editor.addEventListener("focus", updateActiveStates);

  toolbar.querySelectorAll(".toolbar-btn[data-cmd]").forEach((btn) => {
    // mousedown (not click) + preventDefault stops the button from
    // stealing focus/collapsing the editor's text selection before the
    // command runs.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      editor.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      updateActiveStates();
    });
  });

  const blockSelect = document.getElementById("block-format-select");
  blockSelect.addEventListener("mousedown", saveSelection);
  blockSelect.addEventListener("change", () => {
    editor.focus();
    restoreSelection();
    document.execCommand("formatBlock", false, blockSelect.value);
    blockSelect.blur();
  });

  const fontSizeSelect = document.getElementById("font-size-select");
  fontSizeSelect.addEventListener("mousedown", saveSelection);
  fontSizeSelect.addEventListener("change", () => {
    editor.focus();
    restoreSelection();
    document.execCommand("fontSize", false, fontSizeSelect.value);
    fontSizeSelect.blur();
  });

  const linkBtn = document.getElementById("toolbar-link-btn");
  linkBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  linkBtn.addEventListener("click", () => {
    editor.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      window.alert("Select some text first, then click the link button.");
      return;
    }
    const url = window.prompt("Link URL:", "https://");
    if (url) document.execCommand("createLink", false, url);
  });
}

let deferredInstallPrompt = null;

function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    els["install-btn"].hidden = false;
  });

  els["install-btn"].addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els["install-btn"].hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    els["install-btn"].hidden = true;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* offline install support is a nice-to-have, not required for the app to work */
  });
}

function initAdmin() {
  cacheEls();
  els["login-btn"].addEventListener("click", handleLogin);
  els["logout-btn"].addEventListener("click", handleLogout);
  els["recipe-select"].addEventListener("change", (e) => loadRecipeIntoForm(e.target.value));
  els["recipe-form"].addEventListener("submit", handleSave);
  els["delete-btn"].addEventListener("click", handleDelete);
  els["image-input"].addEventListener("change", handleImageChange);
  els["remove-image-btn"].addEventListener("click", handleRemoveImage);
  els["date-input"].value = todayIso();
  initRichEditor();
  initInstallPrompt();
  registerServiceWorker();
  tryAutoLogin();
}

document.addEventListener("DOMContentLoaded", initAdmin);
