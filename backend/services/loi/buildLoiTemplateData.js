const { mapSubmissionFieldResponse } = require("../applications/staticSubmissionFields");
const {
  calculateLoiMetrics,
  formatLoiMetrics,
} = require("./calculateLoiMetrics");
const { parseFeeAmount } = require("./financedLoanAmount");
const {
  resolveLoanProductName,
} = require("../../utils/loanProducts/resolveLoanProductName.js");

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

const formatPercent = (value, suffix = "%") => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(String(value).replace(/%/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const rounded = Math.round(numeric * 100) / 100;
  return `${rounded}${suffix}`;
};

const formatInterestRate = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();
  if (!raw || raw === "0" || raw === "0%") return "";
  if (/prime|\+/i.test(raw)) return raw;
  const numeric = Number(raw.replace(/%/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `${numeric}%`;
};

const extractFieldValue = (val) => {
  if (val === null || val === undefined) return "";

  if (typeof val === "object") {
    if (typeof val.toNumber === "function") {
      const numeric = val.toNumber();
      return Number.isFinite(numeric) ? String(numeric) : "";
    }
    if (typeof val.toString === "function" && val.constructor?.name === "Decimal") {
      return val.toString();
    }
    return String(
      val.text ?? val.value ?? val.label ?? val.url ?? "",
    ).trim();
  }

  const str = String(val).trim();
  if (!str) return "";

  if (str.startsWith("{") || str.startsWith("[")) {
    try {
      return extractFieldValue(JSON.parse(str));
    } catch {
      return str;
    }
  }

  return str;
};

const toPositiveNumber = (value) => {
  const extracted = extractFieldValue(value);
  if (!extracted) return null;
  const numeric = Number(String(extracted).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

const pickField = (fieldMap, ...keys) => {
  for (const key of keys) {
    const value = fieldMap?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const pickNumericField = (fieldMap, ...keys) => {
  for (const key of keys) {
    const numeric = toPositiveNumber(fieldMap?.[key]);
    if (numeric != null) return numeric;
  }
  return null;
};

function buildSubmissionFieldMap(fields = []) {
  const fieldMap = {};

  for (const field of fields) {
    const mapped = mapSubmissionFieldResponse(field);
    if (!mapped.fieldKey) continue;
    fieldMap[mapped.fieldKey] = extractFieldValue(field.value);
  }

  return fieldMap;
}

const splitTags = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[,;|&/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

function extractGuarantors(fieldMap) {
  const names = [];

  for (let index = 1; index <= 10; index += 1) {
    const name = pickField(
      fieldMap,
      `coBorrower_${index}_name`,
      `coBorrower_${index}_entityName`,
    );
    if (name) names.push(name);
  }

  if (names.length > 0) {
    return names.join(" & ");
  }

  return pickField(fieldMap, "guarantors", "guarantorName", "guarantorNames");
}

function extractLoanPurposeTags(fieldMap, loanApplication) {
  const purpose =
    pickField(fieldMap, "purpose", "loanPurpose", "useOfFunds") ||
    loanApplication?.purpose ||
    "";

  const tags = splitTags(purpose);
  return tags.length > 0 ? tags : purpose ? [purpose] : [];
}

function extractCollateralTags(collaterals = [], fieldMap = {}, lenderProduct) {
  const tags = collaterals
    .map((item) => {
      const parts = [];
      if (item.lienPosition) parts.push(item.lienPosition);
      if (item.collateralType) parts.push(item.collateralType);
      if (item.description && !parts.includes(item.description)) {
        parts.push(item.description);
      }
      return parts.join(" — ");
    })
    .filter(Boolean);

  const propertyType = pickField(fieldMap, "propertyType", "property_type");
  if (propertyType) {
    tags.push(`1st Charge — ${propertyType.replace(/_/g, " ")}`);
  }

  const recourse = pickField(fieldMap, "recourse");
  if (recourse && !tags.some((tag) => /recourse/i.test(tag))) {
    tags.push(recourse.replace(/_/g, " "));
  }

  const fieldCollateral = pickField(fieldMap, "collateral", "collateralTypes");
  splitTags(fieldCollateral).forEach((tag) => {
    if (!tags.includes(tag)) tags.push(tag);
  });

  if (
    lenderProduct?.personalGuaranteeRequired &&
    !tags.some((tag) => /personal guarantee/i.test(tag))
  ) {
    tags.push("Personal Guarantees");
  }

  const propertyAddress = pickField(
    fieldMap,
    "propertyAddress",
    "property_address",
    "address",
  );
  if (propertyAddress && !tags.some((tag) => tag.includes(propertyAddress))) {
    tags.push(propertyAddress);
  }

  return [...new Set(tags)];
}

function extractRequiredDocuments(review) {
  const conditions = review?.conditions || [];
  const docs = conditions
    .map((item) => String(item.description || "").trim())
    .filter(Boolean);

  if (docs.length > 0) return docs;

  return [
    "Last 3 years' Financial Statements",
    "Last 6 months' Bank Statements",
    "Insurance Documentation",
    "Appraisal",
    "Legal Review",
    "Credit Approval",
  ];
}

function calculateMonthlyPayment(loanAmount, interestRate, termMonths) {
  if (!loanAmount || !termMonths || termMonths <= 0) return "";

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) {
    return formatCurrency(loanAmount / termMonths);
  }

  const payment =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  return formatCurrency(payment);
}

function formatTermLabel(fieldMap) {
  const loanTermMonths = Number(
    pickField(fieldMap, "loanTerm", "termMonths", "term_months"),
  );
  const loanTermYears = Number(pickField(fieldMap, "loanTermYears", "termYears"));

  if (loanTermYears > 0) return `${loanTermYears} Years`;
  if (loanTermMonths > 0) {
    if (loanTermMonths % 12 === 0) return `${loanTermMonths / 12} Years`;
    return `${loanTermMonths} Months`;
  }

  return "";
}

function resolveLoanAmount(fieldMap, loanApplication, review) {
  return (
    toPositiveNumber(review?.approvedAmount) ??
    pickNumericField(fieldMap, "amountRequested", "loanAmount", "loan_amount") ??
    toPositiveNumber(loanApplication?.amountRequested) ??
    null
  );
}

function resolvePropertyValue(fieldMap, loanAmount) {
  const direct =
    pickNumericField(
      fieldMap,
      "currentMarketValue",
      "collateralValue",
      "equipmentValue",
      "propertyValue",
      "purchasePrice",
      "appraisedValue",
      "afterRepairValue",
    ) ?? null;

  if (direct != null) return direct;

  const ltv = pickNumericField(fieldMap, "ltvPercentage", "ltv", "ltvPercent");
  if (ltv && loanAmount) {
    return Math.round((loanAmount / ltv) * 100);
  }

  const arv = pickNumericField(fieldMap, "arvPercentage", "arv");
  if (arv && loanAmount) {
    return Math.round((loanAmount / arv) * 100);
  }

  return null;
}

function resolveInterestRate(fieldMap, review, lenderProduct) {
  const reviewRate = toPositiveNumber(review?.interestRate);
  if (reviewRate != null) return reviewRate;

  const fieldRate = pickNumericField(fieldMap, "interestRate", "rate", "interest_rate");
  if (fieldRate != null) return fieldRate;

  const range = lenderProduct?.interestRateRange;
  if (range) return String(range).trim();

  return "";
}

function resolveAmortizationYears(fieldMap, lenderProduct) {
  const fromField = pickField(fieldMap, "amortization", "amortizationYears");
  if (fromField) return fromField;

  if (lenderProduct?.amortizationYears) {
    return String(lenderProduct.amortizationYears);
  }

  return "";
}

function calculateFeeAmount(loanAmount, percentValue) {
  const percent = toPositiveNumber(percentValue);
  if (!loanAmount || percent == null) return "";
  return formatCurrency((loanAmount * percent) / 100);
}

function parseLoanTermMonths(loanTerm) {
  if (!loanTerm) return 0;
  const monthsMatch = String(loanTerm).match(/(\d+)\s*Months?/i);
  if (monthsMatch) return Number(monthsMatch[1]);
  const yearsMatch = String(loanTerm).match(/(\d+)\s*Years?/i);
  if (yearsMatch) return Number(yearsMatch[1]) * 12;
  const numeric = Number(String(loanTerm).replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseAmortizationLabel(amortization) {
  if (!amortization) return "";
  if (/interest\s*only/i.test(amortization)) return "Interest Only";
  return String(amortization);
}

function defaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function normalizeLenderTerms(lenderTerms = {}) {
  if (!lenderTerms || typeof lenderTerms !== "object") return null;

  const approvedAmount = toPositiveNumber(lenderTerms.approvedAmount);
  if (!approvedAmount) return null;

  const interestOnly = Boolean(lenderTerms.interestOnly);

  const closingConditions = Array.isArray(lenderTerms.closingConditions)
    ? lenderTerms.closingConditions
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : ["Clear Title", "Insurance", "Appraisal"];

  const requiredDocuments = Array.isArray(lenderTerms.requiredDocuments)
    ? lenderTerms.requiredDocuments
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : closingConditions;

  const collateralOrPropertyValue =
    toPositiveNumber(lenderTerms.collateralOrPropertyValue) ??
    toPositiveNumber(lenderTerms.collateralValue) ??
    toPositiveNumber(lenderTerms.propertyValue);

  const usesCollateral =
    String(lenderTerms.valueFieldLabel || "")
      .toLowerCase()
      .includes("collateral") ||
    (lenderTerms.collateralValue != null &&
      lenderTerms.propertyValue == null &&
      collateralOrPropertyValue != null);

  return {
    approvedAmount,
    interestRateType: lenderTerms.interestRateType || "FIXED",
    interestRate: toPositiveNumber(lenderTerms.interestRate),
    interestRateDisplay: String(lenderTerms.interestRateDisplay || "").trim(),
    variableRateIndex: String(lenderTerms.variableRateIndex || "").trim(),
    variableRateSpread: toPositiveNumber(lenderTerms.variableRateSpread),
    loanTerm: String(lenderTerms.loanTerm || "").trim(),
    amortization: String(
      lenderTerms.amortization || (interestOnly ? "Interest Only" : "30 Years"),
    ).trim(),
    paymentFrequency: String(
      lenderTerms.paymentFrequency ||
        (interestOnly ? "Interest Only" : "Monthly"),
    ).trim(),
    interestOnly,
    collateralOrPropertyValue,
    propertyValue: usesCollateral ? null : collateralOrPropertyValue,
    collateralValue: usesCollateral ? collateralOrPropertyValue : null,
    valueFieldLabel: String(
      lenderTerms.valueFieldLabel ||
        (usesCollateral ? "Collateral Value" : "Property Value"),
    ).trim(),
    showRehabMetrics:
      typeof lenderTerms.showRehabMetrics === "boolean"
        ? lenderTerms.showRehabMetrics
        : Boolean(
            lenderTerms.rehabConstructionCost ||
              lenderTerms.afterRepairValue ||
              lenderTerms.ltcPercent ||
              lenderTerms.arvPercent ||
              lenderTerms.maximumLtcPercent ||
              lenderTerms.maximumArvPercent,
          ),
    rehabConstructionCost: toPositiveNumber(lenderTerms.rehabConstructionCost),
    afterRepairValue:
      toPositiveNumber(lenderTerms.afterRepairValue) ??
      toPositiveNumber(lenderTerms.arv),
    ltvPercent: toPositiveNumber(lenderTerms.ltvPercent),
    ltcPercent: toPositiveNumber(lenderTerms.ltcPercent),
    arvPercent: toPositiveNumber(lenderTerms.arvPercent),
    maximumLtvPercent: toPositiveNumber(lenderTerms.maximumLtvPercent),
    maximumLtcPercent: toPositiveNumber(lenderTerms.maximumLtcPercent),
    maximumArvPercent: toPositiveNumber(lenderTerms.maximumArvPercent),
    monthlyPayment: toPositiveNumber(lenderTerms.monthlyPayment),
    totalLoanAmount: toPositiveNumber(lenderTerms.totalLoanAmount),
    financedFees: toPositiveNumber(lenderTerms.financedFees),
    originationPoints: toPositiveNumber(lenderTerms.originationPoints),
    originationFeePercent: String(
      lenderTerms.originationFeePercent || "2%",
    ).trim(),
    exitFee: String(lenderTerms.exitFee || "0%").trim(),
    processingFee: String(lenderTerms.processingFee || "$995").trim(),
    underwritingFee: String(lenderTerms.underwritingFee || "$750").trim(),
    appraisalFee: String(lenderTerms.appraisalFee || "").trim(),
    brokerPoints: toPositiveNumber(lenderTerms.brokerPoints),
    wireFee: String(lenderTerms.wireFee || "").trim(),
    totalClosingCosts: toPositiveNumber(lenderTerms.totalClosingCosts),
    requiredReservesPercent: toPositiveNumber(
      lenderTerms.requiredReservesPercent,
    ),
    requiredReservesAmount: toPositiveNumber(
      lenderTerms.requiredReservesAmount,
    ),
    legalFee: String(lenderTerms.legalFee || "Borrower Pays").trim(),
    appraisalRequired: String(lenderTerms.appraisalRequired || "Yes").trim(),
    environmentalReport: String(
      lenderTerms.environmentalReport || "Required",
    ).trim(),
    personalGuarantee: String(lenderTerms.personalGuarantee || "Required").trim(),
    prepaymentPenalty: String(lenderTerms.prepaymentPenalty || "None").trim(),
    recourse: String(lenderTerms.recourse || "Full").trim(),
    closingConditions,
    requiredDocuments,
    specialConditions: Array.isArray(lenderTerms.specialConditions)
      ? lenderTerms.specialConditions
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : String(lenderTerms.specialConditions || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
    expirationDate: String(
      lenderTerms.expirationDate || defaultExpirationDate(),
    ).trim(),
  };
}

function buildLoiTemplateData({
  submission,
  loanApplication,
  lenderRecord,
  applicationLenderId,
  collaterals = [],
  lenderTerms: rawLenderTerms = null,
  lenderBranding = null,
}) {
  const fieldMap = buildSubmissionFieldMap(submission?.fields || []);
  const review = lenderRecord?.lenderReviews?.[0];
  const lenderProduct = lenderRecord?.lenderProduct;
  const brokerUser = loanApplication?.brokerUser;
  const brokerProfile = brokerUser?.brokerProfile;
  const brokerOrg = loanApplication?.brokerOrg;
  const client = loanApplication?.client;
  const primaryContact = client?.contacts?.[0];
  const lenderTerms = normalizeLenderTerms(rawLenderTerms);

  const borrowerFirstName =
    pickField(fieldMap, "borrowerFirstName", "firstName", "first_name") ||
    primaryContact?.firstName ||
    "";
  const borrowerLastName =
    pickField(fieldMap, "borrowerLastName", "lastName", "last_name") ||
    primaryContact?.lastName ||
    "";
  const borrowerName =
    `${borrowerFirstName} ${borrowerLastName}`.trim() ||
    client?.legalName ||
    "";

  const companyName =
    pickField(fieldMap, "companyName", "entityLegalName") ||
    client?.legalName ||
    borrowerName;

  const brokerFirstName = brokerUser?.firstName || "";
  const brokerLastName = brokerUser?.lastName || "";
  const brokerName =
    `${brokerFirstName} ${brokerLastName}`.trim() || brokerOrg?.name || "";

  const email =
    pickField(fieldMap, "email", "borrowerEmail") ||
    primaryContact?.email ||
    "";
  const phone =
    pickField(fieldMap, "phone", "borrowerPhone", "mobile") ||
    primaryContact?.phone ||
    "";
  const city = pickField(fieldMap, "borrowerCity", "propertyCity", "city");
  const state = pickField(fieldMap, "borrowerState", "propertyState", "state");

  const requestedAmountNumeric =
    pickNumericField(fieldMap, "amountRequested", "loanAmount", "loan_amount") ??
    toPositiveNumber(loanApplication?.amountRequested) ??
    null;

  const loanAmountNumeric =
    lenderTerms?.approvedAmount ??
    resolveLoanAmount(fieldMap, loanApplication, review);
  const propertyValueFromTerms =
    toPositiveNumber(lenderTerms?.collateralOrPropertyValue) ??
    toPositiveNumber(lenderTerms?.collateralValue) ??
    toPositiveNumber(lenderTerms?.propertyValue);
  const propertyValueNumeric =
    propertyValueFromTerms ??
    resolvePropertyValue(
      fieldMap,
      loanAmountNumeric || requestedAmountNumeric,
    );
  const valueFieldLabel =
    lenderTerms?.valueFieldLabel ||
    (lenderTerms?.collateralValue != null && lenderTerms?.propertyValue == null
      ? "Collateral Value"
      : "Property Value");

  const rehabFromTerms = toPositiveNumber(lenderTerms?.rehabConstructionCost);
  const arvFromTerms = toPositiveNumber(lenderTerms?.afterRepairValue);

  const projectCostNumeric =
    rehabFromTerms != null || propertyValueFromTerms != null
      ? (propertyValueFromTerms || 0) + (rehabFromTerms || 0) || null
      : pickNumericField(
            fieldMap,
            "totalProjectCost",
            "projectCost",
            "purchasePrice",
          ) != null
        ? (() => {
            const purchase =
              pickNumericField(fieldMap, "purchasePrice", "totalProjectCost", "projectCost") ||
              0;
            const rehab =
              pickNumericField(
                fieldMap,
                "rehabCost",
                "rehabBudget",
                "constructionBudget",
              ) || 0;
            const fromField = pickNumericField(
              fieldMap,
              "totalProjectCost",
              "projectCost",
            );
            if (fromField) return fromField;
            const combined = purchase + rehab;
            return combined > 0 ? combined : purchase || null;
          })()
        : null;

  const afterRepairValueNumeric =
    arvFromTerms ??
    pickNumericField(fieldMap, "afterRepairValue", "arv");

  const ltvFromFields = pickNumericField(
    fieldMap,
    "ltvPercentage",
    "ltv",
    "ltvPercent",
  );
  const ltcFromFields = pickNumericField(
    fieldMap,
    "ltcPercentage",
    "ltc",
    "ltcPercent",
  );

  const interestRateRaw =
    lenderTerms?.interestRateDisplay ||
    resolveInterestRate(fieldMap, review, lenderProduct);
  const interestRateNumeric =
    lenderTerms?.interestRate ??
    (typeof interestRateRaw === "number"
      ? interestRateRaw
      : toPositiveNumber(interestRateRaw));

  const amortizationLabel =
    parseAmortizationLabel(lenderTerms?.amortization) ||
    (() => {
      const years = resolveAmortizationYears(fieldMap, lenderProduct);
      return years ? `${years} Years` : "";
    })();

  const termLabel =
    lenderTerms?.loanTerm || formatTermLabel(fieldMap);

  const originationPercent =
    lenderTerms?.originationFeePercent ||
    (lenderProduct?.originationPointsPercent != null
      ? lenderProduct.originationPointsPercent
      : pickField(fieldMap, "originationPoints", "originationFeePercent"));

  const calculatedMetrics = calculateLoiMetrics({
    approvedAmount: loanAmountNumeric,
    interestRate: interestRateNumeric,
    interestRateType: lenderTerms?.interestRateType || "FIXED",
    loanTerm: termLabel,
    amortization: amortizationLabel,
    paymentFrequency: lenderTerms?.paymentFrequency,
    propertyValue: propertyValueNumeric,
    projectCost: projectCostNumeric,
    originationFeePercent: originationPercent,
    exitFee: lenderTerms?.exitFee,
    processingFee: lenderTerms?.processingFee,
    underwritingFee: lenderTerms?.underwritingFee,
  });
  const formattedMetrics = formatLoiMetrics(calculatedMetrics);

  const totalLoanAmountNumeric =
    calculatedMetrics.totalLoanAmount ?? loanAmountNumeric;
  const baseLoanAmountNumeric =
    calculatedMetrics.baseLoanAmount ?? loanAmountNumeric;

  const showRehabMetrics =
    lenderTerms?.showRehabMetrics === true ||
    (lenderTerms?.showRehabMetrics !== false &&
      (lenderTerms?.ltcPercent != null ||
        lenderTerms?.arvPercent != null ||
        lenderTerms?.rehabConstructionCost != null ||
        lenderTerms?.afterRepairValue != null ||
        lenderTerms?.maximumLtcPercent != null ||
        lenderTerms?.maximumArvPercent != null));

  const ltvNumeric =
    lenderTerms?.ltvPercent ??
    calculatedMetrics.ltv ??
    ltvFromFields ??
    (baseLoanAmountNumeric && propertyValueNumeric
      ? (baseLoanAmountNumeric / propertyValueNumeric) * 100
      : null);

  const ltcNumeric = showRehabMetrics
    ? (lenderTerms?.ltcPercent ?? calculatedMetrics.ltc ?? ltcFromFields)
    : null;

  const arvNumeric = showRehabMetrics
    ? (lenderTerms?.arvPercent ??
      (baseLoanAmountNumeric && afterRepairValueNumeric
        ? (baseLoanAmountNumeric / afterRepairValueNumeric) * 100
        : pickNumericField(fieldMap, "arvPercentage", "arvPercent")))
    : null;

  const loanTermMonths =
    parseLoanTermMonths(lenderTerms?.loanTerm) ||
    Number(pickField(fieldMap, "loanTerm", "termMonths", "term_months"));

  const monthlyPayment =
    formattedMetrics.monthlyPayment ||
    (lenderTerms?.monthlyPayment
      ? formatCurrency(lenderTerms.monthlyPayment)
      : null) ||
    (/interest\s*only/i.test(amortizationLabel) ||
    /interest\s*only/i.test(lenderTerms?.paymentFrequency || "") ||
    lenderTerms?.interestOnly ||
    (typeof interestRateRaw === "string" && /sofr|\+|prime/i.test(interestRateRaw))
      ? formatCurrency(
          calculatedMetrics.monthlyPayment ??
            (totalLoanAmountNumeric && interestRateNumeric
              ? (totalLoanAmountNumeric * interestRateNumeric) / 100 / 12
              : null),
        )
      : calculateMonthlyPayment(
          totalLoanAmountNumeric || 0,
          interestRateNumeric || 0,
          loanTermMonths || 0,
        ) || "P & I");

  const brokerPoints =
    lenderTerms?.brokerPoints != null
      ? lenderTerms.brokerPoints
      : pickField(fieldMap, "brokerPoints", "brokerFindersFee") ||
        (lenderProduct?.transactionFeePercent != null
          ? lenderProduct.transactionFeePercent
          : "");

  const appraisalFeeAmountNumeric = parseFeeAmount(
    lenderTerms?.appraisalFee,
    baseLoanAmountNumeric,
  );
  const wireFeeAmountNumeric = parseFeeAmount(
    lenderTerms?.wireFee,
    baseLoanAmountNumeric,
  );
  const requiredReservesPercentNumeric = toPositiveNumber(
    lenderTerms?.requiredReservesPercent,
  );
  const requiredReservesAmountNumeric =
    toPositiveNumber(lenderTerms?.requiredReservesAmount) ??
    (baseLoanAmountNumeric && requiredReservesPercentNumeric != null
      ? (baseLoanAmountNumeric * requiredReservesPercentNumeric) / 100
      : null);

  const loanPurposeTags = extractLoanPurposeTags(fieldMap, loanApplication);
  let collateralTags = extractCollateralTags(
    collaterals,
    fieldMap,
    lenderProduct,
  );

  if (
    lenderTerms?.personalGuarantee === "Required" &&
    !collateralTags.some((tag) => /personal guarantee/i.test(tag))
  ) {
    collateralTags = [...collateralTags, "Personal Guarantees"];
  }

  if (lenderTerms?.recourse) {
    const recourseTag = `${lenderTerms.recourse} Recourse`;
    if (!collateralTags.some((tag) => /recourse/i.test(tag))) {
      collateralTags = [...collateralTags, recourseTag];
    }
  }

  const requiredDocuments =
    lenderTerms?.requiredDocuments?.length > 0
      ? lenderTerms.requiredDocuments
      : lenderTerms?.closingConditions?.length > 0
        ? lenderTerms.closingConditions
        : extractRequiredDocuments(review);

  const loanProductCode =
    pickField(fieldMap, "loanProductCode", "loan_product", "productCode") ||
    loanApplication?.loanProductCode ||
    lenderProduct?.loanProductCode ||
    "";

  const loanProductName = resolveLoanProductName({
    lenderProduct,
    loanProductCode,
  });

  const specialConditions = lenderTerms?.specialConditions || [];

  const guarantors = extractGuarantors(fieldMap);
  const fundingTimelineDays =
    lenderProduct?.avgTurnaroundDays != null
      ? String(lenderProduct.avgTurnaroundDays)
      : "30";

  const clientName = companyName || borrowerName;
  const brokerStateValue = brokerProfile?.state || brokerOrg?.state || state || "";
  const signatureBorrowerName = clientName || borrowerName;

  const lenderOriginationFeeAmount = calculateFeeAmount(
    baseLoanAmountNumeric,
    originationPercent,
  );
  const processingFeeAmountNumeric = parseFeeAmount(
    lenderTerms?.processingFee,
    baseLoanAmountNumeric,
  );
  const underwritingFeeAmountNumeric = parseFeeAmount(
    lenderTerms?.underwritingFee,
    baseLoanAmountNumeric,
  );
  const originationFeeAmountNumeric = parseFeeAmount(
    originationPercent,
    baseLoanAmountNumeric,
  );
  const originationFeeLabel = originationPercent
    ? `Origination Fee (${String(originationPercent).includes("%") ? originationPercent : `${originationPercent}%`})`
    : "Origination Fee";
  const brokerFindersFeeAmount = calculateFeeAmount(
    baseLoanAmountNumeric,
    brokerPoints,
  );
  const totalClosingCostsNumeric =
    toPositiveNumber(lenderTerms?.totalClosingCosts) ??
    (() => {
      const sum =
        (originationFeeAmountNumeric || 0) +
        (processingFeeAmountNumeric || 0) +
        (appraisalFeeAmountNumeric || 0) +
        (brokerFindersFeeAmount || 0) +
        (wireFeeAmountNumeric || 0);
      return sum > 0 ? sum : null;
    })();

  const expirationDateDisplay = lenderTerms?.expirationDate
    ? new Date(`${lenderTerms.expirationDate}T00:00:00`).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      )
    : "";

  const organizationName = lenderRecord?.lender?.name || "";
  const lenderBrandName =
    lenderBranding?.lenderBrandName?.trim() || organizationName;
  const lenderLogoUrl = lenderBranding?.lenderLogoUrl || null;
  const lenderProfile = lenderRecord?.lender?.lenderProfile;
  const lenderOrg = lenderRecord?.lender;

  const lenderAddressParts = [
    lenderProfile?.address,
    [lenderProfile?.city, lenderProfile?.state].filter(Boolean).join(", "),
    lenderProfile?.zip,
  ].filter(Boolean);
  const lenderAddress = lenderAddressParts.join(" • ");
  const lenderWebsite = lenderProfile?.website?.trim() || "";
  const lenderContactEmail = lenderOrg?.email?.trim() || "";
  const lenderContactPhone = lenderOrg?.phone?.trim() || "";

  return {
    ...fieldMap,
    submissionId: submission?.id || "",
    applicationId: loanApplication?.id || "",
    applicationNumber: loanApplication?.applicationNumber || "",
    loanReferenceId: applicationLenderId || lenderRecord?.id || "",
    lenderName: lenderBrandName,
    lenderBrandName,
    lenderLogoUrl,
    lenderWebsite,
    lenderContactEmail,
    lenderContactPhone,
    lenderAddress,
    organizationName,
    status: lenderRecord?.status || "",
    applicationStatus: lenderRecord?.status || "",
    date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),

    borrowerFirstName,
    borrowerLastName,
    borrowerName,
    clientName,
    applicantBorrower: clientName,
    signatureBorrowerName,
    email,
    borrowerEmail: email,
    phone,
    borrowerPhone: phone,
    city,
    borrowerCity: city,
    state,
    borrowerState: state,
    companyName,

    brokerName,
    brokerFirstName,
    brokerLastName,
    brokerEmail: brokerUser?.email || brokerOrg?.email || "",
    brokerPhone: brokerUser?.phone || brokerOrg?.phone || "",
    brokerCompany: brokerProfile?.company || brokerOrg?.name || "",
    brokerCity: brokerProfile?.city || "",
    brokerState: brokerStateValue,
    brokerAddress: brokerProfile?.address || "",
    brokerZip: brokerProfile?.zipCode || "",

    guarantors,

    loanAmountRequested: formatCurrency(requestedAmountNumeric),
    amountRequested: formatCurrency(requestedAmountNumeric),
    requestedLoanAmount: formatCurrency(baseLoanAmountNumeric),
    totalFinancedLoanAmount: formatCurrency(totalLoanAmountNumeric),
    loanRequest: formatCurrency(totalLoanAmountNumeric),
    approvedAmount: formatCurrency(totalLoanAmountNumeric),
    baseLoanAmount: formatCurrency(baseLoanAmountNumeric),
    financedFees: formatCurrency(calculatedMetrics.financedFees),
    originationFeeLabel,
    originationFeeAmount: formatCurrency(originationFeeAmountNumeric),
    processingFeeAmount: formatCurrency(processingFeeAmountNumeric),
    underwritingFeeAmount: formatCurrency(underwritingFeeAmountNumeric),
    appraisalFeeAmount: formatCurrency(appraisalFeeAmountNumeric),
    wireFeeAmount: formatCurrency(wireFeeAmountNumeric),
    propertyValue: formatCurrency(propertyValueNumeric),
    valueFieldLabel,
    collateralOrPropertyValue: formatCurrency(propertyValueNumeric),
    rehabConstructionCost: showRehabMetrics
      ? formatCurrency(rehabFromTerms)
      : "",
    afterRepairValue: showRehabMetrics
      ? formatCurrency(afterRepairValueNumeric)
      : "",
    projectCost: showRehabMetrics ? formatCurrency(projectCostNumeric) : "",
    ltvRatio: formatPercent(ltvNumeric) || formattedMetrics.ltvRatio,
    ltcRatio: showRehabMetrics
      ? formatPercent(ltcNumeric) || formattedMetrics.ltcRatio
      : "",
    arvRatio: showRehabMetrics ? formatPercent(arvNumeric) : "",
    ltvPercentage: formatPercent(ltvNumeric),
    ltcPercentage: showRehabMetrics ? formatPercent(ltcNumeric) : "",
    arvPercentage: showRehabMetrics ? formatPercent(arvNumeric) : "",
    maximumLtvPercent: formatPercent(lenderTerms?.maximumLtvPercent),
    maximumLtcPercent: showRehabMetrics
      ? formatPercent(lenderTerms?.maximumLtcPercent)
      : "",
    maximumArvPercent: showRehabMetrics
      ? formatPercent(lenderTerms?.maximumArvPercent)
      : "",
    requiredReservesPercent: formatPercent(requiredReservesPercentNumeric),
    requiredReservesAmount: formatCurrency(requiredReservesAmountNumeric),
    totalClosingCosts: formatCurrency(totalClosingCostsNumeric),
    interestOnly: lenderTerms?.interestOnly ? "Yes" : "No",

    loanProductCode,
    loanProductName,

    propertyAddress: pickField(
      fieldMap,
      "propertyAddress",
      "property_address",
      "address",
    ),
    propertyType: pickField(fieldMap, "propertyType", "property_type")?.replace(
      /_/g,
      " ",
    ),

    term: termLabel,
    amortization: amortizationLabel,
    interestRate: formatInterestRate(interestRateRaw),
    fixedRatePeriod:
      lenderTerms?.interestRateType === "VARIABLE"
        ? "Variable"
        : lenderTerms?.interestRateType === "FIXED"
          ? "Fixed"
          : pickField(fieldMap, "rateType", "fixedRatePeriod")?.replace(/_/g, " "),
    paymentFrequency: lenderTerms?.paymentFrequency || "Monthly",
    monthlyPayment,
    balloonPayment: formattedMetrics.balloonPayment,
    interestAmount: formattedMetrics.interestAmount,
    estimatedClosingCost: formattedMetrics.estimatedClosingCost,
    apr: formattedMetrics.apr,
    paymentType: lenderTerms?.paymentFrequency || "P & I",
    prepaymentPenalty:
      lenderTerms?.prepaymentPenalty ||
      pickField(fieldMap, "prepaymentPenalty", "prepaymentStructure") ||
      lenderProduct?.prepaymentStructure ||
      "",
    personalGuarantee: lenderTerms?.personalGuarantee || "",
    recourse: lenderTerms?.recourse || "",
    appraisalRequired: lenderTerms?.appraisalRequired || "",
    environmentalReport: lenderTerms?.environmentalReport || "",
    expirationDate: expirationDateDisplay,

    underwritingFee: lenderTerms?.underwritingFee || pickField(fieldMap, "underwritingFee"),
    lenderOriginationFeePercent: formatPercent(originationPercent) || originationPercent,
    lenderOriginationFeeAmount,
    lenderFee: lenderTerms?.processingFee || pickField(fieldMap, "lenderFee"),
    lenderCommitmentFee:
      lenderTerms?.exitFee || pickField(fieldMap, "lenderCommitmentFee"),
    exitFee: lenderTerms?.exitFee || "",
    processingFee: lenderTerms?.processingFee || "",
    legalFee: lenderTerms?.legalFee || "",
    brokerFindersFee: brokerPoints ? formatPercent(brokerPoints) : "",
    brokerFindersFeeAmount,
    rateBuyDown: pickField(fieldMap, "rateBuyDown"),
    prepayBuyDown: pickField(fieldMap, "prepayBuyDown"),
    appraisalCost: formatCurrency(appraisalFeeAmountNumeric) || "",
    appraisalFee: lenderTerms?.appraisalFee || "",
    wireFee: lenderTerms?.wireFee || "",
    appraisalWhenDue:
      lenderTerms?.appraisalRequired === "No" ? "Waived" : "At Cost",
    legalAppraisal: "",
    legalAppraisalWhenDue: lenderTerms?.legalFee || "At Cost",
    totalLoanCosts:
      formatCurrency(totalClosingCostsNumeric) ||
      formattedMetrics.estimatedClosingCost ||
      pickField(fieldMap, "totalLoanCosts"),

    loanPurposeTags,
    loanPurpose: loanPurposeTags.join(", "),
    collateralTags,
    collateral: collateralTags.join(", "),
    requiredDocuments,
    specialConditions,
    fundingTimelineDays,

    notes: review?.notes || "",

    disclaimerText: [
      "The undersigned acknowledge that:",
      "This is a preliminary summary of non-binding terms for discussion purposes only.",
      `${lenderRecord?.lender?.name || "Lender"} has presented these proposed terms to ${clientName || "Client"} based on the assumptions contained in this request, and the Client has instructed us to proceed with formal underwriting based on the information provided.`,
      "This document is not a commitment to lend, nor does it guarantee that final loan documents will contain these or any other specific terms.",
      "Final approval is subject to satisfactory completion of underwriting, due diligence, appraisal, legal review, and execution of definitive loan documents acceptable to the Lender in its sole discretion.",
      `Broker Independence: The Broker is an independent intermediary and is not an agent, employee, or representative of ${lenderRecord?.lender?.name || "Lender"}.`,
      expirationDateDisplay
        ? `This offer is valid until ${expirationDateDisplay}.`
        : "",
      `This agreement shall be governed by the laws of ${brokerStateValue || "the applicable jurisdiction"}.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

module.exports = {
  buildLoiTemplateData,
  buildSubmissionFieldMap,
  pickField,
  formatCurrency,
  extractFieldValue,
  normalizeLenderTerms,
};
