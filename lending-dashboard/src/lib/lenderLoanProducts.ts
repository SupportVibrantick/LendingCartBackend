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

/** Map a saved lender product to the canonical catalog row id. */
export function mapToCanonicalCatalogId(
  catalogProducts: CatalogProduct[],
  lenderProductCode?: string | null,
  lenderProductId?: string | null,
): string | null {
  const code =
    lenderProductCode ||
    catalogProducts.find((product) => product.id === lenderProductId)?.code;

  if (!code) {
    return lenderProductId || null;
  }

  const canonicalCode = resolveLenderOfferedProductCode(code);
  const canonicalProduct = catalogProducts.find(
    (product) => product.code === canonicalCode,
  );

  return canonicalProduct?.id || lenderProductId || null;
}
