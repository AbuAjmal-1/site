const { connectLambda, getStore } = require("@netlify/blobs");

const BLOB_STORE = "cjcp-links";
const BLOB_KEY = "data";
const HEADERS = { "Content-Type": "application/json" };

async function getData(store) {
  const raw = await store.get(BLOB_KEY, { type: "json" });
  if (!raw) {
    return { links: [], updatedAt: null };
  }
  const links = Array.isArray(raw.links) ? raw.links : [];
  const updatedAt = raw.updatedAt ?? null;
  return { links, updatedAt };
}

exports.handler = async function (event, context) {
  connectLambda(event);
  const store = getStore({ name: BLOB_STORE });
  const data = await getData(store);
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify(data),
  };
};
