const { getStore } = require("@netlify/blobs");

const BLOB_STORE = "cjcp-links";
const BLOB_KEY = "data";
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_VOTES = 20;
const HEADERS = { "Content-Type": "application/json" };

function json(statusCode, data) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(data) };
}

function getClientIp(event) {
  const h = event.headers || {};
  const forwarded = h["x-forwarded-for"] || h["X-Forwarded-For"];
  if (forwarded) {
    const first = typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded[0];
    if (first) return first.trim();
  }
  return h["x-nf-client-connection-ip"] || h["X-Nf-Client-Connection-Ip"] || "unknown";
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
  const key = "ratelimit:" + String(ip).replace(/[^a-zA-Z0-9.-]/g, "_");
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

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { id, vote } = body;
  if (!id || (vote !== "up" && vote !== "down")) {
    return json(400, { error: "Missing id or vote (up/down)" });
  }

  const store = getStore({ name: BLOB_STORE, consistency: "strong" });
  const ip = getClientIp(event);
  const rate = await checkRateLimit(store, ip);
  if (!rate.allowed) {
    return json(429, { error: "Too many votes. Try again later." });
  }

  const data = await getData(store);
  const link = data.links.find((l) => l.id === id);
  if (!link) {
    return json(404, { error: "Link not found" });
  }

  const up = (link.up ?? 0) + (vote === "up" ? 1 : 0);
  const down = (link.down ?? 0) + (vote === "down" ? 1 : 0);
  link.up = up;
  link.down = down;
  data.updatedAt = new Date().toISOString();

  await store.setJSON(BLOB_KEY, data);

  return json(200, { id, up, down });
};
