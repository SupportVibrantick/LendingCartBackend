const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveNumberOrNull = (value) => {
  const parsed = toNumberOrNull(value);
  return parsed && parsed > 0 ? parsed : null;
};

const DECIMAL_PRODUCT_FIELDS = [
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
  "minAnnualRevenue",
  "maxFinancingPercent",
  "minLoanAmount",
  "maxLoanAmount",
  "requiredInjectionPercent",
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

const normalizeDecimalFields = (product) =>
  DECIMAL_PRODUCT_FIELDS.reduce((acc, field) => {
    acc[field] = toNumberOrNull(product[field]);
    return acc;
  }, {});

const toStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim());
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === "string" && item.trim())
        : [];
    } catch {
      return [];
    }
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toGroupedSelectionMap = (value, keyField) => {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return toGroupedSelectionMap(parsed, keyField);
    } catch {
      return {};
    }
  }

  if (Array.isArray(value)) {
    return value.reduce((acc, item) => {
      if (!item || typeof item !== "object") {
        return acc;
      }

      const key = item[keyField];
      const list = Array.isArray(item.subTypes)
        ? item.subTypes.filter(
            (subType) => typeof subType === "string" && subType.trim(),
          )
        : [];

      if (typeof key === "string" && key.trim()) {
        acc[key] = list;
      }

      return acc;
    }, {});
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, list]) => {
      if (!key) {
        return acc;
      }

      acc[key] = Array.isArray(list)
        ? list.filter((item) => typeof item === "string" && item.trim())
        : [];

      return acc;
    }, {});
  }

  return {};
};

const LENDER_PRODUCT_INCLUDE = {
  loanProduct: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  lenderDocumentRequirements: {
    include: {
      documentType: {
        select: {
          id: true,
          name: true,
          code: true,
          isCustom: true,
        },
      },
    },
  },
};

function formatLenderProductListItem(product) {
  const p = product;

  return {
    ...p,
    ...normalizeDecimalFields(p),
    code: p.loanProduct?.code || p.loanProductCode || null,
    name: p.loanProduct?.name || null,
    minLoanAmount: toNumberOrNull(p.minLoanAmount),
    maxLoanAmount: toPositiveNumberOrNull(p.maxLoanAmount),
    minTermMonths: toPositiveNumberOrNull(p.minTermMonths),
    maxTermMonths: toPositiveNumberOrNull(p.maxTermMonths),
    minCreditScore: toPositiveNumberOrNull(p.minCreditScore),
    avgTurnaroundDays: toPositiveNumberOrNull(p.avgTurnaroundDays),
    amortizationYears: toPositiveNumberOrNull(p.amortizationYears),
    minUnits: toPositiveNumberOrNull(p.minUnits),
    minPropertiesInPortfolio: toPositiveNumberOrNull(p.minPropertiesInPortfolio),
    maxPropertiesInPortfolio: toPositiveNumberOrNull(p.maxPropertiesInPortfolio),
    minTimeInBusinessMonths: toPositiveNumberOrNull(p.minTimeInBusinessMonths),
    maxTermRealEstateMonths: toPositiveNumberOrNull(p.maxTermRealEstateMonths),
    maxTermEquipmentMonths: toPositiveNumberOrNull(p.maxTermEquipmentMonths),
    maxInvoiceAgeDays: toPositiveNumberOrNull(p.maxInvoiceAgeDays),
    paymentTermsExtensionDays: toPositiveNumberOrNull(
      p.paymentTermsExtensionDays,
    ),
    businessTypes: toGroupedSelectionMap(p.businessTypes, "name"),
    propertyTypes: toGroupedSelectionMap(p.propertyTypes, "type"),
    statesSupported: toStringArray(p.statesSupported),
    equipmentTypes: toStringArray(p.equipmentTypes),
    interestRateRange:
      typeof p.interestRateRange === "string"
        ? p.interestRateRange.replace(/%/g, "")
        : p.interestRateRange,
    documents:
      p.lenderDocumentRequirements?.map((doc) => ({
        id: doc.id,
        documentTypeId: doc.documentTypeId,
        documentName: doc.documentType?.name || null,
        documentCode: doc.documentType?.code || null,
        isCustom: doc.documentType?.isCustom || false,
        isRequired: doc.isRequired,
        minFiles: doc.minFiles,
        maxFiles: doc.maxFiles,
        notes: doc.notes,
        sortOrder: doc.sortOrder,
        createdAt: doc.createdAt,
      })) || [],
  };
}

module.exports = {
  LENDER_PRODUCT_INCLUDE,
  formatLenderProductListItem,
};
