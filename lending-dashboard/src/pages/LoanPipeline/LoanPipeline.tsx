import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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
} from "lucide-react";
import Swal from "sweetalert2";

/* ================= TYPES ================= */
type TableRow = {
  applicationLenderId: string;
  applicationNumber: string;
  borrowerName: string;
  entityType: string;
  loanType: string;
  amount: number;
  lenderStatus: string;
  applicationStatus: string;
  sentAt: string;
  brokerName: string;
  lenderDecision: string;
  pendingDocumentsCount?: number; // ADD THIS
};

/* ================= HELPERS ================= */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const parseValue = (val: string): any => {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const formatApplicationStatus = (status: string) => {
  if (!status) return "-";

  // Remove LENDER_ prefix
  const cleaned = status.replace("LENDER_", "");

  return cleaned
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const getApplicationStatusColor = (status: string) => {
  switch (status) {
    case "LENDER_APPROVED":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";

    case "LENDER_DECLINED":
      return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";

    case "PENDING":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";

    case "IN_REVIEW":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";

    case "SENT":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";

    case "CONDITIONAL":
    case "LENDER_CONDITIONAL":
      return "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400";

    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("lender_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ================= COMPONENT ================= */
export default function LoanPipeline() {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewSubmissionId, setViewSubmissionId] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionModal, setDecisionModal] = useState<{
    type: "APPROVED" | "DECLINED" | null;
    applicationId: string | null;
  }>({
    type: null,
    applicationId: null,
  });

  const [decisionForm, setDecisionForm] = useState({
    approvedAmount: "",
    interestRate: "",
    notes: "",
  });

  // Documents Modal State
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  // const [setSelectedApplicationLenderId] = useState<string | null>(null);

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

  // Find Lenders Modal State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 6;

  const InfoCard = ({ label, value }: { label: string; value: any }) => (
    <div
      className="
    bg-slate-50 
    dark:bg-slate-800/60 
    border border-slate-100 dark:border-slate-700
    p-4 rounded-xl
    transition-colors duration-300
"
    >
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold">{value || "-"}</p>
    </div>
  );

  //     const getDecisionColor = (status: string) => {
  //   switch (status) {
  //     case "APPROVED":
  //       return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  //     case "DECLINED":
  //       return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
  //     default:
  //       return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  //   }
  // };

  const formatFieldKey = (key: string | null | undefined) => {
    if (!key) return "";

    return (
      key
        // camelCase → camel Case
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        // snake_case → snake case
        .replace(/_/g, " ")
        // multiple spaces remove
        .replace(/\s+/g, " ")
        // trim
        .trim()
        // capitalize each word
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  };

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

  const newCount = rows.filter(
    (r) => r.lenderStatus === "PENDING" || r.lenderStatus === "IN_REVIEW",
  ).length;

  const approvedCount = rows.filter(
    (r) => r.lenderStatus === "APPROVED",
  ).length;

  const totalVolume = rows.reduce((sum, r) => sum + r.amount, 0);

  const fetchLenderApplicationDetail = async (applicationLenderId: string) => {
    try {
      setDetailLoading(true);
      setViewSubmissionId(applicationLenderId);

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load application");
      }

      setSubmissionDetail(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load application");
      setViewSubmissionId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchDocuments = async (applicationLenderId: string) => {
    try {
      setDocumentsLoading(true);
      setIsDocumentsModalOpen(true);
      // setSelectedApplicationLenderId(applicationLenderId);

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/lender/applications/${applicationLenderId}/documents`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load documents");
      }

      setDocumentsData(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load documents");
      setIsDocumentsModalOpen(false);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadSubmissions = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/lender/loan-pipeline`, {
        headers: getAuthHeaders(), // lender_token use hoga
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load loan pipeline");
      }

      const mappedRows: TableRow[] = json.data.map((item: any) => ({
        applicationLenderId: item.applicationLenderId,
        applicationNumber: item.applicationNumber,
        borrowerName: item.client?.legalName || "N/A",
        entityType: item.client?.entityType || "-",
        loanType: item.loanProductCode,
        amount: Number(item.amountRequested || 0),
        lenderStatus: item.lenderPipelineStatus || item.lenderStatus,
        applicationStatus: item.applicationStatus,
        sentAt: item.sentAt,
        brokerName: item.broker?.name || "-",
        lenderDecision: item.lenderDecision, // MAP THIS
        pendingDocumentsCount: item.pendingDocumentsCount ?? 0,
      }));

      setRows(mappedRows);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const normalizeStatus = (status?: string) => status?.toUpperCase().trim();

  const canTakeDecision = (status?: string) => {
    const s = normalizeStatus(status);

    return (
      s === "PENDING" ||
      s === "IN_REVIEW" ||
      s === "SENT" ||
      s === "CONDITIONAL" ||
      s === "LENDER_CONDITIONAL"
    );
  };

  const filteredRows = useMemo(() => {
    return rows.filter(
      (r) =>
        r.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [rows, searchTerm]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);

  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleConditionalApproval = async (applicationId: string) => {
    try {
      setLoading(true);
      const payload = {
        decision: "CONDITIONAL",
        notes: "Please upload required documents",
      };

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationId}/decision`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Conditional approval failed");
      }

      toast.success("Application Conditionally Approved");
      loadSubmissions();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDecisionSubmit = async () => {
    try {
      if (!decisionModal.applicationId || !decisionModal.type) return;

      const payload =
        decisionModal.type === "APPROVED"
          ? {
              decision: "APPROVED",
              approvedAmount: Number(decisionForm.approvedAmount),
              interestRate: Number(decisionForm.interestRate),
              notes: decisionForm.notes,
            }
          : {
              decision: "DECLINED",
              notes: decisionForm.notes,
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

      toast.success(
        decisionModal.type === "APPROVED"
          ? "Application Approved"
          : "Application Rejected",
      );

      // Close modal
      setDecisionModal({ type: null, applicationId: null });

      // Reset form
      setDecisionForm({
        approvedAmount: "",
        interestRate: "",
        notes: "",
      });

      // Refresh table
      loadSubmissions();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Header Area */}
      <header className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text">
              Loan Pipeline
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              You have{" "}
              <span className="text-blue-600 dark:text-blue-400">
                {filteredRows.length} active
              </span>{" "}
              applications today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                placeholder="Search by name or company..."
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full md:w-80 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              />
            </div>
            <button
              onClick={loadSubmissions}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all shadow-sm active:scale-95"
            >
              <Loader2
                className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${loading ? "animate-spin text-blue-500" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Quick Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {/* TOTAL VOLUME */}
          <div
            className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Volume
              </p>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                ${totalVolume.toLocaleString()}
              </h3>
            </div>

            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-indigo-600 text-white">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* NEW APPLICATIONS */}
          <div
            className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                New Applications
              </p>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {newCount}
              </h3>
            </div>

            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 text-white">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          {/* APPROVED */}
          <div
            className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Approved
              </p>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {approvedCount}
              </h3>
            </div>

            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Table Container */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto loan-table-scroll">
            <table className="min-w-[1100px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40">
                  {[
                    { label: "Application Id", width: "min-w-[180px]" },
                    { label: "Borrower", width: "w-[220px]" },
                    { label: "Loan Type", width: "w-[130px]" },
                    { label: "Amount", width: "w-[160px]" },
                    { label: "Broker", width: "w-[180px]" },
                    { label: "Application Status", width: "w-[180px]" },
                    { label: "Lender Decision", width: "w-[180px]" },
                    { label: "Received At", width: "w-[180px]" },
                    { label: "Actions", width: "w-[120px]" },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={`${h.width} px-6 py-4 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 ${
                        h.label === "Loan Type" ||
                        h.label === "Application Status"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  /* Professional Skeleton Loader */
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-6 py-5">
                        <div className="flex items-center gap-3 animate-pulse">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
                          <div className="space-y-2">
                            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="h-2 w-20 bg-slate-50 dark:bg-slate-900 rounded" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedRows.length > 0 ? (
                  paginatedRows.map((row) => {
                    const isActionAllowed = canTakeDecision(
                      row.applicationStatus,
                    );

                    return (
                      <tr
                        key={row.applicationLenderId}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        {/* Application Number */}
                        <td className="px-6 py-4 font-mono text-sm whitespace-nowrap align-middle">
                          <span className="inline-block min-w-[160px]">
                            {row.applicationNumber}
                          </span>
                        </td>
                        {/* Borrower */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                              {row.borrowerName.slice(0, 10) + "..."}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {row.entityType.slice(0, 10) + "..."}
                            </span>
                          </div>
                        </td>

                        {/* Loan Type */}
                        <td className="px-5 py-4">
                          <span className="text-[12px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                            {row.loanType}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                            {row.amount > 0
                              ? `$${row.amount.toLocaleString()}`
                              : "-"}
                          </span>
                        </td>

                        {/* Broker */}
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {row.brokerName.slice(0, 6) + "..."}
                        </td>

                        {/* Application Status */}
                        <td className="px-6 py-4">
                          <span
                            className={`
                                                      inline-flex items-center whitespace-nowrap
                                                      px-3 py-1 rounded-full
                                                      text-xs uppercase tracking-wide
                                                      ${getApplicationStatusColor(row.applicationStatus)}
                                                  `}
                          >
                            {formatApplicationStatus(row.applicationStatus)}
                          </span>
                        </td>

                        {/* Lender Decision */}
                        <td className="px-6 py-4">
                          <span
                            className={`
                                                      inline-flex items-center whitespace-nowrap
                                                      px-3 py-1 rounded-full
                                                      text-xs uppercase tracking-wide
                                                      ${getApplicationStatusColor(row.lenderDecision)}
                                                  `}
                          >
                            {formatApplicationStatus(row.lenderDecision)}
                          </span>
                        </td>

                        {/* Sent Date */}
                        <td className="px-5 py-4 text-sm text-slate-500">
                          {new Date(row.sentAt).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="relative flex justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(
                                  activeDropdown === row.applicationLenderId
                                    ? null
                                    : row.applicationLenderId,
                                );
                              }}
                              className="group flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all duration-200 border border-slate-200 dark:border-slate-700 font-medium text-xs"
                            >
                              <EllipsisVertical
                                size={14}
                                className={`transition-transform duration-200 ${activeDropdown === row.applicationLenderId ? "rotate-180" : ""}`}
                              />
                            </button>

                            {activeDropdown === row.applicationLenderId && (
                              <>
                                <div
                                  className="fixed inset-0 z-[100]"
                                  onClick={() => setActiveDropdown(null)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-[101] animate-in fade-in slide-in-from-top-2">
                                  {/* View Action */}
                                  <button
                                    onClick={() => {
                                      fetchLenderApplicationDetail(
                                        row.applicationLenderId,
                                      );
                                      setActiveDropdown(null);
                                    }}
                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                                  >
                                    <Eye size={16} />
                                    View Details
                                  </button>

                                  {/* Documents Action */}
                                  <button
                                    onClick={() => {
                                      fetchDocuments(row.applicationLenderId);
                                      setActiveDropdown(null);
                                    }}
                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 transition-colors"
                                  >
                                    <FileIcon size={16} />
                                    Documents
                                    {(row.pendingDocumentsCount ?? 0) > 0 && (
                                      <span className="ml-auto bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                        {row.pendingDocumentsCount}
                                      </span>
                                    )}
                                  </button>

                                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                  {/* Approve Action */}
                                  <button
                                    disabled={!isActionAllowed}
                                    onClick={() => {
                                      setActiveDropdown(null);
                                      if (
                                        normalizeStatus(row.lenderDecision) ===
                                        "CONDITIONAL"
                                      ) {
                                        setDecisionModal({
                                          type: "APPROVED",
                                          applicationId:
                                            row.applicationLenderId,
                                        });
                                      } else {
                                        Swal.fire({
                                          title: "Conditional Approval",
                                          text: "Do you want to conditionally approve this application?",
                                          icon: "question",
                                          showCancelButton: true,
                                          confirmButtonText: "Yes, approve",
                                          confirmButtonColor: "#10b981",
                                          cancelButtonColor: "#f43f5e",
                                          background:
                                            document.documentElement.classList.contains(
                                              "dark",
                                            )
                                              ? "#1e293b"
                                              : "#fff",
                                          color:
                                            document.documentElement.classList.contains(
                                              "dark",
                                            )
                                              ? "#f1f5f9"
                                              : "#1e293b",
                                        }).then((result) => {
                                          if (result.isConfirmed) {
                                            handleConditionalApproval(
                                              row.applicationLenderId,
                                            );
                                          }
                                        });
                                      }
                                    }}
                                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                                      isActionAllowed
                                        ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                        : "text-slate-300 cursor-not-allowed"
                                    }`}
                                  >
                                    <CheckCircle size={16} />
                                    {normalizeStatus(row.lenderDecision) ===
                                    "CONDITIONAL"
                                      ? "Final Approval"
                                      : "Conditional Approval"}
                                  </button>

                                  {/* Reject Action */}
                                  <button
                                    disabled={!isActionAllowed}
                                    onClick={() => {
                                      setActiveDropdown(null);
                                      setDecisionModal({
                                        type: "DECLINED",
                                        applicationId: row.applicationLenderId,
                                      });
                                    }}
                                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                                      isActionAllowed
                                        ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                        : "text-slate-300 cursor-not-allowed"
                                    }`}
                                  >
                                    <XCircle size={16} />
                                    Reject
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  /* Professional Empty State */
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-24 text-center align-middle"
                    >
                      <div className="flex flex-col items-center max-w-xs mx-auto">
                        {/* Icon */}
                        <div
                          className={`
                                                        w-14 h-14 
                                                        rounded-2xl 
                                                        flex items-center justify-center 
                                                        mb-5
                                                        border
                                                        ${
                                                          rows.length === 0
                                                            ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                                                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                                        }
                                                    `}
                        >
                          {rows.length === 0 ? (
                            <span className="text-red-500 dark:text-red-400 text-2xl font-bold">
                              ✕
                            </span>
                          ) : (
                            <Search className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {rows.length === 0
                            ? "Currently you have no loan applications"
                            : "No applications found"}
                        </h3>

                        {/* Subtext */}
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          {rows.length === 0
                            ? "Once applications are submitted, they will appear here."
                            : "Try adjusting your search terms and try again."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* ================= PAGINATION ================= */}
            {filteredRows.length > rowsPerPage && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {/* Showing Info */}
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {(currentPage - 1) * rowsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {Math.min(currentPage * rowsPerPage, filteredRows.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {filteredRows.length}
                  </span>{" "}
                  results
                </p>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  {/* Previous */}
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 text-sm rounded-lg transition
                                            ${
                                              currentPage === page
                                                ? "bg-blue-600 text-white"
                                                : "border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }
                                    `}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  {/* Next */}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {decisionModal.type &&
              createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                      <h2 className="text-lg font-bold">
                        {decisionModal.type === "APPROVED"
                          ? "Approve Application"
                          : "Reject Application"}
                      </h2>

                      <button
                        onClick={() =>
                          setDecisionModal({ type: null, applicationId: null })
                        }
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
                              Approved Amount
                            </label>
                            <input
                              type="number"
                              placeholder="Enter approved amount"
                              value={decisionForm.approvedAmount}
                              onChange={(e) =>
                                setDecisionForm({
                                  ...decisionForm,
                                  approvedAmount: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>

                          {/* Interest Rate */}
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Interest Rate (%)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={decisionForm.interestRate}
                              onChange={(e) =>
                                setDecisionForm({
                                  ...decisionForm,
                                  interestRate: e.target.value,
                                })
                              }
                              placeholder="Enter interest rate"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        </>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Notes
                        </label>
                        <textarea
                          rows={4}
                          value={decisionForm.notes}
                          onChange={(e) =>
                            setDecisionForm({
                              ...decisionForm,
                              notes: e.target.value,
                            })
                          }
                          placeholder={
                            decisionModal.type === "APPROVED"
                              ? "Approval notes..."
                              : "Reason for rejection..."
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      {/* Footer Buttons */}
                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          onClick={() =>
                            setDecisionModal({
                              type: null,
                              applicationId: null,
                            })
                          }
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                        >
                          Cancel
                        </button>

                        <button
                          onClick={handleDecisionSubmit}
                          className={`px-4 py-2 rounded-xl text-white font-semibold
    ${
      decisionModal.type === "APPROVED"
        ? "bg-emerald-600 hover:bg-emerald-700"
        : "bg-rose-600 hover:bg-rose-700"
    }
  `}
                        >
                          {decisionModal.type === "APPROVED"
                            ? "Confirm Approval"
                            : "Confirm Rejection"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )}

            {/* ================= VIEW APPLICATION MODAL ================= */}
            {viewSubmissionId &&
              createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4 transition-colors duration-300">
                  <div
                    className="
                                        bg-white 
                                        dark:bg-[#0f172a] 
                                        text-slate-900 
                                        dark:text-slate-100
                                        w-full max-w-5xl max-h-[90vh] overflow-y-auto 
                                        rounded-2xl shadow-2xl 
                                        border border-slate-200 dark:border-slate-800
                                        transition-colors duration-300
                                    "
                  >
                    {/* HEADER */}
                    <div
                      className="
                                                sticky top-0 z-10 
                                                bg-white/95 dark:bg-[#0f172a]/95 
                                                backdrop-blur-md
                                                flex items-center justify-between px-6 py-4 
                                                border-b border-slate-200 dark:border-slate-800
                                            "
                    >
                      <h2 className="text-lg font-bold">Application Details</h2>
                      <button
                        onClick={() => {
                          setViewSubmissionId(null);
                          setSubmissionDetail(null);
                        }}
                        className="text-sm px-3 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      >
                        Close
                      </button>
                    </div>

                    {detailLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
                      </div>
                    ) : submissionDetail ? (
                      <div className="p-6 space-y-8">
                        {/* ===== LENDER REVIEW SUMMARY ===== */}
                        {submissionDetail.lenderReviews?.length > 0 &&
                          (() => {
                            const review = submissionDetail.lenderReviews[0];
                            const reviewStatus =
                              review.reviewStatus ||
                              review.decision ||
                              "PENDING";

                            const isApproved = reviewStatus === "APPROVED";
                            const isRejected =
                              reviewStatus === "DECLINED" ||
                              reviewStatus === "REJECTED";
                            const isConditional =
                              reviewStatus === "CONDITIONAL" ||
                              reviewStatus === "LENDER_CONDITIONAL";

                            return (
                              <div
                                className={`
        relative overflow-hidden rounded-2xl border p-6 mb-8 dark:bg-slate-900 shadow-md
        ${
          isApproved
            ? "border-emerald-200 dark:border-emerald-500/30 bg-[#F7FEFB]"
            : isRejected
              ? "border-rose-200 dark:border-rose-500/30 bg-[#FFF9FA]"
              : isConditional
                ? "border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10"
                : "border-slate-200 dark:border-slate-700"
        }
      `}
                              >
                                {/* Top Accent Bar */}
                                <div
                                  className={`absolute top-0 left-0 right-0 h-1
          ${
            isApproved
              ? "bg-emerald-500"
              : isRejected
                ? "bg-rose-500"
                : isConditional
                  ? "bg-amber-500"
                  : "bg-slate-400"
          }
        `}
                                />

                                {/* Header */}
                                <div className="flex items-center gap-3 mb-6">
                                  <div
                                    className={`
                           flex items-center justify-center h-12 w-12 rounded-xl text-white text-xl font-bold
                            ${
                              isApproved
                                ? "bg-emerald-500 text-white dark:bg-emerald-500/10 dark:text-emerald-400"
                                : isRejected
                                  ? "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                                  : isConditional
                                    ? "bg-amber-600 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }
                        `}
                                  >
                                    {isApproved
                                      ? "✔"
                                      : isRejected
                                        ? "✖"
                                        : isConditional
                                          ? "!"
                                          : "•"}
                                  </div>

                                  <div>
                                    <p className="text-xs uppercase tracking-wider text-slate-400">
                                      Lender Decision
                                    </p>
                                    <h3
                                      className={`text-lg font-bold
                            ${
                              isApproved
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isRejected
                                  ? "text-rose-600 dark:text-rose-400"
                                  : isConditional
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-700 dark:text-slate-200"
                            }
                            `}
                                    >
                                      {reviewStatus}
                                    </h3>
                                  </div>
                                </div>

                                {/* Review Details */}
                                {/* ===== TOP ROW ===== */}
                                <div className="grid md:grid-cols-3 gap-6 text-sm">
                                  {review.approvedAmount && (
                                    <div>
                                      <p className="text-xs text-slate-400 mb-1">
                                        Approved Amount
                                      </p>
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        $
                                        {Number(
                                          review.approvedAmount,
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  )}

                                  {review.interestRate && (
                                    <div>
                                      <p className="text-xs text-slate-400 mb-1">
                                        Interest Rate
                                      </p>
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        {review.interestRate}%
                                      </p>
                                    </div>
                                  )}

                                  {(review.updatedAt || review.createdAt) && (
                                    <div>
                                      <p className="text-xs text-slate-400 mb-1">
                                        Reviewed On
                                      </p>
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        {new Date(
                                          review.updatedAt || review.createdAt,
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* ===== NOTES (FULL WIDTH BELOW) ===== */}
                                {review.notes && (
                                  <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                                    <p className="text-xs text-slate-400 mb-2">
                                      Notes
                                    </p>

                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words text-sm">
                                      {review.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                        {/* BASIC INFO */}
                        <div className="grid md:grid-cols-3 gap-6">
                          <InfoCard
                            label="Application Id"
                            value={
                              submissionDetail.loanApplication
                                ?.applicationNumber
                            }
                          />
                          <InfoCard
                            label="Status"
                            value={submissionDetail.status}
                          />
                          <InfoCard
                            label="Loan Product"
                            value={
                              submissionDetail.loanApplication?.loanProductCode
                            }
                          />
                          <InfoCard
                            label="Borrower"
                            value={
                              submissionDetail.loanApplication?.client
                                ?.legalName
                            }
                          />
                          <InfoCard
                            label="Entity Type"
                            value={
                              submissionDetail.loanApplication?.client
                                ?.entityType
                            }
                          />
                          <InfoCard
                            label="Broker"
                            value={
                              submissionDetail.loanApplication?.brokerOrg?.name
                            }
                          />
                        </div>

                        {/* SUBMISSION FIELDS */}
                        <div>
                          <h3 className="font-semibold mb-4 text-slate-700 dark:text-slate-300">
                            Submission Details
                          </h3>

                          {(() => {
                            const fields =
                              submissionDetail.loanApplication?.submissions?.[0]
                                ?.fields || [];

                            const normalFields = fields.filter(
                              (f: any) => f.fieldKey !== "borrowerSignature",
                            );

                            const signatureField = fields.find(
                              (f: any) => f.fieldKey === "borrowerSignature",
                            );

                            return (
                              <>
                                {/* NORMAL FIELDS */}
                                <div className="grid md:grid-cols-2 gap-4">
                                  {normalFields.map((field: any) => {
                                    const value = parseValue(field.value);

                                    return (
                                      <div
                                        key={field.id}
                                        className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg"
                                      >
                                        <p className="text-xs text-slate-500 mb-1">
                                          {formatFieldKey(field.fieldKey)}
                                        </p>
                                        <p className="text-sm font-medium break-words">
                                          {String(value)}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* SIGNATURE LAST CENTER */}
                                {signatureField && (
                                  <div className="mt-10 flex flex-col items-center">
                                    <p className="text-sm font-semibold mb-3 text-slate-600 dark:text-slate-300">
                                      Borrower Signature
                                    </p>

                                    <div
                                      className="
                                                                                bg-white dark:bg-slate-800
                                                                                p-4 rounded-xl 
                                                                                border border-slate-200 dark:border-slate-700
                                                                                shadow-sm
                                                                            "
                                    >
                                      <img
                                        src={signatureField.value}
                                        alt="Signature"
                                        className="h-28 object-contain"
                                      />
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>,
                document.body,
              )}

            {/* ================= DOCUMENTS MODAL ================= */}
            {isDocumentsModalOpen &&
              createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                      <div>
                        <h2 className="text-lg font-bold">
                          Application Documents
                        </h2>
                        {/* <p className="text-xs text-slate-500">
                          ID: {selectedApplicationLenderId}
                        </p> */}
                      </div>

                      <button
                        onClick={() => {
                          setIsDocumentsModalOpen(false);
                          setDocumentsData(null);
                        }}
                        className="text-sm px-3 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      >
                        Close
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                      {documentsLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
                          <p className="text-sm text-slate-500">
                            Loading documents...
                          </p>
                        </div>
                      ) : documentsData ? (
                        <div className="space-y-6">
                          {/* Summary Bar */}
                          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex-1">
                              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                                Pending Documents
                              </p>
                              <p className="text-xl font-bold text-amber-600">
                                {documentsData.documentsPendingCount}
                              </p>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                                Total Documents
                              </p>
                              <p className="text-xl font-bold">
                                {documentsData.documents?.length || 0}
                              </p>
                            </div>
                          </div>

                          {/* Documents Table */}
                          <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold uppercase text-slate-500">
                                <tr>
                                  <th className="px-4 py-3">Document Name</th>
                                  <th className="px-4 py-3 text-center">
                                    Status
                                  </th>
                                  <th className="px-4 py-3 text-center">
                                    Uploads
                                  </th>
                                  <th className="px-4 py-3 text-right">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {documentsData.documents?.map((doc: any) => (
                                  <tr
                                    key={doc.requirementId}
                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                  >
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-semibold">
                                          {doc.documentName}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          Source: {doc.source}
                                          {doc.isRequired && (
                                            <span className="ml-2 text-rose-500 font-bold">
                                              * Required
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      <span
                                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                          doc.status === "COMPLETED"
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                            : doc.status === "PARTIAL"
                                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                        }`}
                                      >
                                        {doc.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 text-center font-mono text-sm font-bold">
                                      {doc.uploadedCount}
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex justify-end gap-2">
                                        {doc.uploadedCount > 0 ? (
                                          <button
                                            onClick={() => {
                                              if (doc.uploadedCount === 1) {
                                                const file =
                                                  doc.uploadedFiles[0];
                                                setPreviewFile({
                                                  url: `${API_BASE}${file.fileUrl}`,
                                                  type: file.fileMimeType,
                                                  name: file.fileName,
                                                });
                                              } else {
                                                setMultiFileModal({
                                                  isOpen: true,
                                                  doc: doc,
                                                });
                                              }
                                            }}
                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5"
                                            title={
                                              doc.uploadedCount === 1
                                                ? "View Document"
                                                : "View Uploads"
                                            }
                                          >
                                            <Eye size={14} />
                                            {doc.uploadedCount > 1 && (
                                              <span className="text-[10px] font-bold">
                                                ({doc.uploadedCount})
                                              </span>
                                            )}
                                          </button>
                                        ) : (
                                          <span className="text-xs text-slate-400 italic">
                                            No files
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-500">
                          No document data available.
                        </div>
                      )}
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
                  <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
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
                  <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 shrink-0">
                      <div>
                        <h2 className="text-lg font-bold truncate max-w-md">
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
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
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
                          className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
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
          </div>
        </div>
      </div>
    </div>
  );
}
