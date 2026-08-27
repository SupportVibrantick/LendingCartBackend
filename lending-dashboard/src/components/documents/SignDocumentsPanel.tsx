import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileImage,
  FileText,
  LayoutGrid,
  Loader2,
  PenLine,
  SendHorizonal,
  Upload,
  X,
} from "lucide-react";
import { canMarkSignSeen } from "../../lib/lenderPermissions";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import SignFormFilledViewer from "./SignFormFilledViewer";
import EmbeddedFilePreview from "./EmbeddedFilePreview";

const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

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

const statusClass = (status?: string | null) => {
  switch (status) {
    case "AWAITING_BROKER":
      return "bg-amber-100 text-amber-800";
    case "SENT_TO_CLIENT":
      return "bg-sky-100 text-sky-800";
    case "CLIENT_SIGNED":
      return "bg-emerald-100 text-emerald-800";
    case "FORWARDED_TO_LENDER":
      return "bg-violet-100 text-violet-800";
    case "LENDER_SEEN":
      return "bg-brand-100 text-brand-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

const statusIconClass = (status?: string | null) => {
  switch (status) {
    case "AWAITING_BROKER":
      return "bg-amber-50 text-amber-600 border-amber-100";
    case "SENT_TO_CLIENT":
      return "bg-sky-50 text-sky-600 border-sky-100";
    case "CLIENT_SIGNED":
      return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "FORWARDED_TO_LENDER":
      return "bg-violet-50 text-violet-600 border-violet-100";
    case "LENDER_SEEN":
      return "bg-brand-50 text-brand-600 border-brand-100";
    default:
      return "bg-slate-50 text-slate-500 border-slate-200";
  }
};

const statusFooterClass = (status?: string | null) => {
  switch (status) {
    case "AWAITING_BROKER":
      return "bg-amber-50 text-amber-800";
    case "SENT_TO_CLIENT":
      return "bg-sky-50 text-sky-800";
    case "CLIENT_SIGNED":
      return "bg-emerald-50 text-emerald-800";
    case "FORWARDED_TO_LENDER":
      return "bg-violet-50 text-violet-800";
    case "LENDER_SEEN":
      return "bg-brand-50 text-brand-800";
    default:
      return "bg-slate-50 text-slate-600";
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
  const sigRef = useRef<SignatureCanvas | null>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      let url = "";

      if (isLenderMode && applicationLenderId) {
        url = `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents`;
      } else if (isBrokerMode && submissionId) {
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

      if (isLenderMode && !readOnly) {
        const templatesRes = await fetch(
          `${apiBase}/lender/sign-form-templates`,
          { headers: getAuthHeaders() },
        );
        const templatesJson = await templatesRes.json().catch(() => null);
        if (templatesRes.ok && templatesJson?.success) {
          setLibraryTemplates(templatesJson.data || []);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load sign documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [mode, applicationLenderId, submissionId, loanApplicationId]);

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
      await fetchRows();
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
      await fetchRows();
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

  const renderDocumentTitle = (row: SignDocumentRow) => {
    const showFileName =
      row.templateFileName &&
      row.templateFileName.trim() !== row.documentName.trim();

    return (
      <div className="min-w-0">
        <h3
          className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900"
          title={row.documentName}
        >
          {row.documentName}
        </h3>
        {showFileName && (
          <p
            className="mt-1 truncate text-xs text-slate-500"
            title={row.templateFileName || undefined}
          >
            {row.templateFileName}
          </p>
        )}
      </div>
    );
  };

  const inlineActionClass =
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition min-w-0 whitespace-nowrap";

  const renderInlineDocumentActions = (row: SignDocumentRow) => {
    const hasTemplate = Boolean(row.templateFileUrl);
    const hasSigned = Boolean(row.signedUpload?.fileUrl);

    if (!hasTemplate && !hasSigned) return null;

    return (
      <div className="flex items-stretch gap-2">
        {hasTemplate && (
          <button
            type="button"
            onClick={() => openTemplateOrFilled(row)}
            className={`${inlineActionClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            title={
              row.signMode === "DYNAMIC_FORM" &&
              (row.signStatus === "FORWARDED_TO_LENDER" ||
                row.signStatus === "LENDER_SEEN")
                ? "View template with filled values"
                : "View template"
            }
          >
            <Eye size={14} className="shrink-0 text-sky-600" />
            {row.signMode === "DYNAMIC_FORM" &&
            (row.signStatus === "FORWARDED_TO_LENDER" ||
              row.signStatus === "LENDER_SEEN")
              ? "View form"
              : "Template"}
          </button>
        )}
        {hasSigned && (
          <button
            type="button"
            onClick={() => openSignedCopy(row)}
            className={`${inlineActionClass} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
            title="View signed copy"
          >
            <CheckCircle2 size={14} className="shrink-0" />
            Signed
          </button>
        )}
        {hasSigned && (
          <button
            type="button"
            onClick={() => downloadSignedCopy(row)}
            disabled={downloadingId === row.requirementId}
            className={`${inlineActionClass} border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-60`}
            title="Download signed copy"
          >
            {downloadingId === row.requirementId ? (
              <Loader2 size={14} className="shrink-0 animate-spin" />
            ) : (
              <Download size={14} className="shrink-0" />
            )}
            Download
          </button>
        )}
      </div>
    );
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

  const renderTemplatePreview = (row: SignDocumentRow) => {
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
        className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]"
        iframeClassName="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
        imageClassName="max-h-full max-w-full rounded-lg object-contain shadow-sm"
        viewOnly
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
        className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]"
        iframeClassName="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
        imageClassName="max-h-full max-w-full rounded-lg object-contain shadow-sm"
        viewOnly
      />
    );
  };

  const renderTemplateViewModal = () => {
    if (!activeTemplateViewDoc?.templateFileUrl) return null;

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
        onClick={() => setActiveTemplateViewDoc(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-view-modal-title"
          className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-brand-50 px-5 py-4 sm:px-6">
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
            <button
              type="button"
              onClick={() => setActiveTemplateViewDoc(null)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {renderTemplatePreview(activeTemplateViewDoc)}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setActiveTemplateViewDoc(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => downloadTemplate(activeTemplateViewDoc)}
              disabled={downloadingId === `${activeTemplateViewDoc.requirementId}-template`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {downloadingId === `${activeTemplateViewDoc.requirementId}-template` ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download
            </button>
          </div>
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
          className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
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

  const renderLenderStatusFooter = (row: SignDocumentRow) => {
    const hint =
      row.workflowHint ||
      (row.signStatus === "FORWARDED_TO_LENDER"
        ? "Received signed copy"
        : row.signStatus === "LENDER_SEEN"
          ? "Seen by lender"
          : "In progress");

    return (
      <div
        className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs leading-relaxed ${statusFooterClass(row.signStatus)}`}
      >
        <Clock size={13} className="mt-0.5 shrink-0 opacity-80" />
        <span>{hint}</span>
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

  const renderLenderView = () => {
    const awaitingBroker = rows.filter(
      (row) =>
        row.lenderBucket !== "received" && row.signStatus === "AWAITING_BROKER",
    );
    const withClient = rows.filter((row) => row.signStatus === "SENT_TO_CLIENT");
    const readyToForward = rows.filter(
      (row) => row.signStatus === "CLIENT_SIGNED",
    );
    const received = rows.filter((row) => row.lenderBucket === "received");

    const stats = [
      {
        label: "Awaiting broker",
        count: awaitingBroker.length,
        wrap: "bg-amber-50 ring-amber-100",
        num: "text-amber-700",
      },
      {
        label: "With client",
        count: withClient.length,
        wrap: "bg-sky-50 ring-sky-100",
        num: "text-sky-700",
      },
      {
        label: "Ready",
        count: readyToForward.length,
        wrap: "bg-emerald-50 ring-emerald-100",
        num: "text-emerald-700",
      },
      {
        label: "Received",
        count: received.length,
        wrap: "bg-violet-50 ring-violet-100",
        num: "text-violet-700",
      },
    ];

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 shadow-sm">
                <PenLine size={12} />
                Client e-signature
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                Signable forms & documents
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                {readOnly
                  ? "Review signature requests and signed copies. Upload is disabled for your role."
                  : "Upload a form, optionally map fillable fields, then the broker sends it to the client and returns the completed copy."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`min-w-[6.25rem] rounded-xl px-3 py-2 ring-1 ring-inset ${stat.wrap}`}
                >
                  <p className={`text-lg font-semibold tabular-nums ${stat.num}`}>
                    {stat.count}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Read-only access. You can review templates and signed copies but
            cannot request new signatures.
          </div>
        )}

        {!readOnly && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50/80 to-emerald-50/50 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
                  <Upload size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Request a signature
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    PDF, PNG, JPEG, or WebP · one form per request
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    Document name
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. SBA 7(a) Borrower Information"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    File
                  </span>
                  <label
                    className={`flex min-h-[42px] cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm transition ${
                      uploadFile
                        ? "border-brand-300 bg-brand-50 text-brand-900"
                        : "border-slate-300 bg-slate-50 text-slate-500 hover:border-brand-300 hover:bg-brand-50/40"
                    }`}
                  >
                    {isImageTemplate(uploadFile?.type, uploadFile?.name) ? (
                      <FileImage size={16} className="shrink-0 text-brand-600" />
                    ) : (
                      <FileText size={16} className="shrink-0 text-brand-600" />
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

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Fillable PDFs are auto-detected and published. You can still
                  map or adjust fields before the broker sends to the client.
                </p>
                <button
                  type="button"
                  onClick={handleLenderUpload}
                  disabled={uploading || !uploadFile || !uploadName.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <SendHorizonal size={15} />
                  )}
                  Upload form
                </button>
              </div>

              {libraryTemplates.length > 0 && (
                <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-800">
                    Or apply a saved template
                  </h4>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
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
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
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
              )}
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Documents
              {rows.length > 0 ? (
                <span className="ml-1.5 font-normal text-slate-400">
                  ({rows.length})
                </span>
              ) : null}
            </h3>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/30 px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                <FileText size={20} />
              </div>
              <p className="text-sm font-medium text-slate-800">
                No sign documents yet
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500">
                {readOnly
                  ? "No signature documents have been requested for this application yet."
                  : "Upload a form above to start the client e-signature workflow."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => {
                const canMap =
                  !readOnly &&
                  row.signStatus === "AWAITING_BROKER" &&
                  Boolean(row.templateFileUrl) &&
                  Boolean(applicationLenderId);
                const isImage = isImageTemplate(
                  row.templateMimeType,
                  row.templateFileUrl,
                );

                return (
                  <article
                    key={row.requirementId}
                    className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3 border-b border-slate-100 p-4">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${statusIconClass(row.signStatus)}`}
                      >
                        {isImage ? (
                          <FileImage size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {renderDocumentTitle(row)}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(row.signStatus)}`}
                      >
                        {row.signStatusLabel || row.signStatus || "-"}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      {canMap ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => openTemplateOrFilled(row)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            title="View template"
                          >
                            <Eye size={14} className="shrink-0 text-sky-600" />
                            Template
                          </button>
                          <button
                            type="button"
                            onClick={() => openMapper(row)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
                          >
                            <LayoutGrid size={14} className="shrink-0" />
                            <span className="truncate">
                              {row.signMode === "DYNAMIC_FORM"
                                ? "Edit fillable fields"
                                : "Map fillable fields"}
                              {typeof row.fieldCount === "number" &&
                              row.fieldCount > 0
                                ? ` · ${row.fieldCount}`
                                : ""}
                            </span>
                          </button>
                        </div>
                      ) : (
                        renderInlineDocumentActions(row)
                      )}

                      {row.signMode === "DYNAMIC_FORM" && !canMap && (
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800">
                          <CheckCircle2 size={13} />
                          Fillable form published
                          {typeof row.fieldCount === "number"
                            ? ` · ${row.fieldCount} fields`
                            : ""}
                        </div>
                      )}

                      <div className="mt-auto pt-1">
                        {renderLenderStatusFooter(row)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

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
      </div>
    );
  };

  if (loading) {
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Document</th>
                {!isClientMode && <th className="px-4 py-3">Lender</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.requirementId}>
                  <td className="px-4 py-3 font-medium">{row.documentName}</td>
                  {!isClientMode && (
                    <td className="px-4 py-3">{row.lenderName || "-"}</td>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.signStatus)}`}
                    >
                      {row.signStatusLabel || row.signStatus || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
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
                          onClick={() => openFile(row.signedUpload?.fileUrl)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-xs text-emerald-800"
                        >
                          <Download size={14} /> Signed
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
