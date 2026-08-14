import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, User } from "lucide-react";
import toast from "react-hot-toast";
import LoiBrandingFields from "./LoiBrandingFields";
import LoiRequiredDocumentsPicker from "./LoiRequiredDocumentsPicker";
import LoanDateField from "../form/LoanDateField";
import {
  getLoiBrandingValidationMessage,
  isLoiBrandingComplete,
  type LoiBrandingValues,
} from "../../lib/loiBranding";
import {
  BROKER_LOI_TERM_OPTIONS,
  calculateBindingMaxLoan,
  calculateSuggestedBrokerLoiMetrics,
  formatBrokerLoiNumberInput,
  getLoiValueFieldLabel,
  mergeBrokerLoiDocuments,
  normalizeBrokerLoiTerms,
  usesRehabConstructionLoiMetrics,
  validateBrokerLoiTerms,
  type BrokerLoiApplicationContext,
  type BrokerLoiTerms,
} from "../../lib/brokerLoiTerms";

const BROKER_LOI_ERROR_FIELD_ORDER = [
  "branding",
  "approvedAmount",
  "interestRate",
  "collateralOrPropertyValue",
  "rehabConstructionCost",
  "afterRepairValue",
  "maximumLtvPercent",
  "maximumLtcPercent",
  "maximumArvPercent",
  "monthlyPayment",
  "loanTerm",
  "originationPoints",
  "processingFee",
  "appraisalFee",
  "brokerPoints",
  "wireFee",
  "requiredReservesPercent",
  "requiredDocuments",
] as const;

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatMoney(value?: number | string | null) {
  const numeric = Number(String(value || "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return `$${numeric.toLocaleString("en-US")}`;
}

type BrokerBrandingPreview = {
  brandName?: string | null;
  logoUrl?: string | null;
};

type Props = {
  sourceLenderName: string;
  terms: BrokerLoiTerms;
  applicationContext?: BrokerLoiApplicationContext;
  brokerBranding?: BrokerBrandingPreview;
  submitting?: boolean;
  readOnly?: boolean;
  /** True when broker/LO is creating their own term sheet (no lender LOI source). */
  standalone?: boolean;
  mode?: "create" | "regenerate" | "revised";
  revisedVersionNumber?: number;
  onCancel: () => void;
  onSubmit: (terms: BrokerLoiTerms, branding: LoiBrandingValues) => void;
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}

function ReadOnlyField({
  field,
  label,
  value,
  error,
  hint,
}: {
  field: string;
  label: string;
  value: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div data-loi-field={field}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        value={value}
        readOnly
        tabIndex={-1}
        placeholder="Auto-calculated"
        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
      />
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default function BrokerLoiEditorPanel({
  sourceLenderName,
  terms: initialTerms,
  applicationContext,
  brokerBranding,
  submitting = false,
  readOnly = false,
  standalone = false,
  mode = "create",
  revisedVersionNumber,
  onCancel,
  onSubmit,
}: Props) {
  const showRehabMetrics = usesRehabConstructionLoiMetrics(
    applicationContext?.loanProductCode,
  );
  const valueFieldLabel = getLoiValueFieldLabel(
    applicationContext?.loanProductCode,
  );

  const [terms, setTerms] = useState<BrokerLoiTerms>(() =>
    normalizeBrokerLoiTerms(initialTerms, applicationContext),
  );
  const [branding, setBranding] = useState<LoiBrandingValues>(() => ({
    brandName: brokerBranding?.brandName || "",
    logoUrl: brokerBranding?.logoUrl || "",
  }));
  const [errors, setErrors] = useState<
    Partial<Record<keyof BrokerLoiTerms, string>>
  >({});
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const scrollToField = useCallback((field: string) => {
    const root = scrollBodyRef.current;
    if (!root) return;
    const target = root.querySelector(
      `[data-loi-field="${field}"]`,
    ) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = target.querySelector(
      "input:not([readonly]), select, textarea, button",
    ) as HTMLElement | null;
    focusable?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    setTerms(normalizeBrokerLoiTerms(initialTerms, applicationContext));
    setErrors({});
  }, [initialTerms, applicationContext]);

  useEffect(() => {
    setBranding({
      brandName: brokerBranding?.brandName || "",
      logoUrl: brokerBranding?.logoUrl || "",
    });
  }, [brokerBranding?.brandName, brokerBranding?.logoUrl]);

  const suggested = useMemo(
    () =>
      calculateSuggestedBrokerLoiMetrics({
        approvedAmount: terms.approvedAmount,
        interestRate: terms.interestRate,
        interestOnly: terms.interestOnly,
        loanTerm: terms.loanTerm,
        collateralOrPropertyValue: terms.collateralOrPropertyValue,
        rehabConstructionCost: terms.rehabConstructionCost,
        afterRepairValue: terms.afterRepairValue,
        originationPoints: terms.originationPoints,
        appraisalFee: terms.appraisalFee,
        brokerPoints: terms.brokerPoints,
        wireFee: terms.wireFee,
        processingFee: terms.processingFee,
        underwritingFee: terms.underwritingFee,
        requiredReservesPercent: terms.requiredReservesPercent,
        showRehabMetrics,
      }),
    [
      terms.approvedAmount,
      terms.interestRate,
      terms.interestOnly,
      terms.loanTerm,
      terms.collateralOrPropertyValue,
      terms.rehabConstructionCost,
      terms.afterRepairValue,
      terms.originationPoints,
      terms.appraisalFee,
      terms.brokerPoints,
      terms.wireFee,
      terms.processingFee,
      terms.underwritingFee,
      terms.requiredReservesPercent,
      showRehabMetrics,
    ],
  );

  const bindingMaxLoan = useMemo(
    () =>
      calculateBindingMaxLoan({
        collateralOrPropertyValue: terms.collateralOrPropertyValue,
        rehabConstructionCost: terms.rehabConstructionCost,
        afterRepairValue: terms.afterRepairValue,
        maximumLtvPercent: terms.maximumLtvPercent,
        maximumLtcPercent: terms.maximumLtcPercent,
        maximumArvPercent: terms.maximumArvPercent,
        showRehabMetrics,
      }),
    [
      terms.collateralOrPropertyValue,
      terms.rehabConstructionCost,
      terms.afterRepairValue,
      terms.maximumLtvPercent,
      terms.maximumLtcPercent,
      terms.maximumArvPercent,
      showRehabMetrics,
    ],
  );

  useEffect(() => {
    setTerms((prev) => {
      const nextLtv =
        suggested.ltv != null
          ? formatBrokerLoiNumberInput(String(suggested.ltv))
          : "";
      const nextLtc =
        showRehabMetrics && suggested.ltc != null
          ? formatBrokerLoiNumberInput(String(suggested.ltc))
          : "";
      const nextArv =
        showRehabMetrics && suggested.arvPercent != null
          ? formatBrokerLoiNumberInput(String(suggested.arvPercent))
          : "";
      const nextPayment =
        suggested.monthlyPayment == null
          ? ""
          : formatBrokerLoiNumberInput(String(suggested.monthlyPayment));
      const nextClosing =
        suggested.totalClosingCosts != null
          ? formatBrokerLoiNumberInput(String(suggested.totalClosingCosts))
          : "";
      const nextReserves =
        suggested.requiredReservesAmount != null
          ? formatBrokerLoiNumberInput(String(suggested.requiredReservesAmount))
          : "";

      if (
        prev.ltvPercent === nextLtv &&
        prev.ltcPercent === nextLtc &&
        prev.arvPercent === nextArv &&
        prev.monthlyPayment === nextPayment &&
        prev.totalClosingCosts === nextClosing &&
        prev.requiredReservesAmount === nextReserves
      ) {
        return prev;
      }

      return {
        ...prev,
        ltvPercent: nextLtv,
        ltcPercent: nextLtc,
        arvPercent: nextArv,
        monthlyPayment: nextPayment,
        totalClosingCosts: nextClosing,
        requiredReservesAmount: nextReserves,
      };
    });
  }, [suggested, showRehabMetrics]);

  const setNumberField = (
    key: keyof Pick<
      BrokerLoiTerms,
      | "approvedAmount"
      | "interestRate"
      | "collateralOrPropertyValue"
      | "rehabConstructionCost"
      | "afterRepairValue"
      | "maximumLtvPercent"
      | "maximumLtcPercent"
      | "maximumArvPercent"
      | "originationPoints"
      | "originationFeePercent"
      | "processingFee"
      | "underwritingFee"
      | "appraisalFee"
      | "brokerPoints"
      | "wireFee"
      | "requiredReservesPercent"
      | "prepaymentPenalty"
      | "exitFee"
      | "legalFee"
    >,
    rawValue: string,
  ) => {
    const formatted = formatBrokerLoiNumberInput(rawValue);
    setTerms((prev) => ({ ...prev, [key]: formatted }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = () => {
    if (readOnly) return;

    const brandingMessage = getLoiBrandingValidationMessage(branding);
    if (brandingMessage) {
      toast.error(brandingMessage);
      requestAnimationFrame(() => scrollToField("branding"));
      return;
    }

    const payload: BrokerLoiTerms = {
      ...terms,
      requiredDocuments: mergeBrokerLoiDocuments(
        terms.requiredDocuments,
        terms.customDocument,
      ),
    };
    const validation = validateBrokerLoiTerms(payload, {
      loanProductCode: applicationContext?.loanProductCode,
    });
    setErrors(validation.errors);
    if (!validation.valid) {
      const firstErrorField = BROKER_LOI_ERROR_FIELD_ORDER.find(
        (field) =>
          field !== "branding" &&
          Boolean(validation.errors[field as keyof BrokerLoiTerms]),
      );
      if (firstErrorField) {
        requestAnimationFrame(() => scrollToField(firstErrorField));
      }
      return;
    }
    onSubmit(payload, {
      brandName: branding.brandName.trim(),
      logoUrl: branding.logoUrl,
    });
  };

  const brandingComplete = isLoiBrandingComplete(branding);
  const fieldsDisabled = submitting || readOnly;
  const inputClassName =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
      <div ref={scrollBodyRef} className="flex-1 overflow-y-auto p-4 sm:p-5">
        {readOnly && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Broker LOI forwarded to lender
            </p>
            <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
              This LOI was already sent to the lender and cannot be edited or
              regenerated.
            </p>
          </div>
        )}

        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 dark:border-violet-500/20 dark:bg-violet-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
            {mode === "revised"
              ? revisedVersionNumber
                ? `Create Revised Term Sheet (Version ${revisedVersionNumber})`
                : "Create Revised Term Sheet"
              : mode === "regenerate"
                ? standalone
                  ? "Edit your term sheet"
                  : "Regenerate broker LOI"
                : standalone
                  ? "Your broker term sheet"
                  : "Copied from lender LOI"}
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {mode === "revised"
              ? "Previous signed versions are preserved. The client must sign this new version."
              : mode === "regenerate"
                ? standalone
                  ? "Update your commercial terms below, then regenerate your branded PDF."
                  : `Update terms below and regenerate your branded PDF based on ${sourceLenderName}.`
                : standalone
                  ? "Enter your commercial terms below. Your broker branding will appear on the generated PDF."
                  : `Terms pre-filled from ${sourceLenderName}. Edit below — your broker branding will replace the lender branding on the PDF.`}
          </p>
        </div>

        <div data-loi-field="branding">
          <LoiBrandingFields
            value={branding}
            onChange={setBranding}
            disabled={fieldsDisabled}
          />
        </div>

        {applicationContext && (
          <div className="mb-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <User size={15} />
              Application Snapshot
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="Borrower" value={applicationContext.borrowerName} />
              <InfoRow
                label="Property"
                value={applicationContext.propertyAddress}
              />
              <InfoRow label="Product" value={applicationContext.loanProduct} />
              <InfoRow label="Broker" value={applicationContext.brokerName} />
              <InfoRow
                label={valueFieldLabel}
                value={formatMoney(applicationContext.propertyValue)}
              />
              {showRehabMetrics ? (
                <>
                  <InfoRow
                    label="Project Cost"
                    value={formatMoney(applicationContext.projectCost)}
                  />
                  <InfoRow
                    label="ARV"
                    value={formatMoney(applicationContext.arv)}
                  />
                </>
              ) : null}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <h4 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
            Proposed Terms (editable)
          </h4>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block" data-loi-field="approvedAmount">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Loan Amount
              </span>
              <input
                value={terms.approvedAmount}
                disabled={fieldsDisabled}
                inputMode="decimal"
                onChange={(e) => setNumberField("approvedAmount", e.target.value)}
                className={inputClassName}
                placeholder="1,000,000"
              />
              {errors.approvedAmount && (
                <p className="mt-1 text-xs text-rose-600">{errors.approvedAmount}</p>
              )}
            </label>

            <label className="block" data-loi-field="interestRate">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Interest Rate (%)
              </span>
              <input
                value={terms.interestRate}
                disabled={fieldsDisabled}
                inputMode="decimal"
                onChange={(e) => setNumberField("interestRate", e.target.value)}
                className={inputClassName}
                placeholder="7"
              />
              {errors.interestRate && (
                <p className="mt-1 text-xs text-rose-600">{errors.interestRate}</p>
              )}
            </label>

            <label
              className="block"
              data-loi-field="collateralOrPropertyValue"
            >
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {valueFieldLabel}
              </span>
              <input
                value={terms.collateralOrPropertyValue}
                disabled={fieldsDisabled}
                inputMode="decimal"
                onChange={(e) =>
                  setNumberField("collateralOrPropertyValue", e.target.value)
                }
                className={inputClassName}
                placeholder="e.g. 2,500,000"
              />
              {errors.collateralOrPropertyValue && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.collateralOrPropertyValue}
                </p>
              )}
            </label>

            {showRehabMetrics ? (
              <>
                <label className="block" data-loi-field="rehabConstructionCost">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rehab/Construction Cost
                  </span>
                  <input
                    value={terms.rehabConstructionCost}
                    disabled={fieldsDisabled}
                    inputMode="decimal"
                    onChange={(e) =>
                      setNumberField("rehabConstructionCost", e.target.value)
                    }
                    className={inputClassName}
                    placeholder="350,000"
                  />
                  {errors.rehabConstructionCost && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errors.rehabConstructionCost}
                    </p>
                  )}
                </label>

                <label className="block" data-loi-field="afterRepairValue">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    After Repair Value
                  </span>
                  <input
                    value={terms.afterRepairValue}
                    disabled={fieldsDisabled}
                    inputMode="decimal"
                    onChange={(e) =>
                      setNumberField("afterRepairValue", e.target.value)
                    }
                    className={inputClassName}
                    placeholder="3,000,000"
                  />
                  {errors.afterRepairValue && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errors.afterRepairValue}
                    </p>
                  )}
                </label>
              </>
            ) : null}

            <ReadOnlyField
              field="ltvPercent"
              label="LTV (%)"
              value={terms.ltvPercent}
              hint="Auto-calculated from loan amount and value"
            />

            {showRehabMetrics ? (
              <>
                <ReadOnlyField
                  field="ltcPercent"
                  label="LTC (%)"
                  value={terms.ltcPercent}
                  hint="Auto-calculated from loan amount and project cost"
                />
                <ReadOnlyField
                  field="arvPercent"
                  label="ARV (%)"
                  value={terms.arvPercent}
                  hint="Auto-calculated from loan amount and ARV"
                />
              </>
            ) : null}

            <label className="block" data-loi-field="maximumLtvPercent">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Maximum LTV (%)
              </span>
              <input
                value={terms.maximumLtvPercent}
                disabled={fieldsDisabled}
                inputMode="decimal"
                onChange={(e) =>
                  setNumberField("maximumLtvPercent", e.target.value)
                }
                className={inputClassName}
                placeholder="70"
              />
              {errors.maximumLtvPercent && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.maximumLtvPercent}
                </p>
              )}
            </label>

            {showRehabMetrics ? (
              <>
                <label className="block" data-loi-field="maximumLtcPercent">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Maximum LTC (%)
                  </span>
                  <input
                    value={terms.maximumLtcPercent}
                    disabled={fieldsDisabled}
                    inputMode="decimal"
                    onChange={(e) =>
                      setNumberField("maximumLtcPercent", e.target.value)
                    }
                    className={inputClassName}
                    placeholder="75"
                  />
                  {errors.maximumLtcPercent && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errors.maximumLtcPercent}
                    </p>
                  )}
                </label>

                <label className="block" data-loi-field="maximumArvPercent">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Maximum ARV (%)
                  </span>
                  <input
                    value={terms.maximumArvPercent}
                    disabled={fieldsDisabled}
                    inputMode="decimal"
                    onChange={(e) =>
                      setNumberField("maximumArvPercent", e.target.value)
                    }
                    className={inputClassName}
                    placeholder="65"
                  />
                  {errors.maximumArvPercent && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errors.maximumArvPercent}
                    </p>
                  )}
                </label>
              </>
            ) : null}

            {bindingMaxLoan ? (
              <div className="md:col-span-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2.5 text-xs text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100">
                Binding max loan (whichever is lower):{" "}
                {formatMoney(bindingMaxLoan.amount)} via{" "}
                {bindingMaxLoan.bindingLabel}
              </div>
            ) : null}

            <ReadOnlyField
              field="monthlyPayment"
              label="Monthly Payment"
              value={terms.monthlyPayment}
              error={errors.monthlyPayment}
              hint="Calculated from loan amount, interest rate, and loan term"
            />

            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Interest Only
              </span>
              <div className="flex gap-2">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    disabled={fieldsDisabled}
                    onClick={() =>
                      setTerms((prev) => ({ ...prev, interestOnly: value }))
                    }
                    className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      terms.interestOnly === value
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {value ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2" data-loi-field="loanTerm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Loan Term
              </span>
              <div className="flex flex-wrap gap-2">
                {BROKER_LOI_TERM_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={fieldsDisabled}
                    onClick={() => {
                      setTerms((prev) => ({ ...prev, loanTerm: option }));
                      setErrors((prev) => {
                        if (!prev.loanTerm) return prev;
                        const next = { ...prev };
                        delete next.loanTerm;
                        return next;
                      });
                    }}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      terms.loanTerm === option
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {errors.loanTerm && (
                <p className="mt-1 text-xs text-rose-600">{errors.loanTerm}</p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <h5 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
              Fees & Closing Costs
            </h5>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block" data-loi-field="originationPoints">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Origination Points (%)
                </span>
                <input
                  value={terms.originationPoints}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) =>
                    setNumberField("originationPoints", e.target.value)
                  }
                  placeholder="2"
                  className={inputClassName}
                />
                {errors.originationPoints && (
                  <p className="mt-1 text-xs text-rose-600">
                    {errors.originationPoints}
                  </p>
                )}
              </label>

              <label className="block" data-loi-field="processingFee">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Processing Fee ($)
                </span>
                <input
                  value={terms.processingFee}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) =>
                    setNumberField("processingFee", e.target.value)
                  }
                  placeholder="995"
                  className={inputClassName}
                />
                {errors.processingFee && (
                  <p className="mt-1 text-xs text-rose-600">
                    {errors.processingFee}
                  </p>
                )}
              </label>

              <label className="block" data-loi-field="appraisalFee">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Appraisal Fee ($)
                </span>
                <input
                  value={terms.appraisalFee}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) =>
                    setNumberField("appraisalFee", e.target.value)
                  }
                  placeholder="750"
                  className={inputClassName}
                />
                {errors.appraisalFee && (
                  <p className="mt-1 text-xs text-rose-600">
                    {errors.appraisalFee}
                  </p>
                )}
              </label>

              <label className="block" data-loi-field="brokerPoints">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Broker Points (%)
                </span>
                <input
                  value={terms.brokerPoints}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) =>
                    setNumberField("brokerPoints", e.target.value)
                  }
                  placeholder="1"
                  className={inputClassName}
                />
                {errors.brokerPoints && (
                  <p className="mt-1 text-xs text-rose-600">
                    {errors.brokerPoints}
                  </p>
                )}
              </label>

              <label className="block" data-loi-field="wireFee">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Wire Fee ($)
                </span>
                <input
                  value={terms.wireFee}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) => setNumberField("wireFee", e.target.value)}
                  placeholder="50"
                  className={inputClassName}
                />
                {errors.wireFee && (
                  <p className="mt-1 text-xs text-rose-600">{errors.wireFee}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Underwriting Fee ($)
                </span>
                <input
                  value={terms.underwritingFee}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) =>
                    setNumberField("underwritingFee", e.target.value)
                  }
                  placeholder="1,500"
                  className={inputClassName}
                />
              </label>

              <ReadOnlyField
                field="totalClosingCosts"
                label="Total Closing Costs"
                value={terms.totalClosingCosts}
                hint="Auto-calculated from fees above"
              />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <h5 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
              Required Reserves
            </h5>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block" data-loi-field="requiredReservesPercent">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Required Reserves (%)
                </span>
                <input
                  value={terms.requiredReservesPercent}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) =>
                    setNumberField("requiredReservesPercent", e.target.value)
                  }
                  placeholder="3"
                  className={inputClassName}
                />
                {errors.requiredReservesPercent && (
                  <p className="mt-1 text-xs text-rose-600">
                    {errors.requiredReservesPercent}
                  </p>
                )}
              </label>

              <ReadOnlyField
                field="requiredReservesAmount"
                label="Reserve Amount ($)"
                value={terms.requiredReservesAmount}
                hint="Auto-calculated as loan × reserves %"
              />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <h5 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
              Additional Terms
            </h5>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Prepayment Penalty
                </span>
                <input
                  value={terms.prepaymentPenalty}
                  disabled={fieldsDisabled}
                  inputMode="decimal"
                  onChange={(e) =>
                    setNumberField("prepaymentPenalty", e.target.value)
                  }
                  placeholder="0"
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recourse
                </span>
                <input
                  value={terms.recourse}
                  disabled={fieldsDisabled}
                  onChange={(e) =>
                    setTerms((prev) => ({ ...prev, recourse: e.target.value }))
                  }
                  placeholder="Full / Non-Recourse"
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Personal Guarantee
                </span>
                <input
                  value={terms.personalGuarantee}
                  disabled={fieldsDisabled}
                  onChange={(e) =>
                    setTerms((prev) => ({
                      ...prev,
                      personalGuarantee: e.target.value,
                    }))
                  }
                  placeholder="Yes / No"
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amortization
                </span>
                <input
                  value={terms.amortization}
                  disabled={fieldsDisabled}
                  onChange={(e) =>
                    setTerms((prev) => ({
                      ...prev,
                      amortization: e.target.value,
                    }))
                  }
                  placeholder="Interest Only / 30 Years"
                  className={inputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expiration Date
                </span>
                <LoanDateField
                  value={terms.expirationDate}
                  disabled={fieldsDisabled}
                  disablePastDates
                  placeholder="dd-mm-yyyy"
                  onChange={(next) =>
                    setTerms((prev) => ({
                      ...prev,
                      expirationDate: next,
                    }))
                  }
                  className="rounded-xl border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
          </div>

          <div data-loi-field="requiredDocuments">
            <LoiRequiredDocumentsPicker
              selectedDocuments={terms.requiredDocuments}
              onSelectedDocumentsChange={(requiredDocuments) =>
                setTerms((prev) => ({ ...prev, requiredDocuments }))
              }
              customDocument={terms.customDocument}
              onCustomDocumentChange={(customDocument) =>
                setTerms((prev) => ({ ...prev, customDocument }))
              }
              error={errors.requiredDocuments}
              getAuthHeaders={getAuthHeaders}
              loanProductCode={applicationContext?.loanProductCode || null}
              includeProductConfig
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          {standalone ? "Back" : "Back to Lender LOI"}
        </button>
        <button
          type="button"
          disabled={fieldsDisabled || !brandingComplete}
          onClick={handleSubmit}
          title={
            readOnly
              ? "Broker LOI was forwarded to the lender and cannot be regenerated"
              : undefined
          }
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === "revised"
                ? "Creating revised LOI..."
                : mode === "regenerate"
                  ? "Regenerating..."
                  : "Generating..."}
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {mode === "revised"
                ? revisedVersionNumber
                  ? `Create Revised LOI (v${revisedVersionNumber})`
                  : "Create Revised LOI"
                : mode === "regenerate"
                  ? standalone
                    ? "Regenerate Term Sheet PDF"
                    : "Regenerate Broker PDF"
                  : standalone
                    ? "Generate Term Sheet PDF"
                    : "Generate Broker PDF"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
