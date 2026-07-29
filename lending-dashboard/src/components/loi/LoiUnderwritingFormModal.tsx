import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, FileText, Loader2, User, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  LOI_TERM_OPTIONS,
  calculateSuggestedLoiMetrics,
  createEmptyLoiUnderwritingTerms,
  mapStoredLoiTermsToForm,
  serializeLoiUnderwritingTerms,
  validateLoiUnderwritingTerms,
  type LoiApplicationContext,
  type LoiUnderwritingTerms,
} from "../../lib/loiUnderwritingTerms";
import {
  formatMetricCurrency,
  formatMetricPercent,
} from "../../lib/loiCalculatedMetrics";
import LoiBrandingFields from "./LoiBrandingFields";
import {
  EMPTY_LOI_BRANDING,
  getLoiBrandingValidationMessage,
  isLoiBrandingComplete,
  type LoiBrandingValues,
} from "../../lib/loiBranding";
import LoiRequiredDocumentsPicker from "./LoiRequiredDocumentsPicker";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("lender_token");
  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };
}

type Props = {
  isOpen: boolean;
  requestedAmount?: number | string | null;
  propertyValue?: number | string | null;
  projectCost?: number | string | null;
  arv?: number | string | null;
  applicationInterestRate?: number | string | null;
  applicationLoanTerm?: number | string | null;
  loanProductCode?: string | null;
  applicationContext?: LoiApplicationContext;
  submitting?: boolean;
  mode?: "create" | "regenerate" | "revised";
  revisedVersionNumber?: number;
  storedTerms?: unknown;
  onClose: () => void;
  onSubmit: (payload: {
    lenderTerms: ReturnType<typeof serializeLoiUnderwritingTerms>;
    branding: LoiBrandingValues;
  }) => void;
};

function formatMoney(value?: number | string | null) {
  const numeric = Number(String(value || "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return `$${numeric.toLocaleString("en-US")}`;
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}

export default function LoiUnderwritingFormModal({
  isOpen,
  requestedAmount,
  propertyValue = null,
  projectCost = null,
  arv = null,
  applicationInterestRate = null,
  applicationLoanTerm = null,
  loanProductCode = null,
  applicationContext,
  submitting = false,
  mode = "create",
  revisedVersionNumber,
  storedTerms,
  onClose,
  onSubmit,
}: Props) {
  const [terms, setTerms] = useState<LoiUnderwritingTerms>(() =>
    createEmptyLoiUnderwritingTerms(requestedAmount, {
      interestRate: applicationInterestRate,
      loanTerm: applicationLoanTerm,
      propertyValue,
      projectCost,
      arv,
    }),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof LoiUnderwritingTerms, string>>
  >({});
  const [metricsTouched, setMetricsTouched] = useState({
    ltv: false,
    ltc: false,
    arv: false,
    payment: false,
  });
  const [branding, setBranding] = useState<LoiBrandingValues>(EMPTY_LOI_BRANDING);
  const [brandingLoading, setBrandingLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fromStored =
      mode === "revised" || mode === "regenerate"
        ? mapStoredLoiTermsToForm(storedTerms)
        : null;

    setTerms(
      fromStored ||
        createEmptyLoiUnderwritingTerms(requestedAmount, {
          interestRate: applicationInterestRate,
          loanTerm: applicationLoanTerm,
          propertyValue,
          projectCost,
          arv,
        }),
    );
    setErrors({});
    setMetricsTouched({
      ltv: false,
      ltc: false,
      arv: false,
      payment: false,
    });
  }, [
    isOpen,
    mode,
    storedTerms,
    requestedAmount,
    propertyValue,
    projectCost,
    arv,
    applicationInterestRate,
    applicationLoanTerm,
  ]);

  const handleProductRequiredLoaded = useCallback((required: string[]) => {
    if (required.length === 0) return;
    setTerms((prev) => ({
      ...prev,
      requiredDocuments: required,
    }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      try {
        setBrandingLoading(true);
        const res = await fetch(`${API_BASE}/lender/branding/`, {
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (cancelled) return;

        if (res.ok && json.success) {
          setBranding({
            brandName: json.data?.brandName || "",
            logoUrl: json.data?.logoUrl || "",
          });
        } else {
          setBranding(EMPTY_LOI_BRANDING);
        }
      } catch {
        if (!cancelled) {
          setBranding(EMPTY_LOI_BRANDING);
        }
      } finally {
        if (!cancelled) {
          setBrandingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const suggested = useMemo(
    () =>
      calculateSuggestedLoiMetrics({
        approvedAmount: terms.approvedAmount,
        interestRate: terms.interestRate,
        interestOnly: terms.interestOnly,
        loanTerm: terms.loanTerm,
        propertyValue,
        projectCost,
        arv,
      }),
    [
      terms.approvedAmount,
      terms.interestRate,
      terms.interestOnly,
      terms.loanTerm,
      propertyValue,
      projectCost,
      arv,
    ],
  );

  useEffect(() => {
    setTerms((prev) => ({
      ...prev,
      ltvPercent:
        metricsTouched.ltv || prev.ltvPercent
          ? prev.ltvPercent
          : suggested.ltv != null
            ? String(suggested.ltv)
            : "",
      ltcPercent:
        metricsTouched.ltc || prev.ltcPercent
          ? prev.ltcPercent
          : suggested.ltc != null
            ? String(suggested.ltc)
            : "",
      arvPercent:
        metricsTouched.arv || prev.arvPercent
          ? prev.arvPercent
          : suggested.arvPercent != null
            ? String(suggested.arvPercent)
            : "",
      monthlyPayment:
        metricsTouched.payment || prev.monthlyPayment
          ? prev.monthlyPayment
          : suggested.monthlyPayment != null
            ? String(suggested.monthlyPayment)
            : "",
    }));
  }, [suggested, metricsTouched]);

  if (!isOpen) return null;

  const update = <K extends keyof LoiUnderwritingTerms>(
    key: K,
    value: LoiUnderwritingTerms[K],
  ) => {
    setTerms((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = () => {
    const brandingMessage = getLoiBrandingValidationMessage(branding);
    if (brandingMessage) {
      toast.error(brandingMessage);
      return;
    }

    const result = validateLoiUnderwritingTerms(terms);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSubmit({
      lenderTerms: serializeLoiUnderwritingTerms(terms),
      branding: {
        brandName: branding.brandName.trim(),
        logoUrl: branding.logoUrl,
      },
    });
  };

  const brandingComplete = isLoiBrandingComplete(branding);

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-[#134E4A] to-[#0F766E] px-6 py-5 text-white dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <FileText className="h-3.5 w-3.5" />
                Term Sheet / LOI
              </div>
              <h2 className="text-xl font-bold">
                {mode === "revised"
                  ? revisedVersionNumber
                    ? `Create Revised LOI (Version ${revisedVersionNumber})`
                    : "Create Revised LOI"
                  : mode === "regenerate"
                    ? "Update LOI Draft"
                    : "Generate Loan Term Sheet"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-teal-50/90">
                {mode === "revised"
                  ? "Previous versions are preserved for audit. Enter updated commercial terms below — the broker will receive a new version to review."
                  : mode === "regenerate"
                    ? "Previous LOI terms are pre-filled. Update any terms below and regenerate the draft term sheet."
                    : "Application details are loaded automatically. Enter your final credit terms below to generate the LOI."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-5">
            <section className="space-y-4 lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-[#0F766E]" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    From Application
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoRow
                    label="Borrower"
                    value={applicationContext?.borrowerName}
                  />
                  <InfoRow
                    label="Loan Product"
                    value={applicationContext?.loanProduct}
                  />
                  <InfoRow
                    label="Property Type"
                    value={applicationContext?.propertyType}
                  />
                  <InfoRow
                    label="Broker"
                    value={applicationContext?.brokerName}
                  />
                  <InfoRow
                    label="Requested Amount"
                    value={formatMoney(requestedAmount)}
                  />
                  <InfoRow
                    label="Property Value"
                    value={formatMoney(propertyValue)}
                  />
                  <InfoRow
                    label="Project Cost"
                    value={formatMoney(projectCost)}
                  />
                  <InfoRow label="ARV" value={formatMoney(arv)} />
                </div>
                {applicationContext?.propertyAddress ? (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Property Address
                        </p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                          {applicationContext.propertyAddress}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {brandingLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  Loading saved branding...
                </div>
              ) : (
                <LoiBrandingFields
                  value={branding}
                  onChange={setBranding}
                  disabled={submitting}
                />
              )}

              <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100">
                <p className="font-semibold">What happens next</p>
                <ul className="mt-2 space-y-1.5 text-teal-800/90 dark:text-teal-100/80">
                  <li>• Your 6 credit terms populate the term sheet PDF.</li>
                  <li>• Borrower, property, and broker data come from the application.</li>
                  <li>• Only the borrower signature block appears on the document.</li>
                </ul>
              </div>
            </section>

            <section className="lg:col-span-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Lender Credit Terms
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  These values appear prominently on the generated term sheet.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      1. Loan Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={terms.approvedAmount}
                      onChange={(e) => update("approvedAmount", e.target.value)}
                      placeholder="1750000"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.approvedAmount ? (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.approvedAmount}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      2. Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={terms.interestRate}
                      onChange={(e) => update("interestRate", e.target.value)}
                      placeholder="10.75"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.interestRate ? (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.interestRate}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      3. LTV (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={terms.ltvPercent}
                      onChange={(e) => {
                        setMetricsTouched((prev) => ({ ...prev, ltv: true }));
                        update("ltvPercent", e.target.value);
                      }}
                      placeholder="65"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.ltvPercent ? (
                      <p className="mt-1 text-xs text-red-500">{errors.ltvPercent}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Suggested: {formatMetricPercent(suggested.ltv)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      3. LTC (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={terms.ltcPercent}
                      onChange={(e) => {
                        setMetricsTouched((prev) => ({ ...prev, ltc: true }));
                        update("ltcPercent", e.target.value);
                      }}
                      placeholder="70"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.ltcPercent ? (
                      <p className="mt-1 text-xs text-red-500">{errors.ltcPercent}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Suggested: {formatMetricPercent(suggested.ltc)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      3. ARV (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={terms.arvPercent}
                      onChange={(e) => {
                        setMetricsTouched((prev) => ({ ...prev, arv: true }));
                        update("arvPercent", e.target.value);
                      }}
                      placeholder="60"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.arvPercent ? (
                      <p className="mt-1 text-xs text-red-500">{errors.arvPercent}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Suggested: {formatMetricPercent(suggested.arvPercent)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      4. Monthly Payment
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={terms.monthlyPayment}
                      onChange={(e) => {
                        setMetricsTouched((prev) => ({ ...prev, payment: true }));
                        update("monthlyPayment", e.target.value);
                      }}
                      placeholder="12500"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.monthlyPayment ? (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.monthlyPayment}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Suggested: {formatMetricCurrency(suggested.monthlyPayment)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      5. Interest Only
                    </label>
                    <div className="flex gap-2">
                      {[true, false].map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => update("interestOnly", value)}
                          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                            terms.interestOnly === value
                              ? "bg-[#0F766E] text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {value ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      6. Term
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {LOI_TERM_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => update("loanTerm", option)}
                          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                            terms.loanTerm === option
                              ? "bg-[#0F766E] text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {errors.loanTerm ? (
                      <p className="mt-1 text-xs text-red-500">{errors.loanTerm}</p>
                    ) : null}
                  </div>
                </div>

                <LoiRequiredDocumentsPicker
                  selectedDocuments={terms.requiredDocuments}
                  onSelectedDocumentsChange={(requiredDocuments) => {
                    update("requiredDocuments", requiredDocuments);
                  }}
                  customDocument={terms.customDocument}
                  onCustomDocumentChange={(value) => update("customDocument", value)}
                  error={errors.requiredDocuments}
                  getAuthHeaders={getAuthHeaders}
                  loanProductCode={loanProductCode}
                  onProductRequiredLoaded={handleProductRequiredLoaded}
                />
              </div>
            </section>
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
            disabled={submitting || !brandingComplete}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0d655e] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mode === "revised"
                  ? "Creating revised LOI..."
                  : mode === "regenerate"
                    ? "Updating draft..."
                    : "Generating..."}
              </>
            ) : mode === "revised" ? (
              revisedVersionNumber
                ? `Create Revised LOI (Version ${revisedVersionNumber})`
                : "Create Revised LOI"
            ) : mode === "regenerate" ? (
              "Update Draft Term Sheet"
            ) : (
              "Generate Term Sheet / LOI"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
