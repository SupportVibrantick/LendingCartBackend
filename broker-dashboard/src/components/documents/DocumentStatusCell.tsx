import { Check, Circle, Minus } from "lucide-react";
import {
  getDocumentStatusSummary,
  type DocumentDisplayRow,
  type DocumentStatusSummaryItem,
  type DocumentStatusViewerPortal,
} from "../../lib/documentLenderSend";

type Props = {
  doc: DocumentDisplayRow;
  /** Kept for callers; upload row always shows when/if uploaded. */
  hideUploadChip?: boolean;
  viewerPortal?: DocumentStatusViewerPortal;
};

type TrackState = "done" | "pending" | "partial" | "muted" | "alert";

type TrackRow = {
  key: string;
  label: string;
  value: string;
  title?: string;
  state: TrackState;
};

const stateStyles: Record<TrackState, { dot: string; value: string }> = {
  done: {
    dot: "bg-emerald-500",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  pending: {
    dot: "bg-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  partial: {
    dot: "bg-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  muted: {
    dot: "bg-slate-300 dark:bg-slate-600",
    value: "text-slate-500 dark:text-slate-400",
  },
  alert: {
    dot: "bg-rose-500",
    value: "text-rose-700 dark:text-rose-300",
  },
};

function findItem(
  items: DocumentStatusSummaryItem[],
  key: string,
): DocumentStatusSummaryItem | undefined {
  return items.find((item) => item.key === key);
}

function detailDate(detail?: string | null): string | null {
  if (!detail) return null;
  const parts = detail
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return /\d/.test(detail) ? detail.trim() : null;
  }
  return parts[parts.length - 1] || null;
}

function buildLenderRow(
  item: DocumentStatusSummaryItem,
  uploadedCount: number,
): TrackRow {
  const ratioMatch = item.label.match(/^(\d+) of (\d+) sent$/);
  const date = detailDate(item.detail);
  const pendingHint =
    item.detail?.match(/(\d+)\s+(?:pending|new not sent)/i)?.[1] || null;

  if (ratioMatch) {
    const sent = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);
    const pending = Math.max(0, total - sent);

    if (sent === 0) {
      return {
        key: "lender",
        label: "Lender",
        value: `0/${total} sent`,
        title: `${total} file${total === 1 ? "" : "s"} not sent to lender yet`,
        state: "pending",
      };
    }

    if (pending > 0) {
      return {
        key: "lender",
        label: "Lender",
        value: `${sent}/${total} · ${pending} new`,
        title:
          item.detail ||
          `${sent} of ${total} files sent · ${pending} newer file${
            pending === 1 ? "" : "s"
          } not sent yet`,
        state: "partial",
      };
    }

    return {
      key: "lender",
      label: "Lender",
      value: date || `All ${total} sent`,
      title: item.detail || `All ${total} files sent to lender`,
      state: "done",
    };
  }

  if (item.tone === "success") {
    return {
      key: "lender",
      label: "Lender",
      value: date || "Sent",
      title: item.detail || "Sent to lender",
      state: "done",
    };
  }

  if (uploadedCount > 0) {
    return {
      key: "lender",
      label: "Lender",
      value: pendingHint
        ? `0/${uploadedCount} sent`
        : `0/${uploadedCount} sent`,
      title: item.detail || "Not sent to lender",
      state: "pending",
    };
  }

  return {
    key: "lender",
    label: "Lender",
    value: "—",
    title: "Upload required before sending to lender",
    state: "muted",
  };
}

function buildClientRow(item: DocumentStatusSummaryItem): TrackRow {
  if (
    item.label === "On client portal" ||
    item.label === "Sent to client" ||
    item.tone === "info"
  ) {
    return {
      key: "client",
      label: "Client",
      value: item.detail || "Sent",
      title: item.detail
        ? `On client portal since ${item.detail}`
        : "On client portal — new uploads on this request stay visible there",
      state: "done",
    };
  }

  if (item.label === "Broker only") {
    return {
      key: "client",
      label: "Client",
      value: "Broker only",
      title: "Not on client portal",
      state: "muted",
    };
  }

  return {
    key: "client",
    label: "Client",
    value: "Not sent",
    title: "Not sent to client",
    state: "pending",
  };
}

function buildTrackRows(
  doc: DocumentDisplayRow,
  items: DocumentStatusSummaryItem[],
  viewerPortal?: DocumentStatusViewerPortal,
): TrackRow[] {
  const rows: TrackRow[] = [];
  const uploadedCount = Number(doc.uploadedCount) || 0;
  const uploadItem = findItem(items, "upload");
  const lenderItem = findItem(items, "lender");
  const clientItem = findItem(items, "client");
  const brokerItem = findItem(items, "broker");
  const isCoBrokerPb =
    viewerPortal === "coBroker" && doc.source === "SUB_BROKER_ADDED";

  if (uploadedCount > 0) {
    rows.push({
      key: "upload",
      label: "Uploaded",
      value: uploadItem?.detail || "Yes",
      title:
        uploadedCount === 1
          ? `Uploaded 1 file${uploadItem?.detail ? ` · ${uploadItem.detail}` : ""}`
          : `Uploaded ${uploadedCount} files${uploadItem?.detail ? ` · ${uploadItem.detail}` : ""}`,
      state: "done",
    });
  } else {
    rows.push({
      key: "upload",
      label: "Uploaded",
      value: "Not yet",
      title: "Awaiting upload",
      state: "muted",
    });
  }

  if (isCoBrokerPb && brokerItem) {
    const state: TrackState =
      brokerItem.tone === "success"
        ? "done"
        : brokerItem.tone === "warning"
          ? "pending"
          : brokerItem.tone === "info"
            ? "partial"
            : "muted";
    rows.push({
      key: "broker",
      label: "To PB",
      value: brokerItem.label,
      title: [brokerItem.label, brokerItem.detail].filter(Boolean).join(" · "),
      state,
    });
  } else if (lenderItem) {
    rows.push(buildLenderRow(lenderItem, uploadedCount));
  } else if (!isCoBrokerPb) {
    rows.push({
      key: "lender",
      label: "Lender",
      value: uploadedCount > 0 ? `0/${uploadedCount} sent` : "—",
      title:
        uploadedCount > 0
          ? "Not sent to lender"
          : "Upload required before sending to lender",
      state: uploadedCount > 0 ? "pending" : "muted",
    });
  }

  if (clientItem) {
    rows.push(buildClientRow(clientItem));
  }

  return rows;
}

function StateGlyph({ state }: { state: TrackState }) {
  if (state === "done") {
    return <Check size={10} strokeWidth={3} className="text-white" />;
  }
  if (state === "pending" || state === "partial") {
    return <Circle size={6} className="fill-white text-white" />;
  }
  return <Minus size={10} strokeWidth={3} className="text-white/90" />;
}

export default function DocumentStatusCell({ doc, viewerPortal }: Props) {
  const summary = getDocumentStatusSummary(doc, { viewerPortal });
  const isSkipped = doc.status === "SKIPPED";

  if (isSkipped) {
    return (
      <div className="min-w-0">
        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Skipped
        </span>
        {typeof doc.skipReason === "string" && doc.skipReason.trim() ? (
          <p
            className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400"
            title={doc.skipReason}
          >
            {doc.skipReason}
          </p>
        ) : null}
      </div>
    );
  }

  const rows = buildTrackRows(doc, summary.items, viewerPortal);

  return (
    <div className="min-w-[220px] space-y-1.5">
      {rows.map((row) => {
        const styles = stateStyles[row.state];

        return (
          <div
            key={row.key}
            title={row.title}
            className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${styles.dot}`}
              >
                <StateGlyph state={row.state} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {row.label}
              </span>
            </div>
            <span className={`truncate text-[11px] font-medium ${styles.value}`}>
              {row.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
