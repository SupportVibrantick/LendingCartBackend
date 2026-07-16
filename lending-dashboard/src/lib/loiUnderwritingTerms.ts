export type LoiInterestRateType = "FIXED" | "VARIABLE";

export type LoiUnderwritingTerms = {
  approvedAmount: string;
  interestRateType: LoiInterestRateType;
  interestRate: string;
  variableRateIndex: string;
  variableRateSpread: string;
  loanTerm: string;
  amortization: string;
  paymentFrequency: string;
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
  closingConditions: string[];
  customClosingCondition: string;
  specialConditions: string;
  expirationDate: string;
};

export const LOI_LOAN_TERM_OPTIONS = ["12 Months", "24 Months", "36 Months"];
export const LOI_AMORTIZATION_OPTIONS = [
  "Interest Only",
  "30 Years",
  "25 Years",
  "20 Years",
];
export const LOI_PAYMENT_FREQUENCY_OPTIONS = [
  "Monthly",
  "Quarterly",
  "Interest Only",
];
export const LOI_ORIGINATION_FEE_OPTIONS = ["1%", "2%", "2.5%"];
export const LOI_EXIT_FEE_OPTIONS = ["0%", "1%", "Flat Fee"];
export const LOI_PROCESSING_FEE_OPTIONS = ["$995", "$1,500"];
export const LOI_LEGAL_FEE_OPTIONS = ["Borrower Pays", "Actual Cost"];
export const LOI_YES_NO_OPTIONS = ["Yes", "No"];
export const LOI_ENVIRONMENTAL_OPTIONS = ["Required", "Waived"];
export const LOI_PERSONAL_GUARANTEE_OPTIONS = ["Required", "Not Required"];
export const LOI_PREPAYMENT_OPTIONS = ["None", "3-2-1", "Yield Maintenance"];
export const LOI_RECOURSE_OPTIONS = ["Full", "Limited", "Non-Recourse"];

export const LOI_CLOSING_CONDITION_OPTIONS = [
  "Clear Title",
  "Insurance",
  "Entity Docs",
  "Bank Statements",
  "Appraisal",
  "Environmental",
  "Background Check",
];

export function createEmptyLoiUnderwritingTerms(
  requestedAmount?: number | string | null,
): LoiUnderwritingTerms {
  const requested = Number(String(requestedAmount || "").replace(/[$,\s]/g, ""));
  return {
    approvedAmount:
      Number.isFinite(requested) && requested > 0 ? String(requested) : "",
    interestRateType: "FIXED",
    interestRate: "",
    variableRateIndex: "SOFR",
    variableRateSpread: "",
    loanTerm: "12 Months",
    amortization: "25 Years",
    paymentFrequency: "Monthly",
    originationFeePercent: "2%",
    exitFee: "0%",
    processingFee: "$995",
    underwritingFee: "$750",
    legalFee: "Borrower Pays",
    appraisalRequired: "Yes",
    environmentalReport: "Required",
    personalGuarantee: "Required",
    prepaymentPenalty: "None",
    recourse: "Full",
    closingConditions: ["Clear Title", "Insurance", "Appraisal"],
    customClosingCondition: "",
    specialConditions: "",
    expirationDate: "",
  };
}

export function validateLoiUnderwritingTerms(terms: LoiUnderwritingTerms) {
  const errors: Partial<Record<keyof LoiUnderwritingTerms, string>> = {};

  const approvedAmount = Number(String(terms.approvedAmount).replace(/[$,\s]/g, ""));
  if (!terms.approvedAmount.trim()) {
    errors.approvedAmount = "Approved amount is required";
  } else if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    errors.approvedAmount = "Enter a valid approved amount";
  }

  if (terms.interestRateType === "FIXED") {
    const rate = Number(terms.interestRate);
    if (!terms.interestRate.trim()) {
      errors.interestRate = "Interest rate is required";
    } else if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
      errors.interestRate = "Enter a valid rate between 0 and 100";
    }
  } else {
    if (!terms.variableRateIndex.trim()) {
      errors.variableRateIndex = "Index is required";
    }
    const spread = Number(terms.variableRateSpread);
    if (!terms.variableRateSpread.trim()) {
      errors.variableRateSpread = "Spread is required";
    } else if (!Number.isFinite(spread) || spread < 0 || spread > 100) {
      errors.variableRateSpread = "Enter a valid spread";
    }
  }

  if (!terms.loanTerm) errors.loanTerm = "Loan term is required";
  if (!terms.amortization) errors.amortization = "Amortization is required";
  if (!terms.paymentFrequency) {
    errors.paymentFrequency = "Payment frequency is required";
  }
  if (!terms.originationFeePercent) {
    errors.originationFeePercent = "Origination fee is required";
  }
  if (!terms.expirationDate) {
    errors.expirationDate = "Expiration date is required";
  }

  const conditions = [
    ...terms.closingConditions,
    ...(terms.customClosingCondition.trim()
      ? [terms.customClosingCondition.trim()]
      : []),
  ];
  if (conditions.length === 0) {
    errors.closingConditions = "Select at least one closing condition";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function serializeLoiUnderwritingTerms(terms: LoiUnderwritingTerms) {
  const approvedAmount = Number(
    String(terms.approvedAmount).replace(/[$,\s]/g, ""),
  );

  const interestRateDisplay =
    terms.interestRateType === "VARIABLE"
      ? `${terms.variableRateIndex.trim()} + ${terms.variableRateSpread.trim()}%`
      : `${Number(terms.interestRate)}%`;

  const closingConditions = [
    ...terms.closingConditions,
    ...(terms.customClosingCondition.trim()
      ? [terms.customClosingCondition.trim()]
      : []),
  ];

  return {
    approvedAmount,
    interestRateType: terms.interestRateType,
    interestRate:
      terms.interestRateType === "FIXED" ? Number(terms.interestRate) : null,
    interestRateDisplay,
    variableRateIndex:
      terms.interestRateType === "VARIABLE"
        ? terms.variableRateIndex.trim()
        : null,
    variableRateSpread:
      terms.interestRateType === "VARIABLE"
        ? Number(terms.variableRateSpread)
        : null,
    loanTerm: terms.loanTerm,
    amortization: terms.amortization,
    paymentFrequency: terms.paymentFrequency,
    originationFeePercent: terms.originationFeePercent,
    exitFee: terms.exitFee,
    processingFee: terms.processingFee,
    underwritingFee: terms.underwritingFee,
    legalFee: terms.legalFee,
    appraisalRequired: terms.appraisalRequired,
    environmentalReport: terms.environmentalReport,
    personalGuarantee: terms.personalGuarantee,
    prepaymentPenalty: terms.prepaymentPenalty,
    recourse: terms.recourse,
    closingConditions,
    specialConditions: terms.specialConditions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    expirationDate: terms.expirationDate,
  };
}
