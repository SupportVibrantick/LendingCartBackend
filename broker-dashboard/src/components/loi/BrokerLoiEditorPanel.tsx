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
import { getPortalAuthHeaders } from "../../lib/portalAuth";

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
  getAuthHeaders?: () => HeadersInit | Record<string, string>;
  onCancel: () => void;
  onSubmit: (terms: BrokerLoiTerms, branding: LoiBrandingValues) => void;
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        value={value}
        readOnly
        tabIndex={-1}
        placeholder="Auto-calculated"
        className="h-10 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
      />
      {error ? (
        <p className="mt-1 text-sm text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
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
  getAuthHeaders = getPortalAuthHeaders,
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
        originationFeePercent: terms.originationFeePercent,
        exitFee: terms.exitFee,
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
      terms.originationFeePercent,
      terms.exitFee,
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
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60";
  const fieldLabelClassName =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  const editorTitle =
    mode === "revised"
      ? revisedVersionNumber
        ? `Revised term sheet · v${revisedVersionNumber}`
        : "Revised term sheet"
      : mode === "regenerate"
        ? standalone
          ? "Edit your term sheet"
          : "Regenerate broker LOI"
        : standalone
          ? "Your broker term sheet"
          : "Copied from lender LOI";

  const editorHint =
    mode === "revised"
      ? "Previous signed versions stay on file. The client must sign this new version."
      : mode === "regenerate"
        ? standalone
          ? "Update your commercial terms below, then regenerate the branded PDF."
          : `Update terms below and regenerate your branded PDF based on ${sourceLenderName}.`
        : standalone
          ? "Fill in the commercial terms below. Your brokerage branding appears on the generated PDF."
          : `Terms are pre-filled from ${sourceLenderName}. Edit anything needed — your branding replaces the lender branding on the PDF.`;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
      <div ref={scrollBodyRef} className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
        {readOnly && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Broker LOI forwarded to lender
            </p>
            <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
              This LOI was already sent to the lender and cannot be edited or
              regenerated.
            </p>
          </div>
        )}

        <div className="mb-5 overflow-hidden rounded-xl border border-[#4C78F5]/20 bg-[#4C78F5]/[0.06] dark:border-[#4C78F5]/30 dark:bg-[#4C78F5]/15">
          <div className="border-b border-[#4C78F5]/15 px-4 py-3 dark:border-[#4C78F5]/25">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5] dark:text-sky-300">
              {editorTitle}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-200">
              {editorHint}
            </p>
          </div>
          <div className="grid gap-0 sm:grid-cols-3">
            {[
              { step: "1", label: "Branding" },
              { step: "2", label: "Terms" },
              { step: "3", label: "Generate PDF" },
            ].map((item, index) => (
              <div
                key={item.step}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 ${
                  index > 0
                    ? "border-t border-[#4C78F5]/10 sm:border-l sm:border-t-0 dark:border-[#4C78F5]/20"
                    : ""
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-bold text-white">
                  {item.step}
                </span>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <div data-loi-field="branding">
          <LoiBrandingFields
            value={branding}
            onChange={setBranding}
            disabled={fieldsDisabled}
          />
        </div>

        {applicationContext && (
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100">
              <User size={15} className="text-[#4C78F5]" />
              Application Snapshot
            </div>
            <div className="grid gap-2.5 p-4 sm:grid-cols-2">
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

        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              Proposed Terms
            </h4>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Edit the commercial terms that will appear on your term sheet PDF.
            </p>
          </div>
          <div className="p-4">

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block" data-loi-field="approvedAmount">
              <span className={fieldLabelClassName}>
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
              <span className={fieldLabelClassName}>
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
              <span className={fieldLabelClassName}>
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
                  <span className={fieldLabelClassName}>
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
                  <span className={fieldLabelClassName}>
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
              <span className={fieldLabelClassName}>
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
                  <span className={fieldLabelClassName}>
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
                  <span className={fieldLabelClassName}>
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
              <div className="md:col-span-2 rounded-xl border border-[#4C78F5]/20 bg-[#4C78F5]/8 px-3 py-2.5 text-xs text-[#4C78F5] dark:border-[#4C78F5]/30 dark:bg-[#4C78F5]/15 dark:text-sky-100">
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
              <span className={fieldLabelClassName}>
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
                        ? "bg-[#4C78F5] text-white"
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
                        ? "bg-[#4C78F5] text-white"
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
            <h5 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
              Required Reserves
            </h5>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Reserve percent drives the auto-calculated reserve amount.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block" data-loi-field="requiredReservesPercent">
                <span className={fieldLabelClassName}>
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
            <h5 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
              Additional Terms
            </h5>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Optional deal language that appears on the term sheet.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
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
                <span className={fieldLabelClassName}>
                  Expiration Date
                </span>
                <LoanDateField
                  value={terms.expirationDate}
                  disabled={fieldsDisabled}
                  disablePastDates
                  placeholder="MM/DD/YY"
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
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
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
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C78F5] px-4 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:cursor-not-allowed disabled:opacity-50"
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
