import type { BrokerStats } from "../../lib/brokerDashboardStats";
import DashboardWidget from "./DashboardWidget";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onStageClick?: (statusKey: string) => void;
}

const FUNNEL_STAGES = [
  { key: "DRAFT", label: "Draft", color: "#94A3B8" },
  { key: "INCOMPLETE", label: "Incomplete", color: "#F5B942" },
  { key: "CLIENT_PENDING", label: "Client Pending", color: "#FB923C" },
  { key: "SUBMITTED", label: "Submitted", color: "#38BDF8" },
  { key: "IN_REVIEW", label: "In Review", color: "#818CF8" },
  { key: "LENDER_APPROVED", label: "Approved", color: "#34D399" },
  { key: "FUNDED", label: "Funded", color: "#0EA5E9" },
] as const;

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  return `${Math.max(0, value).toFixed(2)}%`;
}

export default function ConversionFunnelChart({
  stats,
  loading,
  onStageClick,
}: Props) {
  const rows = FUNNEL_STAGES.map((stage) => ({
    ...stage,
    count: Number(stats?.applicationsByStatus?.[stage.key] || 0),
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  const computed = rows.map((row, index) => {
    const remaining = rows.slice(index).reduce((sum, item) => sum + item.count, 0);
    const nextCount = rows[index + 1]?.count ?? 0;
    const isLast = index === rows.length - 1;
    const cumulative =
      total > 0 ? (remaining / total) * 100 : isLast ? 0 : 100;
    const nextStep = isLast
      ? 0
      : row.count <= 0
        ? 100
        : (nextCount / row.count) * 100;
    return { ...row, cumulative, nextStep };
  });

  return (
    <DashboardWidget title="Funnel" subtitle="This period" loading={loading}>
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-5" />
          {computed.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => onStageClick?.(row.key)}
              className="flex h-10 w-full items-center justify-between rounded-xl px-3.5 text-left text-[13px] font-semibold text-white shadow-[0_6px_14px_rgba(15,23,42,0.12)] transition hover:brightness-95"
              style={{ backgroundColor: row.color }}
            >
              <span className="truncate">{row.label}</span>
              <span className="tabular-nums">{row.count}</span>
            </button>
          ))}
        </div>

        <div className="hidden w-[76px] shrink-0 flex-col sm:flex sm:w-[88px]">
          <p className="mb-1.5 h-5 text-center text-[10px] font-medium leading-tight text-[#9aa0a6]">
            Cumulative
          </p>
          {computed.map((row) => (
            <div
              key={`${row.key}-cum`}
              className="mb-1.5 flex h-10 items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-gray-800 dark:text-gray-300"
              style={{
                clipPath: "polygon(0 0, 100% 0, 86% 100%, 14% 100%)",
              }}
            >
              {formatPct(row.cumulative)}
            </div>
          ))}
        </div>

        <div className="hidden w-[84px] shrink-0 flex-col sm:flex sm:w-[96px]">
          <p className="mb-1.5 h-5 text-center text-[10px] font-medium leading-tight text-[#9aa0a6]">
            Next step conversion
          </p>
          {computed.map((row) => (
            <div
              key={`${row.key}-next`}
              className="mb-1.5 flex h-10 items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-gray-800 dark:text-gray-300"
              style={{
                clipPath: "polygon(0 0, 100% 0, 86% 100%, 14% 100%)",
              }}
            >
              {formatPct(row.nextStep)}
            </div>
          ))}
        </div>
      </div>
    </DashboardWidget>
  );
}
