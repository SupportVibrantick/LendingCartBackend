import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Phone,
  Search,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import {
  buildLoiPdfUrl,
  formatCurrency,
  formatLoiDate,
  formatLoiStatusLabel,
  formatPercent,
  getLoiStatusChipClass,
  type BrokerLoiListResponse,
  type BrokerLoiRecord,
} from "../../lib/loiUtils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const DEFAULT_LIMIT = 6;

type BrokerLoiPanelProps = {
  applicationId?: string | null;
  apiRole?: "broker" | "loanofficer";
  getAuthHeaders: () => HeadersInit;
  isActive?: boolean;
};

function DetailItem({
  label,
  value,
  icon,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50 ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div
        className={`font-medium text-slate-800 dark:text-slate-100 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LoiGridCard({
  loi,
  onViewDetails,
  onViewPdf,
}: {
  loi: BrokerLoiRecord;
  onViewDetails: (loi: BrokerLoiRecord) => void;
  onViewPdf: (loi: BrokerLoiRecord) => void;
}) {
  const productLabel =
    loi.lenderProduct?.productName ||
    loi.lenderProduct?.loanProductCode?.replace(/_/g, " ") ||
    "—";
  const interestDisplay =
    loi.interestRate != null
      ? formatPercent(loi.interestRate)
      : loi.lenderProduct?.interestRateRange || "—";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-violet-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-violet-500/30">
      <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50/80 to-white px-4 py-3 dark:border-slate-800 dark:from-violet-500/10 dark:to-slate-950">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {loi.lenderName}
              </h3>
              <p className="truncate text-[11px] text-slate-500">{productLabel}</p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getLoiStatusChipClass(loi.reviewStatus || loi.status)}`}
          >
            {formatLoiStatusLabel(loi.reviewStatus || loi.status)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Approved
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
              {formatCurrency(loi.approvedAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Rate
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
              {interestDisplay}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Generated
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {formatLoiDate(loi.generatedAt)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Reviewed By
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
              {loi.reviewedBy?.name || loi.reviewedBy?.email || "—"}
            </p>
          </div>
        </div>

        {loi.notes && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {loi.notes}
          </p>
        )}

        {!!loi.conditions?.length && (
          <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            {loi.conditions.length} condition
            {loi.conditions.length === 1 ? "" : "s"}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onViewDetails(loi)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            View Details
          </button>
          {loi.loiUrl && (
            <button
              type="button"
              onClick={() => onViewPdf(loi)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
            >
              <ExternalLink size={12} />
              PDF
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function LoiDetailModal({
  loi,
  onClose,
  onViewPdf,
}: {
  loi: BrokerLoiRecord;
  onClose: () => void;
  onViewPdf: (loi: BrokerLoiRecord) => void;
}) {
  const productLabel =
    loi.lenderProduct?.productName ||
    loi.lenderProduct?.loanProductCode?.replace(/_/g, " ") ||
    "—";

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {loi.lenderName}
            </h3>
            <p className="text-sm text-slate-500">{productLabel}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getLoiStatusChipClass(loi.status)}`}
              >
                {formatLoiStatusLabel(loi.status)}
              </span>
              {loi.reviewStatus && loi.reviewStatus !== loi.status && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getLoiStatusChipClass(loi.reviewStatus)}`}
                >
                  {formatLoiStatusLabel(loi.reviewStatus)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailItem
              compact
              label="Approved Amount"
              value={formatCurrency(loi.approvedAmount)}
            />
            <DetailItem
              compact
              label="Interest Rate"
              value={
                loi.interestRate != null
                  ? formatPercent(loi.interestRate)
                  : loi.lenderProduct?.interestRateRange || "—"
              }
            />
            <DetailItem
              compact
              label="LOI Generated"
              value={formatLoiDate(loi.generatedAt)}
              icon={<Calendar size={11} />}
            />
            <DetailItem
              compact
              label="Sent To Lender"
              value={formatLoiDate(loi.sentAt)}
              icon={<Calendar size={11} />}
            />
            <DetailItem
              compact
              label="Lender Email"
              value={loi.lenderEmail || "—"}
              icon={<Mail size={11} />}
            />
            <DetailItem
              compact
              label="Lender Phone"
              value={loi.lenderPhone || "—"}
              icon={<Phone size={11} />}
            />
            <DetailItem
              compact
              label="Reviewed By"
              value={loi.reviewedBy?.name || loi.reviewedBy?.email || "—"}
              icon={<User size={11} />}
            />
            <DetailItem
              compact
              label="Last Updated"
              value={formatLoiDate(loi.lastUpdatedAt || loi.reviewedAt)}
              icon={<Calendar size={11} />}
            />
          </div>

          {loi.lenderProduct && (
            <div className="rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Lender Product Terms
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <DetailItem
                  compact
                  label="Loan Range"
                  value={`${formatCurrency(loi.lenderProduct.minLoanAmount)} – ${formatCurrency(loi.lenderProduct.maxLoanAmount)}`}
                />
                <DetailItem
                  compact
                  label="Term"
                  value={
                    loi.lenderProduct.minTermMonths &&
                    loi.lenderProduct.maxTermMonths
                      ? `${loi.lenderProduct.minTermMonths}–${loi.lenderProduct.maxTermMonths} mo`
                      : "—"
                  }
                />
                <DetailItem
                  compact
                  label="Max LTV"
                  value={formatPercent(loi.lenderProduct.maxLtvPercent)}
                />
                <DetailItem
                  compact
                  label="Rate Range"
                  value={loi.lenderProduct.interestRateRange || "—"}
                />
              </div>
            </div>
          )}

          {loi.notes && (
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Lender Notes
              </p>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {loi.notes}
              </p>
            </div>
          )}

          {!!loi.conditions?.length && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Conditions ({loi.conditions.length})
              </p>
              <div className="space-y-1.5">
                {loi.conditions.map((condition) => (
                  <div
                    key={condition.conditionId}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      {condition.description}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getLoiStatusChipClass(condition.status)}`}
                    >
                      {formatLoiStatusLabel(condition.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {loi.loiUrl && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onViewPdf(loi);
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <ExternalLink size={15} />
              View LOI PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrokerLoiPanel({
  applicationId,
  apiRole = "broker",
  getAuthHeaders,
  isActive = true,
}: BrokerLoiPanelProps) {
  const [data, setData] = useState<BrokerLoiListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [previewLoi, setPreviewLoi] = useState<BrokerLoiRecord | null>(null);
  const [detailLoi, setDetailLoi] = useState<BrokerLoiRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchLois = useCallback(
    async (pageNo = 1) => {
      if (!applicationId) return;

      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(pageNo),
          limit: String(DEFAULT_LIMIT),
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        const res = await fetch(
          `${API_BASE}/${apiRole}/loan-pipeline/${applicationId}/lois?${params.toString()}`,
          {
            method: "GET",
            headers: getAuthHeaders(),
          },
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to fetch LOIs");
        }

        setData(json.data);
        setPage(json.data.pagination?.page || pageNo);
      } catch (err: any) {
        toast.error(err.message || "Failed to load LOIs");
      } finally {
        setLoading(false);
      }
    },
    [applicationId, apiRole, debouncedSearch, getAuthHeaders],
  );

  useEffect(() => {
    if (isActive && applicationId) {
      fetchLois(page);
    }
  }, [isActive, applicationId, page, debouncedSearch, fetchLois]);

  const pagination = data?.pagination;
  const previewUrl = previewLoi
    ? buildLoiPdfUrl(API_BASE, previewLoi.loiUrl)
    : null;

  const handleDownload = async () => {
    if (!previewUrl || !previewLoi) return;

    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${previewLoi.lenderName}-LOI.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download LOI");
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Letters of Intent
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Compare lender LOIs at a glance. Open details or PDF per card.
            </p>
            {data?.applicationNumber && (
              <p className="mt-2 text-xs font-medium text-slate-400">
                Application #{data.applicationNumber}
                {data.totalLoiReceived > 0 &&
                  ` · ${data.totalLoiReceived} LOI${data.totalLoiReceived === 1 ? "" : "s"}`}
              </p>
            )}
          </div>

          <div className="relative w-full max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search lender name or email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-violet-500/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-600" />
            Loading LOIs...
          </div>
        ) : !data?.lois?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/10">
              <FileText className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              No LOIs Available
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {debouncedSearch
                ? "No LOIs match your search. Try a different lender name."
                : "No lenders have issued a Letter of Intent for this application yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.lois.map((loi) => (
              <LoiGridCard
                key={loi.applicationLenderId}
                loi={loi}
                onViewDetails={setDetailLoi}
                onViewPdf={setPreviewLoi}
              />
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
              <span className="ml-1 text-slate-400">
                ({pagination.total} total)
              </span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              {Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
                .filter(
                  (pageNo) =>
                    pageNo === 1 ||
                    pageNo === pagination.totalPages ||
                    Math.abs(pageNo - pagination.page) <= 1,
                )
                .map((pageNo, index, pages) => {
                  const prev = pages[index - 1];
                  const showEllipsis = prev && pageNo - prev > 1;

                  return (
                    <span key={pageNo} className="flex items-center gap-2">
                      {showEllipsis && (
                        <span className="px-1 text-slate-400">…</span>
                      )}
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setPage(pageNo)}
                        className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                          pagination.page === pageNo
                            ? "bg-violet-600 text-white"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                        }`}
                      >
                        {pageNo}
                      </button>
                    </span>
                  );
                })}

              <button
                type="button"
                disabled={!pagination.hasNextPage || loading}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1),
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {detailLoi && (
        <LoiDetailModal
          loi={detailLoi}
          onClose={() => setDetailLoi(null)}
          onViewPdf={setPreviewLoi}
        />
      )}

      {previewLoi && previewUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {previewLoi.lenderName} — LOI
                </h3>
                <p className="text-xs text-slate-500">PDF preview</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Download size={15} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLoi(null)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950">
              <iframe
                src={previewUrl}
                title={`${previewLoi.lenderName} LOI`}
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
