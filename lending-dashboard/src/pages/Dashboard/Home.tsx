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
  FileText,
  Handshake,
  HandCoins,
  Layers,
  RefreshCw,
  TrendingUp,
  UserCircle,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const BRAND = "#4C78F5";

// Short TTL covers React Strict Mode remounts after the first response lands.
type DashboardCacheEntry = { promise: Promise<any>; expiresAt: number };
const dashboardFetchCache = new Map<string, DashboardCacheEntry>();
const DASHBOARD_FETCH_TTL_MS = 8_000;

async function fetchDashboardJson(path: string) {
  const now = Date.now();
  const hit = dashboardFetchCache.get(path);
  if (hit && hit.expiresAt > now) return hit.promise;

  const token = sessionStorage.getItem("lender_token");
  const request = (async () => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load dashboard data");
    }
    return json;
  })().catch((error) => {
    const current = dashboardFetchCache.get(path);
    if (current?.promise === request) dashboardFetchCache.delete(path);
    throw error;
  });

  dashboardFetchCache.set(path, {
    promise: request,
    expiresAt: now + DASHBOARD_FETCH_TTL_MS,
  });
  return request;
}

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

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string; short: string }[] =
  [
    { value: "7d", label: "Last 7 days", short: "7D" },
    { value: "30d", label: "Last 30 days", short: "30D" },
    { value: "90d", label: "Last 90 days", short: "90D" },
    { value: "12m", label: "Last 12 months", short: "12M" },
  ];

const FUNNEL_STAGES = [
  { status: "SENT", label: "Sent", color: "#38BDF8" },
  { status: "IN_REVIEW", label: "In Review", color: "#818CF8" },
  { status: "APPROVED", label: "Approved", color: "#34D399" },
  { status: "FUNDED", label: "Funded", color: "#4C78F5" },
  { status: "DECLINED", label: "Declined", color: "#F87171" },
  { status: "WITHDRAWN", label: "Withdrawn", color: "#94A3B8" },
] as const;

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

function getStatusBadgeClass(status?: string) {
  const s = status?.toLowerCase();

  switch (s) {
    case "new":
    case "sent":
    case "selected":
    case "in_review":
      return "bg-sky-50 text-sky-700";
    case "pending":
    case "conditional":
      return "bg-amber-50 text-amber-700";
    case "client_pending":
      return "bg-rose-50 text-rose-700";
    case "submitted":
      return "bg-brand-50 text-brand-600";
    case "approved":
    case "auto_approved":
    case "lender_approved":
      return "bg-emerald-50 text-emerald-700";
    case "declined":
    case "rejected":
    case "auto_declined":
    case "withdrawn":
    case "lender_declined":
      return "bg-rose-50 text-rose-700";
    case "draft":
      return "bg-slate-100 text-slate-600";
    case "incomplete":
    case "superseded":
    case "suspended":
      return "bg-orange-50 text-orange-700";
    case "completed":
    case "funded":
      return "bg-emerald-50 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
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

function Widget({
  title,
  subtitle = "This period",
  loading,
  children,
  right,
  minHeight = "320px",
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children?: ReactNode;
  right?: ReactNode;
  minHeight?: string;
}) {
  return (
    <div
      className="flex h-full flex-col rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      style={{ minHeight }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold leading-tight text-text-primary dark:text-white">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-text-secondary">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
      {loading ? (
        <div className="flex flex-1 animate-pulse rounded-xl bg-surface dark:bg-slate-800" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      )}
    </div>
  );
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  return `${Math.max(0, value).toFixed(2)}%`;
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  tone,
  comparison,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone: string;
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
    <div className="rounded-2xl border border-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
              {label}
            </p>
            {showChange ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
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
          <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-text-primary dark:text-white">
            {value}
          </p>
          <p className="mt-2 truncate text-[12px] text-text-secondary">{helper}</p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
        >
          {icon}
        </span>
      </div>
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

  const load = useCallback(
    async (options?: { force?: boolean; isActive?: () => boolean }) => {
      const isActive = options?.isActive;
      if (!isActive || isActive()) {
        setLoading(true);
        setError(null);
      }

      try {
        const overviewPath = `/lender/dashboard/overview-stats?period=${period}`;
        const pipelinePath = `/lender/dashboard/pipeline-performance?period=${period}`;

        if (options?.force) {
          dashboardFetchCache.delete(overviewPath);
          dashboardFetchCache.delete(pipelinePath);
        }

        const [overviewJson, pipelineJson] = await Promise.all([
          fetchDashboardJson(overviewPath),
          fetchDashboardJson(pipelinePath),
        ]);
        if (isActive && !isActive()) return;

        setOverview(overviewJson.data);
        setPipeline(pipelineJson.data);
      } catch (err) {
        if (isActive && !isActive()) return;
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to load dashboard";
        setError(message);
        toast.error(message);
      } finally {
        if (!isActive || isActive()) {
          setLoading(false);
        }
      }
    },
    [period],
  );

  useEffect(() => {
    let active = true;
    void load({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [load]);

  const kpiCards = overview
    ? [
        {
          label: "Applications",
          value: overview.totalApplications.toLocaleString(),
          helper: `${overview.sentToLender} active in pipeline`,
          icon: <FileSpreadsheet className="h-5 w-5" />,
          tone: "bg-sky-50 text-sky-600",
          comparison: overview.comparison?.totalApplications,
        },
        {
          label: "Pending Review",
          value: overview.pendingReview.toLocaleString(),
          helper: `${overview.declined} declined`,
          icon: <Clock3 className="h-5 w-5" />,
          tone: "bg-amber-50 text-amber-600",
          comparison: overview.comparison?.pendingReview,
        },
        {
          label: "Approved",
          value: (overview.approved + overview.fundedLoans).toLocaleString(),
          helper: `${overview.approvalRate}% approval rate`,
          icon: <TrendingUp className="h-5 w-5" />,
          tone: "bg-emerald-50 text-emerald-600",
          comparison: overview.comparison?.approved,
        },
        {
          label: "Funded",
          value: overview.fundedLoans.toLocaleString(),
          helper: `${overview.fundedRate}% funding rate`,
          icon: <HandCoins className="h-5 w-5" />,
          tone: "bg-violet-50 text-violet-600",
          comparison: overview.comparison?.fundedLoans,
        },
        {
          label: "Funded Volume",
          value: formatCompactCurrency(overview.totalFundedVolume),
          helper: `Avg ${formatCompactCurrency(overview.avgLoanSize)}`,
          icon: <CircleDollarSign className="h-5 w-5" />,
          tone: "bg-teal-50 text-teal-700",
          comparison: overview.comparison?.totalFundedVolume,
        },
        {
          label: "Brokers",
          value: overview.activeBrokers.toLocaleString(),
          helper: `${overview.activeProducts} products · ${overview.activeConnections} links`,
          icon: <Building2 className="h-5 w-5" />,
          tone: "bg-[#4C78F5]/10 text-[#4C78F5]",
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
      fontFamily: "Inter, sans-serif",
      foreColor: "#94a3b8",
    },
    colors: ["#4C78F5", "#38BDF8", "#10B981"],
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

  const stageCounts = Object.fromEntries(
    (pipeline?.stageBreakdown || []).map((stage) => [stage.status, stage.count]),
  );
  const funnelRows = FUNNEL_STAGES.map((stage) => ({
    ...stage,
    count: Number(stageCounts[stage.status] || 0),
  }));
  const funnelTotal = funnelRows.reduce((sum, row) => sum + row.count, 0);
  const funnelComputed = funnelRows.map((row, index) => {
    const remaining = funnelRows
      .slice(index)
      .reduce((sum, item) => sum + item.count, 0);
    const nextCount = funnelRows[index + 1]?.count ?? 0;
    const isLast = index === funnelRows.length - 1;
    return {
      ...row,
      cumulative: funnelTotal > 0 ? (remaining / funnelTotal) * 100 : isLast ? 0 : 100,
      nextStep: isLast ? 0 : row.count <= 0 ? 100 : (nextCount / row.count) * 100,
    };
  });

  const openCount =
    Number(stageCounts.SENT || 0) +
    Number(stageCounts.IN_REVIEW || 0) +
    Number(stageCounts.APPROVED || 0);
  const fundedCount = Number(stageCounts.FUNDED || 0);
  const lostCount =
    Number(stageCounts.DECLINED || 0) + Number(stageCounts.WITHDRAWN || 0);
  const statusSlices = [
    { key: "OPEN", label: "Open", count: openCount, color: "#4C78F5" },
    { key: "FUNDED", label: "Funded", count: fundedCount, color: "#10B981" },
    ...(lostCount > 0
      ? [{ key: "LOST", label: "Lost", count: lostCount, color: "#EF4444" }]
      : []),
  ];
  const statusTotal = statusSlices.reduce((sum, slice) => sum + slice.count, 0);
  const valueRows = [
    { label: "Open", value: openCount, color: "#4C78F5" },
    { label: "Funded", value: fundedCount, color: "#10B981" },
    ...(lostCount > 0
      ? [{ label: "Lost", value: lostCount, color: "#EF4444" }]
      : []),
  ];
  const valueMax = Math.max(...valueRows.map((row) => row.value), 1);

  const stages = funnelRows;
  const stageTotal = funnelTotal;
  const conversionRate = Number(overview?.fundedRate || pipeline?.fundingConversion || 0);

  const statusDonutOptions: ApexOptions = {
    chart: { fontFamily: "Inter, sans-serif", toolbar: { show: false } },
    labels: statusSlices.map((slice) => slice.label),
    colors: statusSlices.map((slice) => slice.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { colors: ["#fff"], width: 2 },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(value)} apps` },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "78%",
          labels: {
            show: true,
            name: { show: false },
            value: {
              show: true,
              fontSize: "28px",
              fontWeight: 600,
              color: "#1f2328",
              offsetY: 8,
            },
            total: {
              show: true,
              showAlways: true,
              label: "",
              fontSize: "28px",
              fontWeight: 600,
              color: "#1f2328",
              formatter: () => String(statusTotal),
            },
          },
        },
      },
    },
  };

  const stagesDonutOptions: ApexOptions = {
    chart: { fontFamily: "Inter, sans-serif", toolbar: { show: false } },
    labels: stages.filter((s) => s.count > 0).map((s) => s.label),
    colors: stages.filter((s) => s.count > 0).map((s) => s.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { colors: ["#fff"], width: 2 },
    tooltip: {
      theme: "light",
      y: {
        formatter: (value) => {
          const pct = stageTotal ? ((value / stageTotal) * 100).toFixed(2) : "0.00";
          return `${Math.round(value)} apps (${pct}%)`;
        },
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "78%",
          labels: {
            show: true,
            name: { show: false },
            value: {
              show: true,
              fontSize: "28px",
              fontWeight: 600,
              color: "#1f2328",
              offsetY: 8,
            },
            total: {
              show: true,
              showAlways: true,
              label: "",
              fontSize: "28px",
              fontWeight: 600,
              color: "#1f2328",
              formatter: () => String(stageTotal),
            },
          },
        },
      },
    },
  };

  const pipelineValueOptions: ApexOptions = {
    chart: { fontFamily: "Inter, sans-serif", toolbar: { show: false } },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 8, barHeight: "58%", distributed: true },
    },
    colors: valueRows.map((row) => row.color),
    dataLabels: {
      enabled: true,
      formatter: (val) => String(Math.round(Number(val))),
      style: { fontSize: "11px", fontWeight: 700, colors: ["#fff"] },
    },
    legend: { show: false },
    grid: {
      borderColor: "#EEF2F6",
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    xaxis: {
      categories: valueRows.map((row) => row.label),
      min: 0,
      max: Math.max(1, Math.ceil(valueMax * 1.15)),
      labels: {
        style: { colors: "#9aa0a6", fontSize: "11px" },
        formatter: (value) => String(Math.round(Number(value))),
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(value)} applications` },
    },
  };

  const conversionOptions: ApexOptions = {
    chart: { fontFamily: "Inter, sans-serif", toolbar: { show: false } },
    colors: [BRAND],
    plotOptions: {
      radialBar: {
        hollow: { size: "78%", background: "transparent" },
        track: { background: "#EEF3FE", strokeWidth: "100%", margin: 0 },
        dataLabels: {
          name: { show: false },
          value: {
            show: true,
            fontSize: "26px",
            fontWeight: 600,
            color: "#1f2328",
            offsetY: 8,
            formatter: () => `${Number(conversionRate).toFixed(2)}%`,
          },
        },
      },
    },
    stroke: { lineCap: "round" },
  };

  const products = pipeline?.productMix || [];
  const productMax = Math.max(...products.map((p) => p.applications), 1);

  const brokers = pipeline?.brokerPerformance || [];
  const brokerMax = Math.max(...brokers.map((b) => b.applications), 1);

  const quickActions = [
    {
      label: "Pipeline",
      path: "/loan-pipeline",
      icon: FileSpreadsheet,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "Programs",
      path: "/all-loan-products",
      icon: Layers,
      tone: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Brokers",
      path: "/brokers",
      icon: Handshake,
      tone: "bg-teal-50 text-teal-700",
    },
    {
      label: "Documents",
      path: "/documents",
      icon: FileText,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Profile",
      path: "/profile",
      icon: UserCircle,
      tone: "bg-violet-50 text-violet-600",
    },
  ];

  const activeStages = stages.filter((stage) => stage.count > 0);

  return (
    <>
      <PageMeta
        title="Lender Dashboard"
        description="Analytics overview for lender pipeline performance"
      />

      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-brand-500">
                {greeting}, {firstName}
              </p>
              <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-text-primary dark:text-white">
                Lender Dashboard
              </h1>
              <p className="mt-1 text-[13px] text-text-secondary">
                Funding analytics for{" "}
                {PERIOD_OPTIONS.find((option) => option.value === period)?.label?.toLowerCase()}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border dark:bg-slate-800 dark:ring-slate-700">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      period === option.value
                        ? "bg-brand-500 text-white"
                        : "text-text-secondary hover:text-text-primary dark:text-slate-300"
                    }`}
                  >
                    {option.short}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void load({ force: true })}
                disabled={loading}
                title="Refresh"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-text-secondary transition hover:bg-surface disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              <Link
                to="/loan-pipeline"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Open pipeline
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:border-brand-200 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${action.tone}`}
                >
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="truncate text-[13px] font-semibold text-text-primary dark:text-slate-200">
                  {action.label}
                </span>
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
                onClick={() => void load({ force: true })}
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

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4">
            <Widget title="Application Status" loading={loading}>
              <div className="flex min-h-0 flex-1 items-center gap-4">
                <div className="flex min-w-0 flex-1 items-center justify-center">
                  {statusTotal > 0 ? (
                    <Chart
                      options={statusDonutOptions}
                      series={statusSlices.map((slice) => slice.count)}
                      type="donut"
                      height={220}
                    />
                  ) : (
                    <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-[14px] border-[#eef2f6] text-[28px] font-semibold text-slate-800 dark:border-slate-700 dark:text-white">
                      0
                    </div>
                  )}
                </div>
                <ul className="w-[128px] shrink-0 space-y-2">
                  {statusSlices.map((slice) => (
                    <li key={slice.key}>
                      <Link
                        to={
                          slice.key === "OPEN"
                            ? "/loan-pipeline"
                            : `/loan-pipeline?status=${slice.key === "FUNDED" ? "FUNDED" : "DECLINED"}`
                        }
                        className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-2.5 py-2 transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="truncate text-[13px] font-medium text-slate-600 dark:text-slate-300">
                            {slice.label}
                          </span>
                        </span>
                        <span className="text-[13px] font-bold text-slate-900 dark:text-white">
                          {slice.count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Widget>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Widget title="Pipeline Value" loading={loading}>
              <div className="min-h-0 flex-1">
                <Chart
                  options={pipelineValueOptions}
                  series={[
                    {
                      name: "Applications",
                      data: valueRows.map((row) => ({ x: row.label, y: row.value })),
                    },
                  ]}
                  type="bar"
                  height={200}
                />
              </div>
              <p className="mt-1 text-center text-[13px] text-slate-500">
                Total applications{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {pipeline?.totalApplications || statusTotal}
                </span>
              </p>
            </Widget>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Widget title="Conversion Rate" loading={loading}>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                <Chart
                  options={conversionOptions}
                  series={[conversionRate]}
                  type="radialBar"
                  height={220}
                />
                <p className="-mt-2 text-[13px] text-slate-500">
                  Funded volume{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCompactCurrency(overview?.totalFundedVolume || 0)}
                  </span>
                </p>
              </div>
            </Widget>
          </div>

          <div className="col-span-12 xl:col-span-7">
            <Widget title="Funnel" loading={loading}>
              <div className="flex min-h-0 flex-1 gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-5" />
                  {funnelComputed.map((row) => (
                    <Link
                      key={row.status}
                      to={`/loan-pipeline?status=${encodeURIComponent(row.status)}`}
                      className="flex h-10 w-full items-center justify-between rounded-xl px-3.5 text-left text-[13px] font-semibold text-white shadow-[0_6px_14px_rgba(15,23,42,0.12)] transition hover:brightness-95"
                      style={{ backgroundColor: row.color }}
                    >
                      <span className="truncate">{row.label}</span>
                      <span className="tabular-nums">{row.count}</span>
                    </Link>
                  ))}
                </div>
                <div className="hidden w-[76px] shrink-0 flex-col sm:flex sm:w-[88px]">
                  <p className="mb-1.5 h-5 text-center text-[10px] font-medium leading-tight text-slate-400">
                    Cumulative
                  </p>
                  {funnelComputed.map((row) => (
                    <div
                      key={`${row.status}-cum`}
                      className="mb-1.5 flex h-10 items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      style={{ clipPath: "polygon(0 0, 100% 0, 86% 100%, 14% 100%)" }}
                    >
                      {formatPct(row.cumulative)}
                    </div>
                  ))}
                </div>
                <div className="hidden w-[84px] shrink-0 flex-col sm:flex sm:w-[96px]">
                  <p className="mb-1.5 h-5 text-center text-[10px] font-medium leading-tight text-slate-400">
                    Next step conversion
                  </p>
                  {funnelComputed.map((row) => (
                    <div
                      key={`${row.status}-next`}
                      className="mb-1.5 flex h-10 items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      style={{ clipPath: "polygon(0 0, 100% 0, 86% 100%, 14% 100%)" }}
                    >
                      {formatPct(row.nextStep)}
                    </div>
                  ))}
                </div>
              </div>
            </Widget>
          </div>

          <div className="col-span-12 xl:col-span-5">
            <Widget title="Stages Distribution" loading={loading}>
              <div className="flex min-h-0 flex-1 items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center justify-center">
                  {activeStages.length > 0 ? (
                    <Chart
                      options={stagesDonutOptions}
                      series={activeStages.map((stage) => stage.count)}
                      type="donut"
                      height={230}
                    />
                  ) : (
                    <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-[14px] border-[#eef2f6] text-[28px] font-semibold text-slate-800 dark:border-slate-700 dark:text-white">
                      0
                    </div>
                  )}
                </div>
                <ul className="max-h-[240px] w-[148px] shrink-0 space-y-1.5 overflow-y-auto pr-1">
                  {funnelRows.map((row) => {
                    const pct = stageTotal
                      ? ((row.count / stageTotal) * 100).toFixed(2)
                      : "0.00";
                    return (
                      <li key={row.status}>
                        <Link
                          to={`/loan-pipeline?status=${encodeURIComponent(row.status)}`}
                          className="flex w-full items-start gap-2 text-left hover:opacity-80"
                        >
                          <span
                            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] text-slate-600 dark:text-slate-300">
                              {row.label}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              {pct}% · {row.count}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Widget>
          </div>

          <div className="col-span-12 xl:col-span-8">
            <Widget
              title="Pipeline Momentum"
              subtitle="Origination trend"
              loading={loading}
              right={
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">Funded volume</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCompactCurrency(overview?.totalFundedVolume || 0)}
                  </p>
                </div>
              }
            >
              {hasTrend ? (
                <Chart
                  options={trendOptions}
                  series={trendSeries}
                  type="area"
                  height={300}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  No activity for this period
                </div>
              )}
            </Widget>
          </div>

          <div className="col-span-12 xl:col-span-4">
            <Widget title="Product Mix" subtitle="By loan product" loading={loading}>
              {products.length > 0 ? (
                <div className="space-y-3">
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
                          className="h-full rounded-full bg-gradient-to-r from-[#4C78F5] to-[#2a5a7a]"
                          style={{
                            width: `${Math.max(8, (item.applications / productMax) * 100)}%`,
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
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  No product data for this period
                </div>
              )}
            </Widget>
          </div>

          <div className="col-span-12">
            <Widget title="Broker Partners" subtitle="Top by volume" loading={loading}>
              {brokers.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {brokers.map((item, index) => (
                    <div key={item.brokerOrgId}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4C78F5]/10 text-[11px] font-semibold text-[#4C78F5]">
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
                            width: `${Math.max(8, (item.applications / brokerMax) * 100)}%`,
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
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800">
                  No broker activity for this period
                </div>
              )}
            </Widget>
          </div>

          {/* Recent applications */}
          <div className="col-span-12">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                    Recent Applications
                  </h2>
                  <p className="text-[12px] text-slate-400">
                    Latest submissions from broker partners
                  </p>
                </div>
                <Link
                  to="/loan-pipeline"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4C78F5] hover:underline"
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
                  <table className="ds-table min-w-[860px]">
                    <thead>
                      <tr>
                        <th>Deal</th>
                        <th>Broker</th>
                        <th>Product</th>
                        <th>Amount</th>
                        <th>Stage</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipeline.recentApplications.map((item) => (
                        <tr key={item.applicationLenderId}>
                          <td>
                            <p className="ds-table-title">
                              {item.clientName || "—"}
                            </p>
                            <p className="ds-table-meta font-mono text-brand-500">
                              {item.applicationNumber || "—"}
                            </p>
                          </td>
                          <td className="ds-table-muted">
                            {item.brokerName || "—"}
                          </td>
                          <td className="ds-table-muted capitalize">
                            {formatProductCode(item.productCode).toLowerCase()}
                          </td>
                          <td className="ds-table-amount">
                            {item.amountRequested
                              ? formatRequestedAmount(item.amountRequested)
                              : "—"}
                          </td>
                          <td>
                            {item.pipelineStatus ? (
                              <span
                                className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStatusBadgeClass(item.pipelineStatus)}`}
                              >
                                {item.pipelineStatus.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span className="ds-table-empty">—</span>
                            )}
                          </td>
                          <td className="ds-table-meta !mt-0">
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
                    className="mt-2 inline-flex text-sm font-semibold text-[#4C78F5] hover:underline"
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
