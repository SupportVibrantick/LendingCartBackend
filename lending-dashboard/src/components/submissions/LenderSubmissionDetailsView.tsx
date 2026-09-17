import {
  Building2,
  ChevronDown,
  Search,
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
import { formatApplicationStatus } from "../../lib/loanPipelineUtils";
import {
  formatSubmissionFieldValue,
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

const BRAND = "#183b57";

const SUMMARY_FIELD_KEYS = new Set([
  "applicationid",
  "applicationnumber",
  "applicationstatus",
  "borrowerfirstname",
  "borrowerlastname",
  "borrowername",
  "firstname",
  "lastname",
  "borroweremail",
  "email",
  "brokername",
  "brokeremail",
  "loanproduct",
  "loanproductcode",
  "loanprogram",
  "amountrequested",
  "loanamount",
  "monthlypayment",
  "ltv",
  "ltvpercentage",
  "ltc",
  "ltcpercentage",
  "arv",
  "arvpercentage",
  "dscr",
  "dscrratio",
  "networth",
  "entitytype",
  "creditscore",
]);

function isDisplayedInSummary(field: SubmissionDetailField) {
  const normalizedKey = (field.fieldKey || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return SUMMARY_FIELD_KEYS.has(normalizedKey);
}

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
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400">
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
  totalCount,
}: {
  title: string;
  fields: SubmissionDetailField[];
  defaultOpen?: boolean;
  filledCount: number;
  totalCount: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isComplete = totalCount > 0 && filledCount === totalCount;
  const isInProgress = filledCount > 0 && !isComplete;

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
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            isComplete
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : isInProgress
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {isComplete ? "✓ " : ""}
          {filledCount}/{totalCount}
          {isComplete ? " complete" : isInProgress ? " in progress" : ""}
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
  dscr,
  monthlyPayment = 0,
  monthlyPaymentDisplay,
  submittedDate,
  showPdfDownload = true,
  pdfBranding = null,
}: LenderSubmissionDetailsViewProps) {
  const loanApplication = applicationLender?.loanApplication;
  const fieldsWithoutSummary = useMemo(
    () => fields.filter((field) => !isDisplayedInSummary(field)),
    [fields],
  );
  const { sections, signatureField } =
    groupSubmissionFieldsForDisplay(fieldsWithoutSummary);

  const reviewSource = {
    lenderStatus: applicationLender?.status,
    latestReview: applicationLender?.lenderReviews?.[0]
      ? mapLenderReviewRecord(applicationLender.lenderReviews[0])
      : null,
    reviews: (applicationLender?.lenderReviews || []).map(mapLenderReviewRecord),
  };

  const latestReview = resolveLatestLenderReview(reviewSource);
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

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Application details
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Additional submission information
            </p>
          </div>

          {showPdfDownload ? (
            <div className="shrink-0">
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

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <InfoCell
            label="Entity type"
            icon={<Building2 size={12} />}
            value={entityType}
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
          ) : null}
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/40 focus:bg-white focus:ring-4 focus:ring-brand-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-500/40 dark:focus:ring-brand-500/10"
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
              const originalSection = sections.find(
                (candidate) => candidate.id === section.id,
              );
              const totalCount =
                originalSection?.fields.length ?? section.fields.length;
              const filledCount =
                originalSection?.fields.filter((field) => !isFieldEmpty(field))
                  .length ?? visibleFields.length;

              return (
                <AccordionSection
                  key={section.id}
                  title={section.title}
                  fields={visibleFields}
                  defaultOpen={index === 0 || Boolean(searchQuery.trim())}
                  filledCount={filledCount}
                  totalCount={totalCount}
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
