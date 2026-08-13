import { getTotalLoanAmountWithFinancedFees } from "./loiFinancedFees";

export type BrokerLoiApplicationContext = {
  borrowerName?: string;
  propertyAddress?: string;
  propertyType?: string;
  loanProduct?: string;
  /** Canonical LoanProductCode for document catalog / custom docs. */
  loanProductCode?: string;
  brokerName?: string;
};

export type BrokerLoiTerms = {
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
  originationFeePercent: string;
  exitFee: string;
  processingFee: string;
  underwritingFee: string;
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
  ltvPercent: "",
  ltcPercent: "",
  arvPercent: "",
  monthlyPayment: "",
  interestOnly: true,
  loanTerm: "",
  requiredDocuments: [],
  customDocument: "",
  originationFeePercent: "",
  exitFee: "",
  processingFee: "",
  underwritingFee: "",
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

export function calculateSuggestedBrokerLoiMetrics(input: {
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
      input.originationFeePercent ?? DEFAULT_BROKER_LOI_TERMS.originationFeePercent,
    exitFee: input.exitFee ?? DEFAULT_BROKER_LOI_TERMS.exitFee,
    processingFee: input.processingFee ?? DEFAULT_BROKER_LOI_TERMS.processingFee,
    underwritingFee:
      input.underwritingFee ?? DEFAULT_BROKER_LOI_TERMS.underwritingFee,
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
      monthlyPayment =
        monthlyRate === 0
          ? loanAmount / termMonths
          : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
            (Math.pow(1 + monthlyRate, termMonths) - 1);
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

export function validateBrokerLoiTerms(terms: BrokerLoiTerms) {
  const errors: Partial<Record<keyof BrokerLoiTerms, string>> = {};

  const approvedAmount = toNumber(terms.approvedAmount);
  if (!terms.approvedAmount.trim()) {
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

  const payment = toNumber(terms.monthlyPayment);
  if (!String(terms.monthlyPayment || "").trim()) {
    errors.monthlyPayment = "Monthly payment is required";
  } else if (payment == null || payment <= 0) {
    errors.monthlyPayment = "Enter a valid monthly payment";
  }

  const ltv = toNumber(terms.ltvPercent);
  if (!String(terms.ltvPercent || "").trim()) {
    errors.ltvPercent = "LTV % is required";
  } else if (ltv == null || ltv < 0 || ltv > 100) {
    errors.ltvPercent = "Enter a valid LTV between 0 and 100";
  }

  const arv = toNumber(terms.arvPercent);
  if (!String(terms.arvPercent || "").trim()) {
    errors.arvPercent = "ARV % is required";
  } else if (arv == null || arv < 0 || arv > 100) {
    errors.arvPercent = "Enter a valid ARV between 0 and 100";
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
): BrokerLoiTerms {
  const merged: BrokerLoiTerms = {
    ...DEFAULT_BROKER_LOI_TERMS,
    ...terms,
    requiredDocuments: terms?.requiredDocuments ?? [],
    specialConditions: terms?.specialConditions ?? [],
  };

  return {
    ...merged,
    approvedAmount: formatBrokerLoiNumberInput(merged.approvedAmount),
    interestRate: formatBrokerLoiNumberInput(merged.interestRate),
    monthlyPayment: formatBrokerLoiNumberInput(merged.monthlyPayment),
    ltvPercent: formatBrokerLoiNumberInput(merged.ltvPercent),
    ltcPercent: formatBrokerLoiNumberInput(merged.ltcPercent),
    arvPercent: formatBrokerLoiNumberInput(merged.arvPercent),
    originationFeePercent: formatBrokerLoiNumberInput(
      merged.originationFeePercent,
    ),
    processingFee: formatBrokerLoiNumberInput(merged.processingFee),
    underwritingFee: formatBrokerLoiNumberInput(merged.underwritingFee),
    prepaymentPenalty: formatBrokerLoiNumberInput(merged.prepaymentPenalty),
    exitFee: formatBrokerLoiNumberInput(merged.exitFee),
    legalFee: formatBrokerLoiNumberInput(merged.legalFee),
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
