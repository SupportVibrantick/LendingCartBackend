const { isRedisEnabled, getRedisUrl } = require("../config/env");
const { commonLogs } = require("../services/logger/contextLogger");

let redisClients = null;

async function attachRedisAdapter(io) {
  const isProd = process.env.NODE_ENV === "production";

  if (!isRedisEnabled()) {
    if (isProd) {
      throw new Error("REDIS_ENABLED must be true in production to support multi-instance Socket.IO");
    }
    commonLogs.info("Socket.IO Redis adapter disabled");
    return false;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    if (isProd) {
      throw new Error("REDIS_URL is missing in production — required for Socket.IO adapter");
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
    const { Redis } = require("ioredis");

    pubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      lazyConnect: true,
      retryStrategy: () => null,
    });
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
    if (isProd) {
      throw new Error(`CRITICAL: Failed to initialize Socket.IO Redis adapter in production: ${error.message}`);
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
  if (!redisClients) {
    return;
  }

  await Promise.allSettled([
    redisClients.pubClient.quit(),
    redisClients.subClient.quit(),
  ]);
  redisClients = null;
}

module.exports = {
  attachRedisAdapter,
  shutdownRedisAdapter,
};
