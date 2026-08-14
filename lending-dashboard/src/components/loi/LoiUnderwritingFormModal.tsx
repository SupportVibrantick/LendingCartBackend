import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, FileText, Loader2, User } from "lucide-react";
import toast from "react-hot-toast";
import {
  LOI_TERM_OPTIONS,
  calculateBindingMaxLoan,
  calculateSuggestedLoiMetrics,
  createEmptyLoiUnderwritingTerms,
  formatLoiNumberInput,
  getLoiValueFieldLabel,
  mapStoredLoiTermsToForm,
  serializeLoiUnderwritingTerms,
  usesRehabConstructionLoiMetrics,
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

const LOI_ERROR_FIELD_ORDER = [
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
  const token = sessionStorage.getItem("lender_token");
  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };
}

type Props = {
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

function toSeedNumber(value?: number | string | null) {
  const numeric = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return numeric;
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
        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
      />
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default function LoiUnderwritingFormModal({
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
  const showRehabMetrics = usesRehabConstructionLoiMetrics(loanProductCode);
  const valueFieldLabel = getLoiValueFieldLabel(loanProductCode);

  const seedEmptyTerms = useCallback(
    () => {
      const propertySeed = toSeedNumber(propertyValue);
      const projectSeed = toSeedNumber(projectCost);
      const rehabCost =
        propertySeed != null && projectSeed != null
          ? Math.max(0, projectSeed - propertySeed)
          : null;

      return createEmptyLoiUnderwritingTerms(requestedAmount, {
        interestRate: applicationInterestRate,
        loanTerm: applicationLoanTerm,
        propertyValue,
        projectCost,
        arv,
        rehabCost,
        loanProductCode,
      });
    },
    [
      requestedAmount,
      applicationInterestRate,
      applicationLoanTerm,
      propertyValue,
      projectCost,
      arv,
      loanProductCode,
    ],
  );

  const [terms, setTerms] = useState<LoiUnderwritingTerms>(() => seedEmptyTerms());
  const [errors, setErrors] = useState<
    Partial<Record<keyof LoiUnderwritingTerms, string>>
  >({});
  const [branding, setBranding] = useState<LoiBrandingValues>(EMPTY_LOI_BRANDING);
  const [brandingLoading, setBrandingLoading] = useState(false);
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
    const fromStored =
      mode === "revised" || mode === "regenerate"
        ? mapStoredLoiTermsToForm(storedTerms)
        : null;
    const seeded = seedEmptyTerms();

    if (fromStored) {
      setTerms({
        ...seeded,
        ...fromStored,
        // Keep application seeds when older saved terms lack the new fillable fields
        collateralOrPropertyValue:
          fromStored.collateralOrPropertyValue ||
          seeded.collateralOrPropertyValue,
        rehabConstructionCost:
          fromStored.rehabConstructionCost || seeded.rehabConstructionCost,
        afterRepairValue:
          fromStored.afterRepairValue || seeded.afterRepairValue,
        ltvPercent: fromStored.ltvPercent || seeded.ltvPercent,
        ltcPercent: fromStored.ltcPercent || seeded.ltcPercent,
        arvPercent: fromStored.arvPercent || seeded.arvPercent,
        totalClosingCosts:
          fromStored.totalClosingCosts || seeded.totalClosingCosts,
        requiredReservesAmount:
          fromStored.requiredReservesAmount || seeded.requiredReservesAmount,
      });
    } else {
      setTerms(seeded);
    }
    setErrors({});
    // Only re-seed when mode/stored terms change — not when application seed props settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storedTerms]);

  useEffect(() => {
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
  }, []);

  const suggested = useMemo(
    () =>
      calculateSuggestedLoiMetrics({
        approvedAmount: terms.approvedAmount,
        interestRate: terms.interestRate,
        interestOnly: terms.interestOnly,
        loanTerm: terms.loanTerm,
        collateralOrPropertyValue: terms.collateralOrPropertyValue,
        rehabConstructionCost: terms.rehabConstructionCost,
        afterRepairValue: terms.afterRepairValue,
        originationPoints: terms.originationPoints,
        processingFee: terms.processingFee,
        appraisalFee: terms.appraisalFee,
        brokerPoints: terms.brokerPoints,
        wireFee: terms.wireFee,
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
      terms.processingFee,
      terms.appraisalFee,
      terms.brokerPoints,
      terms.wireFee,
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
          ? formatLoiNumberInput(String(suggested.ltv))
          : "";
      const nextLtc =
        showRehabMetrics && suggested.ltc != null
          ? formatLoiNumberInput(String(suggested.ltc))
          : "";
      const nextArv =
        showRehabMetrics && suggested.arvPercent != null
          ? formatLoiNumberInput(String(suggested.arvPercent))
          : "";
      const nextPayment =
        suggested.monthlyPayment == null
          ? ""
          : formatLoiNumberInput(String(suggested.monthlyPayment));
      const nextClosing =
        suggested.totalClosingCosts != null
          ? formatLoiNumberInput(String(suggested.totalClosingCosts))
          : "";
      const nextReserves =
        suggested.requiredReservesAmount != null
          ? formatLoiNumberInput(String(suggested.requiredReservesAmount))
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

  useEffect(() => {
    const result = validateLoiUnderwritingTerms(terms, { loanProductCode });
    setErrors(result.errors);
  }, [terms, loanProductCode]);

  const setNumberField = (
    key: keyof Pick<
      LoiUnderwritingTerms,
      | "approvedAmount"
      | "interestRate"
      | "collateralOrPropertyValue"
      | "rehabConstructionCost"
      | "afterRepairValue"
      | "maximumLtvPercent"
      | "maximumLtcPercent"
      | "maximumArvPercent"
      | "originationPoints"
      | "processingFee"
      | "appraisalFee"
      | "brokerPoints"
      | "wireFee"
      | "requiredReservesPercent"
    >,
    raw: string,
  ) => {
    setTerms((prev) => ({
      ...prev,
      [key]: formatLoiNumberInput(raw),
    }));
  };

  const update = <K extends keyof LoiUnderwritingTerms>(
    key: K,
    value: LoiUnderwritingTerms[K],
  ) => {
    setTerms((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const brandingMessage = getLoiBrandingValidationMessage(branding);
    if (brandingMessage) {
      toast.error(brandingMessage);
      requestAnimationFrame(() => scrollToField("branding"));
      return;
    }

    const result = validateLoiUnderwritingTerms(terms, { loanProductCode });
    if (!result.valid) {
      setErrors(result.errors);
      const firstErrorField = LOI_ERROR_FIELD_ORDER.find(
        (field) =>
          field !== "branding" &&
          Boolean(result.errors[field as keyof LoiUnderwritingTerms]),
      );
      if (firstErrorField) {
        requestAnimationFrame(() => scrollToField(firstErrorField));
      }
      return;
    }
    onSubmit({
      lenderTerms: serializeLoiUnderwritingTerms(terms, { loanProductCode }),
      branding: {
        brandName: branding.brandName.trim(),
        logoUrl: branding.logoUrl,
      },
    });
  };

  const brandingComplete = isLoiBrandingComplete(branding);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-[#134E4A] to-[#0F766E] px-6 py-5 text-white dark:border-slate-800">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="mt-0.5 rounded-lg p-2 text-white/80 hover:bg-white/10"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <FileText className="h-3.5 w-3.5" />
                Term Sheet / LOI
              </div>
              <h1 className="text-xl font-bold">
                {mode === "revised"
                  ? revisedVersionNumber
                    ? `Create Revised LOI (Version ${revisedVersionNumber})`
                    : "Create Revised LOI"
                  : mode === "regenerate"
                    ? "Update LOI Draft"
                    : "Generate Loan Term Sheet"}
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-teal-50/90">
                {mode === "revised"
                  ? "Previous versions are preserved for audit. Enter updated commercial terms below — the broker will receive a new version to review."
                  : mode === "regenerate"
                    ? "Previous LOI terms are pre-filled. Update any terms below and regenerate the draft term sheet."
                    : "Application details are loaded automatically. Enter your final credit terms below to generate the LOI."}
              </p>
            </div>
          </div>
        </div>

        <div ref={scrollBodyRef} className="px-6 py-5">
          <div className="grid grid-cols-1 gap-6">
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-[#0F766E]" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    From Application
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                    label={valueFieldLabel}
                    value={formatMoney(propertyValue)}
                  />
                  {showRehabMetrics ? (
                    <>
                      <InfoRow
                        label="Project Cost"
                        value={formatMoney(projectCost)}
                      />
                      <InfoRow label="ARV" value={formatMoney(arv)} />
                    </>
                  ) : null}
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
                <div data-loi-field="branding">
                  <LoiBrandingFields
                    value={branding}
                    onChange={setBranding}
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100">
                <p className="font-semibold">What happens next</p>
                <ul className="mt-2 space-y-1.5 text-teal-800/90 dark:text-teal-100/80 sm:columns-2 sm:gap-6">
                  <li>• Your credit terms populate the term sheet PDF.</li>
                  <li>• Borrower, property, and broker data come from the application.</li>
                  <li>• Only the borrower signature block appears on the document.</li>
                </ul>
              </div>
            </section>

            <section>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Lender Credit Terms
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  These values appear prominently on the generated term sheet.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div data-loi-field="approvedAmount">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Loan Amount
                    </label>
                    <input
                      inputMode="decimal"
                      value={terms.approvedAmount}
                      onChange={(e) =>
                        setNumberField("approvedAmount", e.target.value)
                      }
                      placeholder="1,750,000"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.approvedAmount ? (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.approvedAmount}
                      </p>
                    ) : null}
                  </div>

                  <div data-loi-field="interestRate">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Interest Rate (%)
                    </label>
                    <input
                      inputMode="decimal"
                      value={terms.interestRate}
                      onChange={(e) =>
                        setNumberField("interestRate", e.target.value)
                      }
                      placeholder="10.75"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.interestRate ? (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.interestRate}
                      </p>
                    ) : null}
                  </div>

                  <div data-loi-field="collateralOrPropertyValue">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {valueFieldLabel}
                    </label>
                    <input
                      inputMode="decimal"
                      value={terms.collateralOrPropertyValue}
                      onChange={(e) =>
                        setNumberField(
                          "collateralOrPropertyValue",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. 2,500,000"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.collateralOrPropertyValue ? (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.collateralOrPropertyValue}
                      </p>
                    ) : null}
                  </div>

                  {showRehabMetrics ? (
                    <>
                      <div data-loi-field="rehabConstructionCost">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rehab/Construction Cost
                        </label>
                        <input
                          inputMode="decimal"
                          value={terms.rehabConstructionCost}
                          onChange={(e) =>
                            setNumberField(
                              "rehabConstructionCost",
                              e.target.value,
                            )
                          }
                          placeholder="350,000"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                        />
                        {errors.rehabConstructionCost ? (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.rehabConstructionCost}
                          </p>
                        ) : null}
                      </div>

                      <div data-loi-field="afterRepairValue">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          After Repair Value
                        </label>
                        <input
                          inputMode="decimal"
                          value={terms.afterRepairValue}
                          onChange={(e) =>
                            setNumberField("afterRepairValue", e.target.value)
                          }
                          placeholder="3,000,000"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                        />
                        {errors.afterRepairValue ? (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.afterRepairValue}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  <ReadOnlyField
                    field="ltvPercent"
                    label="LTV (%)"
                    value={terms.ltvPercent}
                    hint={`Auto-calculated · ${formatMetricPercent(suggested.ltv)}`}
                  />

                  {showRehabMetrics ? (
                    <>
                      <ReadOnlyField
                        field="ltcPercent"
                        label="LTC (%)"
                        value={terms.ltcPercent}
                        hint={`Auto-calculated · ${formatMetricPercent(suggested.ltc)}`}
                      />
                      <ReadOnlyField
                        field="arvPercent"
                        label="ARV (%)"
                        value={terms.arvPercent}
                        hint={`Auto-calculated · ${formatMetricPercent(suggested.arvPercent)}`}
                      />
                    </>
                  ) : null}

                  <div data-loi-field="maximumLtvPercent">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Maximum LTV (%)
                    </label>
                    <input
                      inputMode="decimal"
                      value={terms.maximumLtvPercent}
                      onChange={(e) =>
                        setNumberField("maximumLtvPercent", e.target.value)
                      }
                      placeholder="70"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                    />
                    {errors.maximumLtvPercent ? (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.maximumLtvPercent}
                      </p>
                    ) : null}
                  </div>

                  {showRehabMetrics ? (
                    <>
                      <div data-loi-field="maximumLtcPercent">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Maximum LTC (%)
                        </label>
                        <input
                          inputMode="decimal"
                          value={terms.maximumLtcPercent}
                          onChange={(e) =>
                            setNumberField("maximumLtcPercent", e.target.value)
                          }
                          placeholder="75"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                        />
                        {errors.maximumLtcPercent ? (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.maximumLtcPercent}
                          </p>
                        ) : null}
                      </div>

                      <div data-loi-field="maximumArvPercent">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Maximum ARV (%)
                        </label>
                        <input
                          inputMode="decimal"
                          value={terms.maximumArvPercent}
                          onChange={(e) =>
                            setNumberField("maximumArvPercent", e.target.value)
                          }
                          placeholder="65"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                        />
                        {errors.maximumArvPercent ? (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.maximumArvPercent}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  {bindingMaxLoan ? (
                    <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2.5 text-xs text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100">
                      Binding max loan (whichever is lower):{" "}
                      {formatMetricCurrency(bindingMaxLoan.amount)} via{" "}
                      {bindingMaxLoan.bindingLabel}
                    </div>
                  ) : null}

                  <ReadOnlyField
                    field="monthlyPayment"
                    label="Monthly Payment"
                    value={terms.monthlyPayment}
                    error={errors.monthlyPayment}
                    hint={
                      suggested.monthlyPayment != null
                        ? `Auto-calculated from amount, rate, and term · ${formatMetricCurrency(suggested.monthlyPayment)}`
                        : "Auto-calculated from amount, rate, and term"
                    }
                  />

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Interest Only
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

                  <div className="sm:col-span-2 lg:col-span-3" data-loi-field="loanTerm">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Term
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

                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Fees & Closing Costs
                  </h4>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div data-loi-field="originationPoints">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Origination Points (%)
                      </label>
                      <input
                        inputMode="decimal"
                        value={terms.originationPoints}
                        onChange={(e) =>
                          setNumberField("originationPoints", e.target.value)
                        }
                        placeholder="2"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                      />
                      {errors.originationPoints ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.originationPoints}
                        </p>
                      ) : null}
                    </div>

                    <div data-loi-field="processingFee">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Processing Fee ($)
                      </label>
                      <input
                        inputMode="decimal"
                        value={terms.processingFee}
                        onChange={(e) =>
                          setNumberField("processingFee", e.target.value)
                        }
                        placeholder="995"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                      />
                      {errors.processingFee ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.processingFee}
                        </p>
                      ) : null}
                    </div>

                    <div data-loi-field="appraisalFee">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Appraisal Fee ($)
                      </label>
                      <input
                        inputMode="decimal"
                        value={terms.appraisalFee}
                        onChange={(e) =>
                          setNumberField("appraisalFee", e.target.value)
                        }
                        placeholder="e.g. 750"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                      />
                      {errors.appraisalFee ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.appraisalFee}
                        </p>
                      ) : null}
                    </div>

                    <div data-loi-field="brokerPoints">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Broker Points (%)
                      </label>
                      <input
                        inputMode="decimal"
                        value={terms.brokerPoints}
                        onChange={(e) =>
                          setNumberField("brokerPoints", e.target.value)
                        }
                        placeholder="1"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                      />
                      {errors.brokerPoints ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.brokerPoints}
                        </p>
                      ) : null}
                    </div>

                    <div data-loi-field="wireFee">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Wire Fee ($)
                      </label>
                      <input
                        inputMode="decimal"
                        value={terms.wireFee}
                        onChange={(e) =>
                          setNumberField("wireFee", e.target.value)
                        }
                        placeholder="50"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                      />
                      {errors.wireFee ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.wireFee}
                        </p>
                      ) : null}
                    </div>

                    <ReadOnlyField
                      field="totalClosingCosts"
                      label="Total Closing Costs"
                      value={terms.totalClosingCosts}
                      hint={
                        suggested.totalClosingCosts != null
                          ? `Auto-calculated · ${formatMetricCurrency(suggested.totalClosingCosts)}`
                          : "Auto-calculated from fees above"
                      }
                    />
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Required Reserves
                  </h4>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div data-loi-field="requiredReservesPercent">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Required Reserves (%)
                      </label>
                      <input
                        inputMode="decimal"
                        value={terms.requiredReservesPercent}
                        onChange={(e) =>
                          setNumberField(
                            "requiredReservesPercent",
                            e.target.value,
                          )
                        }
                        placeholder="3"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800"
                      />
                      {errors.requiredReservesPercent ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.requiredReservesPercent}
                        </p>
                      ) : null}
                    </div>

                    <ReadOnlyField
                      field="requiredReservesAmount"
                      label="Reserve Amount ($)"
                      value={terms.requiredReservesAmount}
                      hint={
                        suggested.requiredReservesAmount != null
                          ? `Auto-calculated · ${formatMetricCurrency(suggested.requiredReservesAmount)}`
                          : "Auto-calculated as loan × reserves %"
                      }
                    />
                  </div>
                </div>

                <div data-loi-field="requiredDocuments">
                  <LoiRequiredDocumentsPicker
                    selectedDocuments={terms.requiredDocuments}
                    onSelectedDocumentsChange={(requiredDocuments) => {
                      update("requiredDocuments", requiredDocuments);
                    }}
                    customDocument={terms.customDocument}
                    onCustomDocumentChange={(value) =>
                      update("customDocument", value)
                    }
                    error={errors.requiredDocuments}
                    getAuthHeaders={getAuthHeaders}
                    loanProductCode={loanProductCode}
                    selectionSource={
                      mode === "revised" || mode === "regenerate"
                        ? "previous"
                        : "none"
                    }
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
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
