import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  LayoutGrid,
  Loader2,
  PenLine,
} from "lucide-react";
import EmbeddedFilePreview from "../../components/documents/EmbeddedFilePreview";
import SignFormFiller from "../../components/documents/SignFormFiller";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import {
  ClientSignDocumentRow,
  fetchClientSignDocument,
  getClientPortalApiBase,
  getClientPortalAuthHeaders,
  isBrokerTermSheetDoc,
  isStandaloneBrokerTermSheet,
} from "../../lib/clientPortalApi";

const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

type SignMode = "template" | "sign" | "fill";

function resumeClientPortal(
  navigate: ReturnType<typeof useNavigate>,
  loanApplicationId: string,
) {
  navigate("/client-portal", {
    replace: true,
    state: {
      resumeApplicationId: loanApplicationId,
      resumeTab: "signDocuments",
    },
  });
}

function buildSignDocumentUrl(params: {
  mode: SignMode;
  loanApplicationId: string;
  requirementId: string;
  documentName: string;
}) {
  const qs = new URLSearchParams({
    mode: params.mode,
    loanApplicationId: params.loanApplicationId,
    requirementId: params.requirementId,
    documentName: params.documentName,
  });
  return `/client-portal/sign-document?${qs.toString()}`;
}

export default function ClientSignDocumentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get("mode") || "template") as SignMode;
  const loanApplicationId = params.get("loanApplicationId") || "";
  const requirementId = params.get("requirementId") || "";
  const documentNameParam = params.get("documentName") || "Document";

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<ClientSignDocumentRow | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);

  const goBack = () => {
    if (loanApplicationId) {
      resumeClientPortal(navigate, loanApplicationId);
      return;
    }
    navigate("/client-portal", { replace: true });
  };

  const openFillPage = () => {
    navigate(
      buildSignDocumentUrl({
        mode: "fill",
        loanApplicationId,
        requirementId,
        documentName: doc?.documentName || documentNameParam,
      }),
      { replace: true },
    );
  };

  useEffect(() => {
    if (!loanApplicationId || !requirementId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const row = await fetchClientSignDocument(
          loanApplicationId,
          requirementId,
        );
        if (!cancelled) setDoc(row);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load document");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loanApplicationId, requirementId]);

  // Fillable mapped forms must use SignFormFiller (mode=fill), not PDF AcroForm typing.
  useEffect(() => {
    if (loading || !doc) return;
    if (mode === "sign" && doc.signMode === "DYNAMIC_FORM") {
      openFillPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, doc, mode]);

  const downloadTemplate = async () => {
    if (!doc || !loanApplicationId || !requirementId) return;

    try {
      setDownloading(true);

      if (doc.signMode === "DYNAMIC_FORM") {
        const res = await fetch(
          `${getClientPortalApiBase()}/client-portal/sign-documents/${requirementId}/download-filled?loanApplicationId=${encodeURIComponent(loanApplicationId)}`,
          { headers: getClientPortalAuthHeaders() },
        );
        if (!res.ok) {
          let message = "Download failed";
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
          `${(doc.documentName || "form").replace(/[<>:"/\\|?*]+/g, "-")}-filled.pdf`;
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        return;
      }

      if (!doc.templateFileUrl) return;
      const url = buildApiPublicFileUrl(
        getClientPortalApiBase(),
        doc.templateFileUrl,
      );
      if (!url) return;
      const res = await fetch(url, {
        headers: getClientPortalAuthHeaders(),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${(doc.documentName || "template").replace(/[<>:"/\\|?*]+/g, "-")}-template`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const submitSignature = async () => {
    if (!doc || !loanApplicationId) return;
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please draw your signature first");
      return;
    }

    try {
      setSubmitting(true);
      const signature = sigRef.current.getCanvas().toDataURL("image/png");
      const res = await fetch(
        `${getClientPortalApiBase()}/client-portal/sign-documents/${doc.requirementId}/sign`,
        {
          method: "POST",
          headers: {
            ...getClientPortalAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ signature, loanApplicationId }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Signing failed");
      }
      toast.success(
        isBrokerTermSheetDoc(doc)
          ? isStandaloneBrokerTermSheet(doc)
            ? "Broker term sheet signed successfully"
            : "Broker LOI / term sheet signed successfully"
          : "Document signed successfully",
      );
      resumeClientPortal(navigate, loanApplicationId);
    } catch (err: any) {
      toast.error(err.message || "Signing failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loanApplicationId || !requirementId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Missing document context
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Open this page from Term Sheet &amp; Sign.
          </p>
          <button
            type="button"
            onClick={() => navigate("/client-portal")}
            className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Back to portal
          </button>
        </div>
      </div>
    );
  }

  if (mode === "fill") {
    return (
      <SignFormFiller
        open
        layout="page"
        mode="client"
        onClose={goBack}
        apiBase={getClientPortalApiBase()}
        getAuthHeaders={getClientPortalAuthHeaders}
        loanApplicationId={loanApplicationId}
        requirementId={requirementId}
        documentName={doc?.documentName || documentNameParam}
        initialSignStatus={doc?.signStatus || "SENT_TO_CLIENT"}
        onSubmitted={goBack}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading document…
      </div>
    );
  }

  if (mode === "sign" && doc?.signMode === "DYNAMIC_FORM") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Opening fillable form…
      </div>
    );
  }

  const title = mode === "sign" ? "Review & Sign" : "Template Preview";
  const displayName = doc?.documentName || documentNameParam;
  const templateUrl = buildApiPublicFileUrl(
    getClientPortalApiBase(),
    doc?.templateFileUrl || null,
  );
  const isDynamicForm = doc?.signMode === "DYNAMIC_FORM";

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              {title}
            </p>
            <h1 className="truncate text-lg font-semibold text-slate-900">
              {displayName}
              {doc?.loiVersionLabel ? (
                <span className="ml-2 text-sm font-medium text-violet-600">
                  ({doc.loiVersionLabel})
                </span>
              ) : null}
            </h1>
            {doc?.lenderName && (
              <p className="truncate text-xs text-slate-500">
                Requested by {doc.lenderName}
              </p>
            )}
          </div>
          {mode === "template" && isDynamicForm && (
            <button
              type="button"
              onClick={openFillPage}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <LayoutGrid className="h-4 w-4" />
              {doc?.hasSignatureField
                ? "Fill & sign form"
                : "Fill & save form"}
            </button>
          )}
          {mode === "template" && (
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={downloading || !doc?.templateFileUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </button>
          )}
        </div>
      </header>

      {!doc ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-medium text-slate-800">
            Document not found
          </p>
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      ) : mode === "template" ? (
        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          {isDynamicForm && (
            <div className="mx-auto mb-4 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">
                Preview only — typing here is not saved.
              </p>
              <p className="mt-1 text-amber-800/90">
                Use{" "}
                <span className="font-semibold">
                  {doc?.hasSignatureField
                    ? "Fill & sign form"
                    : "Fill & save form"}
                </span>{" "}
                to enter field values. Those saves sync for client and broker.
              </p>
            </div>
          )}
          <div className="mx-auto h-[min(80vh,900px)] max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <EmbeddedFilePreview
              remoteUrl={templateUrl}
              mimeType={doc.templateMimeType}
              fileName={doc.templateFileName}
              getAuthHeaders={getClientPortalAuthHeaders}
              viewOnly
              iframeClassName="h-full min-h-[70vh] w-full bg-white"
            />
          </div>
        </main>
      ) : mode === "sign" && doc.signMode !== "DYNAMIC_FORM" ? (
        <>
          <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
            <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Document preview is view-only. Draw your signature on the right,
              then submit. Field values are not edited on this page.
            </div>
            <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Document preview
                  </p>
                </div>
                <div className="h-[min(60vh,640px)]">
                  <EmbeddedFilePreview
                    remoteUrl={templateUrl}
                    mimeType={doc.templateMimeType}
                    fileName={doc.templateFileName}
                    getAuthHeaders={getClientPortalAuthHeaders}
                    viewOnly
                    iframeClassName="h-full min-h-[50vh] w-full bg-white"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-sky-600" />
                  <p className="text-sm font-semibold text-slate-800">
                    Your signature
                  </p>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  {isBrokerTermSheetDoc(doc)
                    ? isStandaloneBrokerTermSheet(doc)
                      ? "Review your broker's term sheet, then sign below."
                      : "Review your broker LOI / term sheet, then sign below."
                    : "Read the document, then sign below."}
                </p>
                <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
                  <SigCanvas
                    ref={sigRef}
                    penColor="#111827"
                    canvasProps={{
                      width: 640,
                      height: 200,
                      className: "w-full touch-none",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Use your mouse or finger to sign inside the box.
                </p>
              </section>
            </div>
          </main>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => sigRef.current?.clear()}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear signature
              </button>
              <button
                type="button"
                onClick={submitSignature}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Submit signed document
              </button>
            </div>
          </footer>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Opening fillable form…
        </div>
      )}
    </div>
  );
}
