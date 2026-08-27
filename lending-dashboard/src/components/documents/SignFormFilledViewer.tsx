import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import PdfPageCanvas from "./PdfPageCanvas";
import {
  SignFormField,
  SignFormPayload,
  SignFormSchema,
  evaluateSignFormConditionals,
  pdfRectToCss,
} from "../../lib/signFormTypes";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";

type SignFormFilledViewerProps = {
  open: boolean;
  onClose: () => void;
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  applicationLenderId: string;
  requirementId: string;
  documentName: string;
};

/**
 * Read-only PDF + field value overlays for lenders reviewing a completed form.
 */
export default function SignFormFilledViewer({
  open,
  onClose,
  apiBase,
  getAuthHeaders,
  applicationLenderId,
  requirementId,
  documentName,
}: SignFormFilledViewerProps) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SignFormPayload | null>(null);
  const [pages, setPages] = useState<SignFormSchema["pages"]>([]);
  const [fields, setFields] = useState<SignFormField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [filledCount, setFilledCount] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const currentPage = pages.find((p) => p.page === pageNumber) || pages[0];
  const templateUrl = buildApiPublicFileUrl(
    apiBase,
    form?.templateFileUrl || null,
  );

  const visibleFields = useMemo(() => {
    const evaluation = evaluateSignFormConditionals(
      { fields, conditionals: form?.schema?.conditionals || [] },
      values,
    );
    return fields.filter((f) => !evaluation.hiddenKeys.has(f.key));
  }, [fields, values, form?.schema?.conditionals]);

  const pageFields = useMemo(
    () => visibleFields.filter((f) => Number(f.page) === Number(pageNumber)),
    [visibleFields, pageNumber],
  );

  const pageNumbers = useMemo(() => {
    const fromPages = pages.map((p) => Number(p.page)).filter((n) => n >= 1);
    if (fromPages.length) return fromPages;
    return Array.from(
      new Set(visibleFields.map((f) => Number(f.page) || 1)),
    ).sort((a, b) => a - b);
  }, [pages, visibleFields]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/form`,
          { headers: getAuthHeaders() },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load filled form");
        }
        if (cancelled) return;

        const data = json.data as SignFormPayload & {
          submission?: { values?: Record<string, unknown> };
          progress?: { all?: { filled?: number; total?: number } };
        };

        setForm(data);
        setPages(data.pageManifest || data.schema?.pages || []);
        setFields(data.schema?.fields || []);

        const initial: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(
          data.submission?.values || {},
        )) {
          initial[key] =
            value && typeof value === "object" && "value" in (value as object)
              ? (value as { value: unknown }).value
              : value;
        }
        setValues(initial);
        setFilledCount(
          data.progress?.all?.filled ??
            Object.values(initial).filter(
              (v) => v != null && v !== "" && v !== false,
            ).length,
        );

        const firstPage =
          (data.schema?.fields || []).find((f) => Number(f.page) >= 1)?.page ||
          1;
        setPageNumber(Number(firstPage) || 1);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load filled form");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, applicationLenderId, requirementId, apiBase]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const renderFieldValue = (field: SignFormField) => {
    if (!currentPage) return null;
    const css = pdfRectToCss(field.rect, currentPage.heightPt, scale);
    const value = values[field.key];

    const style: React.CSSProperties = {
      left: css.left,
      top: css.top,
      width: Math.max(css.width, 24),
      height: Math.max(css.height, 18),
      position: "absolute",
      zIndex: 5,
      fontSize: Math.max(10, Math.min(14, css.height * 0.55)),
      boxSizing: "border-box",
      pointerEvents: "none",
    };

    if (field.type === "checkbox") {
      return (
        <div
          key={field.id}
          style={style}
          className="flex items-center justify-center border-2 border-emerald-500 bg-emerald-50/90"
          title={field.label}
        >
          {value ? (
            <span className="text-sm font-bold text-emerald-700">✓</span>
          ) : null}
        </div>
      );
    }

    if (field.type === "signature" || field.type === "initial") {
      return (
        <div
          key={field.id}
          style={style}
          className="overflow-hidden border-2 border-emerald-500 bg-white/95"
          title={field.label}
        >
          {typeof value === "string" && value.startsWith("data:image") ? (
            <img
              src={value}
              alt={field.label}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="px-1 text-[10px] text-slate-400">
              {field.label}
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        key={field.id}
        style={style}
        className="overflow-hidden border-2 border-emerald-500 bg-emerald-50/95 px-1 text-slate-900"
        title={field.label}
      >
        <span className="leading-tight">
          {value == null || value === "" ? "" : String(value)}
        </span>
      </div>
    );
  };

  if (!open) return null;

  const downloadFilled = async () => {
    try {
      setDownloading(true);
      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/download-filled`,
        { headers: getAuthHeaders() },
      );
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
        `${documentName.replace(/[<>:"/\\|?*]+/g, "-")}-filled.pdf`;
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
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-3 md:p-6">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Filled form
            </h2>
            <p className="truncate text-xs text-slate-500">{documentName}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Template with submitted field values (view only).
              {filledCount > 0 ? ` · ${filledCount} values filled` : ""}
              {visibleFields.length
                ? ` · ${visibleFields.length} fields`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !form || !currentPage || !templateUrl ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading filled form…
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
              <button
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                className="rounded-md border bg-white p-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex max-w-full flex-wrap justify-center gap-1">
                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setPageNumber(page)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      page === pageNumber
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={pageNumber >= Math.max(pages.length, pageNumbers.length)}
                onClick={() =>
                  setPageNumber((p) =>
                    Math.min(Math.max(pages.length, pageNumbers.length), p + 1),
                  )
                }
                className="rounded-md border bg-white p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(2))))
                }
                className="rounded-md border bg-white p-1.5"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setScale((s) => Math.min(2.2, Number((s + 0.1).toFixed(2))))
                }
                className="rounded-md border bg-white p-1.5"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="flex justify-center">
                <PdfPageCanvas
                  fileUrl={templateUrl}
                  mimeType={form.templateMimeType}
                  pageNumber={pageNumber}
                  widthPt={currentPage.widthPt}
                  heightPt={currentPage.heightPt}
                  scale={scale}
                  authHeaders={getAuthHeaders()}
                >
                  {pageFields.map((field) => renderFieldValue(field))}
                </PdfPageCanvas>
              </div>
            </div>
          </div>
        )}

        <div className="flex shrink-0 justify-end gap-2 border-t bg-white px-4 py-3">
          <button
            type="button"
            onClick={downloadFilled}
            disabled={downloading || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
