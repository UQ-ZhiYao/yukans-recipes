/*
 * Shared like/love counts per recipe, view-only-page feature.
 *
 * There's no backend in this project, and GitHub has no public API for
 * anonymously incrementing an arbitrary counter - the only thing GitHub
 * itself lets any visitor react to is an Issue (or PR/Discussion), and
 * only if they have a GitHub account. So each recipe has a companion
 * GitHub Issue (see data/recipes.json's `issueNumber`), and this reads
 * that issue's native reaction counts through GitHub's public REST API
 * (no auth, no token, works for anyone viewing the page) and links out
 * to the issue itself for actually reacting.
 *
 * GitHub's own +1/heart reactions map directly to Like/Love, and GitHub
 * enforces one reaction of each kind per account - no localStorage
 * tracking needed here, unlike a build-it-yourself counter.
 */
const REACTIONS_REPO = "uq-zhiyao/yukans-recipes";

async function fetchIssueReactionCounts(issueNumber) {
  const res = await fetch(`https://api.github.com/repos/${REACTIONS_REPO}/issues/${issueNumber}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  const reactions = data.reactions || {};
  return { likes: reactions["+1"] || 0, loves: reactions.heart || 0 };
}

// Renders the like/love counts + a "React on GitHub" link into `container`
// for the given recipe. No-ops quietly (hides the section) if this recipe
// has no companion issue yet, so older/test recipes don't show a broken
// widget.
async function initReactions(recipe, container) {
  if (!container) return;
  if (!recipe.issueNumber) {
    container.hidden = true;
    return;
  }

  const issueUrl = `https://github.com/${REACTIONS_REPO}/issues/${recipe.issueNumber}`;

  container.innerHTML = `
    <span class="reaction-pill" data-kind="likes">
      <span class="reaction-emoji">&#128077;</span>
      <span class="reaction-count" data-kind="likes">&hellip;</span>
    </span>
    <span class="reaction-pill" data-kind="loves">
      <span class="reaction-emoji">&#10084;&#65039;</span>
      <span class="reaction-count" data-kind="loves">&hellip;</span>
    </span>
    <a class="reaction-link" href="${issueUrl}" target="_blank" rel="noopener">React on GitHub &#8599;</a>
    <button class="reaction-refresh" type="button" title="Refresh counts" aria-label="Refresh reaction counts">&#8635;</button>
  `;

  const countEls = {
    likes: container.querySelector('.reaction-count[data-kind="likes"]'),
    loves: container.querySelector('.reaction-count[data-kind="loves"]'),
  };
  const refreshBtn = container.querySelector(".reaction-refresh");

  async function loadCounts() {
    try {
      const counts = await fetchIssueReactionCounts(recipe.issueNumber);
      countEls.likes.textContent = counts.likes;
      countEls.loves.textContent = counts.loves;
    } catch (err) {
      countEls.likes.textContent = "?";
      countEls.loves.textContent = "?";
    }
  }

  refreshBtn.addEventListener("click", () => loadCounts());

  await loadCounts();
}
