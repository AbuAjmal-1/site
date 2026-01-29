const { connectLambda, getStore } = require("@netlify/blobs");

const BLOB_STORE = "cjcp-links";
const BLOB_KEY = "data";
const HEADERS = { "Content-Type": "application/json" };

function json(statusCode, data) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(data) };
}

function generateId() {
  return "link-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.map((l) => ({
    id: l.id && String(l.id).trim() ? String(l.id) : generateId(),
    url: typeof l.url === "string" ? l.url.trim() : "",
    label: typeof l.label === "string" ? l.label.trim() : (l.url || "").trim(),
    up: typeof l.up === "number" && l.up >= 0 ? l.up : 0,
    down: typeof l.down === "number" && l.down >= 0 ? l.down : 0,
  })).filter((l) => l.url);
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const adminKey = process.env.ADMIN_KEY || process.env.DEV_ACCESS_KEY;
  if (!adminKey) {
    return json(500, {
      error: "Admin key not set. In Netlify: Site settings → Environment variables → add ADMIN_KEY or DEV_ACCESS_KEY with scope 'Functions' (or 'All'), then redeploy.",
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { key, links: rawLinks, verify } = body;
  if (key !== adminKey) {
    return json(401, { error: "Unauthorized" });
  }

  if (verify === true) {
    return json(200, { ok: true });
  }

  const links = normalizeLinks(rawLinks);
  const updatedAt = new Date().toISOString();
  const data = { links, updatedAt };

  try {
    connectLambda(event);
    const store = getStore({ name: BLOB_STORE, consistency: "strong" });
    await store.setJSON(BLOB_KEY, data);
  } catch (err) {
    console.error("adminUpdate blob write failed:", err);
    return json(500, { error: "Failed to save: " + (err.message || "storage error") });
  }

  return json(200, { ok: true, updatedAt });
};
