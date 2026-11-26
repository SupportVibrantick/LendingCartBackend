import {
  formatChangePercent,
  formatCompactCount,
  formatCompactCurrency,
  type BrokerMetricKey,
  type BrokerStats,
  type MetricComparison,
} from "../../lib/brokerDashboardStats";
import {
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  FilePenLine,
  FileText,
  Landmark,
  Send,
} from "lucide-react";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onStatClick?: (key: string) => void;
  /** Tailwind grid classes. Default matches broker home strip. */
  gridClassName?: string;
}

const DEFAULT_GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7";

const KPI_CONFIG = [
  {
    key: "totalApplications",
    label: "Applications",
    icon: FileText,
    iconWrap: "bg-brand-50 text-brand-600",
  },
  {
    key: "totalSubmitted",
    label: "Submitted",
    icon: Send,
    iconWrap: "bg-sky-50 text-sky-600",
  },
  {
    key: "totalIncomplete",
    label: "Incomplete",
    icon: FilePenLine,
    iconWrap: "bg-amber-50 text-amber-600",
  },
  {
    key: "totalInReview",
    label: "In Review",
    icon: Clock3,
    iconWrap: "bg-indigo-50 text-indigo-600",
  },
  {
    key: "totalApproved",
    label: "Approved",
    icon: CheckCircle2,
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "totalFunded",
    label: "Funded",
    icon: Landmark,
    iconWrap: "bg-teal-50 text-teal-700",
  },
  {
    key: "totalVolumeFunded",
    label: "Funded Volume",
    icon: BadgeDollarSign,
    iconWrap: "bg-violet-50 text-violet-600",
    isCurrency: true,
  },
] as const;

function shouldShowComparison(comparison?: MetricComparison) {
  if (!comparison) return false;
  if (comparison.changePercent === null || comparison.changePercent === undefined) {
    return false;
  }
  if (comparison.previous > 0 && comparison.previous < 3 && comparison.current === 0) {
    return false;
  }
  return true;
}

function ComparisonBadge({ comparison }: { comparison?: MetricComparison }) {
  if (!shouldShowComparison(comparison)) return null;
  const label = formatChangePercent(comparison?.changePercent);
  if (!label) return null;

  const value = comparison?.changePercent ?? 0;
  const positive = value > 0;
  const negative = value < 0;

  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : negative
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-100 text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="h-3 w-20 rounded bg-surface dark:bg-slate-800" />
            <div className="h-7 w-14 rounded bg-surface dark:bg-slate-800" />
          </div>
          <div className="h-10 w-10 rounded-xl bg-surface dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export default function EcommerceMetrics({
  stats,
  loading,
  onStatClick,
  gridClassName = DEFAULT_GRID,
}: Props) {
  if (loading) {
    return (
      <div className={gridClassName}>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className={gridClassName}>
      {KPI_CONFIG.map((item) => {
        const rawValue = Number(stats[item.key as BrokerMetricKey] ?? 0) || 0;
        const value =
          "isCurrency" in item && item.isCurrency
            ? formatCompactCurrency(rawValue)
            : formatCompactCount(rawValue);
        const comparison = stats.comparison?.[item.key as BrokerMetricKey];

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onStatClick?.(item.key)}
            className="rounded-2xl border border-border bg-white p-4 text-left transition hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    {item.label}
                  </p>
                  <ComparisonBadge comparison={comparison} />
                </div>
                <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-text-primary dark:text-white">
                  {value}
                </p>
              </div>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconWrap}`}
              >
                <item.icon className="h-5 w-5" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
