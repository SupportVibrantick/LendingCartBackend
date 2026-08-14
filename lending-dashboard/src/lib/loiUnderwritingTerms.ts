import { getTotalLoanAmountWithFinancedFees } from "./loiFinancedFees";
import {
  getLoiValueFieldLabel,
  usesRehabConstructionLoiMetrics,
} from "./loiProductValueFields";

export type LoiApplicationContext = {
  borrowerName?: string;
  propertyAddress?: string;
  propertyType?: string;
  loanProduct?: string;
  brokerName?: string;
};

export type LoiUnderwritingTerms = {
  approvedAmount: string;
  interestRate: string;
  /** Fillable as-is property OR collateral value (product-dependent label). */
  collateralOrPropertyValue: string;
  rehabConstructionCost: string;
  afterRepairValue: string;
  /** Auto-calculated ratios (not required). */
  ltvPercent: string;
  ltcPercent: string;
  arvPercent: string;
  /** Lender max policy caps (fillable). */
  maximumLtvPercent: string;
  maximumLtcPercent: string;
  maximumArvPercent: string;
  monthlyPayment: string;
  interestOnly: boolean;
  loanTerm: string;
  originationPoints: string;
  processingFee: string;
  appraisalFee: string;
  brokerPoints: string;
  wireFee: string;
  totalClosingCosts: string;
  requiredReservesPercent: string;
  requiredReservesAmount: string;
  requiredDocuments: string[];
  customDocument: string;
};

export const LOI_DEFAULT_DOCUMENTS = [
  "Clear Title",
  "Insurance",
  "Appraisal",
  "Entity Documents",
  "Bank Statements",
  "Background Check",
  "Environmental Report",
];

export const LOI_TERM_OPTIONS = [
  "6 Months",
  "12 Months",
  "18 Months",
  "24 Months",
  "36 Months",
];

export const LOI_DEFAULT_FINANCED_FEES = {
  originationFeePercent: "2%",
  exitFee: "0%",
  processingFee: "$995",
  underwritingFee: "$750",
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

/** Format a numeric input with thousand separators for UI display. */
export function formatLoiNumberInput(rawValue?: string | null) {
  const cleaned = String(rawValue ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  const parts = cleaned.split(".");
  const intPart = parts[0] || "";
  const hasDecimal = parts.length > 1;
  const decPart = hasDecimal
    ? parts.slice(1).join("").replace(/\D/g, "").slice(0, 4)
    : "";

  const formattedInt = intPart
    ? Number(intPart).toLocaleString("en-US")
    : hasDecimal
      ? "0"
      : "";

  if (hasDecimal) {
    return `${formattedInt}.${decPart}`;
  }

  return formattedInt;
}

/** Strip formatting so values can be parsed / sent to the API. */
export function parseLoiNumberInput(rawValue?: string | null) {
  return String(rawValue ?? "").replace(/[$,\s%]/g, "").trim();
}

function parseTermMonths(label?: string) {
  if (!label) return 0;
  const months = String(label).match(/(\d+)\s*Months?/i);
  if (months) return Number(months[1]);
  const years = String(label).match(/(\d+)\s*Years?/i);
  if (years) return Number(years[1]) * 12;
  return 0;
}

function defaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function stringifyFormField(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseStoredInterestRate(stored: Record<string, unknown>) {
  if (stored.interestRate != null && stored.interestRate !== "") {
    return stringifyFormField(stored.interestRate);
  }

  const display = String(stored.interestRateDisplay || "").trim();
  if (!display) return "";

  const numeric = Number(display.replace(/%/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : display;
}

function feePointsToAmount(points: string, loanAmount: number | null) {
  const pct = toNumber(points);
  if (pct == null || !loanAmount) return 0;
  return (loanAmount * pct) / 100;
}

function feeDollars(value: string) {
  return toNumber(value) || 0;
}

export function calculateSuggestedLoiMetrics(input: {
  approvedAmount?: string;
  interestRate?: string;
  interestOnly?: boolean;
  loanTerm?: string;
  collateralOrPropertyValue?: string | number | null;
  /** @deprecated prefer collateralOrPropertyValue */
  propertyValue?: number | string | null;
  rehabConstructionCost?: string | number | null;
  projectCost?: number | string | null;
  afterRepairValue?: string | number | null;
  arv?: number | string | null;
  originationPoints?: string;
  processingFee?: string;
  appraisalFee?: string;
  brokerPoints?: string;
  wireFee?: string;
  requiredReservesPercent?: string;
  originationFeePercent?: string;
  exitFee?: string;
  underwritingFee?: string;
  showRehabMetrics?: boolean;
}) {
  const baseLoanAmount = toNumber(input.approvedAmount);
  const rate = toNumber(input.interestRate);
  const value =
    toNumber(input.collateralOrPropertyValue) ?? toNumber(input.propertyValue);
  const rehab =
    toNumber(input.rehabConstructionCost) ??
    (input.projectCost != null && value != null
      ? Math.max(0, (toNumber(input.projectCost) || 0) - value)
      : toNumber(input.projectCost));
  const projectCost =
    toNumber(input.projectCost) ??
    (value != null || rehab != null ? (value || 0) + (rehab || 0) : null);
  const arv =
    toNumber(input.afterRepairValue) ?? toNumber(input.arv);
  const termMonths = parseTermMonths(input.loanTerm);
  const showRehab = Boolean(input.showRehabMetrics);

  const originationAsFee =
    input.originationPoints?.trim()
      ? `${parseLoiNumberInput(input.originationPoints)}%`
      : input.originationFeePercent ?? LOI_DEFAULT_FINANCED_FEES.originationFeePercent;

  const { totalLoanAmount, financedFees } = getTotalLoanAmountWithFinancedFees({
    approvedAmount: baseLoanAmount,
    originationFeePercent: originationAsFee,
    exitFee: input.exitFee ?? LOI_DEFAULT_FINANCED_FEES.exitFee,
    processingFee:
      input.processingFee?.trim()
        ? input.processingFee
        : LOI_DEFAULT_FINANCED_FEES.processingFee,
    underwritingFee:
      input.underwritingFee ?? LOI_DEFAULT_FINANCED_FEES.underwritingFee,
  });

  const loanAmount = baseLoanAmount;

  const ltv =
    loanAmount && value
      ? Number(((loanAmount / value) * 100).toFixed(2))
      : null;
  const ltc =
    showRehab && loanAmount && projectCost
      ? Number(((loanAmount / projectCost) * 100).toFixed(2))
      : null;
  const arvPercent =
    showRehab && loanAmount && arv
      ? Number(((loanAmount / arv) * 100).toFixed(2))
      : null;

  let monthlyPayment: number | null = null;
  const paymentBase = totalLoanAmount ?? loanAmount;
  if (paymentBase && rate != null && termMonths > 0) {
    if (input.interestOnly) {
      monthlyPayment = (paymentBase * rate) / 100 / 12;
    } else {
      const monthlyRate = rate / 100 / 12;
      if (monthlyRate === 0) {
        monthlyPayment = paymentBase / termMonths;
      } else {
        monthlyPayment =
          (paymentBase * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
          (Math.pow(1 + monthlyRate, termMonths) - 1);
      }
    }
  }

  const originationAmount = feePointsToAmount(
    input.originationPoints || "",
    loanAmount,
  );
  const brokerAmount = feePointsToAmount(input.brokerPoints || "", loanAmount);
  const processingAmount = feeDollars(input.processingFee || "");
  const appraisalAmount = feeDollars(input.appraisalFee || "");
  const wireAmount = feeDollars(input.wireFee || "");
  const totalClosingCosts =
    originationAmount +
    processingAmount +
    appraisalAmount +
    brokerAmount +
    wireAmount;

  const reservesPct = toNumber(input.requiredReservesPercent);
  const requiredReservesAmount =
    loanAmount && reservesPct != null
      ? Number(((loanAmount * reservesPct) / 100).toFixed(2))
      : null;

  return {
    baseLoanAmount,
    totalLoanAmount: paymentBase,
    financedFees,
    propertyOrCollateralValue: value,
    rehabConstructionCost: rehab,
    projectCost,
    afterRepairValue: arv,
    ltv,
    ltc,
    arvPercent,
    monthlyPayment:
      monthlyPayment != null ? Number(monthlyPayment.toFixed(2)) : null,
    totalClosingCosts:
      totalClosingCosts > 0 ? Number(totalClosingCosts.toFixed(2)) : null,
    requiredReservesAmount,
    originationAmount,
    brokerAmount,
  };
}

/** Max loan implied by each policy cap; returns the binding (lowest) amount. */
export function calculateBindingMaxLoan(input: {
  collateralOrPropertyValue?: string;
  rehabConstructionCost?: string;
  afterRepairValue?: string;
  maximumLtvPercent?: string;
  maximumLtcPercent?: string;
  maximumArvPercent?: string;
  showRehabMetrics?: boolean;
}) {
  const value = toNumber(input.collateralOrPropertyValue);
  const rehab = toNumber(input.rehabConstructionCost) || 0;
  const projectCost = value != null ? value + rehab : null;
  const arv = toNumber(input.afterRepairValue);
  const maxLtv = toNumber(input.maximumLtvPercent);
  const maxLtc = toNumber(input.maximumLtcPercent);
  const maxArv = toNumber(input.maximumArvPercent);

  const candidates: Array<{ label: string; amount: number }> = [];
  if (value != null && maxLtv != null) {
    candidates.push({
      label: "Max LTV",
      amount: (value * maxLtv) / 100,
    });
  }
  if (input.showRehabMetrics && projectCost != null && maxLtc != null) {
    candidates.push({
      label: "Max LTC",
      amount: (projectCost * maxLtc) / 100,
    });
  }
  if (input.showRehabMetrics && arv != null && maxArv != null) {
    candidates.push({
      label: "Max ARV",
      amount: (arv * maxArv) / 100,
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.amount - b.amount);
  return {
    amount: Number(candidates[0].amount.toFixed(2)),
    bindingLabel: candidates[0].label,
    candidates,
  };
}

export function mapStoredLoiTermsToForm(
  stored: unknown,
): LoiUnderwritingTerms | null {
  if (!stored || typeof stored !== "object") return null;

  const record = stored as Record<string, unknown>;
  const approvedAmount = record.approvedAmount;
  if (approvedAmount == null || approvedAmount === "") return null;

  const requiredDocuments = Array.isArray(record.requiredDocuments)
    ? record.requiredDocuments
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : Array.isArray(record.closingConditions)
      ? record.closingConditions
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [];

  const valueRaw =
    record.collateralOrPropertyValue ??
    record.collateralValue ??
    record.propertyValue ??
    "";

  return {
    approvedAmount: formatLoiNumberInput(stringifyFormField(approvedAmount)),
    interestRate: formatLoiNumberInput(parseStoredInterestRate(record)),
    collateralOrPropertyValue: valueRaw
      ? formatLoiNumberInput(stringifyFormField(valueRaw))
      : "",
    rehabConstructionCost: record.rehabConstructionCost
      ? formatLoiNumberInput(stringifyFormField(record.rehabConstructionCost))
      : record.rehabCost
        ? formatLoiNumberInput(stringifyFormField(record.rehabCost))
        : "",
    afterRepairValue: record.afterRepairValue
      ? formatLoiNumberInput(stringifyFormField(record.afterRepairValue))
      : record.arv
        ? formatLoiNumberInput(stringifyFormField(record.arv))
        : "",
    ltvPercent:
      record.ltvPercent != null && record.ltvPercent !== ""
        ? formatLoiNumberInput(stringifyFormField(record.ltvPercent))
        : "",
    ltcPercent:
      record.ltcPercent != null && record.ltcPercent !== ""
        ? formatLoiNumberInput(stringifyFormField(record.ltcPercent))
        : "",
    arvPercent:
      record.arvPercent != null && record.arvPercent !== ""
        ? formatLoiNumberInput(stringifyFormField(record.arvPercent))
        : "",
    maximumLtvPercent: record.maximumLtvPercent
      ? formatLoiNumberInput(stringifyFormField(record.maximumLtvPercent))
      : "",
    maximumLtcPercent: record.maximumLtcPercent
      ? formatLoiNumberInput(stringifyFormField(record.maximumLtcPercent))
      : "",
    maximumArvPercent: record.maximumArvPercent
      ? formatLoiNumberInput(stringifyFormField(record.maximumArvPercent))
      : "",
    monthlyPayment:
      record.monthlyPayment != null && record.monthlyPayment !== ""
        ? formatLoiNumberInput(stringifyFormField(record.monthlyPayment))
        : "",
    interestOnly: Boolean(record.interestOnly),
    loanTerm: record.loanTerm ? String(record.loanTerm) : "12 Months",
    originationPoints: record.originationPoints
      ? formatLoiNumberInput(stringifyFormField(record.originationPoints))
      : record.originationFeePercent
        ? formatLoiNumberInput(
            String(record.originationFeePercent).replace(/%/g, ""),
          )
        : "",
    processingFee: record.processingFee
      ? formatLoiNumberInput(stringifyFormField(record.processingFee))
      : "",
    appraisalFee: record.appraisalFee
      ? formatLoiNumberInput(stringifyFormField(record.appraisalFee))
      : "",
    brokerPoints: record.brokerPoints
      ? formatLoiNumberInput(stringifyFormField(record.brokerPoints))
      : "",
    wireFee: record.wireFee
      ? formatLoiNumberInput(stringifyFormField(record.wireFee))
      : "",
    totalClosingCosts: record.totalClosingCosts
      ? formatLoiNumberInput(stringifyFormField(record.totalClosingCosts))
      : "",
    requiredReservesPercent: record.requiredReservesPercent
      ? formatLoiNumberInput(stringifyFormField(record.requiredReservesPercent))
      : "",
    requiredReservesAmount: record.requiredReservesAmount
      ? formatLoiNumberInput(stringifyFormField(record.requiredReservesAmount))
      : "",
    requiredDocuments,
    customDocument: "",
  };
}

export function createEmptyLoiUnderwritingTerms(
  requestedAmount?: number | string | null,
  seed?: Partial<{
    interestRate: number | string | null;
    loanTerm: number | string | null;
    propertyValue: number | string | null;
    projectCost: number | string | null;
    arv: number | string | null;
    rehabCost: number | string | null;
    requiredDocuments: string[];
    loanProductCode: string | null;
  }>,
): LoiUnderwritingTerms {
  const requested = toNumber(requestedAmount);
  const showRehab = usesRehabConstructionLoiMetrics(seed?.loanProductCode);
  const loanTerm =
    seed?.loanTerm != null && String(seed.loanTerm).trim()
      ? String(seed.loanTerm).includes("Month")
        ? String(seed.loanTerm)
        : `${seed.loanTerm} Months`
      : "12 Months";

  const propertySeed = toNumber(seed?.propertyValue);
  const rehabSeed =
    toNumber(seed?.rehabCost) ??
    (propertySeed != null && toNumber(seed?.projectCost) != null
      ? Math.max(0, (toNumber(seed?.projectCost) || 0) - propertySeed)
      : null);

  const base: LoiUnderwritingTerms = {
    approvedAmount:
      requested != null && requested > 0
        ? formatLoiNumberInput(String(requested))
        : "",
    interestRate:
      seed?.interestRate != null && Number(seed.interestRate) > 0
        ? formatLoiNumberInput(String(seed.interestRate))
        : "",
    collateralOrPropertyValue:
      propertySeed != null && propertySeed > 0
        ? formatLoiNumberInput(String(propertySeed))
        : "",
    rehabConstructionCost:
      showRehab && rehabSeed != null && rehabSeed > 0
        ? formatLoiNumberInput(String(rehabSeed))
        : "",
    afterRepairValue:
      showRehab && toNumber(seed?.arv) != null && (toNumber(seed?.arv) || 0) > 0
        ? formatLoiNumberInput(String(seed?.arv))
        : "",
    ltvPercent: "",
    ltcPercent: "",
    arvPercent: "",
    maximumLtvPercent: "",
    maximumLtcPercent: "",
    maximumArvPercent: "",
    monthlyPayment: "",
    interestOnly: true,
    loanTerm,
    originationPoints: "",
    processingFee: "",
    appraisalFee: "",
    brokerPoints: "",
    wireFee: "",
    totalClosingCosts: "",
    requiredReservesPercent: "",
    requiredReservesAmount: "",
    requiredDocuments: seed?.requiredDocuments?.filter(Boolean) || [],
    customDocument: "",
  };

  const suggested = calculateSuggestedLoiMetrics({
    ...base,
    showRehabMetrics: showRehab,
  });

  return {
    ...base,
    ltvPercent:
      suggested.ltv != null ? formatLoiNumberInput(String(suggested.ltv)) : "",
    ltcPercent:
      showRehab && suggested.ltc != null
        ? formatLoiNumberInput(String(suggested.ltc))
        : "",
    arvPercent:
      showRehab && suggested.arvPercent != null
        ? formatLoiNumberInput(String(suggested.arvPercent))
        : "",
    monthlyPayment:
      suggested.monthlyPayment != null
        ? formatLoiNumberInput(String(suggested.monthlyPayment))
        : "",
    totalClosingCosts:
      suggested.totalClosingCosts != null
        ? formatLoiNumberInput(String(suggested.totalClosingCosts))
        : "",
    requiredReservesAmount:
      suggested.requiredReservesAmount != null
        ? formatLoiNumberInput(String(suggested.requiredReservesAmount))
        : "",
  };
}

export function validateLoiUnderwritingTerms(
  terms: LoiUnderwritingTerms,
  options?: { loanProductCode?: string | null },
) {
  const errors: Partial<Record<keyof LoiUnderwritingTerms, string>> = {};
  const valueLabel = getLoiValueFieldLabel(options?.loanProductCode);
  const showRehab = usesRehabConstructionLoiMetrics(options?.loanProductCode);

  const approvedAmount = toNumber(terms.approvedAmount);
  if (!String(terms.approvedAmount || "").trim()) {
    errors.approvedAmount = "Loan amount is required";
  } else if (approvedAmount == null || approvedAmount <= 0) {
    errors.approvedAmount = "Enter a valid loan amount";
  }

  const rate = toNumber(terms.interestRate);
  if (!String(terms.interestRate || "").trim()) {
    errors.interestRate = "Interest rate is required";
  } else if (rate == null || rate <= 0 || rate > 100) {
    errors.interestRate = "Enter a valid rate between 0 and 100";
  }

  if (!terms.loanTerm) {
    errors.loanTerm = "Loan term is required";
  }

  const value = toNumber(terms.collateralOrPropertyValue);
  if (!String(terms.collateralOrPropertyValue || "").trim()) {
    errors.collateralOrPropertyValue = `${valueLabel} is required`;
  } else if (value == null || value <= 0) {
    errors.collateralOrPropertyValue = `Enter a valid ${valueLabel.toLowerCase()}`;
  }

  if (showRehab) {
    const rehab = toNumber(terms.rehabConstructionCost);
    if (
      String(terms.rehabConstructionCost || "").trim() &&
      (rehab == null || rehab < 0)
    ) {
      errors.rehabConstructionCost = "Enter a valid rehab/construction cost";
    }
    const arv = toNumber(terms.afterRepairValue);
    if (
      String(terms.afterRepairValue || "").trim() &&
      (arv == null || arv <= 0)
    ) {
      errors.afterRepairValue = "Enter a valid after repair value";
    }
  }

  // LTV / LTC / ARV are auto-calculated — not required.
  // Optional max caps: if filled, must be 0–100.
  for (const key of [
    "maximumLtvPercent",
    "maximumLtcPercent",
    "maximumArvPercent",
    "requiredReservesPercent",
    "originationPoints",
    "brokerPoints",
  ] as const) {
    const raw = String(terms[key] || "").trim();
    if (!raw) continue;
    const n = toNumber(raw);
    if (n == null || n < 0 || n > 100) {
      errors[key] = "Enter a valid percentage between 0 and 100";
    }
  }

  const payment = toNumber(terms.monthlyPayment);
  if (!String(terms.monthlyPayment || "").trim()) {
    errors.monthlyPayment =
      "Monthly payment will calculate once amount, rate, and term are set";
  } else if (payment == null || payment <= 0) {
    errors.monthlyPayment = "Enter a valid monthly payment";
  }

  if (!terms.requiredDocuments.length) {
    errors.requiredDocuments = "Select at least one required document";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function serializeLoiUnderwritingTerms(
  terms: LoiUnderwritingTerms,
  options?: { loanProductCode?: string | null },
) {
  const showRehab = usesRehabConstructionLoiMetrics(options?.loanProductCode);
  const usesCollateral = getLoiValueFieldLabel(options?.loanProductCode)
    .toLowerCase()
    .includes("collateral");

  const approvedAmount = toNumber(terms.approvedAmount) || 0;
  const interestRate = toNumber(terms.interestRate) || 0;
  const collateralOrPropertyValue =
    toNumber(terms.collateralOrPropertyValue) || null;
  const rehabConstructionCost = showRehab
    ? toNumber(terms.rehabConstructionCost)
    : null;
  const afterRepairValue = showRehab
    ? toNumber(terms.afterRepairValue)
    : null;

  const suggested = calculateSuggestedLoiMetrics({
    ...terms,
    showRehabMetrics: showRehab,
  });

  const monthlyPayment =
    suggested.monthlyPayment ?? toNumber(terms.monthlyPayment) ?? 0;

  const originationPoints = toNumber(terms.originationPoints);
  const originationFeePercent =
    originationPoints != null ? `${originationPoints}%` : "2%";

  return {
    approvedAmount,
    interestRateType: "FIXED" as const,
    interestRate,
    interestRateDisplay: `${interestRate}%`,
    variableRateIndex: null,
    variableRateSpread: null,
    loanTerm: terms.loanTerm,
    amortization: terms.interestOnly ? "Interest Only" : "30 Years",
    paymentFrequency: terms.interestOnly ? "Interest Only" : "Monthly",
    interestOnly: terms.interestOnly,
    collateralOrPropertyValue,
    propertyValue: usesCollateral ? null : collateralOrPropertyValue,
    collateralValue: usesCollateral ? collateralOrPropertyValue : null,
    valueFieldLabel: getLoiValueFieldLabel(options?.loanProductCode),
    showRehabMetrics: showRehab,
    rehabConstructionCost,
    afterRepairValue,
    ltvPercent: suggested.ltv ?? toNumber(terms.ltvPercent),
    ltcPercent: showRehab
      ? suggested.ltc ?? toNumber(terms.ltcPercent)
      : null,
    arvPercent: showRehab
      ? suggested.arvPercent ?? toNumber(terms.arvPercent)
      : null,
    maximumLtvPercent: toNumber(terms.maximumLtvPercent),
    maximumLtcPercent: showRehab
      ? toNumber(terms.maximumLtcPercent)
      : null,
    maximumArvPercent: showRehab
      ? toNumber(terms.maximumArvPercent)
      : null,
    monthlyPayment,
    totalLoanAmount: suggested.totalLoanAmount ?? approvedAmount,
    financedFees: suggested.financedFees ?? 0,
    originationPoints,
    originationFeePercent,
    processingFee: terms.processingFee
      ? `$${parseLoiNumberInput(terms.processingFee)}`
      : LOI_DEFAULT_FINANCED_FEES.processingFee,
    appraisalFee: terms.appraisalFee
      ? `$${parseLoiNumberInput(terms.appraisalFee)}`
      : "",
    brokerPoints: toNumber(terms.brokerPoints),
    wireFee: terms.wireFee
      ? `$${parseLoiNumberInput(terms.wireFee)}`
      : "",
    totalClosingCosts:
      suggested.totalClosingCosts ?? toNumber(terms.totalClosingCosts),
    requiredReservesPercent: toNumber(terms.requiredReservesPercent),
    requiredReservesAmount:
      suggested.requiredReservesAmount ??
      toNumber(terms.requiredReservesAmount),
    exitFee: LOI_DEFAULT_FINANCED_FEES.exitFee,
    underwritingFee: LOI_DEFAULT_FINANCED_FEES.underwritingFee,
    legalFee: "Borrower Pays",
    appraisalRequired: "Yes",
    environmentalReport: "Required",
    personalGuarantee: "Required",
    prepaymentPenalty: "None",
    recourse: "Full",
    requiredDocuments: terms.requiredDocuments,
    closingConditions: terms.requiredDocuments,
    specialConditions: [] as string[],
    expirationDate: defaultExpirationDate(),
  };
}

export { getLoiValueFieldLabel, usesRehabConstructionLoiMetrics };
