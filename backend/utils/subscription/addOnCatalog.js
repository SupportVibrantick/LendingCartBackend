const { SUBSCRIPTION_ADD_ONS } = require("../../prisma/admin/subscriptionPackageCatalog");

function normalizeAddOn(addOn) {
  return {
    code: addOn.code,
    name: addOn.name,
    priceMonthly: Number(addOn.priceMonthly),
    note: addOn.note || null,
    isPurchasable: addOn.isPurchasable !== false,
    includedInPackageCodes: addOn.includedInPackageCodes || [],
    usageBoost: addOn.usageBoost || null,
  };
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
  return true;
}

function filterAddOnsForPackage(packageCode) {
  return getCatalogAddOns().filter((addOn) =>
    isAddOnAvailableForPackage(addOn, packageCode),
  );
}

/**
 * @param {string[]} addOnCodes
 * @param {string} packageCode
 * @returns {{ code: string, name: string, priceMonthly: number, quantity: number, usageBoost: object | null }[]}
 */
function resolvePurchasedAddOns(addOnCodes, packageCode) {
  if (!Array.isArray(addOnCodes) || addOnCodes.length === 0) return [];

  const uniqueCodes = [...new Set(addOnCodes.map((c) => String(c).trim().toUpperCase()))];
  const resolved = [];

  for (const code of uniqueCodes) {
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
      priceMonthly: addOn.priceMonthly,
      quantity: 1,
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

module.exports = {
  getCatalogAddOns,
  getAddOnByCode,
  filterAddOnsForPackage,
  resolvePurchasedAddOns,
  getAddOnsMonthlyTotal,
  getAddOnsTotalForCycle,
  mergeUsageLimitsWithAddOns,
};
