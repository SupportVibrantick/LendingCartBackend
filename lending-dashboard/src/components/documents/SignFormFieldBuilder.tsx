import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  ScanSearch,
  Table2,
  Bookmark,
  Sparkles,
  MousePointer2,
} from "lucide-react";
import PdfPageCanvas from "./PdfPageCanvas";
import {
  FIELD_TYPE_OPTIONS,
  SignFormField,
  SignFormFieldType,
  SignFormFillRole,
  SignFormPayload,
  SignFormSchema,
  SignFormConditional,
  SignFormTable,
  createEmptyField,
  cssBoxToPdfRect,
  pdfRectToCss,
  expandTableToFields,
} from "../../lib/signFormTypes";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";

type SignFormFieldBuilderProps = {
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  applicationLenderId: string;
  requirementId: string;
  documentName: string;
  onBack: () => void;
  onPublished?: () => void;
};

function confidenceTone(confidence?: number | null) {
  if (typeof confidence !== "number") return null;
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.65) return "medium";
  return "low";
}

function sourceLabel(source?: string | null) {
  switch (source) {
    case "acroform":
      return "PDF form";
    case "azure_layout":
      return "OCR";
    case "pdf_text":
      return "PDF text";
    case "tesseract":
      return "Tesseract";
    case "free_ocr":
      return "Free OCR";
    case "llm":
    case "llm_refined":
      return "AI refined";
    case "manual":
      return "Manual";
    default:
      return source || "Unknown";
  }
}

export default function SignFormFieldBuilder({
  apiBase,
  getAuthHeaders,
  applicationLenderId,
  requirementId,
  documentName,
  onBack,
  onPublished,
}: SignFormFieldBuilderProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [form, setForm] = useState<SignFormPayload | null>(null);
  const [fields, setFields] = useState<SignFormField[]>([]);
  const [conditionals, setConditionals] = useState<SignFormConditional[]>([]);
  const [tables, setTables] = useState<SignFormTable[]>([]);
  const [pages, setPages] = useState<SignFormSchema["pages"]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<{
    acroform?: boolean;
    azureConfigured?: boolean;
    llmConfigured?: boolean;
    freeOcrEnabled?: boolean;
    tesseractEnabled?: boolean;
    pdfTextEnabled?: boolean;
    limits?: { maxPages?: number; maxFields?: number };
  } | null>(null);
  const [lastDetectionNote, setLastDetectionNote] = useState<string | null>(
    null,
  );
  const [dragState, setDragState] = useState<{
    fieldId: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  const selectedField = fields.find((f) => f.id === selectedId) || null;
  const currentPage = pages.find((p) => p.page === pageNumber) || pages[0];
  const templateUrl = buildApiPublicFileUrl(
    apiBase,
    form?.templateFileUrl || null,
  );

  const pageFields = useMemo(
    () => fields.filter((f) => f.page === pageNumber),
    [fields, pageNumber],
  );

  const detectedCount = useMemo(
    () =>
      fields.filter((f) => f.meta?.source && f.meta.source !== "manual").length,
    [fields],
  );

  const loadForm = async () => {
    try {
      setLoading(true);
      const [formRes, capRes] = await Promise.all([
        fetch(
          `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/form`,
          { headers: getAuthHeaders() },
        ),
        fetch(
          `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/form/detect-capabilities`,
          { headers: getAuthHeaders() },
        ),
      ]);
      const json = await formRes.json();
      if (!formRes.ok || !json.success) {
        throw new Error(json.message || "Failed to load form");
      }
      const data = json.data as SignFormPayload;
      setForm(data);
      setPages(data.pageManifest || data.schema?.pages || []);
      setFields(data.schema?.fields || []);
      setConditionals(data.schema?.conditionals || []);
      setTables(data.schema?.tables || []);
      setPageNumber(1);
      setSelectedId(null);
      if (data.schema?.detection?.providers?.length) {
        const notes = data.schema.detection.providers
          .map((p) => p.note)
          .filter(Boolean)
          .join(" · ");
        setLastDetectionNote(notes || null);
      }

      if (capRes.ok) {
        const capJson = await capRes.json();
        if (capJson.success) setCapabilities(capJson.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load form");
      onBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForm();
  }, [applicationLenderId, requirementId]);

  useEffect(() => {
    if (!dragState || !currentPage) return;

    const onMove = (event: MouseEvent) => {
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;

      setFields((prev) =>
        prev.map((field) => {
          if (field.id !== dragState.fieldId) return field;
          const css = {
            left: dragState.originLeft,
            top: dragState.originTop,
            width: dragState.originWidth,
            height: dragState.originHeight,
          };
          if (dragState.mode === "move") {
            css.left = Math.max(0, dragState.originLeft + dx);
            css.top = Math.max(0, dragState.originTop + dy);
          } else {
            css.width = Math.max(12, dragState.originWidth + dx);
            css.height = Math.max(12, dragState.originHeight + dy);
          }
          return {
            ...field,
            rect: cssBoxToPdfRect(css, currentPage.heightPt, scale),
          };
        }),
      );
    };

    const onUp = () => setDragState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, currentPage, scale]);

  const buildSchema = (): SignFormSchema => ({
    schemaVersion: 1,
    pages,
    fields,
    conditionals,
    tables,
    detection: form?.schema?.detection || null,
  });

  const saveDraft = async () => {
    try {
      setSaving(true);
      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/form`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schema: buildSchema(),
            pageManifest: pages,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save draft");
      }
      setForm(json.data);
      toast.success("Draft saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const detectFields = async (replaceExisting: boolean) => {
    if (fields.length && replaceExisting) {
      const ok = window.confirm(
        "Replace all current draft fields with newly detected ones?",
      );
      if (!ok) return;
    }

    try {
      setDetecting(true);
      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/form/analyze`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replaceExisting,
            useAzure: true,
            useLlm: true,
            useFreeOcr: true,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Field detection failed");
      }

      const nextForm = json.data?.form as SignFormPayload;
      setForm(nextForm);
      setPages(nextForm.pageManifest || nextForm.schema?.pages || []);
      setFields(nextForm.schema?.fields || []);
      setConditionals(nextForm.schema?.conditionals || []);
      setTables(nextForm.schema?.tables || []);
      setSelectedId(null);

      const notes = (json.data?.detection?.providers || [])
        .map((p: { note?: string | null }) => p.note)
        .filter(Boolean)
        .join(" · ");
      setLastDetectionNote(notes || null);
      toast.success(json.message || "Fields detected");
    } catch (err: any) {
      toast.error(err.message || "Field detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const publish = async () => {
    if (!fields.length) {
      toast.error("Add at least one field before publishing");
      return;
    }
    try {
      setPublishing(true);
      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/form/publish`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schema: buildSchema(),
            pageManifest: pages,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to publish form");
      }
      toast.success("Form published");
      onPublished?.();
      onBack();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const addField = (type: SignFormFieldType) => {
    if (!currentPage) return;
    const field = createEmptyField(
      pageNumber,
      currentPage.widthPt,
      currentPage.heightPt,
      type,
    );
    setFields((prev) => [
      ...prev,
      { ...field, meta: { source: "manual", confidence: 1 } },
    ]);
    setSelectedId(field.id);
  };

  const updateSelected = (patch: Partial<SignFormField>) => {
    if (!selectedId) return;
    setFields((prev) =>
      prev.map((field) =>
        field.id === selectedId ? { ...field, ...patch } : field,
      ),
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const selected = fields.find((f) => f.id === selectedId);
    setFields((prev) => prev.filter((f) => f.id !== selectedId));
    if (selected) {
      setConditionals((prev) =>
        prev.filter(
          (rule) =>
            rule.when.field !== selected.key &&
            !(rule.show || []).includes(selected.key) &&
            !(rule.require || []).includes(selected.key),
        ),
      );
    }
    setSelectedId(null);
  };

  const addTable = () => {
    if (!currentPage) return;
    const maxFields = capabilities?.limits?.maxFields || 150;
    const columnsRaw = window.prompt(
      "Table columns (comma-separated)",
      "Name, Title, Ownership %",
    );
    if (!columnsRaw) return;
    const columns = columnsRaw
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label, index) => ({
        key: `col_${index + 1}`,
        label,
        type: "text" as SignFormFieldType,
      }));
    if (!columns.length) return;
    const rows = Math.min(
      10,
      Math.max(1, Number(window.prompt("How many rows?", "3")) || 3),
    );
    const tableId = `tbl_${Date.now().toString(36)}`;
    const table: SignFormTable = {
      id: tableId,
      label: "Table",
      page: pageNumber,
      columns,
      rows,
      originRect: {
        x: Math.max(36, currentPage.widthPt * 0.12),
        y: Math.max(80, currentPage.heightPt * 0.55),
        width: 90,
        height: 18,
      },
    };
    const generated = expandTableToFields(table);
    if (fields.length + generated.length > maxFields) {
      toast.error(`Tables would exceed the ${maxFields} field limit`);
      return;
    }
    setTables((prev) => [...prev, table]);
    setFields((prev) => [...prev, ...generated]);
    toast.success(`Added ${rows}×${columns.length} table`);
  };

  const saveAsTemplate = async () => {
    if (!fields.length) {
      toast.error("Add fields before saving a template");
      return;
    }
    const name = window.prompt("Template name", documentName);
    if (!name?.trim()) return;
    try {
      setSavingTemplate(true);
      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${requirementId}/save-as-template`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save template");
      }
      toast.success("Saved to template library");
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const selectedVisibility = selectedField
    ? conditionals.find((rule) => (rule.show || []).includes(selectedField.key))
    : null;

  const maxFields = capabilities?.limits?.maxFields || 150;
  const maxPages = capabilities?.limits?.maxPages || 20;

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-100">
      {/* Top bar */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-slate-900">
                Map fillable fields
              </h1>
              {form?.formProcessingStatus &&
                form.formProcessingStatus !== "NONE" && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                    {form.formProcessingStatus.toLowerCase()}
                  </span>
                )}
            </div>
            <p className="truncate text-xs text-slate-500">
              {documentName || "Sign document"} · Page {pageNumber}/
              {pages.length || 1} · {fields.length} fields
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => detectFields(false)}
              disabled={detecting || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {detecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="h-4 w-4" />
              )}
              {fields.length ? "Detect more" : "Detect fields"}
            </button>
            <button
              type="button"
              onClick={saveAsTemplate}
              disabled={savingTemplate || loading || !fields.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {savingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
              Save template
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save draft
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={publishing || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Publish
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 lg:px-6">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
          <p>
            <span className="font-medium text-slate-800">Recommended:</span>{" "}
            Detect fields → review boxes → Save draft → Publish. Free OCR
            {capabilities?.freeOcrEnabled === false ? " off" : " on"}
            {capabilities?.azureConfigured ? " · Azure on" : ""}
            {capabilities?.llmConfigured ? " · AI labels on" : " · AI labels off"}
            . After publish, reuse via <span className="font-medium">Save template</span>.
          </p>
        </div>
      </header>

      {loading || !form || !currentPage || !templateUrl ? (
        <div className="flex flex-1 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Preparing form mapper…
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
          {/* Left tools */}
          <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white">
            <div className="space-y-5 p-4">
              <section className="rounded-xl border border-teal-100 bg-teal-50/70 p-3">
                <p className="text-xs font-semibold text-teal-900">
                  Auto detect
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-teal-800/80">
                  Finds fillable areas on this PDF. Always review before
                  publishing.
                </p>
                {detectedCount > 0 && (
                  <p className="mt-2 text-[11px] font-medium text-teal-900">
                    {detectedCount} auto-detected · check colors on canvas
                  </p>
                )}
                {lastDetectionNote && (
                  <p className="mt-1 line-clamp-3 text-[10px] text-teal-800/70">
                    {lastDetectionNote}
                  </p>
                )}
                {fields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => detectFields(true)}
                    disabled={detecting}
                    className="mt-2 text-[11px] font-semibold text-teal-800 underline disabled:opacity-50"
                  >
                    Re-analyze & replace
                  </button>
                )}
              </section>

              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Add field
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => addField(opt.value)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                    >
                      <Plus className="h-3 w-3" />
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={addTable}
                    className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Add table grid
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  {fields.length}/{maxFields} fields · {pages.length}/{maxPages}{" "}
                  pages
                </p>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Fields ({fields.length})
                </p>
                <div className="space-y-1">
                  {fields.map((field) => {
                    const tone = confidenceTone(field.meta?.confidence);
                    return (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(field.id);
                          setPageNumber(field.page);
                        }}
                        className={`block w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                          selectedId === field.id
                            ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="truncate font-medium">{field.label}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                          <span>
                            p{field.page} · {field.type}
                          </span>
                          {tone && (
                            <span
                              className={`rounded px-1 ${
                                tone === "high"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : tone === "medium"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {Math.round((field.meta?.confidence || 0) * 100)}%
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {!fields.length && (
                    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center">
                      <MousePointer2 className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                      <p className="text-xs text-slate-400">
                        No fields yet. Start with Detect fields.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </aside>

          {/* Canvas */}
          <main className="min-h-0 overflow-auto bg-slate-200/70">
            <div className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
              <button
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-200 bg-white p-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[7rem] text-center text-sm font-medium text-slate-700">
                Page {pageNumber} / {pages.length}
              </span>
              <button
                type="button"
                disabled={pageNumber >= pages.length}
                onClick={() =>
                  setPageNumber((p) => Math.min(pages.length, p + 1))
                }
                className="rounded-md border border-slate-200 bg-white p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="mx-1 h-5 w-px bg-slate-200" />
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
                className="rounded-md border border-slate-200 bg-white p-1.5"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-xs text-slate-500">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.2, s + 0.1))}
                className="rounded-md border border-slate-200 bg-white p-1.5"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-center p-4 md:p-6">
              <PdfPageCanvas
                fileUrl={templateUrl}
                mimeType={form.templateMimeType}
                pageNumber={pageNumber}
                widthPt={currentPage.widthPt}
                heightPt={currentPage.heightPt}
                scale={scale}
                authHeaders={getAuthHeaders()}
              >
                {pageFields.map((field) => {
                  const css = pdfRectToCss(
                    field.rect,
                    currentPage.heightPt,
                    scale,
                  );
                  const selected = field.id === selectedId;
                  const tone = confidenceTone(field.meta?.confidence);
                  const borderClass = selected
                    ? "border-teal-600 bg-teal-400/25 shadow-sm"
                    : tone === "high"
                      ? "border-emerald-500 bg-emerald-400/15"
                      : tone === "medium"
                        ? "border-amber-500 bg-amber-400/15"
                        : tone === "low"
                          ? "border-orange-500 bg-orange-400/15"
                          : "border-sky-500 bg-sky-400/15";
                  return (
                    <div
                      key={field.id}
                      className={`absolute cursor-move border-2 ${borderClass}`}
                      style={{
                        left: css.left,
                        top: css.top,
                        width: css.width,
                        height: css.height,
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedId(field.id);
                        setDragState({
                          fieldId: field.id,
                          mode: "move",
                          startX: event.clientX,
                          startY: event.clientY,
                          originLeft: css.left,
                          originTop: css.top,
                          originWidth: css.width,
                          originHeight: css.height,
                        });
                      }}
                    >
                      <span className="absolute -top-5 left-0 max-w-[160px] truncate rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                        {field.label}
                      </span>
                      <div
                        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-teal-700"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedId(field.id);
                          setDragState({
                            fieldId: field.id,
                            mode: "resize",
                            startX: event.clientX,
                            startY: event.clientY,
                            originLeft: css.left,
                            originTop: css.top,
                            originWidth: css.width,
                            originHeight: css.height,
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </PdfPageCanvas>
            </div>
          </main>

          {/* Properties */}
          <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white">
            <div className="p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Field properties
              </p>
              {!selectedField ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
                  Select a field on the page to edit label, type, and
                  visibility.
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {selectedField.meta?.source &&
                    selectedField.meta.source !== "manual" && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                        Source: {sourceLabel(selectedField.meta.source)}
                        {typeof selectedField.meta.confidence === "number" && (
                          <>
                            {" "}
                            · {Math.round(selectedField.meta.confidence * 100)}%
                          </>
                        )}
                        {selectedField.meta.llmRefined && <> · AI refined</>}
                      </div>
                    )}

                  <label className="block">
                    <span className="text-xs text-slate-500">Label</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                      value={selectedField.label}
                      onChange={(e) =>
                        updateSelected({ label: e.target.value })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Key</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-xs outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                      value={selectedField.key}
                      onChange={(e) =>
                        updateSelected({
                          key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Type</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                      value={selectedField.type}
                      onChange={(e) =>
                        updateSelected({
                          type: e.target.value as SignFormFieldType,
                        })
                      }
                    >
                      {FIELD_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Fill role</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                      value={selectedField.fillRole || "either"}
                      onChange={(e) =>
                        updateSelected({
                          fillRole: e.target.value as SignFormFillRole,
                        })
                      }
                    >
                      <option value="either">Either (client or broker)</option>
                      <option value="client">Client preferred</option>
                      <option value="broker">Broker preferred</option>
                      <option value="readonly">Read-only</option>
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedField.required)}
                      onChange={(e) =>
                        updateSelected({ required: e.target.checked })
                      }
                    />
                    <span>Required</span>
                  </label>

                  <div className="rounded-lg border border-slate-200 p-2.5 space-y-2">
                    <p className="text-xs font-medium text-slate-600">
                      Show when
                    </p>
                    <select
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                      value={selectedVisibility?.when.field || ""}
                      onChange={(e) => {
                        const trigger = e.target.value;
                        setConditionals((prev) => {
                          const without = prev.filter(
                            (rule) =>
                              !(rule.show || []).includes(selectedField.key),
                          );
                          if (!trigger) return without;
                          return [
                            ...without,
                            {
                              when: { field: trigger, equals: true },
                              show: [selectedField.key],
                              require: selectedField.required
                                ? [selectedField.key]
                                : [],
                            },
                          ];
                        });
                      }}
                    >
                      <option value="">Always visible</option>
                      {fields
                        .filter((field) => field.id !== selectedField.id)
                        .map((field) => (
                          <option key={field.id} value={field.key}>
                            {field.label} ({field.key})
                          </option>
                        ))}
                    </select>
                    {selectedVisibility && (
                      <input
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                        placeholder="Equals (true, yes, value…)"
                        value={String(selectedVisibility.when.equals ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const equals =
                            raw === "true"
                              ? true
                              : raw === "false"
                                ? false
                                : raw;
                          setConditionals((prev) =>
                            prev.map((rule) =>
                              (rule.show || []).includes(selectedField.key)
                                ? { ...rule, when: { ...rule.when, equals } }
                                : rule,
                            ),
                          );
                        }}
                      />
                    )}
                  </div>

                  {(selectedField.type === "radio" ||
                    selectedField.type === "dropdown") && (
                    <label className="block">
                      <span className="text-xs text-slate-500">
                        Options (label:value per line)
                      </span>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                        rows={4}
                        value={(selectedField.options || [])
                          .map((o) => `${o.label}:${o.value}`)
                          .join("\n")}
                        onChange={(e) => {
                          const options = e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => {
                              const [label, value] = line.split(":");
                              return {
                                label: (label || "").trim(),
                                value: (value || label || "").trim(),
                              };
                            });
                          updateSelected({ options });
                        }}
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 px-2 py-2 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete field
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
