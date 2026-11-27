/** Display helpers mirrored from loan-ai Pricing (marketing site). */

export const YEARLY_SAVE_PERCENT = 20;

export const LOAN_CATEGORY_CHILDREN: Record<string, string[]> = {
  "1-4 unit Residential": [
    "Bridge Loans",
    "Fix & Flip Loans",
    "DSCR Loans",
    "Construction Loans",
    "Rental portfolio Loans",
  ],
  "CRE & Multifamily": [
    "Bridge Loans",
    "Value Add Property Loans",
    "Construction Loans",
    "CRE Permanent Loans",
    "Conventional Loans",
    "CMBS Loans",
    "Agency Loans for Multifamily",
    "C-Pace Loans",
    "Mezzanine & Preferred Equity",
  ],
  "SBA & USDA Loans": [
    "SBA 7(a) Express",
    "SBA 7(a) Business Acquisition",
    "SBA 7(a) Equipment Finance",
    "SBA 7(a) Working Capital",
    "SBA 7(a) Real Estate + Construction",
    "SBA 504 Real Estate + Business",
    "SBA 504 Real Estate Construction",
    "USDA Business & Industry",
  ],
  "Asset-Based Lending": [
    "Equipment Finance",
    "Accounts Receivable Finance",
    "Accounts Payable Finance",
    "Purchase Order Finance",
  ],
};

export type DisplayBilling = "MONTHLY" | "YEARLY";

export type PricingPackage = {
  id: string;
  name: string;
  code: string;
  priceMonthly: number;
  priceYearly?: number | null;
  priceYearlyMonthly?: number | null;
  isPopular?: boolean;
  badge?: string | null;
  features?: unknown;
  featureGroups?: Array<{
    heading?: string | null;
    variant?: string;
    items?: unknown[];
  }>;
  includedUsers?: number;
  maxUsers?: number;
  extraUserPrice?: number;
};

export type PricingAddOn = {
  code: string;
  name: string;
  priceMonthly?: number;
  priceYearlyMonthly?: number | null;
  quantityBased?: boolean;
  isPurchasable?: boolean;
  includedInPackageCodes?: string[];
  availableForPackageCodes?: string[];
  priceByPackage?: Record<
    string,
    | number
    | {
        monthly?: number;
        yearly?: number;
        MONTHLY?: number;
        YEARLY?: number;
      }
  >;
  note?: string | null;
};

export type FeatureItem = { label: string; children: string[] };

export type FeatureGroup = {
  heading: string | null;
  variant: "highlight" | "default" | string;
  items: FeatureItem[];
};

export function formatPrice(value: number | null | undefined) {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function getAccent(code?: string | null) {
  const key = String(code || "").toUpperCase();
  const map: Record<
    string,
    { ring: string; badge: string; price: string; cta: string; primary: string }
  > = {
    BASIC: {
      ring: "border-slate-200",
      badge: "bg-slate-100 text-slate-600",
      price: "text-slate-900",
      cta: "border border-slate-900 bg-white text-slate-900 hover:bg-slate-50",
      primary:
        "bg-gradient-to-r from-[#4B83FF] to-blue-600 text-white shadow-[0_8px_28px_rgba(75,131,255,0.35)] hover:shadow-[0_10px_36px_rgba(75,131,255,0.45)]",
    },
    STARTER: {
      ring: "border-slate-200",
      badge: "bg-slate-100 text-slate-600",
      price: "text-slate-900",
      cta: "border border-slate-900 bg-white text-slate-900 hover:bg-slate-50",
      primary:
        "bg-gradient-to-r from-[#4B83FF] to-blue-600 text-white shadow-[0_8px_28px_rgba(75,131,255,0.35)] hover:shadow-[0_10px_36px_rgba(75,131,255,0.45)]",
    },
    PRO: {
      ring: "border-[#4B83FF]/50 shadow-[0_0_40px_rgba(75,131,255,0.15)]",
      badge: "bg-[#4B83FF] text-white",
      price: "text-slate-900",
      cta: "bg-[#4B83FF] text-white hover:bg-[#3a6fe0]",
      primary:
        "bg-gradient-to-r from-[#4B83FF] to-indigo-500 text-white shadow-[0_8px_28px_rgba(75,131,255,0.4)] hover:shadow-[0_12px_40px_rgba(75,131,255,0.55)]",
    },
    ELITE: {
      ring: "border-emerald-400/40 shadow-[0_0_40px_rgba(16,185,129,0.12)]",
      badge: "bg-emerald-500 text-white",
      price: "text-slate-900",
      cta: "bg-emerald-500 text-white hover:bg-emerald-600",
      primary:
        "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 shadow-[0_8px_28px_rgba(251,191,36,0.35)] hover:shadow-[0_12px_40px_rgba(251,191,36,0.5)]",
    },
  };
  return map[key] || map.BASIC;
}

function normalizeFeatureItem(item: unknown): {
  label: string;
  children: string[];
} | null {
  if (item == null) return null;
  if (typeof item === "string") {
    const label = item.trim();
    if (!label) return null;
    const baseLabel = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const children =
      LOAN_CATEGORY_CHILDREN[baseLabel] || LOAN_CATEGORY_CHILDREN[label] || [];
    return { label: children.length ? baseLabel : label, children };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const label = String(obj.label || obj.name || obj.title || "").trim();
    if (!label) return null;
    const rawChildren = obj.children || obj.items || obj.subItems || [];
    let children = Array.isArray(rawChildren)
      ? rawChildren.map((child) => String(child).trim()).filter(Boolean)
      : [];
    if (!children.length) children = LOAN_CATEGORY_CHILDREN[label] || [];
    return { label, children };
  }
  return null;
}

export function normalizeFeatureGroups(pkg: PricingPackage): FeatureGroup[] {
  const notNull = (
    item: FeatureItem | null,
  ): item is FeatureItem => item != null;

  if (Array.isArray(pkg?.featureGroups) && pkg.featureGroups.length > 0) {
    return pkg.featureGroups
      .map((group) => ({
        heading: group?.heading ? String(group.heading).trim() : null,
        variant: group?.variant === "highlight" ? "highlight" : "default",
        items: Array.isArray(group?.items)
          ? group.items.map(normalizeFeatureItem).filter(notNull)
          : [],
      }))
      .filter((group) => group.items.length > 0);
  }

  const features = Array.isArray(pkg?.features)
    ? pkg.features.filter(Boolean)
    : typeof pkg?.features === "string" && pkg.features.trim()
      ? pkg.features.includes("\n")
        ? pkg.features
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        : pkg.features
            .split(/[,;|]/)
            .map((item) => item.trim())
            .filter(Boolean)
      : [];

  if (!features.length) return [];
  return [
    {
      heading: null,
      variant: "default",
      items: features.map(normalizeFeatureItem).filter(notNull),
    },
  ];
}

export function getDisplayPrice(
  pkg: PricingPackage,
  billingCycle: DisplayBilling,
) {
  if (billingCycle === "YEARLY" && pkg.priceYearly != null) {
    const yearlyTotal = Number(pkg.priceYearly);
    const monthlyEquivalent =
      pkg.priceYearlyMonthly != null &&
      Number.isFinite(Number(pkg.priceYearlyMonthly))
        ? Number(pkg.priceYearlyMonthly)
        : Math.round(yearlyTotal / 12);
    return {
      amount: monthlyEquivalent,
      suffix: "/ month",
      billingLabel: "Billed yearly",
      billedToday: yearlyTotal,
    };
  }

  return {
    amount: Number(pkg.priceMonthly) || 0,
    suffix: "/ month",
    billingLabel: "Billed monthly",
    billedToday: null as number | null,
  };
}

export function isQuantityAddOn(addOnOrCode: PricingAddOn | string | undefined) {
  if (!addOnOrCode) return false;
  if (typeof addOnOrCode === "string") {
    return String(addOnOrCode).toUpperCase() === "EXTRA_USER";
  }
  if (addOnOrCode.quantityBased) return true;
  return String(addOnOrCode.code || "").toUpperCase() === "EXTRA_USER";
}

export function resolveAddOnPriceForPackage(
  addOn: PricingAddOn,
  packageCode: string | null | undefined,
  billingCycle: DisplayBilling = "MONTHLY",
) {
  const pkgCode = String(packageCode || "").toUpperCase();
  const isYearly = billingCycle === "YEARLY";
  const byPkg = addOn?.priceByPackage;

  if (byPkg && typeof byPkg === "object" && pkgCode && byPkg[pkgCode] != null) {
    const entry = byPkg[pkgCode];
    if (entry != null && typeof entry === "object" && !Array.isArray(entry)) {
      const priced = isYearly
        ? entry.yearly ?? (entry as { YEARLY?: number }).YEARLY
        : entry.monthly ?? (entry as { MONTHLY?: number }).MONTHLY;
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

const PACKAGE_RANK: Record<string, number> = {
  BASIC: 1,
  STARTER: 1,
  PRO: 2,
  ELITE: 3,
};

export function packageRank(code?: string | null) {
  return PACKAGE_RANK[String(code || "").trim().toUpperCase()] || 0;
}

/** Starter/BASIC → Pro/Elite, Pro → Elite */
export function canUpgradePackage(
  fromCode?: string | null,
  toCode?: string | null,
) {
  return packageRank(toCode) > packageRank(fromCode);
}

export function filterAddOnsForPackage(
  addOns: PricingAddOn[],
  packageCode: string | null | undefined,
  billingCycle: DisplayBilling = "MONTHLY",
) {
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
      priceMonthly: resolveAddOnPriceForPackage(
        addOn,
        packageCode,
        billingCycle,
      ),
    }));
}
