import { ReactNode } from "react";
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
  colorScheme: "blue" | "purple" | "green" | "orange";
}

/* ================= DUMMY DATA (LENDER) ================= */

const LENDER_DUMMY_STATS = [
  {
    title: "Total Applications",
    value: 128,
    icon: <FileText className="w-6 h-6 text-white" />,
    colorScheme: "blue" as const,
  },
  {
    title: "Pending Review",
    value: 24,
    icon: <Clock className="w-6 h-6 text-white" />,
    colorScheme: "purple" as const,
  },
  {
    title: "Approved",
    value: 76,
    icon: <CheckCircle className="w-6 h-6 text-white" />,
    colorScheme: "green" as const,
  },
  {
    title: "Declined",
    value: 18,
    icon: <XCircle className="w-6 h-6 text-white" />,
    colorScheme: "orange" as const,
  },
  {
    title: "Funded Loans",
    value: 65,
    icon: <CheckCircle className="w-6 h-6 text-white" />,
    colorScheme: "green" as const,
  },
  {
    title: "Total Funded Volume",
    value: "$4,250,000",
    icon: <DollarSign className="w-6 h-6 text-white" />,
    colorScheme: "blue" as const,
  },
  {
    title: "Avg. Loan Size",
    value: "$65,385",
    icon: <DollarSign className="w-6 h-6 text-white" />,
    colorScheme: "purple" as const,
  },
  {
    title: "Approval Rate",
    value: "63%",
    icon: <CheckCircle className="w-6 h-6 text-white" />,
    colorScheme: "green" as const,
  },
  {
    title: "Active Brokers",
    value: 14,
    icon: <FileText className="w-6 h-6 text-white" />,
    colorScheme: "orange" as const,
  },
];

/* ================= STAT CARD ================= */

const StatCard = ({ title, value, icon, colorScheme }: StatCardProps) => {
  const iconThemes = {
    blue: "bg-blue-600",
    purple: "bg-purple-600",
    green: "bg-emerald-600",
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
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>

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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {LENDER_DUMMY_STATS.map((item, index) => (
        <StatCard key={index} {...item} />
      ))}
    </div>
  );
}
