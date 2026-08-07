import { useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Upload,
  FileText,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  FolderOpen,
  LayoutGrid,
  FileSignature,
  Receipt,
} from "lucide-react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";
import FeeAgreement from "./FeeAgreement";
import {
  FiUploadCloud,
  FiFileText,
  FiMessageCircle,
  FiLogOut,
  FiUser,
  FiX,
  FiSearch,
  FiMapPin,
  FiHome,
  FiLayers,
  FiBriefcase,
  FiFilter,
} from "react-icons/fi";
import Chat from "./Chat";
import ClientNotificationDropdown, {
  type ClientNotification,
} from "./ClientNotificationDropdown";
import {
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
import EmbeddedFilePreview from "../../components/documents/EmbeddedFilePreview";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";

/* ================= TYPES ================= */
const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

interface UploadedFileItem {
  uploadId?: string;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
  fileMimeType?: string;
}

interface DocumentItem {
  id: string;
  name: string;
  status: "PENDING" | "UPLOADED" | string;
  uploadedFiles: UploadedFileItem[];
  required: boolean;
}

const MAX_FILES = 4;

const inferUploadedFileMimeType = (
  fileName?: string,
  fileMimeType?: string,
) => {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const byExt =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : ext === "bmp"
              ? "image/bmp"
              : ext === "jpg" ||
                  ext === "jpeg" ||
                  ext === "jfif" ||
                  ext === "pjpeg" ||
                  ext === "pjp"
                ? "image/jpeg"
                : undefined;

  const mime = (fileMimeType || "").trim().toLowerCase();
  // Prefer a known image/pdf extension over generic or missing MIME
  // (JFIF uploads often arrive as octet-stream or empty mime).
  if (
    byExt &&
    (!mime ||
      mime === "application/octet-stream" ||
      mime === "binary/octet-stream" ||
      (!mime.startsWith("image/") && !mime.includes("pdf")))
  ) {
    return byExt;
  }

  if (mime) return fileMimeType;
  return byExt;
};

const normalizeUploadedFiles = (uploadedFiles: any[] = []): UploadedFileItem[] =>
  uploadedFiles.map((file) => {
    if (typeof file === "string") {
      return {
        fileName: file.split("/").pop() || "Uploaded file",
        fileUrl: file,
      };
    }

    return {
      uploadId: file.uploadId || file.id,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      uploadedAt: file.uploadedAt,
      fileMimeType: inferUploadedFileMimeType(file.fileName, file.fileMimeType),
    };
  });

const formatUploadedAt = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const mapApiDocumentsToItems = (docs: any[] = []): DocumentItem[] =>
  docs.map((doc) => ({
    id: doc.id,
    name: doc.name || doc.documentType?.name || "Document",
    status: doc.status,
    uploadedFiles: normalizeUploadedFiles(doc.uploadedFiles || []),
    required: doc.required ?? doc.isRequired ?? true,
  }));

const applyApplicationDocuments = (
  docs: DocumentItem[],
  setters: {
    setDocuments: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
    setFiles: React.Dispatch<React.SetStateAction<Record<string, File[]>>>;
  },
) => {
  setters.setDocuments(docs);
  setters.setFiles({});
};

const CLIENT_VISIBLE_DOC_SOURCES = new Set([
  "BROKER_ADDED",
  "LENDER_ADDED",
  "SUB_BROKER_ADDED",
]);

function isClientPortalUploadVisible(doc: any) {
  if (!doc || !CLIENT_VISIBLE_DOC_SOURCES.has(doc.source)) {
    return false;
  }

  if (doc.requiresClientSignature) {
    return false;
  }

  return Boolean(doc.sentToClientAt);
}

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

const formatLoanProductLabel = (code?: string | null) => {
  if (!code) return "Loan Application";

  const labels: Record<string, string> = {
    FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
    DSCR_LOAN_1_TO_4_UNITS: "DSCR / Rental",
    CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
    BRIDGE_LOAN_1_TO_4_UNITS: "Bridge Loan",
    SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
    USDA_BI: "USDA B&I",
    AGENCY_LOAN_MULTIFAMILY: "Agency Multifamily",
    CRE_PERMANENT_LOAN: "CRE Permanent",
    RENTAL_PORTFOLIO: "Rental Portfolio",
    PURCHASE_ORDER_FINANCE: "Purchase Order Finance",
    ACCOUNTS_PAYABLE_FINANCE: "AP Supply Chain",
    ACCOUNTS_RECEIVABLE: "Accounts Receivable",
    INVOICE_FACTORING: "AR Factoring",
  };

  return labels[code] || code.replace(/_/g, " ");
};

const formatApplicationAmount = (value: unknown) => {
  const parseAmount = (raw: unknown): number | null => {
    const direct = parseNumericValue(raw);
    if (direct !== null) return direct;

    if (typeof raw === "string" && raw.trim()) {
      const cleaned = raw.replace(/[^0-9.-]/g, "");
      if (!cleaned) return null;
      const numeric = Number(cleaned);
      return Number.isFinite(numeric) ? numeric : null;
    }

    return null;
  };

  const numeric = parseAmount(value);
  if (numeric === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const getDocumentProgressPercent = (app: {
  documentProgress?: {
    total?: number;
    uploaded?: number;
    filesUploaded?: number;
  };
}) => {
  const total = Number(app.documentProgress?.total) || 0;
  const uploaded = Number(app.documentProgress?.uploaded) || 0;

  if (total <= 0) return 0;
  return Math.min(100, Math.round((uploaded / total) * 100));
};

type ApplicationCardSummary = {
  businessName?: string | null;
  propertyInfo?: string | null;
  collateralSummary?: string | null;
  address?: string | null;
  broker?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

const ApplicationCardMetaRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) => {
  if (!value?.trim()) return null;

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
};

const hasApplicationCardSummary = (app: ApplicationCardSummary) =>
  Boolean(
    app.businessName?.trim() ||
      app.propertyInfo?.trim() ||
      app.collateralSummary?.trim() ||
      app.address?.trim() ||
      app.broker?.name?.trim(),
  );

const getStatusAccentClass = (status?: string) => {
  switch (status ?? "") {
    case "SUBMITTED":
    case "APPROVED":
    case "LENDER_APPROVED":
    case "AUTO_APPROVED":
    case "FUNDED":
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
    default:
      return "bg-slate-400";
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

const APPLICATIONS_PAGE_SIZE = 18;

function getApplicationsRange(
  page: number,
  total: number,
  pageSize: number = APPLICATIONS_PAGE_SIZE,
) {
  if (total <= 0) return { start: 0, end: 0 };
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return { start, end };
}

function buildVisiblePages(current: number, totalPages: number) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);

  return pages;
}

type ApplicationWorkspaceTab =
  | "application"
  | "documents"
  | "signDocuments"
  | "feeAgreement"
  | "chat";

type ApplicationWorkspaceHeaderProps = {
  activeTab: ApplicationWorkspaceTab;
  applicationNumber?: string;
  status?: string;
  onTabChange: (tab: ApplicationWorkspaceTab) => void;
  onBackToApplications: () => void;
  formatStatusLabel: (status?: string | null) => string;
  getStatusStyles: (status?: string) => string;
  getStatusDot: (status?: string) => string;
};

const APPLICATION_WORKSPACE_TABS: Array<{
  key: ApplicationWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { key: "application", label: "Overview", icon: LayoutGrid },
  { key: "documents", label: "Upload Documents", icon: FiUploadCloud },
  { key: "signDocuments", label: "Documents to Sign", icon: FileSignature },
  { key: "feeAgreement", label: "Fee Agreement", icon: Receipt },
];

function ApplicationWorkspaceHeader({
  activeTab,
  applicationNumber,
  status,
  onTabChange,
  onBackToApplications,
  formatStatusLabel,
  getStatusStyles,
  getStatusDot,
}: ApplicationWorkspaceHeaderProps) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
        <button
    type="button"
    onClick={onBackToApplications}
    className="
      mb-3 inline-flex items-center gap-2
      rounded-lg border border-slate-200
      bg-white px-3 py-2
      text-sm font-semibold text-slate-700
      shadow-sm transition-all
      hover:border-blue-200
      hover:bg-blue-50
      hover:text-blue-700
      focus:outline-none
      focus:ring-2
      focus:ring-blue-500/20
    "
  >
    <ChevronLeft size={18} strokeWidth={2.5} />
    <span>Back to Applications</span>
  </button>

          <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            Loan Application
          </h1>
          <p className="mt-0.5 font-mono text-xs text-slate-500">
            {applicationNumber || "Application"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTabChange("chat")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === "chat"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
            }`}
          >
            <FiMessageCircle size={14} />
            Chat
          </button>

          {status && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ${getStatusStyles(
                status,
              )}`}
            >
              <span className={`h-2 w-2 rounded-full ${getStatusDot(status)}`} />
              {formatStatusLabel(status)}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-slate-50/90 p-2">
        <div className="flex min-w-max gap-1">
          {APPLICATION_WORKSPACE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-100"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                }`}
              >
                <Icon size={15} className={isActive ? "text-blue-600" : ""} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();
  const sigRef = useRef<SignatureCanvas | null>(null);
  const applicationsSectionRef = useRef<HTMLDivElement | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [submittingSign, setSubmittingSign] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [previewFiles, setPreviewFiles] = useState<UploadedFileItem[]>([]);
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);
  const [applicationNumber, setApplicationNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [applicationDetailsLoading, setApplicationDetailsLoading] =
    useState(false);

  // const [status, setStatus] = useState("");
  // const [email, setEmail] = useState("");
  // const [creditScore, setCreditScore] = useState("");
  // const [loanProductCode, setLoanProductCode] = useState("");
  const [applicationData, setApplicationData] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [brokerFilter, setBrokerFilter] = useState("");
  const [filterBrokers, setFilterBrokers] = useState<
    Array<{ id: string; name: string; email?: string | null }>
  >([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalApplications, setTotalApplications] = useState(0);

  const [activeTab, setActiveTab] = useState<
    "documents" | "signDocuments" | "application" | "chat" | "applications" | "feeAgreement"
  >("applications");
  const [isSignedFromAPI, setIsSignedFromAPI] = useState(false);
  const [clientSignBlockedReason, setClientSignBlockedReason] = useState("");
  const [canClientSign, setCanClientSign] = useState(false);
  const [tabRefreshKey, setTabRefreshKey] = useState(0);

  const getClientPortalAuthConfig = () => {
    const clientToken = sessionStorage.getItem("client_token");

    const headers: Record<string, string> = {};

    if (clientToken) {
      headers.Authorization = `Bearer ${clientToken}`;
    }

    return { headers };
  };

  const documentSetters = {
    setDocuments,
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
      isClientPortalUploadVisible,
    );
    applyDocumentsFromApi(
      requirements.map((doc: any) => ({
        id: doc.id,
        name: doc.documentType?.name,
        status: doc.status,
        required: doc.isRequired,
        uploadedFiles: (doc.uploads || []).map((file: any) => ({
          uploadId: file.id,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          uploadedAt: file.uploadedAt,
          fileMimeType: file.fileMimeType,
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

  const getDocumentUploadedCount = (docId: string) =>
    documents.find((doc) => doc.id === docId)?.uploadedFiles.length || 0;

  const getRemainingUploadSlots = (docId: string) => {
    const pendingCount = files[docId]?.length || 0;
    return Math.max(0, MAX_FILES - getDocumentUploadedCount(docId) - pendingCount);
  };

  const handleFileChange = (id: string, newFiles: FileList | null) => {
    if (!newFiles) return;

    const selectedFiles = Array.from(newFiles);
    const existingFiles = files[id] || [];
    const remainingSlots =
      MAX_FILES - getDocumentUploadedCount(id) - existingFiles.length;

    if (remainingSlots <= 0) {
      toast.error(`You can upload maximum ${MAX_FILES} files for this document`);
      return;
    }

    const allowedFiles =
      selectedFiles.length > remainingSlots
        ? selectedFiles.slice(0, remainingSlots)
        : selectedFiles;

    if (allowedFiles.length < selectedFiles.length) {
      toast.error(`Only ${remainingSlots} more file slot(s) available`);
    }

    setFiles((prev) => ({
      ...prev,
      [id]: [...existingFiles, ...allowedFiles],
    }));
  };

  const removePendingFile = (docId: string, index: number) => {
    setFiles((prev) => {
      const updated = [...(prev[docId] || [])];
      updated.splice(index, 1);
      return {
        ...prev,
        [docId]: updated,
      };
    });
  };

  const openUploadedFilesPreview = (doc: DocumentItem, index = 0) => {
    if (!doc.uploadedFiles.length) return;
    setPreviewFiles(doc.uploadedFiles);
    setPreviewActiveIndex(Math.min(index, doc.uploadedFiles.length - 1));
  };

  const uploadFile = async (id: string) => {
    const fileList = files[id];
    if (!fileList || fileList.length === 0) return;

    if (!applicationId) {
      toast.error("Application not found. Please reopen the application.");
      return;
    }

    const authConfig = getClientPortalAuthConfig();
    if (!authConfig.headers.Authorization) {
      toast.error("Please sign in again to upload documents.");
      return;
    }

    setUploading((prev) => ({ ...prev, [id]: true }));

    try {
      for (const file of fileList) {
        const formData = new FormData();

        formData.append("loanApplicationId", applicationId);
        formData.append("documentRequirementId", id);
        formData.append("file", file);

        // Do not set Content-Type manually — browser must add multipart boundary.
        let uploadUrl = `${API_BASE}/client-portal/upload`;
        if (token) {
          uploadUrl += `?token=${encodeURIComponent(token)}`;
        }

        await axios.post(uploadUrl, formData, {
          headers: {
            ...authConfig.headers,
          },
        });
      }

      setFiles((prev) => ({ ...prev, [id]: [] }));

      toast.success("Document uploaded successfully");

      await fetchApplicationDetails(applicationId, { keepCurrentTab: true });
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
      const metadata = notification.metadata || {};
      const tabByEvent: Record<string, typeof activeTab> = {
        NEW_MESSAGE: "chat",
        DOCUMENTS_REQUESTED: metadata.signDocument ? "signDocuments" : "documents",
        LENDER_CONDITIONAL: "documents",
      };

      const nextTab = tabByEvent[notification.eventType || ""] || "application";

      if (nextTab === "documents") {
        await fetchApplicationDetails(appId, { keepCurrentTab: true });
        setActiveTab("documents");
        return;
      }

      if (nextTab === "signDocuments" || nextTab === "feeAgreement") {
        await fetchApplicationDetails(appId, { keepCurrentTab: true });
        setApplicationId(appId);
        setTabRefreshKey((key) => key + 1);
        setActiveTab(nextTab);
        return;
      }

      await fetchApplicationDetails(appId, { keepCurrentTab: true });
      setApplicationId(appId);
      setActiveTab(nextTab);
    }
  };

  const fetchApplications = useCallback(
    async (pageNumber = 1) => {
      try {
        setApplicationsLoading(true);

        let url = `${API_BASE}/client-portal/applications?page=${pageNumber}&limit=${APPLICATIONS_PAGE_SIZE}`;

        if (debouncedSearch) {
          url += `&search=${encodeURIComponent(debouncedSearch)}`;
        }
        if (statusFilter) {
          url += `&status=${encodeURIComponent(statusFilter)}`;
        }
        if (brokerFilter) {
          url += `&brokerOrgId=${encodeURIComponent(brokerFilter)}`;
        }

        if (token) url += `&token=${token}`;

        const res = await axios.get(url, getClientPortalAuthConfig());
        const nextTotalPages = Math.max(res.data?.meta?.totalPages || 1, 1);
        const resolvedPage = Math.min(
          res.data?.meta?.page || pageNumber,
          nextTotalPages,
        );

        setApplications(res.data?.data || []);
        setPage(resolvedPage);
        setTotalPages(nextTotalPages);
        setTotalApplications(res.data?.meta?.total || 0);
        setFilterBrokers(res.data?.meta?.filters?.brokers || []);
        setFilterStatuses(res.data?.meta?.filters?.statuses || []);
      } catch (err) {
        console.error(err);
      } finally {
        setApplicationsLoading(false);
      }
    },
    [debouncedSearch, statusFilter, brokerFilter, token],
  );

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

  const handleWorkspaceTab = async (tab: ApplicationWorkspaceTab) => {
    if (tab === "application") {
      setActiveTab("application");
      return;
    }

    if (tab === "chat") {
      setActiveTab("chat");
      return;
    }

    await openApplicationTab(tab);
  };

  const handleBackToApplications = () => {
    setSelectedApplication(null);
    setApplicationData(null);
    setApplicationId("");
    clearApplicationDocuments();
    setActiveTab("applications");
  };

  const renderApplicationWorkspaceHeader = () => (
    <ApplicationWorkspaceHeader
      activeTab={
        activeTab === "chat"
          ? "chat"
          : (activeTab as ApplicationWorkspaceTab)
      }
      applicationNumber={
        selectedApplication?.applicationNumber || applicationNumber
      }
      status={selectedApplication?.status || applicationData?.status}
      onTabChange={handleWorkspaceTab}
      onBackToApplications={handleBackToApplications}
      formatStatusLabel={formatStatusLabel}
      getStatusStyles={getStatusStyles}
      getStatusDot={getStatusDot}
    />
  );

  const totalUploadedDocuments = documents.filter(
    (doc) => (doc.uploadedFiles?.length || 0) > 0,
  ).length;

  const totalFiles = documents.reduce(
    (count, doc) => count + (doc.uploadedFiles?.length || 0),
    0,
  );

  const progress =
    documents.length === 0
      ? 0
      : Math.round((totalUploadedDocuments / documents.length) * 100);

  const currentPreviewFile = previewFiles[previewActiveIndex];
  const currentPreviewFileUrl = buildApiPublicFileUrl(
    API_BASE,
    currentPreviewFile?.fileUrl,
  );

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
  }, [activeTab, page, debouncedSearch, statusFilter, brokerFilter, fetchApplications]);

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || brokerFilter,
  );

  const clearApplicationFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setBrokerFilter("");
    setPage(1);
  };

  useEffect(() => {
    if (activeTab !== "applications" || page <= 1) return;
    applicationsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page, activeTab]);

  const applicationsRange = useMemo(
    () => getApplicationsRange(page, totalApplications),
    [page, totalApplications],
  );

  const visiblePages = useMemo(
    () => buildVisiblePages(page, totalPages),
    [page, totalPages],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading your portal...</p>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white p-4 sm:p-6">
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
          <header className="relative mb-6 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500" />

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

              <div className="flex min-w-0 items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-white to-cyan-50/50 p-4 ring-1 ring-blue-100/80">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-base font-bold text-blue-700 shadow-sm">
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
            {renderApplicationWorkspaceHeader()}
            {applicationDetailsLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <>
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
                <div className="sticky top-4 z-10 mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Upload Documents
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">{clientName}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-400">Application No.</p>
                      <p className="text-sm font-medium text-slate-700">
                        {applicationNumber}
                      </p>
                    </div>
                  </div>

                  {/* PROGRESS */}
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-gray-500">
                      <span>
                        {totalUploadedDocuments} / {documents.length} documents
                        uploaded · {totalFiles} file
                        {totalFiles === 1 ? "" : "s"}
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
                  {documents.map((doc) => {
                    const uploadedCount = doc.uploadedFiles.length;
                    const pendingFiles = files[doc.id] || [];
                    const remainingSlots = getRemainingUploadSlots(doc.id);
                    const canUploadMore =
                      remainingSlots > 0 || pendingFiles.length > 0;

                    return (
                    <div
                      key={doc.id}
                      className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      {/* TOP */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <FileText className="text-blue-600" size={20} />

                          {uploadedCount > 0 && (
                            <CheckCircle className="text-green-600" size={20} />
                          )}
                        </div>

                        <p className="text-sm font-medium text-gray-800 line-clamp-2">
                          {doc.name}
                        </p>

                        <p
                          className={`text-xs mt-1 font-medium ${
                            uploadedCount > 0
                              ? "text-green-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {uploadedCount > 0
                            ? `Uploaded · ${uploadedCount} file${uploadedCount === 1 ? "" : "s"}`
                            : "Pending"}
                        </p>

                        {uploadedCount > 0 && (
                          <div className="mt-3 space-y-2">
                            {doc.uploadedFiles.map((file, index) => (
                              <div
                                key={file.uploadId || `${doc.id}-${index}`}
                                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2"
                              >
                                <FileText size={14} className="shrink-0 text-blue-600" />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="truncate text-xs font-medium text-slate-700"
                                    title={file.fileName}
                                  >
                                    {file.fileName || "Uploaded file"}
                                  </p>
                                  {file.uploadedAt && (
                                    <p className="text-[10px] text-slate-400">
                                      {formatUploadedAt(file.uploadedAt)}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openUploadedFilesPreview(doc, index)
                                  }
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-blue-700"
                                >
                                  <Eye size={12} />
                                  View
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ACTIONS */}
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        {canUploadMore ? (
                          <div className="space-y-2">
                            <input
                              type="file"
                              multiple
                              accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,application/pdf,image/*"
                              disabled={remainingSlots <= 0}
                              id={`file-${doc.id}`}
                              className="hidden"
                              onChange={(e) => {
                                handleFileChange(doc.id, e.target.files);
                                e.target.value = "";
                              }}
                            />

                            {pendingFiles.length > 0 && (
                              <div className="space-y-1">
                                {pendingFiles.map((file, index) => (
                                  <div
                                    key={`${doc.id}-pending-${index}`}
                                    className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800"
                                  >
                                    <span className="truncate pr-2">
                                      {file.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removePendingFile(doc.id, index)
                                      }
                                      className="shrink-0 text-amber-700 hover:text-amber-900"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <label
                                htmlFor={`file-${doc.id}`}
                                className={`flex-1 text-center text-xs px-3 py-2 border rounded-lg cursor-pointer ${
                                  remainingSlots <= 0
                                    ? "bg-gray-200 cursor-not-allowed text-slate-500"
                                    : "hover:bg-gray-100"
                                }`}
                              >
                                {uploadedCount > 0 ? "Add More Files" : "Choose File"}
                              </label>

                              <button
                                type="button"
                                onClick={() => uploadFile(doc.id)}
                                disabled={
                                  pendingFiles.length === 0 || uploading[doc.id]
                                }
                                className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Upload size={14} />
                                {uploading[doc.id]
                                  ? "Uploading..."
                                  : uploadedCount > 0
                                    ? "Upload More"
                                    : "Upload"}
                              </button>
                            </div>

                            <p className="text-[10px] text-slate-400">
                              PDF, JPG, PNG, WEBP · up to {MAX_FILES} files ·{" "}
                              {remainingSlots} slot
                              {remainingSlots === 1 ? "" : "s"} left
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-slate-500">
                            Maximum {MAX_FILES} files uploaded. Use View to
                            preview your documents.
                          </p>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "signDocuments" && applicationId && (
          <div className="space-y-4">
            {renderApplicationWorkspaceHeader()}
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
          <div
            ref={applicationsSectionRef}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 px-5 py-6 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Your applications
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    Loan Applications
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                    Track status, upload documents, and stay updated on every
                    loan in one place.
                    {totalApplications > 0 && (
                      <span className="font-semibold text-slate-700">
                        {" "}
                        {totalApplications} total application
                        {totalApplications === 1 ? "" : "s"}.
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2.5 lg:max-w-xl">
                  <div className="relative w-full">
                    <FiSearch
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Search by ID, product, business, broker, or address..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      >
                        <FiX size={16} />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <FiBriefcase
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={14}
                      />
                      <select
                        value={brokerFilter}
                        onChange={(e) => {
                          setBrokerFilter(e.target.value);
                          setPage(1);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                      >
                        <option value="">All brokers</option>
                        {filterBrokers.map((broker) => (
                          <option key={broker.id} value={broker.id}>
                            {broker.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative flex-1">
                      <FiFilter
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={14}
                      />
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setPage(1);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                      >
                        <option value="">All statuses</option>
                        {filterStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearApplicationFilters}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        <FiX size={14} />
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
            {applicationsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`app-skeleton-${index}`}
                    className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <div className="h-1.5 bg-slate-200" />
                    <div className="space-y-4 p-5">
                      <div className="h-4 w-2/3 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                      <div className="h-16 rounded-xl bg-slate-100" />
                      <div className="h-2 rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
                  <FolderOpen className="text-white" size={28} />
                </div>
                <p className="text-base font-semibold text-slate-800">
                  No applications found
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  {hasActiveFilters
                    ? "Try different filters or clear them to see all applications."
                    : "Your loan applications will appear here once they are created."}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearApplicationFilters}
                    className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {applications.map((app) => {
                  const progress = getDocumentProgressPercent(app);
                  const docsComplete =
                    (app.documentProgress?.total || 0) > 0 &&
                    (app.documentProgress?.uploaded || 0) >=
                      (app.documentProgress?.total || 0);
                  const filesUploaded = app.documentProgress?.filesUploaded || 0;

                  return (
                    <article
                      key={app.id}
                      onClick={() => fetchApplicationDetails(app.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          fetchApplicationDetails(app.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <div
                        className={`h-1.5 ${getStatusAccentClass(app.status)}`}
                      />

                      <div className="flex flex-1 flex-col p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Application ID
                            </p>
                            <p
                              className="mt-1 truncate font-mono text-sm font-bold text-slate-900"
                              title={app.applicationNumber}
                            >
                              {app.applicationNumber}
                            </p>
                          </div>

                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusStyles(
                              app.status,
                            )}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${getStatusDot(app.status)}`}
                            />
                            {formatStatusLabel(app.status)}
                          </span>
                        </div>

                        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatLoanProductLabel(app.loanProduct)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Created{" "}
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

                        {hasApplicationCardSummary(app) && (
                          <div className="mb-4 space-y-2.5 rounded-xl border border-slate-100 bg-white px-3 py-3">
                            <ApplicationCardMetaRow
                              icon={<FiBriefcase size={14} />}
                              label="Broker"
                              value={app.broker?.name}
                            />
                            <ApplicationCardMetaRow
                              icon={<FiUser size={14} />}
                              label="Business"
                              value={app.businessName}
                            />
                            <ApplicationCardMetaRow
                              icon={<FiHome size={14} />}
                              label="Property"
                              value={app.propertyInfo}
                            />
                            <ApplicationCardMetaRow
                              icon={<FiLayers size={14} />}
                              label="Collateral"
                              value={app.collateralSummary}
                            />
                            <ApplicationCardMetaRow
                              icon={<FiMapPin size={14} />}
                              label="Address"
                              value={app.address}
                            />
                          </div>
                        )}

                        <div className="mt-auto space-y-3">
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Loan amount
                              </p>
                              <p className="mt-1 text-lg font-bold text-slate-900">
                                {formatApplicationAmount(app.amountRequested)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                docsComplete
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                              }`}
                            >
                              Docs {app.documentProgress?.uploaded || 0}/
                              {app.documentProgress?.total || 0}
                              {filesUploaded > 0
                                ? ` · ${filesUploaded} file${filesUploaded === 1 ? "" : "s"}`
                                : ""}
                            </span>
                          </div>

                          <div>
                            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
                              <span>Document progress</span>
                              <span
                                className={
                                  progress === 100
                                    ? "text-emerald-600"
                                    : "text-slate-600"
                                }
                              >
                                {progress}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progress === 100
                                    ? "bg-emerald-500"
                                    : "bg-gradient-to-r from-blue-600 to-cyan-500"
                                }`}
                                style={{ width: `${Math.max(progress, progress > 0 ? 8 : 0)}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-xs text-slate-500">
                              Open to view details & upload
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition group-hover:gap-2">
                              View
                              <ChevronRight size={14} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {totalApplications > 0 && (
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing {applicationsRange.start}-{applicationsRange.end} of{" "}
                  {totalApplications} application
                  {totalApplications === 1 ? "" : "s"}
                  {totalPages > 1 && (
                    <>
                      {" "}
                      · Page {page} of {totalPages}
                    </>
                  )}
                </p>

                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1 || applicationsLoading}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>

                    {visiblePages.map((pageNumber, index) =>
                      pageNumber === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-1 text-xs text-slate-400"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setPage(pageNumber)}
                          disabled={applicationsLoading}
                          className={`min-w-[2rem] rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            page === pageNumber
                              ? "bg-blue-600 text-white shadow-sm"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                      disabled={page === totalPages || applicationsLoading}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}

        {activeTab === "application" &&
          (applicationDetailsLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              Loading application details...
            </div>
          ) : applicationData ? (
            <>
              {renderApplicationWorkspaceHeader()}
              <div className="space-y-5">
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
                />

                {/* Client signature pad / signed state */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.28)] sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Digital Signature
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Sign to confirm your application details.
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${getStatusStyles(
                        applicationData.status,
                      )}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${getStatusDot(applicationData.status)}`}
                      />
                      {formatStatusLabel(applicationData.status)}
                    </span>
                  </div>

                  {isSignedFromAPI ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-center">
                      <p className="mb-2 text-xs font-medium text-emerald-700">
                        Signed by client
                      </p>
                      {signature ? (
                        <img
                          src={signature}
                          alt="Client signature"
                          className="mx-auto h-28 object-contain"
                        />
                      ) : (
                        <p className="text-sm text-slate-600">
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
                      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                        <SigCanvas
                          ref={sigRef}
                          penColor="black"
                          onEnd={handleEndSignature}
                          canvasProps={{
                            width: 900,
                            height: 220,
                            className:
                              "w-full max-w-full rounded-lg border-2 border-dashed border-slate-300 bg-white",
                          }}
                        />

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-xs text-slate-400">Sign above</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleUndoSignature}
                              disabled={!signature}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
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
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                !signature
                                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              Reset Signature
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleSubmitSignature}
                        disabled={!signature || submittingSign || !canClientSign}
                        className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition ${
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

                  <p className="mt-4 text-sm text-slate-500">
                    {applicationData?.submittedAt
                      ? `Submitted: ${formatClientPortalSubmittedDate(applicationData)}`
                      : `Application Created: ${formatClientPortalSubmittedDate(applicationData)}`}
                  </p>
                </div>
              </div>
            </>
          ) : null)}

        {activeTab === "feeAgreement" && (
          <>
            {renderApplicationWorkspaceHeader()}
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
          </>
        )}

        {activeTab === "chat" && (
          <>
            {renderApplicationWorkspaceHeader()}
          <Chat
            applicationId={
              selectedApplication?.id ||
              selectedApplication?.loanApplicationId ||
              applicationId
            }
            onBack={() => setActiveTab("application")}
          />
          </>
        )}
      </div>

      {previewFiles.length > 0 && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex h-[90vh] max-h-[90vh] w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-blue-600 to-teal-600 px-5 py-4 text-white">
              <div className="min-w-0 pr-4">
                <h2 className="truncate text-sm font-semibold">
                  {currentPreviewFile?.fileName || "Document preview"}
                </h2>
                <p className="text-xs text-white/70">
                  {previewActiveIndex + 1} / {previewFiles.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentPreviewFileUrl) {
                      toast.error("Download failed");
                      return;
                    }

                    try {
                      const res = await fetch(currentPreviewFileUrl, {
                        headers: getClientPortalAuthConfig().headers,
                      });
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download =
                        currentPreviewFile?.fileName || "document";
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                    } catch {
                      toast.error("Download failed");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium transition hover:bg-white/30"
                >
                  <Download size={14} />
                  Download
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewFiles([]);
                    setPreviewActiveIndex(0);
                  }}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs transition hover:bg-red-600"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-100">
              {previewActiveIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewActiveIndex((index) => index - 1)}
                  className="absolute left-4 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md"
                  aria-label="Previous file"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {previewActiveIndex < previewFiles.length - 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewActiveIndex((index) => index + 1)}
                  className="absolute right-4 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md"
                  aria-label="Next file"
                >
                  <ChevronRight size={20} />
                </button>
              )}

              <EmbeddedFilePreview
                remoteUrl={currentPreviewFileUrl}
                mimeType={inferUploadedFileMimeType(
                  currentPreviewFile?.fileName,
                  currentPreviewFile?.fileMimeType,
                )}
                fileName={currentPreviewFile?.fileName}
                getAuthHeaders={() => getClientPortalAuthConfig().headers}
                className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-4"
                iframeClassName="h-full min-h-0 w-full rounded-xl bg-white"
                imageClassName="max-h-full max-w-full rounded-xl object-contain shadow"
              />
            </div>

            {previewFiles.length > 1 && (
              <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Select file
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {previewFiles.map((file, index) => (
                    <button
                      key={file.uploadId || `${index}-${file.fileName}`}
                      type="button"
                      onClick={() => setPreviewActiveIndex(index)}
                      className={`min-w-[5rem] rounded-lg border px-2 py-2 text-left text-[10px] transition ${
                        index === previewActiveIndex
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="block truncate font-semibold">
                        {file.fileName || `File ${index + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
