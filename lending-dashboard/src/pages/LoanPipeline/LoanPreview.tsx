import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Eye, FileIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

type PreviewTab = "details" | "documents" | "loi";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const parseValue = (val: string): any => {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const formatFieldKey = (key: string | null | undefined) => {
  if (!key) return "";

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("lender_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

const InfoCard = ({ label, value }: { label: string; value: any }) => (
  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-4 rounded-xl transition-colors duration-300">
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className="text-sm font-semibold break-words">{value || "-"}</p>
  </div>
);

const tabMeta: Array<{ id: PreviewTab; label: string }> = [
  { id: "details", label: "View Details" },
  { id: "documents", label: "Documents" },
  { id: "loi", label: "View LOI" },
];

export default function LoanPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const applicationLenderId =
    location.state?.applicationLenderId ||
    searchParams.get("applicationLenderId") ||
    (pathSegments[0] === "loan-preview" ? pathSegments[1] : "") ||
    "";

  const requestedTab =
    location.state?.initialTab || searchParams.get("tab") || "details";

  const isLoi = location.state?.isLoi;

  const initialTab: PreviewTab =
    requestedTab === "documents" || requestedTab === "loi"
      ? requestedTab
      : "details";

  const [activeTab, setActiveTab] = useState<PreviewTab>(initialTab);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [loiLoading, setLoiLoading] = useState(false);
  const [loiUrl, setLoiUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [multiFileModal, setMultiFileModal] = useState<{
    isOpen: boolean;
    doc: any;
  }>({
    isOpen: false,
    doc: null,
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    return () => {
      if (loiUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(loiUrl);
      }
    };
  }, [loiUrl]);

  const Metric = ({
    label,
    value,
    variant = "hero",
  }: {
    label: string;
    value: string;
    variant?: "hero" | "panel";
  }) => {
    const isHero = variant === "hero";

    return (
      <motion.div
        whileHover={{ y: -6, scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.25 }}
        className="group relative cursor-pointer overflow-hidden rounded-2xl p-4 transition-all duration-300"
      >
        <div className="absolute inset-0 opacity-0 blur-xl transition duration-300 group-hover:opacity-100 bg-gradient-to-r from-cyan-400/10 to-blue-500/10" />
        <p
          className={`text-[11px] font-semibold uppercase tracking-widest transition ${
            isHero
              ? "text-white/70 group-hover:text-white"
              : "text-slate-500 group-hover:text-slate-700"
          }`}
        >
          {label}
        </p>
        <p
          className={`mt-2 text-sm font-bold transition-all duration-300 ${
            isHero
              ? "text-white group-hover:scale-105"
              : "bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-cyan-500"
          }`}
        >
          {value}
        </p>
        <div
          className={`mt-3 h-[3px] w-0 rounded-full transition-all duration-300 group-hover:w-full ${
            isHero
              ? "bg-gradient-to-r from-white/80 to-cyan-300"
              : "bg-gradient-to-r from-cyan-500 to-blue-500"
          }`}
        />
      </motion.div>
    );
  };

  useEffect(() => {
    if (applicationLenderId && !submissionDetail) {
      fetchLenderApplicationDetail();
    }
  }, [applicationLenderId]);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url, {
        headers: url.startsWith("blob:") ? undefined : getAuthHeaders(),
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

  const fetchLenderApplicationDetail = async () => {
    if (!applicationLenderId || submissionDetail) return;

    try {
      setDetailLoading(true);
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
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchDocuments = async () => {
    if (!applicationLenderId || documentsData) return;

    try {
      setDocumentsLoading(true);
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
    } finally {
      setDocumentsLoading(false);
    }
  };

  const fetchLoi = async () => {
    if (!applicationLenderId || loiUrl) return;

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
        throw new Error("LOI not generated yet");
      }

      const fileUrl = `${API_BASE}/public${json.data.loiPath}`;
      const fileRes = await fetch(fileUrl, {
        headers: getAuthHeaders(),
      });

      if (!fileRes.ok) {
        throw new Error("Failed to load LOI file");
      }

      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);

      setLoiUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return blobUrl;
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load LOI");
    } finally {
      setLoiLoading(false);
    }
  };

  useEffect(() => {
    if (!applicationLenderId) return;

    if (activeTab === "details") {
      fetchLenderApplicationDetail();
    }

    if (activeTab === "documents") {
      fetchDocuments();
    }

    if (activeTab === "loi") {
      fetchLoi();
    }
  }, [activeTab, applicationLenderId]);

  const onTabChange = (tab: PreviewTab) => {
    setActiveTab(tab);
    navigate(`/loan-preview/?tab=${tab}`, {
      replace: true,
      state: {
        applicationLenderId,
        initialTab: tab,
        isLoi,
      },
    });
  };

  const renderDetails = () => {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
        </div>
      );
    }

    if (!submissionDetail) {
      return (
        <div className="text-center py-16 text-slate-500">
          Application details not available.
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {submissionDetail.lenderReviews?.length > 0 &&
          (() => {
            const review = submissionDetail.lenderReviews[0];
            const reviewStatus =
              review.reviewStatus || review.decision || "PENDING";
            const isApproved = reviewStatus === "APPROVED";
            const isRejected =
              reviewStatus === "DECLINED" || reviewStatus === "REJECTED";
            const isConditional =
              reviewStatus === "CONDITIONAL" ||
              reviewStatus === "LENDER_CONDITIONAL";

            return (
              <div
                className={`relative overflow-hidden rounded-2xl border p-6 dark:bg-slate-900 shadow-md ${
                  isApproved
                    ? "border-emerald-200 dark:border-emerald-500/30 bg-[#F7FEFB]"
                    : isRejected
                      ? "border-rose-200 dark:border-rose-500/30 bg-[#FFF9FA]"
                      : isConditional
                        ? "border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10"
                        : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isApproved
                      ? "bg-emerald-500"
                      : isRejected
                        ? "bg-rose-500"
                        : isConditional
                          ? "bg-amber-500"
                          : "bg-slate-400"
                  }`}
                />

                <div className="flex items-center gap-3 mb-6">
                  <div
                    className={`flex items-center justify-center h-12 w-12 rounded-xl text-xl font-bold ${
                      isApproved
                        ? "bg-emerald-500 text-white"
                        : isRejected
                          ? "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                          : isConditional
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {isApproved
                      ? "OK"
                      : isRejected
                        ? "NO"
                        : isConditional
                          ? "!"
                          : "-"}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-400">
                      Lender Decision
                    </p>
                    <h3
                      className={`text-lg font-bold ${
                        isApproved
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isRejected
                            ? "text-rose-600 dark:text-rose-400"
                            : isConditional
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {reviewStatus}
                    </h3>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 text-sm">
                  {review.approvedAmount && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Approved Amount
                      </p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        ${Number(review.approvedAmount).toLocaleString()}
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
                      <p className="text-xs text-slate-400 mb-1">Reviewed On</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(
                          review.updatedAt || review.createdAt,
                        ).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {review.notes && (
                  <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                    <p className="text-xs text-slate-400 mb-2">Notes</p>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words text-sm">
                      {review.notes}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

        <div className="grid md:grid-cols-3 gap-6">
          <InfoCard
            label="Application Id"
            value={submissionDetail.loanApplication?.applicationNumber}
          />
          <InfoCard label="Status" value={submissionDetail.status} />
          <InfoCard
            label="Loan Product"
            value={submissionDetail.loanApplication?.loanProductCode}
          />
          <InfoCard
            label="Borrower"
            value={submissionDetail.loanApplication?.client?.legalName}
          />
          <InfoCard
            label="Entity Type"
            value={submissionDetail.loanApplication?.client?.entityType}
          />
          <InfoCard
            label="Broker"
            value={submissionDetail.loanApplication?.brokerOrg?.name}
          />
        </div>

        <div>
          <h3 className="font-semibold mb-4 text-slate-700 dark:text-slate-300">
            Submission Details
          </h3>

          {(() => {
            const fields =
              submissionDetail.loanApplication?.submissions?.[0]?.fields || [];
            const normalFields = fields.filter(
              (f: any) => f.fieldKey !== "borrowerSignature",
            );
            const signatureField = fields.find(
              (f: any) => f.fieldKey === "borrowerSignature",
            );

            return (
              <>
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

                {signatureField && (
                  <div className="mt-10 flex flex-col items-center">
                    <p className="text-sm font-semibold mb-3 text-slate-600 dark:text-slate-300">
                      Borrower Signature
                    </p>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
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
    );
  };

  const renderDocuments = () => {
    if (documentsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
          <p className="text-sm text-slate-500">Loading documents...</p>
        </div>
      );
    }

    if (!documentsData) {
      return (
        <div className="text-center py-16 text-slate-500">
          No document data available.
        </div>
      );
    }

    return (
      <div className="space-y-6">
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

        <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Document Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Uploads</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
                              const file = doc.uploadedFiles[0];
                              setPreviewFile({
                                url: `${API_BASE}${file.fileUrl}`,
                                type: file.fileMimeType,
                                name: file.fileName,
                              });
                            } else {
                              setMultiFileModal({
                                isOpen: true,
                                doc,
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
    );
  };

  const renderLoi = () => {
    if (loiLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
      );
    }

    if (!loiUrl) {
      return (
        <div className="text-center py-16 text-slate-500">
          LOI preview not available.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => handleDownload(loiUrl, "Loan-LOI.pdf")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold hover:bg-slate-200 transition"
          >
            <Download size={16} />
            Download
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 h-[70vh]">
          <iframe src={loiUrl} title="Loan LOI" className="w-full h-full" />
        </div>
      </div>
    );
  };

  if (!applicationLenderId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Application preview not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 md:p-6 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-[#18B6B4] transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#18B6B4] dark:text-[#6ee7e5]">
                Loan Preview
              </h1>
            </div>
          </div>
        </div>

        {submissionDetail && (
          <div
            className="mb-6 overflow-hidden rounded-[30px] border border-white/30 
  bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_28%),linear-gradient(135deg,_#1d4ed8_0%,_#0f766e_55%,_#0891b2_100%)] 
  p-6 text-white"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Metric
                label="Application ID"
                value={
                  submissionDetail.loanApplication?.applicationNumber || "-"
                }
              />

              <Metric label="Status" value={submissionDetail.status || "-"} />

              <Metric
                label="Loan Product"
                value={submissionDetail.loanApplication?.loanProductCode || "-"}
              />

              <Metric
                label="Broker"
                value={submissionDetail.loanApplication?.brokerOrg?.name || "-"}
              />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 pt-4">
            <div className="flex flex-wrap gap-2">
              {tabMeta
                .filter((tab) => tab.id !== "loi" || isLoi)
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? "bg-[#18B6B4] text-white shadow-sm"
                        : "text-slate-500 hover:text-[#18B6B4] bg-slate-50 dark:bg-slate-800/70 dark:text-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="p-4 md:p-6">
            {activeTab === "details" && renderDetails()}
            {activeTab === "documents" && renderDocuments()}
            {activeTab === "loi" && renderLoi()}
          </div>
        </div>
      </div>

      {multiFileModal.isOpen &&
        multiFileModal.doc &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold">Select File to Preview</h2>
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

      {previewFile &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 shrink-0">
                <div>
                  <h2 className="text-lg font-bold truncate max-w-md dark:text-white">
                    {previewFile.name}
                  </h2>
                  <p className="text-xs text-slate-500">{previewFile.type}</p>
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
  );
}
