/**
 * Maps LendingCart package / add-on codes + billing cycle → GHL Price ID env vars.
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

/** Catalog add-on code → env keys for GHL Internal Price Ids */
const PRICE_ENV_BY_ADDON = {
  EXTRA_USER: {
    // Default / Starter (BASIC) fallback
    MONTHLY: "GHL_ADDON_EXTRA_USER_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_EXTRA_USER_YEARLY_PRICE_ID",
    // Plan-tiered seats: Starter $99 · Pro $79 · Elite $49
    BY_PACKAGE: {
      BASIC: {
        MONTHLY: "GHL_ADDON_EXTRA_USER_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_EXTRA_USER_YEARLY_PRICE_ID",
      },
      PRO: {
        MONTHLY: "GHL_ADDON_EXTRA_USER_PRO_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_EXTRA_USER_PRO_YEARLY_PRICE_ID",
      },
      ELITE: {
        MONTHLY: "GHL_ADDON_EXTRA_USER_ELITE_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_EXTRA_USER_ELITE_YEARLY_PRICE_ID",
      },
    },
  },
  CRE_PACK: {
    MONTHLY: "GHL_ADDON_CRE_PACK_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_CRE_PACK_YEARLY_PRICE_ID",
  },
  BUSINESS_LENDING_PACK: {
    MONTHLY: "GHL_ADDON_BUSINESS_LENDING_PACK_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_BUSINESS_LENDING_PACK_YEARLY_PRICE_ID",
    BY_PACKAGE: {
      BASIC: {
        MONTHLY: "GHL_ADDON_BUSINESS_LENDING_PACK_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_BUSINESS_LENDING_PACK_YEARLY_PRICE_ID",
      },
      PRO: {
        MONTHLY: "GHL_ADDON_BUSINESS_LENDING_PACK_PRO_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_BUSINESS_LENDING_PACK_PRO_YEARLY_PRICE_ID",
      },
    },
  },
  FEE_AGREEMENT_PACK: {
    MONTHLY: "GHL_ADDON_FEE_AGREEMENT_PACK_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_FEE_AGREEMENT_PACK_YEARLY_PRICE_ID",
  },
  LENDER_MARKETPLACE_PACK: {
    MONTHLY: "GHL_ADDON_LENDER_MARKETPLACE_PACK_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_LENDER_MARKETPLACE_PACK_YEARLY_PRICE_ID",
    BY_PACKAGE: {
      BASIC: {
        MONTHLY: "GHL_ADDON_LENDER_MARKETPLACE_PACK_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_LENDER_MARKETPLACE_PACK_YEARLY_PRICE_ID",
      },
      PRO: {
        MONTHLY: "GHL_ADDON_LENDER_MARKETPLACE_PACK_PRO_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_LENDER_MARKETPLACE_PACK_PRO_YEARLY_PRICE_ID",
      },
    },
  },
  GHL_STARTER: {
    MONTHLY: "GHL_ADDON_GHL_STARTER_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_GHL_STARTER_YEARLY_PRICE_ID",
  },
  ABL_PACK: {
    MONTHLY: "GHL_ADDON_ABL_PACK_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_ABL_PACK_YEARLY_PRICE_ID",
  },
  SBA_PACK: {
    MONTHLY: "GHL_ADDON_SBA_PACK_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_SBA_PACK_YEARLY_PRICE_ID",
  },
  GHL_BASIC_SYNC: {
    MONTHLY: "GHL_ADDON_GHL_BASIC_SYNC_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_GHL_BASIC_SYNC_YEARLY_PRICE_ID",
    BY_PACKAGE: {
      BASIC: {
        MONTHLY: "GHL_ADDON_GHL_BASIC_SYNC_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_GHL_BASIC_SYNC_YEARLY_PRICE_ID",
      },
      PRO: {
        MONTHLY: "GHL_ADDON_GHL_BASIC_SYNC_PRO_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_GHL_BASIC_SYNC_PRO_YEARLY_PRICE_ID",
      },
    },
  },
  WHITE_LABEL: {
    MONTHLY: "GHL_ADDON_WHITE_LABEL_MONTHLY_PRICE_ID",
    YEARLY: "GHL_ADDON_WHITE_LABEL_YEARLY_PRICE_ID",
    BY_PACKAGE: {
      BASIC: {
        MONTHLY: "GHL_ADDON_WHITE_LABEL_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_WHITE_LABEL_YEARLY_PRICE_ID",
      },
      PRO: {
        MONTHLY: "GHL_ADDON_WHITE_LABEL_PRO_MONTHLY_PRICE_ID",
        YEARLY: "GHL_ADDON_WHITE_LABEL_PRO_YEARLY_PRICE_ID",
      },
    },
  },
};

function normalizePackageCode(packageCode) {
  return String(packageCode || "")
    .trim()
    .toUpperCase();
}

function normalizeAddOnCode(addOnCode) {
  return String(addOnCode || "")
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

/**
 * Resolve env key for an add-on price, optionally scoped by package (EXTRA_USER tiers).
 * @param {object} addonMap
 * @param {string} cycle MONTHLY|YEARLY
 * @param {string | null} packageCode
 */
function resolveAddOnEnvKey(addonMap, cycle, packageCode) {
  const pkgCode = packageCode ? normalizePackageCode(packageCode) : null;
  if (pkgCode && addonMap.BY_PACKAGE?.[pkgCode]?.[cycle]) {
    return addonMap.BY_PACKAGE[pkgCode][cycle];
  }
  return addonMap[cycle];
}

/**
 * @param {string} addOnCode
 * @param {string} billingCycle MONTHLY|YEARLY
 * @param {string} [packageCode] BASIC|PRO|ELITE — used for plan-tiered add-ons (EXTRA_USER)
 * @returns {{ priceId: string, envKey: string, addOnCode: string, billingCycle: string, packageCode: string | null }}
 */
function resolveGhlAddOnPriceId(addOnCode, billingCycle, packageCode) {
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
      addOnCode: code,
      packageCode: pkgCode,
    });
  }

  const priceId = process.env[envKey];
  if (!priceId || !String(priceId).trim()) {
    throw checkoutError(CHECKOUT_ERROR_CODES.MISSING_GHL_ADDON_PRICE, 503, {
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

/**
 * @param {string[]} addOnCodes
 * @param {string} billingCycle
 * @param {string} [packageCode]
 * @returns {{ priceId: string, envKey: string, addOnCode: string, billingCycle: string, packageCode: string | null }[]}
 */
function resolveGhlAddOnPriceIds(addOnCodes, billingCycle, packageCode) {
  if (!Array.isArray(addOnCodes) || addOnCodes.length === 0) return [];
  const unique = [
    ...new Set(addOnCodes.map((c) => normalizeAddOnCode(c)).filter(Boolean)),
  ];
  return unique.map((code) =>
    resolveGhlAddOnPriceId(code, billingCycle, packageCode),
  );
}

function listConfiguredGhlPriceEnvKeys() {
  return Object.values(PRICE_ENV_BY_PLAN).flatMap((cycles) =>
    Object.values(cycles),
  );
}

function listConfiguredGhlAddOnPriceEnvKeys() {
  const keys = [];
  for (const addonMap of Object.values(PRICE_ENV_BY_ADDON)) {
    if (addonMap.MONTHLY) keys.push(addonMap.MONTHLY);
    if (addonMap.YEARLY) keys.push(addonMap.YEARLY);
    if (addonMap.BY_PACKAGE) {
      for (const pkgMap of Object.values(addonMap.BY_PACKAGE)) {
        if (pkgMap.MONTHLY) keys.push(pkgMap.MONTHLY);
        if (pkgMap.YEARLY) keys.push(pkgMap.YEARLY);
      }
    }
  }
  return [...new Set(keys)];
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
  PRICE_ENV_BY_ADDON,
  normalizePackageCode,
  normalizeAddOnCode,
  normalizeBillingCycle,
  getGhlProductId,
  resolveGhlPriceId,
  resolveGhlAddOnPriceId,
  resolveGhlAddOnPriceIds,
  listConfiguredGhlPriceEnvKeys,
  listConfiguredGhlAddOnPriceEnvKeys,
  hasAllGhlPriceIdsConfigured,
};
