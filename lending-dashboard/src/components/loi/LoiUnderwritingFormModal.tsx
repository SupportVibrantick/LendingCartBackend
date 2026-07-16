import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  LOI_AMORTIZATION_OPTIONS,
  LOI_CLOSING_CONDITION_OPTIONS,
  LOI_ENVIRONMENTAL_OPTIONS,
  LOI_EXIT_FEE_OPTIONS,
  LOI_LEGAL_FEE_OPTIONS,
  LOI_LOAN_TERM_OPTIONS,
  LOI_ORIGINATION_FEE_OPTIONS,
  LOI_PAYMENT_FREQUENCY_OPTIONS,
  LOI_PERSONAL_GUARANTEE_OPTIONS,
  LOI_PREPAYMENT_OPTIONS,
  LOI_PROCESSING_FEE_OPTIONS,
  LOI_RECOURSE_OPTIONS,
  LOI_YES_NO_OPTIONS,
  createEmptyLoiUnderwritingTerms,
  serializeLoiUnderwritingTerms,
  validateLoiUnderwritingTerms,
  type LoiUnderwritingTerms,
} from "../../lib/loiUnderwritingTerms";
import {
  calculateLoiMetricsPreview,
  formatMetricCurrency,
  formatMetricPercent,
} from "../../lib/loiCalculatedMetrics";

type Props = {
  isOpen: boolean;
  requestedAmount?: number | string | null;
  propertyValue?: number | string | null;
  projectCost?: number | string | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ReturnType<typeof serializeLoiUnderwritingTerms>) => void;
};

function ChipSelect({
  label,
  value,
  options,
  error,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-[#0F766E] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function LoiUnderwritingFormModal({
  isOpen,
  requestedAmount,
  propertyValue = null,
  projectCost = null,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [terms, setTerms] = useState<LoiUnderwritingTerms>(() =>
    createEmptyLoiUnderwritingTerms(requestedAmount),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof LoiUnderwritingTerms, string>>
  >({});

  useEffect(() => {
    if (!isOpen) return;
    setTerms(createEmptyLoiUnderwritingTerms(requestedAmount));
    setErrors({});
  }, [isOpen, requestedAmount]);

  const calculated = useMemo(
    () =>
      calculateLoiMetricsPreview({
        approvedAmount: terms.approvedAmount,
        interestRateType: terms.interestRateType,
        interestRate: terms.interestRate,
        loanTerm: terms.loanTerm,
        amortization: terms.amortization,
        paymentFrequency: terms.paymentFrequency,
        propertyValue,
        projectCost,
        originationFeePercent: terms.originationFeePercent,
        exitFee: terms.exitFee,
        processingFee: terms.processingFee,
        underwritingFee: terms.underwritingFee,
      }),
    [terms, propertyValue, projectCost],
  );

  if (!isOpen) return null;

  const requestedDisplay = (() => {
    const numeric = Number(String(requestedAmount || "").replace(/[$,\s]/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) return "—";
    return `$${numeric.toLocaleString("en-US")}`;
  })();

  const update = <K extends keyof LoiUnderwritingTerms>(
    key: K,
    value: LoiUnderwritingTerms[K],
  ) => {
    setTerms((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const toggleCondition = (condition: string) => {
    setTerms((prev) => {
      const exists = prev.closingConditions.includes(condition);
      return {
        ...prev,
        closingConditions: exists
          ? prev.closingConditions.filter((item) => item !== condition)
          : [...prev.closingConditions, condition],
      };
    });
    if (errors.closingConditions) {
      setErrors((prev) => ({ ...prev, closingConditions: undefined }));
    }
  };

  const handleSubmit = () => {
    const result = validateLoiUnderwritingTerms(terms);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSubmit(serializeLoiUnderwritingTerms(terms));
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Lender Credit Decision
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Application details auto-fill. Enter your commercial terms for the
              Term Sheet / LOI.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              Requested:{" "}
              <span className="font-bold text-[#0F766E]">{requestedDisplay}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Loan Amount Approved
              </label>
              <input
                type="number"
                min="0"
                value={terms.approvedAmount}
                onChange={(e) => update("approvedAmount", e.target.value)}
                placeholder="1750000"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
              />
              {errors.approvedAmount && (
                <p className="mt-1 text-xs text-red-500">{errors.approvedAmount}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Offer Valid Until
              </label>
              <input
                type="date"
                value={terms.expirationDate}
                onChange={(e) => update("expirationDate", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
              />
              {errors.expirationDate && (
                <p className="mt-1 text-xs text-red-500">{errors.expirationDate}</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Interest Rate Type
            </p>
            <div className="mb-3 flex gap-2">
              {(["FIXED", "VARIABLE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update("interestRateType", type)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    terms.interestRateType === type
                      ? "bg-[#0F766E] text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {type === "FIXED" ? "Fixed" : "Variable"}
                </button>
              ))}
            </div>

            {terms.interestRateType === "FIXED" ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={terms.interestRate}
                  onChange={(e) => update("interestRate", e.target.value)}
                  placeholder="10.75"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800 md:max-w-xs"
                />
                {errors.interestRate && (
                  <p className="mt-1 text-xs text-red-500">{errors.interestRate}</p>
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Index
                  </label>
                  <input
                    type="text"
                    value={terms.variableRateIndex}
                    onChange={(e) => update("variableRateIndex", e.target.value)}
                    placeholder="SOFR"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                  />
                  {errors.variableRateIndex && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.variableRateIndex}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Spread (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={terms.variableRateSpread}
                    onChange={(e) =>
                      update("variableRateSpread", e.target.value)
                    }
                    placeholder="4.25"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                  />
                  {errors.variableRateSpread && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.variableRateSpread}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChipSelect
              label="Loan Term"
              value={terms.loanTerm}
              options={LOI_LOAN_TERM_OPTIONS}
              error={errors.loanTerm}
              onChange={(value) => update("loanTerm", value)}
            />
            <ChipSelect
              label="Amortization"
              value={terms.amortization}
              options={LOI_AMORTIZATION_OPTIONS}
              error={errors.amortization}
              onChange={(value) => update("amortization", value)}
            />
            <ChipSelect
              label="Payment Frequency"
              value={terms.paymentFrequency}
              options={LOI_PAYMENT_FREQUENCY_OPTIONS}
              error={errors.paymentFrequency}
              onChange={(value) => update("paymentFrequency", value)}
            />
            <ChipSelect
              label="Origination Fee"
              value={terms.originationFeePercent}
              options={LOI_ORIGINATION_FEE_OPTIONS}
              error={errors.originationFeePercent}
              onChange={(value) => update("originationFeePercent", value)}
            />
            <ChipSelect
              label="Exit Fee"
              value={terms.exitFee}
              options={LOI_EXIT_FEE_OPTIONS}
              onChange={(value) => update("exitFee", value)}
            />
            <ChipSelect
              label="Processing Fee"
              value={terms.processingFee}
              options={LOI_PROCESSING_FEE_OPTIONS}
              onChange={(value) => update("processingFee", value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Underwriting Fee
              </label>
              <input
                type="text"
                value={terms.underwritingFee}
                onChange={(e) => update("underwritingFee", e.target.value)}
                placeholder="$750"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <ChipSelect
              label="Legal Fee"
              value={terms.legalFee}
              options={LOI_LEGAL_FEE_OPTIONS}
              onChange={(value) => update("legalFee", value)}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChipSelect
              label="Appraisal Required"
              value={terms.appraisalRequired}
              options={LOI_YES_NO_OPTIONS}
              onChange={(value) => update("appraisalRequired", value)}
            />
            <ChipSelect
              label="Environmental Report"
              value={terms.environmentalReport}
              options={LOI_ENVIRONMENTAL_OPTIONS}
              onChange={(value) => update("environmentalReport", value)}
            />
            <ChipSelect
              label="Personal Guarantee"
              value={terms.personalGuarantee}
              options={LOI_PERSONAL_GUARANTEE_OPTIONS}
              onChange={(value) => update("personalGuarantee", value)}
            />
            <ChipSelect
              label="Prepayment Penalty"
              value={terms.prepaymentPenalty}
              options={LOI_PREPAYMENT_OPTIONS}
              onChange={(value) => update("prepaymentPenalty", value)}
            />
            <ChipSelect
              label="Recourse"
              value={terms.recourse}
              options={LOI_RECOURSE_OPTIONS}
              onChange={(value) => update("recourse", value)}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Closing Conditions
            </p>
            <div className="flex flex-wrap gap-2">
              {LOI_CLOSING_CONDITION_OPTIONS.map((condition) => {
                const active = terms.closingConditions.includes(condition);
                return (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => toggleCondition(condition)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-purple-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {condition}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={terms.customClosingCondition}
              onChange={(e) => update("customClosingCondition", e.target.value)}
              placeholder="Add custom condition (optional)"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
            />
            {errors.closingConditions && (
              <p className="mt-1 text-xs text-red-500">
                {errors.closingConditions}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Special Conditions
            </label>
            <p className="mb-2 text-xs text-slate-500">
              One condition per line. These appear on the Term Sheet as lender
              underwriting conditions.
            </p>
            <textarea
              value={terms.specialConditions}
              onChange={(e) => update("specialConditions", e.target.value)}
              rows={5}
              placeholder={
                "Borrower must maintain DSCR above 1.25.\nAdditional collateral required.\nSubject to satisfactory appraisal.\nInsurance required before funding."
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Automatically Calculated
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["LTV", formatMetricPercent(calculated.ltv)],
                ["LTC", formatMetricPercent(calculated.ltc)],
                [
                  "Monthly Payment",
                  calculated.isFloating
                    ? "Floating"
                    : formatMetricCurrency(calculated.monthlyPayment),
                ],
                [
                  "Balloon Payment",
                  formatMetricCurrency(calculated.balloonPayment),
                ],
                [
                  "Interest Amount",
                  calculated.isFloating
                    ? "Floating"
                    : formatMetricCurrency(calculated.interestAmount),
                ],
                [
                  "Est. Closing Cost",
                  formatMetricCurrency(calculated.estimatedClosingCost),
                ],
                [
                  "APR",
                  calculated.isFloating
                    ? "Floating"
                    : formatMetricPercent(calculated.apr),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              LTV/LTC use application property value and project cost. Payment,
              interest, balloon, and APR update from your approved amount, rate,
              term, and fees. Variable rates show Floating until a fixed quote is
              used.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Term Sheet / LOI"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
