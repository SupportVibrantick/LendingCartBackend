import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Upload,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  FolderOpen,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";
import FeeAgreement from "./FeeAgreement";
import { FiX, FiSearch } from "react-icons/fi";
import Chat from "./Chat";
import ClientNotificationDropdown, {
  resetClientNotificationSessionCache,
  type ClientNotification,
} from "./ClientNotificationDropdown";
import ClientPortalChrome, {
  type ApplicationWorkspaceTab,
} from "./ClientPortalChrome";
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
import { formatPhone } from "../UserManagement/loanOfficerShared";
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
  requestedAt?: string | null;
}

const MAX_FILES = 8;

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
    requestedAt: doc.requestedAt || doc.lastRequestedAt || null,
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
  import.meta.env.VITE_API_BASE || "https://api.loanautomation.ai";

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

const formatLoanProductLabel = (code?: unknown) => {
  const resolved =
    typeof code === "string"
      ? code
      : code && typeof code === "object"
        ? String(
            (code as { code?: unknown; name?: unknown }).code ||
              (code as { code?: unknown; name?: unknown }).name ||
              "",
          )
        : "";

  if (!resolved.trim()) return "Loan Application";

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
    RENTAL_PORTFOLIO_CRE: "Rental Portfolio",
    PURCHASE_ORDER_FINANCE: "Purchase Order Finance",
    ACCOUNTS_PAYABLE_FINANCE: "AP Supply Chain",
    ACCOUNTS_RECEIVABLE: "Accounts Receivable",
    INVOICE_FACTORING: "AR Factoring",
  };

  return labels[resolved] || resolved.replace(/_/g, " ");
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

const ApplicationCardMetaCell = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => {
  const resolved = value?.trim();
  if (!resolved) return null;

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
        {label}
      </p>
      <p
        className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-[#111827]"
        title={resolved}
      >
        {resolved}
      </p>
    </div>
  );
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

type ClientSignWorkspaceTab = "termSheet" | "signForms";

const normalizeClientSignResumeTab = (
  tab?: string | null,
): ClientSignWorkspaceTab => {
  if (tab === "termSheet" || tab === "signForms") return tab;
  if (tab === "signDocuments") return "signForms";
  return "signForms";
};

function inferDocumentCategory(name: string): string {
  const n = name.toLowerCase();
  if (
    /property|appraisal|title|insurance|hoa|lease|rent|dscr|photo|inspection/.test(
      n,
    )
  ) {
    return "Property";
  }
  if (
    /bank|tax|w-?2|1099|income|financial|profit|balance|statement|credit|asset/.test(
      n,
    )
  ) {
    return "Financial";
  }
  if (/entity|operating|articles|ein|llc|corp|formation|id|license|passport/.test(n)) {
    return "Identity & Entity";
  }
  return "Core";
}

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const sigRef = useRef<SignatureCanvas | null>(null);
  const signaturePadWrapRef = useRef<HTMLDivElement | null>(null);
  const applicationsSectionRef = useRef<HTMLDivElement | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [signaturePadSize, setSignaturePadSize] = useState({
    width: 600,
    height: 220,
  });
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
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
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
    | "documents"
    | "termSheet"
    | "signForms"
    | "application"
    | "chat"
    | "applications"
    | "feeAgreement"
  >("applications");
  const [isSignedFromAPI, setIsSignedFromAPI] = useState(false);
  const [clientSignBlockedReason, setClientSignBlockedReason] = useState("");
  const [canClientSign, setCanClientSign] = useState(false);
  const [tabRefreshKey, setTabRefreshKey] = useState(0);

  const getClientPortalAuthConfig = () => {
    const clientToken = sessionStorage.getItem("client_token")?.trim() || "";

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
        source: doc.source,
        requestedAt:
          doc.lastRequestedAt || doc.sentToClientAt || doc.createdAt || null,
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

      setProfileFirstName(String(data.firstName || "").trim());
      setProfileLastName(String(data.lastName || "").trim());
      setProfilePhone(data.phone ? formatPhone(String(data.phone)) : "");

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

  const openProfileEditor = () => {
    const parts = String(clientName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    setProfileForm({
      firstName: profileFirstName || parts[0] || "",
      lastName:
        profileLastName || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
      phone: profilePhone ? formatPhone(profilePhone) : "",
    });
    setProfileModalOpen(true);
  };

  const saveClientProfile = async () => {
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
    const phoneDigits = profileForm.phone.replace(/\D/g, "");
    const phone = phoneDigits ? formatPhone(phoneDigits) : "";

    if (!firstName) {
      toast.error("First name is required");
      return;
    }

    if (!lastName) {
      toast.error("Last name is required");
      return;
    }

    if (phoneDigits && phoneDigits.length !== 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }

    try {
      setProfileSaving(true);
      const res = await axios.put(
        `${API_BASE}/client-portal/profile`,
        { firstName, lastName, phone: phone || null },
        getClientPortalAuthConfig(),
      );

      const data = res.data?.data;
      if (!data) {
        throw new Error(res.data?.message || "Failed to update profile");
      }

      const nextName =
        (data.clientName && !isPlaceholderClientName(data.clientName)
          ? data.clientName
          : `${firstName} ${lastName}`.trim()) || firstName;

      setClientName(nextName);
      if (data.email) setClientEmail(data.email);
      setProfileFirstName(String(data.firstName || firstName).trim());
      setProfileLastName(String(data.lastName || lastName).trim());
      setProfilePhone(
        data.phone
          ? formatPhone(String(data.phone))
          : phone
            ? formatPhone(phone)
            : "",
      );

      const token = sessionStorage.getItem("client_token");
      if (token) {
        saveClientPortalSession(token, {
          clientName: nextName,
          email: data.email || clientEmail,
          clientId: data.clientId,
        });
      }

      setProfileModalOpen(false);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update profile",
      );
    } finally {
      setProfileSaving(false);
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
      // Portal account name (not application borrower). Prefer API portal identity.
      if (
        data?.clientName &&
        !isPlaceholderClientName(data.clientName)
      ) {
        setClientName(data.clientName);
      } else if (
        data?.portalClientName &&
        !isPlaceholderClientName(data.portalClientName)
      ) {
        setClientName(data.portalClientName);
      }
      if (data?.clientEmail || data?.borrower?.email) {
        setClientEmail(data.clientEmail || data.borrower?.email || "");
      }
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
      // Magic-link tokens are marked used after set-password. Prefer JWT when logged in.
      const authConfig = getClientPortalAuthConfig();
      const hasClientJwt = Boolean(authConfig.headers.Authorization);
      if (token && !hasClientJwt) {
        submitUrl += `?token=${encodeURIComponent(token)}`;
      }

      await axios.post(
        submitUrl,
        {
          loanApplicationId: applicationId,
          signature: capturedSignature,
        },
        authConfig,
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
        // Prefer JWT when logged in; invite token is often already consumed.
        if (token && !authConfig.headers.Authorization) {
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
      const isBrokerTermSheet = Boolean(metadata.brokerLoi);
      const isSignForm =
        Boolean(metadata.signDocument) && !isBrokerTermSheet;
      const tabByEvent: Record<string, typeof activeTab> = {
        NEW_MESSAGE: "chat",
        DOCUMENTS_REQUESTED: isBrokerTermSheet
          ? "termSheet"
          : isSignForm
            ? "signForms"
            : "documents",
        LENDER_CONDITIONAL: "documents",
      };

      let nextTab = tabByEvent[notification.eventType || ""] || "application";

      if (nextTab === "documents") {
        await fetchApplicationDetails(appId, { keepCurrentTab: true });
        setActiveTab("documents");
        return;
      }

      if (
        nextTab === "termSheet" ||
        nextTab === "signForms" ||
        nextTab === "feeAgreement"
      ) {
        await fetchApplicationDetails(appId, { keepCurrentTab: true });
        setApplicationId(appId);
        setTabRefreshKey((key) => key + 1);
        setActiveTab(nextTab);
        if (
          nextTab === "termSheet" &&
          metadata.brokerLoi &&
          Number(metadata.forwardedDocumentCount || 0) > 0
        ) {
          toast.success(
            "Term sheet ready to sign. Supporting documents are also under Upload Documents.",
            { duration: 5000 },
          );
        }
        return;
      }

      const details = await fetchApplicationDetails(appId, {
        keepCurrentTab: true,
      });
      setApplicationId(appId);
      if (
        nextTab === "chat" &&
        !Boolean(details?.entitlements?.chatEnabled)
      ) {
        nextTab = "application";
      }
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
      if (!data) {
        toast.error("Failed to fetch application details");
        return null;
      }

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

      return data;
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch application details");
      return null;
    } finally {
      setApplicationDetailsLoading(false);
    }
  };

  const openApplicationTab = async (
    tab: "documents" | "termSheet" | "signForms" | "feeAgreement",
  ) => {
    if (!applicationId) {
      toast.error("Select an application first");
      return;
    }

    if (tab === "termSheet" || tab === "signForms" || tab === "feeAgreement") {
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
      const enabled = Boolean(
        applicationData?.entitlements?.chatEnabled ??
          selectedApplication?.entitlements?.chatEnabled,
      );
      if (!enabled) {
        setActiveTab("application");
        return;
      }
      setActiveTab("chat");
      return;
    }

    await openApplicationTab(tab);
  };

  useEffect(() => {
    const resume = location.state as
      | { resumeApplicationId?: string; resumeTab?: string }
      | null;
    if (!resume?.resumeApplicationId) return;

    let cancelled = false;
    (async () => {
      await fetchApplicationDetails(resume.resumeApplicationId!, {
        keepCurrentTab: true,
      });
      if (cancelled) return;
      const nextTab = normalizeClientSignResumeTab(resume.resumeTab);
      setActiveTab(nextTab);
      setTabRefreshKey((key) => key + 1);
      navigate(location.pathname, { replace: true, state: {} });
    })();

    return () => {
      cancelled = true;
    };
    // Only run when resume state arrives from sign-document pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const resetToApplicationsList = useCallback(() => {
    setSelectedApplication(null);
    setApplicationData(null);
    setApplicationId("");
    clearApplicationDocuments();
    setActiveTab("applications");

    // Keep the session portal URL (drop magic-link token path) so browser Back
    // does not leave the portal or reopen login.
    if (token || location.pathname !== "/client-portal") {
      navigate("/client-portal", { replace: true });
    }
  }, [token, location.pathname, navigate]);

  const handleBackToApplications = useCallback(() => {
    // Prefer history.back() so we consume the workspace history entry we pushed.
    if (
      typeof window !== "undefined" &&
      (window.history.state as { clientPortalWorkspace?: boolean } | null)
        ?.clientPortalWorkspace
    ) {
      window.history.back();
      return;
    }
    resetToApplicationsList();
  }, [resetToApplicationsList]);

  const isWorkspaceMode = activeTab !== "applications";

  // Browser Back inside an application returns to the applications list
  // instead of the login page.
  useEffect(() => {
    if (!isWorkspaceMode) return;

    window.history.pushState({ clientPortalWorkspace: true }, "");

    const onPopState = () => {
      resetToApplicationsList();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isWorkspaceMode, resetToApplicationsList]);

  const chatEnabled = Boolean(
    applicationData?.entitlements?.chatEnabled ??
      selectedApplication?.entitlements?.chatEnabled,
  );

  useEffect(() => {
    if (activeTab === "chat" && applicationId && !chatEnabled) {
      setActiveTab("application");
    }
  }, [activeTab, applicationId, chatEnabled]);

  const workspaceStatus = selectedApplication?.status || applicationData?.status;

  const portalNotifications =
    Boolean(sessionStorage.getItem("client_token")) ? (
      <ClientNotificationDropdown
        apiBase={API_BASE}
        onNotificationClick={handleClientNotificationClick}
      />
    ) : null;

  const renderApplicationWorkspace = (children: React.ReactNode) => (
    <>
      {isClientPortalImpersonationSession() ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>You are viewing this client portal as a broker admin.</span>
          <button
            type="button"
            onClick={exitClientPortalImpersonation}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
          >
            Close portal tab
          </button>
        </div>
      ) : null}
      <ClientPortalChrome
        mode="workspace"
        activeTab={
          activeTab === "chat"
            ? "chat"
            : (activeTab as ApplicationWorkspaceTab)
        }
        onTabChange={handleWorkspaceTab}
        onBackToApplications={handleBackToApplications}
        chatEnabled={chatEnabled}
        displayName={
          !isPlaceholderClientName(clientName)
            ? clientName
            : clientEmail?.split("@")[0] || "Client"
        }
        displayEmail={clientEmail || "—"}
        clientInitials={getClientInitials(
          !isPlaceholderClientName(clientName)
            ? clientName
            : clientEmail?.split("@")[0] || "Client",
        )}
        isImpersonation={isClientPortalImpersonationSession()}
        onLogout={handleLogout}
        onEditProfile={openProfileEditor}
        notifications={portalNotifications}
        applicationNumber={
          selectedApplication?.applicationNumber || applicationNumber
        }
        statusChip={
          workspaceStatus ? (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusStyles(
                workspaceStatus,
              )}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${getStatusDot(workspaceStatus)}`}
              />
              {formatStatusLabel(workspaceStatus)}
            </span>
          ) : null
        }
        pageTitle={
          activeTab === "documents"
            ? "Document Checklist"
            : activeTab === "termSheet"
              ? "Term Sheet"
              : activeTab === "signForms"
                ? "Fill & Sign Forms"
                : activeTab === "feeAgreement"
                  ? "Fee Agreement"
                  : activeTab === "chat"
                    ? "Messages"
                    : "Loan Application"
        }
        pageSubtitle={
          activeTab === "documents"
            ? "Upload directly — no email chains."
            : [
                selectedApplication?.broker?.name ||
                  applicationData?.broker?.name,
                formatLoanProductLabel(
                  applicationData?.loanProductCode ||
                    selectedApplication?.loanProduct ||
                    applicationData?.loanProduct,
                ),
                formatApplicationAmount(
                  selectedApplication?.amountRequested ||
                    applicationData?.amountRequested,
                ),
              ]
                .filter(Boolean)
                .join(" · ") || undefined
        }
        compact={activeTab === "chat"}
      >
        {children}
      </ClientPortalChrome>
    </>
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

  // Keep canvas buffer size in sync with CSS display size to avoid draw offset.
  useEffect(() => {
    if (
      activeTab !== "application" ||
      isSignedFromAPI ||
      !canClientSign
    ) {
      return;
    }

    const el = signaturePadWrapRef.current;
    if (!el) return;

    const updateSize = () => {
      const width = Math.floor(el.clientWidth);
      if (width <= 0) return;
      setSignaturePadSize((prev) => {
        if (prev.width === width && prev.height === 220) return prev;
        return { width, height: 220 };
      });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [activeTab, isSignedFromAPI, canClientSign, applicationId]);

  useEffect(() => {
    // Canvas remounts when pad size changes; drop any in-progress strokes.
    if (isSignedFromAPI) return;
    setSignature("");
    sigRef.current?.clear();
  }, [signaturePadSize.width, signaturePadSize.height, isSignedFromAPI]);

  const handleLogout = () => {
    if (isClientPortalImpersonationSession()) {
      exitClientPortalImpersonation();
      return;
    }

    resetClientNotificationSessionCache();
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

  const applicationOverviewStats = useMemo(() => {
    const pendingDocs = applications.filter((app) => {
      const total = Number(app.documentProgress?.total) || 0;
      const uploaded = Number(app.documentProgress?.uploaded) || 0;
      return total > 0 && uploaded < total;
    }).length;
    const inReview = applications.filter(
      (app) =>
        app.status === "IN_REVIEW" ||
        app.status === "SUBMITTED" ||
        app.status === "PENDING" ||
        app.status === "CLIENT_PENDING",
    ).length;
    return { pendingDocs, inReview };
  }, [applications]);

  if (loading) {
    return (
      <div className="client-portal flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F7F9FC] text-[#64748B]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4C78F5]" />
        <p className="text-sm font-medium">Loading your portal...</p>
      </div>
    );
  }

  // Account chrome = portal identity; loan screens = application borrower.
  const applicationBorrowerName = (() => {
    const candidates = [
      applicationData?.borrower?.name,
      selectedApplication?.borrowerName,
    ];
    for (const name of candidates) {
      if (name && !isPlaceholderClientName(name)) return name;
    }
    return "";
  })();
  const displayName = (() => {
    if (clientName && !isPlaceholderClientName(clientName)) return clientName;
    if (applicationBorrowerName) return applicationBorrowerName;
    return clientEmail?.split("@")[0] || "Client";
  })();
  const displayEmail = clientEmail || applicationData?.borrower?.email || "-";
  const loanDisplayName = applicationBorrowerName || displayName;
  const clientInitials = getClientInitials(displayName);
  const isImpersonation = isClientPortalImpersonationSession();

  const documentsByCategory = (() => {
    const groups = new Map<string, DocumentItem[]>();
    for (const doc of documents) {
      const key = inferDocumentCategory(doc.name);
      const list = groups.get(key) || [];
      list.push(doc);
      groups.set(key, list);
    }
    const order = ["Core", "Property", "Financial", "Identity & Entity"];
    return order
      .filter((key) => groups.has(key))
      .map((key) => ({ category: key, items: groups.get(key)! }));
  })();

  const applicationsSearchSlot = (
    <div className="relative w-full">
      <FiSearch
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
        size={16}
      />
      <input
        type="text"
        placeholder="Search applications..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="cp-search pr-9"
      />
      {search ? (
        <button
          type="button"
          onClick={() => setSearch("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[#94A3B8] hover:text-[#64748B]"
          aria-label="Clear search"
        >
          <FiX size={16} />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {activeTab === "documents" &&
        renderApplicationWorkspace(
          <>
            {applicationDetailsLoading ? (
              <div className="flex items-center justify-center py-20 text-[14px] text-[#64748B]">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="cp-card flex h-[50vh] flex-col items-center justify-center gap-3 p-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#4C78F5]/10 text-[#4C78F5]">
                  <FileText size={28} />
                </div>
                <p className="text-[16px] font-semibold text-[#111827]">
                  No Documents Required
                </p>
                <p className="max-w-sm text-[14px] leading-relaxed text-[#64748B]">
                  This application currently doesn’t require any documents.
                  You’re all set for now — we’ll notify you if anything is
                  needed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="cp-card p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[16px] font-semibold text-[#111827]">
                      Document Checklist
                    </h2>
                    <p className="text-[13px] font-medium text-[#64748B]">
                      {totalUploadedDocuments}/{documents.length} · {progress}%
                    </p>
                  </div>
                  <div className="cp-progress-track mt-3">
                    <div
                      className="cp-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-[#64748B]">
                    Auto-generated by loan program. Upload directly — no email
                    chains. {totalFiles} file{totalFiles === 1 ? "" : "s"} on
                    file.
                  </p>
                </div>

                {documentsByCategory.map(({ category, items }) => (
                  <div key={category} className="cp-card overflow-hidden">
                    <div className="border-b border-[#E2E8F0] px-4 py-3 sm:px-5">
                      <h3 className="text-[15px] font-semibold text-[#111827]">
                        {category}
                      </h3>
                    </div>
                    <ul className="divide-y divide-[#E2E8F0]">
                      {items.map((doc) => {
                        const uploadedCount = doc.uploadedFiles.length;
                        const pendingFiles = files[doc.id] || [];
                        const remainingSlots = getRemainingUploadSlots(doc.id);
                        const canUploadMore =
                          remainingSlots > 0 || pendingFiles.length > 0;
                        const isComplete = uploadedCount > 0;

                        return (
                          <li
                            key={doc.id}
                            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                          >
                            <div className="flex min-w-0 flex-1 gap-3">
                              <div
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                  isComplete
                                    ? "bg-[#10B981]/10 text-[#10B981]"
                                    : "bg-[#F59E0B]/10 text-[#F59E0B]"
                                }`}
                              >
                                {isComplete ? (
                                  <CheckCircle2 size={18} />
                                ) : (
                                  <Lock size={15} />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold text-[#111827]">
                                  {doc.name}
                                </p>
                                <p className="mt-0.5 text-[13px] text-[#64748B]">
                                  {isComplete
                                    ? `Received${doc.required ? " · Required" : ""}`
                                    : `Pending${doc.required ? " · Required" : " · Optional"}`}
                                  {doc.requestedAt
                                    ? ` · Requested ${formatUploadedAt(doc.requestedAt)}`
                                    : ""}
                                </p>

                                {uploadedCount > 0 ? (
                                  <div className="mt-2 space-y-1.5">
                                    {doc.uploadedFiles.map((file, index) => (
                                      <div
                                        key={
                                          file.uploadId || `${doc.id}-${index}`
                                        }
                                        className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-2.5 py-2"
                                      >
                                        <FileText
                                          size={14}
                                          className="shrink-0 text-[#4C78F5]"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <p
                                            className="truncate text-[12px] font-medium text-[#111827]"
                                            title={file.fileName}
                                          >
                                            {file.fileName || "Uploaded file"}
                                          </p>
                                          {file.uploadedAt ? (
                                            <p className="text-[11px] text-[#64748B]">
                                              {formatUploadedAt(file.uploadedAt)}
                                            </p>
                                          ) : null}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openUploadedFilesPreview(doc, index)
                                          }
                                          className="inline-flex items-center gap-1 rounded-md bg-[#4C78F5] px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-[#3B66E0]"
                                        >
                                          <Eye size={12} />
                                          View
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {canUploadMore ? (
                                  <div className="mt-3 space-y-2">
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
                                    {pendingFiles.length > 0 ? (
                                      <div className="space-y-1">
                                        {pendingFiles.map((file, index) => (
                                          <div
                                            key={`${doc.id}-pending-${index}`}
                                            className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1.5 text-[12px] text-amber-800"
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
                                    ) : null}
                                    <div className="flex flex-wrap gap-2">
                                      <label
                                        htmlFor={`file-${doc.id}`}
                                        className={`cursor-pointer rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium ${
                                          remainingSlots <= 0
                                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                            : "bg-white text-[#111827] hover:bg-[#F7F9FC]"
                                        }`}
                                      >
                                        {uploadedCount > 0
                                          ? "Add More Files"
                                          : "Choose File"}
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => uploadFile(doc.id)}
                                        disabled={
                                          pendingFiles.length === 0 ||
                                          uploading[doc.id]
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-[#4C78F5] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#3B66E0] disabled:opacity-50"
                                      >
                                        <Upload size={14} />
                                        {uploading[doc.id]
                                          ? "Uploading..."
                                          : uploadedCount > 0
                                            ? "Upload More"
                                            : "Upload"}
                                      </button>
                                    </div>
                                    <p className="text-[11px] text-[#94A3B8]">
                                      PDF, JPG, PNG, WEBP · up to {MAX_FILES}{" "}
                                      files · {remainingSlots} slot
                                      {remainingSlots === 1 ? "" : "s"} left
                                    </p>
                                  </div>
                                ) : (
                                  <p className="mt-2 text-[12px] text-[#64748B]">
                                    Maximum {MAX_FILES} files uploaded.
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 sm:pt-1 sm:text-right">
                              <span
                                className={`text-[13px] font-semibold ${
                                  isComplete
                                    ? "text-[#10B981]"
                                    : "text-[#F59E0B]"
                                }`}
                              >
                                {isComplete ? "On file" : "Action needed"}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>,
        )}

      {activeTab === "termSheet" &&
        applicationId &&
        renderApplicationWorkspace(
          <SignDocumentsPanel
            key={`term-sheet-${tabRefreshKey}`}
            mode="client"
            clientView="termSheet"
            apiBase={API_BASE}
            getAuthHeaders={() => getClientPortalAuthConfig().headers}
            loanApplicationId={applicationId}
            clientName={loanDisplayName}
            applicationNumber={applicationNumber}
            onUpdated={() => {
              if (applicationId) {
                void fetchApplicationDetails(applicationId, {
                  keepCurrentTab: true,
                });
              }
            }}
          />,
        )}

      {activeTab === "signForms" &&
        applicationId &&
        renderApplicationWorkspace(
          <SignDocumentsPanel
            key={`sign-forms-${tabRefreshKey}`}
            mode="client"
            clientView="signForms"
            apiBase={API_BASE}
            getAuthHeaders={() => getClientPortalAuthConfig().headers}
            loanApplicationId={applicationId}
            clientName={loanDisplayName}
            applicationNumber={applicationNumber}
            onUpdated={() => {
              if (applicationId) {
                void fetchApplicationDetails(applicationId, {
                  keepCurrentTab: true,
                });
              }
            }}
          />,
        )}

      {activeTab === "applications" && (
        <ClientPortalChrome
          mode="applications"
          displayName={displayName}
          displayEmail={displayEmail}
          clientInitials={clientInitials}
          isImpersonation={isImpersonation}
          onLogout={handleLogout}
          onEditProfile={openProfileEditor}
          notifications={portalNotifications}
          searchSlot={applicationsSearchSlot}
          pageTitle="Borrower Portal"
          pageSubtitle={`Welcome back, ${displayName}`}
        >
          {isImpersonation ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              <span>You are viewing this client portal as a broker admin.</span>
              <button
                type="button"
                onClick={exitClientPortalImpersonation}
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
              >
                Close portal tab
              </button>
            </div>
          ) : null}

          <div ref={applicationsSectionRef} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="cp-stat">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                  Applications
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums text-[#111827]">
                  {applicationsLoading ? "—" : totalApplications}
                </p>
                <p className="mt-0.5 text-[12px] text-[#64748B]">
                  Across all brokers
                </p>
              </div>
              <div className="cp-stat">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                  Needs attention
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums text-[#111827]">
                  {applicationsLoading
                    ? "—"
                    : applicationOverviewStats.pendingDocs}
                </p>
                <p className="mt-0.5 text-[12px] text-[#64748B]">
                  Documents still pending
                </p>
              </div>
              <div className="cp-stat">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                  In pipeline
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums text-[#111827]">
                  {applicationsLoading
                    ? "—"
                    : applicationOverviewStats.inReview}
                </p>
                <p className="mt-0.5 text-[12px] text-[#64748B]">
                  Pending or in review
                </p>
              </div>
            </div>

            <div className="cp-card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold text-[#111827]">
                    Loan applications
                  </h2>
                  <p className="mt-0.5 text-[13px] text-[#64748B]">
                    {applicationsLoading
                      ? "Loading applications..."
                      : `${totalApplications} application${
                          totalApplications === 1 ? "" : "s"
                        }${
                          debouncedSearch
                            ? ` matching "${debouncedSearch}"`
                            : ""
                        }`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2">
                  <select
                    value={brokerFilter}
                    onChange={(e) => {
                      setBrokerFilter(e.target.value);
                      setPage(1);
                    }}
                    className="cp-input !w-auto min-w-[148px] max-w-[200px]"
                  >
                    <option value="">All brokers</option>
                    {filterBrokers.map((broker) => (
                      <option key={broker.id} value={broker.id}>
                        {broker.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="cp-input !w-auto min-w-[148px] max-w-[180px]"
                  >
                    <option value="">All statuses</option>
                    {filterStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>
                    ))}
                  </select>

                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearApplicationFilters}
                      className="cp-btn-secondary h-10 shrink-0 px-3 text-[12px]"
                    >
                      <FiX size={14} />
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {applicationsLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={`app-skeleton-${index}`}
                        className="animate-pulse overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white"
                      >
                        <div className="h-1.5 bg-[#E2E8F0]" />
                        <div className="space-y-4 p-5">
                          <div className="h-4 w-2/3 rounded bg-[#E2E8F0]" />
                          <div className="h-3 w-1/2 rounded bg-[#F1F5F9]" />
                          <div className="h-20 rounded-lg bg-[#F1F5F9]" />
                          <div className="h-2 rounded-full bg-[#F1F5F9]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : applications.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#4C78F5]/10 text-[#4C78F5]">
                      <FolderOpen size={24} />
                    </div>
                    <h3 className="text-[16px] font-semibold text-[#111827]">
                      No applications found
                    </h3>
                    <p className="mt-1 max-w-md text-[14px] text-[#64748B]">
                      {hasActiveFilters
                        ? "Try adjusting your search or filters."
                        : "Your loan applications will appear here once they are created."}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={clearApplicationFilters}
                        className="cp-btn-primary mt-4"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {applications.map((app) => {
                      const progress = getDocumentProgressPercent(app);
                      const docsUploaded = app.documentProgress?.uploaded || 0;
                      const docsTotal = app.documentProgress?.total || 0;
                      const docsComplete =
                        docsTotal > 0 && docsUploaded >= docsTotal;
                      const createdLabel = new Date(
                        app.createdAt,
                      ).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });
                      const metaItems = [
                        { label: "Broker", value: app.broker?.name },
                        { label: "Business", value: app.businessName },
                        {
                          label: "Property",
                          value: app.propertyInfo || app.collateralSummary,
                        },
                        { label: "Address", value: app.address },
                      ].filter((item) => Boolean(item.value?.trim()));
                      const loanAmountLabel = formatApplicationAmount(
                        app.amountRequested,
                      );
                      const hasLoanAmount = loanAmountLabel !== "—";

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
                          className="cp-card-hover group flex h-full cursor-pointer flex-col overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#4C78F5]/25"
                        >
                          <div className="flex flex-1 flex-col p-5">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <p
                                className="min-w-0 truncate font-mono text-[12px] font-medium text-[#94A3B8]"
                                title={app.applicationNumber}
                              >
                                {app.applicationNumber}
                              </p>
                              <span
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusStyles(
                                  app.status,
                                )}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${getStatusDot(app.status)}`}
                                />
                                {formatStatusLabel(app.status)}
                              </span>
                            </div>

                            <div className="mb-4">
                              <h3 className="text-[18px] font-semibold tracking-tight text-[#111827]">
                                {formatLoanProductLabel(app.loanProduct)}
                              </h3>
                              <p className="mt-1 text-[12px] text-[#94A3B8]">
                                Created {createdLabel}
                              </p>
                            </div>

                            {metaItems.length > 0 ? (
                              <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
                                {metaItems.map((item) => (
                                  <ApplicationCardMetaCell
                                    key={item.label}
                                    label={item.label}
                                    value={item.value}
                                  />
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-auto space-y-3 border-t border-[#E2E8F0] pt-4">
                              <div className="flex items-end justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                                    Loan amount
                                  </p>
                                  <p
                                    className={`mt-1 truncate text-[20px] font-semibold tracking-tight ${
                                      hasLoanAmount
                                        ? "tabular-nums text-[#111827]"
                                        : "text-[15px] text-[#94A3B8]"
                                    }`}
                                  >
                                    {hasLoanAmount
                                      ? loanAmountLabel
                                      : "Not set yet"}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    docsComplete
                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                      : "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
                                  }`}
                                >
                                  Docs {docsUploaded}/{docsTotal}
                                </span>
                              </div>

                              <div>
                                <div className="mb-1.5 flex items-center justify-between text-[12px] text-[#64748B]">
                                  <span>Document progress</span>
                                  <span
                                    className={`font-semibold tabular-nums ${
                                      progress === 100
                                        ? "text-[#10B981]"
                                        : "text-[#111827]"
                                    }`}
                                  >
                                    {progress}%
                                  </span>
                                </div>
                                <div className="cp-progress-track">
                                  <div
                                    className="cp-progress-fill"
                                    style={{
                                      width: `${Math.max(
                                        progress,
                                        progress > 0 ? 8 : 0,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-1 pt-1 text-[13px] font-semibold text-[#4C78F5] transition group-hover:gap-2">
                                Open details & upload docs
                                <ChevronRight size={15} />
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {totalApplications > 0 ? (
                  <div className="mt-5 flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-[#64748B]">
                      Showing{" "}
                      <span className="font-medium text-[#111827]">
                        {applicationsRange.start}-{applicationsRange.end}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium text-[#111827]">
                        {totalApplications}
                      </span>
                    </p>

                    {totalPages > 1 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPage((current) => Math.max(1, current - 1))
                          }
                          disabled={page === 1 || applicationsLoading}
                          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111827] transition hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="inline-flex items-center gap-1">
                            <ChevronLeft className="h-4 w-4" />
                            Prev
                          </span>
                        </button>

                        {visiblePages.map((pageNumber, index) =>
                          pageNumber === "ellipsis" ? (
                            <span
                              key={`ellipsis-${index}`}
                              className="px-1 text-[13px] text-[#94A3B8]"
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              key={pageNumber}
                              type="button"
                              onClick={() => setPage(pageNumber)}
                              disabled={applicationsLoading}
                              className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition ${
                                page === pageNumber
                                  ? "border-[#4C78F5] bg-[#4C78F5] text-white"
                                  : "border-[#E2E8F0] bg-white text-[#111827] hover:bg-[#F7F9FC]"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          ),
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setPage((current) =>
                              Math.min(totalPages, current + 1),
                            )
                          }
                          disabled={page === totalPages || applicationsLoading}
                          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111827] transition hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="inline-flex items-center gap-1">
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </ClientPortalChrome>
      )}

      {activeTab === "application" &&
        (applicationDetailsLoading
          ? renderApplicationWorkspace(
              <div className="flex items-center justify-center py-20 text-[14px] text-[#64748B]">
                Loading application details...
              </div>,
            )
          : applicationData
            ? renderApplicationWorkspace(
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
                  hideSignature
                  applicationId={applicationId || applicationData.id}
                  apiBase={API_BASE}
                  getAuthHeaders={() => getClientPortalAuthConfig().headers}
                />

                {/* Client signature pad / signed state */}
                <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="h-4 w-1 rounded-full bg-[#4C78F5]" />
                        <h3 className="text-[15px] font-semibold text-[#111827]">
                          Digital Signature
                        </h3>
                      </div>
                      <p className="text-[13px] text-[#64748B]">
                        Sign below to confirm your application details.
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyles(
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
                      <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F7F9FC] p-4">
                        <div ref={signaturePadWrapRef} className="w-full">
                          <SigCanvas
                            key={`sig-pad-${signaturePadSize.width}x${signaturePadSize.height}`}
                            ref={sigRef}
                            penColor="black"
                            onEnd={handleEndSignature}
                            clearOnResize={false}
                            canvasProps={{
                              width: signaturePadSize.width,
                              height: signaturePadSize.height,
                              className:
                                "block touch-none rounded-lg border-2 border-dashed border-[#4C78F5]/30 bg-white",
                              style: {
                                width: "100%",
                                height: `${signaturePadSize.height}px`,
                              },
                            }}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-400">Sign above</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleUndoSignature}
                              disabled={!signature}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                !signature
                                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
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
                                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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
                        className={`mt-4 w-full rounded-[8px] py-2.5 text-sm font-semibold transition ${
                          !signature || submittingSign || !canClientSign
                            ? "cursor-not-allowed bg-gray-200 text-gray-500"
                            : "bg-[#4C78F5] text-white hover:bg-[#3B66E0]"
                        }`}
                      >
                        {submittingSign
                          ? "Submitting..."
                          : "Submit Signature"}
                      </button>
                    </>
                  )}

                  <p className="mt-4 text-sm text-gray-500">
                    {applicationData?.submittedAt
                      ? `Submitted: ${formatClientPortalSubmittedDate(applicationData)}`
                      : `Application Created: ${formatClientPortalSubmittedDate(applicationData)}`}
                  </p>
                </div>
              </div>,
                )
              : null)}

      {activeTab === "feeAgreement" &&
        renderApplicationWorkspace(
          <FeeAgreement
            key={tabRefreshKey}
            applicationId={
              selectedApplication?.id ||
              selectedApplication?.loanApplicationId ||
              applicationId
            }
            getAuthHeaders={() => getClientPortalAuthConfig().headers}
            onBack={() => setActiveTab("application")}
          />,
        )}

      {activeTab === "chat" &&
        chatEnabled &&
        renderApplicationWorkspace(
          <div className="h-full min-h-0 overflow-hidden">
            <Chat
              applicationId={
                selectedApplication?.id ||
                selectedApplication?.loanApplicationId ||
                applicationId
              }
              applicationNumber={
                selectedApplication?.applicationNumber || applicationNumber
              }
              onBack={() => setActiveTab("application")}
            />
          </div>,
        )}

      {profileModalOpen ? (
        <div className="fixed inset-0 z-[999998] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-profile-edit-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="client-profile-edit-title"
                  className="text-base font-bold text-slate-900"
                >
                  Edit profile
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Update how your name appears in the client portal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                disabled={profileSaving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Email is used for login and can’t be changed here.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    First name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    className="w-full rounded-[8px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4C78F5] focus:ring-4 focus:ring-[#4C78F5]/15"
                    placeholder="First name"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    className="w-full rounded-[8px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4C78F5] focus:ring-4 focus:ring-[#4C78F5]/15"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone: formatPhone(e.target.value),
                    }))
                  }
                  className="w-full rounded-[8px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#4C78F5] focus:ring-4 focus:ring-[#4C78F5]/15"
                  placeholder="222-222-2222"
                  maxLength={12}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                disabled={profileSaving}
                className="rounded-[8px] px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveClientProfile}
                disabled={profileSaving}
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#4C78F5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-60"
              >
                {profileSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewFiles.length > 0 && (
        <div
          className="fixed inset-0 z-[999999] flex bg-slate-950/75"
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
          onClick={() => {
            setPreviewFiles([]);
            setPreviewActiveIndex(0);
          }}
        >
          <div
            className="flex h-dvh w-screen min-h-0 flex-col overflow-hidden bg-[#0f172a]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#111827] px-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#93B4FF]">
                  Document preview
                  {previewFiles.length > 1
                    ? ` · ${previewActiveIndex + 1}/${previewFiles.length}`
                    : ""}
                </p>
                <h2 className="truncate text-[13px] font-semibold leading-tight text-white">
                  {currentPreviewFile?.fileName || "Document"}
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#4C78F5] px-3 text-[12px] font-semibold text-white transition hover:bg-[#3B66E0]"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewFiles([]);
                    setPreviewActiveIndex(0);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/15 bg-white/5 text-white/90 transition hover:bg-white/10"
                  aria-label="Close preview"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {previewActiveIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewActiveIndex((index) => index - 1)}
                  className="absolute left-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
                  aria-label="Previous file"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {previewActiveIndex < previewFiles.length - 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewActiveIndex((index) => index + 1)}
                  className="absolute right-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
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
                className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#0f172a] p-3 sm:p-5"
                iframeClassName="h-full min-h-0 w-full bg-white"
                imageClassName="max-h-full max-w-full object-contain"
              />
            </div>

            {previewFiles.length > 1 && (
              <div className="shrink-0 border-t border-white/10 bg-[#111827] px-3 py-2.5 sm:px-4">
                <div className="flex gap-2 overflow-x-auto">
                  {previewFiles.map((file, index) => (
                    <button
                      key={file.uploadId || `${index}-${file.fileName}`}
                      type="button"
                      onClick={() => setPreviewActiveIndex(index)}
                      className={`min-w-[7rem] max-w-[11rem] rounded-[8px] border px-2.5 py-2 text-left text-[11px] transition ${
                        index === previewActiveIndex
                          ? "border-[#4C78F5] bg-[#4C78F5]/20 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
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
    </>
  );
}
