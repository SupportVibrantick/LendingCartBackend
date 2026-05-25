import { useEffect, useState, type ReactNode } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Building2,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  HandCoins,
  TrendingUp,
} from "lucide-react";

import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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

interface BrokerPerformanceItem {
  brokerOrgId: string;
  brokerName: string;
  applications: number;
  approved: number;
  funded: number;
  approvalRate: number;
}

interface ProductMixItem {
  productCode: string;
  applications: number;
  approved: number;
  funded: number;
  approvalRate: number;
}

interface RecentApplicationItem {
  applicationLenderId: string;
  applicationId: string | null;
  applicationNumber: string;
  clientName: string;
  brokerName: string;
  productCode: string;
  amountRequested: number | string; // Handled potential string representations like 5B/1M safely
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
  brokerPerformance: BrokerPerformanceItem[];
  productMix: ProductMixItem[];
  recentApplications: RecentApplicationItem[];
}

// const currency = new Intl.NumberFormat("en-US", {
//   style: "currency",
//   currency: "USD",
//   maximumFractionDigits: 0,
// });

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

// function formatCurrency(value: number) {
//   return currency.format(Number(value || 0));
// }

function formatCompactCurrency(value: number) {
  return compactCurrency.format(Number(value || 0));
}

function formatRequestedAmount(value: number | string) {
  if (typeof value === "string") return value;
  return compactCurrency.format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return dateFormatter.format(new Date(value));
}

function getStatusBadgeClass(status: string) {
  const styles: Record<string, string> = {
    SENT: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20",
    IN_REVIEW: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
    FUNDED: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20",
    DECLINED: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
    WITHDRAWN: "bg-slate-50 text-slate-600 ring-1 ring-slate-600/20",
  };
  return (
    styles[status] || "bg-slate-50 text-slate-600 ring-1 ring-slate-600/10"
  );
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
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5
      transition-all duration-200 hover:border-slate-300"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </h3>
        </div>

        {/* ICON */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${accentColor}12`,
            color: accentColor,
          }}
        >
          <div className="scale-90">{icon}</div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-4 flex items-start gap-2">
        <div
          className="mt-1.5 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accentColor }}
        />

        <p className="text-xs leading-relaxed text-slate-500">{helper}</p>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">
            {title}
          </h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {action && <div className="self-start sm:self-center">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function PulseLoader({ height }: { height: string }) {
  return <div className={`${height} animate-pulse rounded-2xl bg-slate-100`} />;
}

export default function Home() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelinePerformance | null>(null);
  const [loading, setLoading] = useState(true);

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

        if (!overviewRes.ok || !overviewJson.success)
          throw new Error("Failed to load overview");
        if (!pipelineRes.ok || !pipelineJson.success)
          throw new Error("Failed to load analytics");

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
          helper: `${overview.sentToLender} active pipeline opportunities.`,
          icon: <FileSpreadsheet className="h-5 w-5" />,
          accentColor: "#0ea5e9",
        },
        {
          label: "Approval Rate",
          value: `${overview.approvalRate}%`,
          helper: `${overview.approved + overview.fundedLoans} decisions cleared review.`,
          icon: <TrendingUp className="h-5 w-5" />,
          accentColor: "#10b981",
        },
        {
          label: "Funded Volume",
          value: formatCompactCurrency(overview.totalFundedVolume),
          helper: `${overview.fundedLoans} items actively contributing to total booked volume.`,
          icon: <CircleDollarSign className="h-5 w-5" />,
          accentColor: "#f59e0b",
        },
        {
          label: "Average Loan Size",
          value: formatCompactCurrency(overview.avgLoanSize),
          helper: `${overview.fundedRate}% conversion flow towards closing.`,
          icon: <BadgeDollarSign className="h-5 w-5" />,
          accentColor: "#8b5cf6",
        },
        {
          label: "Pending Review",
          value: overview.pendingReview.toLocaleString(),
          helper: `${overview.declined} declined records & ${overview.activeConnections} active links.`,
          icon: <Clock3 className="h-5 w-5" />,
          accentColor: "#eab308",
        },
        {
          label: "Broker Coverage",
          value: overview.activeBrokers.toLocaleString(),
          helper: `${overview.activeProducts} product structures live on platform shelf.`,
          icon: <Building2 className="h-5 w-5" />,
          accentColor: "#64748b",
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
          size: "75%",
          labels: {
            show: true,
            name: { show: true, color: "#64748b", fontSize: "12px" },
            value: {
              show: true,
              color: "#0f172a",
              fontSize: "24px",
              fontWeight: "700",
            },
            total: {
              show: true,
              label: "Pipeline Total",
              color: "#64748b",
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
    plotOptions: { bar: { columnWidth: "35%", borderRadius: 6 } },
    fill: {
      type: ["solid", "solid", "gradient"],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.02,
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
      { title: { text: "Applications Flow", style: { color: "#475569" } } },
      {
        opposite: true,
        title: { text: "Funded Asset Volume", style: { color: "#475569" } },
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

  return (
    <>
      <PageMeta
        title="Lendingcart Dashboard"
        description="Analytics overview for lender pipeline performance"
      />

      <div className="min-h-screen bg-slate-50/50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Top Metrics Cards Group */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <PulseLoader key={i} height="h-32" />
                ))
              : metricCards.map((card) => (
                  <MetricCard key={card.label} {...card} />
                ))}
          </div>

          {/* Graphical Analytics Insights Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <DashboardSection
                title="Performance Trend"
                subtitle="Integrated display tracking app intake, clear velocity, and total volume metrics."
                action={
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    6 Month Window
                  </span>
                }
              >
                {loading ? (
                  <PulseLoader height="h-[360px]" />
                ) : (
                  <Chart
                    options={monthlyTrendOptions}
                    series={monthlyTrendSeries}
                    type="line"
                    height={340}
                  />
                )}
              </DashboardSection>
            </div>

            <div className="lg:col-span-4">
              <DashboardSection
                title="Pipeline Mix"
                subtitle="Distribution of files across active fulfillment channels."
              >
                {loading ? (
                  <PulseLoader height="h-[360px]" />
                ) : (
                  <div className="flex flex-col justify-between space-y-4">
                    <Chart
                      options={stageChartOptions}
                      series={stageBreakdownSeries}
                      type="donut"
                      height={240}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {pipeline?.stageBreakdown.slice(0, 4).map((item) => (
                        <div
                          key={item.status}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {item.label}
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-800">
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

          {/* Central Queue Component Frame */}
          <div className="w-full">
            <DashboardSection
              title="Recent Applications"
              subtitle="Real-time monitor tracking newest portfolio items received directly from networks."
              action={
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  6 Active Files
                </span>
              }
            >
              {loading ? (
                <PulseLoader height="h-64" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                        <th className="p-4">Application Reference</th>
                        <th className="p-4">Client Name</th>
                        <th className="p-4">Broker Partner</th>
                        <th className="p-4">Loan Target</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4">Last Event</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                      {pipeline?.recentApplications?.length ? (
                        pipeline.recentApplications.map((item) => (
                          <tr
                            key={item.applicationLenderId}
                            className="hover:bg-slate-50/60 transition-all whitespace-nowrap"
                          >
                            {/* Application Number */}
                            <td className="p-4 align-middle">
                              {item.applicationNumber ? (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-sky-200 bg-sky-50 px-3 py-1.5"
                                >
                                  <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                                  <span className="font-mono text-xs font-bold text-sky-700">
                                    {item.applicationNumber}
                                  </span>
                                </div>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-dashed border-slate-300 bg-slate-50
              px-3 py-1.5 text-slate-400"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                  <span className="text-xs">No Ref</span>
                                </div>
                              )}
                            </td>

                            {/* Client */}
                            <td className="p-4 align-middle">
                              {item.clientName ? (
                                <span className="font-medium text-slate-800">
                                  {item.clientName}
                                </span>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-dashed border-purple-200 bg-purple-50
              px-3 py-1 text-xs font-medium text-purple-500"
                                >
                                  <Activity className="h-3.5 w-3.5" />
                                  Missing Client
                                </div>
                              )}
                            </td>

                            {/* Broker */}
                            <td className="p-4 align-middle">
                              {item.brokerName ? (
                                <span className="text-slate-600">
                                  {item.brokerName}
                                </span>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-dashed border-amber-200 bg-amber-50
              px-3 py-1 text-xs font-medium text-amber-600"
                                >
                                  <Building2 className="h-3.5 w-3.5" />
                                  No Broker
                                </div>
                              )}
                            </td>

                            {/* Product */}
                            <td className="p-4 align-middle">
                              {item.productCode ? (
                                <span
                                  className="inline-flex rounded-full bg-indigo-50
              px-3 py-1 text-xs font-semibold text-indigo-700"
                                >
                                  {item.productCode
                                    ?.replace(/_/g, " ")
                                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                                </span>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-dashed border-indigo-200 bg-indigo-50
              px-3 py-1 text-xs font-medium text-indigo-500"
                                >
                                  <BadgeDollarSign className="h-3.5 w-3.5" />
                                  Product Missing
                                </div>
                              )}
                            </td>

                            {/* Amount */}
                            <td className="p-4 text-right align-middle">
                              {item.amountRequested ? (
                                <span className="font-semibold text-slate-900">
                                  {formatRequestedAmount(item.amountRequested)}
                                </span>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-dashed border-emerald-200 bg-emerald-50
              px-3 py-1 text-xs font-medium text-emerald-600"
                                >
                                  <CircleDollarSign className="h-3.5 w-3.5" />
                                  N/A
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-4 text-center align-middle">
                              {item.pipelineStatus ? (
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                                    item.pipelineStatus,
                                  )}`}
                                >
                                  {item.pipelineStatus.replace(/_/g, " ")}
                                </span>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-dashed border-rose-200 bg-rose-50
              px-3 py-1 text-xs font-medium text-rose-500"
                                >
                                  <Clock3 className="h-3.5 w-3.5" />
                                  Pending
                                </div>
                              )}
                            </td>

                            {/* Date */}
                            <td className="p-4 align-middle">
                              {item.updatedAt || item.sentAt ? (
                                <span className="text-xs text-slate-500">
                                  {formatDate(item.updatedAt || item.sentAt)}
                                </span>
                              ) : (
                                <div
                                  className="inline-flex items-center gap-2 rounded-full
              border border-dashed border-slate-300 bg-slate-50
              px-3 py-1 text-xs font-medium text-slate-400"
                                >
                                  <Clock3 className="h-3.5 w-3.5" />
                                  No Activity
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-10">
                            <div
                              className="flex flex-col items-center justify-center
          rounded-2xl border-2 border-dashed border-slate-200
          bg-gradient-to-b from-slate-50 to-white py-14"
                            >
                              <div
                                className="mb-4 flex h-16 w-16 items-center justify-center
            rounded-2xl bg-sky-50 text-[#136e68]"
                              >
                                <FileSpreadsheet className="h-8 w-8" />
                              </div>

                              <h3 className="text-base font-bold text-slate-800">
                                No Recent Applications
                              </h3>

                              <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
                                Newly submitted loan applications from brokers
                                and partners will appear here automatically.
                              </p>

                              <div className="mt-5 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-sky-400 animate-bounce" />
                                <div className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce delay-100" />
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce delay-200" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </DashboardSection>
          </div>

          {/* Lower Funnel Analytical Health Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Submitted Conversion",
                value: pipeline?.submittedConversion,
                desc: `${pipeline?.totalSubmitted || 0} of ${pipeline?.totalApplications || 0} items active`,
                icon: <Activity className="text-sky-600" />,
                bg: "bg-sky-50",
              },
              {
                label: "Review Intensity",
                value: pipeline?.reviewConversion,
                desc: `${pipeline?.totalInReview || 0} items currently under review`,
                icon: <BarChart3 className="text-amber-600" />,
                bg: "bg-amber-50",
              },
              {
                label: "Approval Velocity",
                value: pipeline?.approvalRate,
                desc: `${pipeline?.totalApproved || 0} items passed validation`,
                icon: <HandCoins className="text-emerald-600" />,
                bg: "bg-emerald-50",
              },
              {
                label: "Funding Conversion",
                value: pipeline?.fundingConversion,
                desc: `${pipeline?.totalFunded || 0} deals finalized smoothly`,
                icon: <TrendingUp className="text-indigo-600" />,
                bg: "bg-indigo-50",
              },
            ].map((box, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center space-x-4"
              >
                <div className={`p-3 rounded-xl ${box.bg}`}>{box.icon}</div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    {box.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {box.value ?? 0}%
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{box.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
