const buckets = new Map();

/**
 * Simple in-memory rate limiter (per-process).
 * @param {string} key
 * @param {{ windowMs?: number, max?: number }} options
 */
function checkRateLimit(key, options = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? 5;
  const now = Date.now();

  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, max - entry.count),
  };
}

function getClientIp(request) {
  // request.ip is reliable when Fastify is created with trustProxy: true.
  // Fall back to common proxy headers explicitly for environments where
  // trustProxy cannot be enabled but we still need the real client IP.
  const forwarded =
    (Array.isArray(request.headers?.["x-forwarded-for"])
      ? request.headers["x-forwarded-for"][0]
      : request.headers?.["x-forwarded-for"]) || "";
  const realIp =
    (Array.isArray(request.headers?.["x-real-ip"])
      ? request.headers["x-real-ip"][0]
      : request.headers?.["x-real-ip"]) || "";
  const cfIp =
    (Array.isArray(request.headers?.["cf-connecting-ip"])
      ? request.headers["cf-connecting-ip"][0]
      : request.headers?.["cf-connecting-ip"]) || "";

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  if (typeof cfIp === "string" && cfIp.trim()) {
    return cfIp.trim();
  }
  return request.ip || request.socket?.remoteAddress || "unknown";
}

module.exports = {
  checkRateLimit,
  getClientIp,
};
