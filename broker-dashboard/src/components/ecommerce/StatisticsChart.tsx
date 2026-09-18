import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  formatCompactCount,
  formatCompactCurrency,
  type BrokerStats,
} from "../../lib/brokerDashboardStats";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
}

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-6 w-56 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-[280px] rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export default function StatisticsChart({ stats, loading }: Props) {
  if (loading) return <ChartSkeleton />;
  if (!stats) return null;

  const trend = stats.monthlyTrend || [];
  const hasActivity = trend.some(
    (point) =>
      point.applications > 0 ||
      point.submitted > 0 ||
      point.fundedVolume > 0,
  );

  const maxCount = Math.max(
    ...trend.map((p) => Math.max(p.applications, p.submitted, p.funded)),
    1,
  );

  const series = [
    {
      name: "Applications",
      type: "area" as const,
      data: trend.map((item) => item.applications),
    },
    {
      name: "Submitted",
      type: "area" as const,
      data: trend.map((item) => item.submitted),
    },
    {
      name: "Funded Volume",
      type: "line" as const,
      data: trend.map((item) => item.fundedVolume),
    },
  ];

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 400 },
    },
    colors: ["#13538A", "#38BDF8", "#0F766E"],
    fill: {
      type: ["gradient", "gradient", "solid"],
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    stroke: {
      width: [2.5, 2.5, 3],
      curve: "smooth",
    },
    markers: {
      size: hasActivity ? 3 : 0,
      strokeWidth: 0,
      hover: { size: 5 },
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 3,
      padding: { left: 4, right: 4, top: -8 },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
      itemMargin: { horizontal: 12 },
      markers: { size: 7 },
    },
    xaxis: {
      categories: trend.map((item) => item.label),
      labels: {
        style: { colors: "#64748B", fontSize: "10px" },
        rotate: trend.length > 12 ? -40 : 0,
        hideOverlappingLabels: true,
        trim: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: [
      {
        seriesName: "Applications",
        min: 0,
        max: Math.max(4, Math.ceil(maxCount * 1.25)),
        tickAmount: 4,
        forceNiceScale: true,
        labels: {
          formatter: (value) => String(Math.round(value)),
          style: { colors: "#64748B", fontSize: "11px" },
        },
        title: {
          text: "Apps",
          style: { color: "#94A3B8", fontSize: "11px", fontWeight: 500 },
        },
      },
      {
        seriesName: "Submitted",
        show: false,
        min: 0,
        max: Math.max(4, Math.ceil(maxCount * 1.25)),
      },
      {
        seriesName: "Funded Volume",
        opposite: true,
        min: 0,
        labels: {
          formatter: (value) => formatCompactCurrency(Math.max(0, value)),
          style: { colors: "#64748B", fontSize: "11px" },
        },
        title: {
          text: "Volume",
          style: { color: "#94A3B8", fontSize: "11px", fontWeight: 500 },
        },
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value, context) =>
          context.seriesIndex === 2
            ? formatCompactCurrency(value)
            : formatCompactCount(value),
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
            Pipeline Momentum
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
            Origination trend
          </h3>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-right dark:bg-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Funded vol
          </p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {formatCompactCurrency(stats.totalVolumeFunded)}
          </p>
        </div>
      </div>

      {hasActivity ? (
        <div className="min-h-0 flex-1">
          <Chart options={options} series={series} type="area" height={300} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 dark:border-gray-800">
          No activity for this period
        </div>
      )}
    </div>
  );
}
