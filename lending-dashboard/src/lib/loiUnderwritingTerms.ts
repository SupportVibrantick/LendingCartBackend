import { getTotalLoanAmountWithFinancedFees } from "./loiFinancedFees";

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
  ltvPercent: string;
  ltcPercent: string;
  arvPercent: string;
  monthlyPayment: string;
  interestOnly: boolean;
  loanTerm: string;
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

  return {
    approvedAmount: stringifyFormField(approvedAmount),
    interestRate: parseStoredInterestRate(record),
    ltvPercent:
      record.ltvPercent != null && record.ltvPercent !== ""
        ? stringifyFormField(record.ltvPercent)
        : "",
    ltcPercent:
      record.ltcPercent != null && record.ltcPercent !== ""
        ? stringifyFormField(record.ltcPercent)
        : "",
    arvPercent:
      record.arvPercent != null && record.arvPercent !== ""
        ? stringifyFormField(record.arvPercent)
        : "",
    monthlyPayment:
      record.monthlyPayment != null && record.monthlyPayment !== ""
        ? stringifyFormField(record.monthlyPayment)
        : "",
    interestOnly: Boolean(record.interestOnly),
    loanTerm: record.loanTerm ? String(record.loanTerm) : "12 Months",
    requiredDocuments,
    customDocument: "",
  };
}

export function calculateSuggestedLoiMetrics(input: {
  approvedAmount?: string;
  interestRate?: string;
  interestOnly?: boolean;
  loanTerm?: string;
  propertyValue?: number | string | null;
  projectCost?: number | string | null;
  arv?: number | string | null;
  originationFeePercent?: string;
  exitFee?: string;
  processingFee?: string;
  underwritingFee?: string;
}) {
  const baseLoanAmount = toNumber(input.approvedAmount);
  const rate = toNumber(input.interestRate);
  const property = toNumber(input.propertyValue);
  const cost = toNumber(input.projectCost);
  const arv = toNumber(input.arv);
  const termMonths = parseTermMonths(input.loanTerm);

  const { totalLoanAmount, financedFees } = getTotalLoanAmountWithFinancedFees({
    approvedAmount: baseLoanAmount,
    originationFeePercent:
      input.originationFeePercent ?? LOI_DEFAULT_FINANCED_FEES.originationFeePercent,
    exitFee: input.exitFee ?? LOI_DEFAULT_FINANCED_FEES.exitFee,
    processingFee:
      input.processingFee ?? LOI_DEFAULT_FINANCED_FEES.processingFee,
    underwritingFee:
      input.underwritingFee ?? LOI_DEFAULT_FINANCED_FEES.underwritingFee,
  });

  const loanAmount = totalLoanAmount ?? baseLoanAmount;

  const ltv =
    loanAmount && property
      ? Number(((loanAmount / property) * 100).toFixed(2))
      : null;
  const ltc =
    loanAmount && cost ? Number(((loanAmount / cost) * 100).toFixed(2)) : null;
  const arvPercent =
    loanAmount && arv ? Number(((loanAmount / arv) * 100).toFixed(2)) : null;

  let monthlyPayment: number | null = null;
  if (loanAmount && rate != null && termMonths > 0) {
    if (input.interestOnly) {
      monthlyPayment = (loanAmount * rate) / 100 / 12;
    } else {
      const monthlyRate = rate / 100 / 12;
      if (monthlyRate === 0) {
        monthlyPayment = loanAmount / termMonths;
      } else {
        monthlyPayment =
          (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
          (Math.pow(1 + monthlyRate, termMonths) - 1);
      }
    }
  }

  return {
    baseLoanAmount,
    totalLoanAmount: loanAmount,
    financedFees,
    ltv,
    ltc,
    arvPercent,
    monthlyPayment:
      monthlyPayment != null ? Number(monthlyPayment.toFixed(2)) : null,
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
    requiredDocuments: string[];
  }>,
): LoiUnderwritingTerms {
  const requested = toNumber(requestedAmount);
  const loanTerm =
    seed?.loanTerm != null && String(seed.loanTerm).trim()
      ? String(seed.loanTerm).includes("Month")
        ? String(seed.loanTerm)
        : `${seed.loanTerm} Months`
      : "12 Months";

  const base: LoiUnderwritingTerms = {
    approvedAmount:
      requested != null && requested > 0 ? String(requested) : "",
    interestRate:
      seed?.interestRate != null && Number(seed.interestRate) > 0
        ? String(seed.interestRate)
        : "",
    ltvPercent: "",
    ltcPercent: "",
    arvPercent: "",
    monthlyPayment: "",
    interestOnly: true,
    loanTerm,
    requiredDocuments:
      seed?.requiredDocuments?.filter(Boolean) ||
      LOI_DEFAULT_DOCUMENTS.slice(0, 3),
    customDocument: "",
  };

  const suggested = calculateSuggestedLoiMetrics({
    approvedAmount: base.approvedAmount,
    interestRate: base.interestRate,
    interestOnly: base.interestOnly,
    loanTerm: base.loanTerm,
    propertyValue: seed?.propertyValue,
    projectCost: seed?.projectCost,
    arv: seed?.arv,
  });

  return {
    ...base,
    ltvPercent: suggested.ltv != null ? String(suggested.ltv) : "",
    ltcPercent: suggested.ltc != null ? String(suggested.ltc) : "",
    arvPercent: suggested.arvPercent != null ? String(suggested.arvPercent) : "",
    monthlyPayment:
      suggested.monthlyPayment != null ? String(suggested.monthlyPayment) : "",
  };
}

export function validateLoiUnderwritingTerms(terms: LoiUnderwritingTerms) {
  const errors: Partial<Record<keyof LoiUnderwritingTerms, string>> = {};

  const approvedAmount = toNumber(terms.approvedAmount);
  if (!terms.approvedAmount.trim()) {
    errors.approvedAmount = "Loan amount is required";
  } else if (approvedAmount == null || approvedAmount <= 0) {
    errors.approvedAmount = "Enter a valid loan amount";
  }

  const rate = toNumber(terms.interestRate);
  if (!terms.interestRate.trim()) {
    errors.interestRate = "Interest rate is required";
  } else if (rate == null || rate <= 0 || rate > 100) {
    errors.interestRate = "Enter a valid rate between 0 and 100";
  }

  if (!terms.loanTerm) {
    errors.loanTerm = "Loan term is required";
  }

  const ltv = toNumber(terms.ltvPercent);
  if (terms.ltvPercent.trim() && (ltv == null || ltv <= 0 || ltv > 100)) {
    errors.ltvPercent = "Enter a valid LTV";
  }

  const ltc = toNumber(terms.ltcPercent);
  if (terms.ltcPercent.trim() && (ltc == null || ltc <= 0 || ltc > 100)) {
    errors.ltcPercent = "Enter a valid LTC";
  }

  const arv = toNumber(terms.arvPercent);
  if (terms.arvPercent.trim() && (arv == null || arv <= 0 || arv > 100)) {
    errors.arvPercent = "Enter a valid ARV ratio";
  }

  const payment = toNumber(terms.monthlyPayment);
  if (!terms.monthlyPayment.trim()) {
    errors.monthlyPayment = "Monthly payment is required";
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

export function serializeLoiUnderwritingTerms(terms: LoiUnderwritingTerms) {
  const approvedAmount = toNumber(terms.approvedAmount) || 0;
  const interestRate = toNumber(terms.interestRate) || 0;
  const ltvPercent = toNumber(terms.ltvPercent);
  const ltcPercent = toNumber(terms.ltcPercent);
  const arvPercent = toNumber(terms.arvPercent);

  const feeDefaults = LOI_DEFAULT_FINANCED_FEES;
  const suggested = calculateSuggestedLoiMetrics({
    approvedAmount: terms.approvedAmount,
    interestRate: terms.interestRate,
    interestOnly: terms.interestOnly,
    loanTerm: terms.loanTerm,
    ...feeDefaults,
  });
  const monthlyPayment =
    suggested.monthlyPayment ?? toNumber(terms.monthlyPayment) ?? 0;

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
    ltvPercent,
    ltcPercent,
    arvPercent,
    monthlyPayment,
    totalLoanAmount: suggested.totalLoanAmount ?? approvedAmount,
    financedFees: suggested.financedFees ?? 0,
    originationFeePercent: feeDefaults.originationFeePercent,
    exitFee: feeDefaults.exitFee,
    processingFee: feeDefaults.processingFee,
    underwritingFee: feeDefaults.underwritingFee,
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
