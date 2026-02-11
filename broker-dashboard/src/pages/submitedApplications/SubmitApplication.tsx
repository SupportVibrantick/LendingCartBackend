import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import {
  MapPin,
  Eye,
  Search,
  FileText,
  DollarSign,
  Loader2,
  TrendingUp,
  // RefreshCcw,
  Building2,
  SearchX,
  ChevronLeft,
  ChevronRight,
  // Mail,
  // UserPlus,
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

type LenderMeta = {
  page: number;
  limit: number;
  total: number;
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
  const [lenderSubmissionId, setLenderSubmissionId] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Find Lenders Modal State
  const [findLenderModalOpen, setFindLenderModalOpen] = useState(false);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [borrowerSummary, setBorrowerSummary] = useState<any>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentLenders, setSentLenders] = useState<Record<string, boolean>>({});
  // const [applicationId, setApplicationId] = useState<string | null>(null);
  const [lenderMeta, setLenderMeta] = useState<LenderMeta>({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [lenderLoading, setLenderLoading] = useState(false);
  const [lenderSearchQ, setLenderSearchQ] = useState("");
  const [lenderPage, setLenderPage] = useState(1);
  const [lenderLimit, setLenderLimit] = useState(6);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

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
    (r) => r.status === "NEW" || r.status === "SUBMITTED",
  ).length;

  const fundedCount = rows.filter((r) => r.status === "FUNDED").length;

  const totalVolume = rows.reduce((sum, r) => sum + r.amount, 0);

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

    setLenderLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/broker/lender-discovery/applications/submissions/${lenderSubmissionId}/eligible`,
        {
          headers: getAuthHeaders(),
          method: "GET"
        }
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
        }))
      );

      setSubmissionDetail({
        applicationId: data.applicationId,
      });

      setLenderMeta({
        page: 1,
        limit: data.eligibleLenders?.length || 0,
        total: data.totalEligibleLenders,
      });

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load eligible lenders");
    } finally {
      setLenderLoading(false);
    }
  };

  const sendToLender = async (lenderProductId: string) => {
    if (!lenderSubmissionId || !borrowerSummary) return;

    try {
      setSendingId(lenderProductId);

      const res = await fetch(
        `${API_BASE}/broker/lender-discovery/applications/${submissionDetail?.applicationId}/submissions/${lenderSubmissionId}/send-to-lenders`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            lenderProductIds: [lenderProductId],
          }),
        }
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


    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  // const inviteLender = async (lenderId: string) => {
  //   if (invitingId) return;
  //   setInvitingId(lenderId);

  //   try {
  //     const res = await fetch(`${API_BASE}/lenders/invite`, {
  //       method: "POST",
  //       headers: getAuthHeaders(),
  //       body: JSON.stringify({
  //         lenderOrgId: lenderId,
  //       }),
  //     });

  //     const json = await res.json();

  //     if (!res.ok || json.success !== true) {
  //       throw new Error(json.message || "Failed to send invitation");
  //     }
  //     toast.success("Invitation sent successfully!");
  //     // setLenders((prev) => prev.filter((l) => l.id !== lenderId)); // Optional: remove or update status
  //   } catch (err: any) {
  //     console.error("Invite failed:", err);
  //     toast.error("Failed to send invitation. Please try again.");
  //   } finally {
  //     setInvitingId(null);
  //   }
  // };

  useEffect(() => {
    if (findLenderModalOpen) {
      fetchLenders();
    }
  }, [findLenderModalOpen, lenderPage, lenderLimit, lenderSearchQ]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/public/broker/applications/submissions`);
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
                  `${getFieldValue(fields, "borrowerFirstName") || ""} ${getFieldValue(fields, "borrowerLastName") || ""}`.trim(),
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 md:p-10 text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Header Area */}
      <header className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text">
              Loan Pipeline
            </h1>
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
                {[
                  "Borrower",
                  "Loan Type",
                  "Location",
                  "Amount",
                  "Status",
                  "Lenders",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-5 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500"
                  >
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
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr
                    key={row.submissionId}
                    className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-200"
                  >
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
                        <span className="text-sm font-medium">
                          {row.cityState.toUpperCase() || "Global"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5 font-mono font-bold text-slate-700 dark:text-slate-300">
                      ${row.amount.toLocaleString()}
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${getStatusColor(
                          row.status,
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        onClick={() => {
                          setLenderSubmissionId(row.submissionId);
                          setFindLenderModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all active:scale-95 mt-2"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Find Lender
                      </button>
                    </td>

                    <td className="px-6 py-5">
                      <button
                        onClick={() => fetchSubmissionDetail(row.submissionId)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
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
                      <p className="text-slate-500 dark:text-slate-400 font-medium">
                        No applications found matching your criteria
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                  <div>
                    <h2 className="font-bold text-lg">Application Details</h2>
                    {/* <p className="text-xs text-slate-500">
                                        Submission ID: {openSubmissionId}
                                    </p> */}
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

                      const submittedDate = new Date(submissionDetail.submittedAt);
                      const formattedDate = submittedDate.toLocaleDateString();
                      const formattedTime = submittedDate.toLocaleTimeString();

                      return (
                        <>
                          {/* STATUS */}

                          <div className="text-sm font-medium">
                            <span className="font-semibold">Status:</span>{" "}
                            {submissionDetail.status}
                          </div>

                          {/* ALL FIELDS (EXCEPT SIGNATURE) */}
                          <div className="border rounded-xl dark:border-slate-800 p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {submissionDetail.fields
                                .filter((f: any) => f.fieldKey !== "borrowerSignature")
                                .map((f: any, i: number) => {
                                  const parsedValue = parseValue(f.value);

                                  return (
                                    <div key={i} className="space-y-1">
                                      {/* LABEL */}
                                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                        {formatFieldKey(f.fieldKey)}
                                      </label>

                                      {/* VALUE */}
                                      <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 break-words">
                                        {parsedValue !== undefined && parsedValue !== ""
                                          ? String(parsedValue)
                                          : "-"}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>

                          {/* DIGITAL SIGNATURE */}
                          {signatureField && (
                            <div className="text-center space-y-3">
                              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Digital Signature
                              </h3>

                              <div className="flex justify-center">
                                <img
                                  src={parseValue(signatureField.value)}
                                  alt="Digital Signature"
                                  className="h-45 object-contain border border-slate-200 dark:border-slate-700 rounded-lg bg-white p-2"
                                />
                              </div>
                            </div>
                          )}

                          {/* SUBMITTED DATE & TIME (LAST) */}
                          <div className="border-t pt-6 text-sm text-slate-600 dark:text-slate-400 flex justify-between">
                            <div>
                              <span className="font-semibold">Submitted Date:</span>{" "}
                              {formattedDate}
                            </div>
                            <div>
                              <span className="font-semibold">Submitted Time:</span>{" "}
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
                    onClick={() => setFindLenderModalOpen(false)}
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

                  {borrowerSummary && borrowerSummary.loanAmount && borrowerSummary.borrowerMinTerm && borrowerSummary.borrowerMaxTerm && borrowerSummary.creditScore && (
                    <div className="mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-xl">
                      <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                        Borrower Summary
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-semibold">Loan Amount:</span>
                          <div>
                            ${Number(borrowerSummary.loanAmount).toLocaleString()}
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
                          <span className="font-semibold">Eligible Lenders:</span>
                          <div>{lenderMeta.total}</div>
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
                      {lenders.map((l) => (
                        <div
                          key={l.id}
                          className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 transition-all duration-300 hover:shadow-md"
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">

                            <div className="flex items-center gap-3">

                              {/* Profile Image / Fallback Icon */}
                              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center 
                    bg-slate-100 dark:bg-slate-800 
                    border border-slate-200 dark:border-slate-700">

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
                              className={`text-xs font-bold px-2 py-1 rounded-full ${l.eligibilityStatus === "Eligible"
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
                            Funding:
                            {" "}
                            ${Number(l.minFunding).toLocaleString()} - ${Number(l.maxFunding).toLocaleString()}
                          </div>

                          {/* Terms */}
                          <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                            Term:
                            {" "}
                            {l.minMonths} - {l.maxMonths} months
                          </div>

                          {/* Interest */}
                          <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                            Interest:
                            {" "}
                            {l.interestRateRange}
                          </div>

                          {/* Funding Speed */}
                          <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                            Funding Speed:
                            {" "}
                            {l.fundingSpeedDays} Days
                          </div>

                          {/* Send Button */}
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">

                            <button
                              disabled={
                                sendingId === l.lenderProductId ||
                                sentLenders[l.lenderProductId]
                              }
                              onClick={() => sendToLender(l.lenderProductId)}
                              className={`w-full py-2 rounded-lg text-sm font-semibold transition-all
      ${sentLenders[l.lenderProductId]
                                  ? "bg-emerald-500 text-white cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
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
                  {!lenderLoading && lenderMeta.total > lenderLimit && (
                    <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                      <p className="text-xs text-slate-500">
                        Page {lenderMeta.page} of{" "}
                        {Math.ceil(lenderMeta.total / lenderMeta.limit)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={lenderMeta.page === 1}
                          onClick={() => setLenderPage((p) => p - 1)}
                          className="p-2 rounded-lg border dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          disabled={
                            lenderMeta.page >=
                            Math.ceil(lenderMeta.total / lenderLimit)
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
      </div>
    </div>
  );
}