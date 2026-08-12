/**
 * Maps LendingCart package code + billing cycle → GHL Price ID env vars.
 * Never hardcodes IDs; values come from process.env only.
 */

const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("./ghlCheckoutErrors");

const PRICE_ENV_BY_PLAN = {
  BASIC: {
    MONTHLY: "GHL_BASIC_MONTHLY_PRICE_ID",
    YEARLY: "GHL_BASIC_YEARLY_PRICE_ID",
  },
  PRO: {
    MONTHLY: "GHL_PRO_MONTHLY_PRICE_ID",
    YEARLY: "GHL_PRO_YEARLY_PRICE_ID",
  },
  ELITE: {
    MONTHLY: "GHL_ELITE_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ELITE_YEARLY_PRICE_ID",
  },
};

function normalizePackageCode(packageCode) {
  return String(packageCode || "")
    .trim()
    .toUpperCase();
}

function normalizeBillingCycle(billingCycle) {
  const value = String(billingCycle || "")
    .trim()
    .toUpperCase();
  if (value === "MONTHLY" || value === "YEARLY") return value;
  return null;
}

function getGhlProductId() {
  const id = process.env.GHL_PRODUCT_ID;
  return id && String(id).trim() ? String(id).trim() : null;
}

/**
 * @param {string} packageCode BASIC|PRO|ELITE
 * @param {string} billingCycle MONTHLY|YEARLY
 * @returns {{ priceId: string, envKey: string, packageCode: string, billingCycle: string }}
 */
function resolveGhlPriceId(packageCode, billingCycle) {
  const code = normalizePackageCode(packageCode);
  const cycle = normalizeBillingCycle(billingCycle);

  if (!code || !PRICE_ENV_BY_PLAN[code]) {
    throw checkoutError(CHECKOUT_ERROR_CODES.INVALID_PACKAGE, 400);
  }
  if (!cycle) {
    throw checkoutError(CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD, 400);
  }

  const envKey = PRICE_ENV_BY_PLAN[code][cycle];
  const priceId = process.env[envKey];
  if (!priceId || !String(priceId).trim()) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 503);
  }

  return {
    priceId: String(priceId).trim(),
    envKey,
    packageCode: code,
    billingCycle: cycle,
  };
}

function listConfiguredGhlPriceEnvKeys() {
  return Object.values(PRICE_ENV_BY_PLAN).flatMap((cycles) =>
    Object.values(cycles),
  );
}

function hasAllGhlPriceIdsConfigured() {
  const productId = getGhlProductId();
  if (!productId) return false;
  return listConfiguredGhlPriceEnvKeys().every((key) => {
    const value = process.env[key];
    return Boolean(value && String(value).trim());
  });
}

module.exports = {
  PRICE_ENV_BY_PLAN,
  normalizePackageCode,
  normalizeBillingCycle,
  getGhlProductId,
  resolveGhlPriceId,
  listConfiguredGhlPriceEnvKeys,
  hasAllGhlPriceIdsConfigured,
};
