/**
 * Resolve and validate loan products for broker custom document linking.
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} prisma
 * @param {unknown} loanProductIdsRaw
 */
async function resolveLoanProductsForBrokerDoc(prisma, loanProductIdsRaw) {
  const ids = Array.isArray(loanProductIdsRaw)
    ? [
        ...new Set(
          loanProductIdsRaw
            .map((id) => String(id || "").trim())
            .filter(Boolean),
        ),
      ]
    : [];

  if (ids.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Select at least one loan product",
    };
  }

  const products = await prisma.loanProduct.findMany({
    where: {
      id: { in: ids },
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  });

  if (products.length !== ids.length) {
    return {
      ok: false,
      status: 400,
      message: "One or more selected loan products are invalid or inactive",
    };
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return { ok: true, products: ordered };
}

/**
 * Replace ProductDocumentRequirement rows for a document type.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {string} documentTypeId
 * @param {Array<{ id: string, code: string }>} products
 */
async function syncDocumentTypeLoanProducts(tx, documentTypeId, products) {
  await tx.productDocumentRequirement.deleteMany({
    where: { documentTypeId },
  });

  if (products.length === 0) return;

  await tx.productDocumentRequirement.createMany({
    data: products.map((product) => ({
      documentTypeId,
      loanProductId: product.id,
      loanProductCode: product.code,
      isRequired: true,
    })),
  });
}

/**
 * @param {Array<{ loanProductId?: string | null, loanProductCode: string, loanProduct?: { id: string, code: string, name: string } | null }>} requirements
 */
function mapLoanProductsFromRequirements(requirements = []) {
  return requirements.map((row) => ({
    id: row.loanProduct?.id || row.loanProductId || null,
    code: row.loanProduct?.code || row.loanProductCode,
    name: row.loanProduct?.name || row.loanProductCode,
  }));
}

const LOAN_PRODUCT_ALIAS_GROUPS = [
  ["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS"],
  ["CONSTRUCTION_LOAN", "CONSTRUCTION_LOAN_1_TO_4_UNITS"],
];

/**
 * Resolve a selected loan product filter to all matching IDs/codes (incl. aliases).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ loanProductId?: string | null, loanProductCode?: string | null }} params
 */
async function resolveLoanProductFilter(
  prisma,
  { loanProductId, loanProductCode } = {},
) {
  // Back-compat: previous callers passed a string id
  if (typeof arguments[1] === "string") {
    loanProductId = arguments[1];
    loanProductCode = undefined;
  }

  const id = String(loanProductId || "").trim();
  const code = String(loanProductCode || "").trim();
  if (!id && !code) return null;

  const product = await prisma.loanProduct.findFirst({
    where: {
      ...(id ? { id } : {}),
      ...(code && !id ? { code } : {}),
    },
    select: { id: true, code: true, name: true },
  });

  if (!product) {
    return { ok: false, status: 400, message: "Invalid loan product filter" };
  }

  const aliasCodes =
    LOAN_PRODUCT_ALIAS_GROUPS.find((group) => group.includes(product.code)) || [
      product.code,
    ];

  const related = await prisma.loanProduct.findMany({
    where: { code: { in: aliasCodes } },
    select: { id: true, code: true, name: true },
  });

  return {
    ok: true,
    product,
    productIds: related.map((row) => row.id),
    productCodes: related.map((row) => row.code),
    products: related,
  };
}

module.exports = {
  resolveLoanProductsForBrokerDoc,
  syncDocumentTypeLoanProducts,
  mapLoanProductsFromRequirements,
  resolveLoanProductFilter,
};
