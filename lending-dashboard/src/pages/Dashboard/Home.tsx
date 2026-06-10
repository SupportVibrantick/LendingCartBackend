import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  HandCoins,
  Layers,
  Loader2,
  TrendingUp,
  UserCircle,
} from "lucide-react";

import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const TEAL = "#134E4A";

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
}

interface StageBreakdownItem {
  status: string;
  label: string;
  count: number;
}

interface MonthlyTrendItem {
  key: string;
  label: string;
  applications: number;
  approved: number;
  funded: number;
  fundedVolume: number;
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
  approvalRate: number;
  fundingConversion: number;
  submittedConversion: number;
  reviewConversion: number;
  stageBreakdown: StageBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
  recentApplications: RecentApplicationItem[];
}

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

function getLenderDisplayName() {
  try {
    const raw = sessionStorage.getItem("lender_user");
    if (!raw) return "Lender";
    const user = JSON.parse(raw);
    return (
      user.name?.trim() ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "Lender"
    );
  } catch {
    return "Lender";
  }
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  accentColor,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accentColor: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{helper}</p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
          style={{
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function DashboardSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PulseLoader({ height }: { height: string }) {
  return (
    <div
      className={`${height} animate-pulse rounded-2xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800`}
    />
  );
}

function FunnelCard({
  label,
  value,
  desc,
  icon,
  color,
}: {
  label: string;
  value?: number;
  desc: string;
  icon: ReactNode;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}14`, color }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {pct}%
          </p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{desc}</p>
    </div>
  );
}

export default function Home() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelinePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const lenderName = useMemo(() => getLenderDisplayName(), []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem("lender_token");
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const [overviewRes, pipelineRes] = await Promise.all([
          fetch(`${API_BASE}/lender/dashboard/overview-stats`, { headers }),
          fetch(`${API_BASE}/lender/dashboard/pipeline-performance`, {
            headers,
          }),
        ]);

        const [overviewJson, pipelineJson] = await Promise.all([
          overviewRes.json(),
          pipelineRes.json(),
        ]);

        if (!overviewRes.ok || !overviewJson.success) {
          throw new Error("Failed to load overview");
        }
        if (!pipelineRes.ok || !pipelineJson.success) {
          throw new Error("Failed to load analytics");
        }

        setOverview(overviewJson.data);
        setPipeline(pipelineJson.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const metricCards = overview
    ? [
        {
          label: "Total Applications",
          value: overview.totalApplications.toLocaleString(),
          helper: `${overview.sentToLender} in active pipeline`,
          icon: <FileSpreadsheet className="h-5 w-5" />,
          accentColor: "#0ea5e9",
        },
        {
          label: "Approval Rate",
          value: `${overview.approvalRate}%`,
          helper: `${overview.approved + overview.fundedLoans} cleared review`,
          icon: <TrendingUp className="h-5 w-5" />,
          accentColor: "#10b981",
        },
        {
          label: "Funded Volume",
          value: formatCompactCurrency(overview.totalFundedVolume),
          helper: `${overview.fundedLoans} funded deal${overview.fundedLoans === 1 ? "" : "s"}`,
          icon: <CircleDollarSign className="h-5 w-5" />,
          accentColor: "#f59e0b",
        },
        {
          label: "Average Loan Size",
          value: formatCompactCurrency(overview.avgLoanSize),
          helper: `${overview.fundedRate}% funding conversion`,
          icon: <HandCoins className="h-5 w-5" />,
          accentColor: "#8b5cf6",
        },
        {
          label: "Pending Review",
          value: overview.pendingReview.toLocaleString(),
          helper: `${overview.declined} declined · ${overview.activeConnections} broker links`,
          icon: <Clock3 className="h-5 w-5" />,
          accentColor: "#eab308",
        },
        {
          label: "Broker Coverage",
          value: overview.activeBrokers.toLocaleString(),
          helper: `${overview.activeProducts} active loan product${overview.activeProducts === 1 ? "" : "s"}`,
          icon: <Building2 className="h-5 w-5" />,
          accentColor: TEAL,
        },
      ]
    : [];

  const stageBreakdownSeries =
    pipeline?.stageBreakdown.map((item) => item.count) || [];

  const stageChartOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit" },
    labels: pipeline?.stageBreakdown.map((item) => item.label) || [],
    legend: { show: false },
    colors: ["#0ea5e9", "#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#64748b"],
    dataLabels: { enabled: false },
    stroke: { colors: ["#ffffff"], width: 3 },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { show: true, color: "#64748b", fontSize: "11px" },
            value: {
              show: true,
              color: "#0f172a",
              fontSize: "22px",
              fontWeight: "700",
            },
            total: {
              show: true,
              label: "Total",
              color: "#64748b",
              fontSize: "11px",
              formatter: () => `${pipeline?.totalApplications || 0}`,
            },
          },
        },
      },
    },
  };

  const monthlyTrendOptions: ApexOptions = {
    chart: {
      type: "line",
      stacked: false,
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "inherit",
      foreColor: "#94a3b8",
    },
    colors: ["#3b82f6", "#10b981", "#f59e0b"],
    stroke: { width: [0, 3, 2], curve: "smooth" },
    plotOptions: { bar: { columnWidth: "40%", borderRadius: 8 } },
    fill: {
      type: ["solid", "solid", "gradient"],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.04,
        stops: [0, 90, 100],
      },
    },
    dataLabels: { enabled: false },
    markers: { size: [0, 4, 0], hover: { sizeOffset: 2 } },
    grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      labels: { colors: "#475569" },
    },
    xaxis: {
      categories: pipeline?.monthlyTrend.map((item) => item.label) || [],
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      { title: { text: "Count", style: { color: "#64748b", fontSize: "11px" } } },
      {
        opposite: true,
        title: {
          text: "Volume",
          style: { color: "#64748b", fontSize: "11px" },
        },
        labels: { formatter: (v) => formatCompactCurrency(v) },
      },
    ],
  };

  const monthlyTrendSeries = [
    {
      name: "Applications",
      type: "bar" as const,
      data: pipeline?.monthlyTrend.map((item) => item.applications) || [],
    },
    {
      name: "Approvals",
      type: "line" as const,
      data: pipeline?.monthlyTrend.map((item) => item.approved) || [],
    },
    {
      name: "Funded Volume",
      type: "area" as const,
      data: pipeline?.monthlyTrend.map((item) => item.fundedVolume) || [],
    },
  ];

  const recentCount = pipeline?.recentApplications?.length || 0;

  return (
    <>
      <PageMeta
        title="Lender Dashboard"
        description="Analytics overview for lender pipeline performance"
      />

      <div className="space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-gradient-to-r from-[#134E4A] to-[#0f766e] px-6 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-100/70">
                  Dashboard
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-white">
                  Welcome back, {lenderName}
                </h1>
                <p className="mt-1 max-w-xl text-sm text-teal-50/80">
                  Track pipeline activity, funding performance, and broker
                  submissions at a glance.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/loan-pipeline"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#134E4A] shadow-sm transition hover:bg-teal-50"
                >
                  Loan Pipeline
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
                >
                  <UserCircle size={16} />
                  Profile
                </Link>
              </div>
            </div>
          </div>

          {!loading && overview && (
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800 lg:grid-cols-4">
              {[
                {
                  label: "In pipeline",
                  value: overview.sentToLender,
                },
                {
                  label: "Approved",
                  value: overview.approved + overview.fundedLoans,
                },
                {
                  label: "Pending review",
                  value: overview.pendingReview,
                },
                {
                  label: "Active products",
                  value: overview.activeProducts,
                },
              ].map((item) => (
                <div key={item.label} className="px-5 py-4 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {item.value}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <PulseLoader key={i} height="h-[132px]" />
              ))
            : metricCards.map((card) => (
                <MetricCard key={card.label} {...card} />
              ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <DashboardSection
              title="Performance Trend"
              subtitle="Applications, approvals, and funded volume over the last 6 months"
              action={
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  6 months
                </span>
              }
            >
              {loading ? (
                <PulseLoader height="h-[320px]" />
              ) : (
                <Chart
                  options={monthlyTrendOptions}
                  series={monthlyTrendSeries}
                  type="line"
                  height={320}
                />
              )}
            </DashboardSection>
          </div>

          <div className="xl:col-span-4">
            <DashboardSection
              title="Pipeline Mix"
              subtitle="Applications by current stage"
            >
              {loading ? (
                <PulseLoader height="h-[320px]" />
              ) : (
                <div className="space-y-4">
                  <Chart
                    options={stageChartOptions}
                    series={stageBreakdownSeries}
                    type="donut"
                    height={220}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {pipeline?.stageBreakdown.slice(0, 4).map((item, index) => (
                      <div
                        key={item.status}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                stageChartOptions.colors?.[index] || TEAL,
                            }}
                          />
                          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {item.label}
                          </p>
                        </div>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {item.count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DashboardSection>
          </div>
        </div>

        {/* Recent applications */}
        <DashboardSection
          title="Recent Applications"
          subtitle="Latest submissions from broker partners"
          action={
            <div className="flex items-center gap-2">
              {!loading && (
                <span className="rounded-lg bg-[#134E4A]/10 px-2.5 py-1 text-[11px] font-semibold text-[#134E4A]">
                  {recentCount} shown
                </span>
              )}
              <Link
                to="/loan-pipeline"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#134E4A] hover:bg-[#134E4A]/5"
              >
                View all
                <ArrowUpRight size={14} />
              </Link>
            </div>
          }
        >
          {loading ? (
            <PulseLoader height="h-56" />
          ) : pipeline?.recentApplications?.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                      <th className="px-4 py-3">Application</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Broker</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {pipeline.recentApplications.map((item) => (
                      <tr
                        key={item.applicationLenderId}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-semibold text-[#134E4A]">
                            {item.applicationNumber || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800 dark:text-slate-100">
                          {item.clientName || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          {item.brokerName || "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex max-w-[180px] truncate rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {formatProductCode(item.productCode)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                          {item.amountRequested
                            ? formatRequestedAmount(item.amountRequested)
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {item.pipelineStatus ? (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getStatusBadgeClass(item.pipelineStatus)}`}
                            >
                              {item.pipelineStatus.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {formatDate(item.updatedAt || item.sentAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-800/30">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#134E4A]/10 text-[#134E4A]">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                No applications yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                When brokers submit deals to your programs, they will appear
                here and in your loan pipeline.
              </p>
              <Link
                to="/loan-pipeline"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#134E4A] px-4 py-2 text-sm font-semibold text-white"
              >
                Open Loan Pipeline
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </DashboardSection>

        {/* Funnel metrics */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Conversion Funnel
              </h3>
              <p className="text-xs text-slate-500">
                How applications move through your pipeline
              </p>
            </div>
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <PulseLoader key={i} height="h-[120px]" />
                ))
              : [
                  {
                    label: "Submitted",
                    value: pipeline?.submittedConversion,
                    desc: `${pipeline?.totalSubmitted || 0} of ${pipeline?.totalApplications || 0} applications`,
                    icon: <BarChart3 className="h-5 w-5" />,
                    color: "#0ea5e9",
                  },
                  {
                    label: "In Review",
                    value: pipeline?.reviewConversion,
                    desc: `${pipeline?.totalInReview || 0} currently under review`,
                    icon: <Clock3 className="h-5 w-5" />,
                    color: "#f59e0b",
                  },
                  {
                    label: "Approved",
                    value: pipeline?.approvalRate,
                    desc: `${pipeline?.totalApproved || 0} passed validation`,
                    icon: <TrendingUp className="h-5 w-5" />,
                    color: "#10b981",
                  },
                  {
                    label: "Funded",
                    value: pipeline?.fundingConversion,
                    desc: `${pipeline?.totalFunded || 0} deals closed`,
                    icon: <Layers className="h-5 w-5" />,
                    color: TEAL,
                  },
                ].map((box) => (
                  <FunnelCard key={box.label} {...box} />
                ))}
          </div>
        </div>
      </div>
    </>
  );
}
