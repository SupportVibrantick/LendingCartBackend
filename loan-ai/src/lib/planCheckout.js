/**
 * @param {import('../types/pricing').SubscriptionPackage} pkg
 * @param {'MONTHLY' | 'YEARLY'} billingCycle
 * @param {(value: number | string) => string} formatPrice
 */
export function buildPlanCheckoutState(pkg, billingCycle, formatPrice) {
  const amount =
    billingCycle === "YEARLY" && pkg.priceYearly != null
      ? pkg.priceYearly
      : pkg.priceMonthly;
  const billingLabel = billingCycle === "YEARLY" ? "year" : "month";

  return {
    packageId: pkg.id,
    planCode: pkg.code,
    planName: pkg.name,
    billingCycle,
    planPrice: formatPrice(amount),
    billingLabel,
    fromPricing: true,
  };
}
