/**
 * Add-ons that are sold per-unit (quantity stepper), not as a checkbox.
 * EXTRA_USER is always quantity-based; catalog may also set quantityBased.
 */
import type { PricingAddOn, PricingPackage } from "./planPricingUi";

export const MAX_QUANTITY_ADDON = 20;

type SelectedAddOn = PricingAddOn & { quantity?: number };

export function isQuantityAddOn(
  addOnOrCode: PricingAddOn | string | null | undefined,
): boolean {
  if (!addOnOrCode) return false;
  if (typeof addOnOrCode === "string") {
    return String(addOnOrCode).toUpperCase() === "EXTRA_USER";
  }
  if (addOnOrCode.quantityBased) return true;
  return String(addOnOrCode.code || "").toUpperCase() === "EXTRA_USER";
}

export function resolveAddOnPriceForPackage(
  addOn: PricingAddOn | null | undefined,
  packageCode: string | null | undefined,
  billingCycle: string = "MONTHLY",
): number {
  const pkgCode = String(packageCode || "").toUpperCase();
  const isYearly = String(billingCycle || "").toUpperCase() === "YEARLY";
  const byPkg = addOn?.priceByPackage;

  if (byPkg && typeof byPkg === "object" && pkgCode && byPkg[pkgCode] != null) {
    const entry = byPkg[pkgCode];
    if (entry != null && typeof entry === "object" && !Array.isArray(entry)) {
      const priced = isYearly
        ? entry.yearly ?? entry.YEARLY
        : entry.monthly ?? entry.MONTHLY;
      if (priced != null && Number.isFinite(Number(priced))) {
        return Number(priced);
      }
    }
    const legacy = Number(entry);
    if (Number.isFinite(legacy)) return legacy;
  }

  if (isYearly) {
    const yearly = Number(addOn?.priceYearlyMonthly);
    if (Number.isFinite(yearly)) return yearly;
  }
  return Number(addOn?.priceMonthly || 0);
}

export function filterAddOnsForPackage(
  addOns: PricingAddOn[] | null | undefined,
  packageCode: string | null | undefined,
  billingCycle: string = "MONTHLY",
): PricingAddOn[] {
  const pkgCode = String(packageCode || "").toUpperCase();
  return (addOns || [])
    .filter((addOn: PricingAddOn) => {
      if (addOn.isPurchasable === false) return false;
      const included = addOn.includedInPackageCodes || [];
      if (
        included.some(
          (code: string) => String(code).toUpperCase() === pkgCode,
        )
      ) {
        return false;
      }
      const availableFor = addOn.availableForPackageCodes || [];
      if (availableFor.length > 0) {
        return availableFor.some(
          (code: string) => String(code).toUpperCase() === pkgCode,
        );
      }
      return true;
    })
    .map((addOn: PricingAddOn) => ({
      ...addOn,
      priceMonthly: resolveAddOnPriceForPackage(
        addOn,
        packageCode,
        billingCycle,
      ),
    }));
}

export function toggleAddOnCode(
  selectedCodes: string[],
  code: string,
): string[] {
  const normalized = String(code).toUpperCase();
  const set = new Set(
    selectedCodes.map((c: string) => String(c).toUpperCase()),
  );
  if (set.has(normalized)) {
    set.delete(normalized);
  } else {
    set.add(normalized);
  }
  return [...set];
}

/**
 * Select or clear all checkbox add-ons (not quantity seats like EXTRA_USER).
 * Preserves any quantity-based codes already in the selection.
 */
export function setCheckboxAddOnsSelected(
  selectedCodes: string[] | null | undefined,
  checkboxAddOns: Array<{ code?: string } | string> | null | undefined,
  selected: boolean,
): string[] {
  const checkboxCodes = (checkboxAddOns || [])
    .map((a: { code?: string } | string) =>
      String(typeof a === "string" ? a : a?.code || "")
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  const checkboxSet = new Set(checkboxCodes);
  const preserved = (selectedCodes || []).filter(
    (c: string) => !checkboxSet.has(String(c).toUpperCase()),
  );
  if (!selected) return preserved;
  return [...preserved, ...checkboxCodes];
}

export function areAllCheckboxAddOnsSelected(
  selectedCodes: string[] | null | undefined,
  checkboxAddOns: Array<{ code?: string } | string> | null | undefined,
): boolean {
  const codes = (checkboxAddOns || [])
    .map((a: { code?: string } | string) =>
      String(typeof a === "string" ? a : a?.code || "")
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  if (!codes.length) return false;
  const selected = new Set(
    (selectedCodes || []).map((c: string) => String(c).toUpperCase()),
  );
  return codes.every((code: string) => selected.has(code));
}

export function getAddOnQuantity(
  selectedCodes: string[] | null | undefined,
  code: string,
): number {
  const normalized = String(code).toUpperCase();
  return (selectedCodes || []).filter(
    (c: string) => String(c).toUpperCase() === normalized,
  ).length;
}

/**
 * Set quantity for a quantity-based add-on (0 removes it).
 * Other selected codes are preserved.
 */
export function setAddOnQuantity(
  selectedCodes: string[] | null | undefined,
  code: string,
  quantity: number,
  max: number = MAX_QUANTITY_ADDON,
): string[] {
  const normalized = String(code).toUpperCase();
  const others = (selectedCodes || []).filter(
    (c: string) => String(c).toUpperCase() !== normalized,
  );
  const qty = Math.max(0, Math.min(max, Math.floor(Number(quantity) || 0)));
  if (qty <= 0) return others;
  return [...others, ...Array.from({ length: qty }, () => normalized)];
}

/** Unique selected add-on types (quantity seats count as 1 type). */
export function countSelectedAddOnTypes(
  selectedCodes: string[] | null | undefined,
): number {
  return new Set(
    (selectedCodes || [])
      .map((c: string) => String(c).toUpperCase())
      .filter(Boolean),
  ).size;
}

export function getSelectedAddOns(
  addOns: PricingAddOn[] | null | undefined,
  selectedCodes: string[] | null | undefined,
): Array<PricingAddOn & { quantity: number }> {
  const counts = new Map<string, number>();
  for (const raw of selectedCodes || []) {
    const code = String(raw).toUpperCase();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return (addOns || [])
    .filter((addOn: PricingAddOn) =>
      counts.has(String(addOn.code).toUpperCase()),
    )
    .map((addOn: PricingAddOn) => ({
      ...addOn,
      quantity: counts.get(String(addOn.code).toUpperCase()) || 1,
    }));
}

export function getAddOnsCycleTotal(
  selectedAddOns: SelectedAddOn[] | null | undefined,
  billingCycle: string,
): number {
  const monthly = (selectedAddOns || []).reduce(
    (sum: number, addOn: SelectedAddOn) => {
      const qty = Math.max(1, Number(addOn.quantity) || 1);
      return sum + Number(addOn.priceMonthly || 0) * qty;
    },
    0,
  );
  return billingCycle === "YEARLY" ? monthly * 12 : monthly;
}

/** Expand selected add-ons (with quantity) into a codes array for checkout APIs. */
export function expandAddOnCodesForCheckout(
  selectedAddOns: SelectedAddOn[] | null | undefined,
): string[] {
  return (selectedAddOns || []).flatMap((addOn: SelectedAddOn) => {
    const qty = Math.max(1, Number(addOn.quantity) || 1);
    return Array.from({ length: qty }, () => addOn.code);
  });
}

export function getApplicableSelectedAddOns(
  addOns: PricingAddOn[] | null | undefined,
  selectedCodes: string[] | null | undefined,
  packageCode: string | null | undefined,
  billingCycle: string = "MONTHLY",
): Array<PricingAddOn & { quantity: number }> {
  return getSelectedAddOns(
    filterAddOnsForPackage(addOns, packageCode, billingCycle),
    selectedCodes,
  );
}

/** Human-readable plan labels for add-on availability chips. */
export function getAddOnAvailabilityLabel(addOn: PricingAddOn): string {
  if (addOn.note) return addOn.note;
  const available = addOn.availableForPackageCodes || [];
  if (available.length === 0) return "All plans";
  return available
    .map((code: string) => {
      const c = String(code).toUpperCase();
      if (c === "BASIC") return "Starter";
      if (c === "PRO") return "Pro";
      if (c === "ELITE") return "Elite";
      return c;
    })
    .join(" / ");
}

/** Display title for quantity add-ons. */
export function getAddOnDisplayName(addOn: PricingAddOn): string {
  if (isQuantityAddOn(addOn)) return "Additional Users";
  return addOn.name;
}

export function buildCheckoutSummary(
  pkg: PricingPackage | null | undefined,
  billingCycle: "MONTHLY" | "YEARLY" | string,
  selectedAddOns: SelectedAddOn[],
  formatPrice: (value: number | string) => string,
) {
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
      ...selectedAddOns.map((addOn: SelectedAddOn) => {
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
