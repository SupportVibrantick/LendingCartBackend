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

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  colorScheme: "blue" | "purple" | "green" | "orange";
}

/* ================= STAT CONFIG ================= */

const STAT_CONFIG = {
  totalApplications: {
    label: "Total Applications",
    icon: <FileText className="w-6 h-6 text-white" />,
    color: "blue",
  },
  totalSubmitted: {
    label: "Total Submitted",
    icon: <Send className="w-6 h-6 text-white" />,
    color: "purple",
  },
  totalInReview: {
    label: "In Review",
    icon: <Clock className="w-6 h-6 text-white" />,
    color: "orange",
  },
  totalApproved: {
    label: "Total Approved",
    icon: <CheckCircle className="w-6 h-6 text-white" />,
    color: "green",
  },
  totalDeclined: {
    label: "Total Declined",
    icon: <XCircle className="w-6 h-6 text-white" />,
    color: "orange",
  },
  totalFunded: {
    label: "Total Funded",
    icon: <BadgeDollarSign className="w-6 h-6 text-white" />,
    color: "green",
  },
  totalWithdrawn: {
    label: "Total Withdrawn",
    icon: <RotateCcw className="w-6 h-6 text-white" />,
    color: "purple",
  },
  totalVolumeFunded: {
    label: "Total Funded Volume",
    icon: <DollarSign className="w-6 h-6 text-white" />,
    color: "blue",
    isCurrency: true,
  },
} as const;

/* ================= STAT CARD ================= */

const StatCard = ({ title, value, icon, colorScheme }: StatCardProps) => {
  const themes = {
    blue: "bg-gradient-to-r from-blue-600 to-blue-700",
    purple: "bg-gradient-to-r from-indigo-600 to-purple-600",
    green: "bg-gradient-to-r from-emerald-600 to-green-600",
    orange: "bg-gradient-to-r from-orange-500 to-red-500",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl px-6 py-5 text-white shadow-xl ${themes[colorScheme]}`}
    >
      <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
          {icon}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider opacity-80">
            {title}
          </p>
          <h3 className="text-3xl font-bold mt-1">{value}</h3>
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
