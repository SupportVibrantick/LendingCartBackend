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

function getGhlOAuthConfig() {
  const clientId = process.env.GHL_OAUTH_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.GHL_OAUTH_CLIENT_SECRET?.trim() || null;
  const redirectUri = process.env.GHL_OAUTH_REDIRECT_URI?.trim() || null;
  return { clientId, clientSecret, redirectUri };
}

function isGhlOAuthConfigured() {
  const { clientId, clientSecret, redirectUri } = getGhlOAuthConfig();
  return Boolean(clientId && clientSecret && redirectUri);
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

function parseOriginList(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function collectSocketCorsOrigins() {
  const origins = new Set();

  for (const raw of [
    process.env.SOCKET_CORS_ORIGINS,
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.BROKER_DASHBOARD_URL,
    process.env.LENDER_DASHBOARD_URL,
    process.env.LOAN_AI_URL,
    process.env.EMBED_APP_URL,
  ]) {
    for (const origin of parseOriginList(raw)) {
      origins.add(origin.replace(/\/$/, ""));
    }
  }

  return [...origins];
}

function getSocketCorsDomainSuffixes() {
  const raw =
    process.env.SOCKET_CORS_DOMAIN_SUFFIX || process.env.CORS_DOMAIN_SUFFIX;
  return parseOriginList(raw).map((suffix) => suffix.replace(/^\./, ""));
}

function isSocketOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  const normalized = origin.replace(/\/$/, "");
  if (collectSocketCorsOrigins().includes(normalized)) {
    return true;
  }

  const suffixes = getSocketCorsDomainSuffixes();
  if (suffixes.length === 0) {
    return false;
  }

  try {
    const { hostname, protocol } = new URL(normalized);
    if (protocol !== "https:" && protocol !== "http:") {
      return false;
    }

    return suffixes.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

function getSocketCorsOrigins() {
  const origins = collectSocketCorsOrigins();
  if (origins.length > 0) {
    return origins;
  }

  if (getSocketCorsDomainSuffixes().length > 0) {
    return origins;
  }

  if (process.env.NODE_ENV !== "production") {
    return "*";
  }

  throw new Error(
    "SOCKET_CORS_ORIGINS, CORS_ORIGINS, or SOCKET_CORS_DOMAIN_SUFFIX is required in production",
  );
}

function getSocketIoCorsOptions() {
  if (process.env.NODE_ENV !== "production") {
    const origins = collectSocketCorsOrigins();
    if (origins.length === 0 && getSocketCorsDomainSuffixes().length === 0) {
      return {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      };
    }
  }

  return {
    origin: (origin, callback) => {
      if (isSocketOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Socket CORS blocked for origin: ${origin || "(none)"}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  };
}

function isProduction() {
  return process.env.NODE_ENV === "production";
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

/**
 * Production requires Redis for multi-instance Socket.IO + shared rate limits.
 */
function validateRedisRequiredInProduction() {
  if (!isProduction()) {
    return;
  }

  if (!isRedisEnabled()) {
    throw new Error(
      "REDIS_ENABLED must be true in production (shared rate limits + Socket.IO)",
    );
  }

  if (!getRedisUrl()) {
    throw new Error("REDIS_URL is required in production");
  }
}

function getDatabaseConnectionLimit() {
  const raw = process.env.DATABASE_CONNECTION_LIMIT;
  const fallback = isProduction() ? 10 : 5;
  const value = raw ? Number(raw) : fallback;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getDatabasePoolTimeoutSec() {
  const raw = process.env.DATABASE_POOL_TIMEOUT;
  const value = raw ? Number(raw) : 20;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 20;
}

/**
 * Append Prisma pool params to DATABASE_URL when not already present.
 */
function getDatabaseUrl() {
  const base = requireEnv("DATABASE_URL");
  const connectionLimit = getDatabaseConnectionLimit();
  const poolTimeout = getDatabasePoolTimeoutSec();

  try {
    const url = new URL(base);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", String(connectionLimit));
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", String(poolTimeout));
    }
    return url.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    const parts = [];
    if (!/[?&]connection_limit=/.test(base)) {
      parts.push(`connection_limit=${connectionLimit}`);
    }
    if (!/[?&]pool_timeout=/.test(base)) {
      parts.push(`pool_timeout=${poolTimeout}`);
    }
    return parts.length ? `${base}${sep}${parts.join("&")}` : base;
  }
}

function getAuditLogRetentionDays() {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  const value = raw ? Number(raw) : 90;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 90;
}

function getAuditLogPayloadMaxBytes() {
  const raw = process.env.AUDIT_LOG_PAYLOAD_MAX_BYTES;
  const value = raw ? Number(raw) : 8 * 1024;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 8 * 1024;
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
  validateRedisRequiredInProduction();

  if (isProduction()) {
    getSocketCorsOrigins();
  }
}

function validateWorkerEnv() {
  validateCommonEnv();
  validateEmailEnvIfEnabled();
  validateKafkaEnvIfEnabled();
  validateGhlEnvIfEnabled();
  validateRedisEnvIfEnabled();
  validateRedisRequiredInProduction();

  if (!envFlag("ENABLE_CRONS", false)) {
    throw new Error(
      "Worker requires ENABLE_CRONS=true. Set ENABLE_CRONS=false on the API process only.",
    );
  }
}

function getUploadMaxBytes() {
  const raw = process.env.UPLOAD_MAX_BYTES || process.env.SIGN_FORM_MAX_UPLOAD_BYTES;
  const value = raw ? Number(raw) : 25 * 1024 * 1024;
  return Number.isFinite(value) && value > 0 ? value : 25 * 1024 * 1024;
}

module.exports = {
  envFlag,
  isProduction,
  isEmailEnabled,
  isKafkaEnabled,
  isGhlEnabled,
  isGhlPaymentsLiveMode,
  isGhlOAuthConfigured,
  getGhlOAuthConfig,
  canProcessGhlPayments,
  isRedisEnabled,
  getJwtSecret,
  getSmtpConfig,
  getKafkaBrokers,
  getKafkaEmailTopic,
  getSocketCorsOrigins,
  getSocketIoCorsOptions,
  isSocketOriginAllowed,
  collectSocketCorsOrigins,
  getSocketCorsDomainSuffixes,
  getRedisUrl,
  getDatabaseUrl,
  getDatabaseConnectionLimit,
  getDatabasePoolTimeoutSec,
  getAuditLogRetentionDays,
  getAuditLogPayloadMaxBytes,
  getUploadMaxBytes,
  validateApiEnv,
  validateWorkerEnv,
  validateRedisRequiredInProduction,
};
