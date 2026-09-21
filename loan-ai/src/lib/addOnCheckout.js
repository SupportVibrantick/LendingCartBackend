/**
 * @param {import('../types/pricing').SubscriptionAddOn[]} addOns
 * @param {string | undefined} packageCode
 */
export function filterAddOnsForPackage(addOns, packageCode) {
  const pkgCode = String(packageCode || "").toUpperCase();
  return (addOns || []).filter((addOn) => {
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
  });
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
 * @param {import('../types/pricing').SubscriptionAddOn[]} addOns
 * @param {string[]} selectedCodes
 */
export function getSelectedAddOns(addOns, selectedCodes) {
  const codes = new Set(selectedCodes.map((c) => String(c).toUpperCase()));
  return (addOns || []).filter((addOn) =>
    codes.has(String(addOn.code).toUpperCase()),
  );
}

/**
 * @param {import('../types/pricing').SubscriptionAddOn[]} selectedAddOns
 * @param {'MONTHLY' | 'YEARLY'} billingCycle
 */
export function getAddOnsCycleTotal(selectedAddOns, billingCycle) {
  const monthly = (selectedAddOns || []).reduce(
    (sum, addOn) => sum + Number(addOn.priceMonthly || 0),
    0,
  );
  return billingCycle === "YEARLY" ? monthly * 12 : monthly;
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
      if (c === "BASIC") return "Basic";
      if (c === "PRO") return "Pro";
      if (c === "ELITE") return "Elite";
      return c;
    })
    .join(" / ");
}

/**
 * @param {import('../types/pricing').SubscriptionPackage | undefined} pkg
 * @param {'MONTHLY' | 'YEARLY'} billingCycle
 * @param {import('../types/pricing').SubscriptionAddOn[]} selectedAddOns
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
      ...selectedAddOns.map((addOn) => ({
        label: addOn.name,
        amount:
          billingCycle === "YEARLY"
            ? Number(addOn.priceMonthly) * 12
            : Number(addOn.priceMonthly),
      })),
    ],
  };
}
