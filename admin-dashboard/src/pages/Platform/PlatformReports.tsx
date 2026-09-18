import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  BarChart3,
  Building2,
  FileText,
  MessageSquare,
  Package,
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
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : negative
            ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
      }`}
    >
      {label}
    </span>
  );
}

export default function PlatformReports() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("12m");

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
        err instanceof Error ? err.message : "Failed to load reports";
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
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? "12M";

  const periodKpis = [
    {
      key: "totalApplications",
      label: "Applications",
      value: analytics?.totalApplications ?? 0,
      icon: FileText,
      iconWrap:
        "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
      isCurrency: false,
    },
    {
      key: "totalSubmitted",
      label: "Submitted",
      value: analytics?.totalSubmitted ?? 0,
      icon: Activity,
      iconWrap:
        "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      isCurrency: false,
    },
    {
      key: "totalInReview",
      label: "In review",
      value: analytics?.totalInReview ?? 0,
      icon: TrendingUp,
      iconWrap:
        "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      isCurrency: false,
    },
    {
      key: "totalApproved",
      label: "Approved",
      value: analytics?.totalApproved ?? 0,
      icon: Shield,
      iconWrap:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      isCurrency: false,
    },
    {
      key: "totalFunded",
      label: "Funded",
      value: analytics?.totalFunded ?? 0,
      icon: Wallet,
      iconWrap:
        "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      isCurrency: false,
    },
    {
      key: "totalVolumeFunded",
      label: "Funded volume",
      value: analytics?.totalVolumeFunded ?? 0,
      icon: Building2,
      iconWrap:
        "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
      isCurrency: true,
    },
  ] as const;

  const ecosystemCards = [
    {
      label: "Brokers",
      value: brokerCount,
      icon: Building2,
      iconWrap:
        "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    },
    {
      label: "Lenders",
      value: lenderCount,
      icon: Shield,
      iconWrap:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    {
      label: "Loan officers",
      value: stats?.users?.loanOfficers ?? 0,
      icon: Users,
      iconWrap:
        "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    },
    {
      label: "Co-brokers",
      value: stats?.users?.subBrokers ?? 0,
      icon: Users,
      iconWrap:
        "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    {
      label: "Clients",
      value: stats?.clients?.total ?? 0,
      icon: Users,
      iconWrap:
        "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    },
    {
      label: "Products",
      value: stats?.lenders?.products ?? 0,
      icon: Package,
      iconWrap:
        "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    },
    {
      label: "Conversations",
      value: stats?.conversations?.total ?? 0,
      icon: MessageSquare,
      iconWrap:
        "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
    },
    {
      label: "All apps",
      value: stats?.applications?.total ?? 0,
      icon: FileText,
      iconWrap:
        "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    },
  ];

  return (
    <>
      <PageMeta
        title="Platform Reports"
        description="System reports and analytics"
      />

      <div className="space-y-4 text-gray-900 dark:text-gray-100">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] px-5 py-5 text-white sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
                <BarChart3 className="h-3.5 w-3.5" />
                Platform analytics
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Reports & Analytics
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Platform-wide metrics for super administrators · {periodLabel}{" "}
                window
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-white/20 bg-white/10 p-0.5 backdrop-blur-sm">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
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
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {error && !loading ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>Unable to load reports. {error}</p>
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
          {periodKpis.map(
            ({ key, label, value, icon: Icon, iconWrap, isCurrency }) => (
              <div
                key={key}
                className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconWrap}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <ComparisonBadge comparison={analytics?.comparison?.[key]} />
                </div>
                <p className="mt-2.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {loading
                    ? "—"
                    : isCurrency
                      ? formatCompactCurrency(value)
                      : formatCompactCount(value)}
                </p>
              </div>
            ),
          )}
        </div>

        {/* Conversion */}
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
              className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                {loading ? "—" : `${item.value}%`}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                {item.hint}
              </p>
            </div>
          ))}
        </div>

        {/* Ecosystem inventory */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Platform inventory
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              Live counts across organizations, users, and products.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {ecosystemCards.map(({ label, value, icon: Icon, iconWrap }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div
                  className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconWrap}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                  {loading ? "—" : formatCompactCount(value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-8">
            <StatisticsChart analytics={analytics} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <ApplicationsDonutChart analytics={analytics} loading={loading} />
          </div>

          <div className="col-span-12 md:col-span-6">
            <PlatformActivityChart analytics={analytics} loading={loading} />
          </div>
          <div className="col-span-12 md:col-span-6">
            <UserEcosystemChart stats={stats} loading={loading} />
          </div>

          <div className="col-span-12">
            <ApplicationPipelineChart
              analytics={analytics}
              loading={loading}
            />
          </div>
        </div>

        <LatestApplicationsTable />
      </div>
    </>
  );
}
