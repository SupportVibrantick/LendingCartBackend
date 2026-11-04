/**
 * Resolve loan amount from submission/edit field payloads.
 * Accepts either API edit field shapes ({ fieldKey, value }) or
 * Prisma submission field rows (fieldKey / builderField.fieldKey).
 */
function parseRequestedAmountFromFields(fields = []) {
  if (!Array.isArray(fields) || fields.length === 0) return null;

  const amountField = fields.find((field) => {
    const key = field?.fieldKey || field?.builderField?.fieldKey || null;
    return key === "amountRequested" || key === "loan_amount";
  });

  if (!amountField || amountField.value == null || amountField.value === "") {
    return null;
  }

  const amount = Number(amountField.value);
  return Number.isFinite(amount) ? amount : null;
}

function resolveRequestedAmount(fields = [], fallbackAmount = null) {
  const fromFields = parseRequestedAmountFromFields(fields);
  if (fromFields != null) return fromFields;

  if (fallbackAmount == null || fallbackAmount === "") return null;
  const fallback = Number(fallbackAmount);
  return Number.isFinite(fallback) && fallback !== 0 ? fallback : null;
}

module.exports = {
  parseRequestedAmountFromFields,
  resolveRequestedAmount,
};
