import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  FileIcon,
  FileText,
  Loader2,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import Chat from "./Chat";
import { MdEmail } from "react-icons/md";
import { BiLogoProductHunt } from "react-icons/bi";
import { FaDollarSign } from "react-icons/fa6";

type PreviewTab = "details" | "documents" | "requestDocs" | "loi" | "chat";

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

const normalizeText = (value: unknown) => String(value || "").trim();

const getSubmissionFieldValue = (submissionDetail: any, ...keys: string[]) => {
  const fields =
    submissionDetail?.loanApplication?.submissions?.[0]?.fields || [];

  return fields.find((field: any) => keys.includes(field.fieldKey))?.value;
};

const getBorrowerDisplayName = (submissionDetail: any) => {
  const firstName = normalizeText(
    getSubmissionFieldValue(
      submissionDetail,
      "borrowerFirstName",
      "firstName",
      "first_name",
    ),
  );
  const lastName = normalizeText(
    getSubmissionFieldValue(
      submissionDetail,
      "borrowerLastName",
      "lastName",
      "last_name",
    ),
  );

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  const borrowerName = normalizeText(
    getSubmissionFieldValue(
      submissionDetail,
      "borrowerName",
      "applicantName",
      "fullName",
      "name",
    ),
  );

  if (borrowerName) {
    return borrowerName;
  }

  const legalName = normalizeText(
    submissionDetail?.loanApplication?.client?.legalName,
  );

  if (
    legalName &&
    legalName !== "Applicant" &&
    legalName !== "Individual Applicant"
  ) {
    return legalName;
  }

  return "N/A";
};

const getBorrowerEntityType = (submissionDetail: any) =>
  normalizeText(
    submissionDetail?.loanApplication?.client?.entityType ||
      getSubmissionFieldValue(
        submissionDetail,
        "entityType",
        "borrowerEntityType",
        "businessType",
      ) ||
      "-",
  );

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
    <p className="text-sm font-semibold break-words">
      {typeof value === "string"
        ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : (value ?? "-")}
    </p>
  </div>
);

const tabMeta: Array<{ id: PreviewTab; label: string }> = [
  { id: "details", label: "View Details" },
  { id: "documents", label: "Documents" },
  { id: "requestDocs", label: "Request Documents" },
  { id: "loi", label: "View LOI" },
  { id: "chat", label: "Chat" },
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

  const initialTab: PreviewTab = [
    "details",
    "documents",
    "requestDocs",
    "loi",
    "chat",
  ].includes(requestedTab)
    ? (requestedTab as PreviewTab)
    : "details";

  const [activeTab, setActiveTab] = useState<PreviewTab>(initialTab);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [loiLoading, setLoiLoading] = useState(false);
  const [loiUrl, setLoiUrl] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [customDocs, setCustomDocs] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [selectedLoanProduct, setSelectedLoanProduct] = useState("");
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
  const [docSelectModal, setDocSelectModal] = useState({
    documents: [] as any[],
    selectedDocs: [] as string[],
    loading: false,
  });
  const [requestLoading, setRequestLoading] = useState(false);

  const handleAddCustomDoc = () => {
    if (!customInput.trim()) return;

    setCustomDocs((prev) => {
      if (prev.includes(customInput.trim())) return prev; // prevent duplicate
      return [...prev, customInput.trim()];
    });

    setCustomInput("");
  };

  const removeCustomDoc = (index: number) => {
    setCustomDocs((prev) => prev.filter((_, i) => i !== index));
  };

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

  const PRODUCT_LABELS: Record<string, string> = {
    FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "FIX & FLIP",
    DSCR_LOAN_1_TO_4_UNITS: "DSCR",
    CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION",
    BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE LOAN",
    SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
    USDA_BI: "USDA B&I",
    AGENCY_LOAN_MULTIFAMILY: "AGENCY MULTIFAMILY",
    CRE_PERMANENT_LOAN: "CRE PERMANENT",
    RENTAL_PORTFOLIO: "RENTAL PORTFOLIO",
    PURCHASE_ORDER_FINANCE: "PURCHASE ORDER FINANCE",
    ACCOUNTS_PAYABLE_FINANCE: "AP SUPPLY CHAIN",
    ACCOUNTS_RECEIVABLE: "ACCOUNTS RECEIVABLE",
    INVOICE_FACTORING: "AR FACTORING",
  };

  const Metric = ({ label, value }: any) => {
    return (
      <div className="flex flex-col gap-1 border-r border-white/20 pr-4 last:border-none">
        <span className="text-xs uppercase tracking-wider text-white/70 font-medium">
          {label}
        </span>

        <span className="text-md font-bold tracking-tight">{value}</span>
      </div>
    );
  };

  const fetchLoanProducts = async () => {
    try {
      setLoadingProducts(true);

      const res = await fetch(`${API_BASE}/lender/loan-products/list`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to fetch loan products");
      }

      setLoanProducts(json.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load loan products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchDocumentsByProduct = async (code: string) => {
    try {
      setDocSelectModal((prev) => ({ ...prev, loading: true }));

      const res = await fetch(
        `${API_BASE}/lender/document-config/list?loanProductCode=${code}`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error("Failed to load documents");
        return;
      }

      setDocSelectModal((prev) => ({
        ...prev,
        documents: json.data || [],
        selectedDocs: [],
        loading: false,
      }));
    } catch (err) {
      console.error(err);
      setDocSelectModal((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (applicationLenderId && !submissionDetail) {
      fetchLenderApplicationDetail();
    }
  }, [applicationLenderId]);

  useEffect(() => {
    if (!selectedLoanProduct) {
      setDocSelectModal({
        documents: [],
        selectedDocs: [],
        loading: false,
      });
    }
  }, [selectedLoanProduct]);

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

  const amountField =
    submissionDetail?.loanApplication?.submissions?.[0]?.fields?.find(
      (f: any) => f.fieldKey === "amountRequested",
    );

  const fetchDocuments = async () => {
    if (!applicationLenderId) return;
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

  const fetchDocumentConfig = async () => {
    try {
      setDocSelectModal((prev) => ({ ...prev, loading: true }));

      const res = await fetch(`${API_BASE}/lender/document-config/list`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to fetch documents");
      }

      const loanType = submissionDetail?.loanApplication?.loanProductCode;

      const filtered = json.data.filter(
        (doc: any) => doc.lenderProduct.loanProductCode === loanType,
      );

      setDocSelectModal({
        documents: filtered,
        selectedDocs: [],
        loading: false,
      });
    } catch (err: any) {
      console.error(err.message);
      // toast.error(err.message);
      setDocSelectModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleRequestDocuments = async () => {
    try {
      setRequestLoading(true);

      const payload = {
        decision: "CONDITIONAL",
        notes: "Please upload required documents",

        documentTypeIds: docSelectModal.selectedDocs,

        customDocuments: customDocs,
      };

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/decision`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message);
      }

      toast.success("Documents requested");

      // reset selection
      setDocSelectModal((prev) => ({
        ...prev,
        selectedDocs: [],
      }));

      setCustomDocs([]);
      setCustomInput("");

      // IMPORTANT
      setDocumentsData(null);

      await fetchDocuments();

      setSubmissionDetail(null);
      await fetchLenderApplicationDetail();

      setActiveTab("documents");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRequestLoading(false);
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
    fetchLoanProducts();
  }, []);

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

  useEffect(() => {
    if (activeTab === "requestDocs" && docSelectModal.documents.length === 0) {
      fetchDocumentConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedLoanProduct) {
      fetchDocumentsByProduct(selectedLoanProduct);
    }
  }, [selectedLoanProduct]);

  const resolvedChatApplicationId =
    submissionDetail?.loanApplication?.id ||
    submissionDetail?.loanApplicationId ||
    submissionDetail?.loanApplication?.loanApplicationId ||
    "";

  const renderChat = () => {
    if (!resolvedChatApplicationId) {
      return (
        <div className="text-center py-16 text-slate-500">
          Chat is not available for this application yet.
        </div>
      );
    }

    return <Chat applicationId={resolvedChatApplicationId} />;
  };

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
            const latestReview = submissionDetail?.lenderReviews?.[0];

            if (!latestReview) return null;

            const review = latestReview;
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
                className={`relative overflow-hidden rounded-2xl border p-6 dark:bg-slate-900 ${
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
            value={
              PRODUCT_LABELS[
                submissionDetail.loanApplication?.loanProductCode
              ] || submissionDetail.loanApplication?.loanProductCode
            }
          />
          <InfoCard
            label="Borrower"
            value={getBorrowerDisplayName(submissionDetail)}
          />
          <InfoCard
            label="Entity Type"
            value={getBorrowerEntityType(submissionDetail)}
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
                          {field.fieldKey === "amountRequested"
                            ? "Loan Amount Requested"
                            : formatFieldKey(field.fieldKey)}
                        </p>
                        <p className="text-sm font-medium break-words">
                          {field.fieldKey === "loanProductCode"
                            ? PRODUCT_LABELS[value] || value
                            : typeof value === "string"
                              ? value
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())
                              : String(value ?? "-")}
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

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
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
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
          <p className="text-sm text-slate-500">Loading documents...</p>
        </div>
      );
    }

    if (!documentsData) {
      return (
        <div className="text-center py-20 text-slate-400">
          No document data available.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 border dark:border-slate-700">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Pending Documents
            </p>
            <p className="text-xl font-bold text-amber-600 mt-1">
              {documentsData.documentsPendingCount}
            </p>
          </div>

          <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border dark:border-slate-700">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Total Documents
            </p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {documentsData.documents?.length || 0}
            </p>
          </div>
        </div>

        {/* TABLE CARD */}
        <div className="rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden dark:border-slate-700">
          <div className="px-5 py-4 border-b dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Documents List
            </h2>
          </div>

          <table className="w-full text-left">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3">Document</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Source</th>
                <th className="px-5 py-3 text-center">Uploads</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-slate-800">
              {documentsData.documents?.map((doc: any) => (
                <tr
                  key={doc.requirementId}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all"
                >
                  {/* 📄 DOCUMENT INFO */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                        {doc.documentName}
                      </span>

                      {doc.isRequired && (
                        <span className="mt-1 text-rose-500 font-semibold text-[11px]">
                          Required
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 📊 STATUS */}
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        doc.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : doc.status === "PARTIAL"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {doc.source === "BROKER_ADDED" ? (
                      <span
                        className="inline-flex items-center rounded-full 
      bg-blue-100 px-3 py-1 text-[11px] font-semibold 
      text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                      >
                        Broker
                      </span>
                    ) : doc.source === "SUB_BROKER_ADDED" ? (
                      <span
                        className="inline-flex items-center rounded-full 
  bg-emerald-100 px-3 py-1 text-[11px] font-semibold 
  text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        Sub Broker
                      </span>
                    ) : doc.source === "LENDER_ADDED" ? (
                      <span
                        className="inline-flex items-center rounded-full 
      bg-purple-100 px-3 py-1 text-[11px] font-semibold 
      text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
                      >
                        Lender
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full 
      bg-slate-100 px-3 py-1 text-[11px] font-semibold 
      text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                      >
                        {doc.source}
                      </span>
                    )}
                  </td>

                  {/* COUNT */}
                  <td className="px-5 py-4 text-center">
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      {doc.uploadedCount}
                    </span>
                  </td>

                  {/* ACTION  */}
                  <td className="px-5 py-4 text-right">
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
                        className="
        group inline-flex items-center gap-2
        rounded-xl border border-blue-200
        bg-gradient-to-r from-blue-50 to-indigo-50
        px-3 py-2
        text-blue-700
        transition-all duration-300
        hover:-translate-y-0.5
        hover:border-blue-500
        hover:bg-blue-600
  
        hover:shadow-md
        dark:border-blue-500/20
        dark:from-blue-500/10
        dark:to-indigo-500/10
        dark:text-blue-300
        dark:hover:bg-blue-500
      "
                      >
                        <Eye
                          size={14}
                          className="transition-transform duration-300 group-hover:scale-110"
                        />

                        <span className="text-[11px] font-semibold tracking-wide">
                          View
                          {doc.uploadedCount > 1 && ` (${doc.uploadedCount})`}
                        </span>
                      </button>
                    ) : (
                      <span
                        className="
        inline-flex items-center rounded-lg
        bg-slate-100 px-3 py-1.5
        text-[11px] font-medium italic
        text-slate-400
        dark:bg-slate-800
        dark:text-slate-500
      "
                      >
                        No Files
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  const handleClearCustomDocs = () => {
    setCustomDocs([]);
  };

  const renderRequestDocs = () => {
    return (
      <div
        className="mx-auto rounded-2xl p-6 space-y-6 
  bg-white dark:bg-slate-800/60
  border border-stroke dark:border-slate-700"
      >
        {/* LOAN PRODUCT SELECT */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">
            LOAN PROGRAM
          </label>

          <div className="relative">
            <select
              value={selectedLoanProduct}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedLoanProduct(value);

                if (!value) {
                  setDocSelectModal({
                    documents: [],
                    selectedDocs: [],
                    loading: false,
                  });
                }
              }}
              disabled={loadingProducts}
              className="w-full px-4 py-2 text-sm rounded-xl border border-gray-200 bg-white 
    focus:ring-2 focus:ring-[#18B6B4] outline-none appearance-none
    disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:disabled:bg-slate-700/50"
            >
              <option value="">
                {loadingProducts
                  ? "Loading loan products..."
                  : "Select loan program"}
              </option>

              {!loadingProducts &&
                loanProducts.map((lp) => (
                  <option key={lp.id} value={lp.loanProductCode}>
                    {lp.loanProduct?.name || lp.name}
                  </option>
                ))}
            </select>

            {/* RIGHT ICON */}
            <div className="absolute right-3 top-2.5 text-gray-400 flex items-center gap-2">
              {loadingProducts && (
                <Loader2 className="w-4 h-4 animate-spin text-[#18B6B4]" />
              )}
            </div>
          </div>
        </div>

        {/* HEADER */}
        {selectedLoanProduct && docSelectModal.documents.length > 0 && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Select Documents</h2>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  setDocSelectModal((prev) => ({
                    ...prev,
                    selectedDocs:
                      prev.documents?.map(
                        (d: any) => d.documentTypeId || d.id,
                      ) || [],
                  }))
                }
                className="px-3 py-1.5 text-xs rounded-lg bg-[#0F766E] text-white dark:bg-[#0F766E]/80 dark:hover:bg-[#0F766E] transition-all"
              >
                Select All
              </button>

              <button
                onClick={() =>
                  setDocSelectModal((prev) => ({
                    ...prev,
                    selectedDocs: [],
                  }))
                }
                className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {selectedLoanProduct && (
          <p className="text-sm text-slate-500">
            Select configured documents or add custom document requests.
          </p>
        )}

        {/* 🔥 LOADING */}
        {docSelectModal.loading && (
          <div className="text-center py-10 text-slate-400">
            Loading documents...
          </div>
        )}

        {/* EMPTY */}
        {!docSelectModal.loading &&
          selectedLoanProduct &&
          docSelectModal.documents.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-12 px-6 text-center 
  border-2 border-dashed border-[#18B6B4]/40 rounded-2xl 
  bg-gradient-to-br from-[#e6f7f7] to-white 
  dark:from-slate-800 dark:to-slate-900"
            >
              {/* ICON */}
              <div className="w-14 h-14 rounded-full bg-[#18B6B4]/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-[#18B6B4]" />
              </div>

              {/* TITLE */}
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No Documents Available
              </p>

              {/* SUBTEXT */}
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                There are no documents configured for the selected loan program.
              </p>
            </div>
          )}

        {/* DOCUMENT CARDS */}
        {!docSelectModal.loading &&
          selectedLoanProduct &&
          docSelectModal.documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 dark:scrollbar-thumb-slate-700/80 dark:scrollbar-track-slate-800/50 scrollbar-thin scrollbar-thumb-rounded-full">
              {docSelectModal.documents.map((doc: any) => {
                const docId = doc.documentTypeId ?? doc.id ?? doc._id;
                if (!docId) return null;
                const isChecked =
                  docSelectModal.selectedDocs?.includes(docId) ?? false;

                return (
                  <div
                    key={docId}
                    onClick={() => {
                      const updated = isChecked
                        ? docSelectModal.selectedDocs.filter(
                            (id) => id !== docId,
                          )
                        : [
                            ...new Set([
                              ...(docSelectModal.selectedDocs || []),
                              docId,
                            ]),
                          ];

                      setDocSelectModal((prev) => ({
                        ...prev,
                        selectedDocs: updated,
                      }));
                    }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200
          ${
            isChecked
              ? "border-[#18B6B4] bg-[#e6f7f7]"
              : "border-gray-200 hover:border-[#18B6B4]"
          }`}
                  >
                    {/* LEFT */}
                    <div className="flex items-center gap-2 min-w-0">
                      {/* ICON */}
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0
              ${
                isChecked
                  ? "bg-[#18B6B4] text-white"
                  : "bg-blue-50 text-blue-500"
              }`}
                      >
                        <FileText size={16} />
                      </div>

                      {/* TEXT */}
                      <div className="min-w-0">
                        <div className="min-w-0">
                          {/* MAIN NAME (DOCUMENT NAME) */}
                          <p
                            className={`text-xs font-semibold text-gray-800 truncate dark:text-[#18B6B4]`}
                          >
                            {doc.documentName || doc.documentType?.name}
                          </p>

                          {/* SUB TEXT */}
                          <p className="text-[10px] text-gray-400 truncate">
                            {doc.documentType?.name}
                          </p>

                          {/* REQUIRED / OPTIONAL */}
                          {/* <p className="text-[9px] text-gray-400">
                            {doc.isRequired ? "Required" : "Optional"}
                          </p> */}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-2">
                      {/* {doc.isRequired && (
                        <span className="text-[9px] px-1.5 py-[2px] rounded bg-red-50 text-red-500 font-semibold">
                          Req
                        </span>
                      )} */}

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition
              ${
                isChecked
                  ? "bg-[#18B6B4] border-[#18B6B4]"
                  : "border-gray-300 group-hover:border-[#18B6B4]"
              }`}
                      >
                        {isChecked && (
                          <Check size={10} className="text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        <div className="space-y-3">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-semibold">
                CD
              </div>
              <p className="text-xs font-semibold text-gray-500 tracking-wide">
                CUSTOM DOCUMENTS
              </p>
            </div>

            {/* CLEAR BUTTON (only when 3+ docs) */}
            {customDocs.length > 2 && (
              <button
                onClick={handleClearCustomDocs}
                className="text-[10px] px-2 py-1 rounded-md bg-red-50 text-red-600 font-semibold hover:bg-red-600 hover:text-white transition flex items-center gap-1"
              >
                Clear All
              </button>
            )}
          </div>

          {/* BOX */}
          <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 dark:border-slate-700">
            {/* EXISTING CUSTOM DOCS */}
            {customDocs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customDocs.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-xs dark:text-slate-200 dark:bg-slate-700/50"
                  >
                    <span>{doc}</span>

                    <button
                      onClick={() => removeCustomDoc(index)}
                      className="text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* INPUT + ADD */}
            <div className="flex items-center gap-2">
              <input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomDoc();
                  }
                }}
                placeholder="Enter custom document..."
                className="flex-1 text-sm px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />

              <button
                onClick={handleAddCustomDoc}
                className="text-sm px-3 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition"
              >
                + Add
              </button>
            </div>

            {/* EMPTY STATE */}
            {/* {customDocs.length === 0 && (
              <button
                onClick={handleAddCustomDoc}
                className="text-sm text-purple-600 font-medium hover:underline"
              >
                + Add Document
              </button>
            )} */}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <p className="text-sm text-slate-500">
            {docSelectModal.selectedDocs?.length || 0} selected
          </p>

          <button
            onClick={handleRequestDocuments}
            disabled={
              requestLoading ||
              ((docSelectModal.selectedDocs?.length || 0) === 0 &&
                customDocs.length === 0)
            }
            className="px-5 py-2 rounded-xl bg-[#0F766E] text-white font-medium disabled:opacity-40"
          >
            {requestLoading ? "Requesting..." : "Request Documents"}
          </button>
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

  const getFieldValue = (key: string) => {
    return getSubmissionFieldValue(submissionDetail, key);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 md:p-6 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* LEFT SIDE */}
            <div className="flex items-start gap-3">
              {/* Back Button */}
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#18B6B4] transition-all"
              >
                <ArrowLeft size={18} />
              </button>

              {/* Title Section */}
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                  Loan Application Preview
                </h1>

                {/* Application ID */}
                <p className="text-xs text-slate-500 mt-1">
                  {submissionDetail?.loanApplication?.applicationNumber}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Borrower: {getBorrowerDisplayName(submissionDetail)}
                  {/* {" • "}
                  {getBorrowerEntityType(submissionDetail)} */}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-xs bg-gray-100 border-2 px-2 py-1 rounded-md text-purple-700 font-semibold">
              {submissionDetail && submissionDetail?.status}
            </h1>
          </div>
        </div>

        <div>
          {submissionDetail?.loanApplication?.brokerOrg && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {/* BROKER NAME CHIP */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
    bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200
    dark:from-blue-900/30 dark:to-blue-800/20 dark:border-blue-800"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                  <User size={14} />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
        text-blue-500 dark:text-blue-400"
                  >
                    Broker Name
                  </span>
                  <span
                    className="text-sm font-semibold
        text-blue-900 dark:text-blue-100"
                  >
                    {submissionDetail.loanApplication.brokerOrg.name}
                  </span>
                </div>
              </div>

              {/* EMAIL CHIP */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
    bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200
    dark:from-emerald-900/30 dark:to-emerald-800/20 dark:border-emerald-800"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                  <MdEmail />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
        text-emerald-500 dark:text-emerald-400"
                  >
                    Email
                  </span>
                  <span
                    className="text-sm font-medium
        text-emerald-900 dark:text-emerald-100"
                  >
                    {submissionDetail.loanApplication.brokerOrg.email}
                  </span>
                </div>
              </div>

              {/* LOAN PRODUCT */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
    bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200
    dark:from-purple-900/30 dark:to-purple-800/20 dark:border-purple-800"
              >
                <div className="w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                  <BiLogoProductHunt size={14} />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
        text-purple-500 dark:text-purple-400"
                  >
                    Loan Product
                  </span>
                  <span
                    className="text-sm font-semibold
        text-purple-900 dark:text-purple-100"
                  >
                    {PRODUCT_LABELS[
                      submissionDetail.loanApplication.loanProductCode
                    ] ??
                      submissionDetail.loanApplication.loanProductCode
                        ?.replace(/_/g, " ")
                        .toUpperCase()}
                  </span>
                </div>
              </div>

              {/* LOAN AMOUNT */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
  bg-gradient-to-r from-orange-50 to-amber-100 border-orange-200
  dark:from-orange-900/30 dark:to-amber-800/20 dark:border-orange-800"
              >
                <div
                  className="w-7 h-7 rounded-full bg-orange-500 text-white
    flex items-center justify-center text-xs"
                >
                  <FaDollarSign />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
      text-orange-500 dark:text-orange-400"
                  >
                    Loan Amount Requested
                  </span>

                  <span
                    className="text-sm font-medium
      text-orange-900 dark:text-orange-100"
                  >
                    {amountField?.value
                      ? `$${Number(amountField.value).toLocaleString()}`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {submissionDetail && (
          <div
            className="mb-6 overflow-hidden rounded-[30px] border border-white/30 
            bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_28%),linear-gradient(135deg,_#1d4ed8_0%,_#0f766e_55%,_#0891b2_100%)] 
            px-6 py-8 text-white"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6">
              <Metric
                label="LTV"
                value={`${getFieldValue("ltvPercentage") ?? "-"}%`}
              />

              <Metric
                label="LTC"
                value={`${getFieldValue("ltcPercentage") ?? "-"}%`}
              />

              <Metric
                label="ARV %"
                value={`${getFieldValue("arvPercentage") ?? "-"}%`}
              />

              <Metric label="DSCR RATIO" value={getFieldValue("dscr") ?? "-"} />

              <Metric
                label="NET WORTH"
                value={`$${getFieldValue("netWorth") ?? "-"}`}
              />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 pt-4">
            <div className="flex flex-wrap gap-2">
              {tabMeta
                .filter((tab) => tab.id !== "loi" || isLoi)
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? "bg-[#18B6B4] text-white"
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
            {activeTab === "requestDocs" && renderRequestDocs()}
            {activeTab === "loi" && renderLoi()}
            {activeTab === "chat" && renderChat()}
          </div>
        </div>
      </div>

      {multiFileModal.isOpen &&
        multiFileModal.doc &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold">Select File to Preview</h2>
                  <p className="text-xs text-slate-500">
                    {multiFileModal.doc.documentType.name} (
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
            <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl flex flex-col h-[90vh] overflow-hidden">
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
    </div>
  );
}
