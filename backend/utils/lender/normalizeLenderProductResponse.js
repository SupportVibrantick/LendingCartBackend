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
  "preferredDscr",
  "maximumDebtService",
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
  "minPropertyValueAmount",
  "maxPropertyValueAmount",
  "maxLtvCashOutPercent",
  "minRentalIncomeAmount",
  "rehabFundsMaxPercent",
  "minOccupancyPercent",
  "minAnnualNoiAmount",
  "minDscrFixedRate",
  "minDscrArm",
  "maxStabilizedLtvPercent",
  "minLoanSizeForPropertyTypeAmount",
  "minPortfolioValueAmount",
  "maxPortfolioValueAmount",
  "minPortfolioNoiAmount",
  "minPortfolioRentalIncomeAmount",
  "minCashReservesAmount",
  "minEbitdaAmount",
  "minEquipmentValueAmount",
  "maxEquipmentValueAmount",
  "maxAdvanceRatePercent",
  "minMonthlyArAmount",
  "concentrationLimitPercent",
  "minInvoiceSizeAmount",
  "maxInvoiceSizeAmount",
  "maxInvoiceDilutionPercent",
  "minEligibleArAmount",
  "maxArConcentrationPercent",
  "minMonthlyPayablesAmount",
  "maxVendorConcentrationPercent",
  "minEligiblePayablesAmount",
  "maxPayablesConcentrationPercent",
  "minPoAmountAmount",
  "maxPoAmountAmount",
  "maxCustomerConcentrationPercent",
  "minGrossProfitMarginPercent",
  "minCustomerDepositPercent",
  "minEligiblePoValueAmount",
  "maxPoConcentrationPercent",
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
 * Normalize propertyTypes / businessTypes JSON that may be stored as:
 * - Array of { type|name, subTypes[] }
 * - Object map { "Multifamily": ["Garden", ...] }
 * - Array of plain strings ["MULTIFAMILY"]
 * - JSON string of any of the above
 */
const normalizeGroupedTypes = (value, keyField) => {
  if (value == null || value === "") {
    return [];
  }

  let parsed = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [{ [keyField]: trimmed, subTypes: [] }];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (typeof item === "string" && item.trim()) {
          return { [keyField]: item.trim(), subTypes: [] };
        }
        if (!item || typeof item !== "object") return null;
        const key = item[keyField] ?? item.type ?? item.name;
        if (typeof key !== "string" || !key.trim()) return null;
        const subTypes = Array.isArray(item.subTypes)
          ? item.subTypes.filter((s) => typeof s === "string" && s.trim())
          : [];
        return { [keyField]: key.trim(), subTypes };
      })
      .filter(Boolean);
  }

  if (typeof parsed === "object") {
    return Object.entries(parsed)
      .filter(([key]) => typeof key === "string" && key.trim())
      .map(([key, list]) => ({
        [keyField]: key.trim(),
        subTypes: Array.isArray(list)
          ? list.filter((s) => typeof s === "string" && s.trim())
          : [],
      }));
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
    businessTypes: normalizeGroupedTypes(item.businessTypes, "name"),
    propertyTypes: normalizeGroupedTypes(item.propertyTypes, "type"),
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
  normalizeGroupedTypes,
};
