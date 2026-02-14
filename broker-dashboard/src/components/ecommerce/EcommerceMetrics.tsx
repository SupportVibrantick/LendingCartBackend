import { useEffect, useState, ReactNode } from "react";
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

/* ================= TYPES ================= */

interface BrokerStats {
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
  uniqueLendersAccessed: {
    label: "Unique Lenders",
    icon: <Building2 className="w-6 h-6 text-white" />,
    color: "green",
  },
};

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

export default function EcommerceMetrics() {
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "";

  const getHeaders = () => {
    const token = sessionStorage.getItem("broker_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchStats = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/broker/stats`, {
        headers: getHeaders(),
      });

      const json = await res.json();

      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Stats error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statItems = stats
    ? Object.entries(STAT_CONFIG).map(([key, config]) => {
        const rawValue = stats[key as keyof BrokerStats] ?? 0;

        const value =
          "isCurrency" in config && config.isCurrency
            ? `$${Number(rawValue).toLocaleString()}`
            : rawValue;

        return {
          title: config.label,
          value: loading ? "..." : value,
          icon: config.icon,
          colorScheme: config.color as
            | "blue"
            | "purple"
            | "green"
            | "orange",
        };
      })
    : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {statItems.map((item, index) => (
        <StatCard key={index} {...item} />
      ))}
    </div>
  );
}
