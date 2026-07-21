const {
  buildLenderProductPrismaFields,
} = require("./buildLenderProductPrismaFields");

/**
 * Build a partial Prisma update payload from only the fields present on `item`.
 * Used by lender/admin update routes (PATCH-style semantics).
 */
function buildLenderProductUpdateFields(item, productCode) {
  const inputKeys = new Set(Object.keys(item || {}));
  const fullPayload = buildLenderProductPrismaFields({
    ...item,
    loanProductCode: productCode,
  });

  const updateData = {};

  for (const key of inputKeys) {
    if (key === "documents") continue;
    if (Object.prototype.hasOwnProperty.call(fullPayload, key)) {
      updateData[key] = fullPayload[key];
    }
  }

  return updateData;
}

module.exports = {
  buildLenderProductUpdateFields,
};
