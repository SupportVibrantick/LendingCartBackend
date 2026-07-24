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
  EllipsisVertical,
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

const normalizeStatus = (status?: string) => status?.toUpperCase().trim();

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

  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

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

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
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

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(ROWS_PER_PAGE),
        search: debouncedSearch,
      });

      if (
        decisionFilter &&
        decisionFilter !== "PENDING" &&
        ["CONDITIONAL", "APPROVED", "DECLINED"].includes(decisionFilter)
      ) {
        params.set("decision", decisionFilter);
      }

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load loan pipeline");
      }

      setPagination({
        page: json.page,
        limit: json.limit,
        total: json.total,
        totalPages: json.totalPages,
      });

      let mappedRows: TableRow[] = json.data.map((item: any) => ({
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
      }));

      if (decisionFilter === "PENDING") {
        mappedRows = mappedRows.filter(
          (row) =>
            !row.lenderDecision ||
            ["SENT", "IN_REVIEW", "PENDING"].includes(
              normalizeStatus(row.lenderStatus) || "",
            ),
        );
      }

      setRows(mappedRows);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, decisionFilter]);

useEffect(() => {
  loadSubmissions();
  loadStats();
}, [loadSubmissions, loadStats]);

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

  const isEmpty = !loading && pagination.total === 0;
  const isSearchEmpty = !loading && pagination.total > 0 && rows.length === 0;

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, decisionFilter]);

  useEffect(() => {
    if (currentPage > pagination.totalPages && pagination.totalPages > 0) {
      setCurrentPage(pagination.totalPages);
    }
  }, [pagination.totalPages, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const refreshPipeline = () => {
    loadSubmissions();
    loadStats();
  };

  const multiFileModalPortal =
    multiFileModal.isOpen && multiFileModal.doc
      ? createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold">Select File to Preview</h2>
                  <p className="text-xs text-slate-500">
                    {multiFileModal.doc.documentName} (
                    {multiFileModal.doc.uploadedCount} uploads)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMultiFileModal({ isOpen: false, doc: null })
                  }
                  className="rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                >
                  Back
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {multiFileModal.doc.uploadedFiles?.map((file: any) => (
                    <div
                      key={file.uploadId}
                      className="group rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-500 dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-slate-50 p-2 text-slate-400 dark:bg-slate-800">
                          <FileIcon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-semibold"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </p>
                          <p className="mt-1 text-[10px] uppercase text-slate-500">
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
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 py-2 text-xs font-bold text-blue-600 transition-all hover:bg-blue-600 hover:text-white dark:bg-blue-600/10 dark:text-blue-400"
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
                          className="rounded-lg bg-slate-50 p-2 text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
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
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="max-w-md truncate text-lg font-bold dark:text-white">
                  {previewFile.name}
                </h2>
                <p className="text-xs text-slate-500">{previewFile.type}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(previewFile.url, previewFile.name)
                  }
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold transition hover:bg-slate-200"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Close
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
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-800">
                    <FileIcon size={40} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500">
                    Preview not available for this file type.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(previewFile.url, previewFile.name)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700"
                  >
                    <Download size={18} />
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
      <header className="mx-auto mb-8 max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#18B6B4] dark:text-[#6ee7e5]">
              Loan Pipeline
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {statsLoading ? (
                "Loading pipeline overview..."
              ) : (
                <>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {stats.totalApplications}
                  </span>{" "}
                  total applications ·{" "}
                  <span className="font-semibold text-[#18B6B4] dark:text-[#6ee7e5]">
                    {pagination.total}
                  </span>{" "}
                  matching current view
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#18B6B4]" />
              <input
                value={searchTerm}
                placeholder="Search application # or borrower..."
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#18B6B4] focus:ring-2 focus:ring-[#18B6B4]/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:w-80"
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:border-[#18B6B4] active:scale-95 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw
                size={16}
                className={loading || statsLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Volume",
              value: formatCompactAmount(totalVolume),
              icon: DollarSign,
              tone: "bg-indigo-600",
            },
            {
              label: "Needs Review",
              value: newCount,
              icon: Clock3,
              tone: "bg-blue-600",
            },
            {
              label: "Approved",
              value: approvedCount,
              icon: CheckCircle,
              tone: "bg-emerald-600",
            },
            {
              label: "In Pipeline",
              value: stats.totalApplications,
              icon: FileText,
              tone: "bg-[#18B6B4]",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                  {statsLoading ? (
                    <span className="inline-block h-7 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  ) : (
                    card.value
                  )}
                </h3>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${card.tone}`}
              >
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-[100%] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Applications
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click a row to open the application preview.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {DECISION_FILTERS.map((filter) => {
              const active = decisionFilter === filter.value;
              return (
                <button
                  key={filter.value || "all"}
                  type="button"
                  onClick={() => setDecisionFilter(filter.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "bg-[#18B6B4] text-white shadow-sm"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-[#18B6B4]/40 hover:text-[#18B6B4] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40">
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
                    className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400 last:w-[1%] last:whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: TABLE_COLUMNS }).map((__, cellIndex) => (
                      <td key={cellIndex} className="whitespace-nowrap px-3 py-3">
                        <div className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length > 0 ? (
                rows.map((row) => {
                  return (
                    <tr
                      key={row.applicationLenderId}
                      onClick={() => openApplicationPreview(row)}
                      className="cursor-pointer transition-colors hover:bg-[#18B6B4]/5 dark:hover:bg-[#18B6B4]/10"
                    >
                      <td className="whitespace-nowrap px-3 py-3 align-middle">
                        <span
                          className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200"
                          title={row.applicationNumber}
                        >
                          {row.applicationNumber}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#18B6B4]/10 text-[10px] font-semibold text-[#134E4A] dark:bg-[#18B6B4]/20 dark:text-[#6ee7e5]">
                            {getBorrowerInitials(row.borrowerName)}
                          </div>
                          <span
                            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                            title={`${row.borrowerName} (${formatEntityTypeLabel(row.entityType)})`}
                          >
                            {row.borrowerName}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                          <Building2 size={14} className="shrink-0 text-slate-400" />
                          <span title={row.brokerName}>{row.brokerName}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="inline-flex whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {formatLoanProduct(row.loanType)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200">
                          {formatCompactAmount(row.amount)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${getApplicationStatusColor(row.applicationStatus)}`}
                        >
                          {formatApplicationStatus(row.applicationStatus)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${getApplicationStatusColor(row.lenderDecision || row.lenderStatus)}`}
                        >
                          {formatApplicationStatus(
                            row.lenderDecision || row.lenderStatus,
                          )}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500">
                        {formatShortDate(row.sentAt)}
                      </td>

                      <td
                        className="whitespace-nowrap px-3 py-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="relative flex items-center justify-end gap-1">
                          {/* <button
                            type="button"
                            title="View application"
                            onClick={() => openApplicationPreview(row)}
                            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-1.5 text-[#18B6B4] transition hover:bg-[#18B6B4]/10 dark:border-slate-700"
                          >
                            <Eye size={15} />
                          </button> */}

                          {/* <button
                            type="button"
                            title="Open chat"
                            onClick={() =>
                              navigate("/loan-preview", {
                                state: {
                                  applicationLenderId: row.applicationLenderId,
                                  initialTab: "chat",
                                },
                              })
                            }
                            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <MessageCircle size={15} />
                          </button> */}

                          <button
                            type="button"
                            title="More actions"
                            onClick={(event) => {
                              event.stopPropagation();
                              const rect =
                                event.currentTarget.getBoundingClientRect();
                              setDropdownPos({
                                top: rect.bottom + window.scrollY + 6,
                                left: rect.right - 208,
                              });
                              setActiveDropdown(
                                activeDropdown === row.applicationLenderId
                                  ? null
                                  : row.applicationLenderId,
                              );
                            }}
                            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <EllipsisVertical size={15} />
                          </button>

                            {activeDropdown === row.applicationLenderId &&
                              dropdownPos &&
                              createPortal(
                                <>
                                  {/* Overlay */}
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveDropdown(null)}
                                  />

                                  {/* Dropdown */}
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: dropdownPos.top,
                                      left: dropdownPos.left,
                                    }}
                                    className="w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 backdrop-blur"
                                  >
                                    <button
                                      onClick={() => {
                                        openApplicationPreview(row);
                                        setActiveDropdown(null);
                                      }}
                                      className="mx-1 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-[#0F766E] transition hover:bg-green-100 dark:hover:bg-green-900/20"
                                    >
                                      <Eye size={16} />
                                      Open Application
                                    </button>
                                  </div>
                                </>,
                                document.body,
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={TABLE_COLUMNS}
                      className="px-6 py-20 text-center align-middle"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                          {isEmpty ? (
                            <FileText className="h-6 w-6 text-slate-400" />
                          ) : (
                            <SearchX className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {isEmpty
                            ? "No applications in your pipeline yet"
                            : isSearchEmpty
                              ? "No matches for this filter"
                              : "No applications found"}
                        </h3>
                        <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                          {isEmpty
                            ? "When brokers send deals to your organization, they will appear here."
                            : "Try another search term or clear the active filter."}
                        </p>
                        {(searchTerm || decisionFilter) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm("");
                              setDecisionFilter("");
                            }}
                            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row">
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={16} />
                </button>

                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg px-3 py-1 text-sm transition ${
                      currentPage === page
                        ? "bg-[#18B6B4] text-white"
                        : "border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === pagination.totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

      {multiFileModalPortal}
      {previewFilePortal}
    </div>
  );
}
