const {
  getTotalLoanAmountWithFinancedFees,
} = require("./financedLoanAmount");

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function formatCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return `${Number(value.toFixed(digits))}%`;
}

function parseMonthsFromLabel(label) {
  if (!label) return 0;
  const months = String(label).match(/(\d+)\s*Months?/i);
  if (months) return Number(months[1]);
  const years = String(label).match(/(\d+)\s*Years?/i);
  if (years) return Number(years[1]) * 12;
  return 0;
}

function isInterestOnly(amortization, paymentFrequency) {
  return (
    /interest\s*only/i.test(String(amortization || "")) ||
    /interest\s*only/i.test(String(paymentFrequency || ""))
  );
}

function amortizingPayment(principal, annualRate, months) {
  if (!principal || !months || months <= 0) return null;
  const monthlyRate = (annualRate || 0) / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function remainingBalance(principal, annualRate, amortMonths, paymentsMade) {
  if (!principal) return null;
  if (!amortMonths || amortMonths <= 0) return principal;
  if (paymentsMade >= amortMonths) return 0;

  const monthlyRate = (annualRate || 0) / 100 / 12;
  if (monthlyRate === 0) {
    return Math.max(principal - (principal / amortMonths) * paymentsMade, 0);
  }

  const payment = amortizingPayment(principal, annualRate, amortMonths);
  if (!payment) return principal;

  return (
    principal * Math.pow(1 + monthlyRate, paymentsMade) -
    payment * ((Math.pow(1 + monthlyRate, paymentsMade) - 1) / monthlyRate)
  );
}

function parseFeeAmount(feeValue, loanAmount) {
  if (feeValue === null || feeValue === undefined || feeValue === "") return 0;
  const raw = String(feeValue).trim();
  if (/flat\s*fee/i.test(raw)) return 0;
  if (raw.includes("%")) {
    const percent = toNumber(raw);
    if (percent == null || !loanAmount) return 0;
    return (loanAmount * percent) / 100;
  }
  const amount = toNumber(raw);
  return amount || 0;
}

/**
 * Approximate APR using Newton-Raphson on monthly cashflows
 * (loan net of fees vs scheduled payments + balloon).
 */
function approximateApr({
  loanAmount,
  financedFees,
  monthlyPayment,
  termMonths,
  balloon,
}) {
  if (!loanAmount || !termMonths || !monthlyPayment) return null;

  const netProceeds = loanAmount - (financedFees || 0);
  if (netProceeds <= 0) return null;

  let rate = 0.01;
  for (let i = 0; i < 40; i += 1) {
    let pv = 0;
    let dpv = 0;
    for (let m = 1; m <= termMonths; m += 1) {
      const payment = m === termMonths ? monthlyPayment + (balloon || 0) : monthlyPayment;
      const denom = Math.pow(1 + rate, m);
      pv += payment / denom;
      dpv -= (m * payment) / (denom * (1 + rate));
    }
    const f = pv - netProceeds;
    if (Math.abs(f) < 0.01) break;
    if (!dpv) break;
    rate -= f / dpv;
    if (rate < -0.5 || rate > 1) return null;
  }

  return rate * 12 * 100;
}

function calculateLoiMetrics({
  approvedAmount,
  interestRate,
  interestRateType = "FIXED",
  loanTerm,
  amortization,
  paymentFrequency,
  propertyValue,
  projectCost,
  originationFeePercent,
  exitFee,
  processingFee,
  underwritingFee,
}) {
  const loanAmount = toNumber(approvedAmount);
  const rate =
    interestRateType === "VARIABLE" ? null : toNumber(interestRate);
  const termMonths = parseMonthsFromLabel(loanTerm);
  const amortMonths = isInterestOnly(amortization, paymentFrequency)
    ? 0
    : parseMonthsFromLabel(amortization) || termMonths;
  const property = toNumber(propertyValue);
  const cost = toNumber(projectCost);

  const { baseLoanAmount, financedFees, totalLoanAmount } =
    getTotalLoanAmountWithFinancedFees({
      baseLoanAmount: loanAmount,
      originationFeePercent,
      processingFee,
      underwritingFee,
      exitFee,
    });

  const principalForPayment = totalLoanAmount || loanAmount;

  const ltv =
    principalForPayment && property
      ? (principalForPayment / property) * 100
      : null;
  const ltc =
    principalForPayment && cost ? (principalForPayment / cost) * 100 : null;

  const estimatedClosingCost = financedFees;

  if (!loanAmount || !termMonths) {
    return {
      baseLoanAmount,
      totalLoanAmount: principalForPayment,
      financedFees,
      ltv,
      ltc,
      monthlyPayment: null,
      balloonPayment: null,
      interestAmount: null,
      estimatedClosingCost,
      apr: null,
      isFloating: interestRateType === "VARIABLE",
    };
  }

  if (rate == null) {
    return {
      baseLoanAmount,
      totalLoanAmount: principalForPayment,
      financedFees,
      ltv,
      ltc,
      monthlyPayment: null,
      balloonPayment: principalForPayment,
      interestAmount: null,
      estimatedClosingCost,
      apr: null,
      isFloating: true,
    };
  }

  const interestOnly = isInterestOnly(amortization, paymentFrequency);
  let monthlyPaymentValue;
  let balloonPaymentValue;
  let interestAmountValue;

  if (interestOnly) {
    monthlyPaymentValue = (principalForPayment * rate) / 100 / 12;
    balloonPaymentValue = principalForPayment;
    interestAmountValue = monthlyPaymentValue * termMonths;
  } else {
    const scheduleMonths = amortMonths > 0 ? amortMonths : termMonths;
    monthlyPaymentValue = amortizingPayment(
      principalForPayment,
      rate,
      scheduleMonths,
    );
    balloonPaymentValue = remainingBalance(
      principalForPayment,
      rate,
      scheduleMonths,
      termMonths,
    );
    const totalPaid =
      (monthlyPaymentValue || 0) * termMonths + (balloonPaymentValue || 0);
    interestAmountValue = Math.max(totalPaid - principalForPayment, 0);
  }

  const apr = approximateApr({
    loanAmount: principalForPayment,
    financedFees: estimatedClosingCost,
    monthlyPayment: monthlyPaymentValue,
    termMonths,
    balloon: balloonPaymentValue,
  });

  return {
    baseLoanAmount,
    totalLoanAmount: principalForPayment,
    financedFees,
    ltv,
    ltc,
    monthlyPayment: monthlyPaymentValue,
    balloonPayment: balloonPaymentValue,
    interestAmount: interestAmountValue,
    estimatedClosingCost,
    apr,
    isFloating: false,
  };
}

function formatLoiMetrics(metrics) {
  const floating = metrics?.isFloating;
  return {
    ltvRatio: formatPercent(metrics?.ltv),
    ltcRatio: formatPercent(metrics?.ltc),
    monthlyPayment: floating
      ? "Floating"
      : formatCurrency(metrics?.monthlyPayment),
    balloonPayment: formatCurrency(metrics?.balloonPayment),
    interestAmount: floating
      ? "Floating"
      : formatCurrency(metrics?.interestAmount),
    estimatedClosingCost: formatCurrency(metrics?.estimatedClosingCost),
    apr: floating ? "Floating" : formatPercent(metrics?.apr),
  };
}

module.exports = {
  calculateLoiMetrics,
  formatLoiMetrics,
  parseMonthsFromLabel,
  parseFeeAmount,
  toNumber,
  formatCurrency,
  formatPercent,
};
