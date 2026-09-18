import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link } from "react-router";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  HandCoins,
  RefreshCw,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const BRAND = "#183b57";

type DashboardPeriod = "7d" | "30d" | "90d" | "12m";

interface MetricComparison {
  current: number;
  previous: number;
  changePercent: number | null;
}

interface OverviewStats {
  totalApplications: number;
  pendingReview: number;
  approved: number;
  declined: number;
  fundedLoans: number;
  totalFundedVolume: number;
  avgLoanSize: number;
  activeBrokers: number;
  activeProducts: number;
  activeConnections: number;
  sentToLender: number;
  approvalRate: number;
  fundedRate: number;
  comparison?: Partial<Record<string, MetricComparison>>;
}

interface StageBreakdownItem {
  status: string;
  label: string;
  count: number;
}

interface MonthlyTrendItem {
  key?: string;
  label: string;
  applications: number;
  approved: number;
  funded: number;
  fundedVolume: number;
}

interface BrokerPerformanceItem {
  brokerOrgId: string;
  brokerName: string;
  applications: number;
  approved: number;
  funded: number;
  volume?: number;
  approvalRate: number;
}

interface ProductMixItem {
  productCode: string;
  applications: number;
  approved: number;
  funded: number;
  volume?: number;
  approvalRate: number;
}

interface RecentApplicationItem {
  applicationLenderId: string;
  applicationId: string | null;
  applicationNumber: string;
  clientName: string;
  brokerName: string;
  productCode: string;
  amountRequested: number | string;
  pipelineStatus: string;
  sentAt: string | null;
  updatedAt: string | null;
}

interface PipelinePerformance {
  totalApplications: number;
  totalSubmitted: number;
  totalInReview: number;
  totalApproved: number;
  totalFunded: number;
  totalDeclined?: number;
  approvalRate: number;
  fundingConversion: number;
  submittedConversion: number;
  reviewConversion: number;
  stageBreakdown: StageBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
  brokerPerformance: BrokerPerformanceItem[];
  productMix: ProductMixItem[];
  recentApplications: RecentApplicationItem[];
}

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
];

const STAGE_COLORS: Record<string, string> = {
  SENT: "#0EA5E9",
  IN_REVIEW: "#F59E0B",
  APPROVED: "#10B981",
  FUNDED: "#183b57",
  DECLINED: "#EF4444",
  WITHDRAWN: "#94A3B8",
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatCompactCurrency(value: number) {
  return compactCurrency.format(Number(value || 0));
}

function formatRequestedAmount(value: number | string) {
  if (typeof value === "string") return value;
  return compactCurrency.format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

function formatProductCode(code?: string) {
  if (!code) return "—";
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatChange(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function getStatusBadgeClass(status: string) {
  const styles: Record<string, string> = {
    SENT: "bg-sky-50 text-sky-700 ring-sky-600/15",
    IN_REVIEW: "bg-amber-50 text-amber-700 ring-amber-600/15",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    FUNDED: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
    DECLINED: "bg-rose-50 text-rose-700 ring-rose-600/15",
    WITHDRAWN: "bg-slate-100 text-slate-600 ring-slate-500/10",
  };
  return styles[status] || "bg-slate-100 text-slate-600 ring-slate-500/10";
}

function getLenderFirstName() {
  try {
    const raw = sessionStorage.getItem("lender_user");
    if (!raw) return "Lender";
    const user = JSON.parse(raw);
    return (
      user.firstName ||
      user.name?.trim()?.split(/\s+/)[0] ||
      user.email?.split("@")[0] ||
      "Lender"
    );
  } catch {
    return "Lender";
  }
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 ${className}`}
    />
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  accent,
  comparison,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accent: string;
  comparison?: MetricComparison;
}) {
  const change = formatChange(comparison?.changePercent);
  const showChange =
    change &&
    !(
      comparison &&
      comparison.previous > 0 &&
      comparison.previous < 3 &&
      comparison.current === 0
    );

  return (
    <div
      className="rounded-xl border border-slate-200 border-l-4 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
        </p>
        {showChange ? (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
              (comparison?.changePercent || 0) > 0
                ? "bg-emerald-50 text-emerald-700"
                : (comparison?.changePercent || 0) < 0
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {change}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

export default function Home() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelinePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("12m");

  const firstName = useMemo(() => getLenderFirstName(), []);
  const greeting = useMemo(() => getGreeting(), []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem("lender_token");
      const headers = token
        ? { Authorization: `Bearer ${token}` }
        : undefined;

      const [overviewRes, pipelineRes] = await Promise.all([
        fetch(
          `${API_BASE}/lender/dashboard/overview-stats?period=${period}`,
          { headers },
        ),
        fetch(
          `${API_BASE}/lender/dashboard/pipeline-performance?period=${period}`,
          { headers },
        ),
      ]);

      const [overviewJson, pipelineJson] = await Promise.all([
        overviewRes.json(),
        pipelineRes.json(),
      ]);

      if (!overviewRes.ok || !overviewJson.success) {
        throw new Error(overviewJson.message || "Failed to load overview");
      }
      if (!pipelineRes.ok || !pipelineJson.success) {
        throw new Error(pipelineJson.message || "Failed to load analytics");
      }

      setOverview(overviewJson.data);
      setPipeline(pipelineJson.data);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const kpiCards = overview
    ? [
        {
          label: "Applications",
          value: overview.totalApplications.toLocaleString(),
          helper: `${overview.sentToLender} active in pipeline`,
          icon: <FileSpreadsheet className="h-4 w-4" />,
          accent: "#0ea5e9",
          comparison: overview.comparison?.totalApplications,
        },
        {
          label: "Pending Review",
          value: overview.pendingReview.toLocaleString(),
          helper: `${overview.declined} declined`,
          icon: <Clock3 className="h-4 w-4" />,
          accent: "#f59e0b",
          comparison: overview.comparison?.pendingReview,
        },
        {
          label: "Approved",
          value: (overview.approved + overview.fundedLoans).toLocaleString(),
          helper: `${overview.approvalRate}% approval rate`,
          icon: <TrendingUp className="h-4 w-4" />,
          accent: "#10b981",
          comparison: overview.comparison?.approved,
        },
        {
          label: "Funded",
          value: overview.fundedLoans.toLocaleString(),
          helper: `${overview.fundedRate}% funding rate`,
          icon: <HandCoins className="h-4 w-4" />,
          accent: "#8b5cf6",
          comparison: overview.comparison?.fundedLoans,
        },
        {
          label: "Funded Volume",
          value: formatCompactCurrency(overview.totalFundedVolume),
          helper: `Avg ${formatCompactCurrency(overview.avgLoanSize)}`,
          icon: <CircleDollarSign className="h-4 w-4" />,
          accent: "#f59e0b",
          comparison: overview.comparison?.totalFundedVolume,
        },
        {
          label: "Brokers",
          value: overview.activeBrokers.toLocaleString(),
          helper: `${overview.activeProducts} products · ${overview.activeConnections} links`,
          icon: <Building2 className="h-4 w-4" />,
          accent: BRAND,
          comparison: overview.comparison?.activeBrokers,
        },
      ]
    : [];

  const trend = pipeline?.monthlyTrend || [];
  const hasTrend = trend.some(
    (p) => p.applications > 0 || p.approved > 0 || p.fundedVolume > 0,
  );
  const maxCount = Math.max(
    ...trend.map((p) => Math.max(p.applications, p.approved, p.funded)),
    1,
  );

  const trendOptions: ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "Outfit, sans-serif",
      foreColor: "#94a3b8",
    },
    colors: ["#183b57", "#38BDF8", "#10B981"],
    stroke: { width: [2.5, 2.5, 3], curve: "smooth" },
    fill: {
      type: ["gradient", "gradient", "solid"],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    dataLabels: { enabled: false },
    markers: { size: hasTrend ? 3 : 0, strokeWidth: 0 },
    grid: { borderColor: "#E5E7EB", strokeDashArray: 3 },
    legend: {
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
    },
    xaxis: {
      categories: trend.map((item) => item.label),
      labels: {
        style: { fontSize: "10px" },
        rotate: trend.length > 12 ? -35 : 0,
        hideOverlappingLabels: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      {
        seriesName: "Applications",
        min: 0,
        max: Math.max(4, Math.ceil(maxCount * 1.25)),
        tickAmount: 4,
        labels: { formatter: (v) => String(Math.round(v)) },
        title: { text: "Count", style: { fontSize: "11px" } },
      },
      {
        seriesName: "Approvals",
        show: false,
        min: 0,
        max: Math.max(4, Math.ceil(maxCount * 1.25)),
      },
      {
        seriesName: "Funded Volume",
        opposite: true,
        min: 0,
        labels: { formatter: (v) => formatCompactCurrency(v) },
        title: { text: "Volume", style: { fontSize: "11px" } },
      },
    ],
    tooltip: {
      theme: "light",
      shared: true,
      y: {
        formatter: (value, ctx) =>
          ctx.seriesIndex === 2
            ? formatCompactCurrency(value)
            : String(Math.round(value)),
      },
    },
  };

  const trendSeries = [
    {
      name: "Applications",
      type: "area" as const,
      data: trend.map((item) => item.applications),
    },
    {
      name: "Approvals",
      type: "area" as const,
      data: trend.map((item) => item.approved),
    },
    {
      name: "Funded Volume",
      type: "line" as const,
      data: trend.map((item) => item.fundedVolume),
    },
  ];

  const stages = (pipeline?.stageBreakdown || []).filter((s) => s.count > 0);
  const stageTotal = stages.reduce((sum, s) => sum + s.count, 0);

  const donutOptions: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
    },
    labels: stages.map((s) => s.label),
    colors: stages.map((s) => STAGE_COLORS[s.status] || BRAND),
    legend: {
      position: "bottom",
      fontSize: "11px",
      markers: { size: 7 },
    },
    dataLabels: {
      enabled: true,
      formatter: (_v, opts) =>
        String(stages[opts.seriesIndex]?.count || 0),
      style: { fontSize: "11px", fontWeight: 600 },
      dropShadow: { enabled: false },
    },
    stroke: { colors: ["#fff"], width: 2 },
    tooltip: {
      theme: "light",
      y: {
        formatter: (value) => {
          const pct = stageTotal
            ? ((value / stageTotal) * 100).toFixed(1)
            : "0.0";
          return `${Math.round(value)} apps (${pct}%)`;
        },
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: () => String(stageTotal),
            },
          },
        },
      },
    },
  };

  const products = pipeline?.productMix || [];
  const productMax = Math.max(...products.map((p) => p.applications), 1);

  const brokers = pipeline?.brokerPerformance || [];
  const brokerMax = Math.max(...brokers.map((b) => b.applications), 1);

  const conversions = [
    {
      label: "Submitted",
      value: pipeline?.submittedConversion || 0,
      helper: `${pipeline?.totalSubmitted || 0} of ${pipeline?.totalApplications || 0}`,
      color: "#0EA5E9",
    },
    {
      label: "In Review",
      value: pipeline?.reviewConversion || 0,
      helper: `${pipeline?.totalInReview || 0} under review`,
      color: "#F59E0B",
    },
    {
      label: "Approved",
      value: pipeline?.approvalRate || 0,
      helper: `${pipeline?.totalApproved || 0} cleared`,
      color: "#10B981",
    },
    {
      label: "Funded",
      value: pipeline?.fundingConversion || 0,
      helper: `${pipeline?.totalFunded || 0} closed`,
      color: BRAND,
    },
  ];

  const quickActions = [
    { label: "Pipeline", path: "/loan-pipeline", icon: FileSpreadsheet },
    { label: "Brokers", path: "/brokers", icon: Users },
    { label: "Profile", path: "/profile", icon: UserCircle },
  ];

  return (
    <>
      <PageMeta
        title="Lender Dashboard"
        description="Analytics overview for lender pipeline performance"
      />

      <div className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-[#183b57]/20 bg-gradient-to-r from-[#183b57] via-[#1e4a6b] to-[#2a5f82] px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Lender Dashboard
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
                {greeting}, {firstName}
              </h1>
              <p className="mt-0.5 text-sm text-white/80">
                Pipeline & funding analytics ·{" "}
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
                        ? "bg-white text-[#183b57] shadow-sm"
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
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Pulse key={i} className="h-[108px]" />
              ))
            : kpiCards.map((card) => <KpiCard key={card.label} {...card} />)}
        </div>

        {/* Pipeline stages */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#183b57]">
                Application Pipeline
              </p>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Stage distribution
              </h3>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {loading ? "…" : `${pipeline?.totalApplications || 0} total`}
            </span>
          </div>
          {loading ? (
            <Pulse className="h-16" />
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {(pipeline?.stageBreakdown || []).map((stage) => {
                const total = pipeline?.totalApplications || 0;
                return (
                  <Link
                    key={stage.status}
                    to={`/loan-pipeline?status=${encodeURIComponent(stage.status)}`}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3 transition hover:border-[#183b57]/25 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {stage.label}
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                      {stage.count}
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white dark:bg-slate-900/40">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: total
                            ? `${Math.max(8, (stage.count / total) * 100)}%`
                            : "0%",
                          backgroundColor:
                            STAGE_COLORS[stage.status] || BRAND,
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-8">
            <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#183b57]">
                    Pipeline Momentum
                  </p>
                  <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                    Origination trend
                  </h3>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-right dark:bg-slate-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Funded vol
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCompactCurrency(overview?.totalFundedVolume || 0)}
                  </p>
                </div>
              </div>
              {loading ? (
                <Pulse className="h-[300px]" />
              ) : hasTrend ? (
                <Chart
                  options={trendOptions}
                  series={trendSeries}
                  type="area"
                  height={300}
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  No activity for this period
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 xl:col-span-4">
            <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#183b57]">
                  Status Mix
                </p>
                <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                  Current pipeline
                </h3>
              </div>
              {loading ? (
                <Pulse className="h-[300px]" />
              ) : stages.length > 0 ? (
                <Chart
                  options={donutOptions}
                  series={stages.map((s) => s.count)}
                  type="donut"
                  height={300}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  No data for this period
                </div>
              )}
            </div>
          </div>

          {/* Conversion */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#183b57]">
                Conversion
              </p>
              <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                Funnel efficiency
              </h3>
              {loading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Pulse key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {conversions.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {item.label}
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.value}%
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, item.value))}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.helper}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product mix */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#183b57]">
                Product Mix
              </p>
              <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                By loan product
              </h3>
              {loading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Pulse key={i} className="h-10" />
                  ))}
                </div>
              ) : products.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {products.map((item, index) => (
                    <div key={item.productCode}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">
                          {formatProductCode(item.productCode).toLowerCase()}
                        </p>
                        <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                          {item.applications}
                        </p>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#183b57] to-[#2a5a7a]"
                          style={{
                            width: `${Math.max(
                              8,
                              (item.applications / productMax) * 100,
                            )}%`,
                            opacity: 1 - index * 0.12,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.approved} approved · {item.approvalRate}% rate
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  No product data for this period
                </div>
              )}
            </div>
          </div>

          {/* Top brokers */}
          <div className="col-span-12 xl:col-span-4">
            <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#183b57]">
                Broker Partners
              </p>
              <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                Top by volume
              </h3>
              {loading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Pulse key={i} className="h-10" />
                  ))}
                </div>
              ) : brokers.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {brokers.map((item, index) => (
                    <div key={item.brokerOrgId}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {index + 1}
                          </span>
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {item.brokerName}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                          {item.applications}
                        </p>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                          style={{
                            width: `${Math.max(
                              8,
                              (item.applications / brokerMax) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.funded} funded · {item.approvalRate}% approval
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  No broker activity for this period
                </div>
              )}
            </div>
          </div>

          {/* Recent applications */}
          <div className="col-span-12">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Recent Applications
                  </h2>
                  <p className="text-xs text-slate-500">
                    Latest submissions from broker partners
                  </p>
                </div>
                <Link
                  to="/loan-pipeline"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#183b57] hover:underline"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse bg-slate-50 dark:bg-slate-800/50" />
                  ))}
                </div>
              ) : pipeline?.recentApplications?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2.5 sm:px-5">Application</th>
                        <th className="px-4 py-2.5 sm:px-5">Client</th>
                        <th className="px-4 py-2.5 sm:px-5">Broker</th>
                        <th className="px-4 py-2.5 sm:px-5">Product</th>
                        <th className="px-4 py-2.5 text-right sm:px-5">Amount</th>
                        <th className="px-4 py-2.5 text-center sm:px-5">Status</th>
                        <th className="px-4 py-2.5 sm:px-5">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pipeline.recentApplications.map((item) => (
                        <tr
                          key={item.applicationLenderId}
                          className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#183b57] sm:px-5">
                            {item.applicationNumber || "—"}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white sm:px-5">
                            {item.clientName || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 sm:px-5">
                            {item.brokerName || "—"}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-slate-600 sm:px-5">
                            {formatProductCode(item.productCode).toLowerCase()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-white sm:px-5">
                            {item.amountRequested
                              ? formatRequestedAmount(item.amountRequested)
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center sm:px-5">
                            {item.pipelineStatus ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${getStatusBadgeClass(item.pipelineStatus)}`}
                              >
                                {item.pipelineStatus.replace(/_/g, " ")}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 sm:px-5">
                            {formatDate(item.updatedAt || item.sentAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <FileSpreadsheet className="mx-auto mb-2 h-9 w-9 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    No applications yet
                  </p>
                  <Link
                    to="/loan-pipeline"
                    className="mt-2 inline-flex text-sm font-semibold text-[#183b57] hover:underline"
                  >
                    Open loan pipeline
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
