import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  MapPin,
  Eye,
  Search,
  FileText,
  DollarSign,
  Loader2,
  // TrendingUp,
  // RefreshCcw,
  Building2,
  SearchX,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  // Mail,
  // UserPlus,
} from "lucide-react";

import Swal from "sweetalert2";

/* ================= TYPES ================= */
type SubmissionListItem = {
  submissionId: string;
  status: string;
  submittedOn: string;
  pendingDocumentsCount: number; // ADD THIS
};

type SubmissionField = {
  fieldId: string | null;
  fieldKey: string | null;
  value: string;
  source: "STATIC" | "DYNAMIC";
};

type TableRow = {
  submissionId: string;
  borrowerName: string;
  company: string;
  loanType: string;
  cityState: string;
  country: string;
  amount: number;
  status: string;
  date: string;
  pendingDocumentsCount?: number;
};

type Lender = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string | null;
  loanProductCode: string;
  minFunding: string;
  maxFunding: string;
  minMonths: number;
  maxMonths: number;
  interestRateRange: string;
  fundingSpeedDays?: number;
  summary?: string;
  eligibilityStatus: string;
  lenderProductId: string;
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

const getFieldValue = (fields: SubmissionField[], key: string): any => {
  const field = fields.find((f) => f.fieldKey === key || f.fieldId === key);
  return field ? parseValue(field.value) : undefined;
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ================= COMPONENT ================= */
export default function LoanApplicationsPage() {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewSubmissionId, setViewSubmissionId] = useState<string | null>(null);
  const [lenderSubmissionId, setLenderSubmissionId] = useState<string | null>(
    null,
  );
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Find Lenders Modal State
  const [findLenderModalOpen, setFindLenderModalOpen] = useState(false);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [borrowerSummary, setBorrowerSummary] = useState<any>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentLenders, setSentLenders] = useState<Record<string, boolean>>({});
  const [lenderLoading, setLenderLoading] = useState(false);
  const [lenderSearchQ, setLenderSearchQ] = useState("");
  const [lenderPage, setLenderPage] = useState(1);
  const [lenderLimit, setLenderLimit] = useState(6);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // DOCUMENT MODAL STATE
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  // const [documentSubmissionId, setDocumentSubmissionId] = useState<
  //   string | null
  // >(null);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>(
    {},
  );
  const [previewFiles, setPreviewFiles] = useState<
    Record<string, { url: string; type: string; name: string }[]>
  >({});

  const rowsPerPage = 5;

  const navigate = useNavigate();

  const formatFieldKey = (key: string | null | undefined) => {
    if (!key) return "";

    let cleaned = key
      // remove coBorrower_1_, coBorrower_2_ etc
      .replace(/^coBorrower_\d+_/, "coBorrower_")
      // camelCase → camel Case
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // snake_case → snake case
      .replace(/_/g, " ")
      // multiple spaces remove
      .replace(/\s+/g, " ")
      .trim()
      // capitalize each word
      .replace(/\b\w/g, (char) => char.toUpperCase());

    return cleaned;
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();

    switch (s) {
      case "new":
        return "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";

      case "pending":
        return "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";

      case "submitted":
      case "sent":
        return "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400";

      case "approved":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";

      case "declined":
        return "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400";

      default:
        return "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400";
    }
  };

  const newCount = rows.filter(
    (r) => r.status === "NEW" || r.status === "SUBMITTED",
  ).length;

  const approvedCount = rows.filter((r) => r.status === "APPROVED").length;

  const totalVolume = rows.reduce((sum, r) => sum + r.amount, 0);

  const fetchSubmissionDetail = async (submissionId: string) => {
    try {
      setDetailLoading(true);
      setViewSubmissionId(submissionId);

      const res = await fetch(
        `${API_BASE}/api/public/broker/applications/submissions/${submissionId}`,
      );
      const json = await res.json();

      if (!json.success) throw new Error("Failed to load submission");

      setSubmissionDetail(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load submission");
    } finally {
      setDetailLoading(false);
    }
  };

  /* ================= LENDER FETCHING ================= */
  const fetchLenders = async () => {
    if (!lenderSubmissionId) return;

    setLenderPage(1);
    setLenders([]);
    setBorrowerSummary(null);
    setSentLenders({});
    setImageErrors({});

    setLenderLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/broker/lender-discovery/applications/submissions/${lenderSubmissionId}/eligible`,
        {
          headers: getAuthHeaders(),
          method: "GET",
        },
      );

      const json = await res.json();

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load eligible lenders");
      }

      const data = json.data;
      setBorrowerSummary(data.borrowerData);

      setLenders(
        (data.eligibleLenders || []).map((l: any) => ({
          id: l.lenderOrgId,
          name: l.lenderName,
          email: l.lenderEmail,
          phone: l.lenderPhone,
          profileImage: l.profileImage
            ? `${API_BASE}/public/${l.profileImage}`
            : null,
          loanProductCode: l.loanProductCode,
          minFunding: l.fundingRange?.min,
          maxFunding: l.fundingRange?.max,
          minMonths: l.terms?.minMonths,
          maxMonths: l.terms?.maxMonths,
          interestRateRange: l.interestRateRange,
          fundingSpeedDays: l.lenderProfile?.fundingSpeedDays,
          summary: l.lenderProfile?.summary,
          eligibilityStatus: l.eligible ? "Eligible" : "Rejected",
          lenderProductId: l.lenderProductId,
        })),
      );

      setApplicationId(data.applicationId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load eligible lenders");
    } finally {
      setLenderLoading(false);
    }
  };

  const fetchSubmissionDocuments = async (submissionId: string) => {
    try {
      setDocumentsLoading(true);
      // setDocumentSubmissionId(submissionId);
      setDocumentModalOpen(true);

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load documents");
      }

      setDocumentsData(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch documents");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const sendToLender = async (lenderProductId: string) => {
    if (!lenderSubmissionId || !applicationId) return;

    try {
      setSendingId(lenderProductId);

      const res = await fetch(
        `${API_BASE}/broker/lender-discovery/applications/${applicationId}/submissions/${lenderSubmissionId}/send-to-lenders`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            lenderProductIds: [lenderProductId],
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send");
      }

      toast.success("Submission processed successfully");

      setSentLenders((prev) => ({
        ...prev,
        [lenderProductId]: true,
      }));

      setRows((prevRows) =>
        prevRows.map((row) =>
          row.submissionId === lenderSubmissionId
            ? { ...row, status: "SENT" }
            : row,
        ),
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  useEffect(() => {
    if (findLenderModalOpen && lenderSubmissionId) {
      fetchLenders();
    }
  }, [findLenderModalOpen, lenderSubmissionId]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/public/broker/applications/submissions`,
      );
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load submissions");

      const detailedRows = await Promise.all(
        json.data.map(
          async (item: SubmissionListItem): Promise<TableRow | null> => {
            try {
              const detailRes = await fetch(
                `${API_BASE}/api/public/broker/applications/submissions/${item.submissionId}`,
              );
              const detailJson = await detailRes.json();
              if (!detailJson.success) return null;

              const fields = detailJson.data.fields;

              return {
                submissionId: item.submissionId,
                borrowerName:
                  `${getFieldValue(fields, "borrowerFirstName") || ""} ${
                    getFieldValue(fields, "borrowerLastName") || ""
                  }`.trim(),
                company: getFieldValue(fields, "companyName") || "Individual",
                loanType:
                  getFieldValue(fields, "loanProductCode") || "General Loan",
                cityState: [
                  getFieldValue(fields, "city"),
                  getFieldValue(fields, "state"),
                ]
                  .filter(Boolean)
                  .join(", "),
                country: getFieldValue(fields, "country") || "USA",
                amount: Number(getFieldValue(fields, "amountRequested") || 0),
                status: item.status,
                date: item.submittedOn,
                pendingDocumentsCount: item.pendingDocumentsCount || 0,
              };
            } catch {
              return null;
            }
          },
        ),
      );
      setRows(detailedRows.filter((r): r is TableRow => r !== null));
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (
    submissionId: string,
    requirementId: string,
  ) => {
    const files = selectedFiles[requirementId];

    if (!files || files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    try {
      setUploadingDocId(requirementId);

      const token = sessionStorage.getItem("broker_token");

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents/${requirementId}/upload`,
          {
            method: "POST",
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: formData,
          },
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Upload failed");
        }
      }

      toast.success("All documents uploaded successfully");

      // Reset after success
      setSelectedFiles((prev) => {
        const copy = { ...prev };
        delete copy[requirementId];
        return copy;
      });

      setPreviewFiles((prev) => {
        const copy = { ...prev };
        delete copy[requirementId];
        return copy;
      });

      await fetchSubmissionDocuments(submissionId);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingDocId(null);
    }
  };

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-[14px] font-semibold text-[#2C92D5]">{value}</p>
    </div>
  );

  useEffect(() => {
    loadSubmissions();
  }, []);
  useEffect(() => {
    if (viewSubmissionId || findLenderModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [viewSubmissionId, findLenderModalOpen]);

  const filteredRows = rows.filter(
    (r) =>
      r.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.company.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredLenders = lenders.filter(
    (l) =>
      l.name.toLowerCase().includes(lenderSearchQ.toLowerCase()) ||
      l.email?.toLowerCase().includes(lenderSearchQ.toLowerCase()),
  );

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
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-3 text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Header Area */}
      <header className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold"
            style={{
              color: "var(--primary-color)"
            }}>
              Loan Pipeline
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              You have{" "}
              <span className="text-blue-600 dark:text-blue-400">
                {filteredRows.length} active
              </span>{" "}
              applications today.
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Create Loan Application Button */}
            <button
              onClick={() => navigate("/loan-application")}
              className="px-4 py-2.5 rounded-xl font-medium 
               bg-[#2C92D5] text-white 
               hover:bg-[#2379b3] 
               shadow-sm transition-all active:scale-95 text-xs"
            >
              + Create Loan Application
            </button>

            {/* Search + Reload Section */}
            <div className="flex items-center gap-3 flex-1">
              <div className="relative group flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  placeholder="Search by name or company..."
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full md:w-80 rounded-xl text-sm 
                   bg-white dark:bg-slate-900 
                   border border-slate-200 dark:border-slate-800 
                   shadow-sm focus:ring-2 focus:ring-blue-500/20 
                   focus:border-blue-500 transition-all outline-none"
                />
              </div>

              <button
                onClick={loadSubmissions}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 
                 border border-slate-200 dark:border-slate-800 
                 hover:border-blue-500 transition-all 
                 shadow-sm active:scale-95"
              >
                <Loader2
                  className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${
                    loading ? "animate-spin text-blue-500" : ""
                  }`}
                />
              </button>
            </div>
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
        <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto applications-table-top">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40">
                  {[
                    { label: "Borrower", width: "w-[280px]" },
                    { label: "Loan Info", width: "w-[150px]" },
                    { label: "Location", width: "w-[190px]" },
                    { label: "Amount", width: "w-[140px]" },
                    { label: "Submitted On", width: "w-[190px]" },
                    { label: "Status", width: "w-[130px]" },
                    { label: "Lenders", width: "w-[140px]" },
                    { label: "Action", width: "w-[80px]" },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={`${h.width} px-5 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap`}
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
                      <td colSpan={8} className="px-6 py-5">
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
                ) : filteredRows.length > 0 ? (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.submissionId}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors duration-150"
                    >
                      {/* Borrower - High Emphasis */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold">
                            {row.borrowerName?.charAt(0) || "U"}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-[13px] text-slate-900 dark:text-slate-100 truncate">
                              {(row.borrowerName &&
                              row.borrowerName.length >= 15
                                ? row.borrowerName?.slice(0, 15) + "..."
                                : row.borrowerName) || "Untitled Applicant"}
                            </span>
                            <span className="text-[12px] text-slate-500 dark:text-slate-500 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {row.company.slice(0, 15) + "..."}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Loan Info - Medium Emphasis */}
                      <td className="px-6 py-4">
                        <span className="text-[12px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                          {row.loanType}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4 min-w-[200px]">
                        <div className="flex items-start gap-3">
                          {/* Fixed Icon Wrapper */}
                          <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-[2px]">
                            <MapPin
                              className="w-3 h-3 text-slate-500 dark:text-slate-400"
                              strokeWidth={2.5}
                            />
                          </div>

                          {/* Location Text */}
                          <div className="leading-tight">
                            <div className="text-[13px] text-slate-700 dark:text-slate-300">
                              {row.cityState.slice(0, 15) + "..." || "Global"}
                            </div>

                            {row.country && (
                              <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                                {row.country}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Amount - Monospace for numbers */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13px] text-slate-800 dark:text-slate-200">
                          ${row.amount.toLocaleString()}
                        </span>
                      </td>

                      {/* Submitted Date & Time */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const submitted = new Date(row.date);
                          const formattedDate = submitted.toLocaleDateString();
                          const formattedTime = submitted.toLocaleTimeString();

                          return (
                            <div className="flex flex-col leading-tight">
                              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                {formattedDate}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {formattedTime}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status - Dynamic Vibrant Badges */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider 
      border backdrop-blur-md transition-all duration-500 group-hover:scale-105
      ${getStatusColor(row.status)}
    `}
                        >
                          {/* Animated Status Indicator Dot */}
                          <span className="relative flex h-2 w-2">
                            <span
                              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 bg-current`}
                            ></span>
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 bg-current shadow-[0_0_8px_rgba(255,255,255,0.5)]`}
                            ></span>
                          </span>

                          {row.status === "DECLINED" ? "REJECTED" : row.status}
                        </span>
                      </td>

                      {/* Lenders Button */}
                      <td className="px-2 py-2 whitespace-nowrap w-[70px] text-center">
                        <button
                          onClick={() => {
                            setLenderSubmissionId(row.submissionId);
                            setFindLenderModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center 
               h-8 w-8
               text-white bg-[#2C92D5] hover:bg-[#1672af]
               rounded-lg
               transition-all 
               shadow-sm hover:shadow-md
               active:scale-95"
                        >
                          <Search className="w-4 h-4 stroke-[2.5px]" />
                        </button>
                      </td>

                      {/* Action - Clean & Subtle */}
                      <td className="px-6 py-4 text-center space-x-2 flex">
                        {/* View Details */}
                        <button
                          onClick={() =>
                            fetchSubmissionDetail(row.submissionId)
                          }
                          className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 
               text-blue-600 dark:text-blue-400 
               hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                        >
                          <Eye size={16} />
                        </button>

                        {/* Upload Documents */}
                        <div className="relative inline-block">
                          {/* Notification Badge */}
                          {(row.pendingDocumentsCount ?? 0) > 0 && (
                            <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow animate-pulse">
                              {row.pendingDocumentsCount}
                            </span>
                          )}

                          {/* Upload Documents Button */}
                          <button
                            onClick={() =>
                              fetchSubmissionDocuments(row.submissionId)
                            }
                            className="p-2 rounded-lg 
               bg-emerald-50 dark:bg-emerald-500/10 
               text-emerald-600 dark:text-emerald-400 
               hover:bg-emerald-100 dark:hover:bg-emerald-500/20 
               transition-all"
                          >
                            <FileText size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  /* Professional Empty State */
                  <tr>
                    <td
                      colSpan={8}
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
            {/* ================= APPLICATION PAGINATION ================= */}
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
          </div>
        </div>

        {viewSubmissionId &&
          createPortal(
            <div
              className=" fixed inset-0 z-50
                                            bg-black/40 dark:bg-black/70
                                            backdrop-blur-[1px]
                                            flex items-center justify-center p-4"
            >
              <div
                className="bg-white dark:bg-slate-900
                                            text-slate-900 dark:text-slate-100
                                            rounded-2xl
                                            w-full max-w-7xl max-h-[90vh]
                                            overflow-y-auto
                                            shadow-xl dark:shadow-black/40"
              >
                {/* HEADER */}
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                  <div>
                    <h2 className="font-bold text-lg">Application Details</h2>
                  </div>
                  <button
                    onClick={() => {
                      setViewSubmissionId(null);
                      setSubmissionDetail(null);
                    }}
                    className="text-slate-400 hover:text-red-500 text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* BODY */}
                <div className="p-6 space-y-8">
                  {detailLoading ? (
                    <p className="text-center text-slate-500">Loading…</p>
                  ) : submissionDetail ? (
                    (() => {
                      const signatureField = submissionDetail.fields?.find(
                        (f: any) => f.fieldKey === "borrowerSignature",
                      );

                      /* ===================== YAHAN PASTE KARO ===================== */

                      const allFields = submissionDetail.fields.filter(
                        (f: any) => f.fieldKey !== "borrowerSignature",
                      );

                      const primaryFields: any[] = [];
                      const coBorrowerGroups: Record<string, any[]> = {};
                      const otherFields: any[] = [];

                      allFields.forEach((f: any) => {
                        const key = f.fieldKey || "";

                        if (key.startsWith("coBorrower_")) {
                          const match = key.match(/^coBorrower_(\d+)_/);
                          if (match) {
                            const index = match[1];
                            if (!coBorrowerGroups[index]) {
                              coBorrowerGroups[index] = [];
                            }
                            coBorrowerGroups[index].push(f);
                          }
                        } else if (
                          key.startsWith("borrower") ||
                          key === "city" ||
                          key === "state" ||
                          key === "isBroker"
                        ) {
                          primaryFields.push(f);
                        } else {
                          otherFields.push(f);
                        }
                      });

                      const loanAmount =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "amountRequested",
                          ) ?? 0,
                        ) || 0;

                      const ltv =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "ltvPercentage",
                          ) ?? 0,
                        ) || 0;

                      const ltc =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "ltcPercentage",
                          ) ?? 0,
                        ) || 0;

                      const arv =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "arvPercentage",
                          ) ?? 0,
                        ) || 0;

                      const dscr =
                        Number(
                          getFieldValue(submissionDetail.fields, "dscr") ?? 0,
                        ) || 0;

                      const netWorth =
                        Number(
                          getFieldValue(submissionDetail.fields, "netWorth") ??
                            0,
                        ) || 0;

                      const submittedDate = new Date(
                        submissionDetail.submittedAt,
                      );
                      const formattedDate = submittedDate.toLocaleDateString();
                      const formattedTime = submittedDate.toLocaleTimeString();
                      const reviewsArray =
                        submissionDetail?.lenders?.[0]?.reviews || [];

                      const firstReview =
                        Array.isArray(reviewsArray) && reviewsArray.length > 0
                          ? reviewsArray[0]
                          : null;

                      const FieldItem = ({ field }: { field: any }) => {
                        const parsedValue = parseValue(field.value);

                        return (
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">
                              {formatFieldKey(field.fieldKey)}
                            </label>

                            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border text-sm font-medium break-words">
                              {parsedValue !== undefined && parsedValue !== null
                                ? typeof parsedValue === "boolean"
                                  ? parsedValue
                                    ? "Yes"
                                    : "No"
                                  : String(parsedValue)
                                : "-"}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {firstReview && (
                            <div
                              className={`relative overflow-hidden rounded-2xl border p-6 mb-8 shadow-md
     ${
       firstReview.reviewStatus === "APPROVED"
         ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-500/5"
         : firstReview.reviewStatus === "CONDITIONAL"
           ? "border-amber-400 bg-amber-50/40 dark:bg-amber-500/5"
           : "border-rose-400 bg-rose-50/40 dark:bg-rose-500/5"
     }
    `}
                            >
                              {/* Top Accent Line */}
                              <div
                                className={`absolute top-0 left-0 right-0 h-1
        ${
          firstReview.reviewStatus === "APPROVED"
            ? "bg-emerald-500"
            : firstReview.reviewStatus === "CONDITIONAL"
              ? "bg-amber-500"
              : "bg-rose-500"
        }
      `}
                              />

                              {/* Header Section */}
                              <div className="flex items-center gap-4 mb-6">
                                <div
                                  className={`flex items-center justify-center h-12 w-12 rounded-xl text-white text-xl font-bold
          ${
            firstReview.reviewStatus === "APPROVED"
              ? "bg-emerald-500"
              : firstReview.reviewStatus === "CONDITIONAL"
                ? "bg-amber-500"
                : "bg-rose-500"
          }
        `}
                                >
                                  {firstReview.reviewStatus === "APPROVED"
                                    ? "✓"
                                    : firstReview.reviewStatus === "CONDITIONAL"
                                      ? "!"
                                      : "✕"}
                                </div>

                                <div>
                                  <p className="text-xs uppercase tracking-wider text-slate-500">
                                    Lender Decision
                                  </p>
                                  <h3
                                    className={`text-lg font-bold
           ${
             firstReview.reviewStatus === "APPROVED"
               ? "text-emerald-600 dark:text-emerald-400"
               : firstReview.reviewStatus === "CONDITIONAL"
                 ? "text-amber-600 dark:text-amber-400"
                 : "text-rose-600 dark:text-rose-400"
           }
          `}
                                  >
                                    {firstReview.reviewStatus === "DECLINED"
                                      ? "REJECTED"
                                      : firstReview.reviewStatus}
                                  </h3>
                                </div>
                              </div>

                              {/* Inline Row */}
                              <div className="grid md:grid-cols-4 gap-6 text-sm">
                                {firstReview.approvedAmount && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">
                                      Approved Amount
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      $
                                      {Number(
                                        firstReview.approvedAmount,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                )}

                                {firstReview.interestRate && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">
                                      Interest Rate
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      {firstReview.interestRate}%
                                    </p>
                                  </div>
                                )}

                                {firstReview?.reviewedAt && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">
                                      {firstReview.reviewStatus === "DECLINED"
                                        ? "Rejected On"
                                        : "Reviewed On"}
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      {new Date(
                                        firstReview.reviewedAt,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Notes Full Width Below */}
                              {firstReview.notes && (
                                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-500 mb-2">
                                    Notes
                                  </p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                                    {firstReview.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* STATUS */}

                          <div className="text-sm font-medium">
                            <span className="font-semibold">Status:</span>{" "}
                            {submissionDetail.status === "DECLINED"
                              ? "REJECTED"
                              : submissionDetail.status}
                          </div>

                          {/* STATS BOX */}
                          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
                              <Stat
                                label="Loan Amount"
                                value={`$${loanAmount.toLocaleString()}`}
                              />
                              <Stat
                                label="LTV %"
                                value={ltv ? `${ltv.toFixed(2)}%` : "—%"}
                              />
                              <Stat
                                label="LTC %"
                                value={ltc ? `${ltc.toFixed(2)}%` : "—%"}
                              />
                              <Stat
                                label="ARV %"
                                value={arv ? `${arv.toFixed(2)}%` : "—%"}
                              />
                              <Stat
                                label="DSCR"
                                value={dscr ? dscr.toFixed(2) : "—"}
                              />
                              <Stat
                                label="Net Worth"
                                value={`$${netWorth.toLocaleString()}`}
                              />
                            </div>
                          </div>

                          {/* ALL FIELDS (EXCEPT SIGNATURE) */}
                          <div className="rounded-xl p-6">
                            <div className=" gap-6">
                              <div className="border rounded-xl dark:border-slate-800 p-6 space-y-10">
                                {/* PRIMARY BORROWER */}
                                {primaryFields.length > 0 && (
                                  <div>
                                    <h3 className="text-md font-bold mb-4 border-b pb-2">
                                      Primary Borrower
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      {primaryFields.map(
                                        (f: any, i: number) => (
                                          <FieldItem key={i} field={f} />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* CO BORROWERS */}
                                {Object.keys(coBorrowerGroups).map((index) => (
                                  <div key={index}>
                                    <h3 className="text-md font-bold mb-4 border-b pb-2">
                                      Co Borrower {index}
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      {coBorrowerGroups[index].map(
                                        (f: any, i: number) => (
                                          <FieldItem key={i} field={f} />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* OTHER FIELDS */}
                                {otherFields.length > 0 && (
                                  <div>
                                    <h3 className="text-md font-bold mb-4 border-b pb-2">
                                      Loan Details
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      {otherFields.map((f: any, i: number) => (
                                        <FieldItem key={i} field={f} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* DIGITAL SIGNATURE */}
                          {signatureField && (
                            <div className="text-center space-y-4">
                              <h3
                                className="
      text-sm font-semibold 
      text-slate-700 
      dark:text-slate-300
      transition-colors duration-300
    "
                              >
                                Digital Signature
                              </h3>

                              <div className="flex justify-center">
                                <div
                                  className="
                                        bg-white 
                                        dark:bg-slate-800/70
                                        border border-slate-200 
                                        dark:border-slate-700
                                        rounded-xl 
                                        p-4 
                                        shadow-sm 
                                        transition-colors duration-300"
                                >
                                  <img
                                    src={parseValue(signatureField.value)}
                                    alt="Digital Signature"
                                    className="h-40 object-contain"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SUBMITTED DATE & TIME (LAST) */}
                          <div className="border-t pt-6 text-sm text-slate-600 dark:text-slate-400 flex justify-between">
                            <div>
                              <span className="font-semibold">
                                Submitted Date:
                              </span>{" "}
                              {formattedDate}
                            </div>
                            <div>
                              <span className="font-semibold">
                                Submitted Time:
                              </span>{" "}
                              {formattedTime}
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* FIND LENDERS MODAL */}
        {findLenderModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-xl dark:shadow-black/40 flex flex-col">
                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 shrink-0">
                  <div>
                    <h2 className="font-bold text-lg">Find Lenders</h2>
                    <p className="text-xs text-slate-500">
                      Connect with verified lenders
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFindLenderModalOpen(false);
                      setLenders([]);
                      setBorrowerSummary(null);
                      setSentLenders({});
                      setImageErrors({});
                      setApplicationId(null);
                    }}
                    className="text-slate-400 hover:text-red-500 text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* CONTENT */}
                <div className="p-6 overflow-y-auto bg-gray-50 dark:bg-slate-950">
                  {/* Filters */}
                  <div className="mb-6 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={lenderSearchQ}
                        onChange={(e) => {
                          setLenderPage(1);
                          setLenderSearchQ(e.target.value);
                        }}
                        placeholder="Search lenders by name or email..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <select
                      value={lenderLimit}
                      onChange={(e) => {
                        setLenderPage(1);
                        setLenderLimit(Number(e.target.value));
                      }}
                      className="px-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    >
                      <option value={6}>6 / page</option>
                      <option value={9}>9 / page</option>
                      <option value={12}>12 / page</option>
                    </select>
                  </div>

                  {borrowerSummary &&
                    borrowerSummary.loanAmount &&
                    borrowerSummary.borrowerMinTerm &&
                    borrowerSummary.borrowerMaxTerm &&
                    borrowerSummary.creditScore && (
                      <div className="mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-xl">
                        <div className="text-sm font-semibold text-[#2C92D5] dark:text-blue-400 mb-2">
                          Borrower Summary
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-semibold">Loan Amount:</span>
                            <div>
                              $
                              {Number(
                                borrowerSummary.loanAmount,
                              ).toLocaleString()}
                            </div>
                          </div>

                          <div>
                            <span className="font-semibold">Term:</span>
                            <div>
                              {borrowerSummary.borrowerMinTerm} -{" "}
                              {borrowerSummary.borrowerMaxTerm} months
                            </div>
                          </div>

                          <div>
                            <span className="font-semibold">Credit Score:</span>
                            <div>{borrowerSummary.creditScore}</div>
                          </div>

                          <div>
                            <span className="font-semibold">
                              Eligible Lenders:
                            </span>
                            <div>{lenders.length}</div>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Loading */}
                  {lenderLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
                        />
                      ))}
                    </div>
                  )}

                  {/* Empty State */}
                  {!lenderLoading && lenders.length === 0 && (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                        <SearchX className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="font-bold text-slate-700 dark:text-slate-300">
                        No lenders found
                      </h3>
                      <p className="text-sm text-slate-500">
                        Try adjusting your search terms
                      </p>
                    </div>
                  )}

                  {/* Lenders Grid */}
                  {!lenderLoading && lenders.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredLenders
                        .slice(
                          (lenderPage - 1) * lenderLimit,
                          lenderPage * lenderLimit,
                        )
                        .map((l) => (
                          <div
                            key={l.id}
                            className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 transition-all duration-300 hover:shadow-md"
                          >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {/* Profile Image / Fallback Icon */}
                                <div
                                  className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center 
                    bg-slate-100 dark:bg-slate-800 
                    border border-slate-200 dark:border-slate-700"
                                >
                                  {l.profileImage && !imageErrors[l.id] ? (
                                    <img
                                      src={l.profileImage}
                                      alt={l.name}
                                      className="w-full h-full object-cover"
                                      onError={() =>
                                        setImageErrors((prev) => ({
                                          ...prev,
                                          [l.id]: true,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <Building2 className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                                  )}
                                </div>

                                {/* Name + Email */}
                                <div>
                                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {l.name}
                                  </h3>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {l.email || "No email available"}
                                  </div>
                                </div>
                              </div>

                              {/* Eligibility Badge */}
                              <span
                                className={`text-xs font-bold px-2 py-1 rounded-full ${
                                  l.eligibilityStatus === "Eligible"
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                    : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                }`}
                              >
                                {l.eligibilityStatus}
                              </span>
                            </div>

                            {/* Loan Product */}
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">
                              Product: {l.loanProductCode}
                            </div>

                            {/* Funding Range */}
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              Funding: ${Number(l.minFunding).toLocaleString()}{" "}
                              - ${Number(l.maxFunding).toLocaleString()}
                            </div>

                            {/* Terms */}
                            <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                              Term: {l.minMonths} - {l.maxMonths} months
                            </div>

                            {/* Interest */}
                            <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                              Interest: {l.interestRateRange}
                            </div>

                            {/* Funding Speed */}
                            <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                              Funding Speed: {l.fundingSpeedDays} Days
                            </div>

                            {/* Send Button */}
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                              <button
                                disabled={
                                  sendingId === l.lenderProductId ||
                                  sentLenders[l.lenderProductId]
                                }
                                onClick={async () => {
                                  const result = await Swal.fire({
                                    title: "Send to Lender?",
                                    text: `Are you sure you want to send this application to ${l.name}?`,
                                    icon: "question",
                                    showCancelButton: true,
                                    confirmButtonColor: "#2563eb",
                                    cancelButtonColor: "#d33",
                                    confirmButtonText: "Yes, Send",
                                    cancelButtonText: "Cancel",
                                  });

                                  if (result.isConfirmed) {
                                    sendToLender(l.lenderProductId);
                                  }
                                }}
                                className={`w-full py-2 rounded-lg text-sm font-semibold transition-all
      ${
        sentLenders[l.lenderProductId]
          ? "bg-emerald-500 text-white cursor-not-allowed"
          : "bg-[#2C92D5] hover:bg-[#227dba] text-white"
      }
      disabled:opacity-60 disabled:cursor-not-allowed
    `}
                              >
                                {sendingId === l.lenderProductId ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                  </div>
                                ) : sentLenders[l.lenderProductId] ? (
                                  "Sent"
                                ) : (
                                  "Send to Lender"
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {!lenderLoading && filteredLenders.length > lenderLimit && (
                    <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                      <p className="text-xs text-slate-500">
                        Page {lenderPage} of{" "}
                        {Math.ceil(filteredLenders.length / lenderLimit)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={lenderPage === 1}
                          onClick={() => setLenderPage((p) => p - 1)}
                          className="p-2 rounded-lg border dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          disabled={
                            lenderPage >=
                            Math.ceil(filteredLenders.length / lenderLimit)
                          }
                          onClick={() => setLenderPage((p) => p + 1)}
                          className="p-2 rounded-lg border dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {documentModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999999999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div
                className="bg-white dark:bg-slate-900 
rounded-3xl 
w-full max-w-6xl 
max-h-[85vh] 
overflow-hidden 
shadow-[0_20px_60px_rgba(0,0,0,0.15)] 
flex flex-col"
              >
                {/* HEADER */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <h2 className="font-semibold text-sm tracking-wide text-slate-700 dark:text-slate-200">
                    Requested Documents
                  </h2>

                  <button
                    onClick={() => {
                      setDocumentModalOpen(false);
                      setDocumentsData(null);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full 
    hover:bg-red-100 dark:hover:bg-red-500/20 
    text-slate-400 hover:text-red-500 transition text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* SCROLLABLE BODY */}
                <div className="p-6 overflow-y-auto">
                  {documentsLoading ? (
                    <div className="text-center text-slate-500 py-10">
                      Loading documents...
                    </div>
                  ) : documentsData?.documents?.length > 0 ? (
                    <div className="grid sm:grid-cols-4 gap-4">
                      {documentsData.documents.map(
                        (doc: any, index: number) => {
                          const hasFiles =
                            doc.uploadedFiles && doc.uploadedFiles.length > 0;

                          return (
                            <div
                              key={index}
                              className="
relative
bg-white dark:bg-slate-900
border border-slate-200 dark:border-slate-800
rounded-xl
p-4
shadow-sm
transition-all duration-200
flex flex-col
h-[320px]   
"
                            >
                              {/* Top Section */}
                              <div className="flex items-center gap-4 mb-4">
                                <div className="flex items-center justify-between w-full">
                                  <h3 className="font-medium text-[13px] text-slate-900 dark:text-slate-200 truncate">
                                    {doc.documentName}
                                  </h3>

                                  {(previewFiles[doc.requirementId]?.length >
                                    0 ||
                                    selectedFiles[doc.requirementId]?.length >
                                      0) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewFiles((prev) => {
                                          const copy = { ...prev };
                                          delete copy[doc.requirementId];
                                          return copy;
                                        });

                                        setSelectedFiles((prev) => {
                                          const copy = { ...prev };
                                          delete copy[doc.requirementId];
                                          return copy;
                                        });
                                      }}
                                      className="text-[10px] px-2 py-1 rounded-md 
                 bg-red-50 text-red-600 
                 hover:bg-red-100 
                 dark:bg-red-500/10 dark:text-red-400 
                 dark:hover:bg-red-500/20
                 transition"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Upload Area */}
                              {!hasFiles ? (
                                <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                                  {/* Preview */}
                                  {previewFiles[doc.requirementId]?.length >
                                    0 && (
                                    <div
                                      className="
flex flex-wrap gap-2
max-h-[220px]
overflow-y-auto
pr-1
scrollbar-thin
scrollbar-thumb-slate-300
dark:scrollbar-thumb-slate-700
"
                                    >
                                      {previewFiles[doc.requirementId].map(
                                        (file, i) => (
                                          <div
                                            key={i}
                                            className="relative w-16 h-16 rounded-lg border-2 border-blue-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center"
                                          >
                                            {/* IMAGE PREVIEW */}
                                            {file.type.startsWith("image") ? (
                                              <img
                                                src={file.url}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : file.type.includes("pdf") ? (
                                              <div className="flex flex-col items-center justify-center text-xs text-red-500 font-semibold">
                                                📄
                                                <span className="text-[9px] mt-1">
                                                  PDF
                                                </span>
                                              </div>
                                            ) : (
                                              <div className="text-xs text-slate-500">
                                                File
                                              </div>
                                            )}

                                            {/* Remove Button */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPreviewFiles((prev) => {
                                                  const updated = [
                                                    ...(prev[
                                                      doc.requirementId
                                                    ] || []),
                                                  ];
                                                  updated.splice(i, 1);
                                                  const copy = { ...prev };
                                                  if (updated.length === 0)
                                                    delete copy[
                                                      doc.requirementId
                                                    ];
                                                  else
                                                    copy[doc.requirementId] =
                                                      updated;
                                                  return copy;
                                                });

                                                setSelectedFiles((prev) => {
                                                  const updated = [
                                                    ...(prev[
                                                      doc.requirementId
                                                    ] || []),
                                                  ];
                                                  updated.splice(i, 1);
                                                  const copy = { ...prev };
                                                  if (updated.length === 0)
                                                    delete copy[
                                                      doc.requirementId
                                                    ];
                                                  else
                                                    copy[doc.requirementId] =
                                                      updated;
                                                  return copy;
                                                });
                                              }}
                                              className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1 rounded hover:bg-red-500 transition"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}

                                  {/* File Select – show only if no file selected */}
                                  {!selectedFiles[doc.requirementId] && (
                                    <label className="h-full flex flex-col justify-center items-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-amber-400 transition cursor-pointer">
                                      <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.png,.jpg,.jpeg"
                                        className="hidden"
                                        onChange={(e) => {
                                          const files = Array.from(
                                            e.target.files || [],
                                          );
                                          if (!files.length) return;

                                          const validFiles: File[] = [];
                                          const previews: {
                                            url: string;
                                            type: string;
                                            name: string;
                                          }[] = [];

                                          files.forEach((file) => {
                                            if (file.size > 5 * 1024 * 1024) {
                                              toast.error(
                                                `${file.name} exceeds 5MB limit`,
                                              );
                                              return;
                                            }

                                            validFiles.push(file);
                                            previews.push({
                                              url: URL.createObjectURL(file),
                                              type: file.type,
                                              name: file.name,
                                            });
                                          });

                                          if (!validFiles.length) return;

                                          setSelectedFiles((prev) => ({
                                            ...prev,
                                            [doc.requirementId]: [
                                              ...(prev[doc.requirementId] ||
                                                []),
                                              ...validFiles,
                                            ],
                                          }));

                                          setPreviewFiles((prev) => ({
                                            ...prev,
                                            [doc.requirementId]: [
                                              ...(prev[doc.requirementId] ||
                                                []),
                                              ...previews,
                                            ],
                                          }));
                                        }}
                                      />

                                      <p className="text-xs text-amber-600 font-medium">
                                        Click to Select File
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-1">
                                        PDF / JPG / PNG (Max 5MB)
                                      </p>
                                    </label>
                                  )}

                                  {/* Upload Button – only after file selected */}
                                  {selectedFiles[doc.requirementId]?.length >
                                    0 && (
                                    <button
                                      onClick={() =>
                                        handleDocumentUpload(
                                          documentsData.submissionId,
                                          doc.requirementId,
                                        )
                                      }
                                      disabled={
                                        uploadingDocId === doc.requirementId
                                      }
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition disabled:opacity-60"
                                    >
                                      {uploadingDocId === doc.requirementId ? (
                                        <div className="flex items-center justify-center gap-2">
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Uploading...
                                        </div>
                                      ) : (
                                        "Upload Document"
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="
flex flex-wrap gap-2
max-h-[220px]
overflow-y-auto
pr-1
scrollbar-thin
scrollbar-thumb-slate-300
dark:scrollbar-thumb-slate-700 w-full
"
                                >
                                  {doc.uploadedFiles.map(
                                    (file: any, i: number) => {
                                      const isImage =
                                        file.fileMimeType?.startsWith("image");

                                      return (
                                        <div
                                          key={i}
                                          className="relative w-16 h-16 rounded-lg border-2 border-[#98bfe1] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center"
                                        >
                                          {isImage ? (
                                            <img
                                              src={`${API_BASE}${file.fileUrl}`}
                                              alt={file.fileName}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <div className="flex flex-col items-center justify-center text-xs text-slate-600 dark:text-slate-300">
                                              📄
                                              <span className="mt-1 truncate px-1 text-[10px]">
                                                PDF
                                              </span>
                                            </div>
                                          )}

                                          {/* View Overlay */}
                                          <a
                                            href={`${API_BASE}${file.fileUrl}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold"
                                          >
                                            View
                                          </a>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              )}

                              {/* Bottom Status */}
                              <div className="mt-auto pt-3 ">
                                <div className="mt-4 flex justify-between items-center">
                                  <span
                                    className={`text-[10px] px-3 py-1 rounded-full
                          ${
                            doc.status === "PENDING"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-emerald-100 text-emerald-600"
                          }`}
                                  >
                                    {doc.status}
                                  </span>

                                  <span className="text-[11px] font-semibold text-red-400">
                                    {doc.uploadedCount} Uploaded
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 py-10">
                      No documents found
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
