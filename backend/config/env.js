require("dotenv").config();

function envFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return defaultValue;
  }

  return value === "true" || value === "1";
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return String(value).trim();
}

function isEmailEnabled() {
  return envFlag("EMAIL_ENABLED", process.env.NODE_ENV === "production");
}

function isKafkaEnabled() {
  return envFlag("KAFKA_ENABLED", false);
}

function isGhlEnabled() {
  return envFlag("GHL_ENABLED", false);
}

/**
 * Whether GHL invoice/payment checkout runs in live Stripe mode.
 * - GHL_PAYMENTS_LIVE_MODE=true  => liveMode true (production)
 * - GHL_PAYMENTS_LIVE_MODE=false => liveMode false (local/staging test cards)
 * - Missing/empty => true (production-safe default)
 */
function isGhlPaymentsLiveMode() {
  return envFlag("GHL_PAYMENTS_LIVE_MODE", true);
}

function canProcessGhlPayments() {
  try {
    // Lazy require avoids circular deps with payment service helpers.
    const {
      hasAllGhlPriceIdsConfigured,
    } = require("../services/ghl/ghlPriceMap");
    return Boolean(
      isGhlEnabled() &&
        process.env.GHL_API_KEY &&
        String(process.env.GHL_API_KEY).trim() &&
        process.env.GHL_LOCATION_ID &&
        String(process.env.GHL_LOCATION_ID).trim() &&
        hasAllGhlPriceIdsConfigured(),
    );
  } catch {
    return false;
  }
}

function getJwtSecret() {
  return requireEnv("JWT_SECRET");
}

function getSmtpConfig() {
  return {
    host: requireEnv("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT || 465),
    user: requireEnv("SMTP_USER"),
    pass: requireEnv("SMTP_PASS"),
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

function getKafkaBrokers() {
  return requireEnv("KAFKA_BROKERS")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}

function getKafkaEmailTopic() {
  return process.env.KAFKA_EMAIL_TOPIC || "email-sending";
}

function getSocketCorsOrigins() {
  const raw = process.env.SOCKET_CORS_ORIGINS || process.env.CORS_ORIGINS;
  if (raw) {
    return raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV !== "production") {
    return "*";
  }

  throw new Error(
    "SOCKET_CORS_ORIGINS or CORS_ORIGINS is required in production",
  );
}

function isRedisEnabled() {
  return envFlag("REDIS_ENABLED", false);
}

function getRedisUrl() {
  const url = process.env.REDIS_URL;
  return url && String(url).trim() ? String(url).trim() : null;
}

function validateRedisEnvIfEnabled() {
  if (!isRedisEnabled()) {
    return;
  }

  if (!getRedisUrl()) {
    throw new Error("REDIS_ENABLED=true requires REDIS_URL");
  }
}

function validateCommonEnv() {
  requireEnv("DATABASE_URL");
  requireEnv("JWT_SECRET");
}

function validateEmailEnvIfEnabled() {
  if (!isEmailEnabled()) {
    return;
  }

  requireEnv("SMTP_HOST");
  requireEnv("SMTP_USER");
  requireEnv("SMTP_PASS");
}

function validateKafkaEnvIfEnabled() {
  if (!isKafkaEnabled()) {
    return;
  }

  getKafkaBrokers();
}

function validateGhlEnvIfEnabled() {
  if (!isGhlEnabled()) {
    return;
  }

  // Email provider uses webhook; contact sync uses API key + location.
  // Require at least one configured path when GHL is enabled.
  const hasWebhook =
    Boolean(process.env.GHL_WEBHOOK_URL && String(process.env.GHL_WEBHOOK_URL).trim()) ||
    Boolean(
      process.env.GHL_LEAD_WEBHOOK_URL &&
        String(process.env.GHL_LEAD_WEBHOOK_URL).trim(),
    );
  const hasContactApi =
    Boolean(process.env.GHL_API_KEY && String(process.env.GHL_API_KEY).trim()) &&
    Boolean(
      process.env.GHL_LOCATION_ID && String(process.env.GHL_LOCATION_ID).trim(),
    );

  if (!hasWebhook && !hasContactApi) {
    throw new Error(
      "GHL_ENABLED=true requires GHL_WEBHOOK_URL and/or GHL_API_KEY + GHL_LOCATION_ID",
    );
  }
}

function validateApiEnv() {
  validateCommonEnv();
  validateEmailEnvIfEnabled();
  validateKafkaEnvIfEnabled();
  validateGhlEnvIfEnabled();
  validateRedisEnvIfEnabled();

  if (process.env.NODE_ENV === "production") {
    getSocketCorsOrigins();
  }
}

function validateWorkerEnv() {
  validateCommonEnv();
  validateEmailEnvIfEnabled();
  validateKafkaEnvIfEnabled();
  validateGhlEnvIfEnabled();

  if (!envFlag("ENABLE_CRONS", false)) {
    throw new Error(
      "Worker requires ENABLE_CRONS=true. Set ENABLE_CRONS=false on the API process only.",
    );
  }
}

module.exports = {
  envFlag,
  isEmailEnabled,
  isKafkaEnabled,
  isGhlEnabled,
  isGhlPaymentsLiveMode,
  canProcessGhlPayments,
  isRedisEnabled,
  getJwtSecret,
  getSmtpConfig,
  getKafkaBrokers,
  getKafkaEmailTopic,
  getSocketCorsOrigins,
  getRedisUrl,
  validateApiEnv,
  validateWorkerEnv,
};
