import { Link } from "react-router";
import {
  Activity,
  ArrowRight,
  Building2,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import ApplicationsDonutChart from "../../components/charts/bar/ApplicationsDonutChart";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import LatestApplicationsTable from "../../components/ecommerce/LatestApplicationsTable";
import ApplicationPipelineChart from "../../components/dashboard/ApplicationPipelineChart";
import PlatformActivityChart from "../../components/dashboard/PlatformActivityChart";
import UserEcosystemChart from "../../components/dashboard/UserEcosystemChart";
import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminApi";

type Stats = {
  organizations?: {
    total?: number;
    breakdown?: { type: string; _count: number }[];
  };
  users?: { total?: number; loanOfficers?: number; subBrokers?: number };
  clients?: { total?: number; active?: number };
  applications?: {
    total?: number;
    last7Days?: number;
    last30Days?: number;
    breakdown?: { status: string; _count: number }[];
  };
  conversations?: { total?: number };
  latestApplications?: any[];
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

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch<{ data: Stats }>("/admin/stats")
      .then((json) => setStats(json.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const brokerCount =
    stats?.organizations?.breakdown?.find((item) => item.type === "BROKER")?._count ?? 0;
  const lenderCount =
    stats?.organizations?.breakdown?.find((item) => item.type === "LENDER")?._count ?? 0;

  const cards = [
    { label: "Brokers", value: brokerCount, icon: Building2, accent: "text-blue-600 bg-blue-500/10" },
    { label: "Lenders", value: lenderCount, icon: Shield, accent: "text-emerald-600 bg-emerald-500/10" },
    { label: "Loan Officers", value: stats?.users?.loanOfficers ?? 0, icon: Users, accent: "text-violet-600 bg-violet-500/10" },
    { label: "Sub-Brokers", value: stats?.users?.subBrokers ?? 0, icon: Users, accent: "text-amber-600 bg-amber-500/10" },
    { label: "Clients", value: stats?.clients?.total ?? 0, icon: Users, accent: "text-cyan-600 bg-cyan-500/10" },
    { label: "Applications", value: stats?.applications?.total ?? 0, icon: Activity, accent: "text-indigo-600 bg-indigo-500/10" },
    {
      label: "In Review",
      value:
        stats?.applications?.breakdown?.find((item) => item.status === "IN_REVIEW")?._count ?? 0,
      icon: TrendingUp,
      accent: "text-rose-600 bg-rose-500/10",
    },
    { label: "Communications", value: stats?.conversations?.total ?? 0, icon: MessageSquare, accent: "text-fuchsia-600 bg-fuchsia-500/10" },
  ];

  return (
    <>
      <PageMeta
        title="Lendingcart Dashboard"
        description="Platform-wide visibility and control for LendingCart administrators."
      />

      <div className="space-y-6">
        {/* Header banner */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] p-6 text-white shadow-lg dark:border-slate-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <TrendingUp className="h-3.5 w-3.5" />
                Platform Overview
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                Live metrics, charts, and quick access across lenders, brokers, loan officers,
                sub-brokers, clients, deals, and communications.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Orgs", value: stats?.organizations?.total ?? "—" },
                  { label: "Users", value: stats?.users?.total ?? "—" },
                  { label: "Apps", value: stats?.applications?.total ?? "—" },
                  { label: "7-day", value: stats?.applications?.last7Days ?? "—" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20"
                  >
                    <p className="text-xs text-white/70">{label}</p>
                    <p className="mt-1 text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <Link
                to="/platform-reports"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#13538A] transition hover:bg-white/90"
              >
                Full Reports
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {cards.map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className={`mb-2 inline-flex rounded-lg p-2 ${accent}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                {loading ? "—" : value}
              </p>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ApplicationsDonutChart stats={stats} />
          <StatisticsChart stats={stats} />
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PlatformActivityChart stats={stats} />
          <UserEcosystemChart stats={stats} />
        </div>

        {/* Pipeline chart */}
        <ApplicationPipelineChart stats={stats} />

        {/* Quick links + snapshot */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Platform Control Center
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickLinks.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`rounded-xl px-3 py-2.5 text-center text-sm font-medium transition hover:opacity-90 ${item.color}`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Today&apos;s Snapshot
            </h2>
            <div className="mt-4 space-y-3">
              {[
                { label: "New applications (7d)", value: stats?.applications?.last7Days ?? 0 },
                { label: "Active users", value: stats?.users?.total ?? 0 },
                { label: "Active clients", value: stats?.clients?.active ?? 0 },
                { label: "Conversations", value: stats?.conversations?.total ?? 0 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50"
                >
                  <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <LatestApplicationsTable applications={stats?.latestApplications || []} />
      </div>
    </>
  );
}
