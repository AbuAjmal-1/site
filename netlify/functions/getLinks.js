const { getStore } = require("@netlify/blobs");

const BLOB_STORE = "cjcp-links";
const BLOB_KEY = "data";

async function getData(store) {
  const raw = await store.get(BLOB_KEY, { type: "json" });
  if (!raw) {
    return { links: [], updatedAt: null };
  }
  const links = Array.isArray(raw.links) ? raw.links : [];
  const updatedAt = raw.updatedAt ?? null;
  return { links, updatedAt };
}

module.exports = async (req, context) => {
  const store = getStore({ name: BLOB_STORE, consistency: "strong" });
  const data = await getData(store);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
