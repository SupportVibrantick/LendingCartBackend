import {
  Building2,
  Check,
  Circle,
  Clock3,
  FileText,
  SendHorizonal,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  buildDocumentActivitySummary,
  formatDocumentTimelineDate,
  getDocumentRequestDisplay,
  getDocumentSourceDisplay,
  type DocumentDisplayRow,
} from "../../lib/documentLenderSend";

type Props = {
  doc: DocumentDisplayRow | null;
  onClose: () => void;
};

type StepState = "done" | "current" | "pending" | "blocked";

function StepDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#4C78F5] text-white">
        <Circle size={8} className="fill-white text-white" />
      </span>
    );
  }
  if (state === "blocked") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200">
        <Circle size={8} className="fill-amber-500 text-amber-500" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
      <Circle size={8} className="fill-slate-300 text-slate-300" />
    </span>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "warning" | "brand";
  children: ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : tone === "brand"
          ? "bg-[#4C78F5]/10 text-[#4C78F5]"
          : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function ProgressBar({
  value,
  max,
  tone = "brand",
}: {
  value: number;
  max: number;
  tone?: "brand" | "emerald" | "amber";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-[#4C78F5]";

  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className={`h-full rounded-full transition-all ${bar}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function DocumentActivityModal({ doc, onClose }: Props) {
  if (!doc) return null;

  const activity = buildDocumentActivitySummary(doc);
  const requestDisplay = getDocumentRequestDisplay(doc);
  const sourceDisplay = getDocumentSourceDisplay(doc, {
    brokerSourceLabel: "Broker",
    subBrokerSourceLabel: "Co-Broker",
  });

  const hasUploads = activity.clientUploadCount > 0;
  const hasAnyLenderSent = activity.totalLenderSentCount > 0;
  const hasPendingLender = activity.totalLenderPendingCount > 0;

  const steps: Array<{
    key: string;
    label: string;
    detail: string;
    state: StepState;
  }> = [
    {
      key: "requested",
      label: "Requested",
      detail: requestDisplay?.date
        ? `Asked ${requestDisplay.date}`
        : requestDisplay?.label || "Document was requested",
      state: "done",
    },
    {
      key: "client",
      label: "Client portal",
      detail: activity.isForwardedToClient
        ? activity.sentToClientAt
          ? `Shared ${formatDocumentTimelineDate(activity.sentToClientAt)}`
          : "Visible on client portal"
        : activity.awaitingClientForward
          ? "Not shared with client yet"
          : "Broker-managed (no client share needed)",
      state: activity.isForwardedToClient
        ? "done"
        : activity.awaitingClientForward
          ? "current"
          : "pending",
    },
    {
      key: "upload",
      label: "Upload",
      detail: hasUploads
        ? `${activity.clientUploadCount} file${
            activity.clientUploadCount === 1 ? "" : "s"
          } on file`
        : activity.clientUploadPending
          ? "Waiting for client to upload"
          : "No files uploaded yet",
      state: hasUploads
        ? "done"
        : activity.clientUploadPending || activity.awaitingClientForward
          ? "current"
          : "blocked",
    },
    {
      key: "lender",
      label: "Send to lender",
      detail: !hasUploads
        ? "Upload a file before sending"
        : hasAnyLenderSent && !hasPendingLender
          ? "All uploaded files sent"
          : hasAnyLenderSent
            ? `${activity.totalLenderSentCount} sent · ${activity.totalLenderPendingCount} still pending`
            : `${activity.totalLenderPendingCount || activity.clientUploadCount} file${
                (activity.totalLenderPendingCount ||
                  activity.clientUploadCount) === 1
                  ? ""
                  : "s"
              } ready to send`,
      state: !hasUploads
        ? "pending"
        : hasAnyLenderSent && !hasPendingLender
          ? "done"
          : "current",
    },
  ];

  const nextStep = steps.find((step) => step.state === "current" || step.state === "blocked");

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-activity-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
              Current activities
            </p>
            <h3
              id="document-activity-title"
              className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white"
            >
              {activity.documentName}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {doc.isRequired ? (
                <StatusPill tone="warning">Required</StatusPill>
              ) : (
                <StatusPill tone="neutral">Optional</StatusPill>
              )}
              <StatusPill tone="brand">{sourceDisplay.label}</StatusPill>
              {requestDisplay?.date ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock3 size={12} />
                  Requested {requestDisplay.date}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Progress
            </p>
            <ol className="space-y-0">
              {steps.map((step, index) => (
                <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute top-6 left-3 h-[calc(100%-1.25rem)] w-px bg-slate-200 dark:bg-slate-700"
                    />
                  ) : null}
                  <StepDot state={step.state} />
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {nextStep ? (
              <div className="mt-1 rounded-lg border border-[#4C78F5]/20 bg-[#4C78F5]/[0.06] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4C78F5]">
                  Next step
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
                  {nextStep.label}: {nextStep.detail}
                </p>
              </div>
            ) : null}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#4C78F5]/10 text-[#4C78F5]">
                  <UserRound size={14} />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Client side
                </p>
              </div>
              <p className="mt-3 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                {activity.clientUploadCount}
                <span className="ml-1 text-sm font-semibold text-slate-400">
                  uploaded
                </span>
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                {activity.awaitingClientForward
                  ? "Share this request to the client portal so they can upload."
                  : activity.clientUploadPending
                    ? "Client can see this request — waiting for their upload."
                    : hasUploads
                      ? "Files below are available to send to lenders."
                      : "No uploads yet. Broker or client can add files."}
              </p>
              <ProgressBar
                value={hasUploads ? 1 : 0}
                max={1}
                tone={hasUploads ? "emerald" : "brand"}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                  <Building2 size={14} />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Lender side
                </p>
              </div>
              <p className="mt-3 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                {activity.totalLenderSentCount}
                <span className="ml-1 text-sm font-semibold text-slate-400">
                  sent
                </span>
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                {!hasUploads
                  ? "Nothing to send until a file is uploaded."
                  : hasPendingLender
                    ? `${activity.totalLenderPendingCount} file${
                        activity.totalLenderPendingCount === 1 ? "" : "s"
                      } still need to be sent to lender.`
                    : "All uploaded files have been sent to lender(s)."}
              </p>
              <ProgressBar
                value={activity.totalLenderSentCount}
                max={Math.max(
                  activity.totalLenderSentCount +
                    activity.totalLenderPendingCount,
                  activity.clientUploadCount,
                  1,
                )}
                tone={
                  hasPendingLender
                    ? "amber"
                    : hasAnyLenderSent
                      ? "emerald"
                      : "brand"
                }
              />
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <Upload size={15} className="text-[#4C78F5]" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                  Uploaded files
                </p>
                <p className="text-[11px] text-slate-500">
                  Each file and whether it reached a lender
                </p>
              </div>
              <StatusPill tone={hasUploads ? "success" : "neutral"}>
                {activity.clientUploadCount} file
                {activity.clientUploadCount === 1 ? "" : "s"}
              </StatusPill>
            </div>

            <div className="p-4">
              {activity.awaitingClientForward ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                    Not on the client portal yet
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Use Send to Client from the documents table when you want
                    the borrower to upload this.
                  </p>
                </div>
              ) : null}

              {activity.clientUploads.length > 0 ? (
                <div
                  className={`space-y-2 ${activity.awaitingClientForward ? "mt-3" : ""}`}
                >
                  {activity.clientUploads.map((upload) => {
                    const notSentToLender =
                      (upload.sentToLenders?.length ?? 0) === 0;

                    return (
                      <div
                        key={upload.uploadId || upload.fileName}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
                            <FileText size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                                {upload.fileName || "Uploaded file"}
                              </p>
                              <StatusPill
                                tone={notSentToLender ? "warning" : "success"}
                              >
                                {notSentToLender
                                  ? "Not sent to lender"
                                  : "Sent to lender"}
                              </StatusPill>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Uploaded{" "}
                              {formatDocumentTimelineDate(upload.uploadedAt) ||
                                "date unavailable"}
                            </p>
                            {(upload.sentToLenders?.length ?? 0) > 0 ? (
                              <div className="mt-2 space-y-1">
                                {upload.sentToLenders?.map((entry, index) => (
                                  <p
                                    key={`${upload.uploadId}-lender-${index}`}
                                    className="flex items-center gap-1.5 text-[11px] text-emerald-700"
                                  >
                                    <SendHorizonal size={11} />
                                    Sent to {entry.lenderName || "lender"}
                                    {entry.sentAt
                                      ? ` · ${formatDocumentTimelineDate(entry.sentAt)}`
                                      : ""}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[11px] text-amber-700">
                                Select this document and choose a lender to send
                                it.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center dark:border-slate-700">
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    {activity.clientUploadPending
                      ? "Waiting for client upload"
                      : "No files uploaded yet"}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {activity.clientUploadPending
                      ? "The borrower can upload from their portal once they receive this request."
                      : "Upload from the row actions menu, or forward to the client first."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <SendHorizonal size={15} className="text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                  Lender delivery
                </p>
                <p className="text-[11px] text-slate-500">
                  Who has received this document so far
                </p>
              </div>
            </div>

            <div className="p-4">
              {activity.lenderActivities.length > 0 ? (
                <div className="space-y-2">
                  {activity.lenderActivities.map((entry) => {
                    const total = Math.max(entry.uploadedCount, 0);
                    const sent = Math.max(entry.sentCount, 0);
                    const pending = Math.max(entry.pendingCount, 0);

                    return (
                      <div
                        key={entry.lenderName}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                              <Building2 size={14} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                                {entry.lenderName}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {total === 0
                                  ? "No files available to send yet"
                                  : `${sent} of ${total} file${
                                      total === 1 ? "" : "s"
                                    } delivered`}
                                {pending > 0 ? ` · ${pending} pending` : ""}
                              </p>
                            </div>
                          </div>
                          <StatusPill
                            tone={
                              entry.isFullySent
                                ? "success"
                                : sent > 0
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {entry.isFullySent
                              ? "Fully sent"
                              : sent > 0
                                ? "Partially sent"
                                : "Not sent"}
                          </StatusPill>
                        </div>
                        <ProgressBar
                          value={sent}
                          max={Math.max(total, 1)}
                          tone={
                            entry.isFullySent
                              ? "emerald"
                              : sent > 0
                                ? "amber"
                                : "brand"
                          }
                        />
                        {entry.sentAt ? (
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock3 size={12} />
                            Last sent{" "}
                            {formatDocumentTimelineDate(entry.sentAt) ||
                              "date unavailable"}
                          </p>
                        ) : total > 0 ? (
                          <p className="mt-2 text-[11px] text-slate-500">
                            Select this document, pick this lender, then send.
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] text-slate-500">
                            Upload a file first — then you can deliver it here.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center dark:border-slate-700">
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    No lender linked yet
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Once a lender requests this document or you choose
                    recipients, delivery status will show here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#4C78F5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3B66E0]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
