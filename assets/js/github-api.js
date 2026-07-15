/*
 * Thin wrapper around the GitHub Contents API used by the Admin pathway.
 * The Admin page is the only thing that ever imports this file — the
 * public (view-only) pages never touch the GitHub API or the token.
 */
const GitHubRepo = (() => {
  const OWNER = "uq-zhiyao";
  const REPO = "yukans-recipes";
  const BRANCH = "main";
  const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const TOKEN_KEY = "yukansRecipesAdminToken";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token.trim());
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  function base64ToUtf8(base64) {
    const binary = atob(base64.replace(/\n/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function request(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error("No GitHub token set. Please log in first.");
    const res = await fetch(`${API_BASE}/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json()).message || "";
      } catch (_) {
        /* ignore */
      }
      throw new Error(`GitHub API ${res.status}: ${detail || res.statusText}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // Verifies the token can read repo contents.
  async function verifyToken() {
    return request(`contents/README.md?ref=${BRANCH}`);
  }

  // Returns { text, sha } for a text file, or null if it doesn't exist yet.
  async function getTextFile(path) {
    try {
      const data = await request(`contents/${path}?ref=${BRANCH}`);
      return { text: base64ToUtf8(data.content), sha: data.sha };
    } catch (err) {
      if (String(err.message).includes("404")) return null;
      throw err;
    }
  }

  // Creates or updates a text file. Pass the previous sha when updating.
  async function putTextFile(path, text, message, sha) {
    return request(`contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: utf8ToBase64(text),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  // Creates or updates a binary file from a base64 data URL (e.g. an <input type="file"> read via FileReader).
  async function putBinaryFile(path, base64Content, message, sha) {
    return request(`contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  async function getFileSha(path) {
    try {
      const data = await request(`contents/${path}?ref=${BRANCH}`);
      return data.sha;
    } catch (err) {
      if (String(err.message).includes("404")) return null;
      throw err;
    }
  }

  return {
    OWNER,
    REPO,
    BRANCH,
    getToken,
    setToken,
    clearToken,
    verifyToken,
    getTextFile,
    putTextFile,
    putBinaryFile,
    getFileSha,
  };
})();
