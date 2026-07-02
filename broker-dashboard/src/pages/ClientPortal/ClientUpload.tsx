import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Upload, FileText, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";
import FeeAgreement from "./FeeAgreement";
import { useRef } from "react";
import {
  FiUploadCloud,
  FiFileText,
  FiMessageCircle,
  FiLogOut,
  FiCreditCard,
  FiDollarSign,
  FiTag,
  FiUser,
  FiX,
  FiSearch,
  FiEye,
} from "react-icons/fi";
import Chat from "./Chat";
import ClientNotificationDropdown, {
  type ClientNotification,
} from "./ClientNotificationDropdown";
import {
  buildSubmissionFieldMap,
  getLatestSubmission,
  getNumericFieldValue,
  mapSubmissionDetailFields,
  parseNumericValue,
} from "../../lib/submissionFieldUtils";
import ClientSubmissionDetailsView from "../../components/submissions/ClientSubmissionDetailsView";
import {
  clearClientPortalSession,
  exitClientPortalImpersonation,
  isClientPortalImpersonationSession,
  isPlaceholderClientName,
  resolveClientProfileFromSession,
  saveClientPortalSession,
} from "../../lib/clientPortalSession";
import {
  formatClientPortalSubmittedDate,
  resolveClientSignableSubmission,
  submissionHasClientSignature,
} from "../../lib/clientPortalSignature";
import SignDocumentsPanel from "../../components/documents/SignDocumentsPanel";

/* ================= TYPES ================= */
const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

interface DocumentItem {
  id: string;
  name: string;
  status: "PENDING" | "UPLOADED" | string;
  uploadedFiles: Array<
    | string
    | {
        fileName?: string;
        fileUrl?: string;
        uploadedAt?: string;
      }
  >;
  required: boolean;
}

const mapApiDocumentsToItems = (docs: any[] = []): DocumentItem[] =>
  docs.map((doc) => ({
    id: doc.id,
    name: doc.name || doc.documentType?.name || "Document",
    status: doc.status,
    uploadedFiles: doc.uploadedFiles || [],
    required: doc.required ?? doc.isRequired ?? true,
  }));

const buildUploadedState = (docs: DocumentItem[]) => {
  const uploadedMap: Record<string, boolean> = {};
  let uploadedCount = 0;

  docs.forEach((doc) => {
    if (doc.uploadedFiles?.length > 0) {
      uploadedMap[doc.id] = true;
      uploadedCount += doc.uploadedFiles.length;
    }
  });

  return { uploadedMap, uploadedCount };
};

const applyApplicationDocuments = (
  docs: DocumentItem[],
  setters: {
    setDocuments: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
    setUploaded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setUploadedFilesCount: React.Dispatch<React.SetStateAction<number>>;
    setFiles: React.Dispatch<React.SetStateAction<Record<string, File[]>>>;
  },
) => {
  const { uploadedMap, uploadedCount } = buildUploadedState(docs);
  setters.setDocuments(docs);
  setters.setUploaded(uploadedMap);
  setters.setUploadedFilesCount(uploadedCount);
  setters.setFiles({});
};

const CLIENT_VISIBLE_DOC_SOURCES = new Set([
  "BROKER_ADDED",
  "LENDER_ADDED",
  "SUB_BROKER_ADDED",
]);

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api-lendingcart.vibrantick.org";

const LOAN_AUTOMATION_LOGO = "/loanAutomation.jpeg";

const getStatusStyles = (status?: string) => {
  switch (status) {
    case "SUBMITTED":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";

    case "IN_REVIEW":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";

    case "PENDING":
    case "CLIENT_PENDING":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";

    case "REJECTED":
    case "LENDER_DECLINED":
    case "AUTO_DECLINED":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";

    case "APPROVED":
    case "LENDER_APPROVED":
    case "AUTO_APPROVED":
    case "FUNDED":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";

    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
};

const getStatusDot = (status?: string) => {
  switch (status ?? "") {
    case "SUBMITTED":
      return "bg-emerald-500";

    case "IN_REVIEW":
      return "bg-blue-500";

    case "PENDING":
    case "CLIENT_PENDING":
      return "bg-amber-500";

    case "REJECTED":
    case "LENDER_DECLINED":
    case "AUTO_DECLINED":
      return "bg-red-500";

    case "APPROVED":
    case "LENDER_APPROVED":
    case "AUTO_APPROVED":
    case "FUNDED":
      return "bg-green-500";

    default:
      return "bg-gray-400";
  }
};

const formatStatusLabel = (status?: string | null) => {
  if (!status) return "Unknown";

  const labels: Record<string, string> = {
    LENDER_APPROVED: "Approved",
    LENDER_DECLINED: "Declined",
    AUTO_APPROVED: "Approved",
    AUTO_DECLINED: "Declined",
    CLIENT_PENDING: "Pending",
    IN_REVIEW: "In Review",
  };

  return labels[status] || status.replace(/_/g, " ");
};

const getClientInitials = (name?: string | null) => {
  if (!name?.trim()) return "CL";

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [submittingSign, setSubmittingSign] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [applicationNumber, setApplicationNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [applicationDetailsLoading, setApplicationDetailsLoading] =
    useState(false);
  const [fieldMap, setFieldMap] = useState<Record<string, any>>({});

  // const [status, setStatus] = useState("");
  // const [email, setEmail] = useState("");
  // const [creditScore, setCreditScore] = useState("");
  // const [loanProductCode, setLoanProductCode] = useState("");
  const [applicationData, setApplicationData] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(9);

  const [activeTab, setActiveTab] = useState<
    "documents" | "signDocuments" | "application" | "chat" | "applications" | "feeAgreement"
  >("applications");
  const [isSignedFromAPI, setIsSignedFromAPI] = useState(false);
  const [clientSignBlockedReason, setClientSignBlockedReason] = useState("");
  const [canClientSign, setCanClientSign] = useState(false);
  const [tabRefreshKey, setTabRefreshKey] = useState(0);

  const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "FIX & FLIP",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR / Rental",
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

  const getClientPortalAuthConfig = () => {
    const brokerToken = sessionStorage.getItem("broker_token");
    const clientToken = sessionStorage.getItem("client_token");

    const headers: Record<string, string> = {};

    if (token && brokerToken) {
      headers.Authorization = `Bearer ${brokerToken}`;
    } else if (clientToken) {
      headers.Authorization = `Bearer ${clientToken}`;
    }

    return { headers };
  };

  const documentSetters = {
    setDocuments,
    setUploaded,
    setUploadedFilesCount,
    setFiles,
  };

  const clearApplicationDocuments = () => {
    applyApplicationDocuments([], documentSetters);
  };

  const applyDocumentsFromApi = (rawDocs: any[] = []) => {
    applyApplicationDocuments(mapApiDocumentsToItems(rawDocs), documentSetters);
  };

  const applyDocumentsFromApplication = (application: any) => {
    if (Array.isArray(application?.documents)) {
      applyDocumentsFromApi(application.documents);
      return;
    }

    const requirements = (application?.documentRequirements || []).filter(
      (doc: any) => CLIENT_VISIBLE_DOC_SOURCES.has(doc.source),
    );
    applyDocumentsFromApi(
      requirements.map((doc: any) => ({
        id: doc.id,
        name: doc.documentType?.name,
        status: doc.status,
        required: doc.isRequired,
        uploadedFiles: (doc.uploads || []).map((file: any) => ({
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          uploadedAt: file.uploadedAt,
        })),
      })),
    );
  };

  const loadClientProfile = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/client-portal/profile`,
        getClientPortalAuthConfig(),
      );

      const data = res.data?.data;
      if (!data) return;

      if (data.clientName && !isPlaceholderClientName(data.clientName)) {
        setClientName(data.clientName);
      }

      if (data.email) {
        setClientEmail(data.email);
      }

      const token = sessionStorage.getItem("client_token");
      if (token) {
        saveClientPortalSession(token, {
          clientName: data.clientName,
          email: data.email,
          clientId: data.clientId,
        });
      }
    } catch (err) {
      console.error("Failed to load client profile", err);
    }
  };

  useEffect(() => {
    initializePortal();
  }, [token]);

  const initializePortal = async () => {
    try {
      const clientToken = sessionStorage.getItem("client_token");

      // Magic-link / token flow: load the single linked application.
      if (token) {
        await loadLoanContext();
        return;
      }

      // Logged-in client with multiple applications: don't preload another app's docs.
      if (clientToken) {
        clearApplicationDocuments();
        setApplicationId("");
        setApplicationData(null);
        setSelectedApplication(null);

        const profile = resolveClientProfileFromSession();
        if (profile?.clientName && !isPlaceholderClientName(profile.clientName)) {
          setClientName(profile.clientName);
        }
        if (profile?.email) {
          setClientEmail(profile.email);
        }

        await loadClientProfile();

        setLoading(false);
        return;
      }

      await loadLoanContext();
    } catch (err) {
      console.error(err);
      setInvalidToken(true);
      setLoading(false);
    }
  };

  const loadLoanContext = async () => {
    try {
      let url = `${API_BASE}/client-portal/loan`;

      if (token) {
        url += `?token=${token}`;
      } else if (applicationId) {
        url += `?applicationId=${applicationId}`;
      }

      const res = await axios.get(url, getClientPortalAuthConfig());
      const data = res.data?.data;

      const signatureFromAPI = data?.fullApplication?.find(
        (item: any) => item.key === "borrowerSignature",
      )?.value;

      applySignatureState({
        ...data,
        borrowerSignature: signatureFromAPI || data?.borrowerSignature,
      });

      setApplicationId(data?.loanApplicationId || data?.id || "");
      applyDocumentsFromApi(data?.documents || []);
      setApplicationNumber(data?.applicationNumber || "");
      setClientName(data?.borrower?.name || data?.borrowerName || "");
      setApplicationData(data);
    } catch (err) {
      console.error(err);
      setInvalidToken(true);
    } finally {
      setLoading(false);
    }
  };

  const applySignatureState = (data: any) => {
    const borrowerSignature =
      data?.borrowerSignature ||
      data?.submissions
        ?.flatMap((submission: any) => submission.fields || [])
        ?.find((field: any) => field.fieldKey === "borrowerSignature")?.value;

    const signatureState = resolveClientSignableSubmission({
      status: data?.status,
      submittedAt: data?.submittedAt,
      createdAt: data?.createdAt,
      borrowerSignature,
      submissions: data?.submissions,
      latestSubmission: data?.latestSubmission,
    });

    const signed =
      Boolean(data?.alreadySigned) ||
      signatureState.alreadySigned ||
      data?.latestSubmission?.status === "COMPLETED" ||
      submissionHasClientSignature(
        data?.latestSubmission,
        borrowerSignature,
      );

    if (signed) {
      setSignature(borrowerSignature ? String(borrowerSignature) : "");
      setIsSignedFromAPI(true);
      setCanClientSign(false);
      setClientSignBlockedReason("");
    } else {
      setSignature("");
      setIsSignedFromAPI(false);
      setCanClientSign(
        data?.canClientSign === true || signatureState.canSign,
      );
      setClientSignBlockedReason(
        data?.clientSignBlockedReason || signatureState.reason || "",
      );
    }
  };

  if (invalidToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <h2 className="text-red-600 font-semibold">
            Invalid or Expired Link
          </h2>
        </div>
      </div>
    );
  }

  const handleClearSignature = () => {
    sigRef.current?.clear();
    setSignature("");
  };

  const handleUndoSignature = () => {
    if (!sigRef.current) return;

    const strokes = sigRef.current.toData();
    if (!strokes || strokes.length === 0) return;

    strokes.pop();
    sigRef.current.clear();

    if (strokes.length > 0) {
      sigRef.current.fromData(strokes);
      const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
      setSignature(dataUrl);
    } else {
      setSignature("");
    }
  };

  const handleSubmitSignature = async () => {
    if (!canClientSign) {
      toast.error(
        clientSignBlockedReason ||
          "Signing is not available for this application right now.",
      );
      return;
    }

    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please provide your signature first");
      return;
    }

    if (!applicationId) {
      toast.error("Application not found. Please reopen the application.");
      return;
    }

    try {
      setSubmittingSign(true);

      const capturedSignature = sigRef.current
        .getCanvas()
        .toDataURL("image/png");

      let submitUrl = `${API_BASE}/client-portal/e-sign/submit`;
      if (token) {
        submitUrl += `?token=${token}`;
      }

      await axios.post(
        submitUrl,
        {
          loanApplicationId: applicationId,
          signature: capturedSignature,
        },
        getClientPortalAuthConfig(),
      );

      setSignature(capturedSignature);
      if (applicationId) {
        await fetchApplicationDetails(applicationId, { keepCurrentTab: true });
      } else if (token) {
        await loadLoanContext();
      }
      toast.success("Signature submitted successfully");
      sigRef.current?.clear();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Signature failed");
    } finally {
      setSubmittingSign(false);
    }
  };

  const MAX_FILES = 4;

  const handleFileChange = (id: string, newFiles: FileList | null) => {
    if (!newFiles) return;

    const selectedFiles = Array.from(newFiles);
    const existingFiles = files[id] || [];

    // total after adding
    const totalFiles = [...existingFiles, ...selectedFiles];

    if (totalFiles.length > MAX_FILES) {
      toast.error(`You can upload maximum ${MAX_FILES} files only`);

      // only allow remaining slots
      const allowedFiles = selectedFiles.slice(
        0,
        MAX_FILES - existingFiles.length,
      );

      setFiles((prev) => ({
        ...prev,
        [id]: [...existingFiles, ...allowedFiles],
      }));
    } else {
      setFiles((prev) => ({
        ...prev,
        [id]: totalFiles,
      }));
    }
  };

  // const removeFile = (id: string, index: number) => {
  //   setFiles((prev) => {
  //     const updated = [...(prev[id] || [])];
  //     updated.splice(index, 1);

  //     return {
  //       ...prev,
  //       [id]: updated.length > 0 ? updated : [],
  //     };
  //   });
  // };

  const uploadFile = async (id: string) => {
    const fileList = files[id];
    if (!fileList || fileList.length === 0) return;

    setUploading((prev) => ({ ...prev, [id]: true }));

    try {
      const clientToken = sessionStorage.getItem("client_token");

      for (const file of fileList) {
        const formData = new FormData();

        formData.append("loanApplicationId", applicationId);
        formData.append("documentRequirementId", id);
        formData.append("file", file);

        const res = await axios.post(
          `${API_BASE}/client-portal/upload`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${clientToken}`,
              "Content-Type": "multipart/form-data",
            },
          },
        );

        console.log("UPLOAD SUCCESS:", res.data);

        // increment count
        setUploadedFilesCount((prev) => prev + 1);
      }

      //  mark uploaded
      setUploaded((prev) => ({ ...prev, [id]: true }));

      // clear selected files
      setFiles((prev) => ({ ...prev, [id]: [] }));

      toast.success("Document uploaded successfully");

      if (applicationId) {
        await fetchApplicationDetails(applicationId, { keepCurrentTab: true });
      }
    } catch (err: any) {
      console.error("UPLOAD ERROR:", err?.response || err);

      toast.error(
        err?.response?.data?.message || "Upload failed. Please try again.",
      );
    } finally {
      setUploading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleClientNotificationClick = async (
    notification: ClientNotification,
  ) => {
    const appId = notification.metadata?.applicationId;

    if (appId) {
      const tabByEvent: Record<string, typeof activeTab> = {
        NEW_MESSAGE: "chat",
        DOCUMENTS_REQUESTED: "documents",
        LENDER_CONDITIONAL: "documents",
      };

      const nextTab = tabByEvent[notification.eventType || ""] || "application";

      if (nextTab === "documents") {
        await fetchApplicationDetails(appId, { keepCurrentTab: true });
        setActiveTab("documents");
        return;
      }

      if (nextTab === "signDocuments" || nextTab === "feeAgreement") {
        setTabRefreshKey((key) => key + 1);
      }

      await fetchApplicationDetails(appId, { keepCurrentTab: true });
      setActiveTab(nextTab);
      return;
    }

    const tabByEvent: Record<string, typeof activeTab> = {
      NEW_MESSAGE: "chat",
      DOCUMENTS_REQUESTED: "documents",
      LENDER_CONDITIONAL: "documents",
    };

    const nextTab = tabByEvent[notification.eventType || ""] || "application";
    setActiveTab(nextTab);
  };

  const fetchApplications = async (pageNumber = 1) => {
    try {
      setApplicationsLoading(true);

      let url = `${API_BASE}/client-portal/applications?page=${pageNumber}&limit=${limit}`;

      if (debouncedSearch) {
        url += `&search=${debouncedSearch}`;
      }

      if (token) url += `&token=${token}`;

      const res = await axios.get(url, getClientPortalAuthConfig());

      setApplications(res.data?.data || []);
      setPage(res.data?.meta?.page || 1);
      setTotalPages(res.data?.meta?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const fetchApplicationDetails = async (
    id: string,
    options?: { keepCurrentTab?: boolean },
  ) => {
    try {
      setApplicationDetailsLoading(true);

      let url = `${API_BASE}/client-portal/applications/${id}`;
      if (token) url += `?token=${token}`;

      const res = await axios.get(url, getClientPortalAuthConfig());

      const data = res.data?.data;

      setApplicationId(data.id);
      setApplicationNumber(data.applicationNumber || "");

      applySignatureState(data);

      setSelectedApplication(data);
      applyDocumentsFromApplication(data);

      const map = buildSubmissionFieldMap(data);
      setFieldMap(map);

      setApplicationData({
        ...data,
        borrower: {
          name: data.borrowerName,
          email: data.borrowerEmail,
          phone: data.borrowerPhone,
        },
      });

      if (!options?.keepCurrentTab) {
        setActiveTab("application");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch application details");
    } finally {
      setApplicationDetailsLoading(false);
    }
  };

  const openApplicationTab = async (
    tab: "documents" | "signDocuments" | "feeAgreement",
  ) => {
    if (!applicationId) {
      toast.error("Select an application first");
      return;
    }

    if (tab === "signDocuments" || tab === "feeAgreement") {
      setTabRefreshKey((key) => key + 1);
    }

    setActiveTab(tab);

    if (tab === "documents") {
      await fetchApplicationDetails(applicationId, { keepCurrentTab: true });
    }
  };

  const formatCurrency = (val: any) => {
    const numeric = parseNumericValue(val);
    if (numeric === null) return "-";
    return `$${numeric.toLocaleString("en-US")}`;
  };

  const formatPercent = (val: any) => {
    const numeric = parseNumericValue(val);
    if (numeric === null) return "-";
    return `${numeric.toFixed(2)}%`;
  };

  const totalFiles = Object.values(files).flat().length + uploadedFilesCount;

  const progress =
    totalFiles === 0 ? 0 : Math.round((uploadedFilesCount / totalFiles) * 100);

  const getValue = (key: string) => {
    if (key === "borrowerName") {
      return (
        fieldMap.borrowerName ||
        `${fieldMap.borrowerFirstName || ""} ${fieldMap.borrowerLastName || ""}`.trim()
      );
    }

    const value = fieldMap[key];
    if (value === undefined || value === null || value === "") return "";
    return value;
  };

  const latestSubmission = useMemo(
    () =>
      applicationData?.latestSubmission ||
      getLatestSubmission(applicationData?.submissions || []),
    [applicationData],
  );

  const submissionDetailFields = useMemo(
    () => mapSubmissionDetailFields(latestSubmission?.fields || []),
    [latestSubmission],
  );

  const detailLoanAmount = useMemo(
    () =>
      getNumericFieldValue(submissionDetailFields, "amountRequested") ||
      Number(applicationData?.amountRequested) ||
      0,
    [submissionDetailFields, applicationData?.amountRequested],
  );
  const detailLtv = useMemo(
    () => getNumericFieldValue(submissionDetailFields, "ltvPercentage"),
    [submissionDetailFields],
  );
  const detailLtc = useMemo(
    () => getNumericFieldValue(submissionDetailFields, "ltcPercentage"),
    [submissionDetailFields],
  );
  const detailArv = useMemo(
    () => getNumericFieldValue(submissionDetailFields, "arvPercentage"),
    [submissionDetailFields],
  );
  const detailDscr = useMemo(
    () => getNumericFieldValue(submissionDetailFields, "dscr"),
    [submissionDetailFields],
  );
  const detailNetWorth = useMemo(
    () => getNumericFieldValue(submissionDetailFields, "netWorth"),
    [submissionDetailFields],
  );
  const submittedDate = latestSubmission?.createdAt
    ? new Date(latestSubmission.createdAt)
    : null;

  const handleEndSignature = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;

    const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
    setSignature(dataUrl);
  };

  const handleLogout = () => {
    if (isClientPortalImpersonationSession()) {
      exitClientPortalImpersonation();
      return;
    }

    clearClientPortalSession();
    window.location.href = "/client-upload";
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === "applications") {
      fetchApplications(page);
    }
  }, [activeTab, page, debouncedSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );
  }

  const displayName = (() => {
    const candidates = [applicationData?.borrower?.name, clientName];
    for (const name of candidates) {
      if (name && !isPlaceholderClientName(name)) {
        return name;
      }
    }
    return clientEmail?.split("@")[0] || "Client";
  })();
  const displayEmail =
    applicationData?.borrower?.email || clientEmail || "-";
  const clientInitials = getClientInitials(displayName);
  const isClientLoggedIn = Boolean(sessionStorage.getItem("client_token"));
  const isImpersonation = isClientPortalImpersonationSession();

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {isImpersonation && (
        <div className="mx-auto mb-4 flex max-w-8xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>You are viewing this client portal as a broker admin.</span>
          <button
            type="button"
            onClick={exitClientPortalImpersonation}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
          >
            Close portal tab
          </button>
        </div>
      )}
      <div className="max-w-8xl mx-auto">
        {/* TOP HEADER */}
        {(applicationData || clientName || isClientLoggedIn) && (
          <header className="relative mb-6 overflow-visible rounded-2xl border border-slate-200 bg-white">
            <div className="h-1 rounded-t-2xl bg-blue-600" />

            <div className="relative px-4 py-4 sm:px-6 sm:py-5">
              <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-200">
                    <img
                      src={LOAN_AUTOMATION_LOGO}
                      alt="Loan Automation"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      Loan Automation
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                      Client Portal
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {isClientLoggedIn && (
                    <ClientNotificationDropdown
                      apiBase={API_BASE}
                      onNotificationClick={handleClientNotificationClick}
                    />
                  )}

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <FiLogOut size={16} />
                    <span className="hidden sm:inline">
                      {isImpersonation ? "Close tab" : "Logout"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-base font-bold text-blue-700">
                  {clientInitials}
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                    {displayName}
                  </h1>
                  <p className="mt-1 flex items-center gap-2 truncate text-sm text-slate-500">
                    <FiUser className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{displayEmail}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-6">
              <nav className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedApplication(null);
                    setActiveTab("applications");
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "applications"
                      ? "bg-white text-blue-700 ring-1 ring-blue-200"
                      : "text-slate-500 hover:bg-white hover:text-slate-800"
                  }`}
                >
                  <FiFileText size={16} />
                  Applications
                </button>

                {activeTab !== "applications" && selectedApplication && (
                  <span className="hidden items-center gap-2 text-sm text-slate-400 sm:inline-flex">
                    <span>/</span>
                    <span className="max-w-[220px] truncate font-medium text-slate-600">
                      {selectedApplication.applicationNumber ||
                        applicationNumber ||
                        "Application"}
                    </span>
                  </span>
                )}
              </nav>
            </div>
          </header>
        )}

        {activeTab === "documents" && (
          <>
            {applicationDetailsLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  {/* Back Button */}
                  <button
                    onClick={() => setActiveTab("application")}
                    className="flex text-xs items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                  >
                    ← Back
                  </button>
                </div>
                <div
                  className="relative h-[60vh] overflow-hidden rounded-2xl
  bg-gradient-to-br from-blue-50 via-white to-cyan-50 
  p-10 text-center flex flex-col items-center justify-center gap-4"
                >
                  {/* GLOW EFFECT */}
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-200 opacity-20 blur-3xl rounded-full" />
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-cyan-200 opacity-20 blur-3xl rounded-full" />

                  {/* ICON */}
                  <div className="relative">
                    <div
                      className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 
      flex items-center justify-center shadow-lg"
                    >
                      <FileText className="text-white" size={30} />
                    </div>
                  </div>

                  {/* TITLE */}
                  <p className="text-base font-semibold text-gray-700">
                    No Documents Required
                  </p>

                  {/* DESCRIPTION */}
                  <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                    This application currently doesn’t require any documents.
                    You’re all set for now — we’ll notify you if anything is
                    needed.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* HEADER (ONLY WHEN DOCUMENTS EXIST) */}
                <div className="bg-white rounded-2xl shadow p-6 mb-6 sticky top-4 z-10">
                  {/* TOP ROW WITH BACK BUTTON */}
                  <div className="flex items-center justify-between mb-4">
                    {/* Back Button */}
                    <button
                      onClick={() => setActiveTab("application")}
                      className="flex text-xs items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                    >
                      ← Back
                    </button>
                  </div>

                  {/* HEADER */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-gray-800">
                        Upload Documents
                      </h1>
                      <p className="text-sm text-gray-500 mt-1">{clientName}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-400">Application No.</p>
                      <p className="text-sm font-medium text-gray-700">
                        {applicationNumber}
                      </p>
                    </div>
                  </div>

                  {/* PROGRESS */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {uploadedFilesCount} / {totalFiles} Files Uploaded
                      </span>
                      <span>{progress}%</span>
                    </div>

                    <div className="w-full bg-gray-200 h-2 rounded-full">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* GRID */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      {/* TOP */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <FileText className="text-blue-600" size={20} />

                          {uploaded[doc.id] && (
                            <CheckCircle className="text-green-600" size={20} />
                          )}
                        </div>

                        <p className="text-sm font-medium text-gray-800 line-clamp-2">
                          {doc.name}
                        </p>

                        <p
                          className={`text-xs mt-1 font-medium ${
                            uploaded[doc.id]
                              ? "text-green-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {uploaded[doc.id] ? "Uploaded" : "Pending"}
                        </p>
                      </div>

                      {/* ACTIONS */}
                      <div className="mt-4">
                        {uploaded[doc.id] ? (
                          <div className="text-xs text-green-600 font-medium">
                            ✔ Completed
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="file"
                              multiple
                              disabled={(files[doc.id]?.length || 0) >= 4}
                              id={`file-${doc.id}`}
                              className="hidden"
                              onChange={(e) =>
                                handleFileChange(doc.id, e.target.files)
                              }
                            />

                            <div className="flex gap-2">
                              <label
                                htmlFor={`file-${doc.id}`}
                                className={`flex-1 text-center text-xs px-3 py-2 border rounded-lg cursor-pointer 
                ${
                  (files[doc.id]?.length || 0) >= 4
                    ? "bg-gray-200 cursor-not-allowed text-slate-500"
                    : "hover:bg-gray-100"
                }`}
                              >
                                Choose File
                              </label>

                              <button
                                onClick={() => uploadFile(doc.id)}
                                disabled={
                                  !(files[doc.id]?.length > 0) ||
                                  uploading[doc.id]
                                }
                                className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Upload size={14} />
                                {uploading[doc.id] ? "Uploading..." : "Upload"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "signDocuments" && applicationId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab("application")}
                className="flex text-xs items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                ← Back
              </button>
            </div>
            <SignDocumentsPanel
              key={tabRefreshKey}
              mode="client"
              apiBase={API_BASE}
              getAuthHeaders={() => getClientPortalAuthConfig().headers}
              loanApplicationId={applicationId}
              clientName={clientName}
              applicationNumber={applicationNumber}
            />
          </div>
        )}

        {activeTab === "applications" && (
          <div className="min-h-[88vh] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Loan Applications
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Track status, documents, and updates for your loans.
                </p>
              </div>

              {/* SEARCH BOX */}
              <div className="relative w-full md:w-80">
                {/* ICON */}
                <FiSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />

                <input
                  type="text"
                  placeholder="Search applications..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border bg-white 
      focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
      outline-none transition"
                />

                {/* CLEAR BUTTON */}
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
            </div>

            {applicationsLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : applications.length === 0 ? (
              <div
                className="relative overflow-hidden rounded-2xl border border-purple-100 
  bg-gradient-to-br from-purple-50 via-white to-pink-50 
  p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4"
              >
                {/* GLOW */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-200 opacity-20 blur-3xl rounded-full" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-pink-200 opacity-20 blur-3xl rounded-full" />

                {/* ICON */}
                <div className="relative">
                  <div
                    className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 
      flex items-center justify-center shadow-lg"
                  >
                    <FiFileText className="text-white" size={28} />
                  </div>
                </div>

                {/* TITLE */}
                <p className="text-base font-semibold text-gray-700">
                  No Applications Found
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {applications.map((app) => {
                  const progress =
                    app.documentProgress.total === 0
                      ? 0
                      : Math.min(
                          100,
                          Math.round(
                            (app.documentProgress.uploaded /
                              app.documentProgress.total) *
                              100,
                          ),
                        );

                  return (
                    <div
                      key={app.id}
                      onClick={() => fetchApplicationDetails(app.id)}
                      className="group relative border border-slate-100 rounded-xl p-4
             shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer 
             overflow-hidden bg-white"
                    >
                      {/*  MINIMAL HOVER OVERLAY */}
                      <div
                        className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 
               transition-all duration-300 flex items-center justify-center z-20 backdrop-blur-[1px]"
                      >
                        <div
                          className="text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 
                 px-4 py-2 rounded-lg bg-slate-800/80 border border-white/10 
                 backdrop-blur-md shadow-2xl transform translate-y-2 
                 group-hover:translate-y-0 transition-all duration-300"
                        >
                          <FiEye size={14} />
                          View Details
                        </div>
                      </div>

                      {/* CONTENT */}
                      <div className="relative z-10 group-hover:opacity-20 transition duration-300">
                        {/* HEADER */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.05em] text-slate-400 font-bold mb-0.5">
                              Application ID
                            </p>
                            <p className="text-[12px] font-bold text-slate-800 font-mono">
                              {app.applicationNumber}
                            </p>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-tight ${getStatusStyles(
                              app.status,
                            )}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${getStatusDot(app.status)}`}
                            />
                            {formatStatusLabel(app.status)}
                          </span>
                        </div>

                        {/* PRODUCT INFO */}
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold text-slate-600 truncate">
                            {app.loanProduct?.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(app.createdAt).toLocaleDateString(
                              undefined,
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </p>
                        </div>

                        {/* AMOUNT & PROGRESS BAR */}
                        <div className="pt-3 border-t border-slate-50">
                          <div className="flex justify-between items-end mb-1.5">
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">
                                Amount
                              </p>
                              <p className="text-[13px] font-black text-slate-900">
                                {app.amountRequested || "—"}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold ${progress === 100 ? "text-emerald-600" : "text-slate-500"}`}
                            >
                              {progress}%
                            </span>
                          </div>

                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                progress === 100
                                  ? "bg-emerald-500"
                                  : "bg-slate-800"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <p className="text-[9px] text-slate-400 mt-1.5 font-medium">
                            Documents:{" "}
                            <span className="text-slate-600">
                              {app.documentProgress.uploaded}/
                              {app.documentProgress.total}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                {/* LEFT */}
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </p>

                {/* RIGHT BUTTONS */}
                <div className="flex items-center gap-2">
                  {/* PREVIOUS */}
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border bg-white text-gray-600 
        hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>

                  {/* PAGE NUMBERS */}
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition
          ${
            page === i + 1
              ? "bg-blue-600 text-white shadow"
              : "bg-white border text-gray-600 hover:bg-gray-50"
          }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  {/* NEXT */}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border bg-white text-gray-600 
        hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "application" &&
          (applicationDetailsLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              Loading application details...
            </div>
          ) : applicationData ? (
            <div className="bg-white rounded-2xl p-6">
              {activeTab === "application" && applicationData && (
                <div className="bg-white rounded-2xl p-6">
                  <div className="mb-6">
                    {/* BACK BUTTON */}
                    <button
                      onClick={() => {
                        setSelectedApplication(null);
                        setApplicationData(null);
                        setApplicationId("");
                        clearApplicationDocuments();
                        setActiveTab("applications");
                      }}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-3"
                    >
                      ← Back to Submitted Applications
                    </button>

                    {/* TITLE */}
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h1 className="text-xl font-semibold text-gray-800">
                          Loan Application Preview
                        </h1>
                        <p className="text-xs text-gray-400">
                          {selectedApplication?.applicationNumber}
                        </p>
                      </div>

                      {/* DOCUMENTS */}
                      <button
                        onClick={() => openApplicationTab("documents")}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
      hover:text-blue-500`}
                      >
                        <FiUploadCloud size={16} />
                        Upload Documents
                      </button>

                      <button
                        onClick={() => openApplicationTab("signDocuments")}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
      hover:text-indigo-500`}
                      >
                        <FiFileText size={16} />
                        Sign Documents
                      </button>

                      {/* Fee Agreement */}
                      <button
                        onClick={() => openApplicationTab("feeAgreement")}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
      hover:text-blue-500`}
                      >
                        <FiFileText size={16} />
                        Fee Agreement
                        <span className="absolute -bottom-2 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
                      </button>

                      <div className="flex items-center gap-3">
                        {/* Chat Button */}
                        <button
                          type="button"
                          onClick={() => setActiveTab("chat")}
                          className="group relative inline-flex items-center gap-2 rounded-xl 
  bg-gradient-to-r from-emerald-500 to-green-600 
  px-3 py-1.5 text-xs font-semibold text-white 
  shadow-md transition-all duration-200 
  hover:shadow-lg hover:scale-[1.03] active:scale-95"
                        >
                          {/* glow */}
                          <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition" />

                          {/* icon */}
                          <span className="flex items-center justify-center">
                            <FiMessageCircle size={14} />
                          </span>

                          {/* text */}
                          <span>Chat</span>

                          {/* subtle pulse */}
                          <span className="ml-1 flex h-2 w-2">
                            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-white/70" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                        </button>

                        {/* STATUS */}
                        <span
                          className={`rounded-full text-xs px-4 py-1.5 font-semibold ${getStatusStyles(
                            selectedApplication?.status,
                          )}`}
                        >
                          {formatStatusLabel(selectedApplication?.status)}
                        </span>
                      </div>
                    </div>

                    {/* CARDS CONTAINER */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* CLIENT CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-blue-100 border border-slate-100 transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          {/* Icon with Soft Background */}
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-400 text-blue-50 flex items-center justify-center transition-all duration-300">
                            <FiUser size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-blue-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Client Name
                            </p>
                            <p className="text-[13px] font-semibold text-blue-800 truncate">
                             {getValue("borrowerName") || "Applicant"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* PRODUCT CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-purple-100 border border-slate-100 transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-500 text-purple-50 flex items-center justify-center transition-all duration-300">
                            <FiTag size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-purple-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Product
                            </p>
                            <p className="text-[13px] font-semibold text-purple-700 truncate">
                              {applicationData?.loanProduct?.name ||
                                PRODUCT_LABELS[getValue("loanProductCode")] ||
                                getValue("loanProductCode")
                                  ?.replace(/_/g, " ")
                                  .toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* AMOUNT CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-green-100 border border-slate-100  transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-green-500 text-green-50 flex items-center justify-center transition-all duration-300">
                            <FiDollarSign size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-green-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Loan Amount Requested
                            </p>
                            <p className="text-[13px] font-bold text-green-600">
                              {formatCurrency(getValue("amountRequested"))}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* CREDIT SCORE CARD */}
                      <div className="group relative overflow-hidden rounded-2xl p-4 bg-[#FEFCE9] border border-slate-100 transition-all duration-300">
                        <div className="relative flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-[#F7A400] text-white flex items-center justify-center transition-all duration-300">
                            <FiCreditCard size={16} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-orange-600 uppercase tracking-[0.05em] font-bold mb-0.5">
                              Credit Score
                            </p>
                            <div className="flex items-baseline gap-1">
                              <p className="text-[13px] font-bold text-orange-800">
                                {getValue("creditScore") || "—"}
                              </p>
                              <span className="text-[9px] font-medium text-orange-800">
                                PTS
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border rounded-2xl p-6 mb-6 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
                      {/* LOAN AMOUNT */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          Loan Amount
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatCurrency(getValue("amountRequested"))}
                        </p>
                      </div>

                      {/* LTV */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          LTV %
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatPercent(getValue("ltvPercentage"))}
                        </p>
                      </div>

                      {/* LTC */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          LTC %
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatPercent(getValue("ltcPercentage"))}
                        </p>
                      </div>

                      {/* ARV */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          ARV %
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatPercent(getValue("arvPercentage"))}
                        </p>
                      </div>

                      {/* DSCR */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          DSCR
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {getValue("dscr") || "-"}
                        </p>
                      </div>

                      {/* NET WORTH */}
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">
                          Net Worth
                        </p>
                        <p className="text-sm font-semibold text-blue-700 mt-1">
                          {formatCurrency(getValue("netWorth"))}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ClientSubmissionDetailsView
                    application={applicationData}
                    fields={submissionDetailFields}
                    loanAmount={detailLoanAmount}
                    ltv={detailLtv}
                    ltc={detailLtc}
                    arv={detailArv}
                    dscr={detailDscr}
                    netWorth={detailNetWorth}
                    submittedDate={submittedDate}
                    formatStatusLabel={formatStatusLabel}
                    getStatusChipClass={getStatusStyles}
                    sectionsOnly
                  />

                  {/* SIGNATURE */}
                  <div className="mt-6">
                    <h3 className="font-semibold text-gray-700 mb-3">
                      Digital Signature
                    </h3>

                    {isSignedFromAPI ? (
                      <div className="bg-gray-50 border rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-400 mb-2">
                          ✔ Signed by client
                        </p>

                        {signature ? (
                          <img
                            src={signature}
                            className="h-28 mx-auto object-contain"
                          />
                        ) : (
                          <p className="text-sm text-gray-600">
                            Your application has been submitted.
                          </p>
                        )}
                      </div>
                    ) : !canClientSign ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {clientSignBlockedReason ||
                          "Signing is not available for this application right now. Please contact your broker if you need help."}
                      </div>
                    ) : (
                      <>
                        <div className="bg-gradient-to-br from-white to-gray-50 border rounded-xl p-4 shadow-sm">
                          <SigCanvas
                            ref={sigRef}
                            penColor="black"
                            onEnd={handleEndSignature}
                            canvasProps={{
                              width: 900,
                              height: 220,
                              className:
                                "w-full max-w-full border-2 border-dashed border-gray-300 rounded-lg bg-white",
                            }}
                          />

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-xs text-gray-400">Sign above</p>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleUndoSignature}
                                disabled={!signature}
                                className={`rounded-md px-3 py-1 text-xs transition ${
                                  !signature
                                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                Undo Last Stroke
                              </button>

                              <button
                                type="button"
                                onClick={handleClearSignature}
                                disabled={!signature}
                                className={`rounded-md px-3 py-1 text-xs transition ${
                                  !signature
                                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                    : "bg-gray-200 text-slate-700 hover:bg-gray-300"
                                }`}
                              >
                                Reset Signature
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Submit */}
                        <button
                          onClick={handleSubmitSignature}
                          disabled={!signature || submittingSign || !canClientSign}
                          className={`mt-4 w-full rounded-lg py-2 font-medium transition ${
                            !signature || submittingSign || !canClientSign
                              ? "cursor-not-allowed bg-slate-200 text-slate-500 shadow-none"
                              : "bg-emerald-600 text-white shadow-[0_12px_24px_rgba(5,150,105,0.22)] hover:bg-emerald-700"
                          }`}
                        >
                          {submittingSign
                            ? "Submitting..."
                            : "Submit Signature"}
                        </button>
                      </>
                    )}
                  </div>

                  {/* FOOTER */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-6">
                    {/* Date */}
                    <span className="text-sm text-gray-500">
                      {applicationData?.submittedAt
                        ? `Submitted: ${formatClientPortalSubmittedDate(applicationData)}`
                        : `Application Created: ${formatClientPortalSubmittedDate(applicationData)}`}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full shadow-sm
                      ${getStatusStyles(applicationData.status)}`}
                    >
                      {/* Dot indicator */}
                      <span
                        className={`h-2 w-2 rounded-full ${getStatusDot(applicationData.status)}`}
                      />

                      {formatStatusLabel(applicationData.status)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null)}

        {activeTab === "feeAgreement" && (
          <FeeAgreement
            key={tabRefreshKey}
            applicationId={
              selectedApplication?.id ||
              selectedApplication?.loanApplicationId ||
              applicationId
            }
            getAuthHeaders={() => getClientPortalAuthConfig().headers}
            onBack={() => setActiveTab("application")}
          />
        )}

        {activeTab === "chat" && (
          <Chat
            applicationId={
              selectedApplication?.id ||
              selectedApplication?.loanApplicationId ||
              applicationId
            }
            onBack={() => setActiveTab("application")}
          />
        )}
      </div>
    </div>
  );
}
