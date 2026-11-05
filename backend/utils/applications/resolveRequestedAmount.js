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

function readFieldValue(fields, keys) {
  const field = (fields || []).find((item) =>
    keys.includes(item?.fieldKey || item?.builderField?.fieldKey),
  );
  if (!field || field.value == null || field.value === "") return null;
  return field.value;
}

/**
 * Columns on LoanApplication that lists and other portals read directly.
 * Submission fields stay the source of truth; these stay aligned after an edit.
 */
function buildLoanApplicationSyncFromFields(fields = []) {
  const data = {};

  const amount = parseRequestedAmountFromFields(fields);
  if (amount != null) data.amountRequested = amount;

  const purpose = readFieldValue(fields, ["purpose"]);
  if (typeof purpose === "string" && purpose.trim()) {
    data.purpose = purpose.trim();
  }

  const term = Number(readFieldValue(fields, ["loanTerm", "loan_term"]));
  if (Number.isFinite(term) && term > 0) {
    data.termMonthsRequested = Math.round(term);
  }

  return data;
}

module.exports = {
  parseRequestedAmountFromFields,
  resolveRequestedAmount,
  buildLoanApplicationSyncFromFields,
};
