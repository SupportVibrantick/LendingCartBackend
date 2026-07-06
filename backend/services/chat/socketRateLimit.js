const SOCKET_RATE_LIMITS = {
  sendMessage: { max: 30, windowMs: 60_000 },
  joinConversation: { max: 60, windowMs: 60_000 },
  markAsRead: { max: 120, windowMs: 60_000 },
};

const buckets = new Map();

function checkSocketRateLimit(socketId, event, limits = SOCKET_RATE_LIMITS[event]) {
  if (!limits) {
    return { allowed: true };
  }

  const key = `${socketId}:${event}`;
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + limits.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > limits.max) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    };
  }

  return { allowed: true, remaining: limits.max - bucket.count };
}

function clearSocketRateLimits(socketId) {
  for (const key of buckets.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      buckets.delete(key);
    }
  }
}

module.exports = {
  SOCKET_RATE_LIMITS,
  checkSocketRateLimit,
  clearSocketRateLimits,
};
