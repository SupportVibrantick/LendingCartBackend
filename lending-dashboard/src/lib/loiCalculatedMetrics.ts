export function toMetricNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[$,\s%]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

export function formatMetricCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function formatMetricPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${Number(value.toFixed(digits))}%`;
}

function parseMonthsFromLabel(label?: string) {
  if (!label) return 0;
  const months = String(label).match(/(\d+)\s*Months?/i);
  if (months) return Number(months[1]);
  const years = String(label).match(/(\d+)\s*Years?/i);
  if (years) return Number(years[1]) * 12;
  return 0;
}

function isInterestOnly(amortization?: string, paymentFrequency?: string) {
  return (
    /interest\s*only/i.test(String(amortization || "")) ||
    /interest\s*only/i.test(String(paymentFrequency || ""))
  );
}

function amortizingPayment(principal: number, annualRate: number, months: number) {
  if (!principal || !months || months <= 0) return null;
  const monthlyRate = (annualRate || 0) / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function remainingBalance(
  principal: number,
  annualRate: number,
  amortMonths: number,
  paymentsMade: number,
) {
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

function parseFeeAmount(feeValue: string | undefined, loanAmount: number | null) {
  if (!feeValue) return 0;
  const raw = String(feeValue).trim();
  if (/flat\s*fee/i.test(raw)) return 0;
  if (raw.includes("%")) {
    const percent = toMetricNumber(raw);
    if (percent == null || !loanAmount) return 0;
    return (loanAmount * percent) / 100;
  }
  return toMetricNumber(raw) || 0;
}

function approximateApr({
  loanAmount,
  financedFees,
  monthlyPayment,
  termMonths,
  balloon,
}: {
  loanAmount: number;
  financedFees: number;
  monthlyPayment: number;
  termMonths: number;
  balloon: number | null;
}) {
  const netProceeds = loanAmount - (financedFees || 0);
  if (netProceeds <= 0) return null;

  let rate = 0.01;
  for (let i = 0; i < 40; i += 1) {
    let pv = 0;
    let dpv = 0;
    for (let m = 1; m <= termMonths; m += 1) {
      const payment =
        m === termMonths ? monthlyPayment + (balloon || 0) : monthlyPayment;
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

export type LoiCalculatedMetricsInput = {
  approvedAmount?: string;
  interestRateType?: "FIXED" | "VARIABLE";
  interestRate?: string;
  loanTerm?: string;
  amortization?: string;
  paymentFrequency?: string;
  propertyValue?: number | string | null;
  projectCost?: number | string | null;
  originationFeePercent?: string;
  exitFee?: string;
  processingFee?: string;
  underwritingFee?: string;
};

export function calculateLoiMetricsPreview(input: LoiCalculatedMetricsInput) {
  const loanAmount = toMetricNumber(input.approvedAmount);
  const rate =
    input.interestRateType === "VARIABLE"
      ? null
      : toMetricNumber(input.interestRate);
  const termMonths = parseMonthsFromLabel(input.loanTerm);
  const amortMonths = isInterestOnly(input.amortization, input.paymentFrequency)
    ? 0
    : parseMonthsFromLabel(input.amortization) || termMonths;
  const property = toMetricNumber(input.propertyValue);
  const cost = toMetricNumber(input.projectCost);

  const ltv = loanAmount && property ? (loanAmount / property) * 100 : null;
  const ltc = loanAmount && cost ? (loanAmount / cost) * 100 : null;

  const estimatedClosingCost =
    parseFeeAmount(input.originationFeePercent, loanAmount) +
    parseFeeAmount(input.processingFee, loanAmount) +
    parseFeeAmount(input.underwritingFee, loanAmount) +
    parseFeeAmount(input.exitFee, loanAmount);

  if (!loanAmount || !termMonths || rate == null) {
    return {
      ltv,
      ltc,
      monthlyPayment: null as number | null,
      balloonPayment: loanAmount,
      interestAmount: null as number | null,
      estimatedClosingCost,
      apr: null as number | null,
      isFloating: input.interestRateType === "VARIABLE",
    };
  }

  const interestOnly = isInterestOnly(
    input.amortization,
    input.paymentFrequency,
  );

  let monthlyPaymentValue: number | null;
  let balloonPaymentValue: number | null;
  let interestAmountValue: number | null;

  if (interestOnly) {
    monthlyPaymentValue = (loanAmount * rate) / 100 / 12;
    balloonPaymentValue = loanAmount;
    interestAmountValue = monthlyPaymentValue * termMonths;
  } else {
    const scheduleMonths = amortMonths > 0 ? amortMonths : termMonths;
    monthlyPaymentValue = amortizingPayment(loanAmount, rate, scheduleMonths);
    balloonPaymentValue = remainingBalance(
      loanAmount,
      rate,
      scheduleMonths,
      termMonths,
    );
    const totalPaid =
      (monthlyPaymentValue || 0) * termMonths + (balloonPaymentValue || 0);
    interestAmountValue = Math.max(totalPaid - loanAmount, 0);
  }

  const apr = approximateApr({
    loanAmount,
    financedFees: estimatedClosingCost,
    monthlyPayment: monthlyPaymentValue || 0,
    termMonths,
    balloon: balloonPaymentValue,
  });

  return {
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
