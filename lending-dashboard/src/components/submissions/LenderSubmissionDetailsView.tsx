import {
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  Hash,
  Mail,
  Search,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import LenderApplicationDetailsDownloadButton from "./LenderApplicationDetailsDownloadButton";
import type { PdfBranding } from "../../lib/applicationDetailsPdf";
import {
  resolveLatestLenderReview,
  resolveLenderDecisionStatus,
  mapLenderReviewRecord,
  type LenderReviewSummary,
} from "../../lib/lenderReviewUtils";
import {
  formatLoanProduct,
  formatApplicationStatus,
  getApplicationStatusColor,
  formatCompactAmount,
} from "../../lib/loanPipelineUtils";
import {
  formatSubmissionFieldValue,
  getBorrowerDisplayNameFromFields,
  getEntityTypeFromFields,
  getSubmissionFieldLabel,
  groupSubmissionFieldsForDisplay,
  parseSubmissionFieldValue,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";

type LenderSubmissionDetailsViewProps = {
  applicationLender: any;
  fields: SubmissionDetailField[];
  loanAmount: number;
  ltv: number;
  ltc: number;
  arv: number;
  dscr: number;
  netWorth: number;
  monthlyPayment?: number;
  monthlyPaymentDisplay?: string;
  submittedDate?: Date | null;
  showPdfDownload?: boolean;
  pdfBranding?: PdfBranding | null;
};

const BRAND = "#0F766E";
const BRAND_DARK = "#0d655e";

function InfoCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="group relative rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-950 dark:hover:border-slate-600">
      <div className="mb-2 flex items-center gap-2">
        {icon ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400">
            {icon}
          </span>
        ) : null}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
      </div>
      <div className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
        {value ?? "—"}
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "primary" | "muted";
}) {
  const isEmpty = !value || value === "—";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-md ${
        accent === "primary"
          ? "border-teal-700/20 bg-gradient-to-br from-[#0F766E] to-[#0d655e] text-white"
          : "border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      {accent === "primary" ? (
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
      ) : null}
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
          accent === "primary" ? "text-white/70" : "text-slate-400"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${
          isEmpty
            ? accent === "primary"
              ? "text-white/50"
              : "text-slate-300"
            : accent === "primary"
              ? "text-white"
              : "text-slate-900 dark:text-slate-50"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function FieldItem({ field }: { field: SubmissionDetailField }) {
  const display = formatSubmissionFieldValue(field);
  const isEmpty = !display || display === "—";
  return (
    <div className="rounded-lg bg-slate-50/80 px-3 py-2.5 dark:bg-slate-800/40">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {getSubmissionFieldLabel(field)}
      </span>
      <p
        className={`mt-1 break-words text-sm leading-snug ${
          isEmpty
            ? "italic text-slate-400"
            : "font-medium text-slate-900 dark:text-slate-100"
        }`}
      >
        {isEmpty ? "Not provided" : display}
      </p>
    </div>
  );
}

function isFieldEmpty(field: SubmissionDetailField): boolean {
  const raw = parseSubmissionFieldValue(field.value);
  if (raw === undefined || raw === null) return true;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t === "" || t === "-" || t === "—";
  }
  if (Array.isArray(raw)) return raw.length === 0;
  return false;
}

function AccordionSection({
  title,
  fields,
  defaultOpen = false,
  filledCount,
}: {
  title: string;
  fields: SubmissionDetailField[];
  defaultOpen?: boolean;
  filledCount: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-700/80 dark:bg-slate-950">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/60"
      >
        <span
          className="h-8 w-1 rounded-full"
          style={{ backgroundColor: BRAND }}
        />
        <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {filledCount} / {fields.length}
        </span>
        <ChevronDown
          size={15}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
          >
            <div className="grid grid-cols-1 gap-2.5 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-950">
              {fields.map((field) => (
                <FieldItem
                  key={`${field.fieldKey}-${field.fieldId || ""}`}
                  field={field}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LenderDecisionCard({
  review,
  lenderStatus,
}: {
  review: LenderReviewSummary;
  lenderStatus?: string | null;
}) {
  const reviewStatus = resolveLenderDecisionStatus(
    { lenderStatus, latestReview: review, reviews: [review] },
    review,
  );
  const isApproved = reviewStatus === "APPROVED";
  const isRejected = reviewStatus === "DECLINED" || reviewStatus === "REJECTED";
  const isConditional =
    reviewStatus === "CONDITIONAL" || reviewStatus === "LENDER_CONDITIONAL";

  const accentLine = isApproved
    ? "bg-emerald-500"
    : isConditional
      ? "bg-amber-500"
      : isRejected
        ? "bg-red-500"
        : "bg-slate-300";

  const statusBadgeCls = isApproved
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : isConditional
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : isRejected
        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
        : "bg-slate-100 text-slate-600";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className={`h-1 w-full ${accentLine}`} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Your decision
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Lender review
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeCls}`}
          >
            {reviewStatus === "DECLINED" ? "Rejected" : reviewStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {review.approvedAmount != null && review.approvedAmount !== "" && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Approved amount
              </p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                ${Number(review.approvedAmount).toLocaleString()}
              </p>
            </div>
          )}
          {review.interestRate != null && review.interestRate !== "" && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Rate
              </p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {review.interestRate}%
              </p>
            </div>
          )}
          {review.reviewedAt && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900 sm:col-span-1 col-span-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Reviewed
              </p>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {new Date(review.reviewedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {review.notes && (
          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Notes
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {review.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LenderSubmissionDetailsView({
  applicationLender,
  fields,
  loanAmount,
  ltv,
  ltc,
  arv,
  dscr,
  netWorth,
  monthlyPayment = 0,
  monthlyPaymentDisplay,
  submittedDate,
  showPdfDownload = true,
  pdfBranding = null,
}: LenderSubmissionDetailsViewProps) {
  const loanApplication = applicationLender?.loanApplication;
  const { sections, signatureField } = groupSubmissionFieldsForDisplay(fields);

  const reviewSource = {
    lenderStatus: applicationLender?.status,
    latestReview: applicationLender?.lenderReviews?.[0]
      ? mapLenderReviewRecord(applicationLender.lenderReviews[0])
      : null,
    reviews: (applicationLender?.lenderReviews || []).map(mapLenderReviewRecord),
  };

  const latestReview = resolveLatestLenderReview(reviewSource);
  const displayStatus = applicationLender?.status || loanApplication?.status;

  const borrowerName = getBorrowerDisplayNameFromFields(
    fields,
    applicationLender?.borrowerName || loanApplication?.client?.legalName,
  );

  const loanProductName =
    applicationLender?.loanProduct?.name ||
    formatLoanProduct(loanApplication?.loanProductCode) ||
    "—";

  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => {
          const label = getSubmissionFieldLabel(field).toLowerCase();
          const value = formatSubmissionFieldValue(field)
            .toString()
            .toLowerCase();
          const key = (field.fieldKey || "").toLowerCase();
          return label.includes(q) || value.includes(q) || key.includes(q);
        }),
      }))
      .filter((s) => s.fields.length > 0);
  }, [sections, searchQuery]);

  const totalMatchedFields = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.fields.length, 0),
    [filteredSections],
  );

  const kpis = [
    {
      label: "Loan amount",
      value: formatCompactAmount(Number(loanAmount || 0)),
      accent: "primary" as const,
    },
    {
      label: "Monthly payment",
      value:
        monthlyPaymentDisplay ||
        (monthlyPayment > 0
          ? `$${monthlyPayment.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}`
          : "—"),
    },
    { label: "LTV", value: ltv ? `${ltv.toFixed(2)}%` : "—" },
    { label: "LTC", value: ltc ? `${ltc.toFixed(2)}%` : "—" },
    { label: "ARV", value: arv ? `${arv.toFixed(2)}%` : "—" },
    { label: "DSCR", value: dscr ? dscr.toFixed(2) : "—" },
    { label: "Net worth", value: formatCompactAmount(Number(netWorth || 0)) },
  ];

  const entityType =
    getEntityTypeFromFields(fields) !== "—"
      ? getEntityTypeFromFields(fields)
      : loanApplication?.client?.entityType || "—";

  return (
    <div className="space-y-5">
      {latestReview && (
        <LenderDecisionCard
          review={latestReview}
          lenderStatus={applicationLender?.status}
        />
      )}

      {/* Hero overview */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-18px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:bg-slate-950">
        <div
          className="relative overflow-hidden border-b border-slate-100 px-5 py-5 text-white dark:border-slate-800 sm:px-6"
          style={{
            background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 55%, #134e4a 100%)`,
          }}
        >
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 left-24 h-32 w-32 rounded-full bg-emerald-300/10" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 ring-1 ring-white/15">
                  <FileText size={12} />
                  Application overview
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getApplicationStatusColor(displayStatus)}`}
                >
                  {formatApplicationStatus(displayStatus)}
                </span>
              </div>
              <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {borrowerName || "Borrower"}
              </h2>
              <p className="mt-1 text-sm text-white/75">
                {loanApplication?.applicationNumber || "—"}
                <span className="mx-2 text-white/35">·</span>
                {loanProductName}
              </p>
            </div>

            {showPdfDownload ? (
              <div className="shrink-0 [&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-white [&_button]:hover:bg-white/20">
                <LenderApplicationDetailsDownloadButton
                  applicationLender={applicationLender}
                  fields={fields}
                  formatApplicationStatus={formatApplicationStatus}
                  loanAmount={loanAmount}
                  ltv={ltv}
                  dscr={dscr}
                  monthlyPayment={monthlyPayment}
                  monthlyPaymentDisplay={monthlyPaymentDisplay}
                  submittedDate={submittedDate}
                  initialBranding={pdfBranding}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          <InfoCell
            label="Application number"
            icon={<Hash size={12} />}
            value={loanApplication?.applicationNumber}
          />
          <InfoCell
            label="Borrower"
            icon={<User size={12} />}
            value={borrowerName}
          />
          <InfoCell
            label="Loan product"
            icon={<CreditCard size={12} />}
            value={loanProductName}
          />
          <InfoCell
            label="Entity type"
            icon={<Building2 size={12} />}
            value={entityType}
          />
          <InfoCell
            label="Broker"
            icon={<Building2 size={12} />}
            value={loanApplication?.brokerOrg?.name}
          />
          <InfoCell
            label="Broker email"
            icon={<Mail size={12} />}
            value={loanApplication?.brokerOrg?.email}
          />
          <InfoCell
            label="Credit score"
            value={
              fields.find((field) => field.fieldKey === "creditScore")
                ? formatSubmissionFieldValue(
                    fields.find((field) => field.fieldKey === "creditScore")!,
                  )
                : (applicationLender?.creditScore ?? "—")
            }
          />
          {submittedDate ? (
            <InfoCell
              label="Submitted"
              value={
                <span>
                  {submittedDate.toLocaleDateString()}
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="font-medium text-slate-500 dark:text-slate-400">
                    {submittedDate.toLocaleTimeString()}
                  </span>
                </span>
              }
            />
          ) : (
            <InfoCell
              label="Status"
              value={formatApplicationStatus(displayStatus)}
            />
          )}
        </div>
      </section>

      {/* KPI metrics */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Key loan metrics
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {kpis.map((kpi) => (
            <KpiCell
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              accent={kpi.accent}
            />
          ))}
        </div>
      </section>

      {/* Fields panel */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-20px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-950">
        <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all fields…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600/40 focus:bg-white focus:ring-4 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-teal-500/40 dark:focus:ring-teal-500/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs text-slate-400">
              {totalMatchedFields === 0 ? (
                <>No fields match “{searchQuery}”</>
              ) : (
                <>
                  {totalMatchedFields} field
                  {totalMatchedFields === 1 ? "" : "s"} in{" "}
                  {filteredSections.length} section
                  {filteredSections.length === 1 ? "" : "s"}
                </>
              )}
            </p>
          )}
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {filteredSections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
              No matching fields.
            </div>
          ) : (
            filteredSections.map((section, index) => {
              const visibleFields = section.fields.filter(
                (f) => !isFieldEmpty(f),
              );
              return (
                <AccordionSection
                  key={section.id}
                  title={section.title}
                  fields={visibleFields}
                  defaultOpen={index === 0 || Boolean(searchQuery.trim())}
                  filledCount={visibleFields.length}
                />
              );
            })
          )}
        </div>

        {signatureField && (
          <div className="border-t border-slate-100 px-5 py-6 text-center dark:border-slate-800">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Digital signature
            </p>
            <div className="inline-block rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <img
                src={String(parseSubmissionFieldValue(signatureField.value))}
                alt="Digital Signature"
                className="h-28 object-contain"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
