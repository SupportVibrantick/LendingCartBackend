import {
  Building2,
  Calendar,
  ChevronDown,
  Eye,
  Gauge,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import ApplicationDetailsDownloadButton from "./ApplicationDetailsDownloadButton";
import {
  formatSubmissionFieldValue,
  getEntityTypeFromFields,
  getSubmissionFieldLabel,
  groupSubmissionFieldsForDisplay,
  parseSubmissionFieldValue,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";
import {
  resolveLatestLenderReview,
  resolveLenderDecisionStatus,
} from "../../lib/lenderReviewUtils";

// ─── Types ─────────────────

type LenderReview = {
  reviewStatus?: string;
  approvedAmount?: number | string | null;
  interestRate?: number | string | null;
  notes?: string | null;
  reviewedAt?: string | null;
};

type LenderSummary = {
  applicationLenderId?: string;
  lenderName?: string | null;
  lenderStatus?: string | null;
  isFundedLender?: boolean;
  latestReview?: LenderReview | null;
  reviews?: LenderReview[];
};

type SubmissionDetailsViewProps = {
  submissionDetail: any;
  fields: SubmissionDetailField[];
  formatSubmissionStatus: (status?: string) => string;
  getStatusChip: (status?: string) => string;
  formatCompactAmount: (value: number) => string;
  loanAmount: number;
  ltv: number;
  ltc: number;
  arv: number;
  dscr: number;
  netWorth: number;
  monthlyPayment?: number;
  monthlyPaymentDisplay?: string;
  submittedDate?: Date | null;
  showEditHint?: boolean;
  canMarkFunded?: boolean;
  markFundedBlockedReason?: string | null;
  markingFundedId?: string | null;
  onMarkFunded?: (applicationLenderId: string) => void | Promise<void>;
  showPdfDownload?: boolean;
};

const BRAND = "#4C78F5";

/**
 * Fields already shown in the page header, metrics ribbon, or summary cards.
 * They stay out of the detail sections so values are not repeated.
 */
const TOP_SUMMARY_FIELD_KEYS = new Set([
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
  "dob",
  "dateofbirth",
]);

function isDisplayedInTopSummary(field: SubmissionDetailField) {
  const normalizedKey = (field.fieldKey || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return TOP_SUMMARY_FIELD_KEYS.has(normalizedKey);
}

function findFieldByKeys(
  fields: SubmissionDetailField[],
  keys: string[],
): SubmissionDetailField | undefined {
  const normalized = new Set(keys.map((k) => k.toLowerCase()));
  return fields.find((field) =>
    normalized.has((field.fieldKey || "").trim().toLowerCase()),
  );
}

// ─── Sub-components ───────

function InfoCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  const isEmpty =
    value == null ||
    value === "" ||
    value === "—" ||
    value === "-";

  return (
    <div className="group relative rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-4 transition hover:border-slate-300 dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-950 dark:hover:border-slate-600">
      <div className="mb-2 flex items-center gap-2">
        {icon ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#4C78F5]/10 text-[#4C78F5]">
            {icon}
          </span>
        ) : null}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
      </div>
      <div
        className={`text-[15px] font-semibold leading-snug break-words ${
          isEmpty
            ? "text-slate-300 dark:text-slate-600"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}

function FieldItem({ field }: { field: SubmissionDetailField }) {
  const display = formatSubmissionFieldValue(field);
  const isEmpty = !display || display === "—";
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {getSubmissionFieldLabel(field)}
      </span>
      <p
        className={`mt-1 text-sm leading-snug break-words ${
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
  icon?: ReactNode;
  fields: SubmissionDetailField[];
  defaultOpen?: boolean;
  filledCount: number;
  totalCount: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isComplete = totalCount > 0 && filledCount === totalCount;
  const isInProgress = filledCount > 0 && !isComplete;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-700/80 dark:bg-slate-950">
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
                : "bg-[#4C78F5]/10 text-[#4C78F5]"
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
  applicationLenderId,
  lenderName,
  lenderStatus,
  review,
  isFundedLender = false,
  canMarkFunded = false,
  markingFundedId,
  onMarkFunded,
}: {
  applicationLenderId?: string;
  lenderName?: string | null;
  lenderStatus?: string | null;
  review: LenderReview;
  isFundedLender?: boolean;
  canMarkFunded?: boolean;
  markingFundedId?: string | null;
  onMarkFunded?: (applicationLenderId: string) => void | Promise<void>;
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
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950">
      <div className={`h-1 w-full ${accentLine}`} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Lender decision
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lenderName || "Lender"}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeCls}`}
          >
            {reviewStatus === "DECLINED" ? "Rejected" : reviewStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
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
            <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
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

        {isFundedLender ? (
          <div className="mt-auto border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              Funded lender
            </span>
          </div>
        ) : canMarkFunded &&
          isApproved &&
          applicationLenderId &&
          onMarkFunded ? (
          <div className="mt-auto border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onMarkFunded(applicationLenderId)}
              disabled={markingFundedId === applicationLenderId}
              className="w-full rounded-xl bg-[#4C78F5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {markingFundedId === applicationLenderId
                ? "Marking as funded…"
                : "Mark as funded"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main component ────

export default function SubmissionDetailsView({
  submissionDetail,
  fields,
  formatSubmissionStatus,
  formatCompactAmount,
  loanAmount,
  ltv,
  dscr,
  monthlyPayment = 0,
  monthlyPaymentDisplay,
  submittedDate,
  showEditHint = true,
  canMarkFunded = false,
  markFundedBlockedReason = null,
  markingFundedId = null,
  onMarkFunded,
  showPdfDownload = true,
}: SubmissionDetailsViewProps) {
  const isApplicationFunded =
    submissionDetail?.applicationStatus === "FUNDED" ||
    submissionDetail?.pipelineStatus === "FUNDED" ||
    submissionDetail?.status === "FUNDED";

  const fieldsWithoutTopSummary = useMemo(
    () => fields.filter((field) => !isDisplayedInTopSummary(field)),
    [fields],
  );
  const { sections, signatureField } = groupSubmissionFieldsForDisplay(
    fieldsWithoutTopSummary,
  );

  const lenderDecisions = (submissionDetail?.lenders || [])
    .map((lender: LenderSummary) => {
      const review = resolveLatestLenderReview(lender);
      if (!review) return null;
      return {
        applicationLenderId: lender.applicationLenderId,
        lenderName: lender.lenderName,
        lenderStatus: lender.lenderStatus,
        isFundedLender: Boolean(lender.isFundedLender),
        review,
      };
    })
    .filter(Boolean) as Array<{
    applicationLenderId?: string;
    lenderName?: string | null;
    lenderStatus?: string | null;
    isFundedLender?: boolean;
    review: LenderReview;
  }>;

  const showMarkFundedActions = canMarkFunded && !isApplicationFunded;
  const hasApprovedLender = lenderDecisions.some(
    (item) =>
      resolveLenderDecisionStatus(
        {
          lenderStatus: item.lenderStatus,
          latestReview: item.review,
          reviews: [item.review],
        },
        item.review,
      ) === "APPROVED",
  );

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

  const entityType = getEntityTypeFromFields(fields);
  const dobField = findFieldByKeys(fields, ["dob", "dateOfBirth"]);
  const creditScoreField = findFieldByKeys(fields, ["creditScore"]);

  return (
    <div className="space-y-5">
      {!showMarkFundedActions &&
        markFundedBlockedReason &&
        hasApprovedLender &&
        !isApplicationFunded && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
            <span className="mt-0.5 flex-shrink-0 text-amber-500">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 11a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 12zm.625-3.5h-1.25l-.375-4.5h2l-.375 4.5z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Mark as funded unavailable
              </p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                {markFundedBlockedReason}
              </p>
            </div>
          </div>
        )}

      {lenderDecisions.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lenderDecisions.map((item, i) => (
            <LenderDecisionCard
              key={`${item.applicationLenderId || item.lenderName}-${i}`}
              applicationLenderId={item.applicationLenderId}
              lenderName={item.lenderName}
              lenderStatus={item.lenderStatus}
              review={item.review}
              isFundedLender={item.isFundedLender}
              canMarkFunded={showMarkFundedActions}
              markingFundedId={markingFundedId}
              onMarkFunded={onMarkFunded}
            />
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Application details
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Key borrower and submission information
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showEditHint && submissionDetail?.canEdit !== false ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                <Eye size={12} className="shrink-0" />
                Read-only — use Edit Application to change
              </span>
            ) : null}
            {showPdfDownload ? (
              <ApplicationDetailsDownloadButton
                submissionDetail={submissionDetail}
                fields={fields}
                formatSubmissionStatus={formatSubmissionStatus}
                formatCompactAmount={formatCompactAmount}
                loanAmount={loanAmount}
                ltv={ltv}
                dscr={dscr}
                monthlyPayment={monthlyPayment}
                monthlyPaymentDisplay={monthlyPaymentDisplay}
                submittedDate={submittedDate}
                className="shrink-0"
              />
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
          <InfoCell
            label="Entity type"
            icon={<Building2 size={12} />}
            value={entityType}
          />
          <InfoCell
            label="Date of birth"
            icon={<Calendar size={12} />}
            value={
              dobField ? formatSubmissionFieldValue(dobField) : "—"
            }
          />
          <InfoCell
            label="Credit score"
            icon={<Gauge size={12} />}
            value={
              creditScoreField
                ? formatSubmissionFieldValue(creditScoreField)
                : "—"
            }
          />
          <InfoCell
            label="Submitted"
            icon={<Calendar size={12} />}
            value={
              submittedDate ? (
                <span>
                  {submittedDate.toLocaleDateString()}
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="font-medium text-slate-500 dark:text-slate-400">
                    {submittedDate.toLocaleTimeString()}
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Application answers
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Fields not already shown in the summary above
            </p>
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all fields…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              if (visibleFields.length === 0) return null;
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
            <div className="inline-block rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
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
