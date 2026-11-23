import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getPaginationWindow,
  type DecisionFilterValue,
} from "../../lib/loanPipelineUtils";
import { API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";

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

type PipelineStatsPayload = {
  totalVolume: number;
  newApplications: number;
  approvedApplications: number;
  totalApplications: number;
};

type PipelineListPayload = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: any[];
};

/* ================= HELPERS ================= */
const TABLE_COLUMNS = 8;
const ROWS_PER_PAGE = 10;

// Coalesce identical GETs across React Strict Mode remounts.
let inflightPipelineStats: Promise<PipelineStatsPayload> | null = null;
const inflightPipelineLists = new Map<string, Promise<PipelineListPayload>>();

async function fetchPipelineStats(
  force = false,
): Promise<PipelineStatsPayload> {
  if (!force && inflightPipelineStats) return inflightPipelineStats;

  const request = (async () => {
    const res = await fetch(`${API_BASE}/lender/loan-pipeline/stats`, {
      headers: getLenderAuthHeaders(),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load stats");
    }

    return {
      totalVolume: json.data.totalVolume || 0,
      newApplications: json.data.newApplications || 0,
      approvedApplications: json.data.approvedApplications || 0,
      totalApplications: json.data.totalApplications || 0,
    };
  })().finally(() => {
    if (inflightPipelineStats === request) {
      inflightPipelineStats = null;
    }
  });

  inflightPipelineStats = request;
  return request;
}

async function fetchPipelineList(
  params: URLSearchParams,
  force = false,
): Promise<PipelineListPayload> {
  const key = params.toString();
  if (!force) {
    const existing = inflightPipelineLists.get(key);
    if (existing) return existing;
  }

  const request = (async () => {
    const res = await fetch(
      `${API_BASE}/lender/loan-pipeline?${key}`,
      { headers: getLenderAuthHeaders() },
    );
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load loan pipeline");
    }

    return {
      page: Number(json.page) || 1,
      limit: Number(json.limit) || ROWS_PER_PAGE,
      total: Number(json.total) || 0,
      totalPages: Math.max(Number(json.totalPages) || 1, 1),
      data: Array.isArray(json.data) ? json.data : [],
    };
  })().finally(() => {
    if (inflightPipelineLists.get(key) === request) {
      inflightPipelineLists.delete(key);
    }
  });

  inflightPipelineLists.set(key, request);
  return request;
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
        headers: getLenderAuthHeaders(),
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
  const filtersRef = useRef({
    search: "",
    decision: "" as DecisionFilterValue,
  });

  const mapPipelineRows = useCallback((data: any[]): TableRow[] => {
    return data.map((item: any) => ({
      applicationLenderId: item.applicationLenderId,
      applicationNumber: item.applicationNumber,
      borrowerFirstName: item.borrowerFirstName || "",
      borrowerLastName: item.borrowerLastName || "",
      borrowerName: buildBorrowerDisplayName(item),
      entityType: item.borrowerEntityType || item.client?.entityType || "-",
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
    }));
  }, []);

  const loadStats = useCallback(
    async (options?: { force?: boolean; isActive?: () => boolean }) => {
      const isActive = options?.isActive;
      if (!isActive || isActive()) setStatsLoading(true);

      try {
        const nextStats = await fetchPipelineStats(Boolean(options?.force));
        if (isActive && !isActive()) return;
        setStats(nextStats);
      } catch (err: any) {
        if (isActive && !isActive()) return;
        toast.error(err.message || "Failed to load stats");
      } finally {
        if (!isActive || isActive()) {
          setStatsLoading(false);
        }
      }
    },
    [],
  );

  const loadSubmissions = useCallback(
    async (options?: { force?: boolean; isActive?: () => boolean }) => {
      const isActive = options?.isActive;
      if (!isActive || isActive()) setLoading(true);

      try {
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

        const json = await fetchPipelineList(
          params,
          Boolean(options?.force),
        );
        if (isActive && !isActive()) return;

        setPagination({
          page: json.page,
          limit: json.limit,
          total: json.total,
          totalPages: json.totalPages,
        });

        if (json.page !== currentPage && json.page >= 1) {
          setCurrentPage(json.page);
        }

        setRows(mapPipelineRows(json.data));
      } catch (err: any) {
        if (isActive && !isActive()) return;
        toast.error(err.message || "Something went wrong");
      } finally {
        if (!isActive || isActive()) {
          setLoading(false);
        }
      }
    },
    [currentPage, debouncedSearch, decisionFilter, mapPipelineRows],
  );

  // Debounce search input.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when filters change (without a stale-page fetch).
  useEffect(() => {
    const filtersChanged =
      filtersRef.current.search !== debouncedSearch ||
      filtersRef.current.decision !== decisionFilter;

    if (filtersChanged) {
      filtersRef.current = {
        search: debouncedSearch,
        decision: decisionFilter,
      };
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
    }

    let active = true;
    void loadSubmissions({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [currentPage, debouncedSearch, decisionFilter, loadSubmissions]);

  // Stats are global (not filter-scoped); load once on mount.
  useEffect(() => {
    let active = true;
    void loadStats({ isActive: () => active });
    return () => {
      active = false;
    };
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

  const filteredRows = rows;

  const isEmpty = !loading && pagination.total === 0 && !hasActiveFilters;
  const isSearchEmpty =
    !loading &&
    hasActiveFilters &&
    (pagination.total === 0 || filteredRows.length === 0);

  const refreshPipeline = () => {
    void loadSubmissions({ force: true });
    void loadStats({ force: true });
  };

  const multiFileModalPortal =
    multiFileModal.isOpen && multiFileModal.doc
      ? createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#4C78F5]/40 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 bg-[#4C78F5]/[0.04] px-5 py-4 dark:border-slate-800 dark:bg-[#4C78F5]/15">
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
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#4C78F5]/40 hover:bg-[#4C78F5]/[0.03] dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
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
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#4C78F5] py-2 text-xs font-semibold text-white transition hover:bg-[#3A5FD4]"
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
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#4C78F5]/50 p-4 backdrop-blur-[2px]">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-[#4C78F5]/[0.04] px-5 py-3.5 dark:border-slate-800 dark:bg-[#4C78F5]/15">
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
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
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
                    className="inline-flex items-center gap-2 rounded-lg bg-[#4C78F5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A5FD4]"
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

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setDecisionFilter("");
    setCurrentPage(1);
  };

  const shownCount = loading ? null : filteredRows.length;

  return (
    <div className="space-y-4 text-text-primary dark:text-slate-100">
      <div className="min-w-0">
        <h1 className="ds-page-title">Loan Pipeline</h1>
        <p className="ds-page-subtitle">
          {statsLoading ? (
            "Loading pipeline overview..."
          ) : (
            <>
              Review and open every deal sent to your organization.
              {stats.totalApplications > 0 ? (
                <>
                  {" "}
                  <span className="font-semibold text-brand-500">
                    {stats.totalApplications}
                  </span>{" "}
                  total application
                  {stats.totalApplications === 1 ? "" : "s"}.
                </>
              ) : null}
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          {
            label: "Total Volume",
            value: formatCompactAmount(totalVolume),
            icon: DollarSign,
            tone: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Needs Review",
            value: newCount,
            icon: Clock3,
            tone: "bg-amber-50 text-amber-600",
          },
          {
            label: "Approved",
            value: approvedCount,
            icon: CheckCircle,
            tone: "bg-brand-50 text-brand-600",
          },
          {
            label: "In Pipeline",
            value: stats.totalApplications,
            icon: FileText,
            tone: "bg-sky-50 text-sky-600",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  {card.label}
                </p>
                <p className="mt-1 truncate text-xl font-bold tabular-nums leading-none text-text-primary dark:text-white">
                  {statsLoading ? (
                    <span className="inline-block h-5 w-10 animate-pulse rounded bg-surface" />
                  ) : (
                    card.value
                  )}
                </p>
              </div>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
              >
                <card.icon className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="space-y-3.5 border-b border-border px-5 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold tracking-tight text-text-primary dark:text-white">
                Applications
              </h2>
              <p className="mt-0.5 text-[13px] text-text-secondary">
                Click a row to open the application preview.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {shownCount !== null && (
                <p className="text-[12px] font-medium text-text-secondary">
                  {shownCount} shown
                  {pagination.total > shownCount
                    ? ` of ${pagination.total}`
                    : ""}
                </p>
              )}
              <button
                type="button"
                onClick={refreshPipeline}
                disabled={loading || statsLoading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:bg-surface hover:text-brand-500 disabled:opacity-50 dark:border-slate-700"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw
                  size={14}
                  className={loading || statsLoading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          <div className="group relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-brand-500" />
            <input
              value={searchTerm}
              placeholder="Search applications..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:bg-surface hover:text-text-primary"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-500">
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
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-brand-500 text-white"
                      : "border border-border bg-white text-text-secondary hover:border-brand-200 hover:text-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 text-xs font-semibold text-brand-500 hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="ds-table min-w-[980px] w-full">
            <thead>
              <tr>
                {[
                  "Deal",
                  "Broker",
                  "Program",
                  "Amount",
                  "Stage",
                  "Decision",
                  "Received",
                  "Action",
                ].map((label) => (
                  <th
                    key={label}
                    className={label === "Action" ? "!text-right" : undefined}
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
                        <td key={cellIndex}>
                          <div className="h-4 animate-pulse rounded bg-surface dark:bg-slate-800" />
                        </td>
                      ),
                    )}
                  </tr>
                ))
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr
                    key={row.applicationLenderId}
                    onClick={() => openApplicationPreview(row)}
                    className="cursor-pointer border-l-2 border-transparent transition-colors hover:border-l-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-500/10"
                  >
                    <td>
                      <p className="ds-table-title" title={row.borrowerName}>
                        {row.borrowerName}
                      </p>
                      <p
                        className="ds-table-meta font-mono"
                        title={row.applicationNumber}
                      >
                        {row.applicationNumber}
                        {row.entityType && row.entityType !== "-"
                          ? ` · ${formatEntityTypeLabel(row.entityType)}`
                          : ""}
                      </p>
                    </td>

                    <td>
                      <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-text-secondary dark:text-slate-300">
                        <Building2
                          size={14}
                          className="shrink-0 text-brand-500"
                        />
                        <span className="truncate" title={row.brokerName}>
                          {row.brokerName}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="inline-flex max-w-[160px] truncate rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        {formatLoanProduct(row.loanType)}
                      </span>
                    </td>

                    <td>
                      <span className="ds-table-amount">
                        {formatCompactAmount(row.amount)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getApplicationStatusColor(row.applicationStatus)}`}
                      >
                        {formatApplicationStatus(row.applicationStatus)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getApplicationStatusColor(row.lenderDecision || row.lenderStatus)}`}
                      >
                        {formatApplicationStatus(
                          row.lenderDecision || row.lenderStatus,
                        )}
                      </span>
                    </td>

                    <td className="whitespace-nowrap text-[13px] text-text-primary dark:text-slate-200">
                      {formatShortDate(row.sentAt)}
                    </td>

                    <td
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="Open application"
                        onClick={() => openApplicationPreview(row)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
                      >
                        <Eye size={14} />
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={TABLE_COLUMNS} className="px-6 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                        {isEmpty ? (
                          <FileText className="h-5 w-5" />
                        ) : (
                          <SearchX className="h-5 w-5" />
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-text-primary dark:text-slate-100">
                        {isEmpty
                          ? "No applications in your pipeline yet"
                          : isSearchEmpty
                            ? "No matches for this filter"
                            : "No applications found"}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                        {isEmpty
                          ? "When brokers send deals to your organization, they will appear here."
                          : "Try another search term or clear the active filter."}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && pagination.total > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3.5 dark:border-slate-800 md:flex-row">
            <p className="text-[13px] text-text-secondary">
              Showing{" "}
              <span className="font-semibold text-text-primary">
                {(currentPage - 1) * pagination.limit + 1}
              </span>
              –
              <span className="font-semibold text-text-primary">
                {Math.min(currentPage * pagination.limit, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-text-primary">
                {pagination.total}
              </span>
            </p>

            {pagination.totalPages > 1 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                >
                  <ChevronLeft size={16} />
                </button>

                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-sm font-semibold transition ${
                      currentPage === page
                        ? "bg-brand-500 text-white"
                        : "border border-border bg-white hover:bg-surface dark:border-slate-600 dark:bg-slate-800"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === pagination.totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {multiFileModalPortal}
      {previewFilePortal}
    </div>
  );
}
