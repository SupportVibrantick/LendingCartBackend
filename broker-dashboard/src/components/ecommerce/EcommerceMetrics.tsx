import {
  FileText,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  BadgeDollarSign,
  RotateCcw,
  DollarSign,
  Building2,
} from "lucide-react";

export interface BrokerStats {
  totalApplications: number;
  totalSubmitted: number;
  totalInReview: number;
  totalApproved: number;
  totalDeclined: number;
  totalFunded: number;
  totalWithdrawn: number;
  totalVolumeFunded: number;
  uniqueLendersAccessed: number;
}

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onStatClick?: (key: keyof BrokerStats) => void;
}

const themes = {
  teal: { bg: "bg-teal-50 text-teal-600", bar: "bg-teal-500" },
  sky: { bg: "bg-sky-50 text-sky-600", bar: "bg-sky-500" },
  blue: { bg: "bg-blue-50 text-blue-600", bar: "bg-blue-500" },
  amber: { bg: "bg-amber-50 text-amber-600", bar: "bg-amber-500" },
  brand: { bg: "bg-[#13538A]/10 text-[#13538A]", bar: "bg-[#13538A]" },
};

const STAT_CONFIG = {
  totalApplications: { label: "Total Applications", icon: FileText, color: "brand" },
  totalSubmitted: { label: "Total Submitted", icon: Send, color: "sky" },
  totalInReview: { label: "In Review", icon: Clock, color: "blue" },
  totalApproved: { label: "Total Approved", icon: CheckCircle, color: "teal" },
  totalDeclined: { label: "Total Declined", icon: XCircle, color: "blue" },
  totalFunded: { label: "Total Funded", icon: BadgeDollarSign, color: "amber" },
  totalWithdrawn: { label: "Total Withdrawn", icon: RotateCcw, color: "sky" },
  totalVolumeFunded: { label: "Funded Volume", icon: DollarSign, color: "amber", isCurrency: true },
  uniqueLendersAccessed: { label: "Lenders Accessed", icon: Building2, color: "brand" },
} as const;

function StatCard({
  title,
  value,
  icon: Icon,
  colorScheme,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: typeof FileText;
  colorScheme: keyof typeof themes;
  onClick?: () => void;
}) {
  const theme = themes[colorScheme];
  const className = `relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#13538A]/30 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 ${
    onClick ? "cursor-pointer text-left w-full" : ""
  }`;

  const content = (
    <>
      <div className={`absolute left-0 top-0 h-1 w-full ${theme.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {title}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </h3>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.bg}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statItems = Object.entries(STAT_CONFIG).map(([key, config]) => {
    const typedKey = key as keyof BrokerStats;
    const rawValue = stats[typedKey] ?? 0;
    const value =
      "isCurrency" in config && config.isCurrency
        ? `$${Number(rawValue).toLocaleString()}`
        : rawValue;

    return {
      key: typedKey,
      title: config.label,
      value,
      icon: config.icon,
      colorScheme: config.color as keyof typeof themes,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {statItems.map((item) => (
        <StatCard
          key={item.title}
          title={item.title}
          value={item.value}
          icon={item.icon}
          colorScheme={item.colorScheme}
          onClick={
            onStatClick ? () => onStatClick(item.key) : undefined
          }
        />
      ))}
    </div>
  );
}
