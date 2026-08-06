import { ChevronRight, Eye, FileText, Search, User, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import ApplicationDetailsDownloadButton from "./ApplicationDetailsDownloadButton";
import {
  formatSubmissionFieldValue,
  getBorrowerDisplayNameFromFields,
  getEntityTypeFromFields,
  getSubmissionFieldLabel,
  groupSubmissionFieldsForDisplay,
  parseSubmissionFieldValue,
  PRODUCT_LABELS,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";
import {
  resolveLatestLenderReview,
  resolveLenderDecisionStatus,
} from "../../lib/lenderReviewUtils";

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

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-100/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-base font-bold text-transparent">
        {value}
      </p>
    </div>
  );
}

function FieldItem({ field }: { field: SubmissionDetailField }) {
  const display = formatSubmissionFieldValue(field);
  const isEmpty = !display || display === "—";
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {getSubmissionFieldLabel(field)}
      </p>
      <p
        className={`text-sm font-semibold leading-snug break-words ${
          isEmpty
            ? "text-slate-400 italic"
            : "text-slate-900 dark:text-slate-100"
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
    const trimmed = raw.trim();
    return trimmed === "" || trimmed === "-" || trimmed === "—";
  }
  if (Array.isArray(raw)) return raw.length === 0;
  return false;
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

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
        isApproved
          ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/5"
          : isConditional
            ? "border-amber-400 bg-amber-50/60 dark:bg-amber-500/5"
            : isRejected
              ? "border-rose-400 bg-rose-50/60 dark:bg-rose-500/5"
              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${
          isApproved
            ? "bg-emerald-500"
            : isConditional
              ? "bg-amber-500"
              : isRejected
                ? "bg-rose-500"
                : "bg-slate-400"
        }`}
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white ${
              isApproved
                ? "bg-emerald-500"
                : isConditional
                  ? "bg-amber-500"
                  : isRejected
                    ? "bg-rose-500"
                    : "bg-slate-500"
            }`}
          >
            {isApproved ? "OK" : isConditional ? "!" : isRejected ? "NO" : "-"}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Lender Decision
            </p>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lenderName || "Lender"}
            </h3>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {reviewStatus === "DECLINED" ? "REJECTED" : reviewStatus}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        {review.approvedAmount != null && review.approvedAmount !== "" && (
          <div>
            <p className="mb-1 text-xs text-slate-500">Approved Amount</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              ${Number(review.approvedAmount).toLocaleString()}
            </p>
          </div>
        )}
        {review.interestRate != null && review.interestRate !== "" && (
          <div>
            <p className="mb-1 text-xs text-slate-500">Interest Rate</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {review.interestRate}%
            </p>
          </div>
        )}
        {review.reviewedAt && (
          <div>
            <p className="mb-1 text-xs text-slate-500">Reviewed On</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {new Date(review.reviewedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {review.notes && (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
          <p className="mb-1 text-xs text-slate-500">Notes</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {review.notes}
          </p>
        </div>
      )}

      {isFundedLender ? (
        <div className="mt-4 border-t border-emerald-200 pt-4 dark:border-emerald-900/40">
          <span className="inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Funded Lender
          </span>
        </div>
      ) : null}

      {canMarkFunded &&
      isApproved &&
      applicationLenderId &&
      onMarkFunded &&
      !isFundedLender ? (
        <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onMarkFunded(applicationLenderId)}
            disabled={markingFundedId === applicationLenderId}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {markingFundedId === applicationLenderId
              ? "Marking as Funded..."
              : "Select & Mark as Funded"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AccordionSection({
  title,
  icon,
  fields,
  defaultOpen = false,
  filledCount,
}: {
  title: string;
  icon: ReactNode;
  fields: SubmissionDetailField[];
  defaultOpen?: boolean;
  filledCount: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <motion.section
      layout
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/40"
      >
        {icon}
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span>
            {filledCount} filled / {fields.length}
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
          >
            <ChevronRight size={14} />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </motion.section>
  );
}

export default function SubmissionDetailsView({
  submissionDetail,
  fields,
  formatSubmissionStatus,
  getStatusChip,
  formatCompactAmount,
  loanAmount,
  ltv,
  ltc,
  arv,
  dscr,
  netWorth,
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
    submissionDetail?.status === "FUNDED";

  const { sections, signatureField } = groupSubmissionFieldsForDisplay(fields);
  const loanProductField = fields.find(
    (field) => field.fieldKey === "loanProductCode",
  );
  const loanProductCode = loanProductField
    ? String(parseSubmissionFieldValue(loanProductField.value) ?? "")
    : "";
  const loanProductName =
    submissionDetail?.loanProduct?.name ||
    PRODUCT_LABELS[loanProductCode] ||
    loanProductCode.replace(/_/g, " ") ||
    "—";

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

  // Search state + filtering
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => {
        const matchedFields = section.fields.filter((field) => {
          const label = getSubmissionFieldLabel(field).toLowerCase();
          const value = formatSubmissionFieldValue(field)
            .toString()
            .toLowerCase();
          const key = (field.fieldKey || "").toLowerCase();
          return (
            label.includes(q) || value.includes(q) || key.includes(q)
          );
        });
        return { ...section, fields: matchedFields };
      })
      .filter((section) => section.fields.length > 0);
  }, [sections, searchQuery]);

  const totalMatchedFields = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.fields.length, 0),
    [filteredSections],
  );

  return (
    <div className="space-y-6">
      {!showMarkFundedActions &&
      markFundedBlockedReason &&
      hasApprovedLender &&
      !isApplicationFunded ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <p className="font-semibold">Mark as Funded unavailable</p>
          <p className="mt-1">{markFundedBlockedReason}</p>
        </div>
      ) : null}

      {lenderDecisions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {lenderDecisions.map((item, index) => (
            <LenderDecisionCard
              key={`${item.applicationLenderId || item.lenderName}-${index}`}
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-cyan-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Application Overview
            </h2>
          </div>
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

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            label="Application Number"
            value={submissionDetail?.applicationNumber}
          />
          <InfoCard
            label="Status"
            value={
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusChip(submissionDetail?.status)}`}
              >
                {formatSubmissionStatus(submissionDetail?.status)}
              </span>
            }
          />
          <InfoCard label="Loan Product" value={loanProductName} />
          <InfoCard
            label="Borrower"
            value={getBorrowerDisplayNameFromFields(
              fields,
              submissionDetail?.borrowerName,
            )}
          />
          <InfoCard
            label="Entity Type"
            value={getEntityTypeFromFields(fields)}
          />
          <InfoCard
            label="Credit Score"
            value={
              fields.find((field) => field.fieldKey === "creditScore")
                ? formatSubmissionFieldValue(
                    fields.find((field) => field.fieldKey === "creditScore")!,
                  )
                : submissionDetail?.creditScore || "—"
            }
          />
          {submittedDate && (
            <>
              <InfoCard
                label="Submitted Date"
                value={submittedDate.toLocaleDateString()}
              />
              <InfoCard
                label="Submitted Time"
                value={submittedDate.toLocaleTimeString()}
              />
            </>
          )}
        </div>

        <div className="mb-6 rounded-xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Key Loan Metrics
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <Metric
              label="Loan Amount"
              value={formatCompactAmount(Number(loanAmount || 0))}
            />
            <Metric
              label="Monthly Payment"
              value={
                monthlyPaymentDisplay ||
                (monthlyPayment > 0
                  ? `$${monthlyPayment.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}`
                  : "—")
              }
            />
            <Metric label="LTV %" value={ltv ? `${ltv.toFixed(2)}%` : "—"} />
            <Metric label="LTC %" value={ltc ? `${ltc.toFixed(2)}%` : "—"} />
            <Metric label="ARV %" value={arv ? `${arv.toFixed(2)}%` : "—"} />
            <Metric label="DSCR" value={dscr ? dscr.toFixed(2) : "—"} />
            <Metric
              label="Net Worth"
              value={formatCompactAmount(Number(netWorth || 0))}
            />
          </div>
        </div>

        {showEditHint && submissionDetail?.canEdit !== false && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>
              Read-only preview. To edit application details, open the{" "}
              <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                Update Application
              </span>{" "}
              tab.
            </p>
          </div>
        )}

        <div className="mb-4">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all fields…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs text-slate-500">
              {totalMatchedFields === 0 ? (
                <>
                  No fields match{" "}
                  <span className="font-semibold">"{searchQuery}"</span>
                </>
              ) : (
                <>
                  {totalMatchedFields} field{totalMatchedFields === 1 ? "" : "s"}{" "}
                  in {filteredSections.length} section
                  {filteredSections.length === 1 ? "" : "s"} matching{" "}
                  <span className="font-semibold">"{searchQuery}"</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {filteredSections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
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
                  icon={<User size={15} className="text-cyan-600" />}
                  fields={visibleFields}
                  defaultOpen={index === 0 || Boolean(searchQuery.trim())}
                  filledCount={visibleFields.length}
                />
              );
            })
          )}
        </div>

        {signatureField && (
          <div className="mt-8 space-y-4 text-center">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Digital Signature
            </h3>
            <div className="flex justify-center">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
                <img
                  src={String(parseSubmissionFieldValue(signatureField.value))}
                  alt="Digital Signature"
                  className="h-40 object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
