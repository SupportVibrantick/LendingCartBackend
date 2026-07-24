export function toLoiAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

export function parseLoiFeeAmount(
  feeValue: string | undefined,
  baseLoanAmount: number | null,
) {
  if (!feeValue) return 0;
  const raw = String(feeValue).trim();
  if (/flat\s*fee/i.test(raw) || /borrower\s*pays/i.test(raw)) return 0;
  if (raw.includes("%")) {
    const percent = toLoiAmount(raw);
    if (percent == null || !baseLoanAmount) return 0;
    return (baseLoanAmount * percent) / 100;
  }
  return toLoiAmount(raw) || 0;
}

export type FinancedFeeInput = {
  baseLoanAmount?: number | string | null;
  approvedAmount?: number | string | null;
  originationFeePercent?: string;
  processingFee?: string;
  underwritingFee?: string;
  exitFee?: string;
};

export function sumFinancedLoiFees(input: FinancedFeeInput) {
  const baseLoanAmount = toLoiAmount(
    input.baseLoanAmount ?? input.approvedAmount,
  );
  if (!baseLoanAmount) return 0;

  return (
    parseLoiFeeAmount(input.originationFeePercent, baseLoanAmount) +
    parseLoiFeeAmount(input.processingFee, baseLoanAmount) +
    parseLoiFeeAmount(input.underwritingFee, baseLoanAmount) +
    parseLoiFeeAmount(input.exitFee, baseLoanAmount)
  );
}

export function getTotalLoanAmountWithFinancedFees(input: FinancedFeeInput) {
  const baseLoanAmount = toLoiAmount(
    input.baseLoanAmount ?? input.approvedAmount,
  );
  if (!baseLoanAmount) {
    return {
      baseLoanAmount: null as number | null,
      financedFees: 0,
      totalLoanAmount: null as number | null,
    };
  }

  const financedFees = sumFinancedLoiFees({ ...input, baseLoanAmount });

  return {
    baseLoanAmount,
    financedFees,
    totalLoanAmount: baseLoanAmount + financedFees,
  };
}
