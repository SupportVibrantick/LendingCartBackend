import type { BrokerStats } from "../../lib/brokerDashboardStats";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onStageClick?: (statusKey: string) => void;
}

const PIPELINE_STAGES = [
  { key: "DRAFT", label: "Draft", color: "bg-slate-400", soft: "bg-slate-50 text-slate-700" },
  { key: "INCOMPLETE", label: "Incomplete", color: "bg-amber-400", soft: "bg-amber-50 text-amber-700" },
  { key: "CLIENT_PENDING", label: "Client Pending", color: "bg-orange-400", soft: "bg-orange-50 text-orange-700" },
  { key: "SUBMITTED", label: "Submitted", color: "bg-sky-500", soft: "bg-sky-50 text-sky-700" },
  { key: "IN_REVIEW", label: "In Review", color: "bg-indigo-500", soft: "bg-indigo-50 text-indigo-700" },
  { key: "LENDER_APPROVED", label: "Approved", color: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700" },
  { key: "LENDER_DECLINED", label: "Declined", color: "bg-rose-500", soft: "bg-rose-50 text-rose-700" },
  { key: "FUNDED", label: "Funded", color: "bg-teal-600", soft: "bg-teal-50 text-teal-700" },
] as const;

export default function ApplicationPipeline({
  stats,
  loading,
  onStageClick,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-[10px] border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const stages = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: Number(stats.applicationsByStatus?.[stage.key] || 0),
  }));
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div className="rounded-[10px] border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1f2328] dark:text-white">
            Application Pipeline
          </h3>
          <p className="text-[12px] text-[#9aa0a6]">Stage distribution</p>
        </div>
        <span className="rounded-full bg-[#f3f5f7] px-2.5 py-1 text-xs font-medium text-[#6b7280] dark:bg-gray-800 dark:text-gray-300">
          {total} total
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {stages.map((stage, index) => (
          <button
            key={stage.key}
            type="button"
            onClick={() => onStageClick?.(stage.key)}
            className={`relative rounded-lg border border-gray-100 p-3 text-left transition hover:border-[#13538A]/25 hover:shadow-sm dark:border-gray-800 ${stage.soft}`}
          >
            {index < stages.length - 1 ? (
              <span className="pointer-events-none absolute -right-1 top-1/2 z-10 hidden h-2 w-2 -translate-y-1/2 rotate-45 border-r border-t border-gray-200 bg-inherit xl:block dark:border-gray-700" />
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              {stage.label}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stage.count}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/70 dark:bg-gray-900/40">
              <div
                className={`h-full rounded-full ${stage.color}`}
                style={{
                  width: total
                    ? `${Math.max(8, (stage.count / total) * 100)}%`
                    : "0%",
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
