import { useEffect, useState } from "react";
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
  Building2,
} from "lucide-react";

/* ================= TYPES ================= */
type LenderItem = {
  lenderOrgId: string;
  lenderName: string;
  lenderProduct: string;
  lenderStatus: string;
  sentAt: string;
};

type TableRow = {
  applicationId: string;
  applicationNumber: string;
  borrowerName: string;
  entityType: string;
  loanType: string;
  amount: number | null;
  applicationStatus: string;
  brokerName: string;
  lenderStatus: string;
  sentAt: string | null;
  lenders: LenderItem[];
  createdAt: string;
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

const normalizeStatus = (status: string) => {
  if (!status) return "";
  return status.replace("LENDER_", "").toUpperCase();
};

const getApplicationStatusColor = (status: string) => {
  if (!status) return "bg-slate-100 text-slate-700";

  const cleaned = status.replace("LENDER_", "");

  switch (cleaned) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";

    case "DECLINED":
    case "REJECTED":
      return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";

    case "IN_REVIEW":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";

    case "SENT":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";

    case "PENDING":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";

    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("admin_token");
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
  const [viewLenders, setViewLenders] = useState<LenderItem[] | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

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

  const formatStatus = (status: string) => {
    if (!status) return "-";

    const cleaned = status.replace("LENDER_", "");

    return cleaned
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

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

  const newCount = rows.filter(
    (r) =>
      r.applicationStatus === "IN_REVIEW" || r.applicationStatus === "SENT",
  ).length;

  const approvedCount = rows.filter((r) => {
    const status = normalizeStatus(r.applicationStatus);
    return status === "APPROVED" || status === "APPROVE";
  }).length;

  const totalVolume = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const fetchApplicationDetail = async (applicationId: string) => {
    try {
      setDetailLoading(true);
      setViewSubmissionId(applicationId);

      const res = await fetch(
        `${API_BASE}/admin/loan-pipeline/${applicationId}`,
        { headers: getAuthHeaders() },
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

  const loadSubmissions = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/admin/loan-pipeline`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load loan pipeline");
      }

      const mappedRows: TableRow[] = json.data.map((item: any) => {
        const lender = item.lenders?.[0]; // first lender

        return {
          applicationId: item.applicationId,
          applicationNumber: item.applicationNumber,
          borrowerName: item.client?.legalName || "N/A",
          entityType: item.client?.entityType || "-",
          loanType: item.loanProductCode,
          amount: item.amountRequested ? Number(item.amountRequested) : null,
          applicationStatus: item.status,
          brokerName: item.broker?.name || "-",
          lenderStatus: lender?.lenderStatus || "-",
          sentAt: lender?.sentAt || null,
          createdAt: item.createdAt,
          lenders: item.lenders || [],
        };
      });

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

  const filteredRows = rows.filter(
    (r) =>
      r.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenActionId(null);
    };

    if (openActionId) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openActionId]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 dark:bg-[#0b1120] p-3 text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Header Area */}
      <header className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-[#13538A] dark:text-indigo-600">
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
      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="w-full overflow-hidden">
            <table className="w-full table-auto border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40">
                  {[
                    { label: "Application Id", width: "min-w-[180px]" },
                    { label: "Borrower", width: "w-[150px]" },
                    { label: "Loan Type", width: "w-[150px]" },
                    { label: "Amount", width: "w-[160px]" },
                    { label: "Broker", width: "w-[180px]" },
                    { label: "Application Status", width: "w-[170px]" },
                    { label: "Created At", width: "w-[180px]" },
                    { label: "Lenders", width: "w-[120px]" },
                    { label: "Actions", width: "w-[120px]" },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={`${h.width} px-6 py-4 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 ${
                        h.label === "Application Status" ||
                        h.label === "Loan Type" ||
                        h.label === "Created At"
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
                  paginatedRows.map((row) => (
                    <tr
                      key={row.applicationId}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Application Number */}
                      <td className="px-6 py-4 font-mono text-xs whitespace-nowrap align-middle">
                        <span className="inline-block min-w-[160px]">
                          {row.applicationNumber}
                        </span>
                      </td>

                      {/* Borrower */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {row.borrowerName.slice(0, 10) + "..."}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {row.entityType.slice(0, 15) + "..."}
                          </span>
                        </div>
                      </td>

                      {/* Loan Type */}
                      <td className="px-6 py-4">
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                          {row.loanType}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-800 dark:text-slate-200">
                          {row.amount ? `$${row.amount.toLocaleString()}` : "-"}
                        </span>
                      </td>

                      {/* Broker */}
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                        {row.brokerName.slice(0, 6) + "..."}
                      </td>

                      {/* Application Status */}
                      <td className="px-5 py-2">
                        <div className="flex justify-center">
                          <span
                            className={`
                                                                                inline-flex items-center whitespace-nowrap
                                                                                px-3 py-1 rounded-full text-xs uppercase tracking-wide
                                                                                ${getApplicationStatusColor(row.applicationStatus)}
                                                                           `}
                          >
                            {formatStatus(row.applicationStatus)}
                          </span>
                        </div>
                      </td>

                      {/* Sent Date */}
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>

                      {/* Lenders Button */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setViewLenders(row.lenders)}
                          className="
                                                                relative
                                                                inline-flex items-center justify-center
                                                                w-9 h-9
                                                                rounded-lg
                                                                bg-indigo-50 dark:bg-indigo-500/10 
                                                                text-indigo-600 dark:text-indigo-400 
                                                                hover:bg-indigo-100 dark:hover:bg-indigo-500/20 
                                                                transition-all
                                                                "
                        >
                          <Building2 size={16} />

                          {/* Count Badge */}
                          {row.lenders.length > 0 && (
                            <span
                              className="
                                                                absolute -top-1 -right-1
                                                                text-[10px]
                                                                px-1.5 py-0.5
                                                                rounded-full
                                                                bg-indigo-600 text-white
                                                                dark:bg-indigo-500
                                                            "
                            >
                              {row.lenders.length}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 relative">
                        <div className="relative inline-block text-left">
                          {/* 3 DOT BUTTON */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionId((prev) =>
                                prev === row.applicationId
                                  ? null
                                  : row.applicationId,
                              );
                            }}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                          >
                            <svg
                              className="w-4 h-4 text-slate-600 dark:text-slate-300"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>

                          {/* DROPDOWN MENU */}
                          {openActionId === row.applicationId && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="
          absolute right-0 mt-2 w-48
          bg-white dark:bg-[#0f172a]
          border border-slate-200 dark:border-slate-700
          rounded-xl shadow-xl
          z-50
          animate-in fade-in zoom-in-95 duration-100
        "
                            >
                              <div className="py-2 text-sm">
                                {/* View Details */}
                                <button
                                  onClick={() => {
                                    fetchApplicationDetail(row.applicationId);
                                    setOpenActionId(null);
                                  }}
                                  className="flex items-center gap-3 w-full px-4 py-2 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                                >
                                  <Eye size={16} />
                                  View Details
                                </button>

                                {/* Documents */}
                                {/* <button className="flex items-center justify-between w-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                                  <div className="flex items-center gap-3">
                                    📄 Documents
                                  </div> */}

                                {/* Badge */}
                                {/* {row.lenders.length > 0 && (
                                    <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                                      {row.lenders.length}
                                    </span>
                                  )}
                                </button> */}

                                {/* Request Document */}
                                {/* <button className="flex items-center gap-3 w-full px-4 py-2 text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                                  ✓ Request Document
                                </button> */}

                                {/* Divider */}
                                {/* <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div> */}

                                {/* Reject */}
                                {/* <button className="flex items-center gap-3 w-full px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                                  ✕ Reject
                                </button> */}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
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
                        {/* BASIC INFO */}
                        <div className="grid md:grid-cols-3 gap-6">
                          <InfoCard
                            label="Application Id"
                            value={submissionDetail.applicationNumber}
                          />
                          <InfoCard
                            label="Status"
                            value={submissionDetail.status}
                          />
                          <InfoCard
                            label="Loan Product"
                            value={submissionDetail.loanProductCode}
                          />
                          <InfoCard
                            label="Borrower"
                            value={submissionDetail.client?.legalName}
                          />
                          <InfoCard
                            label="Entity Type"
                            value={submissionDetail.client?.entityType}
                          />
                          <InfoCard
                            label="Broker"
                            value={submissionDetail.brokerOrg?.name}
                          />
                          <InfoCard
                            label="Amount"
                            value={`$${Number(submissionDetail.amountRequested).toLocaleString()}`}
                          />
                          <InfoCard
                            label="Term (Months)"
                            value={submissionDetail.termMonthsRequested}
                          />
                          <InfoCard
                            label="Purpose"
                            value={submissionDetail.purpose}
                          />
                        </div>

                        {/* SUBMISSION FIELDS */}
                        <div>
                          <h3 className="font-semibold mb-4 text-slate-700 dark:text-slate-300">
                            Submission Details
                          </h3>

                          {(() => {
                            const fields =
                              submissionDetail.submissions?.[0]?.fields || [];

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

            {/* ================= LENDERS MODAL ================= */}
            {viewLenders &&
              createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
                  <div className="bg-white dark:bg-[#0f172a] w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
                    {/* HEADER */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Lenders
                      </h2>
                      <button
                        onClick={() => setViewLenders(null)}
                        className="text-sm px-3 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      >
                        Close
                      </button>
                    </div>

                    {/* BODY */}
                    <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                      {viewLenders.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center">
                          No lenders assigned.
                        </p>
                      ) : (
                        viewLenders.map((lender) => (
                          <div
                            key={lender.lenderOrgId}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          >
                            <div className="flex justify-between items-center flex-wrap gap-3">
                              {/* Left */}
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {lender.lenderName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Product: {lender.lenderProduct}
                                </p>
                              </div>

                              {/* Right */}
                              <div className="text-right">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                                                                    ${getApplicationStatusColor(lender.lenderStatus)}`}
                                >
                                  {formatStatus(lender.lenderStatus)}
                                </span>

                                <p className="text-xs text-slate-500 mt-1">
                                  {lender.sentAt
                                    ? new Date(lender.sentAt).toLocaleString()
                                    : "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
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
