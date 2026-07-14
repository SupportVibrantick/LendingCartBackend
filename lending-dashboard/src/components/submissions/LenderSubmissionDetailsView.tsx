import { FileText, User } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
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

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${
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

      <div className="mb-4 flex items-center gap-3">
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
            Your Decision
          </p>
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
            {reviewStatus === "DECLINED" ? "REJECTED" : reviewStatus}
          </p>
        </div>
      </div>

      <div className="grid gap-4 text-sm sm:grid-cols-3">
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
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <p className="mb-1 text-xs text-slate-500">Notes</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {review.notes}
          </p>
        </div>
      )}
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

  return (
    <div className="space-y-6">
      {latestReview && (
        <LenderDecisionCard
          review={latestReview}
          lenderStatus={applicationLender?.status}
        />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <SectionBlock
          title="Application Overview"
          icon={<FileText size={16} className="text-cyan-600" />}
        >
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard
              label="Application Number"
              value={loanApplication?.applicationNumber}
            />
            <InfoCard
              label="Status"
              value={
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getApplicationStatusColor(displayStatus)}`}
                >
                  {formatApplicationStatus(displayStatus)}
                </span>
              }
            />
            <InfoCard
              label="Loan Product"
              value={
                applicationLender?.loanProduct?.name ||
                formatLoanProduct(loanApplication?.loanProductCode)
              }
            />
            <InfoCard
              label="Borrower"
              value={getBorrowerDisplayNameFromFields(
                fields,
                applicationLender?.borrowerName ||
                  loanApplication?.client?.legalName,
              )}
            />
            <InfoCard
              label="Entity Type"
              value={
                getEntityTypeFromFields(fields) !== "—"
                  ? getEntityTypeFromFields(fields)
                  : loanApplication?.client?.entityType || "—"
              }
            />
            <InfoCard
              label="Broker"
              value={loanApplication?.brokerOrg?.name}
            />
            <InfoCard
              label="Broker Email"
              value={loanApplication?.brokerOrg?.email}
            />
            <InfoCard
              label="Credit Score"
              value={
                fields.find((field) => field.fieldKey === "creditScore")
                  ? formatSubmissionFieldValue(
                      fields.find((field) => field.fieldKey === "creditScore")!,
                    )
                  : applicationLender?.creditScore ?? "—"
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
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
        </SectionBlock>

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
