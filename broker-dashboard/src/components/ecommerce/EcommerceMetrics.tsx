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
}

const KPI_CONFIG = [
  {
    key: "totalApplications",
    label: "Applications",
    icon: FileText,
    iconWrap: "bg-[#13538A]/10 text-[#13538A]",
    ring: "hover:ring-[#13538A]/20",
  },
  {
    key: "totalSubmitted",
    label: "Submitted",
    icon: Send,
    iconWrap: "bg-sky-50 text-sky-600",
    ring: "hover:ring-sky-200",
  },
  {
    key: "totalIncomplete",
    label: "Incomplete",
    icon: FilePenLine,
    iconWrap: "bg-amber-50 text-amber-600",
    ring: "hover:ring-amber-200",
  },
  {
    key: "totalInReview",
    label: "In Review",
    icon: Clock3,
    iconWrap: "bg-indigo-50 text-indigo-600",
    ring: "hover:ring-indigo-200",
  },
  {
    key: "totalApproved",
    label: "Approved",
    icon: CheckCircle2,
    iconWrap: "bg-emerald-50 text-emerald-600",
    ring: "hover:ring-emerald-200",
  },
  {
    key: "totalFunded",
    label: "Funded",
    icon: Landmark,
    iconWrap: "bg-teal-50 text-teal-700",
    ring: "hover:ring-teal-200",
  },
  {
    key: "totalVolumeFunded",
    label: "Funded Volume",
    icon: BadgeDollarSign,
    iconWrap: "bg-violet-50 text-violet-600",
    ring: "hover:ring-violet-200",
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
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-3">
        <div className="h-9 w-9 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-6 w-14 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

export default function EcommerceMetrics({
  stats,
  loading,
  onStatClick,
}: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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
            className={`group rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-[0_8px_20px_rgba(15,23,42,0.04)] ring-1 ring-transparent transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] dark:border-gray-800 dark:bg-gray-900 ${item.ring}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconWrap}`}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <ComparisonBadge comparison={comparison} />
            </div>
            <p className="mt-3 text-[12px] font-medium leading-tight text-slate-500">
              {item.label}
            </p>
            <p className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
              {value}
            </p>
          </button>
        );
      })}
    </div>
  );
}
