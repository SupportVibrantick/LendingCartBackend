import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, User } from "lucide-react";
import toast from "react-hot-toast";
import LoiBrandingFields from "./LoiBrandingFields";
import LoiRequiredDocumentsPicker from "./LoiRequiredDocumentsPicker";
import {
  getLoiBrandingValidationMessage,
  isLoiBrandingComplete,
  type LoiBrandingValues,
} from "../../lib/loiBranding";
import {
  BROKER_LOI_TERM_OPTIONS,
  calculateSuggestedBrokerLoiMetrics,
  formatBrokerLoiNumberInput,
  mergeBrokerLoiDocuments,
  normalizeBrokerLoiTerms,
  validateBrokerLoiTerms,
  type BrokerLoiApplicationContext,
  type BrokerLoiTerms,
} from "../../lib/brokerLoiTerms";

const BROKER_LOI_ERROR_FIELD_ORDER = [
  "branding",
  "approvedAmount",
  "interestRate",
  "loanTerm",
  "monthlyPayment",
  "ltvPercent",
  "arvPercent",
  "requiredDocuments",
] as const;

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  const [terms, setTerms] = useState<BrokerLoiTerms>(() =>
    normalizeBrokerLoiTerms(initialTerms),
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
    setTerms(normalizeBrokerLoiTerms(initialTerms));
    setErrors({});
  }, [initialTerms]);

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
        originationFeePercent: terms.originationFeePercent,
        exitFee: terms.exitFee,
        processingFee: terms.processingFee,
        underwritingFee: terms.underwritingFee,
      }),
    [
      terms.approvedAmount,
      terms.interestRate,
      terms.interestOnly,
      terms.loanTerm,
      terms.originationFeePercent,
      terms.exitFee,
      terms.processingFee,
      terms.underwritingFee,
    ],
  );

  useEffect(() => {
    setTerms((prev) => {
      const nextPayment =
        suggested.monthlyPayment == null
          ? ""
          : formatBrokerLoiNumberInput(String(suggested.monthlyPayment));
      if (prev.monthlyPayment === nextPayment) return prev;
      return { ...prev, monthlyPayment: nextPayment };
    });
  }, [suggested.monthlyPayment]);

  const setNumberField = (
    key: keyof Pick<
      BrokerLoiTerms,
      | "approvedAmount"
      | "interestRate"
      | "ltvPercent"
      | "ltcPercent"
      | "arvPercent"
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
    const validation = validateBrokerLoiTerms(payload);
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
              <InfoRow label="Property" value={applicationContext.propertyAddress} />
              <InfoRow label="Product" value={applicationContext.loanProduct} />
              <InfoRow label="Broker" value={applicationContext.brokerName} />
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
                Approved Amount
              </span>
              <input
                value={terms.approvedAmount}
                disabled={readOnly}
                inputMode="decimal"
                onChange={(e) => setNumberField("approvedAmount", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
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
                disabled={readOnly}
                inputMode="decimal"
                onChange={(e) => setNumberField("interestRate", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="7"
              />
              {errors.interestRate && (
                <p className="mt-1 text-xs text-rose-600">{errors.interestRate}</p>
              )}
            </label>

            <label className="block" data-loi-field="loanTerm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Loan Term
              </span>
              <select
                value={terms.loanTerm}
                disabled={readOnly}
                onChange={(e) => {
                  setTerms((prev) => ({ ...prev, loanTerm: e.target.value }));
                  setErrors((prev) => {
                    if (!prev.loanTerm) return prev;
                    const next = { ...prev };
                    delete next.loanTerm;
                    return next;
                  });
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Select term</option>
                {BROKER_LOI_TERM_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.loanTerm && (
                <p className="mt-1 text-xs text-rose-600">{errors.loanTerm}</p>
              )}
            </label>

            <label className="block" data-loi-field="monthlyPayment">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Monthly Payment
              </span>
              <input
                value={terms.monthlyPayment}
                readOnly
                tabIndex={-1}
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                placeholder="Auto-calculated"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Calculated from approved amount, interest rate, and loan term
              </p>
              {errors.monthlyPayment && (
                <p className="mt-1 text-xs text-rose-600">{errors.monthlyPayment}</p>
              )}
            </label>

            <label className="block" data-loi-field="ltvPercent">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                LTV %
              </span>
              <input
                value={terms.ltvPercent}
                disabled={readOnly}
                inputMode="decimal"
                onChange={(e) => setNumberField("ltvPercent", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder={
                  suggested.ltv != null
                    ? formatBrokerLoiNumberInput(String(suggested.ltv))
                    : ""
                }
              />
              {errors.ltvPercent && (
                <p className="mt-1 text-xs text-rose-600">{errors.ltvPercent}</p>
              )}
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                LTC %
              </span>
              <input
                value={terms.ltcPercent}
                disabled={readOnly}
                inputMode="decimal"
                onChange={(e) => setNumberField("ltcPercent", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder={
                  suggested.ltc != null
                    ? formatBrokerLoiNumberInput(String(suggested.ltc))
                    : ""
                }
              />
            </label>

            <label className="block" data-loi-field="arvPercent">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                ARV %
              </span>
              <input
                value={terms.arvPercent}
                disabled={readOnly}
                inputMode="decimal"
                onChange={(e) => setNumberField("arvPercent", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder={
                  suggested.arvPercent != null
                    ? formatBrokerLoiNumberInput(String(suggested.arvPercent))
                    : ""
                }
              />
              {errors.arvPercent && (
                <p className="mt-1 text-xs text-rose-600">{errors.arvPercent}</p>
              )}
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={terms.interestOnly}
              disabled={readOnly}
              onChange={(e) =>
                setTerms((prev) => ({ ...prev, interestOnly: e.target.checked }))
              }
              className="rounded border-slate-300"
            />
            Interest only
          </label>

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
              disabled={readOnly}
            />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <h5 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
              Additional Terms
            </h5>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Origination Fee
                </span>
                <input
                  value={terms.originationFeePercent}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({
                      ...prev,
                      originationFeePercent: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Processing Fee
                </span>
                <input
                  value={terms.processingFee}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({ ...prev, processingFee: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Underwriting Fee
                </span>
                <input
                  value={terms.underwritingFee}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({
                      ...prev,
                      underwritingFee: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Prepayment Penalty
                </span>
                <input
                  value={terms.prepaymentPenalty}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({
                      ...prev,
                      prepaymentPenalty: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recourse
                </span>
                <input
                  value={terms.recourse}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({ ...prev, recourse: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Personal Guarantee
                </span>
                <input
                  value={terms.personalGuarantee}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({
                      ...prev,
                      personalGuarantee: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amortization
                </span>
                <input
                  value={terms.amortization}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({ ...prev, amortization: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expiration Date
                </span>
                <input
                  type="date"
                  value={terms.expirationDate}
                  disabled={readOnly}
                  onChange={(e) =>
                    setTerms((prev) => ({
                      ...prev,
                      expirationDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
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
