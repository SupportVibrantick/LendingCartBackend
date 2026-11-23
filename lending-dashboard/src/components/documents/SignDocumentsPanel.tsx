import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileText,
  LayoutGrid,
  Loader2,
  MoreVertical,
  PenLine,
  Search,
  SendHorizonal,
  Upload,
  X,
} from "lucide-react";
import { canMarkSignSeen } from "../../lib/lenderPermissions";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import SignFormFilledViewer from "./SignFormFilledViewer";
import EmbeddedFilePreview from "./EmbeddedFilePreview";

const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

type SignDocsCacheEntry = { promise: Promise<any>; expiresAt: number };
const signDocumentsCache = new Map<string, SignDocsCacheEntry>();
const SIGN_DOCUMENTS_CACHE_TTL_MS = 8_000;

async function fetchSignDocumentsCached(url: string, headers: HeadersInit) {
  const now = Date.now();
  const hit = signDocumentsCache.get(url);
  if (hit && hit.expiresAt > now) return hit.promise;

  const request = (async () => {
    const res = await fetch(url, { headers });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load sign documents");
    }
    return json;
  })().catch((error) => {
    const current = signDocumentsCache.get(url);
    if (current?.promise === request) signDocumentsCache.delete(url);
    throw error;
  });

  signDocumentsCache.set(url, {
    promise: request,
    expiresAt: now + SIGN_DOCUMENTS_CACHE_TTL_MS,
  });
  return request;
}

const sanitizeDownloadName = (value: string) =>
  value.replace(/[<>:"/\\|?*\n\r]+/g, "-").trim() || "document";

const getDownloadExtension = (
  mime?: string | null,
  url?: string | null,
  fallbackFileName?: string | null,
) => {
  const fromFileName = fallbackFileName
    ? fallbackFileName.match(/(\.[a-z0-9]+)$/i)?.[1]
    : null;
  if (fromFileName) return fromFileName.toLowerCase();

  const fromUrl = url?.match(/(\.[a-z0-9]+)(?:\?|$)/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();

  const mimeValue = (mime || "").toLowerCase();
  if (mimeValue.includes("pdf")) return ".pdf";
  if (mimeValue.includes("jpeg") || mimeValue.includes("jpg")) return ".jpg";
  if (mimeValue.includes("png")) return ".png";
  if (mimeValue.includes("webp")) return ".webp";
  return "";
};

export type SignDocumentRow = {
  requirementId: string;
  documentName: string;
  signStatus?: string | null;
  signStatusLabel?: string | null;
  signMode?: string | null;
  formProcessingStatus?: string | null;
  activeFormVersionId?: string | null;
  fieldCount?: number | null;
  hasSignatureField?: boolean | null;
  formProgress?: {
    client: { required: number; filled: number; total: number; complete: boolean };
    broker: { required: number; filled: number; total: number; complete: boolean };
    all: { required: number; filled: number; total: number; complete: boolean };
  } | null;
  workflowHint?: string | null;
  brokerBucket?: string | null;
  lenderBucket?: string | null;
  clientBucket?: string | null;
  templateFileName?: string | null;
  templateFileUrl?: string | null;
  templateMimeType?: string | null;
  lenderName?: string | null;
  signedUpload?: {
    uploadId: string;
    fileName: string;
    fileUrl: string;
    fileMimeType?: string | null;
    clientSignatureData?: string | null;
  } | null;
};

type SignDocumentsPanelProps = {
  mode: "lender" | "broker" | "client";
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  applicationLenderId?: string;
  submissionId?: string;
  loanApplicationId?: string;
  onUpdated?: () => void;
  readOnly?: boolean;
};

const LENDER_SIGN_DOCUMENTS_PAGE_SIZE = 9;

type SignDocumentsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SignDocumentsSummary = {
  awaitingBroker: number;
  withClient: number;
  ready: number;
  received: number;
};

const statusClass = (status?: string | null) => {
  switch (status) {
    case "AWAITING_BROKER":
      return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/80";
    case "SENT_TO_CLIENT":
      return "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200/80";
    case "CLIENT_SIGNED":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80";
    case "FORWARDED_TO_LENDER":
      return "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/80";
    case "LENDER_SEEN":
      return "bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/80";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80";
  }
};

const statusIconClass = (status?: string | null) => {
  switch (status) {
    case "AWAITING_BROKER":
      return "bg-amber-50 text-amber-600";
    case "SENT_TO_CLIENT":
      return "bg-sky-50 text-sky-600";
    case "CLIENT_SIGNED":
      return "bg-emerald-50 text-emerald-600";
    case "FORWARDED_TO_LENDER":
      return "bg-violet-50 text-violet-600";
    case "LENDER_SEEN":
      return "bg-[#4C78F5]/10 text-[#4C78F5]";
    default:
      return "bg-slate-100 text-slate-500";
  }
};

export default function SignDocumentsPanel({
  mode,
  apiBase,
  getAuthHeaders,
  applicationLenderId,
  submissionId,
  loanApplicationId,
  onUpdated,
  readOnly = false,
}: SignDocumentsPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isClientMode = mode === "client";
  const isBrokerMode = mode === "broker";
  const isLenderMode = mode === "lender";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SignDocumentRow[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lenderViewTab, setLenderViewTab] = useState<"upload" | "documents">(
    "documents",
  );
  const [actionId, setActionId] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [activeTemplateViewDoc, setActiveTemplateViewDoc] =
    useState<SignDocumentRow | null>(null);
  const [activeSignedViewDoc, setActiveSignedViewDoc] =
    useState<SignDocumentRow | null>(null);
  const [viewingFilledDoc, setViewingFilledDoc] =
    useState<SignDocumentRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [libraryTemplates, setLibraryTemplates] = useState<
    Array<{ id: string; name: string; fieldCount?: number; pageCount?: number }>
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [lenderSearchInput, setLenderSearchInput] = useState("");
  const [debouncedLenderSearch, setDebouncedLenderSearch] = useState("");
  const [lenderPage, setLenderPage] = useState(1);
  const [lenderPagination, setLenderPagination] =
    useState<SignDocumentsPagination | null>(null);
  const [lenderSummary, setLenderSummary] = useState<SignDocumentsSummary>({
    awaitingBroker: 0,
    withClient: 0,
    ready: 0,
    received: 0,
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);

  const fetchLibraryTemplates = async () => {
    if (!isLenderMode || readOnly || !applicationLenderId) return;

    try {
      const templatesRes = await fetch(`${apiBase}/lender/sign-form-templates`, {
        headers: getAuthHeaders(),
      });
      const templatesJson = await templatesRes.json().catch(() => null);
      if (templatesRes.ok && templatesJson?.success) {
        setLibraryTemplates(templatesJson.data || []);
      }
    } catch {
      /* optional */
    }
  };

  const fetchLenderDocuments = async (options?: {
    page?: number;
    search?: string;
    isActive?: () => boolean;
  }) => {
    if (!isLenderMode || !applicationLenderId) return;
    const isActive = options?.isActive;

    try {
      if (!isActive || isActive()) setLoading(true);
      const pageNumber = options?.page ?? lenderPage;
      const searchValue = options?.search ?? debouncedLenderSearch;
      const params = new URLSearchParams({
        page: String(pageNumber),
        limit: String(LENDER_SIGN_DOCUMENTS_PAGE_SIZE),
      });
      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      }

      const json = await fetchSignDocumentsCached(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents?${params.toString()}`,
        getAuthHeaders(),
      );
      if (isActive && !isActive()) return;

      setRows(json.data || []);
      setLenderPagination(json.pagination || null);
      setLenderSummary(
        json.summary || {
          awaitingBroker: 0,
          withClient: 0,
          ready: 0,
          received: 0,
        },
      );
    } catch (err: any) {
      if (isActive && !isActive()) return;
      toast.error(err.message || "Failed to load sign documents");
    } finally {
      if (!isActive || isActive()) {
        setLoading(false);
      }
    }
  };

  const fetchRows = async (options?: { page?: number; search?: string }) => {
    if (isLenderMode) {
      await fetchLenderDocuments(options);
      return;
    }

    try {
      setLoading(true);
      let url = "";

      if (isBrokerMode && submissionId) {
        url = `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/sign-documents`;
      } else if (isClientMode && loanApplicationId) {
        url = `${apiBase}/client-portal/applications/${loanApplicationId}/sign-documents`;
      } else {
        return;
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load sign documents");
      }

      setRows(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load sign documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLenderMode) return;

    const timer = window.setTimeout(() => {
      setDebouncedLenderSearch(lenderSearchInput);
      setLenderPage(1);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isLenderMode, lenderSearchInput]);

  useEffect(() => {
    if (!isLenderMode || !applicationLenderId) return;
    if (!readOnly && lenderViewTab !== "documents") return;
    let active = true;
    void fetchLenderDocuments({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [
    isLenderMode,
    applicationLenderId,
    readOnly,
    lenderViewTab,
    debouncedLenderSearch,
    lenderPage,
  ]);

  useEffect(() => {
    if (!isLenderMode || readOnly || !applicationLenderId) return;
    if (lenderViewTab !== "upload") return;
    void fetchLibraryTemplates();
  }, [isLenderMode, readOnly, applicationLenderId, lenderViewTab]);

  useEffect(() => {
    if (isLenderMode) return;
    void fetchRows();
  }, [mode, applicationLenderId, submissionId, loanApplicationId]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!activeTemplateViewDoc && !activeSignedViewDoc && !viewingFilledDoc) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTemplateViewDoc(null);
        setActiveSignedViewDoc(null);
        setViewingFilledDoc(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeTemplateViewDoc, activeSignedViewDoc, viewingFilledDoc]);

  const handleLenderUpload = async () => {
    if (!applicationLenderId || !uploadFile) {
      toast.error("Select a PDF or image file");
      return;
    }

    if (!uploadName.trim()) {
      toast.error("Enter a document name");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("documentName", uploadName.trim());
      formData.append("file", uploadFile);

      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents`,
        {
          method: "POST",
          headers: Object.fromEntries(
            Object.entries(getAuthHeaders()).filter(
              ([key]) => key.toLowerCase() !== "content-type",
            ),
          ),
          body: formData,
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Upload failed");
      }

      if (json.autoPublish?.published) {
        const count = json.autoPublish.fieldCount || 0;
        toast.success(
          `Fillable form ready (${count} field${count === 1 ? "" : "s"} detected)`,
        );
      } else if (json.data?.signMode === "DYNAMIC_FORM") {
        toast.success("Fillable form ready");
      } else {
        toast.success("Signature-only document requested");
      }
      setUploadName("");
      setUploadFile(null);
      setLenderPage(1);
      setLenderViewTab("documents");
      await fetchLenderDocuments({ page: 1, search: debouncedLenderSearch });
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!applicationLenderId || !selectedTemplateId) {
      toast.error("Choose a template");
      return;
    }
    try {
      setApplyingTemplate(true);
      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/from-template`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ templateId: selectedTemplateId }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to apply template");
      }
      toast.success("Sign document created from template");
      setSelectedTemplateId("");
      setLenderPage(1);
      setLenderViewTab("documents");
      await fetchLenderDocuments({ page: 1, search: debouncedLenderSearch });
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply template");
    } finally {
      setApplyingTemplate(false);
    }
  };

  const sendToClient = async (requirementId: string) => {
    if (!submissionId) return;

    try {
      setActionId(requirementId);
      const res = await fetch(
        `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/send-to-client`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send to client");
      }
      toast.success("Sent to client for signature");
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send to client");
    } finally {
      setActionId(null);
    }
  };

  const forwardToLender = async (requirementId: string) => {
    if (!submissionId) return;

    try {
      setActionId(requirementId);
      const res = await fetch(
        `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/forward-to-lender`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to forward to lender");
      }
      toast.success("Signed document forwarded to lender");
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to forward");
    } finally {
      setActionId(null);
    }
  };

  const submitClientSignature = async (requirementId: string) => {
    if (!loanApplicationId) return;

    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please draw your signature first");
      return;
    }

    try {
      setSigningId(requirementId);
      const signature = sigRef.current.getCanvas().toDataURL("image/png");

      const res = await fetch(
        `${apiBase}/client-portal/sign-documents/${requirementId}/sign`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signature,
            loanApplicationId,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Signing failed");
      }

      toast.success("Document signed successfully");
      sigRef.current.clear();
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Signing failed");
    } finally {
      setSigningId(null);
    }
  };

  const openFile = (fileUrl?: string | null) => {
    const resolved = buildApiPublicFileUrl(apiBase, fileUrl);
    if (!resolved) return;
    window.open(resolved, "_blank");
  };

  const downloadRemoteFile = async (
    fileUrl: string,
    filename: string,
    trackId?: string,
  ) => {
    try {
      if (trackId) setDownloadingId(trackId);

      const resolved = buildApiPublicFileUrl(apiBase, fileUrl);
      if (!resolved) throw new Error("File URL missing");

      const res = await fetch(resolved, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error("Failed to download file");
      }

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
    } finally {
      if (trackId) setDownloadingId(null);
    }
  };

  const downloadSignedCopy = async (row: SignDocumentRow) => {
    // Prefer regenerating filled PDF so latest values are included.
    if (row.signMode === "DYNAMIC_FORM") {
      await downloadFilledForm(row);
      return;
    }

    const signed = row.signedUpload;
    if (!signed?.fileUrl) return;

    const ext = getDownloadExtension(
      signed.fileMimeType,
      signed.fileUrl,
      signed.fileName,
    );
    const filename = `${sanitizeDownloadName(row.documentName)}-signed${ext}`;
    await downloadRemoteFile(signed.fileUrl, filename, row.requirementId);
  };

  const downloadFilledForm = async (row: SignDocumentRow) => {
    const trackId = `${row.requirementId}-filled`;
    try {
      setDownloadingId(trackId);

      let url = "";
      if (isLenderMode && applicationLenderId) {
        url = `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${row.requirementId}/download-filled`;
      } else if (isBrokerMode && submissionId) {
        url = `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/sign-documents/${row.requirementId}/download-filled`;
      } else if (isClientMode && loanApplicationId) {
        url = `${apiBase}/client-portal/sign-documents/${row.requirementId}/download-filled?loanApplicationId=${encodeURIComponent(loanApplicationId)}`;
      } else {
        throw new Error("Missing download context");
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        let message = "Failed to download filled form";
        try {
          const json = await res.json();
          if (json?.message) message = json.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const matched = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        matched?.[1] ||
        `${sanitizeDownloadName(row.documentName)}-filled.pdf`;

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
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadTemplate = async (row: SignDocumentRow) => {
    if (row.signMode === "DYNAMIC_FORM") {
      await downloadFilledForm(row);
      return;
    }

    if (!row.templateFileUrl) return;

    const ext = getDownloadExtension(
      row.templateMimeType,
      row.templateFileUrl,
      row.templateFileName,
    );
    const filename = `${sanitizeDownloadName(row.documentName)}-template${ext}`;
    await downloadRemoteFile(
      row.templateFileUrl,
      filename,
      `${row.requirementId}-template`,
    );
  };

  const openSignedCopy = async (row: SignDocumentRow) => {
    if (
      canMarkSignSeen() &&
      isLenderMode &&
      applicationLenderId &&
      row.signStatus === "FORWARDED_TO_LENDER"
    ) {
      try {
        const res = await fetch(
          `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${row.requirementId}/mark-seen`,
          {
            method: "POST",
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
        );
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setRows((prev) =>
            prev.map((item) =>
              item.requirementId === row.requirementId ? json.data : item,
            ),
          );
          setActiveSignedViewDoc(json.data);
          onUpdated?.();
          return;
        }
      } catch {
        // Fall through to open modal without status update
      }
    }

    setActiveSignedViewDoc(row);
  };

  /** Lender: blank template while mapping; after forward show template + filled values. */
  const openTemplateOrFilled = (row: SignDocumentRow) => {
    const canSeeFilled =
      row.signMode === "DYNAMIC_FORM" &&
      (row.signStatus === "FORWARDED_TO_LENDER" ||
        row.signStatus === "LENDER_SEEN" ||
        Boolean(row.signedUpload?.fileUrl) ||
        Boolean(row.formProgress?.all && row.formProgress.all.filled > 0));

    if (isLenderMode && canSeeFilled && applicationLenderId) {
      setViewingFilledDoc(row);
      return;
    }
    setActiveTemplateViewDoc(row);
  };

  const isPdfTemplate = (mime?: string | null, url?: string | null) => {
    const value = (mime || url || "").toLowerCase();
    return value.includes("pdf");
  };

  const isImageTemplate = (mime?: string | null, url?: string | null) => {
    const value = (mime || url || "").toLowerCase();
    return (
      value.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)
    );
  };

  const resolvePreviewMimeType = (
    mime?: string | null,
    url?: string | null,
  ) => {
    if (mime) return mime;
    if (isPdfTemplate(null, url)) return "application/pdf";
    if (isImageTemplate(null, url)) return "image/*";
    return null;
  };

  const renderTemplatePreview = (
    row: SignDocumentRow,
    options?: { fullPage?: boolean },
  ) => {
    const fullPage = Boolean(options?.fullPage);

    if (!row.templateFileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Template preview unavailable
        </div>
      );
    }

    const fileUrl = buildApiPublicFileUrl(apiBase, row.templateFileUrl);
    if (!fileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Template preview unavailable
        </div>
      );
    }

    if (
      !isPdfTemplate(row.templateMimeType, row.templateFileUrl) &&
      !isImageTemplate(row.templateMimeType, row.templateFileUrl)
    ) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <FileText className="h-10 w-10 text-blue-500" />
          <p className="text-sm text-slate-600">
            Preview not supported in browser. Open the template in a new tab.
          </p>
          <button
            type="button"
            onClick={() => openFile(row.templateFileUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Eye size={16} />
            Open template
          </button>
        </div>
      );
    }

    return (
      <EmbeddedFilePreview
        remoteUrl={fileUrl}
        mimeType={resolvePreviewMimeType(
          row.templateMimeType,
          row.templateFileUrl,
        )}
        fileName={row.documentName}
        getAuthHeaders={getAuthHeaders}
        className={
          fullPage
            ? "flex h-full min-h-0 items-stretch overflow-hidden bg-slate-100"
            : "min-h-[min(70vh,720px)] overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        }
        iframeClassName={
          fullPage
            ? "h-full min-h-0 w-full border-0 bg-white"
            : "h-[min(70vh,720px)] w-full rounded-xl border border-slate-200 bg-white"
        }
        imageClassName="max-h-full max-w-full rounded-lg object-contain shadow-sm"
      />
    );
  };

  const renderSignedFilePreview = (row: SignDocumentRow) => {
    const signed = row.signedUpload;
    if (!signed?.fileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Signed copy unavailable
        </div>
      );
    }

    const fileUrl = buildApiPublicFileUrl(apiBase, signed.fileUrl);
    if (!fileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Signed copy preview unavailable
        </div>
      );
    }

    if (
      !isPdfTemplate(signed.fileMimeType, signed.fileUrl) &&
      !isImageTemplate(signed.fileMimeType, signed.fileUrl)
    ) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <FileText className="h-10 w-10 text-emerald-500" />
          <p className="text-sm text-slate-600">
            Preview not supported in browser. Open the signed copy in a new tab.
          </p>
          <button
            type="button"
            onClick={() => openFile(signed.fileUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Download size={16} />
            Open signed copy
          </button>
        </div>
      );
    }

    return (
      <EmbeddedFilePreview
        remoteUrl={fileUrl}
        mimeType={resolvePreviewMimeType(signed.fileMimeType, signed.fileUrl)}
        fileName={`Signed ${row.documentName}`}
        getAuthHeaders={getAuthHeaders}
        className="min-h-[min(70vh,720px)] overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        iframeClassName="h-[min(70vh,720px)] w-full rounded-xl border border-slate-200 bg-white"
        imageClassName="max-h-full max-w-full rounded-lg object-contain shadow-sm"
      />
    );
  };

  const renderTemplateViewModal = () => {
    if (!activeTemplateViewDoc?.templateFileUrl) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-view-modal-title"
        className="fixed inset-0 z-[9999] flex h-dvh w-screen flex-col bg-white"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-brand-50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Template Preview
            </p>
            <h3
              id="template-view-modal-title"
              className="truncate text-lg font-semibold text-slate-900 sm:text-xl"
            >
              {activeTemplateViewDoc.documentName}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => downloadTemplate(activeTemplateViewDoc)}
              disabled={
                downloadingId ===
                `${activeTemplateViewDoc.requirementId}-template`
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {downloadingId ===
              `${activeTemplateViewDoc.requirementId}-template` ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplateViewDoc(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {renderTemplatePreview(activeTemplateViewDoc, { fullPage: true })}
        </div>
      </div>
    );
  };

  const renderSignedCopyModal = () => {
    if (!activeSignedViewDoc?.signedUpload?.fileUrl) return null;

    const signatureData =
      activeSignedViewDoc.signedUpload.clientSignatureData || null;

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
        onClick={() => setActiveSignedViewDoc(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signed-copy-modal-title"
          className="flex max-h-[94vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-brand-50 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Signed Copy
              </p>
              <h3
                id="signed-copy-modal-title"
                className="truncate text-lg font-semibold text-slate-900 sm:text-xl"
              >
                {activeSignedViewDoc.documentName}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Signed document and client signature returned by the broker.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSignedViewDoc(null)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Signed document
                </p>
                {renderSignedFilePreview(activeSignedViewDoc)}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Client signature
                </p>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
                  {signatureData ? (
                    <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-emerald-200 bg-white p-4">
                      <img
                        src={signatureData}
                        alt="Client signature"
                        className="max-h-[160px] max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 text-center">
                      <PenLine className="h-8 w-8 text-emerald-500" />
                      <p className="text-sm text-slate-500">
                        Signature is embedded in the signed document preview.
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Signature submitted by the client for this document.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => setActiveSignedViewDoc(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => openFile(activeSignedViewDoc.signedUpload?.fileUrl)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Eye size={16} />
              Open in new tab
            </button>
            <button
              type="button"
              onClick={() => downloadSignedCopy(activeSignedViewDoc)}
              disabled={downloadingId === activeSignedViewDoc.requirementId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {downloadingId === activeSignedViewDoc.requirementId ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download signed copy
            </button>
          </div>
        </div>
      </div>
    );
  };

  const openMapper = (row: SignDocumentRow) => {
    if (!applicationLenderId) return;
    const qs = new URLSearchParams({
      applicationLenderId,
      requirementId: row.requirementId,
      documentName: row.documentName || "Sign document",
      returnTo: `${location.pathname}${location.search || "?tab=signDocuments"}`,
    });
    navigate(`/sign-form-mapper?${qs.toString()}`, {
      state: location.state,
    });
  };

  const getLenderRowActionMeta = (row: SignDocumentRow) => {
    const canMap =
      !readOnly &&
      row.signStatus === "AWAITING_BROKER" &&
      Boolean(row.templateFileUrl) &&
      Boolean(applicationLenderId);
    const hasTemplate = Boolean(row.templateFileUrl);
    const hasSigned = Boolean(row.signedUpload?.fileUrl);
    const viewFilled =
      row.signMode === "DYNAMIC_FORM" &&
      (row.signStatus === "FORWARDED_TO_LENDER" ||
        row.signStatus === "LENDER_SEEN");
    const hasAnyAction = hasTemplate || canMap || hasSigned;

    return { canMap, hasTemplate, hasSigned, viewFilled, hasAnyAction };
  };

  const openLenderRowMenu = (
    requirementId: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 200;
    const estimatedHeight = 180;
    const gap = 6;

    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - gap);
    }

    setMenuPos({ top, left });
    setOpenMenuId((prev) => (prev === requirementId ? null : requirementId));
  };

  useEffect(() => {
    if (!isLenderMode) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-menu-id]"))
      ) {
        return;
      }
      setOpenMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isLenderMode]);

  useEffect(() => {
    if (!openMenuId) return;

    const reposition = () => {
      const trigger = document.querySelector(
        `[data-menu-id="${openMenuId}"]`,
      ) as HTMLElement | null;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 200;
      const estimatedHeight = menuRef.current?.offsetHeight || 180;
      const gap = 6;
      let left = rect.right - menuWidth;
      let top = rect.bottom + gap;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - gap);
      }
      setMenuPos({ top, left });
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [openMenuId]);

  const renderLenderView = () => {
    const stats = [
      {
        label: "Awaiting broker",
        count: lenderSummary.awaitingBroker,
        wrap: "border-amber-200 bg-[#FFF9E6]",
        tone: "text-[#B45309]",
      },
      {
        label: "With client",
        count: lenderSummary.withClient,
        wrap: "border-sky-200 bg-sky-50",
        tone: "text-brand-500",
      },
      {
        label: "Ready",
        count: lenderSummary.ready,
        wrap: "border-emerald-200 bg-emerald-50",
        tone: "text-emerald-700",
      },
      {
        label: "Received",
        count: lenderSummary.received,
        wrap: "border-violet-200 bg-violet-50",
        tone: "text-violet-700",
      },
    ];
    const totalDocuments = lenderPagination?.total ?? rows.length;
    const hasSearchQuery = Boolean(debouncedLenderSearch.trim());
    const listLoading = loading && rows.length > 0;
    const openMenuRow = openMenuId
      ? rows.find((row) => row.requirementId === openMenuId) || null
      : null;
    const openMenuMeta = openMenuRow
      ? getLenderRowActionMeta(openMenuRow)
      : null;

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                Client e-signature
              </p>
              <h2 className="text-[18px] font-semibold tracking-tight text-text-primary dark:text-white">
                {readOnly ? "Signable Forms" : "Upload Forms"}
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
                {readOnly
                  ? "Review signature requests and signed copies. Upload is disabled for your role."
                  : "Upload a form, optionally map fillable fields, then the broker sends it to the client and returns the completed copy."}
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 xl:w-[440px] xl:shrink-0">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-xl border px-3 py-3 text-center shadow-[0_1px_0_rgba(15,23,42,0.02)] ${stat.wrap}`}
                >
                  <p
                    className={`text-[22px] font-bold leading-none tabular-nums ${stat.tone}`}
                  >
                    {stat.count}
                  </p>
                  <p
                    className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${stat.tone}`}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {readOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Read-only access. You can review templates and signed copies but
            cannot request new signatures.
          </div>
        ) : null}

        {!readOnly ? (
          <div
            role="tablist"
            aria-label="Upload forms view"
            className="inline-flex w-full gap-1 rounded-xl border border-border bg-surface p-1 sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={lenderViewTab === "upload"}
              onClick={() => setLenderViewTab("upload")}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                lenderViewTab === "upload"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-text-secondary hover:bg-white hover:text-text-primary"
              }`}
            >
              <Upload size={16} />
              Upload form
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lenderViewTab === "documents"}
              onClick={() => setLenderViewTab("documents")}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                lenderViewTab === "documents"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-text-secondary hover:bg-white hover:text-text-primary"
              }`}
            >
              <FileText size={16} />
              Documents
              {totalDocuments > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    lenderViewTab === "documents"
                      ? "bg-white/20 text-white"
                      : "bg-white text-text-secondary"
                  }`}
                >
                  {totalDocuments}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        {!readOnly && lenderViewTab === "upload" ? (
          <div className="ds-table-wrap dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-border px-4 py-4 dark:border-slate-800 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-text-primary dark:text-white">
                    Upload signable form
                  </h3>
                  <p className="mt-0.5 text-[12px] text-text-secondary">
                    PDF, PNG, JPEG, or WebP · one form per request
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    Document name
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. SBA 7(a) Borrower Information"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    File
                  </span>
                  <label
                    className={`flex h-10 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 text-sm transition ${
                      uploadFile
                        ? "border-brand-300 bg-brand-50 text-text-primary"
                        : "border-border bg-surface text-text-secondary hover:border-brand-300 hover:bg-brand-50/50"
                    }`}
                  >
                    {isImageTemplate(uploadFile?.type, uploadFile?.name) ? (
                      <FileImage size={16} className="shrink-0 text-brand-500" />
                    ) : (
                      <FileText size={16} className="shrink-0 text-brand-500" />
                    )}
                    <span className="min-w-0 truncate">
                      {uploadFile
                        ? uploadFile.name
                        : "Choose PDF or image file"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] || null)
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-text-secondary">
                  Fillable PDFs are auto-detected and published. You can still
                  map or adjust fields before the broker sends to the client.
                </p>
                <button
                  type="button"
                  onClick={handleLenderUpload}
                  disabled={uploading || !uploadFile || !uploadName.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {uploading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <SendHorizonal size={15} />
                  )}
                  Upload form
                </button>
              </div>

              {libraryTemplates.length > 0 ? (
                <div className="rounded-xl border border-border bg-surface/70 p-4">
                  <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    Or apply a saved template
                  </h4>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="h-10 flex-1 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="">Select template…</option>
                      {libraryTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {typeof template.fieldCount === "number"
                            ? ` (${template.fieldCount} fields)`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleApplyTemplate}
                      disabled={applyingTemplate || !selectedTemplateId}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface disabled:opacity-40"
                    >
                      {applyingTemplate ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <LayoutGrid size={15} />
                      )}
                      Apply template
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {(readOnly || lenderViewTab === "documents") && (
          <div className="ds-table-wrap dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-text-primary dark:text-white">
                  Documents
                </h3>
                <p className="text-[13px] text-text-secondary">
                  {totalDocuments} document{totalDocuments === 1 ? "" : "s"}
                  {hasSearchQuery ? " found" : ""}
                </p>
              </div>

              <div className="relative w-full sm:max-w-sm">
                <Search
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-text-secondary"
                />
                <input
                  type="search"
                  value={lenderSearchInput}
                  onChange={(event) =>
                    setLenderSearchInput(event.target.value)
                  }
                  placeholder="Search documents…"
                  className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                />
                {lenderSearchInput.trim() ? (
                  <button
                    type="button"
                    onClick={() => setLenderSearchInput("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary transition hover:bg-surface hover:text-text-primary"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>

            {loading && rows.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                <p className="mt-3 text-sm text-text-secondary">
                  Loading documents...
                </p>
              </div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <FileText size={20} />
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  {hasSearchQuery
                    ? "No matching documents"
                    : "No sign documents yet"}
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] text-text-secondary">
                  {hasSearchQuery
                    ? "Try a different document name or clear your search."
                    : readOnly
                      ? "No signature documents have been requested for this application yet."
                      : "Upload a form to start the client e-signature workflow."}
                </p>
                {!hasSearchQuery && !readOnly ? (
                  <button
                    type="button"
                    onClick={() => setLenderViewTab("upload")}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
                  >
                    <Upload size={16} />
                    Upload a form
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                {listLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-slate-900/70">
                    <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
                  </div>
                ) : null}

                <table className="ds-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Form</th>
                      <th>Workflow</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const showFileName =
                        row.templateFileName &&
                        row.templateFileName.trim() !==
                          row.documentName.trim();

                      return (
                        <tr key={row.requirementId}>
                          <td>
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${statusIconClass(row.signStatus)}`}
                              >
                                {isImageTemplate(
                                  row.templateMimeType,
                                  row.templateFileUrl,
                                ) ? (
                                  <FileImage size={16} />
                                ) : (
                                  <FileText size={16} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="ds-table-title"
                                  title={row.documentName}
                                >
                                  {row.documentName}
                                </p>
                                {showFileName ? (
                                  <p
                                    className="ds-table-meta"
                                    title={row.templateFileName || undefined}
                                  >
                                    {row.templateFileName}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClass(row.signStatus)}`}
                            >
                              {row.signStatusLabel || row.signStatus || "—"}
                            </span>
                          </td>

                          <td>
                            {row.signMode === "DYNAMIC_FORM" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 size={12} />
                                Fillable
                                {typeof row.fieldCount === "number"
                                  ? ` · ${row.fieldCount}`
                                  : ""}
                              </span>
                            ) : (
                              <span className="ds-table-muted">Template</span>
                            )}
                          </td>

                          <td>
                            <p
                              className="max-w-[240px] text-[12px] leading-relaxed text-text-secondary"
                              title={row.workflowHint || undefined}
                            >
                              {row.workflowHint || "In progress"}
                            </p>
                          </td>

                          <td className="text-right">
                            {(() => {
                              const meta = getLenderRowActionMeta(row);
                              if (!meta.hasAnyAction) {
                                return (
                                  <span className="ds-table-empty">—</span>
                                );
                              }

                              return (
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    data-menu-id={row.requirementId}
                                    onClick={(event) =>
                                      openLenderRowMenu(
                                        row.requirementId,
                                        event,
                                      )
                                    }
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                      openMenuId === row.requirementId
                                        ? "border-brand-300 bg-brand-50 text-brand-500"
                                        : "border-border bg-white text-text-secondary hover:border-brand-200 hover:bg-surface hover:text-text-primary"
                                    }`}
                                    aria-label="Open actions menu"
                                    title="More actions"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {lenderPagination &&
            lenderPagination.totalPages > 0 &&
            rows.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[13px] text-text-secondary">
                  Page {lenderPagination.page} of {lenderPagination.totalPages}
                  {lenderPagination.total != null ? (
                    <span>
                      {" "}
                      ({lenderPagination.total} document
                      {lenderPagination.total === 1 ? "" : "s"}
                      {hasSearchQuery ? " found" : ""})
                    </span>
                  ) : null}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={lenderPage === 1 || loading}
                    onClick={() => setLenderPage((current) => current - 1)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={
                      lenderPage === lenderPagination.totalPages || loading
                    }
                    onClick={() => setLenderPage((current) => current + 1)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {renderTemplateViewModal()}
        {renderSignedCopyModal()}
        {viewingFilledDoc && applicationLenderId && (
          <SignFormFilledViewer
            open={Boolean(viewingFilledDoc)}
            onClose={() => setViewingFilledDoc(null)}
            apiBase={apiBase}
            getAuthHeaders={getAuthHeaders}
            applicationLenderId={applicationLenderId}
            requirementId={viewingFilledDoc.requirementId}
            documentName={viewingFilledDoc.documentName}
          />
        )}

        {openMenuRow && openMenuMeta
          ? createPortal(
              <div
                ref={menuRef}
                style={{ top: menuPos.top, left: menuPos.left }}
                className="fixed z-[9999] w-[200px] overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                {openMenuMeta.hasTemplate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      openTemplateOrFilled(openMenuRow);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-text-primary transition hover:bg-surface"
                  >
                    <Eye size={15} className="text-brand-500" />
                    {openMenuMeta.viewFilled ? "View form" : "View template"}
                  </button>
                ) : null}

                {openMenuMeta.canMap ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      openMapper(openMenuRow);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-text-primary transition hover:bg-surface"
                  >
                    <LayoutGrid size={15} className="text-brand-500" />
                    {openMenuRow.signMode === "DYNAMIC_FORM"
                      ? "Edit fields"
                      : "Map fields"}
                    {typeof openMenuRow.fieldCount === "number" &&
                    openMenuRow.fieldCount > 0
                      ? ` · ${openMenuRow.fieldCount}`
                      : ""}
                  </button>
                ) : null}

                {openMenuMeta.hasSigned ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        void openSignedCopy(openMenuRow);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-text-primary transition hover:bg-surface"
                    >
                      <Eye size={15} className="text-brand-500" />
                      View signed
                    </button>
                    <button
                      type="button"
                      disabled={downloadingId === openMenuRow.requirementId}
                      onClick={() => {
                        setOpenMenuId(null);
                        void downloadSignedCopy(openMenuRow);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-text-primary transition hover:bg-surface disabled:opacity-50"
                    >
                      {downloadingId === openMenuRow.requirementId ? (
                        <Loader2
                          size={15}
                          className="animate-spin text-brand-500"
                        />
                      ) : (
                        <Download size={15} className="text-brand-500" />
                      )}
                      Download
                    </button>
                  </>
                ) : null}
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  };

  if (loading && !isLenderMode) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
          <p className="mt-3 text-sm text-slate-500">Loading sign documents...</p>
        </div>
      </div>
    );
  }

  if (isLenderMode) {
    return renderLenderView();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          Sign Documents
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          PDF or image forms that require client e-signature before forwarding to
          the lender.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No sign documents yet.
        </div>
      ) : (
        <div className="ds-table-wrap dark:border-slate-700">
          <table className="ds-table min-w-full">
            <thead>
              <tr>
                <th>Document</th>
                {!isClientMode && <th>Lender</th>}
                <th>Status</th>
                <th>Files</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.requirementId}>
                  <td>
                    <span className="ds-table-title">{row.documentName}</span>
                  </td>
                  {!isClientMode && (
                    <td className="ds-table-muted">{row.lenderName || "—"}</td>
                  )}
                  <td>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(row.signStatus)}`}
                    >
                      {row.signStatusLabel || row.signStatus || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {row.templateFileUrl && (
                        <button
                          type="button"
                          onClick={() => openFile(row.templateFileUrl)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs"
                        >
                          <Eye size={14} /> Template
                        </button>
                      )}
                      {row.signedUpload?.fileUrl && (
                        <button
                          type="button"
                          onClick={() => void openSignedCopy(row)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-xs text-emerald-800"
                        >
                          <Eye size={14} /> Signed
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isBrokerMode && row.signStatus === "AWAITING_BROKER" && (
                      <button
                        type="button"
                        disabled={actionId === row.requirementId}
                        onClick={() => sendToClient(row.requirementId)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {actionId === row.requirementId ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <SendHorizonal size={14} />
                        )}
                        Send to client
                      </button>
                    )}
                    {isBrokerMode && row.signStatus === "CLIENT_SIGNED" && (
                      <button
                        type="button"
                        disabled={actionId === row.requirementId}
                        onClick={() => forwardToLender(row.requirementId)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {actionId === row.requirementId ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <SendHorizonal size={14} />
                        )}
                        Forward to lender
                      </button>
                    )}
                    {isClientMode &&
                      row.signStatus === "SENT_TO_CLIENT" &&
                      signingId === row.requirementId && (
                        <div className="mt-2 rounded-xl border border-slate-200 p-3 text-left dark:border-slate-700">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <PenLine size={14} /> Draw your signature
                          </div>
                          <div className="rounded-lg border border-slate-300 bg-white">
                            <SigCanvas
                              ref={sigRef}
                              penColor="black"
                              canvasProps={{
                                width: 320,
                                height: 120,
                                className: "w-full",
                              }}
                            />
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => sigRef.current?.clear()}
                              className="rounded-lg border px-3 py-1.5 text-xs"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              disabled={signingId === row.requirementId}
                              onClick={() =>
                                submitClientSignature(row.requirementId)
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Submit signature
                            </button>
                          </div>
                        </div>
                      )}
                    {isClientMode &&
                      row.signStatus === "SENT_TO_CLIENT" &&
                      signingId !== row.requirementId && (
                        <button
                          type="button"
                          onClick={() => setSigningId(row.requirementId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <PenLine size={14} /> Sign
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isClientMode && signingId && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          Review the template using the eye button, then sign the document below.
        </div>
      )}
    </div>
  );
}
