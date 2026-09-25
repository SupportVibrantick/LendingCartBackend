/**
 * Add-ons that are sold per-unit (quantity stepper), not as a checkbox.
 * EXTRA_USER is always quantity-based; catalog may also set quantityBased.
 */
export const MAX_QUANTITY_ADDON = 20;

/**
 * @param {import('../types/pricing').SubscriptionAddOn | string | undefined} addOnOrCode
 */
export function isQuantityAddOn(addOnOrCode) {
  if (!addOnOrCode) return false;
  if (typeof addOnOrCode === "string") {
    return String(addOnOrCode).toUpperCase() === "EXTRA_USER";
  }
  if (addOnOrCode.quantityBased) return true;
  return String(addOnOrCode.code || "").toUpperCase() === "EXTRA_USER";
}

/**
 * @param {import('../types/pricing').SubscriptionAddOn} addOn
 * @param {string | undefined} packageCode
 */
export function resolveAddOnPriceForPackage(addOn, packageCode) {
  const pkgCode = String(packageCode || "").toUpperCase();
  const byPkg = addOn?.priceByPackage;
  if (byPkg && typeof byPkg === "object" && pkgCode && byPkg[pkgCode] != null) {
    const priced = Number(byPkg[pkgCode]);
    if (Number.isFinite(priced)) return priced;
  }
  return Number(addOn?.priceMonthly || 0);
}

/**
 * @param {import('../types/pricing').SubscriptionAddOn[]} addOns
 * @param {string | undefined} packageCode
 */
export function filterAddOnsForPackage(addOns, packageCode) {
  const pkgCode = String(packageCode || "").toUpperCase();
  return (addOns || [])
    .filter((addOn) => {
      if (addOn.isPurchasable === false) return false;
      const included = addOn.includedInPackageCodes || [];
      if (included.some((code) => String(code).toUpperCase() === pkgCode)) {
        return false;
      }
      const availableFor = addOn.availableForPackageCodes || [];
      if (availableFor.length > 0) {
        return availableFor.some(
          (code) => String(code).toUpperCase() === pkgCode,
        );
      }
      return true;
    })
    .map((addOn) => ({
      ...addOn,
      priceMonthly: resolveAddOnPriceForPackage(addOn, packageCode),
    }));
}

/**
 * @param {import('../types/pricing').SubscriptionAddOn[]} addOns
 * @param {string[]} selectedCodes
 */
export function toggleAddOnCode(selectedCodes, code) {
  const normalized = String(code).toUpperCase();
  const set = new Set(selectedCodes.map((c) => String(c).toUpperCase()));
  if (set.has(normalized)) {
    set.delete(normalized);
  } else {
    set.add(normalized);
  }
  return [...set];
}

/**
 * @param {string[]} selectedCodes
 * @param {string} code
 */
export function getAddOnQuantity(selectedCodes, code) {
  const normalized = String(code).toUpperCase();
  return (selectedCodes || []).filter(
    (c) => String(c).toUpperCase() === normalized,
  ).length;
}

/**
 * Set quantity for a quantity-based add-on (0 removes it).
 * Other selected codes are preserved.
 * @param {string[]} selectedCodes
 * @param {string} code
 * @param {number} quantity
 * @param {number} [max]
 */
export function setAddOnQuantity(
  selectedCodes,
  code,
  quantity,
  max = MAX_QUANTITY_ADDON,
) {
  const normalized = String(code).toUpperCase();
  const others = (selectedCodes || []).filter(
    (c) => String(c).toUpperCase() !== normalized,
  );
  const qty = Math.max(0, Math.min(max, Math.floor(Number(quantity) || 0)));
  if (qty <= 0) return others;
  return [...others, ...Array.from({ length: qty }, () => normalized)];
}

/**
 * Unique selected add-on types (quantity seats count as 1 type).
 * @param {string[]} selectedCodes
 */
export function countSelectedAddOnTypes(selectedCodes) {
  return new Set(
    (selectedCodes || []).map((c) => String(c).toUpperCase()).filter(Boolean),
  ).size;
}

/**
 * @param {import('../types/pricing').SubscriptionAddOn[]} addOns
 * @param {string[]} selectedCodes
 * @returns {(import('../types/pricing').SubscriptionAddOn & { quantity: number })[]}
 */
export function getSelectedAddOns(addOns, selectedCodes) {
  const counts = new Map();
  for (const raw of selectedCodes || []) {
    const code = String(raw).toUpperCase();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return (addOns || [])
    .filter((addOn) => counts.has(String(addOn.code).toUpperCase()))
    .map((addOn) => ({
      ...addOn,
      quantity: counts.get(String(addOn.code).toUpperCase()) || 1,
    }));
}

/**
 * @param {(import('../types/pricing').SubscriptionAddOn & { quantity?: number })[]} selectedAddOns
 * @param {'MONTHLY' | 'YEARLY'} billingCycle
 */
export function getAddOnsCycleTotal(selectedAddOns, billingCycle) {
  const monthly = (selectedAddOns || []).reduce((sum, addOn) => {
    const qty = Math.max(1, Number(addOn.quantity) || 1);
    return sum + Number(addOn.priceMonthly || 0) * qty;
  }, 0);
  return billingCycle === "YEARLY" ? monthly * 12 : monthly;
}

/**
 * Expand selected add-ons (with quantity) into a codes array for checkout APIs.
 * @param {(import('../types/pricing').SubscriptionAddOn & { quantity?: number })[]} selectedAddOns
 */
export function expandAddOnCodesForCheckout(selectedAddOns) {
  return (selectedAddOns || []).flatMap((addOn) => {
    const qty = Math.max(1, Number(addOn.quantity) || 1);
    return Array.from({ length: qty }, () => addOn.code);
  });
}

/**
 * @param {import('../types/pricing').SubscriptionAddOn[]} addOns
 * @param {string[]} selectedCodes
 * @param {string | undefined} packageCode
 */
export function getApplicableSelectedAddOns(addOns, selectedCodes, packageCode) {
  return getSelectedAddOns(
    filterAddOnsForPackage(addOns, packageCode),
    selectedCodes,
  );
}

/**
 * Human-readable plan labels for add-on availability chips.
 * @param {import('../types/pricing').SubscriptionAddOn} addOn
 */
export function getAddOnAvailabilityLabel(addOn) {
  if (addOn.note) return addOn.note;
  const available = addOn.availableForPackageCodes || [];
  if (available.length === 0) return "All plans";
  return available
    .map((code) => {
      const c = String(code).toUpperCase();
      if (c === "BASIC") return "Starter";
      if (c === "PRO") return "Pro";
      if (c === "ELITE") return "Elite";
      return c;
    })
    .join(" / ");
}

/**
 * Display title for quantity add-ons.
 * @param {import('../types/pricing').SubscriptionAddOn} addOn
 */
export function getAddOnDisplayName(addOn) {
  if (isQuantityAddOn(addOn)) return "Additional Users";
  return addOn.name;
}

/**
 * @param {import('../types/pricing').SubscriptionPackage | undefined} pkg
 * @param {'MONTHLY' | 'YEARLY'} billingCycle
 * @param {(import('../types/pricing').SubscriptionAddOn & { quantity?: number })[]} selectedAddOns
 * @param {(value: number | string) => string} formatPrice
 */
export function buildCheckoutSummary(pkg, billingCycle, selectedAddOns, formatPrice) {
  if (!pkg) return null;

  const planAmount =
    billingCycle === "YEARLY" && pkg.priceYearly != null
      ? Number(pkg.priceYearly)
      : Number(pkg.priceMonthly);

  const addOnsAmount = getAddOnsCycleTotal(selectedAddOns, billingCycle);
  const totalAmount = planAmount + addOnsAmount;
  const billingLabel = billingCycle === "YEARLY" ? "year" : "month";

  return {
    planAmount,
    addOnsAmount,
    totalAmount,
    billingLabel,
    planPrice: formatPrice(planAmount),
    addOnsPrice: formatPrice(addOnsAmount),
    totalPrice: formatPrice(totalAmount),
    lineItems: [
      { label: `${pkg.name} plan`, amount: planAmount },
      ...selectedAddOns.map((addOn) => {
        const qty = Math.max(1, Number(addOn.quantity) || 1);
        const unit =
          billingCycle === "YEARLY"
            ? Number(addOn.priceMonthly) * 12
            : Number(addOn.priceMonthly);
        const label =
          isQuantityAddOn(addOn) && qty > 0
            ? qty > 1
              ? `Additional Users × ${qty}`
              : "Additional Users"
            : addOn.name;
        return {
          label,
          amount: unit * qty,
          quantity: qty,
        };
      }),
    ],
  };
}
