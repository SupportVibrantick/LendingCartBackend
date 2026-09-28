/**
 * Maps LendingCart package / add-on codes + billing cycle → Stripe Price ID env vars.
 * Env key names mirror GHL_* with a STRIPE_ prefix (same plan/addon matrix).
 */

const {
  PRICE_ENV_BY_PLAN: GHL_PRICE_ENV_BY_PLAN,
  PRICE_ENV_BY_ADDON: GHL_PRICE_ENV_BY_ADDON,
  normalizePackageCode,
  normalizeAddOnCode,
  normalizeBillingCycle,
} = require("../ghl/ghlPriceMap");
const {
  CHECKOUT_ERROR_CODES,
  checkoutError,
} = require("../ghl/ghlCheckoutErrors");

function toStripeEnvKey(ghlKey) {
  if (!ghlKey) return null;
  const key = String(ghlKey);
  if (key.startsWith("STRIPE_")) return key;
  if (key.startsWith("GHL_")) return `STRIPE_${key.slice(4)}`;
  return `STRIPE_${key}`;
}

function mapPlanEnvTree(ghlTree) {
  const out = {};
  for (const [pkg, cycles] of Object.entries(ghlTree || {})) {
    out[pkg] = {
      MONTHLY: toStripeEnvKey(cycles.MONTHLY),
      YEARLY: toStripeEnvKey(cycles.YEARLY),
    };
  }
  return out;
}

function mapAddonEnvTree(ghlTree) {
  const out = {};
  for (const [code, addonMap] of Object.entries(ghlTree || {})) {
    const mapped = {
      MONTHLY: toStripeEnvKey(addonMap.MONTHLY),
      YEARLY: toStripeEnvKey(addonMap.YEARLY),
    };
    if (addonMap.BY_PACKAGE) {
      mapped.BY_PACKAGE = {};
      for (const [pkg, cycles] of Object.entries(addonMap.BY_PACKAGE)) {
        mapped.BY_PACKAGE[pkg] = {
          MONTHLY: toStripeEnvKey(cycles.MONTHLY),
          YEARLY: toStripeEnvKey(cycles.YEARLY),
        };
      }
    }
    out[code] = mapped;
  }
  return out;
}

const PRICE_ENV_BY_PLAN = mapPlanEnvTree(GHL_PRICE_ENV_BY_PLAN);
const PRICE_ENV_BY_ADDON = mapAddonEnvTree(GHL_PRICE_ENV_BY_ADDON);

function resolveAddOnEnvKey(addonMap, cycle, packageCode) {
  const pkgCode = packageCode ? normalizePackageCode(packageCode) : null;
  if (pkgCode && addonMap.BY_PACKAGE?.[pkgCode]?.[cycle]) {
    return addonMap.BY_PACKAGE[pkgCode][cycle];
  }
  return addonMap[cycle];
}

function resolveStripePriceId(packageCode, billingCycle) {
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
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_PRICE, 503, {
      provider: "stripe",
      envKey,
    });
  }

  return {
    priceId: String(priceId).trim(),
    envKey,
    packageCode: code,
    billingCycle: cycle,
  };
}

function resolveStripeAddOnPriceId(addOnCode, billingCycle, packageCode) {
  const code = normalizeAddOnCode(addOnCode);
  const cycle = normalizeBillingCycle(billingCycle);
  const pkgCode = packageCode ? normalizePackageCode(packageCode) : null;

  if (!code || !PRICE_ENV_BY_ADDON[code]) {
    throw checkoutError(CHECKOUT_ERROR_CODES.INVALID_ADDON, 400);
  }
  if (!cycle) {
    throw checkoutError(CHECKOUT_ERROR_CODES.INVALID_BILLING_PERIOD, 400);
  }

  const envKey = resolveAddOnEnvKey(PRICE_ENV_BY_ADDON[code], cycle, pkgCode);
  if (!envKey) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_ADDON_PRICE, 503, {
      provider: "stripe",
      addOnCode: code,
      packageCode: pkgCode,
    });
  }

  const priceId = process.env[envKey];
  if (!priceId || !String(priceId).trim()) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_ADDON_PRICE, 503, {
      provider: "stripe",
      addOnCode: code,
      envKey,
      packageCode: pkgCode,
    });
  }

  return {
    priceId: String(priceId).trim(),
    envKey,
    addOnCode: code,
    billingCycle: cycle,
    packageCode: pkgCode,
  };
}

function listConfiguredStripePriceEnvKeys() {
  return Object.values(PRICE_ENV_BY_PLAN).flatMap((cycles) =>
    Object.values(cycles),
  );
}

function hasStripePlanPricesConfigured() {
  return listConfiguredStripePriceEnvKeys().every((key) => {
    const value = process.env[key];
    return Boolean(value && String(value).trim());
  });
}

module.exports = {
  PRICE_ENV_BY_PLAN,
  PRICE_ENV_BY_ADDON,
  resolveStripePriceId,
  resolveStripeAddOnPriceId,
  listConfiguredStripePriceEnvKeys,
  hasStripePlanPricesConfigured,
  toStripeEnvKey,
};
