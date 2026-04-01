import {
  ArrowLeft,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type SubmissionField = {
  fieldId: string | null;
  fieldKey: string | null;
  value: string;
};

type UploadedPreview = {
  url: string;
  type: string;
  name: string;
};

type TabKey = "view-details" | "request-document" | "view-loi" | "documents";

const parseValue = (val: string): any => {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const getFieldValue = (fields: SubmissionField[], key: string) => {
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

const formatFieldKey = (key: string | null | undefined) => {
  if (!key) return "";

  return key
    .replace(/^coBorrower_\d+_/, "coBorrower_")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getStatusChip = (status?: string) => {
  switch (status) {
    case "NEW":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
    case "SENT":
      return "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";
    case "APPROVED":
      return "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400";
    case "DECLINED":
      return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }
};

const LoanPreview = () => {
  const { submittedid } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>("view-details");
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [requestDocs, setRequestDocs] = useState<any[]>([]);
  const [requestDocsLoading, setRequestDocsLoading] = useState(false);
  const [requestDocsLoadedFor, setRequestDocsLoadedFor] = useState<
    string | null
  >(null);
  const [selectedRequestDocs, setSelectedRequestDocs] = useState<string[]>([]);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const [documentsData, setDocumentsData] = useState<any>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoadedFor, setDocumentsLoadedFor] = useState<string | null>(
    null,
  );
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>(
    {},
  );
  const [previewFiles, setPreviewFiles] = useState<
    Record<string, UploadedPreview[]>
  >({});

  const [lois, setLois] = useState<any[]>([]);
  const [loiLoading, setLoiLoading] = useState(false);
  const [loiLoadedFor, setLoiLoadedFor] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadedPreview | null>(null);

  const fields = submissionDetail?.fields || [];
  const applicationId = submissionDetail?.applicationId;
  const submissionId = submittedid;

  const fetchSubmissionDetails = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/public/broker/applications/submissions/${id}`,
      );
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.message || "Failed to fetch submission");
      setSubmissionDetail(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch submission details");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentTypes = async (id: string) => {
    try {
      setRequestDocsLoading(true);
      const res = await fetch(`${API_BASE}/document-types/active`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch document types");
      }
      const formattedDocs = json.data.map((doc: any) => ({
        documentTypeId: doc.id,
        documentType: { name: doc.name },
      }));
      setRequestDocs(formattedDocs);
      setRequestDocsLoadedFor(id);
    } catch (err: any) {
      toast.error(err.message || "Failed to load documents");
    } finally {
      setRequestDocsLoading(false);
    }
  };

  const fetchSubmissionDocuments = async (id: string) => {
    try {
      setDocumentsLoading(true);
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/submissions/${id}/documents`,
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
      setDocumentsLoadedFor(id);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch documents");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const fetchLois = async (id: string) => {
    try {
      setLoiLoading(true);
      const submissionRes = await fetch(
        `${API_BASE}/api/public/broker/applications/submissions/${id}`,
      );
      const submissionJson = await submissionRes.json();
      if (!submissionRes.ok || !submissionJson.success) {
        throw new Error(submissionJson.message || "Failed to fetch submission");
      }
      const currentApplicationId = submissionJson?.data?.applicationId;
      if (!currentApplicationId) {
        throw new Error("Application ID not found");
      }
      const loiRes = await fetch(
        `${API_BASE}/broker/loan-pipeline/${currentApplicationId}/lois`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );
      const loiJson = await loiRes.json();
      if (!loiRes.ok || !loiJson.success) {
        throw new Error(loiJson.message || "Failed to fetch LOIs");
      }
      setLois(loiJson.data?.lois || []);
      setLoiLoadedFor(id);
    } catch (err: any) {
      toast.error(err.message || "Failed to load LOIs");
    } finally {
      setLoiLoading(false);
    }
  };

  const handleRequestDocuments = async () => {
    if (!applicationId) return;
    if (selectedRequestDocs.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    try {
      setRequestSubmitting(true);
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${applicationId}/request-documents`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            documentTypeIds: selectedRequestDocs,
            message: requestMessage || "Please upload these documents urgently",
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to request documents");
      }
      toast.success("Documents requested successfully");
      setSelectedRequestDocs([]);
      setRequestMessage("");
      if (submissionId) {
        fetchSubmissionDocuments(submissionId);
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleDocumentUpload = async (
    currentSubmissionId: string,
    requirementId: string,
  ) => {
    const filesForRequirement = selectedFiles[requirementId];
    if (!filesForRequirement || filesForRequirement.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    try {
      setUploadingDocId(requirementId);
      const token = sessionStorage.getItem("broker_token");

      for (const file of filesForRequirement) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `${API_BASE}/broker/loan-pipeline/submissions/${currentSubmissionId}/documents/${requirementId}/upload`,
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
      await fetchSubmissionDocuments(currentSubmissionId);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingDocId(null);
    }
  };

  useEffect(() => {
    setSubmissionDetail(null);
    setRequestDocs([]);
    setRequestDocsLoadedFor(null);
    setDocumentsData(null);
    setDocumentsLoadedFor(null);
    setLois([]);
    setLoiLoadedFor(null);
    setSelectedFiles({});
    setPreviewFiles({});
    setSelectedRequestDocs([]);
    setRequestMessage("");
    setActiveTab("view-details");

    if (submissionId) {
      fetchSubmissionDetails(submissionId);
    }
  }, [submissionId]);

  useEffect(() => {
    if (
      activeTab === "request-document" &&
      applicationId &&
      requestDocsLoadedFor !== applicationId
    ) {
      fetchDocumentTypes(applicationId);
    }
    if (
      activeTab === "documents" &&
      submissionId &&
      documentsLoadedFor !== submissionId
    ) {
      fetchSubmissionDocuments(submissionId);
    }
    if (
      activeTab === "view-loi" &&
      submissionId &&
      loiLoadedFor !== submissionId
    ) {
      fetchLois(submissionId);
    }
  }, [
    activeTab,
    applicationId,
    submissionId,
    requestDocsLoadedFor,
    documentsLoadedFor,
    loiLoadedFor,
  ]);

  const groupedFields = useMemo(() => {
    const signatureField = fields.find(
      (f: any) => f.fieldKey === "borrowerSignature",
    );
    const allFields = fields.filter(
      (f: any) => f.fieldKey !== "borrowerSignature",
    );
    const primaryFields: any[] = [];
    const coBorrowerGroups: Record<string, any[]> = {};
    const otherFields: any[] = [];

    allFields.forEach((field: any) => {
      const key = field.fieldKey || "";
      if (key.startsWith("coBorrower_")) {
        const match = key.match(/^coBorrower_(\d+)_/);
        if (match) {
          const index = match[1];
          if (!coBorrowerGroups[index]) {
            coBorrowerGroups[index] = [];
          }
          coBorrowerGroups[index].push(field);
        }
      } else if (
        key.startsWith("borrower") ||
        key === "city" ||
        key === "state" ||
        key === "isBroker"
      ) {
        primaryFields.push(field);
      } else {
        otherFields.push(field);
      }
    });

    return { signatureField, primaryFields, coBorrowerGroups, otherFields };
  }, [fields]);

  const loanAmount = Number(getFieldValue(fields, "amountRequested") ?? 0) || 0;
  const ltv = Number(getFieldValue(fields, "ltvPercentage") ?? 0) || 0;
  const ltc = Number(getFieldValue(fields, "ltcPercentage") ?? 0) || 0;
  const arv = Number(getFieldValue(fields, "arvPercentage") ?? 0) || 0;
  const dscr = Number(getFieldValue(fields, "dscr") ?? 0) || 0;
  const netWorth = Number(getFieldValue(fields, "netWorth") ?? 0) || 0;

  const submittedDate = submissionDetail?.submittedAt
    ? new Date(submissionDetail.submittedAt)
    : null;
  const firstReview = Array.isArray(submissionDetail?.lenders?.[0]?.reviews)
    ? submissionDetail.lenders[0].reviews[0] || null
    : null;

  const tabs = [
    {
      key: "view-details" as const,
      label: "View Details",
      icon: Eye,
      color: "text-blue-600",
    },
    {
      key: "request-document" as const,
      label: "Request Document",
      icon: Send,
      color: "text-emerald-600",
    },
    {
      key: "view-loi" as const,
      label: "View LOI",
      icon: FileText,
      color: "text-purple-600",
    },
    {
      key: "documents" as const,
      label: "Documents",
      icon: FolderOpen,
      color: "text-amber-600",
    },
  ];

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
        className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 cursor-pointer
       `}
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-r from-cyan-400/10 to-blue-500/10 blur-xl" />

        {/* Label */}
        <p
          className={`text-[11px] font-semibold uppercase tracking-widest transition
        ${
          isHero
            ? "text-white/70 group-hover:text-white"
            : "text-slate-500 group-hover:text-slate-700"
        }`}
        >
          {label}
        </p>

        {/* Value */}
        <p
          className={`mt-2 text-md font-bold transition-all duration-300
        ${
          isHero
            ? "text-white group-hover:scale-105"
            : "bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-cyan-500"
        }`}
        >
          {value}
        </p>

        {/* Bottom Accent Line */}
        <div
          className={`mt-3 h-[3px] w-0 rounded-full transition-all duration-300 group-hover:w-full
        ${
          isHero
            ? "bg-gradient-to-r from-white/80 to-cyan-300"
            : "bg-gradient-to-r from-cyan-500 to-blue-500"
        }`}
        />
      </motion.div>
    );
  };

  const FieldItem = ({ field }: { field: any }) => {
    const parsedValue = parseValue(field.value);
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase text-slate-500">
          {formatFieldKey(field.fieldKey)}
        </label>
        <div className="break-words rounded-lg border bg-slate-50 px-3 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-900">
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

  const renderViewDetails = () => (
    <div className="space-y-6">
      {firstReview && (
        <div
          className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm ${
            firstReview.reviewStatus === "APPROVED"
              ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/5"
              : firstReview.reviewStatus === "CONDITIONAL"
                ? "border-amber-400 bg-amber-50/60 dark:bg-amber-500/5"
                : "border-rose-400 bg-rose-50/60 dark:bg-rose-500/5"
          }`}
        >
          <div
            className={`absolute inset-x-0 top-0 h-1 ${
              firstReview.reviewStatus === "APPROVED"
                ? "bg-emerald-500"
                : firstReview.reviewStatus === "CONDITIONAL"
                  ? "bg-amber-500"
                  : "bg-rose-500"
            }`}
          />
          <div className="mb-6 flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white ${
                firstReview.reviewStatus === "APPROVED"
                  ? "bg-emerald-500"
                  : firstReview.reviewStatus === "CONDITIONAL"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            >
              {firstReview.reviewStatus === "APPROVED"
                ? "OK"
                : firstReview.reviewStatus === "CONDITIONAL"
                  ? "!"
                  : "NO"}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Lender Decision
              </p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {firstReview.reviewStatus === "DECLINED"
                  ? "REJECTED"
                  : firstReview.reviewStatus}
              </h3>
            </div>
          </div>
          <div className="grid gap-6 text-sm md:grid-cols-4">
            {firstReview.approvedAmount && (
              <div>
                <p className="mb-1 text-xs text-slate-500">Approved Amount</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  ${Number(firstReview.approvedAmount).toLocaleString()}
                </p>
              </div>
            )}
            {firstReview.interestRate && (
              <div>
                <p className="mb-1 text-xs text-slate-500">Interest Rate</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {firstReview.interestRate}%
                </p>
              </div>
            )}
            {firstReview.reviewedAt && (
              <div>
                <p className="mb-1 text-xs text-slate-500">
                  {firstReview.reviewStatus === "DECLINED"
                    ? "Rejected On"
                    : "Reviewed On"}
                </p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {new Date(firstReview.reviewedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          {firstReview.notes && (
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-2 text-xs text-slate-500">Notes</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {firstReview.notes}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-6 flex flex-col gap-3 text-sm font-medium md:flex-row md:items-center md:justify-between">
          <div>
            <span className="font-semibold">Application No:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">
              {submissionDetail?.applicationNumber || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status:</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${getStatusChip(submissionDetail?.status)}`}
            >
              {submissionDetail?.status === "DECLINED"
                ? "REJECTED"
                : submissionDetail?.status || "-"}
            </span>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-6 shadow-[0_18px_40px_rgba(14,116,144,0.08)] dark:border-blue-900/30 dark:bg-blue-950/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
            <Metric
              label="Loan Amount"
              value={`$${loanAmount.toLocaleString()}`}
              variant="panel"
            />
            <Metric
              label="LTV %"
              value={ltv ? `${ltv.toFixed(2)}%` : "-"}
              variant="panel"
            />
            <Metric
              label="LTC %"
              value={ltc ? `${ltc.toFixed(2)}%` : "-"}
              variant="panel"
            />
            <Metric
              label="ARV %"
              value={arv ? `${arv.toFixed(2)}%` : "-"}
              variant="panel"
            />
            <Metric
              label="DSCR"
              value={dscr ? dscr.toFixed(2) : "-"}
              variant="panel"
            />
            <Metric
              label="Net Worth"
              value={`$${netWorth.toLocaleString()}`}
              variant="panel"
            />
          </div>
        </div>

        <div className="space-y-10 rounded-xl border p-6 dark:border-slate-800">
          {groupedFields.primaryFields.length > 0 && (
            <div>
              <h3 className="mb-4 border-b pb-2 text-md font-bold">
                Primary Borrower
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                {groupedFields.primaryFields.map(
                  (field: any, index: number) => (
                    <FieldItem
                      key={`${field.fieldKey}-${index}`}
                      field={field}
                    />
                  ),
                )}
              </div>
            </div>
          )}

          {Object.keys(groupedFields.coBorrowerGroups).map((index) => (
            <div key={index}>
              <h3 className="mb-4 border-b pb-2 text-md font-bold">
                Co Borrower {index}
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                {groupedFields.coBorrowerGroups[index].map(
                  (field: any, fieldIndex: number) => (
                    <FieldItem
                      key={`${field.fieldKey}-${fieldIndex}`}
                      field={field}
                    />
                  ),
                )}
              </div>
            </div>
          ))}

          {groupedFields.otherFields.length > 0 && (
            <div>
              <h3 className="mb-4 border-b pb-2 text-md font-bold">
                Loan Details
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                {groupedFields.otherFields.map((field: any, index: number) => (
                  <FieldItem key={`${field.fieldKey}-${index}`} field={field} />
                ))}
              </div>
            </div>
          )}
        </div>

        {groupedFields.signatureField && (
          <div className="mt-8 space-y-4 text-center">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Digital Signature
            </h3>
            <div className="flex justify-center">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
                <img
                  src={parseValue(groupedFields.signatureField.value)}
                  alt="Digital Signature"
                  className="h-40 object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {submittedDate && (
          <div className="mt-8 flex flex-col justify-between gap-2 border-t pt-6 text-sm text-slate-600 dark:text-slate-400 md:flex-row">
            <div>
              <span className="font-semibold">Submitted Date:</span>{" "}
              {submittedDate.toLocaleDateString()}
            </div>
            <div>
              <span className="font-semibold">Submitted Time:</span>{" "}
              {submittedDate.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderRequestDocument = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
            Select Documents
          </h2>
          <p className="text-sm text-gray-500">
            Select which documents are required.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              setSelectedRequestDocs(
                requestDocs.map((doc: any) => doc.documentTypeId),
              )
            }
            className="rounded-md border bg-gray-50 px-3 py-1 text-xs hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedRequestDocs([])}
            className="rounded-md border bg-gray-50 px-3 py-1 text-xs hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900"
          >
            Clear
          </button>
        </div>
      </div>

      {requestDocsLoading ? (
        <div className="py-10 text-center text-gray-500">
          Loading documents...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {requestDocs.map((doc: any) => {
              const isSelected = selectedRequestDocs.includes(
                doc.documentTypeId,
              );
              return (
                <div
                  key={doc.documentTypeId}
                  onClick={() => {
                    setSelectedRequestDocs((prev) =>
                      isSelected
                        ? prev.filter((id) => id !== doc.documentTypeId)
                        : [...prev, doc.documentTypeId],
                    );
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : "border-gray-200 hover:border-gray-300 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    <span className="text-sm text-gray-700 dark:text-slate-200">
                      {doc.documentType.name}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="accent-emerald-600"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-200">
              Message
            </label>
            <textarea
              placeholder="Enter a message for the client (optional)..."
              className="min-h-[90px] w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400">
              This message will be sent along with the document request.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {selectedRequestDocs.length} selected
            </p>
            <button
              onClick={handleRequestDocuments}
              disabled={selectedRequestDocs.length === 0 || requestSubmitting}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {requestSubmitting ? "Requesting..." : "Request Documents"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderViewLoi = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold dark:text-white">
            Letters of Intent
          </h2>
          <p className="text-sm text-slate-500">
            Available lender LOIs for this submission.
          </p>
        </div>
      </div>

      {loiLoading ? (
        <div className="py-10 text-center text-slate-500">Loading LOIs...</div>
      ) : lois.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10">
            <FileText className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            No LOIs Available
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            No lenders have issued a Letter of Intent for this application yet.
            Once available, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lois.map((loi, index) => (
            <div
              key={`${loi.lenderName}-${index}`}
              className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {loi.lenderName}
                </h3>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-600">
                  {loi.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-300">
                    Email
                  </span>
                  <div className="dark:text-slate-400">
                    {loi.lenderEmail || "-"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-300">
                    Phone
                  </span>
                  <div className="dark:text-slate-400">
                    {loi.lenderPhone || "-"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-300">
                    Approved Amount
                  </span>
                  <div className="dark:text-slate-400">
                    {loi.approvedAmount
                      ? `$${Number(loi.approvedAmount).toLocaleString()}`
                      : "-"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-300">
                    Interest Rate
                  </span>
                  <div className="dark:text-slate-400">
                    {loi.interestRate ? `${loi.interestRate}%` : "-"}
                  </div>
                </div>
              </div>

              {loi.notes && (
                <div className="text-sm">
                  <span className="text-slate-500 dark:text-slate-300">
                    Notes
                  </span>
                  <p className="mt-1 dark:text-slate-400">{loi.notes}</p>
                </div>
              )}

              <div className="flex justify-end border-t pt-3 dark:border-slate-800">
                <button
                  onClick={() =>
                    setPreviewFile({
                      url: `${API_BASE}/public${loi.loiUrl}`,
                      type: "application/pdf",
                      name: `${loi.lenderName} LOI`,
                    })
                  }
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
                >
                  View LOI PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDocuments = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-wide text-slate-700 dark:text-slate-200">
          Requested Documents
        </h2>
        <p className="text-sm text-slate-500">
          Upload and review the requested submission documents.
        </p>
      </div>

      {documentsLoading ? (
        <div className="py-10 text-center text-slate-500">
          Loading documents...
        </div>
      ) : documentsData?.documents?.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {documentsData.documents.map((doc: any, index: number) => {
            const hasFiles = doc.uploadedFiles && doc.uploadedFiles.length > 0;
            return (
              <div
                key={`${doc.requirementId}-${index}`}
                className="flex h-[320px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-200">
                    {doc.documentName}
                  </h3>
                  {(previewFiles[doc.requirementId]?.length > 0 ||
                    selectedFiles[doc.requirementId]?.length > 0) && (
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
                      className="rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {!hasFiles ? (
                  <div className="flex flex-1 flex-col overflow-hidden">
                    {previewFiles[doc.requirementId]?.length > 0 && (
                      <div className="mb-3 flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1">
                        {previewFiles[doc.requirementId].map(
                          (file, fileIndex) => (
                            <div
                              key={`${file.name}-${fileIndex}`}
                              className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border-2 border-blue-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                            >
                              {file.type.startsWith("image") ? (
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : file.type.includes("pdf") ? (
                                <div className="text-xs font-semibold text-red-500">
                                  PDF
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500">
                                  File
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewFiles((prev) => {
                                    const updated = [
                                      ...(prev[doc.requirementId] || []),
                                    ];
                                    updated.splice(fileIndex, 1);
                                    const copy = { ...prev };
                                    if (updated.length === 0) {
                                      delete copy[doc.requirementId];
                                    } else {
                                      copy[doc.requirementId] = updated;
                                    }
                                    return copy;
                                  });
                                  setSelectedFiles((prev) => {
                                    const updated = [
                                      ...(prev[doc.requirementId] || []),
                                    ];
                                    updated.splice(fileIndex, 1);
                                    const copy = { ...prev };
                                    if (updated.length === 0) {
                                      delete copy[doc.requirementId];
                                    } else {
                                      copy[doc.requirementId] = updated;
                                    }
                                    return copy;
                                  });
                                }}
                                className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white transition hover:bg-red-500"
                              >
                                x
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {!selectedFiles[doc.requirementId] && (
                      <label className="flex h-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-amber-400 dark:border-slate-700">
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => {
                            const fileList = Array.from(e.target.files || []);
                            if (!fileList.length) return;
                            const validFiles: File[] = [];
                            const previews: UploadedPreview[] = [];

                            fileList.forEach((file) => {
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error(`${file.name} exceeds 5MB limit`);
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
                                ...(prev[doc.requirementId] || []),
                                ...validFiles,
                              ],
                            }));
                            setPreviewFiles((prev) => ({
                              ...prev,
                              [doc.requirementId]: [
                                ...(prev[doc.requirementId] || []),
                                ...previews,
                              ],
                            }));
                          }}
                        />
                        <p className="text-xs font-medium text-amber-600">
                          Click to Select File
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          PDF / JPG / PNG (Max 5MB)
                        </p>
                      </label>
                    )}

                    {selectedFiles[doc.requirementId]?.length > 0 && (
                      <button
                        onClick={() =>
                          handleDocumentUpload(
                            documentsData.submissionId,
                            doc.requirementId,
                          )
                        }
                        disabled={uploadingDocId === doc.requirementId}
                        className="mt-auto w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {uploadingDocId === doc.requirementId ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading...
                          </span>
                        ) : (
                          "Upload Document"
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex w-full flex-wrap gap-2 overflow-y-auto pr-1">
                    {doc.uploadedFiles.map((file: any, fileIndex: number) => {
                      const isImage = file.fileMimeType?.startsWith("image");
                      return (
                        <div
                          key={`${file.fileName}-${fileIndex}`}
                          className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border-2 border-[#98bfe1] bg-slate-100 dark:bg-slate-800"
                        >
                          {isImage ? (
                            <img
                              src={`${API_BASE}${file.fileUrl}`}
                              alt={file.fileName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="text-xs text-slate-600 dark:text-slate-300">
                              PDF
                            </div>
                          )}
                          <a
                            href={`${API_BASE}${file.fileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white opacity-0 transition hover:opacity-100"
                          >
                            View
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-auto pt-3">
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] ${
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
          })}
        </div>
      ) : (
        <div className="py-10 text-center text-slate-500">
          No documents found
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "request-document":
        return renderRequestDocument();
      case "view-loi":
        return renderViewLoi();
      case "documents":
        return renderDocuments();
      default:
        return renderViewDetails();
    }
  };

  if (!submissionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Submission not found
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The preview URL is missing a submitted id.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-6 dark:bg-[#0b1120] dark:text-slate-100">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400"
              >
                <ArrowLeft size={16} /> Back to Submitted Applications
              </button>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Loan Application Preview
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {submissionDetail?.applicationNumber || submissionId}
              </p>
            </div>

            <div className="flex gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusChip(submissionDetail?.status)}`}
              >
                {submissionDetail?.status === "DECLINED"
                  ? "REJECTED"
                  : submissionDetail?.status || "Draft"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading...</div>
          ) : (
            <>
              <div className="mb-6 overflow-hidden rounded-[30px] border border-white/30 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_28%),linear-gradient(135deg,_#1d4ed8_0%,_#0f766e_55%,_#0891b2_100%)] p-6 text-white shadow-[0_24px_60px_rgba(8,145,178,0.28)]">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Metric label="LTV" value={ltv ? `${ltv}%` : "-"} />
                  <Metric label="LTC" value={ltc ? `${ltc}%` : "-"} />
                  <Metric label="ARV %" value={arv ? `${arv}%` : "-"} />
                  <Metric label="DSCR Ratio" value={dscr ? `${dscr}` : "-"} />
                  <Metric
                    label="Net Worth"
                    value={netWorth ? `$${netWorth}` : "-"}
                  />
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          : "text-slate-500 hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
                      }`}
                    >
                      <span
                        className={`rounded-md p-1 ${isActive ? "bg-slate-100 dark:bg-slate-800" : "bg-slate-100/70 dark:bg-slate-800/70"}`}
                      >
                        <Icon size={14} className={tab.color} />
                      </span>
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {renderTabContent()}
            </>
          )}
        </div>
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b px-6 py-3 dark:border-slate-800">
              <div>
                <h2 className="max-w-md truncate text-lg font-bold dark:text-white">
                  {previewFile.name}
                </h2>
                <p className="text-xs text-slate-500">PDF Preview</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(previewFile.url);
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = previewFile.name || "LOI.pdf";
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error("Download failed", err);
                    }
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Download
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950">
              <iframe
                src={`https://docs.google.com/gview?url=${previewFile.url}&embedded=true`}
                title={previewFile.name}
                className="h-full w-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LoanPreview;
