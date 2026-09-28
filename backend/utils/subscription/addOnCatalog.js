const { SUBSCRIPTION_ADD_ONS } = require("../../prisma/admin/subscriptionPackageCatalog");

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize priceByPackage entries to `{ monthly, yearly }`.
 * Legacy number values are treated as the yearly (previous) rate.
 */
function normalizePriceByPackage(raw) {
  if (!raw || typeof raw !== "object") return null;

  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      const code = String(key).toUpperCase();
      if (value != null && typeof value === "object" && !Array.isArray(value)) {
        const monthly = toFiniteNumber(value.monthly ?? value.MONTHLY);
        const yearly = toFiniteNumber(
          value.yearly ?? value.YEARLY ?? value.priceYearlyMonthly,
        );
        return [
          code,
          {
            monthly: monthly ?? yearly,
            yearly: yearly ?? monthly,
          },
        ];
      }
      const legacy = toFiniteNumber(value);
      return [code, { monthly: legacy, yearly: legacy }];
    }),
  );
}

function normalizeAddOn(addOn) {
  const priceMonthly = toFiniteNumber(addOn.priceMonthly) ?? 0;
  const priceYearlyMonthly =
    toFiniteNumber(addOn.priceYearlyMonthly) ?? priceMonthly;

  return {
    code: addOn.code,
    name: addOn.name,
    priceMonthly,
    priceYearlyMonthly,
    priceByPackage: normalizePriceByPackage(addOn.priceByPackage),
    note: addOn.note || null,
    isPurchasable: addOn.isPurchasable !== false,
    quantityBased: Boolean(addOn.quantityBased),
    includedInPackageCodes: addOn.includedInPackageCodes || [],
    availableForPackageCodes: addOn.availableForPackageCodes || [],
    usageBoost: addOn.usageBoost || null,
  };
}

/**
 * Resolve the displayed/charged monthly unit for a package + billing cycle.
 * YEARLY uses `priceYearlyMonthly` (legacy rates); MONTHLY uses `priceMonthly`.
 */
function resolveAddOnPriceForPackage(
  addOn,
  packageCode,
  billingCycle = "MONTHLY",
) {
  const pkgCode = String(packageCode || "").toUpperCase();
  const isYearly = String(billingCycle || "").toUpperCase() === "YEARLY";
  const byPkg = addOn?.priceByPackage;

  if (byPkg && pkgCode && byPkg[pkgCode]) {
    const entry = byPkg[pkgCode];
    const priced = isYearly ? entry.yearly : entry.monthly;
    if (priced != null && Number.isFinite(Number(priced))) {
      return Number(priced);
    }
  }

  if (isYearly) {
    return Number(
      addOn?.priceYearlyMonthly != null
        ? addOn.priceYearlyMonthly
        : addOn?.priceMonthly || 0,
    );
  }
  return Number(addOn?.priceMonthly || 0);
}

function getCatalogAddOns() {
  return SUBSCRIPTION_ADD_ONS.map(normalizeAddOn);
}

function getAddOnByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const found = SUBSCRIPTION_ADD_ONS.find(
    (item) => item.code?.toUpperCase() === normalized,
  );
  return found ? normalizeAddOn(found) : null;
}

function isAddOnAvailableForPackage(addOn, packageCode) {
  if (!addOn.isPurchasable) return false;
  const pkgCode = String(packageCode || "").toUpperCase();
  if (
    addOn.includedInPackageCodes.some(
      (code) => String(code).toUpperCase() === pkgCode,
    )
  ) {
    return false;
  }
  const availableFor = addOn.availableForPackageCodes || [];
  if (availableFor.length > 0) {
    return availableFor.some(
      (code) => String(code).toUpperCase() === pkgCode,
    );
  }
  return true;
}

function filterAddOnsForPackage(packageCode, billingCycle = "MONTHLY") {
  return getCatalogAddOns()
    .filter((addOn) => isAddOnAvailableForPackage(addOn, packageCode))
    .map((addOn) => ({
      ...addOn,
      priceMonthly: resolveAddOnPriceForPackage(
        addOn,
        packageCode,
        billingCycle,
      ),
    }));
}

/**
 * @param {string[]} addOnCodes
 * @param {string} packageCode
 * @param {string} [billingCycle]
 * @returns {{ code: string, name: string, priceMonthly: number, quantity: number, usageBoost: object | null }[]}
 */
function resolvePurchasedAddOns(addOnCodes, packageCode, billingCycle = "MONTHLY") {
  if (!Array.isArray(addOnCodes) || addOnCodes.length === 0) return [];

  const counts = new Map();
  for (const raw of addOnCodes) {
    const code = String(raw || "").trim().toUpperCase();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  const resolved = [];

  for (const [code, quantity] of counts.entries()) {
    const addOn = getAddOnByCode(code);
    if (!addOn) {
      throw Object.assign(new Error(`Unknown add-on: ${code}`), { statusCode: 400 });
    }
    if (!isAddOnAvailableForPackage(addOn, packageCode)) {
      throw Object.assign(
        new Error(`Add-on "${addOn.name}" is not available for this plan`),
        { statusCode: 400 },
      );
    }
    resolved.push({
      code: addOn.code,
      name: addOn.name,
      priceMonthly: resolveAddOnPriceForPackage(addOn, packageCode, billingCycle),
      quantity: Math.max(1, quantity),
      usageBoost: addOn.usageBoost,
    });
  }

  return resolved;
}

function getAddOnsMonthlyTotal(purchasedAddOns) {
  if (!Array.isArray(purchasedAddOns)) return 0;
  return purchasedAddOns.reduce(
    (sum, item) => sum + Number(item.priceMonthly) * (item.quantity || 1),
    0,
  );
}

function getAddOnsTotalForCycle(purchasedAddOns, billingCycle) {
  const monthly = getAddOnsMonthlyTotal(purchasedAddOns);
  return billingCycle === "YEARLY" ? monthly * 12 : monthly;
}

function mergeUsageLimitsWithAddOns(baseLimits, purchasedAddOns) {
  const limits =
    baseLimits && typeof baseLimits === "object" && !Array.isArray(baseLimits)
      ? { ...baseLimits }
      : {};

  if (!Array.isArray(purchasedAddOns)) return limits;

  for (const item of purchasedAddOns) {
    const boost = item.usageBoost;
    if (!boost || typeof boost !== "object") continue;
    for (const [metric, amount] of Object.entries(boost)) {
      const boostValue = Number(amount) * (item.quantity || 1);
      if (!Number.isFinite(boostValue)) continue;
      const current = limits[metric] != null ? Number(limits[metric]) : 0;
      limits[metric] = current + boostValue;
    }
  }

  return limits;
}

/**
 * Flatten purchasedAddOns rows → repeated codes (EXTRA_USER × qty).
 * @param {Array<{ code?: string, quantity?: number }> | null | undefined} purchasedAddOns
 * @returns {string[]}
 */
function flattenPurchasedAddOnCodes(purchasedAddOns) {
  if (!Array.isArray(purchasedAddOns)) return [];
  const codes = [];
  for (const item of purchasedAddOns) {
    const code = String(item?.code || "")
      .trim()
      .toUpperCase();
    if (!code) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    for (let i = 0; i < qty; i += 1) codes.push(code);
  }
  return codes;
}

function countAddOnCodes(codes) {
  const counts = new Map();
  for (const raw of codes || []) {
    const code = String(raw || "")
      .trim()
      .toUpperCase();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return counts;
}

/**
 * Compute billable delta for mid-cycle upgrade.
 * @param {object[]} existingPurchased - current subscription.purchasedAddOns
 * @param {string[]} requestedNewCodes - newly selected non-quantity add-on codes
 * @param {number} [desiredExtraUserTotal] - absolute desired EXTRA_USER seats (not delta)
 * @param {string} packageCode
 * @param {string} [billingCycle]
 * @returns {{
 *   deltaCodes: string[],
 *   deltaPurchased: object[],
 *   mergedCodes: string[],
 *   mergedPurchased: object[],
 * }}
 */
function computeAddOnUpgradeDelta(
  existingPurchased,
  requestedNewCodes,
  desiredExtraUserTotal,
  packageCode,
  billingCycle = "MONTHLY",
) {
  const existingCodes = flattenPurchasedAddOnCodes(existingPurchased);
  const existingCounts = countAddOnCodes(existingCodes);
  const deltaCodes = [];

  const requested = [
    ...new Set(
      (Array.isArray(requestedNewCodes) ? requestedNewCodes : [])
        .map((c) => String(c || "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  for (const code of requested) {
    const addOn = getAddOnByCode(code);
    if (!addOn) {
      throw Object.assign(new Error(`Unknown add-on: ${code}`), {
        statusCode: 400,
      });
    }
    if (addOn.quantityBased || code === "EXTRA_USER") {
      throw Object.assign(
        new Error("Use extraUserTotal for Additional Users"),
        { statusCode: 400 },
      );
    }
    if (!isAddOnAvailableForPackage(addOn, packageCode)) {
      throw Object.assign(
        new Error(`Add-on "${addOn.name}" is not available for this plan`),
        { statusCode: 400 },
      );
    }
    if ((existingCounts.get(code) || 0) > 0) {
      continue; // already owned
    }
    deltaCodes.push(code);
  }

  if (desiredExtraUserTotal != null && desiredExtraUserTotal !== "") {
    const desired = Math.max(0, Math.floor(Number(desiredExtraUserTotal)));
    if (!Number.isFinite(desired)) {
      throw Object.assign(new Error("Invalid extraUserTotal"), {
        statusCode: 400,
      });
    }
    const current = existingCounts.get("EXTRA_USER") || 0;
    const extra = getAddOnByCode("EXTRA_USER");
    if (desired > current) {
      if (!extra || !isAddOnAvailableForPackage(extra, packageCode)) {
        throw Object.assign(
          new Error("Additional Users are not available for this plan"),
          { statusCode: 400 },
        );
      }
      for (let i = 0; i < desired - current; i += 1) {
        deltaCodes.push("EXTRA_USER");
      }
    }
  }

  if (deltaCodes.length === 0) {
    throw Object.assign(new Error("No new add-ons or seats to purchase"), {
      statusCode: 400,
      code: "NO_ADDON_DELTA",
    });
  }

  const mergedCodes = [...existingCodes, ...deltaCodes];
  const deltaPurchased = resolvePurchasedAddOns(
    deltaCodes,
    packageCode,
    billingCycle,
  );
  const mergedPurchased = resolvePurchasedAddOns(
    mergedCodes,
    packageCode,
    billingCycle,
  );

  return {
    deltaCodes,
    deltaPurchased,
    mergedCodes,
    mergedPurchased,
  };
}

/**
 * Merge existing purchased rows with a delta (flat codes or purchased rows).
 */
function mergePurchasedAddOns(
  existingPurchased,
  deltaCodesOrPurchased,
  packageCode,
  billingCycle = "MONTHLY",
) {
  const existingCodes = flattenPurchasedAddOnCodes(existingPurchased);
  let deltaCodes = [];
  if (Array.isArray(deltaCodesOrPurchased) && deltaCodesOrPurchased.length > 0) {
    if (
      typeof deltaCodesOrPurchased[0] === "object" &&
      deltaCodesOrPurchased[0] != null &&
      deltaCodesOrPurchased[0].code
    ) {
      deltaCodes = flattenPurchasedAddOnCodes(deltaCodesOrPurchased);
    } else {
      deltaCodes = deltaCodesOrPurchased
        .map((c) => String(c || "").trim().toUpperCase())
        .filter(Boolean);
    }
  }
  return resolvePurchasedAddOns(
    [...existingCodes, ...deltaCodes],
    packageCode,
    billingCycle,
  );
}

module.exports = {
  getCatalogAddOns,
  getAddOnByCode,
  resolveAddOnPriceForPackage,
  filterAddOnsForPackage,
  resolvePurchasedAddOns,
  getAddOnsMonthlyTotal,
  getAddOnsTotalForCycle,
  mergeUsageLimitsWithAddOns,
  flattenPurchasedAddOnCodes,
  countAddOnCodes,
  computeAddOnUpgradeDelta,
  mergePurchasedAddOns,
};
