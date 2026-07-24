function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function parseFeeAmount(feeValue, loanAmount) {
  if (feeValue === null || feeValue === undefined || feeValue === "") return 0;
  const raw = String(feeValue).trim();
  if (/flat\s*fee/i.test(raw) || /borrower\s*pays/i.test(raw)) return 0;
  if (raw.includes("%")) {
    const percent = toNumber(raw);
    if (percent == null || !loanAmount) return 0;
    return (loanAmount * percent) / 100;
  }
  const amount = toNumber(raw);
  return amount || 0;
}

/**
 * Fees rolled into the loan note (excludes upfront / out-of-pocket items).
 */
function sumFinancedFees({
  baseLoanAmount,
  originationFeePercent,
  processingFee,
  underwritingFee,
  exitFee,
}) {
  const base = toNumber(baseLoanAmount);
  if (!base) return 0;

  return (
    parseFeeAmount(originationFeePercent, base) +
    parseFeeAmount(processingFee, base) +
    parseFeeAmount(underwritingFee, base) +
    parseFeeAmount(exitFee, base)
  );
}

function getTotalLoanAmountWithFinancedFees(input) {
  const baseLoanAmount = toNumber(input.baseLoanAmount ?? input.approvedAmount);
  if (!baseLoanAmount) {
    return {
      baseLoanAmount: null,
      financedFees: 0,
      totalLoanAmount: null,
    };
  }

  const financedFees = sumFinancedFees({
    baseLoanAmount,
    originationFeePercent: input.originationFeePercent,
    processingFee: input.processingFee,
    underwritingFee: input.underwritingFee,
    exitFee: input.exitFee,
  });

  return {
    baseLoanAmount,
    financedFees,
    totalLoanAmount: baseLoanAmount + financedFees,
  };
}

module.exports = {
  toNumber,
  parseFeeAmount,
  sumFinancedFees,
  getTotalLoanAmountWithFinancedFees,
};
