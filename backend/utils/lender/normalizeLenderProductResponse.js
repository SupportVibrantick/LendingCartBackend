/**
 * Normalize lender product records for admin/lender API responses.
 * Converts Prisma Decimal fields to plain strings for form binding.
 */

const DECIMAL_STRING_FIELDS = [
  "minLoanAmount",
  "maxLoanAmount",
  "maxLtvPercent",
  "minMezzLtvPercent",
  "maxMezzLtvPercent",
  "exitFeePercent",
  "preferredReturnPercent",
  "maxArvPercent",
  "maxLtcPercent",
  "originationPointsPercent",
  "minDscr",
  "minDebtYieldPercent",
  "minRateSpreadPercent",
  "maxRateSpreadPercent",
  "sbaGuaranteePercent",
  "requiredInjectionPercent",
  "minAnnualRevenue",
  "maxFinancingPercent",
  "maxTotalProjectAmount",
  "maxSba504DebentureAmount",
  "maxUsdaGuaranteeAmount",
  "usdaGuaranteePercent",
  "advanceRatePercent",
  "transactionFeePercent",
  "minGrossMarginPercent",
  "discountFeePercent",
  "earlyPaymentDiscountPercent",
];

const decimalToString = (val) =>
  val === null || val === undefined ? null : val.toString();

const normalizeDecimalFields = (item) =>
  DECIMAL_STRING_FIELDS.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      acc[field] = decimalToString(item[field]);
    }
    return acc;
  }, {});

const normalizeStatesSupported = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeEquipmentTypes = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }

  return [];
};

/**
 * @param {object} item - Raw Prisma lenderProduct row (may include relations)
 * @param {{ documents?: array }} [options]
 */
function normalizeLenderProductForAdminApi(item, options = {}) {
  const { documents = [] } = options;

  return {
    ...item,
    ...normalizeDecimalFields(item),
    statesSupported: normalizeStatesSupported(item.statesSupported),
    equipmentTypes: normalizeEquipmentTypes(item.equipmentTypes),
    businessTypes: Array.isArray(item.businessTypes) ? item.businessTypes : [],
    propertyTypes: Array.isArray(item.propertyTypes) ? item.propertyTypes : [],
    documents,
  };
}

module.exports = {
  DECIMAL_STRING_FIELDS,
  decimalToString,
  normalizeDecimalFields,
  normalizeLenderProductForAdminApi,
  normalizeStatesSupported,
  normalizeEquipmentTypes,
};
