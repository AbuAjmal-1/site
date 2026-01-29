const { getStore } = require("@netlify/blobs");

const BLOB_STORE = "cjcp-links";
const BLOB_KEY = "data";
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_VOTES = 20;

function getClientIp(req, context) {
  return context.ip || req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function getData(store) {
  const raw = await store.get(BLOB_KEY, { type: "json" });
  if (!raw) return { links: [], updatedAt: null };
  return {
    links: Array.isArray(raw.links) ? raw.links : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

async function checkRateLimit(store, ip) {
  const key = `ratelimit:${ip.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const raw = await store.get(key, { type: "json" });
  const now = Date.now();
  if (!raw) return { allowed: true, count: 1, windowStart: now };
  let { count, windowStart } = raw;
  if (now - windowStart > RATE_WINDOW_MS) {
    count = 0;
    windowStart = now;
  }
  count += 1;
  if (count > RATE_MAX_VOTES) return { allowed: false };
  await store.setJSON(key, { count, windowStart });
  return { allowed: true };
}

module.exports = async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { id, vote } = body;
  if (!id || (vote !== "up" && vote !== "down")) {
    return new Response(JSON.stringify({ error: "Missing id or vote (up/down)" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const store = getStore({ name: BLOB_STORE, consistency: "strong" });
  const ip = getClientIp(req, context);
  const rate = await checkRateLimit(store, ip);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: "Too many votes. Try again later." }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  const data = await getData(store);
  const link = data.links.find((l) => l.id === id);
  if (!link) {
    return new Response(JSON.stringify({ error: "Link not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const up = (link.up ?? 0) + (vote === "up" ? 1 : 0);
  const down = (link.down ?? 0) + (vote === "down" ? 1 : 0);
  link.up = up;
  link.down = down;
  const updatedAt = new Date().toISOString();
  data.updatedAt = updatedAt;

  await store.setJSON(BLOB_KEY, data);

  return new Response(
    JSON.stringify({ id, up, down }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
