import { ReactNode } from "react";
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
/* ================= TYPES ================= */ export interface BrokerStats {
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
}

const themes = {
  tealLight: "bg-teal-50 text-teal-600",
  skyBlue: "bg-sky-50 text-sky-600",
  navy: "bg-blue-50 text-blue-600",
  deepNavy: "bg-amber-50 text-amber-600",
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  colorScheme: keyof typeof themes;
}
/* ================= STAT CONFIG ================= */ const STAT_CONFIG = {
  totalApplications: {
    label: "Total Applications",
    icon: <FileText className="h-5 w-5" />,
    color: "tealLight",
  },
  totalSubmitted: {
    label: "Total Submitted",
    icon: <Send className="h-5 w-5" />,
    color: "skyBlue",
  },
  totalInReview: {
    label: "In Review",
    icon: <Clock className="h-5 w-5" />,
    color: "navy",
  },
  totalApproved: {
    label: "Total Approved",
    icon: <CheckCircle className="h-5 w-5" />,
    color: "tealLight",
  },
  totalDeclined: {
    label: "Total Declined",
    icon: <XCircle className="h-5 w-5" />,
    color: "navy",
  },
  totalFunded: {
    label: "Total Funded",
    icon: <BadgeDollarSign className="h-5 w-5" />,
    color: "deepNavy",
  },
  totalWithdrawn: {
    label: "Total Withdrawn",
    icon: <RotateCcw className="h-5 w-5" />,
    color: "skyBlue",
  },
  totalVolumeFunded: {
    label: "Funded Volume",
    icon: <DollarSign className="h-5 w-5" />,
    color: "deepNavy",
    isCurrency: true,
  },
  uniqueLendersAccessed: {
    label: "Lenders Accessed",
    icon: <Building2 className="h-5 w-5" />,
    color: "tealLight",
  },
} as const;
/* ================= STAT CARD ================= */
const StatCard = ({ title, value, icon, colorScheme }: StatCardProps) => {
  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-6
        shadow-sm
        transition-all
        duration-200
        hover:shadow-md
        dark:border-slate-800
        dark:bg-slate-900
      "
    >
      {/* Top Accent */}
      <div className={`absolute left-0 top-0 h-1 w-full`} />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <h3 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </h3>
        </div>

        <div
          className={`
    flex h-11 w-11 items-center justify-center
    rounded-xl
    ${themes[colorScheme]}
  `}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};
/* ================= SKELETON ================= */ const SkeletonCard = () => (
  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    {" "}
    <div className="animate-pulse">
      {" "}
      <div className="mb-4 h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />{" "}
      <div className="h-8 w-28 rounded bg-slate-200 dark:bg-slate-700" />{" "}
      <div className="mt-6 flex items-center justify-between">
        {" "}
        <div className="h-5 w-20 rounded bg-slate-200 dark:bg-slate-700" />{" "}
        <div className="h-14 w-14 rounded-2xl bg-slate-200 dark:bg-slate-700" />{" "}
      </div>{" "}
    </div>{" "}
  </div>
);
/* ================= MAIN COMPONENT ================= */ export default function EcommerceMetrics({
  stats,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {" "}
        {Array.from({ length: 9 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}{" "}
      </div>
    );
  }
  if (!stats) return null;
  const statItems = Object.entries(STAT_CONFIG).map(([key, config]) => {
    const rawValue = stats[key as keyof BrokerStats] ?? 0;
    const value =
      "isCurrency" in config && config.isCurrency
        ? `$${Number(rawValue).toLocaleString()}`
        : rawValue;
    return {
      title: config.label,
      value,
      icon: config.icon,
      colorScheme: config.color,
    };
  });
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {" "}
      {statItems.map((item, index) => (
        <StatCard key={index} {...item} />
      ))}{" "}
    </div>
  );
}
