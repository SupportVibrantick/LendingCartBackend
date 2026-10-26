export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
};

/** No products are hidden — residential and CRE variants are separate catalog rows. */
export const LENDER_HIDDEN_PRODUCT_CODES = new Set<string>();

/** Identity map — residential vs CRE codes stay distinct. */
export const LENDER_CANONICAL_PRODUCT_CODE: Record<string, string> = {};

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

/** Map a saved lender product to the catalog row id (exact code match). */
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
