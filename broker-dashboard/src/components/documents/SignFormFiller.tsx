import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  SendHorizonal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import PdfPageCanvas from "./PdfPageCanvas";
import {
  SignFormField,
  SignFormPayload,
  SignFormSchema,
  pdfRectToCss,
  evaluateSignFormConditionals,
} from "../../lib/signFormTypes";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";

const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

type FormProgress = {
  client: { required: number; filled: number; total: number; complete: boolean };
  broker: { required: number; filled: number; total: number; complete: boolean };
  all: { required: number; filled: number; total: number; complete: boolean };
};

type SignFormFillerProps = {
  open: boolean;
  onClose: () => void;
  mode: "client" | "broker";
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  loanApplicationId: string;
  requirementId: string;
  documentName: string;
  submissionId?: string;
  apiRolePrefix?: "broker" | "loanofficer";
  /** Known status from list row — used when form payload omits/lags signStatus */
  initialSignStatus?: string | null;
  onSubmitted?: () => void;
  layout?: "modal" | "page";
};

export default function SignFormFiller({
  open,
  onClose,
  mode,
  apiBase,
  getAuthHeaders,
  loanApplicationId,
  requirementId,
  documentName,
  submissionId,
  apiRolePrefix = "broker",
  initialSignStatus = null,
  onSubmitted,
  layout = "modal",
}: SignFormFillerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SignFormPayload | null>(null);
  const [pages, setPages] = useState<SignFormSchema["pages"]>([]);
  const [fields, setFields] = useState<SignFormField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [progress, setProgress] = useState<FormProgress | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [activeSigFieldId, setActiveSigFieldId] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const currentPage = pages.find((p) => p.page === pageNumber) || pages[0];
  const templateUrl = buildApiPublicFileUrl(
    apiBase,
    form?.templateFileUrl || null,
  );
  const pageFields = useMemo(() => {
    const evaluation = evaluateSignFormConditionals(
      { fields, conditionals: form?.schema?.conditionals || [] },
      values,
    );
    return fields.filter(
      (f) =>
        Number(f.page) === Number(pageNumber) &&
        !evaluation.hiddenKeys.has(f.key),
    );
  }, [fields, pageNumber, values, form?.schema?.conditionals]);

  const visibleFields = useMemo(() => {
    const evaluation = evaluateSignFormConditionals(
      { fields, conditionals: form?.schema?.conditionals || [] },
      values,
    );
    return fields.filter((f) => !evaluation.hiddenKeys.has(f.key));
  }, [fields, values, form?.schema?.conditionals]);

  const effectiveRequiredKeys = useMemo(() => {
    const evaluation = evaluateSignFormConditionals(
      { fields, conditionals: form?.schema?.conditionals || [] },
      values,
    );
    return new Set(
      fields
        .filter(
          (field) =>
            !evaluation.hiddenKeys.has(field.key) &&
            (field.required || evaluation.extraRequiredKeys.has(field.key)),
        )
        .map((field) => field.key),
    );
  }, [fields, values, form?.schema?.conditionals]);

  const formUrl =
    mode === "broker"
      ? `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/form`
      : `${apiBase}/client-portal/sign-documents/${requirementId}/form?loanApplicationId=${encodeURIComponent(loanApplicationId)}`;

  const valuesUrl =
    mode === "broker"
      ? `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/form/values`
      : `${apiBase}/client-portal/sign-documents/${requirementId}/form/values`;

  const loadForm = async () => {
    try {
      setLoading(true);
      const res = await fetch(formUrl, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load form");
      }
      const data = json.data as SignFormPayload & {
        progress?: FormProgress;
        readOnly?: boolean;
      };
      setForm(data);
      setPages(data.pageManifest || data.schema?.pages || []);
      setFields(data.schema?.fields || []);
      setProgress(data.progress || null);
      setReadOnly(Boolean(data.readOnly));
      const initial: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data.submission?.values || {})) {
        initial[key] =
          value && typeof value === "object" && "value" in (value as object)
            ? (value as { value: unknown }).value
            : value;
      }
      valuesRef.current = initial;
      setValues(initial);
      const schemaFields = data.schema?.fields || [];
      const firstFieldPage = schemaFields.find(
        (f: SignFormField) => Number(f.page) >= 1,
      )?.page;
      setPageNumber(Number(firstFieldPage) || 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to load form");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadForm();
  }, [open, requirementId, loanApplicationId, submissionId, mode]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const persistValues = async ({
    complete,
    silent,
    sourceValues,
  }: {
    complete: boolean;
    silent?: boolean;
    sourceValues?: Record<string, unknown>;
  }) => {
    if (readOnly) return null;

    const source = sourceValues || valuesRef.current;
    const editableValues: Record<string, unknown> = {};
    for (const field of fields) {
      if ((field as any).editable === false) continue;
      if (Object.prototype.hasOwnProperty.call(source, field.key)) {
        editableValues[field.key] = source[field.key];
      }
    }

    const body: Record<string, unknown> = {
      values: editableValues,
      complete,
    };
    if (mode === "client") {
      body.loanApplicationId = loanApplicationId;
    }

    const res = await fetch(
      mode === "client" && complete
        ? `${apiBase}/client-portal/sign-documents/${requirementId}/submit-form`
        : valuesUrl,
      {
        method: mode === "client" && complete ? "POST" : "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          mode === "client" && complete
            ? { loanApplicationId, values: editableValues, complete: true }
            : body,
        ),
      },
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to save form");
    }

    if (json.data?.progress) {
      setProgress(json.data.progress);
    }

    if (json.data?.submission?.values) {
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        json.data.submission.values as Record<string, unknown>,
      )) {
        next[key] =
          value && typeof value === "object" && "value" in (value as object)
            ? (value as { value: unknown }).value
            : value;
      }
      valuesRef.current = { ...valuesRef.current, ...next };
      setValues((prev) => ({ ...prev, ...next }));
    }

    if (!silent) {
      toast.success(json.message || (complete ? "Submitted" : "Draft saved"));
    }

    return json.data;
  };

  const scheduleAutosave = () => {
    if (readOnly) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await persistValues({
          complete: false,
          silent: true,
          sourceValues: valuesRef.current,
        });
      } catch (err: any) {
        toast.error(err?.message || "Could not auto-save. Use Save draft.");
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const setFieldValue = (key: string, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      valuesRef.current = next;
      return next;
    });
    scheduleAutosave();
  };

  const applySignature = () => {
    if (!activeSigFieldId || !sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Draw your signature first");
      return;
    }
    const field = fields.find((f) => f.id === activeSigFieldId);
    if (!field) return;
    if ((field as any).editable === false) return;
    const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
    setFieldValue(field.key, dataUrl);
    setActiveSigFieldId(null);
    sigRef.current.clear();
  };

  const saveDraft = async () => {
    try {
      setSaving(true);
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      await persistValues({
        complete: false,
        sourceValues: valuesRef.current,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const sendToClient = async () => {
    if (mode !== "broker" || !submissionId) return;
    try {
      setSendingToClient(true);
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      await persistValues({
        complete: false,
        silent: true,
        sourceValues: valuesRef.current,
      });

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
      toast.success(
        json.message ||
          (effectiveSignStatus === "CLIENT_SIGNED"
            ? "Form re-opened and sent to client"
            : "Sent to client"),
      );
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to send to client");
    } finally {
      setSendingToClient(false);
    }
  };

  const submit = async () => {
    const editableFields = fields.filter((f) => (f as any).editable !== false);
    const latestValues = valuesRef.current;
    for (const field of editableFields) {
      if (!effectiveRequiredKeys.has(field.key)) continue;
      const value = latestValues[field.key];
      if (
        value == null ||
        value === "" ||
        (field.type === "checkbox" && value !== true)
      ) {
        toast.error(`${field.label} is required`);
        setPageNumber(field.page);
        return;
      }
    }

    try {
      setSubmitting(true);
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      const data = await persistValues({
        complete: true,
        sourceValues: latestValues,
      });
      onSubmitted?.();
      onClose();
      return data;
    } catch (err: any) {
      toast.error(err.message || "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (!readOnly && !loading) {
      try {
        await persistValues({
          complete: false,
          silent: true,
          sourceValues: valuesRef.current,
        });
      } catch {
        // user can reopen and save again
      }
    }
    onClose();
  };

  const renderFieldInput = (field: SignFormField & { editable?: boolean }) => {
    if (!currentPage) return null;
    const css = pdfRectToCss(field.rect, currentPage.heightPt, scale);
    const value = values[field.key];
    const editable = field.editable !== false && !readOnly;

    const commonStyle: React.CSSProperties = {
      left: css.left,
      top: css.top,
      width: Math.max(css.width, 24),
      height: Math.max(css.height, 18),
      position: "absolute",
      zIndex: 5,
      fontSize: Math.max(10, Math.min(14, css.height * 0.55)),
      pointerEvents: "auto",
      boxSizing: "border-box",
      cursor: editable ? "text" : "default",
    };

    if (!editable) {
      const display =
        field.type === "checkbox"
          ? value
            ? "✓"
            : ""
          : field.type === "signature" || field.type === "initial"
            ? typeof value === "string" && value.startsWith("data:image")
              ? null
              : ""
            : String(value ?? "");

      return (
        <div
          key={field.id}
          style={commonStyle}
          className="pointer-events-none overflow-hidden border-2 border-slate-300 bg-slate-100/90 px-1 text-slate-600"
          title={`${field.label} (read-only)`}
        >
          {typeof value === "string" && value.startsWith("data:image") ? (
            <img src={value} alt={field.label} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] leading-tight">{display}</span>
          )}
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <label
          key={field.id}
          style={commonStyle}
          className="flex cursor-pointer items-center justify-center border-2 border-sky-500 bg-sky-50/90 shadow-sm"
          title={field.label}
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setFieldValue(field.key, e.target.checked)}
          />
        </label>
      );
    }

    if (field.type === "radio") {
      return (
        <div
          key={field.id}
          style={commonStyle}
          className="flex flex-col justify-center gap-0.5 overflow-hidden border-2 border-sky-500 bg-sky-50/90 px-1 shadow-sm"
          title={field.label}
        >
          {(field.options || []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-1 text-[10px]">
              <input
                type="radio"
                name={field.key}
                checked={String(value) === opt.value}
                onChange={() => setFieldValue(field.key, opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "dropdown") {
      return (
        <select
          key={field.id}
          style={commonStyle}
          className="cursor-pointer border-2 border-sky-500 bg-white px-1 shadow-sm"
          title={field.label}
          value={String(value || "")}
          onChange={(e) => setFieldValue(field.key, e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "signature" || field.type === "initial") {
      return (
        <button
          key={field.id}
          type="button"
          style={commonStyle}
          className="cursor-pointer overflow-hidden border-2 border-dashed border-violet-500 bg-violet-50/90 shadow-sm"
          title={field.label}
          onClick={() => setActiveSigFieldId(field.id)}
        >
          {typeof value === "string" && value.startsWith("data:image") ? (
            <img src={value} alt={field.label} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-violet-700">{field.label}</span>
          )}
        </button>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          key={field.id}
          style={commonStyle}
          className="resize-none border-2 border-sky-500 bg-white px-1 py-0.5 shadow-sm"
          title={field.label}
          value={String(value || "")}
          onChange={(e) => setFieldValue(field.key, e.target.value)}
        />
      );
    }

    const inputType =
      field.type === "date"
        ? "date"
        : field.type === "email"
          ? "email"
          : "text";

    return (
      <input
        key={field.id}
        type={inputType}
        style={commonStyle}
        className="border-2 border-sky-500 bg-white/95 px-1 text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-400"
        title={field.label}
        value={String(value || "")}
        placeholder={field.placeholder || field.label || ""}
        onChange={(e) => setFieldValue(field.key, e.target.value)}
      />
    );
  };

  if (!open) return null;

  const activeSigField = fields.find((f) => f.id === activeSigFieldId);
  const isPage = layout === "page";
  const effectiveSignStatus = form?.signStatus || initialSignStatus || null;
  const formHasSignatureField = fields.some(
    (field) => field.type === "signature" || field.type === "initial",
  );
  const awaitingBrokerSend =
    mode === "broker" &&
    (effectiveSignStatus === "AWAITING_BROKER" ||
      effectiveSignStatus === "CLIENT_SIGNED");
  const canSendToClient =
    mode === "broker" &&
    !readOnly &&
    Boolean(submissionId) &&
    (effectiveSignStatus === "AWAITING_BROKER" ||
      effectiveSignStatus === "CLIENT_SIGNED");
  const showBrokerSubmit =
    mode === "broker" &&
    !readOnly &&
    effectiveSignStatus === "SENT_TO_CLIENT";
  const showClientSubmit = mode === "client" && !readOnly;
  const pageNumbers = useMemo(() => {
    const fromPages = pages.map((p) => Number(p.page)).filter((n) => n >= 1);
    if (fromPages.length) return fromPages;
    const fromFields = Array.from(
      new Set(visibleFields.map((f) => Number(f.page) || 1)),
    ).sort((a, b) => a - b);
    return fromFields.length ? fromFields : [1];
  }, [pages, visibleFields]);
  const fieldsOnCurrentPage = pageFields.length;

  const shellClass = isPage
    ? "flex h-dvh min-h-0 w-full flex-col bg-white"
    : "fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-3 md:p-6";

  const panelClass = isPage
    ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
    : "flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl";

  return (
    <div className={shellClass}>
      <div className={panelClass}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === "broker" ? "Fill & edit form" : "Fill form"}
            </h2>
            <p className="truncate text-xs text-slate-500">{documentName}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {readOnly
                ? "This form is locked after forwarding to the lender."
                : mode === "broker" && awaitingBrokerSend
                  ? "Fill any fields, save, then send to the client. Client will see your values and can edit the full form."
                  : mode === "client"
                    ? "Review values already filled in, update anything needed, then submit."
                    : "Click the blue boxes on the PDF to type. Changes autosave."}
            </p>
            {progress && (
              <p className="mt-1 text-xs text-slate-600">
                Progress: {progress.all.filled}/{progress.all.total}
                {progress.all.complete ? " · ready" : " · incomplete"}
                {visibleFields.length
                  ? ` · ${visibleFields.length} fields`
                  : ""}
                {` · page ${pageNumber}: ${fieldsOnCurrentPage} on page`}
                {readOnly ? " · view only" : " · editable"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !form || !currentPage || !templateUrl ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading form…
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
                        ? "bg-sky-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={pageNumber >= pages.length}
                onClick={() =>
                  setPageNumber((p) => Math.min(pages.length, p + 1))
                }
                className="rounded-md border bg-white p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:block" />
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
                className="rounded-md border bg-white p-1.5"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.2, s + 0.1))}
                className="rounded-md border bg-white p-1.5"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              {saving && (
                <span className="text-xs text-slate-500">Saving…</span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="flex justify-center">
                <div className="relative">
                  {pageFields.length === 0 && (
                    <div className="mb-3 max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {visibleFields.length === 0 ? (
                        <>
                          No fillable fields are mapped on this document yet.
                          Ask the lender to map fields, then reopen the form.
                        </>
                      ) : (
                        <>
                          No mapped fields on page {pageNumber}. Use the page
                          buttons above — only blue boxes on the PDF can be
                          edited.
                        </>
                      )}
                    </div>
                  )}
                  <PdfPageCanvas
                    fileUrl={templateUrl}
                    mimeType={form.templateMimeType}
                    pageNumber={pageNumber}
                    widthPt={currentPage.widthPt}
                    heightPt={currentPage.heightPt}
                    scale={scale}
                    authHeaders={getAuthHeaders()}
                  >
                    {pageFields.map((field) => renderFieldInput(field as any))}
                  </PdfPageCanvas>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-white px-4 py-3">
          {readOnly ? (
            <p className="mr-auto text-xs text-slate-500">
              View only — form already forwarded to lender.
            </p>
          ) : mode === "broker" && awaitingBrokerSend ? (
            <p className="mr-auto text-xs text-slate-500">
              Save your draft, then send to client. They can edit every field.
            </p>
          ) : mode === "client" ? (
            <p className="mr-auto text-xs text-slate-500">
              Broker-filled values are shown below — you can change any field.
            </p>
          ) : (
            <p className="mr-auto text-xs text-slate-500">
              Blue boxes on the PDF are editable. Save anytime.
            </p>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving || submitting || sendingToClient || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save draft
            </button>
          )}
          {canSendToClient && (
            <button
              type="button"
              onClick={sendToClient}
              disabled={saving || submitting || sendingToClient || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {sendingToClient ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="h-4 w-4" />
              )}
              Send to client
            </button>
          )}
          {(showBrokerSubmit || showClientSubmit) && (
            <button
              type="button"
              onClick={submit}
              disabled={saving || submitting || sendingToClient || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {formHasSignatureField ? "Submit signed form" : "Submit form"}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      {activeSigField && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              {activeSigField.label}
            </h3>
            <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
              <SigCanvas
                ref={sigRef}
                penColor="#111827"
                canvasProps={{
                  width: 520,
                  height: 160,
                  className: "w-full touch-none",
                }}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => {
                  sigRef.current?.clear();
                  setActiveSigFieldId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => sigRef.current?.clear()}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white"
                onClick={applySignature}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
