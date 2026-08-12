/**
 * Shared security helpers for GHL checkout / webhook endpoints.
 */

const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("./ghlCheckoutErrors");

const FORBIDDEN_CHECKOUT_BODY_KEYS = [
  "priceId",
  "ghlPriceId",
  "ghlProductId",
  "ghlContactId",
  "ghlInvoiceId",
  "ghlSubscriptionId",
  "amount",
  "currency",
  "apiKey",
  "ghlApiKey",
  "GHL_API_KEY",
];

function rejectTrustedClientPriceFields(body = {}) {
  const present = FORBIDDEN_CHECKOUT_BODY_KEYS.filter(
    (key) => body[key] !== undefined && body[key] !== null,
  );
  if (present.length) {
    throw checkoutError(CHECKOUT_ERROR_CODES.VALIDATION_FAILED, 400);
  }
}

function getAllowedCheckoutOrigins() {
  const origins = new Set();
  for (const key of [
    "FRONTEND_URL",
    "LOAN_AI_URL",
    "EMBED_APP_URL",
    "CORS_ORIGINS",
  ]) {
    const raw = process.env[key];
    if (!raw) continue;
    for (const part of String(raw).split(",")) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === "*") continue;
      try {
        origins.add(new URL(trimmed).origin);
      } catch {
        // ignore invalid
      }
    }
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:5173");
    origins.add("http://localhost:5174");
    origins.add("http://localhost:5175");
    origins.add("http://127.0.0.1:5173");
    origins.add("http://127.0.0.1:5175");
  }
  return origins;
}

function assertSafeRedirectUrl(url, fieldName = "url") {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw Object.assign(new Error(`Invalid ${fieldName}`), { statusCode: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw Object.assign(new Error(`Invalid ${fieldName} protocol`), {
      statusCode: 400,
    });
  }
  const allowed = getAllowedCheckoutOrigins();
  if (allowed.size && !allowed.has(parsed.origin)) {
    throw Object.assign(
      new Error(`${fieldName} is not an allowed return origin`),
      { statusCode: 400 },
    );
  }
  return parsed.toString();
}

function toPublicCheckoutPayload(checkout, pkg) {
  return {
    checkoutId: checkout.id,
    packageId: pkg.id,
    packageCode: pkg.code,
    packageName: pkg.name,
    billingCycle: checkout.billingCycle,
    amount: Number(checkout.amount),
    currency: checkout.currency,
    status: checkout.status,
    expiresAt: checkout.expiresAt,
  };
}

module.exports = {
  FORBIDDEN_CHECKOUT_BODY_KEYS,
  rejectTrustedClientPriceFields,
  getAllowedCheckoutOrigins,
  assertSafeRedirectUrl,
  toPublicCheckoutPayload,
};
