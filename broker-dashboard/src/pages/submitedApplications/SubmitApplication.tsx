import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    MapPin,
    Eye,
    Search,
    FileText,
    DollarSign,
    Loader2,
    TrendingUp,
    ArrowRight,
} from "lucide-react";

/* ================= TYPES ================= */
type SubmissionListItem = {
    submissionId: string;
    status: string;
    submittedOn: string;
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
};

/* ================= HELPERS ================= */
const API_BASE = "https://api-lendingcart.vibrantick.org/api/public/broker";

const parseValue = (val: string): any => {
    try { return JSON.parse(val); } catch { return val; }
};

const getFieldValue = (fields: SubmissionField[], key: string): any => {
    const field = fields.find((f) => f.fieldKey === key || f.fieldId === key);
    return field ? parseValue(field.value) : undefined;
};

/* ================= COMPONENT ================= */
export default function LoanApplicationsPage() {
    const [rows, setRows] = useState<TableRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const newCount = rows.filter(
        r => r.status === "NEW" || r.status === "SUBMITTED"
    ).length;

    const fundedCount = rows.filter(
        r => r.status === "FUNDED"
    ).length;

    const totalVolume = rows.reduce(
        (sum, r) => sum + r.amount,
        0
    );

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();

        /* NEW */
        if (s === "new") {
            return `
      bg-blue-50 text-blue-700 border-blue-200
      dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20
    `;
        }

        /* FUNDED */
        if (s === "funded") {
            return `
      bg-emerald-50 text-emerald-700 border-emerald-200
      dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20
    `;
        }

        /* SUBMITTED TO LENDERS */
        if (s.includes("submitted")) {
            return `
      bg-purple-50 text-purple-700 border-purple-200
      dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20
    `;
        }

        /* FALLBACK */
        return `
    bg-slate-50 text-slate-700 border-slate-200
    dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20
  `;
    };


    const loadSubmissions = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/applications/submissions`);
            const json = await res.json();
            if (!json.success) throw new Error("Failed to load submissions");

            const detailedRows = await Promise.all(
                json.data.map(async (item: SubmissionListItem): Promise<TableRow | null> => {
                    try {
                        const detailRes = await fetch(`${API_BASE}/applications/submissions/${item.submissionId}`);
                        const detailJson = await detailRes.json();
                        if (!detailJson.success) return null;

                        const fields = detailJson.data.fields;
                        return {
                            submissionId: item.submissionId,
                            borrowerName: `${getFieldValue(fields, "borrowerFirstName") || ""} ${getFieldValue(fields, "borrowerLastName") || ""}`.trim(),
                            company: getFieldValue(fields, "companyName") || "Individual",
                            loanType: getFieldValue(fields, "loanProductCode") || "General Loan",
                            cityState: [getFieldValue(fields, "city"), getFieldValue(fields, "state")].filter(Boolean).join(", "),
                            country: getFieldValue(fields, "country") || "USA",
                            amount: Number(getFieldValue(fields, "loanAmount") || 0),
                            status: item.status,
                            date: item.submittedOn,
                        };
                    } catch { return null; }
                })
            );
            setRows(detailedRows.filter((r): r is TableRow => r !== null));
        } catch (err: any) {
            toast.error(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSubmissions(); }, []);

    const filteredRows = rows.filter(
        (r) =>
            r.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 md:p-10 text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">

            {/* Header Area */}
            <header className="max-w-7xl mx-auto mb-10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Loan Pipeline
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            You have <span className="text-blue-600 dark:text-blue-400">{filteredRows.length} active</span> applications today.
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
                            <Loader2 className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${loading ? "animate-spin text-blue-500" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Quick Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">

                    {/* TOTAL VOLUME */}
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                Total Volume
                            </p>
                            <p className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
                                ${totalVolume.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* NEW APPLICATIONS */}
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                New Applications
                            </p>
                            <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">
                                {newCount}
                            </p>
                        </div>
                    </div>

                    {/* FUNDED APPLICATIONS */}
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Funded
                            </p>
                            <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
                                {fundedCount}
                            </p>
                        </div>
                    </div>

                </div>


            </header>

            {/* Main Table Container */}
            <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                {["Borrower", "Loan Type", "Location", "Amount", "Status", "Action"].map((h) => (
                                    <th key={h} className="px-6 py-5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {loading ? (
                                /* Skeleton Loading State */
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredRows.length > 0 ? (
                                filteredRows.map((row) => (
                                    <tr key={row.submissionId} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-200">
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {row.borrowerName || "Untitled Applicant"}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                                                <FileText className="w-3 h-3" />
                                                {row.company}
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                                                {row.loanType}
                                            </span>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span className="text-sm font-medium">{row.cityState || "Global"}</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 font-mono font-bold text-slate-700 dark:text-slate-300">
                                            ${row.amount.toLocaleString()}
                                        </td>

                                        <td className="px-6 py-5">
                                            <span
                                                className={`px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${getStatusColor(
                                                    row.status
                                                )}`}
                                            >
                                                {row.status}
                                            </span>
                                        </td>

                                        <td className="px-6 py-5">
                                            <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all active:scale-95 group/btn">
                                                <Eye className="w-3.5 h-3.5" />
                                                View
                                                <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                /* Empty State */
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full">
                                                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                            </div>
                                            <p className="text-slate-500 dark:text-slate-400 font-medium">No applications found matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}