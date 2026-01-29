const { getStore } = require("@netlify/blobs");

const BLOB_STORE = "cjcp-links";
const BLOB_KEY = "data";

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

module.exports = async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return new Response(JSON.stringify({ error: "Admin not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { key, links: rawLinks } = body;
  if (key !== adminKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const links = normalizeLinks(rawLinks);
  const updatedAt = new Date().toISOString();
  const data = { links, updatedAt };

  const store = getStore({ name: BLOB_STORE, consistency: "strong" });
  await store.setJSON(BLOB_KEY, data);

  return new Response(
    JSON.stringify({ ok: true, updatedAt }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
