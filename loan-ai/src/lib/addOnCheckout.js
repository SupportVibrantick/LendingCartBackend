/**
 * @param {import('../types/pricing').SubscriptionAddOn[]} addOns
 * @param {string | undefined} packageCode
 */
export function filterAddOnsForPackage(addOns, packageCode) {
  const pkgCode = String(packageCode || "").toUpperCase();
  return (addOns || []).filter((addOn) => {
    if (addOn.isPurchasable === false) return false;
    const included = addOn.includedInPackageCodes || [];
    return !included.some((code) => String(code).toUpperCase() === pkgCode);
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
