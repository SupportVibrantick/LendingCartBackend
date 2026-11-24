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
import "./clientPortalTheme.css";

const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

type SignMode = "template" | "sign" | "fill";

function resumeClientPortal(
  navigate: ReturnType<typeof useNavigate>,
  loanApplicationId: string,
  resumeTab: "termSheet" | "signForms" = "signForms",
) {
  navigate("/client-portal", {
    replace: true,
    state: {
      resumeApplicationId: loanApplicationId,
      resumeTab,
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
  const [padSize, setPadSize] = useState({ width: 0, height: 0 });
  const sigRef = useRef<SignatureCanvas | null>(null);
  const padWrapRef = useRef<HTMLDivElement | null>(null);

  const resumeTabParam = params.get("resumeTab");
  const resumeTab: "termSheet" | "signForms" =
    resumeTabParam === "termSheet" || resumeTabParam === "signForms"
      ? resumeTabParam
      : doc && isBrokerTermSheetDoc(doc)
        ? "termSheet"
        : "signForms";

  const goBack = () => {
    if (loanApplicationId) {
      resumeClientPortal(navigate, loanApplicationId, resumeTab);
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
  // Broker term sheets stay on the signature pad — never force fill mode.
  useEffect(() => {
    if (loading || !doc) return;
    if (
      mode === "sign" &&
      doc.signMode === "DYNAMIC_FORM" &&
      !isBrokerTermSheetDoc(doc)
    ) {
      openFillPage();
      return;
    }
    // Guard: if fill was opened for a non-fillable term sheet, switch to sign.
    if (
      mode === "fill" &&
      (isBrokerTermSheetDoc(doc) || doc.signMode !== "DYNAMIC_FORM")
    ) {
      navigate(
        buildSignDocumentUrl({
          mode: "sign",
          loanApplicationId,
          requirementId,
          documentName: doc.documentName || documentNameParam,
        }) + `&resumeTab=${resumeTab}`,
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, doc, mode]);

  // Keep canvas bitmap size = visible box size so pointer coords match (no skewed signing).
  useEffect(() => {
    if (loading || mode !== "sign") return;
    const el = padWrapRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      setPadSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener("orientationchange", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", updateSize);
    };
  }, [loading, mode, doc?.requirementId]);

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
      // Use getCanvas only — getTrimmedCanvas depends on trim-canvas default export
      // which breaks under Vite ESM (import_trim_canvas.default is not a function).
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
      // Return to the same workspace tab (termSheet vs signForms), not always Fill & Sign.
      resumeClientPortal(navigate, loanApplicationId, resumeTab);
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
            Open this page from Term Sheet or Sign Forms in your client portal.
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

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading document…
      </div>
    );
  }

  // Only mount the filler once we know this is a published dynamic form.
  if (
    mode === "fill" &&
    doc &&
    doc.signMode === "DYNAMIC_FORM" &&
    !isBrokerTermSheetDoc(doc)
  ) {
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
        documentName={doc.documentName || documentNameParam}
        initialSignStatus={doc.signStatus || "SENT_TO_CLIENT"}
        onSubmitted={goBack}
      />
    );
  }

  if (mode === "fill") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Opening document…
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

  const title = mode === "sign" ? "Sign document" : "Template Preview";
  const displayName = doc?.documentName || documentNameParam;
  const templateUrl = buildApiPublicFileUrl(
    getClientPortalApiBase(),
    doc?.templateFileUrl || null,
  );
  const isDynamicForm = doc?.signMode === "DYNAMIC_FORM";
  const isBrokerSheet = Boolean(doc && isBrokerTermSheetDoc(doc));

  return (
    <div className="client-portal flex h-dvh min-h-0 flex-col bg-[#F7F9FC]">
      <header className="z-10 flex h-11 shrink-0 items-center gap-2 border-b border-[#E2E8F0] bg-white px-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={goBack}
          disabled={submitting}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2.5 text-[13px] font-medium text-[#64748B] transition hover:bg-[#F7F9FC] hover:text-[#111827] disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4C78F5]">
            {title}
            {doc?.loiVersionLabel ? ` · ${doc.loiVersionLabel}` : ""}
          </p>
          <h1 className="truncate text-[14px] font-semibold leading-tight text-[#111827]">
            {displayName}
          </h1>
        </div>
        {mode === "template" && isDynamicForm ? (
          <button
            type="button"
            onClick={openFillPage}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#4C78F5] px-3 text-[12px] font-semibold text-white hover:bg-[#3B66E0]"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Open form
          </button>
        ) : null}
        {mode === "template" ? (
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloading || !doc?.templateFileUrl}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[12px] font-semibold text-[#64748B] hover:bg-[#F7F9FC] disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Download</span>
          </button>
        ) : null}
      </header>

      {!doc ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-medium text-[#111827]">Document not found</p>
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm text-[#64748B] hover:bg-[#F7F9FC]"
          >
            Back
          </button>
        </div>
      ) : mode === "template" ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
          {isDynamicForm ? (
            <div className="mb-2 shrink-0 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Preview only — use <span className="font-semibold">Open form</span>{" "}
              to enter and save field values.
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
            <EmbeddedFilePreview
              remoteUrl={templateUrl}
              mimeType={doc.templateMimeType}
              fileName={doc.templateFileName}
              getAuthHeaders={getClientPortalAuthHeaders}
              iframeClassName="h-full min-h-0 w-full bg-white"
            />
          </div>
        </main>
      ) : mode === "sign" && doc.signMode !== "DYNAMIC_FORM" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Document preview — dominates on large screens */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-[#E2E8F0] lg:border-r">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-3 py-2">
              <p className="text-[12px] font-semibold text-[#111827]">
                Document preview
              </p>
              <p className="hidden text-[11px] text-[#94A3B8] sm:block">
                View-only · zoom &amp; pan with viewer controls
              </p>
            </div>
            <div className="min-h-0 flex-1 bg-[#0f172a]">
              <EmbeddedFilePreview
                remoteUrl={templateUrl}
                mimeType={doc.templateMimeType}
                fileName={doc.templateFileName}
                getAuthHeaders={getClientPortalAuthHeaders}
                iframeClassName="h-full min-h-[45vh] w-full bg-[#0f172a] lg:min-h-0"
              />
            </div>
          </section>

          {/* Signature rail — tall pad, canvas sized to the visible box */}
          <aside className="flex w-full shrink-0 flex-col border-t border-[#E2E8F0] bg-white lg:w-[360px] xl:w-[420px] lg:border-t-0">
            <div className="shrink-0 border-b border-[#E2E8F0] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                  <PenLine className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111827]">
                    Your signature
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {isBrokerSheet
                      ? isStandaloneBrokerTermSheet(doc)
                        ? "Review the term sheet, then sign."
                        : "Review the broker LOI, then sign."
                      : "Review the document, then sign."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
              <div
                ref={padWrapRef}
                className="relative min-h-[240px] flex-1 overflow-hidden rounded-[10px] border-2 border-dashed border-[#4C78F5]/35 bg-white shadow-[inset_0_0_0_1px_rgba(76,120,245,0.06)]"
                style={{ touchAction: "none" }}
              >
                {/* Guide line so signatures sit naturally */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-4 bottom-[28%] z-[1] border-b border-dashed border-[#CBD5E1]"
                />
                {padSize.width > 0 && padSize.height > 0 ? (
                  <SigCanvas
                    key={`${padSize.width}x${padSize.height}`}
                    ref={sigRef}
                    penColor="#111827"
                    minWidth={1.6}
                    maxWidth={3.4}
                    velocityFilterWeight={0.65}
                    throttle={8}
                    clearOnResize={false}
                    canvasProps={{
                      width: padSize.width,
                      height: padSize.height,
                      className: "block touch-none bg-transparent",
                      style: {
                        width: padSize.width,
                        height: padSize.height,
                        display: "block",
                      },
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[12px] text-[#94A3B8]">
                    Preparing signature pad…
                  </div>
                )}
              </div>
              <p className="shrink-0 text-[11px] text-[#94A3B8]">
                Sign above the line with mouse or finger. Clear if you need to
                retry.
              </p>

              <div className="mt-auto flex shrink-0 flex-col gap-2">
                <button
                  type="button"
                  onClick={submitSignature}
                  disabled={submitting}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#4C78F5] text-[13px] font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Submit signed document
                </button>
                <button
                  type="button"
                  onClick={() => sigRef.current?.clear()}
                  disabled={submitting}
                  className="inline-flex h-9 w-full items-center justify-center rounded-[8px] border border-[#E2E8F0] text-[13px] font-medium text-[#64748B] transition hover:bg-[#F7F9FC] disabled:opacity-50"
                >
                  Clear signature
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-[#64748B]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Opening fillable form…
        </div>
      )}
    </div>
  );
}
