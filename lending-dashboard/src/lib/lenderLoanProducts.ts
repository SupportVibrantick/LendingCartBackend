export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
};

/** Hidden from lender loan-program picker (canonical codes are shown instead). */
export const LENDER_HIDDEN_PRODUCT_CODES = new Set([
  "BRIDGE_LOAN_1_TO_4_UNITS",
  "CONSTRUCTION_LOAN_1_TO_4_UNITS",
]);

/** Residential variant → canonical lender-facing code. */
export const LENDER_CANONICAL_PRODUCT_CODE: Record<string, string> = {
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE_LOAN",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION_LOAN",
};

export function resolveLenderOfferedProductCode(code: string) {
  return LENDER_CANONICAL_PRODUCT_CODE[code] || code;
}

export function filterLenderCatalogProducts<T extends CatalogProduct>(
  products: T[],
): T[] {
  return products.filter((product) => !LENDER_HIDDEN_PRODUCT_CODES.has(product.code));
}

export function normalizeLenderProductRecord(
  item: Record<string, any>,
): Record<string, any> {
  const loanProductCode =
    item.loanProductCode || item.loanProduct?.code || item.code || "";

  return {
    ...item,
    loanProductCode,
    code: item.code || item.loanProduct?.code || loanProductCode,
    loanProductId: item.loanProductId || item.loanProduct?.id || null,
  };
}

export function mergeCriteriaForms(
  base: Record<string, any>,
  incoming: Record<string, any>,
): Record<string, any> {
  const merged = { ...base };

  Object.entries(incoming).forEach(([key, value]) => {
    if (value === "" || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      return;
    }

    merged[key] = value;
  });

  return merged;
}

export function buildLoanCriteriaFromLenderProducts(
  lenderProducts: Array<Record<string, any>>,
  catalogProducts: CatalogProduct[],
  mapProductToCriteriaForm: (product: any) => Record<string, any>,
): Record<string, any> {
  const loanCriteria: Record<string, any> = {};

  lenderProducts.forEach((item) => {
    const normalized = normalizeLenderProductRecord(item);
    const programId = mapToCanonicalCatalogId(
      catalogProducts,
      normalized.loanProductCode || normalized.code,
      String(normalized.loanProductId || ""),
    );

    if (!programId) return;

    const canonicalCode = resolveLenderOfferedProductCode(
      normalized.loanProductCode || normalized.code || "",
    );

    const mapped = mapProductToCriteriaForm({
      ...normalized,
      loanProductCode: canonicalCode,
      code: canonicalCode,
    });

    loanCriteria[programId] = loanCriteria[programId]
      ? mergeCriteriaForms(loanCriteria[programId], mapped)
      : mapped;
  });

  return loanCriteria;
}

/** Map a saved lender product to the canonical catalog row id. */
export function mapToCanonicalCatalogId(
  catalogProducts: CatalogProduct[],
  lenderProductCode?: string | null,
  lenderProductId?: string | null,
): string | null {
  const normalizedLenderProductId = lenderProductId
    ? String(lenderProductId)
    : null;

  const code =
    lenderProductCode ||
    catalogProducts.find(
      (product) => String(product.id) === normalizedLenderProductId,
    )?.code;

  if (!code) {
    return normalizedLenderProductId;
  }

  const canonicalCode = resolveLenderOfferedProductCode(code);
  const canonicalProduct = catalogProducts.find(
    (product) => product.code === canonicalCode,
  );

  const resolvedId = canonicalProduct?.id || normalizedLenderProductId;
  return resolvedId ? String(resolvedId) : null;
}
