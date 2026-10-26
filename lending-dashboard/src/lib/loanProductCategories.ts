export type LoanProductCategoryKey =
  | "RESIDENTIAL_1_4"
  | "CRE_MULTIFAMILY"
  | "SBA_USDA"
  | "ABL"
  | "OTHER";

export type KnownLoanProductCategoryKey = Exclude<
  LoanProductCategoryKey,
  "OTHER"
>;

export type LoanProductCategory = {
  key: KnownLoanProductCategoryKey;
  label: string;
};

/** Display order for loan-program pickers. */
export const LOAN_PRODUCT_CATEGORIES: LoanProductCategory[] = [
  { key: "RESIDENTIAL_1_4", label: "1-4 Units Residential" },
  { key: "CRE_MULTIFAMILY", label: "CRE & Multifamily" },
  { key: "SBA_USDA", label: "SBA & USDA" },
  { key: "ABL", label: "Asset Based Lending" },
];

const CATEGORY_PRODUCT_CODES: Record<KnownLoanProductCategoryKey, string[]> = {
  RESIDENTIAL_1_4: [
    "BRIDGE_LOAN_1_TO_4_UNITS",
    "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    "DSCR_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
  ],
  CRE_MULTIFAMILY: [
    "BRIDGE_LOAN",
    "CONSTRUCTION_LOAN",
    "RENTAL_PORTFOLIO_CRE",
    "CRE_PERMANENT_LOAN",
    "AGENCY_LOAN_MULTIFAMILY",
    "CMBS",
    "MEZZANINE_FINANCE",
    "PREFERRED_EQUITY",
    "VALUE_ADDED_PROPERTY",
    "C_PACE",
  ],
  SBA_USDA: [
    "SBA_7A_BUSINESS_ACQUISITION",
    "SBA_7A_WORKING_CAPITAL",
    "SBA_7A_EQUIPMENT_PURCHASE",
    "SBA_7A_REAL_ESTATE",
    "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
    "SBA_EXPRESS",
    "USDA_BI",
  ],
  ABL: [
    "EQUIPMENT_FINANCE",
    "PURCHASE_ORDER_FINANCE",
    "ACCOUNTS_RECEIVABLE",
    "ACCOUNTS_RECEIVABLE_FINANCE",
    "ACCOUNTS_PAYABLE_FINANCE",
    "ASSET_BASED_LENDING",
    "INVOICE_FACTORING",
  ],
};

const CODE_TO_CATEGORY = new Map<string, KnownLoanProductCategoryKey>();
for (const category of LOAN_PRODUCT_CATEGORIES) {
  for (const code of CATEGORY_PRODUCT_CODES[category.key]) {
    CODE_TO_CATEGORY.set(code, category.key);
  }
}

export function getLoanProductCategoryKey(
  code?: string | null,
): LoanProductCategoryKey {
  if (!code) return "OTHER";
  return CODE_TO_CATEGORY.get(String(code).trim().toUpperCase()) || "OTHER";
}

export function getLoanProductCategoryLabel(
  key: LoanProductCategoryKey,
): string {
  if (key === "OTHER") return "Other";
  return (
    LOAN_PRODUCT_CATEGORIES.find((category) => category.key === key)?.label ||
    "Other"
  );
}

type CategorizedProduct<T extends { code: string }> = {
  key: LoanProductCategoryKey;
  label: string;
  products: T[];
};

const CATEGORY_RANK: Record<LoanProductCategoryKey, number> = {
  RESIDENTIAL_1_4: 0,
  CRE_MULTIFAMILY: 1,
  SBA_USDA: 2,
  ABL: 3,
  OTHER: 4,
};

/** Stable sort: category order, then catalog order within category. */
export function sortLoanProductsByCategory<T extends { code: string }>(
  products: T[],
): T[] {
  return [...products].sort((a, b) => {
    const aKey = getLoanProductCategoryKey(a.code);
    const bKey = getLoanProductCategoryKey(b.code);
    const rankDiff = CATEGORY_RANK[aKey] - CATEGORY_RANK[bKey];
    if (rankDiff !== 0) return rankDiff;

    if (aKey === "OTHER" || bKey === "OTHER") {
      return String(a.code).localeCompare(String(b.code));
    }

    const order = CATEGORY_PRODUCT_CODES[aKey];
    const ai = order.indexOf(a.code);
    const bi = order.indexOf(b.code);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

/** Group products into category sections in the required UI order. */
export function groupLoanProductsByCategory<T extends { code: string }>(
  products: T[],
): CategorizedProduct<T>[] {
  const buckets = new Map<LoanProductCategoryKey, T[]>();

  for (const product of products) {
    const key = getLoanProductCategoryKey(product.code);
    const list = buckets.get(key) || [];
    list.push(product);
    buckets.set(key, list);
  }

  const ordered: CategorizedProduct<T>[] = [];

  for (const category of LOAN_PRODUCT_CATEGORIES) {
    const productsInCategory = buckets.get(category.key);
    if (!productsInCategory?.length) continue;

    const order = CATEGORY_PRODUCT_CODES[category.key];
    productsInCategory.sort((a, b) => {
      const ai = order.indexOf(a.code);
      const bi = order.indexOf(b.code);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    ordered.push({
      key: category.key,
      label: category.label,
      products: productsInCategory,
    });
  }

  const other = buckets.get("OTHER");
  if (other?.length) {
    ordered.push({ key: "OTHER", label: "Other", products: other });
  }

  return ordered;
}
