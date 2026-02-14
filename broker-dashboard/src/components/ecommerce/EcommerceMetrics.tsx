import { ReactNode, useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIconLine,
  GroupIcon,
} from "../../icons";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend: {
    value: string;
    isUp: boolean;
  };
  colorScheme: "blue" | "purple" | "emerald" | "orange";
}

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

/* ================= STAT CARD COMPONENT ================= */

const StatCard = ({
  title,
  value,
  icon,
  trend,
  colorScheme,
}: StatCardProps) => {
  const themes = {
    blue: {
      bg: "bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-200",
      iconBox: "bg-white/20 text-white border-white/30",
      badge: "bg-white/20 text-white border-none",
    },
    purple: {
      bg: "bg-gradient-to-br from-indigo-600 to-purple-700 shadow-indigo-200",
      iconBox: "bg-white/20 text-white border-white/30",
      badge: "bg-white/20 text-white border-none",
    },
    emerald: {
      bg: "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200",
      iconBox: "bg-white/20 text-white border-white/30",
      badge: "bg-white/20 text-white border-none",
    },
    orange: {
      bg: "bg-gradient-to-br from-orange-500 to-red-600 shadow-orange-200",
      iconBox: "bg-white/20 text-white border-white/30",
      badge: "bg-white/20 text-white border-none",
    },
  };

  const style = themes[colorScheme];

  return (
    <div
      className={`group relative overflow-hidden rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${style.bg} border border-white/10`}
    >
      <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border backdrop-blur-md ${style.iconBox}`}
          >
            {icon}
          </div>

          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-md ${style.badge}`}
          >
            {trend.isUp ? (
              <ArrowUpIcon className="size-3" />
            ) : (
              <ArrowDownIcon className="size-3" />
            )}
            {trend.value}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/80">
            {title}
          </p>
          <h4 className="mt-1 text-3xl font-black tracking-tight text-white">
            {value}
          </h4>
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

  const statItems: StatCardProps[] = [
    {
      title: "Total Applications",
      value: loading ? "..." : stats?.totalApplications ?? 0,
      icon: <GroupIcon className="size-6 text-white" />,
      colorScheme: "blue",
      trend: { value: "Live", isUp: true },
    },
    {
      title: "Submitted",
      value: loading ? "..." : stats?.totalSubmitted ?? 0,
      icon: <BoxIconLine className="size-6 text-white" />,
      colorScheme: "purple",
      trend: { value: "Current", isUp: true },
    },
    {
      title: "Funded Volume",
      value: loading
        ? "..."
        : `$${(stats?.totalVolumeFunded ?? 0).toLocaleString()}`,
      icon: <BoxIconLine className="size-6 text-white" />,
      colorScheme: "emerald",
      trend: { value: "Live", isUp: true },
    },
    {
      title: "Unique Lenders",
      value: loading ? "..." : stats?.uniqueLendersAccessed ?? 0,
      icon: <BoxIconLine className="size-6 text-white" />,
      colorScheme: "orange",
      trend: { value: "Active", isUp: true },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 px-2 py-4">
      {statItems.map((item, index) => (
        <StatCard key={index} {...item} />
      ))}
    </div>
  );
}
