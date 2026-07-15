/*
 * Shared like/love counts per recipe, view-only-page feature.
 *
 * There's no backend in this project, and reaction counts need to be
 * visible to every visitor (not just stored in one browser) - that
 * requires *some* shared place to hold a number. This uses Firestore's
 * plain REST API directly (no SDK download) so every visitor's browser
 * can read/increment a small "reactions" document per recipe. Security
 * is enforced entirely by Firestore Rules (see README): writes are only
 * ever allowed to increment likes/loves by exactly 1, nothing else.
 *
 * FIRESTORE_CONFIG.projectId/apiKey are public identifiers, not secrets -
 * Firebase's security model relies on Firestore Rules, not on hiding
 * these values. Fill them in after creating a free Firebase project
 * (see README "Setting up reactions (Firestore)").
 */
const FIRESTORE_CONFIG = {
  projectId: "", // e.g. "yukans-recipes-12345"
  apiKey: "", // Firebase "Web API Key" from the same project
};

function firestoreDocUrl(slug) {
  return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_CONFIG.projectId}/databases/(default)/documents/reactions/${encodeURIComponent(slug)}?key=${FIRESTORE_CONFIG.apiKey}`;
}

function firestoreCommitUrl() {
  return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_CONFIG.projectId}/databases/(default)/documents:commit?key=${FIRESTORE_CONFIG.apiKey}`;
}

async function fetchReactionCounts(slug) {
  const res = await fetch(firestoreDocUrl(slug));
  if (res.status === 404) return { likes: 0, loves: 0 };
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const data = await res.json();
  const fields = data.fields || {};
  return {
    likes: parseInt((fields.likes && fields.likes.integerValue) || "0", 10),
    loves: parseInt((fields.loves && fields.loves.integerValue) || "0", 10),
  };
}

// Atomically increments one field by 1, creating the document if it
// doesn't exist yet. An empty `update` + `updateMask` means "don't touch
// any regular fields"; the accompanying updateTransforms increment is
// what actually creates/bumps the field (base value defaults to 0 if the
// document or field doesn't exist yet).
async function incrementReactionField(slug, field) {
  const docName = `projects/${FIRESTORE_CONFIG.projectId}/databases/(default)/documents/reactions/${slug}`;
  const res = await fetch(firestoreCommitUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [
        {
          update: { name: docName, fields: {} },
          updateMask: { fieldPaths: [] },
          updateTransforms: [{ fieldPath: field, increment: { integerValue: "1" } }],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
}

function reactedKey(slug, kind) {
  return `yukansRecipesReacted:${slug}:${kind}`;
}

function hasReacted(slug, kind) {
  return localStorage.getItem(reactedKey(slug, kind)) === "1";
}

function markReacted(slug, kind) {
  localStorage.setItem(reactedKey(slug, kind), "1");
}

// Renders the like/love buttons + counts into `container` for the given
// recipe slug, and wires up click handling. No-ops quietly (renders
// nothing) if FIRESTORE_CONFIG hasn't been filled in yet, so the recipe
// page still works fine before that one-time setup is done.
async function initReactions(slug, container) {
  if (!container) return;
  if (!FIRESTORE_CONFIG.projectId || !FIRESTORE_CONFIG.apiKey) {
    container.hidden = true;
    return;
  }

  container.innerHTML = `
    <button class="reaction-btn" data-kind="likes" type="button" aria-label="Like this recipe">
      <span class="reaction-emoji">&#128077;</span>
      <span class="reaction-count" data-kind="likes">&hellip;</span>
    </button>
    <button class="reaction-btn" data-kind="loves" type="button" aria-label="Love this recipe">
      <span class="reaction-emoji">&#10084;&#65039;</span>
      <span class="reaction-count" data-kind="loves">&hellip;</span>
    </button>
  `;

  const buttons = container.querySelectorAll(".reaction-btn");
  const countEls = {
    likes: container.querySelector('.reaction-count[data-kind="likes"]'),
    loves: container.querySelector('.reaction-count[data-kind="loves"]'),
  };

  function paintReactedState() {
    buttons.forEach((btn) => {
      const kind = btn.dataset.kind;
      btn.classList.toggle("is-reacted", hasReacted(slug, kind));
      btn.disabled = hasReacted(slug, kind);
    });
  }

  try {
    const counts = await fetchReactionCounts(slug);
    countEls.likes.textContent = counts.likes;
    countEls.loves.textContent = counts.loves;
  } catch (err) {
    container.innerHTML = '<p class="state-message is-error">Couldn\'t load reactions.</p>';
    return;
  }

  paintReactedState();

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const kind = btn.dataset.kind;
      if (hasReacted(slug, kind) || btn.disabled) return;

      btn.disabled = true;
      const countEl = countEls[kind];
      const previous = parseInt(countEl.textContent, 10) || 0;
      countEl.textContent = previous + 1; // optimistic update
      markReacted(slug, kind);
      btn.classList.add("is-reacted");

      try {
        await incrementReactionField(slug, kind);
      } catch (err) {
        // Roll back on failure so the count stays honest.
        countEl.textContent = previous;
        localStorage.removeItem(reactedKey(slug, kind));
        btn.classList.remove("is-reacted");
        btn.disabled = false;
      }
    });
  });
}
