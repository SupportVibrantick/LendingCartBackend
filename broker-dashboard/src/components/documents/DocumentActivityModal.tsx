import { Clock3, FileText, SendHorizonal, Upload, X } from "lucide-react";
import {
  buildDocumentActivitySummary,
  formatDocumentTimelineDate,
  type DocumentDisplayRow,
} from "../../lib/documentLenderSend";

type Props = {
  doc: DocumentDisplayRow | null;
  onClose: () => void;
};

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: "blue" | "emerald" | "amber" | "violet";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-100 bg-emerald-50/80 text-emerald-800"
      : accent === "amber"
        ? "border-amber-100 bg-amber-50/80 text-amber-800"
        : accent === "violet"
          ? "border-violet-100 bg-violet-50/80 text-violet-800"
          : "border-blue-100 bg-blue-50/80 text-blue-800";

  return (
    <div className={`rounded-xl border p-4 ${accentClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-80">{hint}</p>}
    </div>
  );
}

export default function DocumentActivityModal({ doc, onClose }: Props) {
  if (!doc) return null;

  const activity = buildDocumentActivitySummary(doc);

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-activity-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Current Activities
            </p>
            <h3
              id="document-activity-title"
              className="truncate text-lg font-bold text-slate-900 dark:text-white"
            >
              {activity.documentName}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload and send timeline for this document
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Client Uploads"
              value={`${activity.clientUploadCount} uploaded`}
              hint={
                activity.clientUploadPending
                  ? "1 upload pending from client"
                  : activity.awaitingClientForward
                    ? "Not sent to client yet"
                    : activity.clientUploadCount === 0
                      ? "No client uploads yet"
                      : "All uploaded files listed below"
              }
              accent={
                activity.clientUploadPending
                  ? "amber"
                  : activity.clientUploadCount > 0
                    ? "emerald"
                    : "blue"
              }
            />
            <SummaryCard
              label="Sent to Lenders"
              value={`${activity.totalLenderSentCount} sent`}
              hint={`${activity.totalLenderPendingCount} file${
                activity.totalLenderPendingCount === 1 ? "" : "s"
              } pending to send`}
              accent={
                activity.totalLenderPendingCount > 0 ? "amber" : "emerald"
              }
            />
          </div>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Upload size={16} className="text-blue-600" />
              Client Upload Activity
            </div>

            {activity.isForwardedToClient && (
              <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                Sent to client portal
                {activity.sentToClientAt
                  ? ` · ${formatDocumentTimelineDate(activity.sentToClientAt)}`
                  : ""}
              </p>
            )}

            {activity.awaitingClientForward && (
              <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                This document has not been forwarded to the client portal yet.
              </p>
            )}

            {activity.clientUploads.length > 0 ? (
              <div className="space-y-2">
                {activity.clientUploads.map((upload) => (
                  <div
                    key={upload.uploadId || upload.fileName}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className="flex items-start gap-2">
                      <FileText
                        size={15}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {upload.fileName || "Uploaded file"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Uploaded{" "}
                          {formatDocumentTimelineDate(upload.uploadedAt) ||
                            "date unavailable"}
                        </p>
                        {(upload.sentToLenders?.length ?? 0) > 0 ? (
                          <div className="mt-2 space-y-1">
                            {upload.sentToLenders?.map((entry, index) => (
                              <p
                                key={`${upload.uploadId}-lender-${index}`}
                                className="text-[11px] text-emerald-700"
                              >
                                Sent to {entry.lenderName || "lender"}
                                {entry.sentAt
                                  ? ` · ${formatDocumentTimelineDate(entry.sentAt)}`
                                  : ""}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-amber-700">
                            Not sent to any lender yet
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {activity.clientUploadPending
                  ? "Waiting for the client to upload this document."
                  : "No client uploads recorded for this document."}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <SendHorizonal size={16} className="text-emerald-600" />
              Lender Send Activity
            </div>

            {activity.lenderActivities.length > 0 ? (
              <div className="space-y-2">
                {activity.lenderActivities.map((entry) => (
                  <div
                    key={entry.lenderName}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {entry.lenderName}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          entry.isFullySent
                            ? "bg-emerald-100 text-emerald-700"
                            : entry.sentCount > 0
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {entry.isFullySent
                          ? "Fully sent"
                          : entry.sentCount > 0
                            ? "Partially sent"
                            : "Not sent"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {entry.sentCount} of {entry.uploadedCount} file
                      {entry.uploadedCount === 1 ? "" : "s"} sent ·{" "}
                      {entry.pendingCount} pending
                    </p>
                    {entry.sentAt && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock3 size={12} />
                        Last sent{" "}
                        {formatDocumentTimelineDate(entry.sentAt) ||
                          "date unavailable"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No lender send activity recorded for this document yet.
              </p>
            )}
          </section>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
