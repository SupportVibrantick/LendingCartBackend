import { Eye, FileText, User } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
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
  submittedDate?: Date | null;
  showEditHint?: boolean;
  canMarkFunded?: boolean;
  markFundedBlockedReason?: string | null;
  markingFundedId?: string | null;
  onMarkFunded?: (applicationLenderId: string) => void | Promise<void>;
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {getSubmissionFieldLabel(field)}
      </label>
      <div
        aria-readonly="true"
        className="cursor-default select-none break-words rounded-lg border border-dashed border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
      >
        {formatSubmissionFieldValue(field)}
      </div>
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

function SectionBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/50">
        {icon}
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
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
  submittedDate,
  showEditHint = true,
  canMarkFunded = false,
  markFundedBlockedReason = null,
  markingFundedId = null,
  onMarkFunded,
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
        { lenderStatus: item.lenderStatus, latestReview: item.review, reviews: [item.review] },
        item.review,
      ) === "APPROVED",
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <SectionBlock
          title="Application Overview"
          icon={<FileText size={16} className="text-cyan-600" />}
        >
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

          <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-5 dark:border-blue-900/30 dark:bg-blue-950/20">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Key Loan Metrics
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Metric
                label="Loan Amount"
                value={formatCompactAmount(Number(loanAmount || 0))}
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
        </SectionBlock>

        {showEditHint && submissionDetail?.canEdit !== false && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
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

        <div className="mt-6 space-y-6">
          {sections.map((section) => (
            <motion.section
              key={section.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                <User size={15} className="text-violet-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {section.title}
                </h3>
                <span className="ml-auto text-xs text-slate-400">
                  {section.fields.length} field
                  {section.fields.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                {section.fields.map((field) => (
                  <FieldItem
                    key={`${section.id}-${field.fieldKey}-${field.fieldId || ""}`}
                    field={field}
                  />
                ))}
              </div>
            </motion.section>
          ))}
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
