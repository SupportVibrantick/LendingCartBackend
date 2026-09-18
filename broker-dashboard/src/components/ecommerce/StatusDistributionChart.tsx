import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { BrokerStats } from "../../lib/brokerDashboardStats";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onStatusClick?: (statusKey: string) => void;
}

const STATUS_META = [
  { key: "DRAFT", label: "Draft", color: "#94A3B8" },
  { key: "CLIENT_PENDING", label: "Client Pending", color: "#F97316" },
  { key: "SUBMITTED", label: "Submitted", color: "#0EA5E9" },
  { key: "IN_REVIEW", label: "In Review", color: "#6366F1" },
  { key: "LENDER_SELECTED", label: "Lender Selected", color: "#8B5CF6" },
  { key: "LENDER_APPROVED", label: "Approved", color: "#10B981" },
  { key: "LENDER_DECLINED", label: "Declined", color: "#EF4444" },
  { key: "FUNDED", label: "Funded", color: "#0F766E" },
  { key: "WITHDRAWN", label: "Withdrawn", color: "#E11D48" },
  { key: "SUSPENDED", label: "Suspended", color: "#64748B" },
];

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mx-auto h-[220px] w-[220px] rounded-full bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export default function StatusDistributionChart({
  stats,
  loading,
  onStatusClick,
}: Props) {
  if (loading) return <ChartSkeleton />;
  if (!stats) return null;

  const statusData = STATUS_META.filter(
    (status) => Number(stats.applicationsByStatus?.[status.key] || 0) > 0,
  );

  const series = statusData.map((status) =>
    Number(stats.applicationsByStatus?.[status.key] || 0),
  );
  const labels = statusData.map((status) => status.label);
  const total = series.reduce((sum, value) => sum + value, 0);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          const statusKey = statusData[config.dataPointIndex]?.key;
          if (statusKey && onStatusClick) onStatusClick(statusKey);
        },
      },
    },
    labels,
    colors: statusData.map((status) => status.color),
    legend: {
      position: "bottom",
      fontSize: "11px",
      markers: { size: 7 },
      itemMargin: { horizontal: 8, vertical: 2 },
      onItemClick: { toggleDataSeries: false },
    },
    dataLabels: {
      enabled: true,
      formatter: (_value, opts) => String(series[opts.seriesIndex] || 0),
      style: { fontSize: "11px", fontWeight: 600 },
      dropShadow: { enabled: false },
    },
    stroke: { colors: ["#FFFFFF"], width: 2 },
    tooltip: {
      theme: "light",
      style: {
        fontSize: "12px",
        fontFamily: "Outfit, sans-serif",
      },
      fillSeriesColor: false,
      y: {
        formatter: (value) => {
          const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
          return `${Math.round(value)} apps (${pct}%)`;
        },
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { show: true, fontSize: "12px", color: "#64748B" },
            value: {
              show: true,
              fontSize: "24px",
              fontWeight: 700,
              color: "#0F172A",
            },
            total: {
              show: true,
              label: "Total",
              fontSize: "12px",
              formatter: () => String(total),
            },
          },
        },
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
          Status Mix
        </p>
        <h3 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
          Current pipeline
        </h3>
      </div>

      {series.length > 0 ? (
        <div className="flex min-h-0 flex-1 items-center">
          <Chart options={options} series={series} type="donut" height={300} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 dark:border-gray-800">
          No data for this period
        </div>
      )}
    </div>
  );
}
