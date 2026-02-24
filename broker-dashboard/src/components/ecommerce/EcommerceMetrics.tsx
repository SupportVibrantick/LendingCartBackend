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
} from "lucide-react";

/* ================= TYPES ================= */

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
}

const themes = {
  tealLight: "bg-gradient-to-br from-[#14B8A6] via-[#0D9488] to-[#0F766E]",
  skyBlue: "bg-gradient-to-br from-[#38BDF8] via-[#0EA5E9] to-[#0369A1]",
  navy: "bg-gradient-to-br from-[#3B82F6] via-[#1D4ED8] to-[#1E3A8A]",
  deepNavy: "bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#020617]",
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  colorScheme: keyof typeof themes;
}

/* ================= STAT CONFIG ================= */

const STAT_CONFIG = {
  totalApplications: {
    label: "Total Applications",
    icon: <FileText className="w-6 h-6 text-white" />,
    color: "tealLight",
  },
  totalSubmitted: {
    label: "Total Submitted",
    icon: <Send className="w-6 h-6 text-white" />,
    color: "skyBlue",
  },
  totalInReview: {
    label: "In Review",
    icon: <Clock className="w-6 h-6 text-white" />,
    color: "navy",
  },
  totalApproved: {
    label: "Total Approved",
    icon: <CheckCircle className="w-6 h-6 text-white" />,
    color: "tealLight",
  },
  totalDeclined: {
    label: "Total Declined",
    icon: <XCircle className="w-6 h-6 text-white" />,
    color: "navy",
  },
  totalFunded: {
    label: "Total Funded",
    icon: <BadgeDollarSign className="w-6 h-6 text-white" />,
    color: "deepNavy",
  },
  totalWithdrawn: {
    label: "Total Withdrawn",
    icon: <RotateCcw className="w-6 h-6 text-white" />,
    color: "skyBlue",
  },
  totalVolumeFunded: {
    label: "Total Funded Volume",
    icon: <DollarSign className="w-6 h-6 text-white" />,
    color: "deepNavy",
    isCurrency: true,
  },
} as const;

/* ================= STAT CARD ================= */

const StatCard = ({ title, value, icon, colorScheme }: StatCardProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {value}
          </h3>
        </div>

        <div
          className={`h-8 w-8 flex items-center justify-center rounded-xl text-white ${themes[colorScheme]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

/* ================= MAIN COMPONENT ================= */

export default function EcommerceMetrics({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-gray-200 animate-pulse dark:bg-gray-800"
          />
        ))}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {statItems.map((item, index) => (
        <StatCard key={index} {...item} />
      ))}
    </div>
  );
}
