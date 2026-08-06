import { ChevronDown, Eye, FileText, Search, X } from "lucide-react";
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

// ─── Status helpers ────────
function statusLabel(status?: string) {
  if (!status)
    return {
      text: "—",
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    };
  const s = status.toUpperCase();
  if (s === "FUNDED")
    return {
      text: "Funded",
      cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900",
    };
  if (s === "CLIENT_PENDING")
    return {
      text: "Client pending",
      cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900",
    };
  if (s === "SUBMITTED")
    return {
      text: "Submitted",
      cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-900",
    };
  if (s.includes("REJECT") || s.includes("DECLIN"))
    return {
      text: "Declined",
      cls: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900",
    };
  return {
    text: status.replace(/_/g, " "),
    cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
}

// ─── Sub-components ───────

/** A compact label + value pair used in the overview grid */
function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 px-4 border-b border-r border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
        {value ?? "—"}
      </span>
    </div>
  );
}

/** One metric in the KPIs strip — number-forward, label underneath */
function KpiCell({ label, value }: { label: string; value: string }) {
  const isEmpty = !value || value === "—";
  return (
    <div className="flex flex-col gap-1 px-5 py-3.5 border-r border-zinc-100 dark:border-zinc-800 last:border-r-0">
      <span
        className={`text-base font-semibold tabular-nums ${isEmpty ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-100"}`}
      >
        {value || "—"}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
        {label}
      </span>
    </div>
  );
}

/** A single field in accordion body */
function FieldItem({ field }: { field: SubmissionDetailField }) {
  const display = formatSubmissionFieldValue(field);
  const isEmpty = !display || display === "—";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
        {getSubmissionFieldLabel(field)}
      </span>
      <span
        className={`text-sm leading-snug break-words ${isEmpty ? "text-zinc-400 italic" : "text-zinc-900 dark:text-zinc-100 font-medium"}`}
      >
        {isEmpty ? "Not provided" : display}
      </span>
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

/** Collapsible accordion section */
function AccordionSection({
  title,
  fields,
  defaultOpen = false,
  filledCount,
}: {
  title: string;
  icon?: ReactNode;
  fields: SubmissionDetailField[];
  defaultOpen?: boolean;
  filledCount: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
      >
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex-1">
          {title}
        </span>
        <span className="text-xs text-zinc-400 tabular-nums">
          {filledCount} / {fields.length}
        </span>
        <ChevronDown
          size={14}
          className={`text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
            className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 px-4 py-4 bg-white dark:bg-zinc-950">
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

/** Lender decision card — restrained, professional */
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
        : "bg-zinc-300";

  const statusBadgeCls = isApproved
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : isConditional
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : isRejected
        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
        : "bg-zinc-100 text-zinc-600";

  return (
    <div className="relative flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 overflow-hidden">
      {/* top accent line */}
      <div className={`h-0.5 w-full ${accentLine}`} />

      <div className="flex flex-col gap-4 p-5 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-0.5">
              Lender decision
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {lenderName || "Lender"}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeCls}`}
          >
            {reviewStatus === "DECLINED" ? "Rejected" : reviewStatus}
          </span>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {review.approvedAmount != null && review.approvedAmount !== "" && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-0.5">
                Approved amount
              </p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                ${Number(review.approvedAmount).toLocaleString()}
              </p>
            </div>
          )}
          {review.interestRate != null && review.interestRate !== "" && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-0.5">
                Rate
              </p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {review.interestRate}%
              </p>
            </div>
          )}
          {review.reviewedAt && (
            <div className="col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-0.5">
                Reviewed
              </p>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                {new Date(review.reviewedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        {review.notes && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-1">
              Notes
            </p>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {review.notes}
            </p>
          </div>
        )}

        {/* Funded badge or CTA */}
        {isFundedLender ? (
          <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              Funded lender
            </span>
          </div>
        ) : canMarkFunded &&
          isApproved &&
          applicationLenderId &&
          onMarkFunded ? (
          <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => onMarkFunded(applicationLenderId)}
              disabled={markingFundedId === applicationLenderId}
              className="w-full rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

  const loanProductField = fields.find((f) => f.fieldKey === "loanProductCode");
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

  const appStatus = statusLabel(submissionDetail?.status);

  const kpis = [
    {
      label: "Loan amount",
      value: formatCompactAmount(Number(loanAmount || 0)),
    },
    {
      label: "Monthly payment",
      value:
        monthlyPaymentDisplay ||
        (monthlyPayment > 0
          ? `$${monthlyPayment.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
          : "—"),
    },
    { label: "LTV", value: ltv ? `${ltv.toFixed(2)}%` : "—" },
    { label: "LTC", value: ltc ? `${ltc.toFixed(2)}%` : "—" },
    { label: "ARV", value: arv ? `${arv.toFixed(2)}%` : "—" },
    { label: "DSCR", value: dscr ? dscr.toFixed(2) : "—" },
    { label: "Net worth", value: formatCompactAmount(Number(netWorth || 0)) },
  ];

  return (
    <div className="space-y-4">
      {/* ── Blocked funded warning ───── */}
      {!showMarkFundedActions &&
        markFundedBlockedReason &&
        hasApprovedLender &&
        !isApplicationFunded && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
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

      {/* ── Lender decisions ────── */}
      {lenderDecisions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

      {/* ── Main panel ────────── */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-zinc-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Application overview
            </span>
          </div>
          {showPdfDownload && (
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
          )}
        </div>

        {/* Info grid — borderless inner table feel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 border-b border-zinc-100 dark:border-zinc-800">
          <InfoCell
            label="Application number"
            value={submissionDetail?.applicationNumber}
          />
          <InfoCell
            label="Status"
            value={
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${appStatus.cls}`}
              >
                {appStatus.text}
              </span>
            }
          />
          <InfoCell label="Loan product" value={loanProductName} />
          <InfoCell
            label="Borrower"
            value={getBorrowerDisplayNameFromFields(
              fields,
              submissionDetail?.borrowerName,
            )}
          />
          <InfoCell
            label="Entity type"
            value={getEntityTypeFromFields(fields)}
          />
          <InfoCell
            label="Credit score"
            value={
              fields.find((f) => f.fieldKey === "creditScore")
                ? formatSubmissionFieldValue(
                    fields.find((f) => f.fieldKey === "creditScore")!,
                  )
                : submissionDetail?.creditScore || "—"
            }
          />
          {submittedDate && (
            <>
              <InfoCell
                label="Submitted date"
                value={submittedDate.toLocaleDateString()}
              />
              <InfoCell
                label="Submitted time"
                value={submittedDate.toLocaleTimeString()}
              />
            </>
          )}
        </div>

        {/* KPI strip */}
        <div className="border-b border-zinc-100 dark:border-zinc-800">
          <div className="px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
              Key loan metrics
            </span>
          </div>
          <div className="flex flex-wrap divide-x divide-zinc-100 dark:divide-zinc-800">
            {kpis.map((kpi) => (
              <KpiCell key={kpi.label} label={kpi.label} value={kpi.value} />
            ))}
          </div>
        </div>

        {/* Read-only hint */}
        {showEditHint && submissionDetail?.canEdit !== false && (
          <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
            <Eye size={13} className="text-zinc-400 shrink-0" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Read-only preview. To edit, open the{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                Update Application
              </span>{" "}
              tab.
            </p>
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all fields…"
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 pl-8 pr-8 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-1.5 text-xs text-zinc-400">
              {totalMatchedFields === 0 ? (
                <>No fields match "{searchQuery}"</>
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

        {/* Accordion sections */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredSections.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
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

        {/* Digital signature */}
        {signatureField && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-6 text-center">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-4">
              Digital signature
            </p>
            <div className="inline-block border border-zinc-200 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-900">
              <img
                src={String(parseSubmissionFieldValue(signatureField.value))}
                alt="Digital Signature"
                className="h-28 object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
