const { isRedisEnabled, getRedisUrl } = require("../config/env");
const { commonLogs } = require("../services/logger/contextLogger");

let redisClients = null;

async function attachRedisAdapter(io) {
  if (!isRedisEnabled()) {
    commonLogs.info("Socket.IO Redis adapter disabled");
    return false;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    commonLogs.warn("REDIS_ENABLED=true but REDIS_URL is missing — skipping adapter");
    return false;
  }

  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const { Redis } = require("ioredis");

    const pubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (error) => {
      commonLogs.error("Socket Redis pub client error", { error: error.message });
    });
    subClient.on("error", (error) => {
      commonLogs.error("Socket Redis sub client error", { error: error.message });
    });

    io.adapter(createAdapter(pubClient, subClient));
    redisClients = { pubClient, subClient };

    commonLogs.info("Socket.IO Redis adapter enabled");
    return true;
  } catch (error) {
    commonLogs.error("Failed to initialize Socket.IO Redis adapter", {
      error: error.message,
    });
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
