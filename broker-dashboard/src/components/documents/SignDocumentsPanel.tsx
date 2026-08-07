import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import {
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileImage,
  FileText,
  Loader2,
  PenLine,
  SendHorizonal,
  Upload,
  X,
} from "lucide-react";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
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
  templateFileName?: string | null;
  templateFileUrl?: string | null;
  templateMimeType?: string | null;
  lenderName?: string | null;
  lenderOrgId?: string | null;
  requestApplicationLenderId?: string | null;
  loanProductName?: string | null;
  loanProductCode?: string | null;
  requestedAt?: string | null;
  signedUpload?: {
    uploadId: string;
    fileName: string;
    fileUrl: string;
    fileMimeType?: string | null;
    clientSignatureData?: string | null;
  } | null;
  loiVersionNumber?: number;
  loiVersionLabel?: string;
  isBrokerLoi?: boolean;
};

type PreviousSignedLoiVersion = {
  versionNumber: number;
  label: string;
  signedPdfUrl: string;
  clientSignedAt?: string | null;
  status: string;
};

type SignDocumentsPanelProps = {
  mode: "lender" | "broker" | "client";
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  applicationLenderId?: string;
  submissionId?: string;
  loanApplicationId?: string;
  apiRolePrefix?: "broker" | "loanofficer";
  onUpdated?: () => void;
  clientName?: string;
  applicationNumber?: string;
};

const statusClass = (status?: string | null) => {
  switch (status) {
    case "AWAITING_BROKER":
      return "bg-amber-100 text-amber-800";
    case "SENT_TO_CLIENT":
      return "bg-blue-100 text-blue-800";
    case "CLIENT_SIGNED":
      return "bg-emerald-100 text-emerald-800";
    case "FORWARDED_TO_LENDER":
      return "bg-violet-100 text-violet-800";
    case "LENDER_SEEN":
      return "bg-teal-100 text-teal-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export default function SignDocumentsPanel({
  mode,
  apiBase,
  getAuthHeaders,
  applicationLenderId,
  submissionId,
  loanApplicationId,
  apiRolePrefix = "broker",
  onUpdated,
  clientName,
  applicationNumber,
}: SignDocumentsPanelProps) {
  const isClientMode = mode === "client";
  const isBrokerMode = mode === "broker";
  const isLenderMode = mode === "lender";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SignDocumentRow[]>([]);
  const [previousSignedLoiVersions, setPreviousSignedLoiVersions] = useState<
    PreviousSignedLoiVersion[]
  >([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeSigningDoc, setActiveSigningDoc] =
    useState<SignDocumentRow | null>(null);
  const [activeSignedViewDoc, setActiveSignedViewDoc] =
    useState<SignDocumentRow | null>(null);
  const [activeTemplateViewDoc, setActiveTemplateViewDoc] =
    useState<SignDocumentRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedLenderKey, setSelectedLenderKey] = useState<string>("all");
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      let url = "";

      if (isLenderMode && applicationLenderId) {
        url = `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents`;
      } else if (isBrokerMode && submissionId) {
        url = `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents`;
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
      setPreviousSignedLoiVersions(
        isClientMode ? json.previousSignedLoiVersions || [] : [],
      );
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
    if (!activeSigningDoc && !activeSignedViewDoc && !activeTemplateViewDoc) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingSignature) {
        setActiveSigningDoc(null);
        setActiveSignedViewDoc(null);
        setActiveTemplateViewDoc(null);
        sigRef.current?.clear();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    activeSigningDoc,
    activeSignedViewDoc,
    activeTemplateViewDoc,
    isSubmittingSignature,
  ]);

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
      formData.append("file", uploadFile);
      formData.append("documentName", uploadName.trim());

      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents`,
        {
          method: "POST",
          headers: Object.fromEntries(
            Object.entries(getAuthHeaders() as Record<string, string>).filter(
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

      toast.success("Sign document requested");
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

  const sendToClient = async (requirementId: string) => {
    if (!submissionId) return;

    try {
      setActionId(requirementId);
      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/send-to-client`,
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
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/forward-to-lender`,
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

  const submitClientSignature = async () => {
    if (!loanApplicationId || !activeSigningDoc) return;

    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please draw your signature first");
      return;
    }

    try {
      setIsSubmittingSignature(true);
      const signature = sigRef.current.getCanvas().toDataURL("image/png");

      const res = await fetch(
        `${apiBase}/client-portal/sign-documents/${activeSigningDoc.requirementId}/sign`,
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
      setActiveSigningDoc(null);
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Signing failed");
    } finally {
      setIsSubmittingSignature(false);
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

  const downloadTemplate = async (row: SignDocumentRow) => {
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

  const renderDocumentTitle = (row: SignDocumentRow) => {
    const showFileName =
      row.templateFileName &&
      row.templateFileName.trim() !== row.documentName.trim();

    return (
      <div className="min-w-0">
        <h3
          className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white"
          title={row.documentName}
        >
          {row.documentName}
        </h3>
        {showFileName && (
          <p
            className="mt-1 truncate text-xs text-slate-500"
            title={row.templateFileName || undefined}
          >
            File: {row.templateFileName}
          </p>
        )}
      </div>
    );
  };

  const getLenderGroupKey = (row: SignDocumentRow) =>
    row.requestApplicationLenderId ||
    row.lenderOrgId ||
    row.lenderName ||
    "unknown";

  const sortSignDocumentRows = (items: SignDocumentRow[]) =>
    [...items].sort((left, right) => {
      const statusRank = (row: SignDocumentRow) =>
        row.signStatus === "AWAITING_BROKER" ? 0 : 1;
      const statusDiff = statusRank(left) - statusRank(right);
      if (statusDiff !== 0) return statusDiff;

      const leftTime = left.requestedAt ? Date.parse(left.requestedAt) : 0;
      const rightTime = right.requestedAt ? Date.parse(right.requestedAt) : 0;
      return rightTime - leftTime;
    });

  const lenderGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        lenderName: string;
        loanProductName?: string | null;
        rows: SignDocumentRow[];
      }
    >();

    for (const row of rows) {
      const key = getLenderGroupKey(row);
      const existing = map.get(key);

      if (existing) {
        existing.rows.push(row);
        continue;
      }

      map.set(key, {
        key,
        lenderName: row.lenderName || "Unknown lender",
        loanProductName: row.loanProductName,
        rows: sortSignDocumentRows([row]),
      });
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        rows: sortSignDocumentRows(group.rows),
      }))
      .sort((left, right) => left.lenderName.localeCompare(right.lenderName));
  }, [rows]);

  const visibleBrokerRows = useMemo(() => {
    const filtered =
      selectedLenderKey === "all"
        ? rows
        : rows.filter((row) => getLenderGroupKey(row) === selectedLenderKey);

    return sortSignDocumentRows(filtered);
  }, [rows, selectedLenderKey]);

  const renderLenderAttribution = (
    row: SignDocumentRow,
    options: { prominent?: boolean } = {},
  ) => {
    const lenderLabel = row.lenderName || "Unknown lender";
    const productLabel = row.loanProductName || row.loanProductCode;

    if (options.prominent) {
      return (
        <div className="mb-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200">
          <Building2 size={14} className="shrink-0" />
          <span className="truncate">Requested by {lenderLabel}</span>
          {productLabel ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-slate-900/60 dark:text-violet-300">
              {productLabel}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Building2 size={12} className="shrink-0" />
        <span>Requested by {lenderLabel}</span>
        {productLabel ? <span>· {productLabel}</span> : null}
      </p>
    );
  };

  const renderBrokerDocumentCard = (row: SignDocumentRow) => {
    const isActionLoading = actionId === row.requirementId;
    const showProminentLender = lenderGroups.length > 1;

    return (
      <div
        key={row.requirementId}
        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
      >
        {showProminentLender
          ? renderLenderAttribution(row, { prominent: true })
          : row.lenderName
            ? renderLenderAttribution(row)
            : null}

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                row.signStatus === "FORWARDED_TO_LENDER"
                  ? "bg-violet-100 text-violet-700"
                  : row.signStatus === "LENDER_SEEN"
                    ? "bg-teal-100 text-teal-700"
                    : row.signStatus === "CLIENT_SIGNED"
                      ? "bg-emerald-100 text-emerald-700"
                      : row.signStatus === "SENT_TO_CLIENT"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
              }`}
            >
              {isImageTemplate(row.templateMimeType, row.templateFileUrl) ? (
                <FileImage size={20} />
              ) : (
                <FileText size={20} />
              )}
            </div>
            <div className="min-w-0">{renderDocumentTitle(row)}</div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(row.signStatus)}`}
          >
            {row.signStatusLabel || row.signStatus || "-"}
          </span>
        </div>

        {renderInlineDocumentActions(row)}

        <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
          {row.signStatus === "AWAITING_BROKER" && (
            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => sendToClient(row.requirementId)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
            >
              {isActionLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <SendHorizonal size={16} />
              )}
              Send to client
            </button>
          )}

          {row.signStatus === "SENT_TO_CLIENT" && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <Clock size={16} className="shrink-0" />
              Waiting for client signature
            </div>
          )}

          {row.signStatus === "CLIENT_SIGNED" && (
            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => forwardToLender(row.requirementId)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
            >
              {isActionLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <SendHorizonal size={16} />
              )}
              Forward to {row.lenderName || "lender"}
            </button>
          )}

          {row.signStatus === "FORWARDED_TO_LENDER" && (
            <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              <CheckCircle2 size={16} className="shrink-0" />
              Forwarded to {row.lenderName || "lender"}
            </div>
          )}

          {row.signStatus === "LENDER_SEEN" && (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              <CheckCircle2 size={16} className="shrink-0" />
              Seen by {row.lenderName || "lender"}
            </div>
          )}
        </div>
      </div>
    );
  };

  const inlineActionClass =
    "inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition min-w-0 whitespace-nowrap";

  const renderInlineDocumentActions = (row: SignDocumentRow) => {
    const hasTemplate = Boolean(row.templateFileUrl);
    const hasSigned = Boolean(row.signedUpload?.fileUrl);

    if (!hasTemplate && !hasSigned) return null;

    return (
      <div className="mb-4 flex items-stretch gap-1.5">
        {hasTemplate && (
          <button
            type="button"
            onClick={() => setActiveTemplateViewDoc(row)}
            className={`${inlineActionClass} border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}
            title="View template"
          >
            <Eye size={13} className="shrink-0" />
            Template
          </button>
        )}
        {hasSigned && (
          <button
            type="button"
            onClick={() => setActiveSignedViewDoc(row)}
            className={`${inlineActionClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300`}
            title="View signed copy"
          >
            <Eye size={13} className="shrink-0" />
            Signed
          </button>
        )}
        {hasSigned && (
          <button
            type="button"
            onClick={() => downloadSignedCopy(row)}
            disabled={downloadingId === row.requirementId}
            className={`${inlineActionClass} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300`}
            title="Download signed copy"
          >
            {downloadingId === row.requirementId ? (
              <Loader2 size={13} className="shrink-0 animate-spin" />
            ) : (
              <Download size={13} className="shrink-0" />
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
      /\.(png|jpe?g|jfif|pjpeg|pjp|webp|gif)(\?|$)/i.test(value)
    );
  };

  const resolvePreviewMimeType = (
    mime?: string | null,
    url?: string | null,
  ) => {
    if (isPdfTemplate(mime, url)) return "application/pdf";
    if (isImageTemplate(mime, url)) {
      if (mime?.startsWith("image/")) return mime;
      return "image/*";
    }
    return mime || undefined;
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
    if (!fileUrl) return null;

    const previewMimeType = resolvePreviewMimeType(
      row.templateMimeType,
      row.templateFileUrl,
    );

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
        mimeType={previewMimeType}
        fileName={row.documentName}
        getAuthHeaders={getAuthHeaders}
        className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]"
        iframeClassName="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
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
          Signed copy unavailable
        </div>
      );
    }

    const previewMimeType = resolvePreviewMimeType(
      signed.fileMimeType,
      signed.fileUrl,
    );

    if (
      !isPdfTemplate(signed.fileMimeType, signed.fileUrl) &&
      !isImageTemplate(signed.fileMimeType, signed.fileUrl)
    ) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <FileText className="h-10 w-10 text-blue-500" />
          <p className="text-sm text-slate-600">
            Preview not supported in browser. Open the signed copy in a new tab.
          </p>
          <button
            type="button"
            onClick={() => openFile(signed.fileUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Eye size={16} />
            Open signed copy
          </button>
        </div>
      );
    }

    return (
      <EmbeddedFilePreview
        remoteUrl={fileUrl}
        mimeType={previewMimeType}
        fileName={`Signed ${row.documentName}`}
        getAuthHeaders={getAuthHeaders}
        className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]"
        iframeClassName="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
        imageClassName="max-h-full max-w-full rounded-lg object-contain shadow-sm"
      />
    );
  };

  const closeSignedViewModal = () => {
    setActiveSignedViewDoc(null);
  };

  const renderSignedCopyModal = () => {
    if (!activeSignedViewDoc?.signedUpload?.fileUrl) return null;

    const signatureData =
      activeSignedViewDoc.signedUpload.clientSignatureData || null;

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
        onClick={closeSignedViewModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signed-copy-modal-title"
          className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 sm:px-6">
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
                Your signed document and signature are shown below.
              </p>
            </div>
            <button
              type="button"
              onClick={closeSignedViewModal}
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
                  Your signature
                </p>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
                  {signatureData ? (
                    <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-emerald-200 bg-white p-4">
                      <img
                        src={signatureData}
                        alt="Your signature"
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
                    This is the signature you submitted with this document.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={closeSignedViewModal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() =>
                openFile(activeSignedViewDoc.signedUpload?.fileUrl)
              }
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

  const closeSigningModal = () => {
    if (isSubmittingSignature) return;
    setActiveSigningDoc(null);
    sigRef.current?.clear();
  };

  const renderSigningModal = () => {
    if (!activeSigningDoc) return null;

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
        onClick={closeSigningModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-document-modal-title"
          className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Review & Sign
              </p>
              <h3
                id="sign-document-modal-title"
                className="truncate text-lg font-semibold text-slate-900 sm:text-xl"
              >
                {activeSigningDoc.documentName}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Read the document, add your signature, then submit.
              </p>
            </div>
            <button
              type="button"
              onClick={closeSigningModal}
              disabled={isSubmittingSignature}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Document preview
                </p>
                {renderTemplatePreview(activeSigningDoc)}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Your signature
                </p>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
                  <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
                    <SigCanvas
                      ref={sigRef}
                      penColor="#111827"
                      canvasProps={{
                        width: 640,
                        height: 180,
                        className: "w-full touch-none",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Use your mouse or finger to sign inside the box above.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => sigRef.current?.clear()}
              disabled={isSubmittingSignature}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Clear signature
            </button>
            <button
              type="button"
              disabled={isSubmittingSignature}
              onClick={submitClientSignature}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmittingSignature ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Submit signed document
            </button>
          </div>
        </div>
      </div>
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
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Template Preview
              </p>
              <h3
                id="template-view-modal-title"
                className="truncate text-lg font-semibold text-slate-900 sm:text-xl"
              >
                {activeTemplateViewDoc.documentName}
              </h3>
              {activeTemplateViewDoc.lenderName && (
                <p className="mt-1 text-sm text-slate-500">
                  Requested by {activeTemplateViewDoc.lenderName}
                </p>
              )}
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
              disabled={
                downloadingId === `${activeTemplateViewDoc.requirementId}-template`
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {downloadingId ===
              `${activeTemplateViewDoc.requirementId}-template` ? (
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

  const renderBrokerView = () => {
    const awaitingBroker = rows.filter(
      (row) => row.signStatus === "AWAITING_BROKER",
    );
    const withClient = rows.filter(
      (row) => row.signStatus === "SENT_TO_CLIENT",
    );
    const readyToForward = rows.filter(
      (row) => row.signStatus === "CLIENT_SIGNED",
    );
    const forwarded = rows.filter(
      (row) =>
        row.signStatus === "FORWARDED_TO_LENDER" ||
        row.signStatus === "LENDER_SEEN",
    );

    const statCards = [
      {
        label: "Awaiting you",
        count: awaitingBroker.length,
        color: "text-amber-600",
      },
      {
        label: "With client",
        count: withClient.length,
        color: "text-blue-600",
      },
      {
        label: "Ready to forward",
        count: readyToForward.length,
        color: "text-emerald-600",
      },
      {
        label: "Forwarded",
        count: forwarded.length,
        color: "text-violet-600",
      },
    ];

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-blue-200/30 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm dark:bg-slate-800/80 dark:text-violet-300">
                <PenLine size={14} />
                E-Signature Workflow
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Sign Documents
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Send lender forms to the client for signing, then forward the
                signed copies back to the lender who requested each document.
              </p>
              {lenderGroups.length > 0 && (
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {lenderGroups.length} lender
                  {lenderGroups.length === 1 ? "" : "s"} · {rows.length} document
                  {rows.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statCards.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-white/90 px-3 py-3 text-center shadow-sm dark:bg-slate-800/90"
                >
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.count}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg">
              <FileText size={28} />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-white">
              No sign documents yet
            </p>
            <p className="mt-2 text-sm text-slate-500">
              When a lender uploads a form requiring client signature, it will
              appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {lenderGroups.length > 1 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Filter by requesting lender
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLenderKey("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedLenderKey === "all"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    All lenders ({rows.length})
                  </button>
                  {lenderGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setSelectedLenderKey(group.key)}
                      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        selectedLenderKey === group.key
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <Building2 size={12} className="shrink-0" />
                      <span className="truncate">{group.lenderName}</span>
                      <span>({group.rows.length})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleBrokerRows.map((row) => renderBrokerDocumentCard(row))}
            </div>
          </div>
        )}

        {renderTemplateViewModal()}
        {renderSignedCopyModal()}
      </div>
    );
  };

  const renderClientDocumentActions = (row: SignDocumentRow) => {
    const hasTemplate = Boolean(row.templateFileUrl);
    const awaitingNewSignature = row.signStatus === "SENT_TO_CLIENT";
    const hasSigned =
      !awaitingNewSignature && Boolean(row.signedUpload?.fileUrl);

    if (!hasTemplate && !hasSigned) return null;

    const actionClass =
      "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition min-w-0";

    return (
      <div className="flex gap-2">
        {hasTemplate && (
          <button
            type="button"
            onClick={() => setActiveTemplateViewDoc(row)}
            className={`${actionClass} flex-1 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100`}
            title="View template"
          >
            <Eye size={14} className="shrink-0" />
            <span className="truncate">Template</span>
          </button>
        )}
        {hasSigned && (
          <>
            <button
              type="button"
              onClick={() => setActiveSignedViewDoc(row)}
              className={`${actionClass} flex-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
              title="View signed copy"
            >
              <Eye size={14} className="shrink-0" />
              <span className="truncate">Signed</span>
            </button>
            <button
              type="button"
              onClick={() => downloadSignedCopy(row)}
              disabled={downloadingId === row.requirementId}
              className={`${actionClass} flex-1 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60`}
              title="Download signed copy"
            >
              {downloadingId === row.requirementId ? (
                <Loader2 size={14} className="shrink-0 animate-spin" />
              ) : (
                <Download size={14} className="shrink-0" />
              )}
              <span className="truncate">Save</span>
            </button>
          </>
        )}
      </div>
    );
  };

  const renderClientStatusFooter = (row: SignDocumentRow) => {
    switch (row.signStatus) {
      case "SENT_TO_CLIENT":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
            <PenLine size={16} className="shrink-0" />
            Your signature is required
          </div>
        );
      case "CLIENT_SIGNED":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0" />
            Signed — broker will forward to{" "}
            {row.lenderName || "the lender"}
          </div>
        );
      case "FORWARDED_TO_LENDER":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-800">
            <CheckCircle2 size={16} className="shrink-0" />
            Signed and forwarded to {row.lenderName || "lender"}
          </div>
        );
      case "LENDER_SEEN":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-800">
            <CheckCircle2 size={16} className="shrink-0" />
            Reviewed by {row.lenderName || "lender"}
          </div>
        );
      default:
        return null;
    }
  };

  const renderClientDocumentCard = (row: SignDocumentRow) => {
    const isPending = row.signStatus === "SENT_TO_CLIENT";

    return (
      <div
        key={row.requirementId}
        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
      >
        <div className="mb-4 flex items-start gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              isPending
                ? "bg-blue-100 text-blue-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isImageTemplate(row.templateMimeType, row.templateFileUrl) ? (
              <FileImage size={22} />
            ) : (
              <FileText size={22} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className="text-base font-semibold leading-snug text-slate-900"
              title={row.documentName}
            >
              {row.documentName}
              {row.loiVersionLabel ? (
                <span className="ml-2 text-xs font-medium text-violet-600">
                  ({row.loiVersionLabel})
                </span>
              ) : null}
            </h3>
            {row.lenderName && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Building2 size={12} className="shrink-0" />
                <span className="truncate">Requested by {row.lenderName}</span>
              </p>
            )}
            <div className="mt-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(row.signStatus)}`}
              >
                {row.signStatusLabel || row.signStatus || "-"}
              </span>
            </div>
          </div>
        </div>

        {renderClientDocumentActions(row)}

        {isPending ? (
          <button
            type="button"
            onClick={() => {
              setActiveSigningDoc(row);
              sigRef.current?.clear();
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <PenLine size={16} />
            Review & Sign
          </button>
        ) : (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {renderClientStatusFooter(row)}
          </div>
        )}
      </div>
    );
  };

  const renderClientView = () => {
    const pendingDocs = rows.filter((row) => row.signStatus === "SENT_TO_CLIENT");
    const completedDocs = rows.filter((row) => row.signStatus !== "SENT_TO_CLIENT");

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-200/30 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-blue-200/30 blur-2xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                <PenLine size={14} />
                E-Signature Required
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Sign Documents
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Review each form carefully, add your signature, and submit. Your
                broker will forward signed copies to the lender.
              </p>
              {clientName && (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {clientName}
                  {applicationNumber ? ` · ${applicationNumber}` : ""}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/90 px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-amber-600">
                  {pendingDocs.length}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Pending
                </p>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-emerald-600">
                  {completedDocs.length}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Completed
                </p>
              </div>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg">
              <CheckCircle2 size={28} />
            </div>
            <p className="text-base font-semibold text-slate-800">
              No documents waiting for signature
            </p>
            <p className="mt-2 text-sm text-slate-500">
              When your broker sends a form for signing, it will appear here.
            </p>
          </div>
        ) : (
          <>
            {pendingDocs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Action required
                </p>
                <div className="mx-auto grid max-w-2xl gap-4">
                  {pendingDocs.map((row) => renderClientDocumentCard(row))}
                </div>
              </div>
            )}

            {completedDocs.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Completed
                </p>
                <div className="mx-auto grid max-w-2xl gap-4">
                  {completedDocs.map((row) => renderClientDocumentCard(row))}
                </div>
              </div>
            )}

            {previousSignedLoiVersions.length > 0 && (
              <div className="mx-auto max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Previous signed LOI versions (archive)
                </p>
                <div className="space-y-2">
                  {previousSignedLoiVersions.map((version) => (
                    <div
                      key={version.versionNumber}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Broker LOI / Term Sheet · {version.label}
                        </p>
                        {version.clientSignedAt && (
                          <p className="text-xs text-slate-500">
                            Signed{" "}
                            {new Date(version.clientSignedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openFile(version.signedPdfUrl)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <Eye size={13} />
                        View archive
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {renderSigningModal()}
            {renderTemplateViewModal()}
            {renderSignedCopyModal()}
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Loading sign documents...</p>
        </div>
      </div>
    );
  }

  if (isClientMode) {
    return renderClientView();
  }

  if (isBrokerMode) {
    return renderBrokerView();
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

      {isLenderMode && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-white">
            Upload signable form
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Document name"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={handleLenderUpload}
            disabled={uploading}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            Request signature
          </button>
        </div>
      )}

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
                <th className="px-4 py-3">Lender</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.requirementId}>
                  <td className="px-4 py-3 font-medium">{row.documentName}</td>
                  <td className="px-4 py-3">{row.lenderName || "-"}</td>
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
                    <span className="text-xs text-slate-500">
                      {row.signStatus === "FORWARDED_TO_LENDER"
                        ? "Received"
                        : "In progress"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
