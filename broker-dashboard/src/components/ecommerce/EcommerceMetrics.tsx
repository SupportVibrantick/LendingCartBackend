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
  tealLight: "bg-gradient-to-r from-[#4FCDCC] to-[#18B6B4]",
  skyBlue: "bg-gradient-to-r from-[#37C9EF] to-[#2C92D5]",
  navy: "bg-gradient-to-r from-[#2C92D5] to-[#13538A]",
  deepNavy: "bg-gradient-to-r from-[#13538A] to-[#0F3E68]",
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
    <div
      className={`relative overflow-hidden rounded-2xl px-6 py-5 text-white shadow-xl ${themes[colorScheme]}`}
    >
      <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
          {icon}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider opacity-80">{title}</p>
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
