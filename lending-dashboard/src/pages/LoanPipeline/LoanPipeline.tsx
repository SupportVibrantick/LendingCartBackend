import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { createPortal } from "react-dom";
import {
  Eye,
  Search,
  FileText,
  DollarSign,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
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
  canLenderTakeDecision,
  canShowFinalApprovalAction,
  canShowRejectAction,
  canShowRequestDocumentsAction,
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
import {
  canDecideApplications,
  canGenerateLoi,
  canRequestDocuments,
} from "../../lib/lenderPermissions";

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

type DecisionFormErrors = {
  approvedAmount?: string;
  interestRate?: string;
  notes?: string;
};

function getSwalTheme() {
  const isDark = document.documentElement.classList.contains("dark");

  return {
    background: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#1e293b",
    customClass: {
      popup: "rounded-2xl",
    },
  };
}

/* ================= COMPONENT ================= */
export default function LoanPipeline() {
  const navigate = useNavigate();
  const canDecide = canDecideApplications();
  const canRequestDocs = canRequestDocuments();
  const canCreateLoi = canGenerateLoi();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [decisionFilter, setDecisionFilter] =
    useState<DecisionFilterValue>("");
  const [decisionModal, setDecisionModal] = useState<{
    type: "APPROVED" | "DECLINED" | null;
    applicationId: string | null;
  }>({
    type: null,
    applicationId: null,
  });

  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [decisionForm, setDecisionForm] = useState({
    approvedAmount: "",
    interestRate: "",
    notes: "",
  });
  const [decisionFormErrors, setDecisionFormErrors] = useState<DecisionFormErrors>(
    {},
  );
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  // File Preview State
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  const [loiPreview, setLoiPreview] = useState<string | null>(null);
  const [loiLoading, setLoiLoading] = useState(false);

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

  const handleGenerateLOI = (applicationId: string) => {
    navigate("/loan-preview/?tab=loi", {
      state: {
        applicationLenderId: applicationId,
        initialTab: "loi",
        isLoi: false,
        openLoiForm: true,
      },
    });
  };

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

  const openRequestDocumentsTab = (row: TableRow) => {
    navigate("/loan-preview/?tab=requestDocs", {
      state: {
        applicationLenderId: row.applicationLenderId,
        initialTab: "requestDocs",
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

  // const handleConditionalApproval = async (applicationId: string) => {
  //   try {
  //     setLoading(true);
  //     const payload = {
  //       decision: "CONDITIONAL",
  //       notes: "Please upload required documents",
  //     };

  //     const res = await fetch(
  //       `${API_BASE}/lender/loan-pipeline/${applicationId}/decision`,
  //       {
  //         method: "PATCH",
  //         headers: getAuthHeaders(),
  //         body: JSON.stringify(payload),
  //       },
  //     );

  //     const json = await res.json();

  //     if (!res.ok || !json.success) {
  //       throw new Error(json.message || "Conditional approval failed");
  //     }

  //     toast.success("Application Conditionally Approved");
  //     loadSubmissions();
  //   } catch (err: any) {
  //     toast.error(err.message || "Something went wrong");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const closeDecisionModal = () => {
    setDecisionModal({ type: null, applicationId: null });
    setDecisionForm({
      approvedAmount: "",
      interestRate: "",
      notes: "",
    });
    setDecisionFormErrors({});
    setDecisionSubmitting(false);
  };

  const validateDecisionForm = () => {
    const errors: DecisionFormErrors = {};
    const notes = decisionForm.notes.trim();

    if (!notes) {
      errors.notes = "Notes are required";
    }

    if (decisionModal.type === "APPROVED") {
      const approvedAmount = Number(decisionForm.approvedAmount);
      if (!decisionForm.approvedAmount.trim()) {
        errors.approvedAmount = "Approved amount is required";
      } else if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        errors.approvedAmount = "Enter a valid approved amount greater than 0";
      }

      const interestRate = Number(decisionForm.interestRate);
      if (!decisionForm.interestRate.trim()) {
        errors.interestRate = "Interest rate is required";
      } else if (
        !Number.isFinite(interestRate) ||
        interestRate < 0 ||
        interestRate > 100
      ) {
        errors.interestRate = "Enter a valid interest rate between 0 and 100";
      }
    }

    setDecisionFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDecisionSubmit = async () => {
    if (!decisionModal.applicationId || !decisionModal.type) return;
    if (!validateDecisionForm()) {
      await Swal.fire({
        title: "Missing required fields",
        text: "Please complete all required fields before continuing.",
        icon: "warning",
        confirmButtonColor: "#0F766E",
        ...getSwalTheme(),
      });
      return;
    }

    const isApproval = decisionModal.type === "APPROVED";
    const confirmResult = await Swal.fire({
      title: isApproval ? "Confirm final approval?" : "Confirm rejection?",
      text: isApproval
        ? "This will mark the application as approved."
        : "This will mark the application as rejected.",
      icon: isApproval ? "question" : "warning",
      showCancelButton: true,
      confirmButtonColor: isApproval ? "#059669" : "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: isApproval
        ? "Yes, approve"
        : "Yes, reject",
      cancelButtonText: "Cancel",
      ...getSwalTheme(),
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setDecisionSubmitting(true);

      const payload =
        decisionModal.type === "APPROVED"
          ? {
              decision: "APPROVED",
              approvedAmount: Number(decisionForm.approvedAmount),
              interestRate: Number(decisionForm.interestRate),
              notes: decisionForm.notes.trim(),
            }
          : {
              decision: "DECLINED",
              notes: decisionForm.notes.trim(),
            };

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${decisionModal.applicationId}/decision`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Decision failed");
      }

      closeDecisionModal();

      await Swal.fire({
        title: isApproval ? "Application approved" : "Application rejected",
        text: isApproval
          ? "Final approval has been recorded successfully."
          : "The application has been rejected successfully.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
        ...getSwalTheme(),
      });

      loadSubmissions();
      loadStats();
    } catch (err: any) {
      await Swal.fire({
        title: isApproval ? "Approval failed" : "Rejection failed",
        text: err.message || "Something went wrong",
        icon: "error",
        confirmButtonColor: "#0F766E",
        ...getSwalTheme(),
      });
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const handleViewLOI = async (applicationLenderId: string) => {
    try {
      setLoiLoading(true);

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/view-loi`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch LOI");
      }

      if (!json.data?.loiPath) {
        toast.error("LOI not generated yet");
        return;
      }

      const fileUrl = `${API_BASE}/public${json.data.loiPath}`;

      // SAME METHOD as previewFile
      const fileRes = await fetch(fileUrl, {
        headers: getAuthHeaders(),
      });

      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);

      setPreviewFile({
        url: blobUrl,
        type: "application/pdf",
        name: "Loan-LOI.pdf",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load LOI");
    } finally {
      setLoiLoading(false);
    }
  };

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
                  const decisionContext = {
                    applicationStatus: row.applicationStatus,
                    lenderStatus: row.lenderStatus,
                    lenderDecision: row.lenderDecision,
                  };
                  const canTakeDecision = canLenderTakeDecision(decisionContext);
                  const showRequestDocuments = canShowRequestDocumentsAction({
                    lenderDecision: row.lenderDecision,
                    canRequestDocuments: canRequestDocs,
                    canTakeDecision,
                  });
                  const showFinalApproval = canShowFinalApprovalAction({
                    lenderDecision: row.lenderDecision,
                    canDecide,
                    canTakeDecision,
                  });
                  const showReject = canShowRejectAction({
                    lenderDecision: row.lenderDecision,
                    canDecide,
                    canTakeDecision,
                  });

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
                                    className="w-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 backdrop-blur"
                                  >
                                    {/* App Preview */}
                                    <button
                                      onClick={() => {
                                        openApplicationPreview(row);
                                        setActiveDropdown(null);
                                      }}
                                      className="mx-1 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-blue-600 transition hover:bg-blue-100 dark:hover:bg-blue-900/20"
                                    >
                                      <Eye size={16} />
                                      App Preview
                                    </button>

                                    {/* View */}
                                    {/* <button
                                      onClick={() => {
                                        fetchLenderApplicationDetail(
                                          row.applicationLenderId,
                                        );
                                        setActiveDropdown(null);
                                      }}
                                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm 
text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 
hover:bg-indigo-100 dark:hover:bg-indigo-900/20 
transition rounded-lg mx-1"
                                    >
                                      <Eye size={16} />
                                      View Details
                                    </button> */}

                                    {/* Documents */}
                                    {/* <button
                                      onClick={() => {
                                        fetchDocuments(row.applicationLenderId);
                                        setActiveDropdown(null);
                                      }}
                                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm 
text-amber-600 bg-amber-50/50 dark:bg-amber-900/10 
hover:bg-amber-100 dark:hover:bg-amber-900/20 
transition rounded-lg mx-1"
                                    >
                                      <FileIcon size={16} />
                                      Documents
                                      {(row.pendingDocumentsCount ?? 0) > 0 && (
                                        <span className="ml-auto bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                          {row.pendingDocumentsCount}
                                        </span>
                                      )}
                                    </button> */}

                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                    {/* Generate LOI (only if NOT generated) */}
                                    {canCreateLoi && !row.loiGenerated && (
                                      <button
                                        onClick={() => {
                                          handleGenerateLOI(
                                            row.applicationLenderId,
                                          );
                                          setActiveDropdown(null);
                                        }}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm 
text-purple-600 bg-purple-50/50 dark:bg-purple-900/10 
hover:bg-purple-100 dark:hover:bg-purple-900/20 
transition rounded-lg mx-1"
                                      >
                                        <FileText size={16} />
                                        Generate LOI
                                      </button>
                                    )}

                                    {/* View LOI (only if generated) */}
                                    {row.loiGenerated && (
                                      <button
                                        onClick={() => {
                                          handleViewLOI(
                                            row.applicationLenderId,
                                          );
                                          setActiveDropdown(null);
                                        }}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm 
text-purple-600 bg-purple-50/50 dark:bg-purple-900/10 
hover:bg-purple-100 dark:hover:bg-purple-900/20 
transition rounded-lg mx-1"
                                      >
                                        <Eye size={16} />
                                        View LOI
                                      </button>
                                    )}

                                    {/* Request documents (initial conditional step) */}
                                    {showRequestDocuments && (
                                      <button
                                        onClick={() => {
                                          setActiveDropdown(null);
                                          openRequestDocumentsTab(row);
                                        }}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm 
text-amber-600 bg-amber-50/50 dark:bg-amber-900/10 
hover:bg-amber-100 dark:hover:bg-amber-900/20 
transition rounded-lg mx-1"
                                      >
                                        <FileIcon size={16} />
                                        Request Documents
                                        {(row.pendingDocumentsCount ?? 0) > 0 && (
                                          <span className="ml-auto bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                            {row.pendingDocumentsCount}
                                          </span>
                                        )}
                                      </button>
                                    )}

                                    {/* Final approval after docs requested */}
                                    {showFinalApproval && (
                                      <button
                                        onClick={() => {
                                          setActiveDropdown(null);
                                          setDecisionModal({
                                            type: "APPROVED",
                                            applicationId:
                                              row.applicationLenderId,
                                          });
                                          setDecisionForm({
                                            approvedAmount: "",
                                            interestRate: "",
                                            notes: "",
                                          });
                                          setDecisionFormErrors({});
                                        }}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm rounded-lg mx-1 transition text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20"
                                      >
                                        <CheckCircle size={16} />
                                        Final Approval
                                      </button>
                                    )}

                                    {/* Reject */}
                                    {showReject && (
                                      <button
                                        onClick={() => {
                                          setActiveDropdown(null);
                                          setDecisionModal({
                                            type: "DECLINED",
                                            applicationId:
                                              row.applicationLenderId,
                                          });
                                          setDecisionForm({
                                            approvedAmount: "",
                                            interestRate: "",
                                            notes: "",
                                          });
                                          setDecisionFormErrors({});
                                        }}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm rounded-lg mx-1 transition text-rose-600 bg-rose-50/50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20"
                                      >
                                        <XCircle size={16} />
                                        Reject
                                      </button>
                                    )}
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

        {decisionModal.type &&
              createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                      <h2 className="text-lg font-bold">
                        {decisionModal.type === "APPROVED"
                          ? "Final Approval"
                          : "Reject Application"}
                      </h2>

                      <button
                        onClick={closeDecisionModal}
                        className="text-sm px-3 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      >
                        Close
                      </button>
                    </div>

                    {/* Form */}
                    <div className="p-6 space-y-5">
                      {decisionModal.type === "APPROVED" && (
                        <>
                          {/* Approved Amount */}
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Approved Amount <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              placeholder="Enter approved amount"
                              value={decisionForm.approvedAmount}
                              onChange={(e) => {
                                setDecisionForm({
                                  ...decisionForm,
                                  approvedAmount: e.target.value,
                                });
                                if (decisionFormErrors.approvedAmount) {
                                  setDecisionFormErrors((prev) => ({
                                    ...prev,
                                    approvedAmount: undefined,
                                  }));
                                }
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none ${
                                decisionFormErrors.approvedAmount
                                  ? "border-red-500"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            />
                            {decisionFormErrors.approvedAmount && (
                              <p className="mt-1 text-xs text-red-500">
                                {decisionFormErrors.approvedAmount}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Interest Rate (%) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              required
                              step="0.01"
                              min="0"
                              max="100"
                              value={decisionForm.interestRate}
                              onChange={(e) => {
                                setDecisionForm({
                                  ...decisionForm,
                                  interestRate: e.target.value,
                                });
                                if (decisionFormErrors.interestRate) {
                                  setDecisionFormErrors((prev) => ({
                                    ...prev,
                                    interestRate: undefined,
                                  }));
                                }
                              }}
                              placeholder="Enter interest rate"
                              className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none ${
                                decisionFormErrors.interestRate
                                  ? "border-red-500"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            />
                            {decisionFormErrors.interestRate && (
                              <p className="mt-1 text-xs text-red-500">
                                {decisionFormErrors.interestRate}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={decisionForm.notes}
                          onChange={(e) => {
                            setDecisionForm({
                              ...decisionForm,
                              notes: e.target.value,
                            });
                            if (decisionFormErrors.notes) {
                              setDecisionFormErrors((prev) => ({
                                ...prev,
                                notes: undefined,
                              }));
                            }
                          }}
                          placeholder={
                            decisionModal.type === "APPROVED"
                              ? "Approval notes..."
                              : "Reason for rejection..."
                          }
                          className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none ${
                            decisionFormErrors.notes
                              ? "border-red-500"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        />
                        {decisionFormErrors.notes && (
                          <p className="mt-1 text-xs text-red-500">
                            {decisionFormErrors.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={closeDecisionModal}
                          disabled={decisionSubmitting}
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-60"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={handleDecisionSubmit}
                          disabled={decisionSubmitting}
                          className={`px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-60
    ${
      decisionModal.type === "APPROVED"
        ? "bg-emerald-600 hover:bg-emerald-700"
        : "bg-rose-600 hover:bg-rose-700"
    }
  `}
                        >
                          {decisionSubmitting
                            ? "Processing..."
                            : decisionModal.type === "APPROVED"
                              ? "Confirm Final Approval"
                              : "Confirm Rejection"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )}

            {/* ================= MULTI-FILE GRID MODAL ================= */}
            {multiFileModal.isOpen &&
              multiFileModal.doc &&
              createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                      <div>
                        <h2 className="text-lg font-bold">
                          Select File to Preview
                        </h2>
                        <p className="text-xs text-slate-500">
                          {multiFileModal.doc.documentName} (
                          {multiFileModal.doc.uploadedCount} uploads)
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setMultiFileModal({ isOpen: false, doc: null })
                        }
                        className="text-sm px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      >
                        Back
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {multiFileModal.doc.uploadedFiles?.map((file: any) => (
                          <div
                            key={file.uploadId}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-blue-500 transition-all group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400">
                                <FileIcon size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-sm font-semibold truncate"
                                  title={file.fileName}
                                >
                                  {file.fileName}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase">
                                  {file.fileMimeType.split("/")[1] || "FILE"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() =>
                                  setPreviewFile({
                                    url: `${API_BASE}${file.fileUrl}`,
                                    type: file.fileMimeType,
                                    name: file.fileName,
                                  })
                                }
                                className="flex-1 py-2 text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1"
                              >
                                <Eye size={14} /> Preview
                              </button>
                              <button
                                onClick={() =>
                                  handleDownload(
                                    `${API_BASE}${file.fileUrl}`,
                                    file.fileName,
                                  )
                                }
                                className="p-2 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition-all"
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
              )}

            {/* ================= FILE PREVIEW MODAL ================= */}
            {previewFile &&
              createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                  <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl flex flex-col h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 shrink-0">
                      <div>
                        <h2 className="text-lg font-bold truncate max-w-md dark:text-white">
                          {previewFile.name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {previewFile.type}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleDownload(previewFile.url, previewFile.name)
                          }
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold hover:bg-slate-200 transition"
                        >
                          <Download size={16} />
                          Download
                        </button>
                        <button
                          onClick={() => setPreviewFile(null)}
                          className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
                      {previewFile.type.startsWith("image/") ? (
                        <img
                          src={previewFile.url}
                          alt={previewFile.name}
                          className="max-w-full max-h-full object-contain rounded-lg"
                        />
                      ) : previewFile.type === "application/pdf" ? (
                        <iframe
                          src={previewFile.url}
                          title={previewFile.name}
                          className="w-full h-full rounded-lg border-none"
                        />
                      ) : (
                        <div className="text-center space-y-4">
                          <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                            <FileIcon size={40} className="text-slate-400" />
                          </div>
                          <p className="text-slate-500">
                            Preview not available for this file type.
                          </p>
                          <button
                            onClick={() =>
                              handleDownload(previewFile.url, previewFile.name)
                            }
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
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
              )}

            {loiPreview &&
              createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                  <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl flex flex-col h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                      <h2 className="text-lg font-bold">LOI Preview</h2>

                      <button
                        onClick={() => {
                          URL.revokeObjectURL(loiPreview);
                          setLoiPreview(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                      >
                        Close
                      </button>
                    </div>

                    {/* Loading */}
                    {loiLoading ? (
                      <div className="flex items-center justify-center flex-1">
                        <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
                      </div>
                    ) : (
                      <iframe
                        src={loiPreview}
                        className="w-full flex-1 border-none"
                      />
                    )}
                  </div>
                </div>,
                document.body,
              )}

    </div>
  );
}
