import { ExternalLink, FileText, MousePointer2, X } from "lucide-react";

type MakeFillablePdfHelpProps = {
  open: boolean;
  onClose: () => void;
  onOpenMapper?: () => void;
  showMapperCta?: boolean;
};

/**
 * Guides brokers to convert a flat PDF into a fillable AcroForm PDF
 * (PDF24 recommended) before uploading — or map fields in-app.
 */
export default function MakeFillablePdfHelp({
  open,
  onClose,
  onOpenMapper,
  showMapperCta = false,
}: MakeFillablePdfHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="make-fillable-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2
              id="make-fillable-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Make a PDF fillable
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Flat / scanned PDFs are not editable in-browser until they have
              form fields (or you map them here).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
          <div className="rounded-xl border border-teal-100 bg-teal-50/80 p-3 dark:border-teal-900 dark:bg-teal-950/40">
            <p className="text-xs font-semibold text-teal-900 dark:text-teal-200">
              Recommended free tool: PDF24 Form Editor
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-teal-900/90 dark:text-teal-100/90">
              <li>Open your SBA / loan PDF in PDF24 Form Editor</li>
              <li>
                Add Text, Checkbox, Radio (Yes/No), Date, and Signature
                fields on each page
              </li>
              <li>Save as a fillable PDF (do not flatten)</li>
              <li>Upload that fillable PDF here — fields auto-detect</li>
            </ol>
            <a
              href="https://tools.pdf24.org/en/create-pdf-form"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 underline hover:text-teal-950 dark:text-teal-200"
            >
              Open PDF24 tools
              <ExternalLink size={12} />
            </a>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Other free options
            </p>
            <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex gap-2">
                <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    Sejda Create Fillable PDF
                  </span>{" "}
                  — easy online editor; free plan has file/page limits.
                </span>
              </li>
              <li className="flex gap-2">
                <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    LibreOffice
                  </span>{" "}
                  — offline; export with “Create PDF form”. Harder for complex
                  multi-page SBA layouts.
                </span>
              </li>
            </ul>
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Fillable ≠ fully editable.
            </span>{" "}
            The form design stays locked; users only type/check/sign in the
            fields you placed — ideal for Broker → Client → Lender.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {showMapperCta && onOpenMapper ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMapper();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
            >
              <MousePointer2 size={16} />
              Map fields in Loan Automation
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
