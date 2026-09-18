import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import {
  Activity,
  ArrowRight,
  Building2,
  FileText,
  MessageSquare,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import ApplicationsDonutChart from "../../components/charts/bar/ApplicationsDonutChart";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import LatestApplicationsTable from "../../components/ecommerce/LatestApplicationsTable";
import ApplicationPipelineChart from "../../components/dashboard/ApplicationPipelineChart";
import PlatformActivityChart from "../../components/dashboard/PlatformActivityChart";
import UserEcosystemChart from "../../components/dashboard/UserEcosystemChart";
import { adminFetch } from "../../lib/adminApi";
import {
  formatChangePercent,
  formatCompactCount,
  formatCompactCurrency,
  orgCount,
  type AdminStats,
  type DashboardPeriod,
  type MetricComparison,
} from "../../lib/adminDashboardStats";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
];

const quickActions = [
  { label: "Brokers", path: "/all-brokers-database", icon: Building2 },
  { label: "Lenders", path: "/all-lenders-Organization", icon: Shield },
  { label: "Pipeline", path: "/loan-pipeline", icon: TrendingUp },
  { label: "Officers", path: "/all-loan-officers", icon: Users },
  { label: "Clients", path: "/all-clients", icon: Users },
  { label: "Reports", path: "/platform-reports", icon: FileText },
  { label: "Messages", path: "/all-communications", icon: MessageSquare },
  { label: "Subs", path: "/all-subscriptions", icon: Wallet },
];

function getAdminFirstName() {
  try {
    const raw = sessionStorage.getItem("admin_user");
    if (raw) {
      const user = JSON.parse(raw);
      const first =
        user.firstName ||
        user.name?.split(/\s+/)[0] ||
        user.email?.split("@")[0];
      if (first) return String(first);
    }
    const name = sessionStorage.getItem("admin_user_name");
    if (name?.trim()) return name.trim().split(/\s+/)[0];
    return "Admin";
  } catch {
    return "Admin";
  }
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function shouldShowComparison(comparison?: MetricComparison) {
  if (!comparison) return false;
  if (
    comparison.changePercent === null ||
    comparison.changePercent === undefined
  ) {
    return false;
  }
  if (
    comparison.previous > 0 &&
    comparison.previous < 3 &&
    comparison.current === 0
  ) {
    return false;
  }
  return true;
}

function ComparisonBadge({ comparison }: { comparison?: MetricComparison }) {
  if (!shouldShowComparison(comparison)) return null;
  const label = formatChangePercent(comparison?.changePercent);
  if (!label) return null;

  const value = comparison?.changePercent ?? 0;
  const positive = value > 0;
  const negative = value < 0;

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : negative
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

export default function Home() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("12m");
  const firstName = useMemo(() => getAdminFirstName(), []);
  const greeting = useMemo(() => getGreeting(), []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await adminFetch<{ data: AdminStats }>(
        `/admin/stats?period=${period}`,
      );
      setStats(json.data);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
      setStats(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const analytics = stats?.analytics;
  const brokerCount = orgCount(stats?.organizations?.breakdown, "BROKER");
  const lenderCount = orgCount(stats?.organizations?.breakdown, "LENDER");

  const periodKpis = [
    {
      key: "totalApplications",
      label: "Applications",
      value: analytics?.totalApplications ?? 0,
      icon: FileText,
      tone: "text-[#13538A] bg-[#13538A]/10",
      isCurrency: false,
    },
    {
      key: "totalSubmitted",
      label: "Submitted",
      value: analytics?.totalSubmitted ?? 0,
      icon: Activity,
      tone: "text-sky-600 bg-sky-50",
      isCurrency: false,
    },
    {
      key: "totalInReview",
      label: "In Review",
      value: analytics?.totalInReview ?? 0,
      icon: TrendingUp,
      tone: "text-amber-600 bg-amber-50",
      isCurrency: false,
    },
    {
      key: "totalApproved",
      label: "Approved",
      value: analytics?.totalApproved ?? 0,
      icon: Shield,
      tone: "text-emerald-600 bg-emerald-50",
      isCurrency: false,
    },
    {
      key: "totalFunded",
      label: "Funded",
      value: analytics?.totalFunded ?? 0,
      icon: Wallet,
      tone: "text-violet-600 bg-violet-50",
      isCurrency: false,
    },
    {
      key: "totalVolumeFunded",
      label: "Funded Volume",
      value: analytics?.totalVolumeFunded ?? 0,
      icon: Building2,
      tone: "text-teal-700 bg-teal-50",
      isCurrency: true,
    },
  ] as const;

  const ecosystemCards = [
    {
      label: "Brokers",
      value: brokerCount,
      icon: Building2,
      accent: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Lenders",
      value: lenderCount,
      icon: Shield,
      accent: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "Loan Officers",
      value: stats?.users?.loanOfficers ?? 0,
      icon: Users,
      accent: "text-violet-600 bg-violet-500/10",
    },
    {
      label: "Co-Brokers",
      value: stats?.users?.subBrokers ?? 0,
      icon: Users,
      accent: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "Clients",
      value: stats?.clients?.total ?? 0,
      icon: Users,
      accent: "text-cyan-600 bg-cyan-500/10",
    },
    {
      label: "All Apps",
      value: stats?.applications?.total ?? 0,
      icon: Activity,
      accent: "text-indigo-600 bg-indigo-500/10",
    },
    {
      label: "Products",
      value: stats?.lenders?.products ?? 0,
      icon: FileText,
      accent: "text-rose-600 bg-rose-500/10",
    },
    {
      label: "Conversations",
      value: stats?.conversations?.total ?? 0,
      icon: MessageSquare,
      accent: "text-fuchsia-600 bg-fuchsia-500/10",
    },
  ];

  return (
    <>
      <PageMeta
        title="Admin Dashboard | Loan Automation"
        description="Platform-wide visibility and control for Loan Automation administrators."
      />

      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] px-4 py-4 text-white shadow-lg sm:px-5 sm:py-5 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Platform Admin
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
                {greeting}, {firstName}
              </h1>
              <p className="mt-0.5 text-sm text-white/80">
                Live platform analytics ·{" "}
                {PERIOD_OPTIONS.find((p) => p.value === period)?.label} window
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5 backdrop-blur-sm">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                      period === option.value
                        ? "bg-white text-[#13538A] shadow-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <Link
                to="/platform-reports"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#13538A] transition hover:bg-white/90"
              >
                Full Reports
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        {error && !loading ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>Unable to load analytics. {error}</p>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 self-start rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {/* Period KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {periodKpis.map(({ key, label, value, icon: Icon, tone, isCurrency }) => (
            <div
              key={key}
              className="rounded-xl border border-slate-200 border-l-4 border-l-[#13538A] bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              style={{
                borderLeftColor: tone.includes("sky")
                  ? "#0EA5E9"
                  : tone.includes("amber")
                    ? "#F59E0B"
                    : tone.includes("emerald")
                      ? "#10B981"
                      : tone.includes("violet")
                        ? "#8B5CF6"
                        : tone.includes("teal")
                          ? "#0D9488"
                          : "#13538A",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`inline-flex rounded-lg p-2 ${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <ComparisonBadge comparison={analytics?.comparison?.[key]} />
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                {loading
                  ? "—"
                  : isCurrency
                    ? formatCompactCurrency(value)
                    : formatCompactCount(value)}
              </p>
            </div>
          ))}
        </div>

        {/* Conversion strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: "Submission rate",
              value: analytics?.conversion?.submissionRate ?? 0,
              hint: "Created → submitted",
            },
            {
              label: "Approval rate",
              value: analytics?.conversion?.approvalRate ?? 0,
              hint: "Submitted → approved",
            },
            {
              label: "Funding rate",
              value: analytics?.conversion?.fundingRate ?? 0,
              hint: "Approved → funded",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {loading ? "—" : `${item.value}%`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{item.hint}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-8">
            <StatisticsChart analytics={analytics} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <ApplicationsDonutChart analytics={analytics} loading={loading} />
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <PlatformActivityChart analytics={analytics} loading={loading} />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <UserEcosystemChart stats={stats} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
                Ecosystem snapshot
              </p>
              <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                Platform inventory
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {ecosystemCards.map(({ label, value, icon: Icon, accent }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className={`mb-1.5 inline-flex rounded-md p-1.5 ${accent}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {loading ? "—" : formatCompactCount(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12">
            <ApplicationPipelineChart analytics={analytics} loading={loading} />
          </div>
        </div>

        <LatestApplicationsTable />
      </div>
    </>
  );
}
