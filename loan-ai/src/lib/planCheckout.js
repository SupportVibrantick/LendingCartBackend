/**
 * @param {import('../types/pricing').SubscriptionPackage} pkg
 * @param {'MONTHLY' | 'YEARLY'} billingCycle
 * @param {(value: number | string) => string} formatPrice
 * @param {string[]} [addOnCodes]
 * @param {{ mode?: 'paid' | 'trial' }} [options]
 */
export function buildPlanCheckoutState(
  pkg,
  billingCycle,
  formatPrice,
  addOnCodes = [],
  options = {},
) {
  const amount =
    billingCycle === "YEARLY" && pkg.priceYearly != null
      ? pkg.priceYearly
      : pkg.priceMonthly;
  const billingLabel = billingCycle === "YEARLY" ? "year" : "month";
  const mode = options.mode === "trial" ? "trial" : "paid";

  return {
    packageId: pkg.id,
    planCode: pkg.code,
    planName: pkg.name,
    billingCycle,
    planPrice: formatPrice(amount),
    billingLabel,
    addOnCodes: mode === "trial" ? [] : Array.isArray(addOnCodes) ? addOnCodes : [],
    fromPricing: true,
    mode,
  };
}
