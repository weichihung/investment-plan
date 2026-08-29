import { buildMarketSnapshot } from "./market.js";

const CACHE_SECONDS = 300;

function corsOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "https://weichihung.github.io")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return allowed[0] || "https://weichihung.github.io";
}

function jsonResponse(request, env, value, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": corsOrigin(request, env),
      Vary: "Origin"
    }
  });
}

async function freshSnapshot(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/__investment_market_cache_v1", request.url), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return jsonResponse(request, env, await cached.json(), 200, `public, max-age=${CACHE_SECONDS}`);

  const snapshot = await buildMarketSnapshot();
  if (env.MARKET_KV) {
    ctx.waitUntil(env.MARKET_KV.put("latest", JSON.stringify(snapshot)));
  }
  const cacheResponse = new Response(JSON.stringify(snapshot), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_SECONDS}` }
  });
  ctx.waitUntil(cache.put(cacheKey, cacheResponse));
  return jsonResponse(request, env, snapshot, 200, `public, max-age=${CACHE_SECONDS}`);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin(request, env),
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin"
        }
      });
    }
    if (request.method !== "GET") return jsonResponse(request, env, { error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return jsonResponse(request, env, { service: "investment-plan-market-api", status: "ok" });
      }
      if (url.pathname === "/market/latest" && env.MARKET_KV) {
        const stored = await env.MARKET_KV.get("latest", "json");
        if (stored) return jsonResponse(request, env, stored, 200, "public, max-age=60");
      }
      if (url.pathname === "/market/latest" || url.pathname === "/market/refresh") {
        return await freshSnapshot(request, env, ctx);
      }
      return jsonResponse(request, env, { error: "Not found" }, 404);
    } catch (error) {
      return jsonResponse(request, env, { error: error.message || "Market refresh failed" }, 502);
    }
  }
};

