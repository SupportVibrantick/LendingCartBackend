import {
  Circle,
  Clock3,
  SendHorizonal,
  Upload,
  UserRound,
} from "lucide-react";
import {
  getDocumentStatusSummary,
  type DocumentDisplayRow,
} from "../../lib/documentLenderSend";
import {
  formatDocumentStatusLabel,
  getDocumentStatusChipClass,
} from "../../lib/documentStatus";

type Props = {
  doc: DocumentDisplayRow;
};

const chipToneClass: Record<string, string> = {
  success:
    "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  warning:
    "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  info: "border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300",
  muted:
    "border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
  neutral:
    "border-orange-200/80 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300",
};

const chipIconClass: Record<string, string> = {
  success: "text-emerald-600",
  warning: "text-amber-600",
  info: "text-indigo-600",
  muted: "text-slate-400",
  neutral: "text-orange-500",
};

function StatusItemIcon({
  itemKey,
  tone,
}: {
  itemKey: string;
  tone: string;
}) {
  const className = `shrink-0 ${chipIconClass[tone] || chipIconClass.muted}`;

  if (itemKey === "upload") return <Upload size={10} className={className} />;
  if (itemKey === "client") return <UserRound size={10} className={className} />;
  return <SendHorizonal size={10} className={className} />;
}

function getCompactChipLabel(itemKey: string, label: string) {
  if (itemKey === "lender") {
    if (label.startsWith("Not sent")) return "Lender pending";
    const match = label.match(/^(\d+) of (\d+) sent$/);
    if (match) return `Lender ${match[1]}/${match[2]}`;
  }

  if (itemKey === "client") {
    if (label === "On client portal") return "On portal";
    if (label === "Broker only") return "Broker only";
    if (label === "Not sent to client") return "Client pending";
  }

  if (itemKey === "upload") {
    if (label === "Awaiting upload") return "No upload";
    const match = label.match(/^(\d+) files? uploaded$/);
    if (match) return `${match[1]} file${match[1] === "1" ? "" : "s"}`;
  }

  return label;
}

export default function DocumentStatusCell({ doc }: Props) {
  const summary = getDocumentStatusSummary(doc);
  const isSkipped = doc.status === "SKIPPED";

  return (
    <div className="flex min-w-[200px] flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${getDocumentStatusChipClass(
            doc.status ?? "",
          )}`}
        >
          {summary.statusDate && !isSkipped ? (
            <Clock3 size={10} className="opacity-70" />
          ) : (
            <Circle size={6} className="fill-current opacity-70" />
          )}
          {formatDocumentStatusLabel(summary.statusLabel)}
        </span>
        {summary.statusDate && !isSkipped && (
          <span className="text-[10px] text-slate-400">{summary.statusDate}</span>
        )}
      </div>

      {!isSkipped && summary.items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.items.map((item) => (
            <span
              key={item.key}
              title={[item.label, item.detail].filter(Boolean).join(" · ")}
              className={`inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                chipToneClass[item.tone] || chipToneClass.muted
              }`}
            >
              <StatusItemIcon itemKey={item.key} tone={item.tone} />
              <span className="truncate">
                {getCompactChipLabel(item.key, item.label)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
