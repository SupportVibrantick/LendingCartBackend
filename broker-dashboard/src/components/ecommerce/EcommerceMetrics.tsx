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
  Building2,
  CheckCircle,
  Clock,
  FileText,
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
    tone: "bg-[#13538A]/10 text-[#13538A]",
    accent: "border-l-[#13538A]",
  },
  {
    key: "totalSubmitted",
    label: "Submitted",
    icon: Send,
    tone: "bg-sky-50 text-sky-600",
    accent: "border-l-sky-500",
  },
  {
    key: "totalInReview",
    label: "In Review",
    icon: Clock,
    tone: "bg-amber-50 text-amber-600",
    accent: "border-l-amber-500",
  },
  {
    key: "totalApproved",
    label: "Approved",
    icon: CheckCircle,
    tone: "bg-emerald-50 text-emerald-600",
    accent: "border-l-emerald-500",
  },
  {
    key: "totalFunded",
    label: "Funded",
    icon: BadgeDollarSign,
    tone: "bg-violet-50 text-violet-600",
    accent: "border-l-violet-500",
  },
  {
    key: "totalVolumeFunded",
    label: "Funded Volume",
    icon: Building2,
    tone: "bg-teal-50 text-teal-700",
    accent: "border-l-teal-600",
    isCurrency: true,
  },
] as const;

function shouldShowComparison(comparison?: MetricComparison) {
  if (!comparison) return false;
  if (comparison.changePercent === null || comparison.changePercent === undefined) {
    return false;
  }
  // Avoid noisy -100% cards when the prior period had almost no activity.
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
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : negative
            ? "bg-rose-50 text-rose-700"
            : "bg-gray-100 text-gray-600"
      }`}
    >
      {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-700" />
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
            className={`rounded-xl border border-gray-200 border-l-4 bg-white p-4 text-left transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 ${item.accent}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {item.label}
              </p>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}
              >
                <item.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {value}
              </p>
              <ComparisonBadge comparison={comparison} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
