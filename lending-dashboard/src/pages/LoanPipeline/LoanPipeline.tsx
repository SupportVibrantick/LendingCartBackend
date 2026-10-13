import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import {
  Eye,
  Search,
  FileText,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FileIcon,
  Download,
  X,
  RefreshCw,
  Building2,
  // MessageCircle,
  SearchX,
  Clock3,
} from "lucide-react";
import { useNavigate } from "react-router";
import {
  buildBorrowerDisplayName,
  DECISION_FILTERS,
  formatApplicationStatus,
  formatCompactAmount,
  formatEntityTypeLabel,
  formatLoanProduct,
  formatShortDate,
  getApplicationStatusColor,
  getBorrowerInitials,
  getPaginationWindow,
  type DecisionFilterValue,
} from "../../lib/loanPipelineUtils";

/* ================= TYPES ================= */
type TableRow = {
  applicationLenderId: string;
  applicationNumber: string;
  borrowerFirstName?: string;
  borrowerLastName?: string;
  borrowerName: string;
  entityType: string;
  loanType: string;
  amount: number;
  lenderStatus: string;
  applicationStatus: string;
  sentAt: string;
  brokerName: string;
  lenderDecision: string;
  pendingDocumentsCount?: number;
  loiGenerated?: boolean;
  loiSentToBroker?: boolean;
};

/* ================= HELPERS ================= */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const TABLE_COLUMNS = 9;
const ROWS_PER_PAGE = 10;

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("lender_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ================= COMPONENT ================= */
export default function LoanPipeline() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [decisionFilter, setDecisionFilter] =
    useState<DecisionFilterValue>("");

  // File Preview State
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  // Multi-file Grid Modal State
  const [multiFileModal, setMultiFileModal] = useState<{
    isOpen: boolean;
    doc: any;
  }>({
    isOpen: false,
    doc: null,
  });

  const [currentPage, setCurrentPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: ROWS_PER_PAGE,
    total: 0,
    totalPages: 1,
  });

  const [stats, setStats] = useState({
    totalVolume: 0,
    newApplications: 0,
    approvedApplications: 0,
    totalApplications: 0,
  });

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to download file");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    }
  };

  const newCount = stats.newApplications;
  const approvedCount = stats.approvedApplications;
  const totalVolume = stats.totalVolume;
  const hasActiveFilters = Boolean(debouncedSearch || decisionFilter);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch(`${API_BASE}/lender/loan-pipeline/stats`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load stats");
      }

      setStats({
        totalVolume: json.data.totalVolume || 0,
        newApplications: json.data.newApplications || 0,
        approvedApplications: json.data.approvedApplications || 0,
        totalApplications: json.data.totalApplications || 0,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);

        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(ROWS_PER_PAGE),
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        if (
          decisionFilter &&
          ["PENDING", "CONDITIONAL", "APPROVED", "DECLINED"].includes(
            decisionFilter,
          )
        ) {
          params.set("decision", decisionFilter);
        }

        const res = await fetch(
          `${API_BASE}/lender/loan-pipeline?${params.toString()}`,
          {
            headers: getAuthHeaders(),
            signal,
          },
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load loan pipeline");
        }

        if (signal?.aborted) return;

        const totalPages = Math.max(Number(json.totalPages) || 1, 1);
        const responsePage = Number(json.page) || currentPage;

        setPagination({
          page: responsePage,
          limit: Number(json.limit) || ROWS_PER_PAGE,
          total: Number(json.total) || 0,
          totalPages,
        });

        if (responsePage !== currentPage && responsePage >= 1) {
          setCurrentPage(responsePage);
        }

        setRows(
          (json.data || []).map((item: any) => ({
            applicationLenderId: item.applicationLenderId,
            applicationNumber: item.applicationNumber,
            borrowerFirstName: item.borrowerFirstName || "",
            borrowerLastName: item.borrowerLastName || "",
            borrowerName: buildBorrowerDisplayName(item),
            entityType:
              item.borrowerEntityType || item.client?.entityType || "-",
            loanType: item.loanProductCode,
            amount: Number(item.amountRequested || 0),
            lenderStatus: item.lenderPipelineStatus || item.lenderStatus,
            applicationStatus: item.applicationStatus,
            sentAt: item.sentAt,
            brokerName: item.broker?.name || "—",
            lenderDecision: item.lenderDecision,
            pendingDocumentsCount: item.pendingDocumentsCount ?? 0,
            loiGenerated: item.loiGenerated,
            loiSentToBroker: item.loiSentToBroker,
          })),
        );
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        toast.error(err.message || "Something went wrong");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [currentPage, debouncedSearch, decisionFilter],
  );

  // Debounce search and reset to page 1 together (avoids page-reset race).
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchTerm.trim();
      setDebouncedSearch((prev) => {
        if (prev !== nextSearch) {
          setCurrentPage(1);
        }
        return nextSearch;
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSubmissions(controller.signal);
    return () => controller.abort();
  }, [loadSubmissions]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const openApplicationPreview = (row: TableRow) => {
    navigate("/loan-preview", {
      state: {
        applicationLenderId: row.applicationLenderId,
        isLoi: row.loiGenerated,
      },
    });
  };

  const pageNumbers = useMemo(
    () => getPaginationWindow(currentPage, pagination.totalPages),
    [currentPage, pagination.totalPages],
  );

  const isEmpty = !loading && pagination.total === 0 && !hasActiveFilters;
  const isSearchEmpty =
    !loading && pagination.total === 0 && hasActiveFilters;

  const refreshPipeline = () => {
    void loadSubmissions();
    void loadStats();
  };

  const multiFileModalPortal =
    multiFileModal.isOpen && multiFileModal.doc
      ? createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#183B57]/40 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 bg-[#183B57]/[0.04] px-5 py-4 dark:border-slate-800 dark:bg-[#183B57]/15">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Select File to Preview
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {multiFileModal.doc.documentName} (
                    {multiFileModal.doc.uploadedCount} uploads)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMultiFileModal({ isOpen: false, doc: null })
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {multiFileModal.doc.uploadedFiles?.map((file: any) => (
                    <div
                      key={file.uploadId}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#183B57]/40 hover:bg-[#183B57]/[0.03] dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#183B57]/10 text-[#183B57]">
                          <FileIcon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </p>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            {file.fileMimeType.split("/")[1] || "FILE"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewFile({
                              url: `${API_BASE}${file.fileUrl}`,
                              type: file.fileMimeType,
                              name: file.fileName,
                            })
                          }
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#183B57] py-2 text-xs font-semibold text-white transition hover:bg-[#122d42]"
                        >
                          <Eye size={14} /> Preview
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownload(
                              `${API_BASE}${file.fileUrl}`,
                              file.fileName,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const previewFilePortal = previewFile
    ? createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#183B57]/50 p-4 backdrop-blur-[2px]">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-[#183B57]/[0.04] px-5 py-3.5 dark:border-slate-800 dark:bg-[#183B57]/15">
              <div className="min-w-0">
                <h2 className="max-w-md truncate text-base font-semibold text-slate-900 dark:text-white">
                  {previewFile.name}
                </h2>
                <p className="text-xs text-slate-500">{previewFile.type}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(previewFile.url, previewFile.name)
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Download size={15} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-hidden bg-slate-100 p-4 dark:bg-slate-950">
              {previewFile.type.startsWith("image/") ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              ) : previewFile.type === "application/pdf" ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="h-full w-full rounded-lg border-none"
                />
              ) : (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#183B57]/10 text-[#183B57]">
                    <FileIcon size={32} />
                  </div>
                  <p className="text-sm text-slate-500">
                    Preview not available for this file type.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(previewFile.url, previewFile.name)
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-[#183B57] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#122d42]"
                  >
                    <Download size={16} />
                    Download instead
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-[#0b1120] dark:text-slate-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-xl bg-[#183B57] text-white">
          <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                Lender Portal
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Loan Pipeline
              </h1>
              <p className="mt-1.5 text-sm text-white/80">
                {statsLoading ? (
                  "Loading pipeline overview..."
                ) : (
                  <>
                    <span className="font-semibold text-white">
                      {stats.totalApplications}
                    </span>{" "}
                    total applications ·{" "}
                    <span className="font-semibold text-white">
                      {pagination.total}
                    </span>{" "}
                    matching current view
                  </>
                )}
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[min(100%,520px)] lg:shrink-0">
              {[
                {
                  label: "Total Volume",
                  value: formatCompactAmount(totalVolume),
                  icon: DollarSign,
                },
                {
                  label: "Needs Review",
                  value: newCount,
                  icon: Clock3,
                },
                {
                  label: "Approved",
                  value: approvedCount,
                  icon: CheckCircle,
                },
                {
                  label: "In Pipeline",
                  value: stats.totalApplications,
                  icon: FileText,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg bg-white/10 px-3 py-2.5 ring-1 ring-white/15"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
                    <card.icon className="h-3 w-3" />
                    {card.label}
                  </div>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums">
                    {statsLoading ? (
                      <span className="inline-block h-5 w-12 animate-pulse rounded bg-white/20" />
                    ) : (
                      card.value
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#183B57]" />
              <input
                value={searchTerm}
                placeholder="Search application # or borrower..."
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#183B57] focus:ring-2 focus:ring-[#183B57]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={refreshPipeline}
              disabled={loading || statsLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#183B57]/40 hover:bg-[#183B57]/5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <RefreshCw
                size={15}
                className={loading || statsLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#183B57]/80">
              Decision
            </span>
            {DECISION_FILTERS.map((filter) => {
              const active = decisionFilter === filter.value;
              return (
                <button
                  key={filter.value || "all"}
                  type="button"
                  onClick={() => {
                    setDecisionFilter(filter.value);
                    setCurrentPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[#183B57] text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-[#183B57]/35 hover:text-[#183B57] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Applications
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click a row to open the application preview.
              </p>
            </div>
            {!loading && pagination.total > 0 && (
              <p className="text-xs font-medium text-slate-500">
                {rows.length} shown
                {pagination.total > rows.length ? ` of ${pagination.total}` : ""}
              </p>
            )}
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0">
              <thead>
                <tr className="bg-[#183B57]/[0.04] dark:bg-[#183B57]/20">
                  {[
                    "Application",
                    "Borrower",
                    "Broker",
                    "Loan Type",
                    "Amount",
                    "Status",
                    "Decision",
                    "Received",
                    "",
                  ].map((label) => (
                    <th
                      key={label || "actions"}
                      className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#183B57]/80 dark:border-slate-700 dark:text-sky-200/80 last:w-[1%]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: TABLE_COLUMNS }).map(
                        (__, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800"
                          >
                            <div className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                          </td>
                        ),
                      )}
                    </tr>
                  ))
                ) : rows.length > 0 ? (
                  rows.map((row) => (
                    <tr
                      key={row.applicationLenderId}
                      onClick={() => openApplicationPreview(row)}
                      className="cursor-pointer transition-colors hover:bg-[#183B57]/[0.04] dark:hover:bg-[#183B57]/15"
                    >
                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 align-middle dark:border-slate-800">
                        <span
                          className="font-mono text-xs font-semibold text-[#183B57] dark:text-sky-300"
                          title={row.applicationNumber}
                        >
                          {row.applicationNumber}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#183B57] text-[10px] font-bold text-white">
                            {getBorrowerInitials(row.borrowerName)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                              title={row.borrowerName}
                            >
                              {row.borrowerName}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              {formatEntityTypeLabel(row.entityType)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                          <Building2
                            size={14}
                            className="shrink-0 text-[#183B57]/70"
                          />
                          <span className="truncate" title={row.brokerName}>
                            {row.brokerName}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                        <span className="inline-flex max-w-[180px] truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {formatLoanProduct(row.loanType)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                        <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                          {formatCompactAmount(row.amount)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${getApplicationStatusColor(row.applicationStatus)}`}
                        >
                          {formatApplicationStatus(row.applicationStatus)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${getApplicationStatusColor(row.lenderDecision || row.lenderStatus)}`}
                        >
                          {formatApplicationStatus(
                            row.lenderDecision || row.lenderStatus,
                          )}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-sm text-slate-500 dark:border-slate-800">
                        {formatShortDate(row.sentAt)}
                      </td>

                      <td
                        className="whitespace-nowrap border-b border-slate-100 px-3 py-3 dark:border-slate-800"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            title="Open application"
                            onClick={() => openApplicationPreview(row)}
                            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-[#183B57] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#122d42]"
                          >
                            <Eye size={14} />
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={TABLE_COLUMNS}
                      className="px-6 py-16 text-center align-middle"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#183B57]/10 text-[#183B57]">
                          {isEmpty ? (
                            <FileText className="h-5 w-5" />
                          ) : (
                            <SearchX className="h-5 w-5" />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {isEmpty
                            ? "No applications in your pipeline yet"
                            : isSearchEmpty
                              ? "No matches for this filter"
                              : "No applications found"}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {isEmpty
                            ? "When brokers send deals to your organization, they will appear here."
                            : "Try another search term or clear the active filter."}
                        </p>
                        {(searchTerm || decisionFilter) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm("");
                              setDebouncedSearch("");
                              setDecisionFilter("");
                              setCurrentPage(1);
                            }}
                            className="mt-4 rounded-lg bg-[#183B57] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#122d42]"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-[#183B57]/[0.03] px-4 py-3.5 dark:border-slate-800 dark:bg-[#183B57]/10 md:flex-row">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {(currentPage - 1) * pagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {Math.min(currentPage * pagination.limit, pagination.total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {pagination.total}
                </span>
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="rounded-lg border border-slate-200 bg-white p-2 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <ChevronLeft size={16} />
                </button>

                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ${
                      currentPage === page
                        ? "bg-[#183B57] text-white"
                        : "border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === pagination.totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="rounded-lg border border-slate-200 bg-white p-2 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {multiFileModalPortal}
      {previewFilePortal}
    </div>
  );
}
