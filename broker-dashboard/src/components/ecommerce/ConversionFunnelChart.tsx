import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { BrokerStats } from "../../lib/brokerDashboardStats";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onStageClick?: (statusKey: string) => void;
}

const FUNNEL_STAGES = [
  { key: "CLIENT_PENDING", label: "Client Pending", color: "#F97316" },
  { key: "SUBMITTED", label: "Submitted", color: "#0EA5E9" },
  { key: "IN_REVIEW", label: "In Review", color: "#6366F1" },
  { key: "LENDER_APPROVED", label: "Approved", color: "#10B981" },
  { key: "FUNDED", label: "Funded", color: "#0F766E" },
] as const;

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-[260px] rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export default function ConversionFunnelChart({
  stats,
  loading,
  onStageClick,
}: Props) {
  if (loading) return <ChartSkeleton />;
  if (!stats) return null;

  const draft = Number(stats.applicationsByStatus?.DRAFT || 0);
  const stages = FUNNEL_STAGES.map((stage) => ({
    ...stage,
    count: Number(stats.applicationsByStatus?.[stage.key] || 0),
  }));

  // Include draft as top of funnel when present
  const rows =
    draft > 0
      ? [{ key: "DRAFT", label: "Draft", color: "#94A3B8", count: draft }, ...stages]
      : stages;

  const active = rows.filter((row) => row.count > 0);
  const max = Math.max(...rows.map((row) => row.count), 1);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_e, _ctx, config) => {
          const key = rows[config.dataPointIndex]?.key;
          if (key && onStageClick) onStageClick(key);
        },
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: "68%",
        distributed: true,
        dataLabels: { position: "top" },
      },
    },
    colors: rows.map((row) => row.color),
    dataLabels: {
      enabled: true,
      formatter: (val) => String(val),
      offsetX: 18,
      style: { colors: ["#334155"], fontSize: "12px", fontWeight: 600 },
    },
    legend: { show: false },
    grid: {
      borderColor: "#E5E7EB",
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
      padding: { left: 0, right: 28 },
    },
    xaxis: {
      categories: rows.map((row) => row.label),
      max: Math.ceil(max * 1.15) || 1,
      labels: {
        style: { colors: "#64748B", fontSize: "11px" },
        formatter: (value) => String(Math.round(Number(value))),
      },
    },
    yaxis: {
      labels: { style: { colors: "#475569", fontSize: "12px" } },
    },
    tooltip: {
      y: {
        formatter: (value) => `${Math.round(value)} applications`,
      },
    },
  };

  const series = [
    {
      name: "Applications",
      data: rows.map((row) => row.count),
    },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
          Conversion Funnel
        </p>
        <h3 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
          Stage-by-stage flow
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Live counts by current stage for this period
        </p>
      </div>

      {active.length > 0 ? (
        <div className="min-h-0 flex-1">
          <Chart options={options} series={series} type="bar" height={280} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 dark:border-gray-800">
          No pipeline data for this period
        </div>
      )}
    </div>
  );
}
