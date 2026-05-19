import { useEffect, useState, type ReactNode } from "react";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import {
  Activity,
  // ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Building2,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  HandCoins,
  // MoveRight,
  // Sparkles,
  // Target,
  TrendingUp,
  // WalletCards,
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
  amountRequested: number;
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

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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

function formatCurrency(value: number) {
  return currency.format(Number(value || 0));
}

function formatCompactCurrency(value: number) {
  return compactCurrency.format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  return dateFormatter.format(new Date(value));
}

function getStatusBadgeClass(status: string) {
  const styles: Record<string, string> = {
    SENT: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    IN_REVIEW: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    APPROVED: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    FUNDED: "bg-emerald-200 text-emerald-800 ring-1 ring-emerald-300",
    DECLINED: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    WITHDRAWN: "bg-slate-200 text-slate-700 ring-1 ring-slate-300",
  };

  return styles[status] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
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
    <div className="group relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white p-5 transition-transform duration-300 hover:-translate-y-1">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accentColor }} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <h3 className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
            {value}
          </h3>
          <p className="mt-3 max-w-[220px] text-xs leading-5 text-slate-500">{helper}</p>
        </div>
<div
  className="
    flex h-14 w-14 items-center
    justify-center rounded-[22px]
  "
  style={{
    backgroundColor: `${accentColor}15`,
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
    <div className="rounded-[30px] border border-slate-200/80 bg-white p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PulseLoader({ height }: { height: string }) {
  return <div className={`${height} animate-pulse rounded-[28px] bg-slate-100`} />;
}

export default function Home() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelinePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  // const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        // setError("");

        const token = sessionStorage.getItem("lender_token");
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const [overviewRes, pipelineRes] = await Promise.all([
          fetch(`${API_BASE}/lender/dashboard/overview-stats`, { headers }),
          fetch(`${API_BASE}/lender/dashboard/pipeline-performance`, { headers }),
        ]);

        const [overviewJson, pipelineJson] = await Promise.all([
          overviewRes.json(),
          pipelineRes.json(),
        ]);

        if (!overviewRes.ok || !overviewJson.success) {
          throw new Error(overviewJson.message || "Failed to load overview stats");
        }

        if (!pipelineRes.ok || !pipelineJson.success) {
          throw new Error(pipelineJson.message || "Failed to load pipeline analytics");
        }

        setOverview(overviewJson.data);
        setPipeline(pipelineJson.data);
      } catch (fetchError) {
        // const message =
        //   fetchError instanceof Error
        //     ? fetchError.message
        //     : "Failed to load dashboard";


        // setError(message);
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
          helper: `${overview.sentToLender} active opportunities currently sit in your lender pipeline.`,
          icon: <FileSpreadsheet className="h-5 w-5" />,
          accentColor: "#0ea5e9",
        },
        {
          label: "Approval Rate",
          value: `${overview.approvalRate}%`,
          helper: `${overview.approved + overview.fundedLoans} applications have already cleared review.`,
          icon: <TrendingUp className="h-5 w-5" />,
          accentColor: "#10b981",
        },
        {
          label: "Funded Volume",
          value: formatCompactCurrency(overview.totalFundedVolume),
          helper: `${overview.fundedLoans} funded loans are contributing to booked volume.`,
          icon: <CircleDollarSign className="h-5 w-5" />,
          accentColor: "#f59e0b",
        },
        {
          label: "Average Loan Size",
          value: formatCompactCurrency(overview.avgLoanSize),
          helper: `${overview.fundedRate}% of lender opportunities ultimately reach funding.`,
          icon: <BadgeDollarSign className="h-5 w-5" />,
          accentColor: "#8b5cf6",
        },
        {
          label: "Pending Review",
          value: overview.pendingReview.toLocaleString(),
          helper: `${overview.declined} declined files and ${overview.activeConnections} active broker links.`,
          icon: <Clock3 className="h-5 w-5" />,
          accentColor: "#eab308",
        },
        {
          label: "Broker Coverage",
          value: overview.activeBrokers.toLocaleString(),
          helper: `${overview.activeProducts} active products currently support your shelf.`,
          icon: <Building2 className="h-5 w-5" />,
          accentColor: "#334155",
        },
      ]
    : [];

  const stageBreakdownSeries =
    pipeline?.stageBreakdown.map((item) => item.count) || [];

  const stageChartOptions: ApexOptions = {
    chart: {
      type: "donut",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    labels: pipeline?.stageBreakdown.map((item) => item.label) || [],
    legend: {
      position: "bottom",
      fontSize: "13px",
      labels: { colors: "#475569" },
    },
    colors: ["#0f766e", "#f59e0b", "#2563eb", "#22c55e", "#ef4444", "#94a3b8"],
    dataLabels: {
      enabled: false,
    },
    stroke: {
      colors: ["#ffffff"],
      width: 5,
    },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: {
              show: true,
              color: "#64748b",
            },
            value: {
              show: true,
              color: "#0f172a",
              fontSize: "28px",
              fontWeight: "700",
            },
            total: {
              show: true,
              label: "Pipeline",
              color: "#64748b",
              formatter: () => `${pipeline?.totalApplications || 0}`,
            },
          },
        },
      },
    },
  };

const monthlyTrendOptions: ApexOptions =
  {
    chart: {
      type: "line",

      stacked: false,

      toolbar: {
        show: false,
      },

      zoom: {
        enabled: false,
      },

      fontFamily:
        "Outfit, sans-serif",

      foreColor: "#64748b",
    },

    colors: [
      "#2563eb",
      "#14b8a6",
      "#f59e0b",
    ],

    stroke: {
      width: [0, 4, 3],

      curve: "smooth",
    },

    plotOptions: {
      bar: {
        columnWidth: "42%",

        borderRadius: 12,
      },
    },

    fill: {
      type: [
        "solid",
        "solid",
        "gradient",
      ],

      gradient: {
        shadeIntensity: 1,

        opacityFrom: 0.45,

        opacityTo: 0.04,

        stops: [0, 95, 100],
      },
    },

    dataLabels: {
      enabled: false,
    },

    markers: {
      size: [0, 5, 0],

      hover: {
        sizeOffset: 3,
      },
    },

    grid: {
      borderColor: "#e2e8f0",

      strokeDashArray: 5,

      padding: {
        left: 10,
        right: 10,
      },
    },

    legend: {
      position: "top",

      horizontalAlign:
        "left",

      fontSize: "13px",

      labels: {
        colors: "#334155",
      },
    },

    xaxis: {
      categories:
        pipeline?.monthlyTrend.map(
          (item) => item.label,
        ) || [],

      axisBorder: {
        show: false,
      },

      axisTicks: {
        show: false,
      },

      labels: {
        style: {
          colors: "#64748b",

          fontSize: "12px",
        },
      },
    },

    yaxis: [
      {
        title: {
          text: "Applications",
        },

        labels: {
          formatter: (
            value,
          ) =>
            `${Math.round(
              value,
            )}`,
        },
      },

      {
        opposite: true,

        title: {
          text:
            "Funded Volume",
        },

        labels: {
          formatter: (
            value,
          ) =>
            formatCompactCurrency(
              value,
            ),
        },
      },
    ],

    tooltip: {
      shared: true,

      intersect: false,

      theme: "light",

      y: {
        formatter: (
          value,
          context,
        ) =>
          context.seriesIndex ===
          2
            ? formatCurrency(
                value,
              )
            : `${Math.round(
                value,
              )}`,
      },
    },
  };

const monthlyTrendSeries = [
  {
    name: "Applications",

    type: "bar" as const,

    data:
      pipeline?.monthlyTrend.map(
        (item) =>
          item.applications,
      ) || [],
  },

  {
    name: "Approvals",

    type: "line" as const,

    data:
      pipeline?.monthlyTrend.map(
        (item) =>
          item.approved,
      ) || [],
  },

  {
    name: "Funded Volume",

    type: "area" as const,

    data:
      pipeline?.monthlyTrend.map(
        (item) =>
          item.fundedVolume,
      ) || [],
  },
];

  return (
    <>
      <PageMeta
        title="Lendingcart Dashboard"
        description="Analytics overview for lender pipeline performance"
      />

      <div className="min-h-screen bg-slate-50">
        <div className="space-y-6">

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <PulseLoader key={index} height="h-44" />
                ))
              : metricCards.map((card) => <MetricCard key={card.label} {...card} />)}
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 xl:col-span-8">
              <DashboardSection
                title="Performance Trend"
                subtitle="Monthly application flow, approval lift, and funded volume in one layered chart."
                action={
                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                    6 month window
                  </div>
                }
              >
                {loading ? (
                  <PulseLoader height="h-[360px]" />
                ) : (
                  <div
  className="
    rounded-[26px]
    border border-slate-100
    bg-gradient-to-br
    from-white to-slate-50
    p-4
  "
>
                    <Chart
                      options={monthlyTrendOptions}
                      series={monthlyTrendSeries}
                      type="line"
                      height={380}
                    />
                  </div>
                )}
              </DashboardSection>
            </div>

            <div className="col-span-12 xl:col-span-4">
              <DashboardSection 
                title="Pipeline Mix"
                subtitle="See where the book is currently clustering across decision stages."
                action={
                  <div className="bg-emerald-50 px-3 py-1.5 text-[9px] font-medium text-emerald-700">
                    {/* Live stage map */}
                  </div>
                }
              >
                {loading ? (
                  <PulseLoader height="h-[360px]" />
                ) : (
                  <>
                    <Chart
                      options={stageChartOptions}
                      series={stageBreakdownSeries}
                      type="donut"
                      height={290}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {pipeline?.stageBreakdown.map((item) => (
                        <div
                          key={item.status}
                          className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-2"
                        >
                          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">
                            {item.label}
                          </p>
                          <p className="mt-2 text-xl font-semibold text-slate-900">{item.count}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </DashboardSection>
            </div>

            <div className="col-span-12">
              <DashboardSection
                title="Recent Applications"
                subtitle="Latest lender opportunities with broker source, product type, request size, and pipeline status."
                action={
                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                    Most recent 6 files
                  </div>
                }
              >
                {loading ? (
                  <PulseLoader height="h-64" />
                ) : (
                  <div className="overflow-x-auto rounded-[24px] border border-slate-200">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          <th className="px-4 py-4 font-medium">Application</th>
                          <th className="px-4 py-4 font-medium">Client</th>
                          <th className="px-4 py-4 font-medium">Broker</th>
                          <th className="px-4 py-4 font-medium">Product</th>
                          <th className="px-4 py-4 font-medium">Requested</th>
                          <th className="px-4 py-4 font-medium">Status</th>
                          <th className="px-4 py-4 font-medium">Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {pipeline?.recentApplications.map((item) => (
                          <tr key={item.applicationLenderId} className="transition-colors hover:bg-slate-50/80">
                            <td className="px-4 py-4">
                              <div className="font-semibold text-slate-900">{item.applicationNumber}</div>
                            </td>
                            <td className="px-4 py-4">{item.clientName}</td>
                            <td className="px-4 py-4">{item.brokerName}</td>
                            <td className="px-4 py-4">
  {item.productCode
    ?.replace(/_/g, " ")
    ?.replace(/\b\w/g, (c) =>
      c.toUpperCase(),
    )}
</td>
                            <td className="px-4 py-4 font-medium text-slate-900">
                             {Intl.NumberFormat(
  "en",
  {
    notation: "compact",
    maximumFractionDigits: 1,
  },
).format(
  item.amountRequested || 0,
)}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                                  item.pipelineStatus,
                                )}`}
                              >
                                {item.pipelineStatus.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-slate-500">
                              {formatDate(item.updatedAt || item.sentAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DashboardSection>
            </div>

            <div className="col-span-12">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <DashboardSection
                  title="Submitted Conversion"
                  subtitle="Share of total opportunities that are active inside lender flow."
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-[20px] bg-sky-100 p-3 text-sky-700">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold tracking-tight text-slate-900">
                        {pipeline?.submittedConversion ?? 0}%
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {pipeline?.totalSubmitted ?? 0} of {pipeline?.totalApplications ?? 0} files
                      </p>
                    </div>
                  </div>
                </DashboardSection>

                <DashboardSection
                  title="Review Intensity"
                  subtitle="Portion of live pipeline that is waiting on underwriting action."
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-[20px] bg-amber-100 p-3 text-amber-700">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold tracking-tight text-slate-900">
                        {pipeline?.reviewConversion ?? 0}%
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {pipeline?.totalInReview ?? 0} loans in review queue
                      </p>
                    </div>
                  </div>
                </DashboardSection>

                <DashboardSection
                  title="Approval Velocity"
                  subtitle="Efficiency of moving in-flight applications toward approval."
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-[20px] bg-emerald-100 p-3 text-emerald-700">
                      <HandCoins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold tracking-tight text-slate-900">
                        {pipeline?.approvalRate ?? 0}%
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {pipeline?.totalApproved ?? 0} approvals including funded deals
                      </p>
                    </div>
                  </div>
                </DashboardSection>

                <DashboardSection
                  title="Funding Conversion"
                  subtitle="Final close rate from approved deals into funded outcomes."
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-[20px] bg-violet-100 p-3 text-violet-700">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold tracking-tight text-slate-900">
                        {pipeline?.fundingConversion ?? 0}%
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {pipeline?.totalFunded ?? 0} funded out of {pipeline?.totalApproved ?? 0}
                      </p>
                    </div>
                  </div>
                </DashboardSection>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
