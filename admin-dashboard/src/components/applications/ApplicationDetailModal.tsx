import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { fetchApplicationDetail } from "../../lib/brokerDetailApi";
import {
  parseFieldValue,
  resolveBorrowerName,
  resolveEntityLabel,
  resolveLoanAmount,
  resolvePurpose,
  resolveTermLabel,
} from "../../lib/loanPipelineUtils";

type LenderItem = {
  lenderOrgId: string;
  lenderName?: string;
  lenderProduct?: string;
  lenderStatus?: string;
  sentAt?: string | null;
  decision?: string | null;
};

type Props = {
  applicationId: string;
  onClose: () => void;
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN: "DSCR",
  BRIDGE_LOAN: "Bridge",
  EQUIPMENT_FINANCE: "Equipment",
};

function formatLoanType(code?: string) {
  if (!code) return "—";
  if (LOAN_TYPE_LABELS[code]) return LOAN_TYPE_LABELS[code];
  return code.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCompactAmount(value: number) {
  if (!value || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status?: string) {
  if (!status) return "Unknown";
  const cleaned = status.replace("LENDER_", "");
  if (cleaned === "DECLINED") return "Rejected";
  if (cleaned === "CLIENT_PENDING") return "Client Pending";
  if (cleaned === "IN_REVIEW") return "In Review";
  return cleaned.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getApplicationStatusColor(status: string) {
  if (!status) return "bg-slate-100 text-slate-700 border-slate-200";

  const cleaned = status.replace("LENDER_", "");

  switch (cleaned) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "DECLINED":
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
    case "IN_REVIEW":
      return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
    case "SUBMITTED":
    case "SENT":
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20";
    case "DRAFT":
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
  }
}

function formatFieldKey(key?: string | null) {
  if (!key) return "";
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors dark:border-slate-700 dark:bg-slate-800/60">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}

export default function ApplicationDetailModal({ applicationId, onClose }: Props) {
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchApplicationDetail(applicationId);
        if (!cancelled) setDetail(json.data);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load application");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId, onClose]);

  const lenders: LenderItem[] =
    detail?.lenders ||
    detail?.applicationLenders?.map((al: any) => ({
      lenderOrgId: al.lenderOrgId,
      lenderName: al.lender?.name,
      lenderProduct: al.lenderProduct?.loanProductCode,
      lenderStatus: al.status,
      sentAt: al.sentAt,
      decision: al.lenderReviews?.[0]?.decision,
    })) ||
    [];

  const fields = detail?.submissions?.[0]?.fields || [];
  const hiddenKeys = new Set(["borrowerSignature", "signature", "applicantSignature"]);
  const normalFields = fields.filter((field: any) => {
    const key = field.builderField?.fieldKey || field.fieldKey;
    return key && !hiddenKeys.has(key);
  });
  const signatureField = fields.find((field: any) => {
    const key = field.builderField?.fieldKey || field.fieldKey;
    return hiddenKeys.has(key);
  });

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/70">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Application Details</h2>
            {detail?.applicationNumber ? (
              <p className="mt-0.5 text-[11px] text-slate-500">{detail.applicationNumber}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#13538A]" />
            </div>
          ) : detail ? (
            <div className="space-y-8 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard label="Application #" value={detail.applicationNumber} />
                <InfoCard label="Status" value={formatStatusLabel(detail.status)} />
                <InfoCard label="Loan Product" value={formatLoanType(detail.loanProductCode)} />
                <InfoCard label="Borrower" value={resolveBorrowerName(detail)} />
                <InfoCard label="Entity" value={resolveEntityLabel(detail) || "—"} />
                <InfoCard label="Broker" value={detail.brokerOrg?.name || "—"} />
                <InfoCard
                  label="Loan Amount Requested"
                  value={
                    resolveLoanAmount(detail) != null
                      ? formatCompactAmount(resolveLoanAmount(detail)!)
                      : "—"
                  }
                />
                <InfoCard label="Term (Months)" value={resolveTermLabel(detail) || "—"} />
                <InfoCard label="Purpose" value={resolvePurpose(detail) || "—"} />
                <InfoCard label="Created" value={formatShortDate(detail.createdAt)} />
                <InfoCard label="Submitted" value={formatShortDate(detail.submittedAt)} />
              </div>

              {lenders.length > 0 ? (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Assigned Lenders
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {lenders.map((lender) => (
                      <div
                        key={lender.lenderOrgId}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {lender.lenderName || "Lender"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatLoanType(lender.lenderProduct)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${getApplicationStatusColor(lender.lenderStatus || "")}`}
                          >
                            {formatStatusLabel(lender.lenderStatus)}
                          </span>
                          {lender.decision ? (
                            <span className="text-[10px] text-slate-500">
                              Decision: {formatStatusLabel(lender.decision)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {detail.documentUploads?.length > 0 ? (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Documents
                  </h3>
                  <div className="space-y-2">
                    {detail.documentUploads.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                              {doc.fileName}
                            </p>
                            <p className="text-xs text-slate-500">{formatShortDate(doc.uploadedAt)}</p>
                          </div>
                        </div>
                        {doc.fileUrl ? (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#13538A] hover:underline"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Submission Details
                </h3>
                {normalFields.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {normalFields.map((field: any) => {
                      const fieldKey = field.builderField?.fieldKey || field.fieldKey;
                      return (
                        <div
                          key={field.id}
                          className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                        >
                          <p className="mb-1 text-xs text-slate-500">{formatFieldKey(fieldKey)}</p>
                          <p className="break-words text-sm font-medium">
                            {parseFieldValue(field.value)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No submission fields available.</p>
                )}

                {signatureField?.value ? (
                  <div className="mt-8 flex flex-col items-center">
                    <p className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Borrower Signature
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <img
                        src={String(signatureField.value)}
                        alt="Signature"
                        className="h-28 object-contain"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
