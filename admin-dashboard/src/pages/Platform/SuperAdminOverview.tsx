import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  Building2,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { adminFetch } from "../../lib/adminApi";

type Stats = {
  organizations?: {
    total?: number;
    breakdown?: {
      type: string;
      _count: number;
    }[];
  };

  users?: {
    total?: number;
    active?: number;
    loanOfficers?: number;
    subBrokers?: number;
  };

  clients?: {
    total?: number;
    active?: number;
  };

  applications?: {
    total?: number;
    breakdown?: {
      status: string;
      _count: number;
    }[];
    fundedVolume?: number;
    last7Days?: number;
    last30Days?: number;
  };

  conversations?: {
    total?: number;
  };
};

const quickLinks = [
  { name: "Brokers", path: "/all-brokers-database", color: "bg-blue-500/10 text-blue-600" },
  { name: "Lenders", path: "/all-lenders-Organization", color: "bg-emerald-500/10 text-emerald-600" },
  { name: "Loan Officers", path: "/all-loan-officers", color: "bg-violet-500/10 text-violet-600" },
  { name: "Sub-Brokers", path: "/all-sub-brokers", color: "bg-amber-500/10 text-amber-600" },
  { name: "Clients", path: "/all-clients", color: "bg-cyan-500/10 text-cyan-600" },
  { name: "All Deals", path: "/loan-pipeline", color: "bg-indigo-500/10 text-indigo-600" },
  { name: "Communications", path: "/all-communications", color: "bg-fuchsia-500/10 text-fuchsia-600" },
  { name: "Audit Logs", path: "/admin-logs", color: "bg-slate-500/10 text-slate-600" },
];

export default function SuperAdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminFetch<{ data: Stats }>("/admin/stats")
      .then((json) => setStats(json.data))
      .catch(() => setStats(null));
  }, []);

  const cards = [
    {
      label: "Brokers",
      value:
        stats?.organizations?.breakdown?.find((item: any) => item.type === "BROKER")
          ?._count ?? "—",
      icon: Building2,
    },
    {
      label: "Lenders",
      value:
        stats?.organizations?.breakdown?.find((item: any) => item.type === "LENDER")
          ?._count ?? "—",
      icon: Shield,
    },
    {
      label: "Loan Officers",
      value: stats?.users?.loanOfficers ?? "—",
      icon: Users,
    },
    {
      label: "Sub-Brokers",
      value: stats?.users?.subBrokers ?? "—",
      icon: Users,
    },
    {
      label: "Clients",
      value: stats?.clients?.total ?? "—",
      icon: Users,
    },
    {
      label: "Applications",
      value: stats?.applications?.total ?? "—",
      icon: Activity,
    },
    {
      label: "In Review",
      value:
        stats?.applications?.breakdown?.find((item: any) => item.status === "IN_REVIEW")
          ?._count ?? "—",
      icon: TrendingUp,
    },
    {
      label: "Communications",
      value: stats?.conversations?.total ?? "—",
      icon: MessageSquare,
    },
  ];

  return (
    <>
      <PageMeta
        title="Super Admin Portal"
        description="Platform-wide visibility and control for LendingCart super administrators."
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Super Admin Portal
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Highest-level system administrator with full visibility across lenders, brokers, loan officers, sub-brokers, clients, deals, communications, and analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                    {value}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                  <Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Platform Control Center
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {quickLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition hover:opacity-90 ${item.color}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
