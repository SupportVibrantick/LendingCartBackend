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
          <p className="text-xs uppercase tracking-wider opacity-80">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
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
