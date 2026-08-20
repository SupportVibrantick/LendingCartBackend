import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
} from "lucide-react";

/* ================= TYPES ================= */

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  colorScheme:
    | "blue"
    | "purple"
    | "green"
    | "orange";
}

interface DashboardStats {
  totalApplications: number;
  pendingReview: number;
  approved: number;
  declined: number;
  fundedLoans: number;
  totalFundedVolume: number;
  avgLoanSize: number;
  approvalRate: number;
  activeBrokers: number;
}

/* ================= API BASE ================= */

const API_BASE = import.meta.env.VITE_API_BASE ||
  "http://localhost:4000";;

/* ================= STAT CARD ================= */

const StatCard = ({
  title,
  value,
  icon,
  colorScheme,
}: StatCardProps) => {
  const iconThemes = {
    blue: "bg-blue-600",
    purple: "bg-purple-600",
    green: "bg-brand-600",
    orange: "bg-orange-500",
  };

  return (
    <div
      className="
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        rounded-2xl
        shadow-sm hover:shadow-md
        dark:shadow-slate-950/40
        transition-all duration-300
        p-5 flex items-center justify-between
      "
    >
      {/* Left Content */}
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {title}
        </p>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
          {value}
        </h3>
      </div>

      {/* Icon Circle */}
      <div
        className={`
          h-8 w-8 flex items-center justify-center
          rounded-full text-white
          ${iconThemes[colorScheme]}
        `}
      >
        {icon}
      </div>
    </div>
  );
};

/* ================= MAIN COMPONENT ================= */

export default function LenderDashboardMetrics() {
  const [stats, setStats] =
    useState<DashboardStats | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  /* ================= FETCH STATS ================= */

  const fetchOverviewStats =
    async () => {
      try {
        setLoading(true);

        const token =
          sessionStorage.getItem(
            "lender_token",
          );

        const res = await fetch(
          `${API_BASE}/lender/dashboard/overview-stats`,
          {
            headers: {
              ...(token && {
                Authorization: `Bearer ${token}`,
              }),
            },
          },
        );

        const json =
          await res.json();

        if (
          !res.ok ||
          !json.success
        ) {
          throw new Error(
            json.message ||
              "Failed to fetch stats",
          );
        }

        setStats(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

  /* ================= USE EFFECT ================= */

  useEffect(() => {
    fetchOverviewStats();
  }, []);

  /* ================= STATS DATA ================= */

  const statsData = [
    {
      title: "Total Applications",
      value:
        stats?.totalApplications ||
        0,

      icon: (
        <FileText className="w-6 h-6 text-white" />
      ),

      colorScheme: "blue" as const,
    },

    {
      title: "Pending Review",
      value:
        stats?.pendingReview || 0,

      icon: (
        <Clock className="w-6 h-6 text-white" />
      ),

      colorScheme:
        "purple" as const,
    },

    {
      title: "Approved",
      value:
        stats?.approved || 0,

      icon: (
        <CheckCircle className="w-6 h-6 text-white" />
      ),

      colorScheme:
        "green" as const,
    },

    {
      title: "Declined",
      value:
        stats?.declined || 0,

      icon: (
        <XCircle className="w-6 h-6 text-white" />
      ),

      colorScheme:
        "orange" as const,
    },

    {
      title: "Funded Loans",
      value:
        stats?.fundedLoans || 0,

      icon: (
        <CheckCircle className="w-6 h-6 text-white" />
      ),

      colorScheme:
        "green" as const,
    },

    {
      title: "Total Funded Volume",
      value: `$${Number(
        stats?.totalFundedVolume ||
          0,
      ).toLocaleString()}`,

      icon: (
        <DollarSign className="w-6 h-6 text-white" />
      ),

      colorScheme: "blue" as const,
    },

    {
      title: "Avg. Loan Size",
      value: `$${Number(
        stats?.avgLoanSize || 0,
      ).toLocaleString()}`,

      icon: (
        <DollarSign className="w-6 h-6 text-white" />
      ),

      colorScheme:
        "purple" as const,
    },

    {
      title: "Approval Rate",
      value: `${
        stats?.approvalRate || 0
      }%`,

      icon: (
        <CheckCircle className="w-6 h-6 text-white" />
      ),

      colorScheme:
        "green" as const,
    },

    {
      title: "Active Brokers",
      value:
        stats?.activeBrokers || 0,

      icon: (
        <FileText className="w-6 h-6 text-white" />
      ),

      colorScheme:
        "orange" as const,
    },
  ];

  /* ================= RENDER ================= */

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {loading
        ? Array.from({
            length: 9,
          }).map((_, index) => (
            <div
              key={index}
              className="
                h-[110px]
                rounded-2xl
                animate-pulse
                bg-slate-200 dark:bg-slate-800
              "
            />
          ))
        : statsData.map(
            (item, index) => (
              <StatCard
                key={index}
                {...item}
              />
            ),
          )}
    </div>
  );
}