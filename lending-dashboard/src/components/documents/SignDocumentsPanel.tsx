import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import {
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
import { canMarkSignSeen } from "../../lib/lenderPermissions";

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
  onUpdated,
  readOnly = false,
}: SignDocumentsPanelProps) {
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      let url = "";

      if (mode === "lender" && applicationLenderId) {
        url = `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents`;
      } else if (mode === "broker" && submissionId) {
        url = `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/sign-documents`;
      } else if (mode === "client" && loanApplicationId) {
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
    fetchRows();
  }, [mode, applicationLenderId, submissionId, loanApplicationId]);

  useEffect(() => {
    if (!activeTemplateViewDoc && !activeSignedViewDoc) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTemplateViewDoc(null);
        setActiveSignedViewDoc(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeTemplateViewDoc, activeSignedViewDoc]);

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
    if (!fileUrl) return;
    window.open(`${apiBase}${fileUrl}`, "_blank");
  };

  const downloadRemoteFile = async (
    fileUrl: string,
    filename: string,
    trackId?: string,
  ) => {
    try {
      if (trackId) setDownloadingId(trackId);

      const res = await fetch(`${apiBase}${fileUrl}`, {
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

  const openSignedCopy = async (row: SignDocumentRow) => {
    if (
      canMarkSignSeen() &&
      mode === "lender" &&
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

  const renderDocumentTitle = (row: SignDocumentRow) => {
    const showFileName =
      row.templateFileName &&
      row.templateFileName.trim() !== row.documentName.trim();

    return (
      <div className="min-w-0">
        <h3
          className="line-clamp-2 text-sm font-semibold text-slate-900"
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
            className={`${inlineActionClass} border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100`}
            title="View template"
          >
            <Eye size={13} className="shrink-0" />
            Template
          </button>
        )}
        {hasSigned && (
          <button
            type="button"
            onClick={() => openSignedCopy(row)}
            className={`${inlineActionClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
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
            className={`${inlineActionClass} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60`}
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
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)
    );
  };

  const renderTemplatePreview = (row: SignDocumentRow) => {
    if (!row.templateFileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Template preview unavailable
        </div>
      );
    }

    const fileUrl = `${apiBase}${row.templateFileUrl}`;

    if (isPdfTemplate(row.templateMimeType, row.templateFileUrl)) {
      return (
        <iframe
          title={row.documentName}
          src={fileUrl}
          className="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
        />
      );
    }

    if (isImageTemplate(row.templateMimeType, row.templateFileUrl)) {
      return (
        <div className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]">
          <img
            src={fileUrl}
            alt={row.documentName}
            className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
          />
        </div>
      );
    }

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

    const fileUrl = `${apiBase}${signed.fileUrl}`;

    if (isPdfTemplate(signed.fileMimeType, signed.fileUrl)) {
      return (
        <iframe
          title={`Signed ${row.documentName}`}
          src={fileUrl}
          className="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
        />
      );
    }

    if (isImageTemplate(signed.fileMimeType, signed.fileUrl)) {
      return (
        <div className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]">
          <img
            src={fileUrl}
            alt={`Signed ${row.documentName}`}
            className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
          />
        </div>
      );
    }

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
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-teal-50 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
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
    switch (row.signStatus) {
      case "AWAITING_BROKER":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <Clock size={16} className="shrink-0" />
            Awaiting broker to send to client
          </div>
        );
      case "SENT_TO_CLIENT":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
            <Clock size={16} className="shrink-0" />
            With client for signature
          </div>
        );
      case "CLIENT_SIGNED":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <PenLine size={16} className="shrink-0" />
            Client signed — awaiting broker forward
          </div>
        );
      case "FORWARDED_TO_LENDER":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-800">
            <CheckCircle2 size={16} className="shrink-0" />
            Received signed copy
          </div>
        );
      case "LENDER_SEEN":
        return (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-800">
            <CheckCircle2 size={16} className="shrink-0" />
            Seen by lender
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            <Clock size={16} className="shrink-0" />
            In progress
          </div>
        );
    }
  };

  const renderLenderView = () => {
    const inProgress = rows.filter(
      (row) =>
        row.signStatus !== "FORWARDED_TO_LENDER" &&
        row.signStatus !== "LENDER_SEEN",
    );
    const received = rows.filter(
      (row) =>
        row.signStatus === "FORWARDED_TO_LENDER" ||
        row.signStatus === "LENDER_SEEN",
    );

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-200/30 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-200/30 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-teal-700 shadow-sm">
                <PenLine size={14} />
                Client E-Signature
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Sign Documents
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                {readOnly
                  ? "View signature requests and signed copies returned by the broker. You cannot upload or request new signatures."
                  : "Upload PDF or image forms for the client to sign. The broker manages delivery and returns signed copies to you."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/90 px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-blue-600">
                  {inProgress.length}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  In progress
                </p>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-violet-600">
                  {received.length}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Received
                </p>
              </div>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Read-only access. You can review templates and signed copies but
            cannot request new signatures.
          </div>
        )}

        {!readOnly && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Upload signable form
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                PDF, PNG, JPEG, or WebP — max one form per request.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Document name (e.g. Authorization Form)"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 transition hover:border-teal-300 hover:bg-teal-50/50">
              <FileText size={18} className="shrink-0 text-teal-600" />
              <span className="truncate">
                {uploadFile ? uploadFile.name : "Choose PDF or image file"}
              </span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleLenderUpload}
            disabled={uploading || !uploadFile || !uploadName.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg">
              <FileText size={28} />
            </div>
            <p className="text-base font-semibold text-slate-800">
              No sign documents yet
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {readOnly
                ? "No signature documents have been requested for this application yet."
                : "Upload a form above to start the client e-signature workflow."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <div
                key={row.requirementId}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
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
                      {isImageTemplate(
                        row.templateMimeType,
                        row.templateFileUrl,
                      ) ? (
                        <FileImage size={20} />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div className="min-w-0">
                      {renderDocumentTitle(row)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(row.signStatus)}`}
                  >
                    {row.signStatusLabel || row.signStatus || "-"}
                  </span>
                </div>

                {renderInlineDocumentActions(row)}

                <div className="mt-auto border-t border-slate-100 pt-4">
                  {renderLenderStatusFooter(row)}
                </div>
              </div>
            ))}
          </div>
        )}

        {renderTemplateViewModal()}
        {renderSignedCopyModal()}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" />
          <p className="mt-3 text-sm text-slate-500">Loading sign documents...</p>
        </div>
      </div>
    );
  }

  if (mode === "lender") {
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
                {mode !== "client" && <th className="px-4 py-3">Lender</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.requirementId}>
                  <td className="px-4 py-3 font-medium">{row.documentName}</td>
                  {mode !== "client" && (
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
                    {mode === "broker" && row.signStatus === "AWAITING_BROKER" && (
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
                    {mode === "broker" && row.signStatus === "CLIENT_SIGNED" && (
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
                    {mode === "client" &&
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
                    {mode === "client" &&
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

      {mode === "client" && signingId && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          Review the template using the eye button, then sign the document below.
        </div>
      )}
    </div>
  );
}
