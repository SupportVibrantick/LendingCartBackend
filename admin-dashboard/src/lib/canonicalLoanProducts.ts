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
  return products.filter(
    (product) => !LENDER_HIDDEN_PRODUCT_CODES.has(product.code),
  );
}

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
