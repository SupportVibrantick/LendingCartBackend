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
} from "lucide-react";

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
};

/* ================= HELPERS ================= */
const API_BASE = "https://api-lendingcart.vibrantick.org";

const parseValue = (val: string): any => {
    try {
        return JSON.parse(val);
    } catch {
        return val;
    }
};

const getApplicationStatusColor = (status: string) => {
    const s = status?.toLowerCase();

    switch (s) {
        case "approved":
            return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";

        case "rejected":
            return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";

        case "in_review":
            return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";

        case "sent":
            return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";

        case "pending":
            return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";

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

    // Find Lenders Modal State
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 8;

    const InfoCard = ({ label, value }: { label: string; value: any }) => (
        <div className="
    bg-slate-50 
    dark:bg-slate-800/60 
    border border-slate-100 dark:border-slate-700
    p-4 rounded-xl
    transition-colors duration-300
">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-sm font-semibold">{value || "-"}</p>
        </div>
    );

    const formatFieldKey = (key: string | null | undefined) => {
        if (!key) return "";

        return key
            // camelCase → camel Case
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            // snake_case → snake case
            .replace(/_/g, " ")
            // multiple spaces remove
            .replace(/\s+/g, " ")
            // trim
            .trim()
            // capitalize each word
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const newCount = rows.filter(
        (r) =>
            r.applicationStatus === "IN_REVIEW" ||
            r.applicationStatus === "SENT"
    ).length;

    const approvedCount = rows.filter(
        (r) => r.applicationStatus === "APPROVED"
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
                }
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

            const res = await fetch(
                `${API_BASE}/lender/loan-pipeline`,
                {
                    headers: getAuthHeaders(), // lender_token use hoga
                }
            );

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
                lenderStatus: item.lenderStatus,
                applicationStatus: item.applicationStatus,
                sentAt: item.sentAt,
                brokerName: item.broker?.name || "-",
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

    const filteredRows = rows.filter(
        (r) =>
            r.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const totalPages = Math.ceil(filteredRows.length / rowsPerPage);

    const paginatedRows = filteredRows.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    useEffect(() => {
        const tableTop = document.querySelector(".loan-table-top");
        tableTop?.scrollIntoView({ behavior: "smooth" });
    }, [currentPage]);



    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 md:p-10 text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">
            {/* Header Area */}
            <header className="max-w-7xl mx-auto mb-10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text">
                            Loan Pipeline
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
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
                    {/* TOTAL VOLUME - Indigo Gradient */}
                    <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all duration-300">
                        {/* Subtle Decorative Circle */}
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-125 transition-transform duration-500" />

                        <div className="relative flex items-center gap-5">
                            <div className="p-4 rounded-xl bg-white/20 backdrop-blur-md text-white shadow-sm">
                                <DollarSign className="w-6 h-6 stroke-[2.5px]" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-100/80 mb-1">
                                    Total Volume
                                </p>
                                <h3 className="text-2xl font-black text-white tracking-tight">
                                    ${totalVolume.toLocaleString()}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* NEW APPLICATIONS - Blue Gradient */}
                    <div className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-125 transition-transform duration-500" />

                        <div className="relative flex items-center gap-5">
                            <div className="p-4 rounded-xl bg-white/20 backdrop-blur-md text-white shadow-sm">
                                <FileText className="w-6 h-6 stroke-[2.5px]" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-100/80 mb-1">
                                    New Applications
                                </p>
                                <h3 className="text-2xl font-black text-white tracking-tight">
                                    {newCount}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* APPROVED - Emerald Gradient */}
                    <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all duration-300">

                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-125 transition-transform duration-500" />

                        <div className="relative flex items-center gap-5">
                            <div className="p-4 rounded-xl bg-white/20 backdrop-blur-md text-white shadow-sm">
                                <CheckCircle className="w-6 h-6 stroke-[2.5px]" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-100/80 mb-1">
                                    Approved
                                </p>
                                <h3 className="text-2xl font-black text-white tracking-tight">
                                    {approvedCount}
                                </h3>
                            </div>
                        </div>
                    </div>

                </div>
            </header>

            {/* Main Table Container */}
            <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto loan-table-top">
                        <table className="w-full border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/40">
                                    {[
                                        { label: "Application #", width: "w-[180px]" },
                                        { label: "Borrower", width: "w-[220px]" },
                                        { label: "Loan Type", width: "w-[150px]" },
                                        { label: "Amount", width: "w-[160px]" },
                                        { label: "Broker", width: "w-[180px]" },
                                        { label: "Application Status", width: "w-[160px]" },
                                        { label: "Received At", width: "w-[180px]" },
                                        { label: "Actions", width: "w-[120px]" },
                                    ].map((h) => (
                                        <th
                                            key={h.label}
                                            className={`${h.width} px-6 py-4 text-left text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800`}
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
                                            key={row.applicationLenderId}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                        >

                                            {/* Application Number */}
                                            <td className="px-6 py-4 font-mono text-sm">
                                                {row.applicationNumber}
                                            </td>

                                            {/* Borrower */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                        {row.borrowerName}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {row.entityType}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Loan Type */}
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-sm">
                                                    {row.loanType}
                                                </span>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {row.amount > 0
                                                        ? `$${row.amount.toLocaleString()}`
                                                        : "-"}
                                                </span>
                                            </td>


                                            {/* Broker */}
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {row.brokerName}
                                            </td>

                                            {/* Application Status */}
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`
      px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
      ${getApplicationStatusColor(row.applicationStatus)}
    `}
                                                >
                                                    {row.applicationStatus?.replace("_", " ") || "-"}
                                                </span>
                                            </td>


                                            {/* Sent Date */}
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(row.sentAt).toLocaleDateString()}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() =>
                                                        fetchLenderApplicationDetail(row.applicationLenderId)
                                                    }
                                                    className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>

                                        </tr>
                                    ))
                                ) : (
                                    /* Professional Empty State */
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center max-w-[240px] mx-auto">
                                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
                                                    <Search className="w-6 h-6 text-slate-300" />
                                                </div>
                                                <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">No matching records</h3>
                                                <p className="text-[13px] text-slate-500 mt-1">Try adjusting your filters to find what you're looking for.</p>
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
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`px-3 py-1 text-sm rounded-lg transition
                        ${currentPage === page
                                                    ? "bg-blue-600 text-white"
                                                    : "border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                }
                    `}
                                        >
                                            {page}
                                        </button>
                                    ))}

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
                                    <div className="
    bg-white 
    dark:bg-[#0f172a] 
    text-slate-900 
    dark:text-slate-100
    w-full max-w-5xl max-h-[90vh] overflow-y-auto 
    rounded-2xl shadow-2xl 
    border border-slate-200 dark:border-slate-800
    transition-colors duration-300
">

                                        {/* HEADER */}
                                        <div className="
    sticky top-0 z-10 
    bg-white/95 dark:bg-[#0f172a]/95 
    backdrop-blur-md
    flex items-center justify-between px-6 py-4 
    border-b border-slate-200 dark:border-slate-800
">
                                            <h2 className="text-lg font-bold">
                                                Application Details
                                            </h2>
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
                                                    <InfoCard label="Application #" value={submissionDetail.loanApplication?.applicationNumber} />
                                                    <InfoCard label="Status" value={submissionDetail.status} />
                                                    <InfoCard label="Loan Product" value={submissionDetail.loanApplication?.loanProductCode} />
                                                    <InfoCard label="Borrower" value={submissionDetail.loanApplication?.client?.legalName} />
                                                    <InfoCard label="Entity Type" value={submissionDetail.loanApplication?.client?.entityType} />
                                                    <InfoCard label="Broker" value={submissionDetail.loanApplication?.brokerOrg?.name} />
                                                </div>

                                                {/* SUBMISSION FIELDS */}
                                                <div>
                                                    <h3 className="font-semibold mb-4 text-slate-700 dark:text-slate-300">
                                                        Submission Details
                                                    </h3>

                                                    {(() => {
                                                        const fields =
                                                            submissionDetail.loanApplication?.submissions?.[0]?.fields || [];

                                                        const normalFields = fields.filter(
                                                            (f: any) => f.fieldKey !== "borrowerSignature"
                                                        );

                                                        const signatureField = fields.find(
                                                            (f: any) => f.fieldKey === "borrowerSignature"
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

                                                                        <div className="
    bg-white dark:bg-slate-800
    p-4 rounded-xl 
    border border-slate-200 dark:border-slate-700
    shadow-sm
">
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
                                document.body
                            )}

                    </div>

                </div>



            </div>
        </div>
    );
}