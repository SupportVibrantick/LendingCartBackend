import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  formatCompactCount,
  formatCompactCurrency,
  type AdminAnalytics,
} from "../../lib/adminDashboardStats";

type Props = {
  analytics: AdminAnalytics | null | undefined;
  loading?: boolean;
};

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-6 w-56 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-[280px] rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function StatisticsChart({ analytics, loading = false }: Props) {
  if (loading) return <ChartSkeleton />;
  if (!analytics) {
    return (
      <div className="flex h-full min-h-[340px] items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        No trend data available.
      </div>
    );
  }

  const trend = analytics.monthlyTrend || [];
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
      fontFamily: "inherit",
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
      theme: "light",
      cssClass: "!bg-white !text-slate-700",
      y: {
        formatter: (value, { seriesIndex }) => {
          if (seriesIndex === 2) return formatCompactCurrency(value);
          return `${formatCompactCount(value)} apps`;
        },
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
            Platform activity
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
            Applications & funded volume
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatCompactCount(analytics.totalApplications)} apps ·{" "}
            {formatCompactCurrency(analytics.totalVolumeFunded)} funded
          </p>
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex flex-1 items-center justify-center rounded-xl bg-slate-50 py-16 text-sm text-slate-500 dark:bg-slate-800/50">
          No application activity in this period.
        </div>
      ) : (
        <Chart options={options} series={series} type="line" height={280} />
      )}
    </div>
  );
}
