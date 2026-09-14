const { isRedisEnabled, getRedisUrl, isProduction } = require("../config/env");
const { commonLogs } = require("../services/logger/contextLogger");
const { Redis } = require("ioredis");

let redisClients = null;
let sharedRedisClient = null;
let rateLimitRedisClient = null;

function buildRedisOptions(overrides = {}) {
  return {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    lazyConnect: true,
    retryStrategy: () => null,
    ...overrides,
  };
}

async function connectAndPing(client, label) {
  if (client.status !== "ready") {
    await client.connect();
  }
  await Promise.race([
    client.ping(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} Redis ping timeout (3s)`)), 3000),
    ),
  ]);
}

async function getSharedRedisClient() {
  if (sharedRedisClient) return sharedRedisClient;

  if (!isRedisEnabled()) {
    return null;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    commonLogs.warn("REDIS_URL is missing — shared Redis client unavailable");
    return null;
  }

  try {
    sharedRedisClient = new Redis(redisUrl, buildRedisOptions({ maxRetriesPerRequest: null }));
    await connectAndPing(sharedRedisClient, "shared");
    return sharedRedisClient;
  } catch (error) {
    commonLogs.error("Failed to create shared Redis client", {
      error: error.message,
    });
    try {
      sharedRedisClient?.disconnect?.();
    } catch {
      /* ignore */
    }
    sharedRedisClient = null;
    if (isProduction()) {
      throw new Error(
        `CRITICAL: Shared Redis client failed in production: ${error.message}`,
      );
    }
    return null;
  }
}

/**
 * Dedicated ioredis client for @fastify/rate-limit (recommended settings).
 * Returns null when Redis is disabled (local/dev in-memory fallback).
 */
function getRateLimitRedisClient() {
  if (rateLimitRedisClient) return rateLimitRedisClient;

  if (!isRedisEnabled()) {
    return null;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  rateLimitRedisClient = new Redis(redisUrl, {
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  rateLimitRedisClient.on("error", (error) => {
    commonLogs.error("Rate-limit Redis client error", {
      error: error.message,
    });
  });

  return rateLimitRedisClient;
}

async function attachRedisAdapter(io) {
  if (!isRedisEnabled()) {
    if (isProduction()) {
      throw new Error(
        "REDIS_ENABLED must be true in production to support multi-instance Socket.IO",
      );
    }
    commonLogs.info("Socket.IO Redis adapter disabled");
    return false;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    if (isProduction()) {
      throw new Error(
        "REDIS_URL is missing in production — required for Socket.IO adapter",
      );
    }
    commonLogs.warn(
      "REDIS_ENABLED=true but REDIS_URL is missing — using in-memory Socket.IO adapter",
    );
    return false;
  }

  let pubClient = null;
  let subClient = null;

  try {
    const { createAdapter } = require("@socket.io/redis-adapter");

    pubClient = new Redis(redisUrl, buildRedisOptions());
    subClient = pubClient.duplicate();

    pubClient.on("error", (error) => {
      commonLogs.error("Socket Redis pub client error", {
        error: error.message,
      });
    });
    subClient.on("error", (error) => {
      commonLogs.error("Socket Redis sub client error", {
        error: error.message,
      });
    });

    await Promise.race([
      (async () => {
        if (pubClient.status !== "ready") {
          await pubClient.connect();
        }
        if (subClient.status !== "ready") {
          await subClient.connect();
        }
        await pubClient.ping();
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Redis connect timeout (3s)")),
          3000,
        ),
      ),
    ]);

    io.adapter(createAdapter(pubClient, subClient));
    redisClients = { pubClient, subClient };

    commonLogs.info("Socket.IO Redis adapter enabled");
    console.log("Socket.IO Redis adapter enabled");
    return true;
  } catch (error) {
    if (isProduction()) {
      throw new Error(
        `CRITICAL: Failed to initialize Socket.IO Redis adapter in production: ${error.message}`,
      );
    }

    commonLogs.error(
      "Failed to initialize Socket.IO Redis adapter — falling back to in-memory adapter",
      { error: error.message },
    );
    console.warn(
      "Socket.IO Redis adapter unavailable, using in-memory adapter:",
      error.message,
    );

    try {
      await pubClient?.quit?.();
    } catch {
      /* ignore */
    }
    try {
      await subClient?.quit?.();
    } catch {
      /* ignore */
    }
    try {
      pubClient?.disconnect?.();
    } catch {
      /* ignore */
    }
    try {
      subClient?.disconnect?.();
    } catch {
      /* ignore */
    }

    redisClients = null;
    return false;
  }
}

async function shutdownRedisAdapter() {
  const clients = redisClients
    ? [redisClients.pubClient, redisClients.subClient]
    : [];
  if (sharedRedisClient) clients.push(sharedRedisClient);
  if (rateLimitRedisClient) clients.push(rateLimitRedisClient);

  await Promise.allSettled(clients.map((client) => client.quit()));
  redisClients = null;
  sharedRedisClient = null;
  rateLimitRedisClient = null;
}

module.exports = {
  getSharedRedisClient,
  getRateLimitRedisClient,
  attachRedisAdapter,
  shutdownRedisAdapter,
};
