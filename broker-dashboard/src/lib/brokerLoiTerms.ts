import { getTotalLoanAmountWithFinancedFees } from "./loiFinancedFees";
import {
  getLoiValueFieldLabel,
  usesRehabConstructionLoiMetrics,
} from "./loiProductValueFields";

export type BrokerLoiApplicationContext = {
  borrowerName?: string;
  propertyAddress?: string;
  propertyType?: string;
  loanProduct?: string;
  /** Canonical LoanProductCode for document catalog / custom docs. */
  loanProductCode?: string;
  brokerName?: string;
  /** Seed values from application for property/collateral & rehab metrics. */
  propertyValue?: number | string | null;
  projectCost?: number | string | null;
  arv?: number | string | null;
  rehabCost?: number | string | null;
  requestedAmount?: number | string | null;
  interestRate?: number | string | null;
  termMonths?: number | string | null;
  loanTerm?: string | null;
};

export type BrokerLoiTerms = {
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
  requiredDocuments: string[];
  customDocument: string;
  originationPoints: string;
  originationFeePercent: string;
  exitFee: string;
  processingFee: string;
  underwritingFee: string;
  appraisalFee: string;
  brokerPoints: string;
  wireFee: string;
  totalClosingCosts: string;
  requiredReservesPercent: string;
  requiredReservesAmount: string;
  legalFee: string;
  appraisalRequired: string;
  environmentalReport: string;
  personalGuarantee: string;
  prepaymentPenalty: string;
  recourse: string;
  amortization: string;
  paymentFrequency: string;
  expirationDate: string;
  specialConditions: string[];
};

export const DEFAULT_BROKER_LOI_TERMS: BrokerLoiTerms = {
  approvedAmount: "",
  interestRate: "",
  collateralOrPropertyValue: "",
  rehabConstructionCost: "",
  afterRepairValue: "",
  ltvPercent: "",
  ltcPercent: "",
  arvPercent: "",
  maximumLtvPercent: "",
  maximumLtcPercent: "",
  maximumArvPercent: "",
  monthlyPayment: "",
  interestOnly: true,
  loanTerm: "",
  requiredDocuments: [],
  customDocument: "",
  originationPoints: "",
  originationFeePercent: "",
  exitFee: "",
  processingFee: "",
  underwritingFee: "",
  appraisalFee: "",
  brokerPoints: "",
  wireFee: "",
  totalClosingCosts: "",
  requiredReservesPercent: "",
  requiredReservesAmount: "",
  legalFee: "",
  appraisalRequired: "",
  environmentalReport: "",
  personalGuarantee: "",
  prepaymentPenalty: "",
  recourse: "",
  amortization: "",
  paymentFrequency: "",
  expirationDate: "",
  specialConditions: [],
};

export const BROKER_LOI_TERM_OPTIONS = [
  "6 Months",
  "12 Months",
  "18 Months",
  "24 Months",
  "36 Months",
];

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

/** Format a numeric input with thousand separators for UI display. */
export function formatBrokerLoiNumberInput(rawValue?: string | null) {
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
export function parseBrokerLoiNumberInput(rawValue?: string | null) {
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

function feePointsToAmount(points: string, loanAmount: number | null) {
  const pct = toNumber(points);
  if (pct == null || !loanAmount) return 0;
  return (loanAmount * pct) / 100;
}

function feeDollars(value: string) {
  return toNumber(value) || 0;
}

export function calculateSuggestedBrokerLoiMetrics(input: {
  approvedAmount?: string;
  interestRate?: string;
  interestOnly?: boolean;
  loanTerm?: string;
  collateralOrPropertyValue?: string | number | null;
  propertyValue?: number | string | null;
  rehabConstructionCost?: string | number | null;
  projectCost?: number | string | null;
  afterRepairValue?: string | number | null;
  arv?: number | string | null;
  originationPoints?: string;
  originationFeePercent?: string;
  exitFee?: string;
  processingFee?: string;
  underwritingFee?: string;
  appraisalFee?: string;
  brokerPoints?: string;
  wireFee?: string;
  requiredReservesPercent?: string;
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
  const arv = toNumber(input.afterRepairValue) ?? toNumber(input.arv);
  const termMonths = parseTermMonths(input.loanTerm);
  const showRehab = Boolean(input.showRehabMetrics);

  const originationAsFee = input.originationPoints?.trim()
    ? `${parseBrokerLoiNumberInput(input.originationPoints)}%`
    : input.originationFeePercent || "2%";

  const { totalLoanAmount, financedFees } = getTotalLoanAmountWithFinancedFees({
    approvedAmount: baseLoanAmount,
    originationFeePercent: originationAsFee,
    exitFee: input.exitFee ?? "0%",
    processingFee: input.processingFee?.trim()
      ? input.processingFee
      : "$995",
    underwritingFee: input.underwritingFee ?? "$750",
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
      monthlyPayment =
        monthlyRate === 0
          ? paymentBase / termMonths
          : (paymentBase * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
            (Math.pow(1 + monthlyRate, termMonths) - 1);
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
    candidates.push({ label: "Max LTV", amount: (value * maxLtv) / 100 });
  }
  if (input.showRehabMetrics && projectCost != null && maxLtc != null) {
    candidates.push({ label: "Max LTC", amount: (projectCost * maxLtc) / 100 });
  }
  if (input.showRehabMetrics && arv != null && maxArv != null) {
    candidates.push({ label: "Max ARV", amount: (arv * maxArv) / 100 });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.amount - b.amount);
  return {
    amount: Number(candidates[0].amount.toFixed(2)),
    bindingLabel: candidates[0].label,
    candidates,
  };
}

export function validateBrokerLoiTerms(
  terms: BrokerLoiTerms,
  options?: { loanProductCode?: string | null },
) {
  const errors: Partial<Record<keyof BrokerLoiTerms, string>> = {};
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

export function normalizeBrokerLoiTerms(
  terms: Partial<BrokerLoiTerms> | null | undefined,
  seed?: Partial<BrokerLoiApplicationContext>,
): BrokerLoiTerms {
  const showRehab = usesRehabConstructionLoiMetrics(seed?.loanProductCode);
  const requestedSeed = toNumber(terms?.approvedAmount ?? seed?.requestedAmount);
  const interestSeed = toNumber(terms?.interestRate ?? seed?.interestRate);
  const loanTermSeed =
    String(terms?.loanTerm || "").trim() ||
    (seed?.loanTerm ? String(seed.loanTerm).trim() : "") ||
    (seed?.termMonths != null && String(seed.termMonths).trim()
      ? String(seed.termMonths).includes("Month")
        ? String(seed.termMonths)
        : `${seed.termMonths} Months`
      : "");
  const propertySeed = toNumber(
    terms?.collateralOrPropertyValue ?? seed?.propertyValue,
  );
  const rehabSeed =
    toNumber(terms?.rehabConstructionCost) ??
    toNumber(seed?.rehabCost) ??
    (propertySeed != null && toNumber(seed?.projectCost) != null
      ? Math.max(0, (toNumber(seed?.projectCost) || 0) - propertySeed)
      : null);
  const arvSeed = toNumber(terms?.afterRepairValue ?? seed?.arv);

  const merged: BrokerLoiTerms = {
    ...DEFAULT_BROKER_LOI_TERMS,
    ...terms,
    requiredDocuments: terms?.requiredDocuments ?? [],
    specialConditions: terms?.specialConditions ?? [],
    approvedAmount:
      requestedSeed != null && requestedSeed > 0
        ? formatBrokerLoiNumberInput(String(requestedSeed))
        : formatBrokerLoiNumberInput(terms?.approvedAmount),
    interestRate:
      interestSeed != null && interestSeed > 0
        ? formatBrokerLoiNumberInput(String(interestSeed))
        : formatBrokerLoiNumberInput(terms?.interestRate),
    loanTerm: loanTermSeed || terms?.loanTerm || "",
    collateralOrPropertyValue:
      propertySeed != null && propertySeed > 0
        ? formatBrokerLoiNumberInput(String(propertySeed))
        : formatBrokerLoiNumberInput(terms?.collateralOrPropertyValue),
    rehabConstructionCost:
      showRehab && rehabSeed != null && rehabSeed > 0
        ? formatBrokerLoiNumberInput(String(rehabSeed))
        : formatBrokerLoiNumberInput(terms?.rehabConstructionCost),
    afterRepairValue:
      showRehab && arvSeed != null && arvSeed > 0
        ? formatBrokerLoiNumberInput(String(arvSeed))
        : formatBrokerLoiNumberInput(terms?.afterRepairValue),
  };

  const suggested = calculateSuggestedBrokerLoiMetrics({
    ...merged,
    showRehabMetrics: showRehab,
  });

  return {
    ...merged,
    approvedAmount: formatBrokerLoiNumberInput(merged.approvedAmount),
    interestRate: formatBrokerLoiNumberInput(merged.interestRate),
    monthlyPayment:
      suggested.monthlyPayment != null
        ? formatBrokerLoiNumberInput(String(suggested.monthlyPayment))
        : formatBrokerLoiNumberInput(merged.monthlyPayment),
    ltvPercent:
      suggested.ltv != null
        ? formatBrokerLoiNumberInput(String(suggested.ltv))
        : formatBrokerLoiNumberInput(merged.ltvPercent),
    ltcPercent:
      showRehab && suggested.ltc != null
        ? formatBrokerLoiNumberInput(String(suggested.ltc))
        : "",
    arvPercent:
      showRehab && suggested.arvPercent != null
        ? formatBrokerLoiNumberInput(String(suggested.arvPercent))
        : "",
    maximumLtvPercent: formatBrokerLoiNumberInput(merged.maximumLtvPercent),
    maximumLtcPercent: formatBrokerLoiNumberInput(merged.maximumLtcPercent),
    maximumArvPercent: formatBrokerLoiNumberInput(merged.maximumArvPercent),
    originationPoints: formatBrokerLoiNumberInput(merged.originationPoints),
    originationFeePercent: formatBrokerLoiNumberInput(
      String(merged.originationFeePercent || "").replace(/%/g, ""),
    ),
    processingFee: formatBrokerLoiNumberInput(
      String(merged.processingFee || "").replace(/[$,]/g, ""),
    ),
    underwritingFee: formatBrokerLoiNumberInput(
      String(merged.underwritingFee || "").replace(/[$,]/g, ""),
    ),
    appraisalFee: formatBrokerLoiNumberInput(
      String(merged.appraisalFee || "").replace(/[$,]/g, ""),
    ),
    brokerPoints: formatBrokerLoiNumberInput(merged.brokerPoints),
    wireFee: formatBrokerLoiNumberInput(
      String(merged.wireFee || "").replace(/[$,]/g, ""),
    ),
    totalClosingCosts:
      suggested.totalClosingCosts != null
        ? formatBrokerLoiNumberInput(String(suggested.totalClosingCosts))
        : formatBrokerLoiNumberInput(merged.totalClosingCosts),
    requiredReservesPercent: formatBrokerLoiNumberInput(
      merged.requiredReservesPercent,
    ),
    requiredReservesAmount:
      suggested.requiredReservesAmount != null
        ? formatBrokerLoiNumberInput(String(suggested.requiredReservesAmount))
        : formatBrokerLoiNumberInput(merged.requiredReservesAmount),
    prepaymentPenalty: merged.prepaymentPenalty,
    exitFee: formatBrokerLoiNumberInput(
      String(merged.exitFee || "").replace(/%/g, ""),
    ),
    legalFee: merged.legalFee,
  };
}

export function mergeBrokerLoiDocuments(
  requiredDocuments: string[],
  customDocument: string,
) {
  const merged = [...requiredDocuments];
  const custom = customDocument.trim();
  if (custom && !merged.includes(custom)) {
    merged.push(custom);
  }
  return merged;
}

export { getLoiValueFieldLabel, usesRehabConstructionLoiMetrics };
