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

const PRODUCT_COLORS = ["#4C78F5", "#0F766E", "#059669", "#0284C7", "#4F46E5"];
const STATUS_COLORS = ["#F97316", "#0EA5E9", "#6366F1", "#10B981", "#0F766E", "#94A3B8", "#EF4444"];

function ChartSkeleton() {
  return (
    <div className="h-full rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-36 rounded bg-surface dark:bg-slate-800" />
        <div className="h-[260px] rounded-xl bg-surface dark:bg-slate-800" />
      </div>
    </div>
  );
}

function productLabel(code: string) {
  return (code || "Unspecified").replace(/_/g, " ");
}

function toAmount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const STATUS_FALLBACK = [
  { key: "CLIENT_PENDING", label: "Client Pending" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "LENDER_APPROVED", label: "Approved" },
  { key: "FUNDED", label: "Funded" },
  { key: "DRAFT", label: "Draft" },
  { key: "INCOMPLETE", label: "Incomplete" },
  { key: "LENDER_DECLINED", label: "Declined" },
];

export default function ProductVolumeChart({ stats, loading }: Props) {
  if (loading) return <ChartSkeleton />;
  if (!stats) return null;

  const products = (stats.productWiseApprovedVolume || [])
    .map((item) => ({
      label: productLabel(item.product),
      value: toAmount(item.totalApprovedAmount),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const useProducts = products.length > 0;

  const fallbackRows = STATUS_FALLBACK.map((status) => ({
    label: status.label,
    value: Number(stats.applicationsByStatus?.[status.key] || 0),
  }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const rows = useProducts ? products : fallbackRows;
  const colors = useProducts ? PRODUCT_COLORS : STATUS_COLORS;
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 8,
        barHeight: "62%",
        distributed: true,
      },
    },
    colors: rows.map((_, i) => colors[i % colors.length]),
    dataLabels: {
      enabled: true,
      formatter: (val) =>
        useProducts
          ? formatCompactCurrency(Number(val))
          : formatCompactCount(Number(val)),
      style: { fontSize: "11px", fontWeight: 600, colors: ["#fff"] },
      offsetX: -4,
    },
    legend: { show: false },
    grid: {
      borderColor: "#E5E7EB",
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: false } },
      padding: { top: -10, bottom: -10 },
    },
    xaxis: {
      categories: rows.map((row) => row.label),
      labels: {
        style: { colors: "#64748B", fontSize: "11px" },
        formatter: (value) =>
          useProducts
            ? formatCompactCurrency(Number(value))
            : formatCompactCount(Number(value)),
      },
    },
    yaxis: {
      labels: {
        style: { colors: "#334155", fontSize: "12px", fontWeight: 500 },
        maxWidth: 140,
      },
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (value) =>
          useProducts
            ? formatCompactCurrency(value)
            : `${formatCompactCount(value)} apps`,
      },
    },
  };

  const series = [{ name: useProducts ? "Volume" : "Apps", data: rows.map((r) => r.value) }];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold leading-tight text-text-primary dark:text-white">
            {useProducts ? "Product Mix" : "Pipeline Focus"}
          </h3>
          <p className="mt-1 text-[13px] text-text-secondary">
            {useProducts
              ? "Approved volume by product"
              : "Where applications concentrate"}
          </p>
        </div>
        {total > 0 ? (
          <div className="text-right">
            <p className="text-[11px] text-text-secondary">
              {useProducts ? "Volume" : "Apps"}
            </p>
            <p className="text-sm font-semibold text-text-primary dark:text-white">
              {useProducts
                ? formatCompactCurrency(total)
                : formatCompactCount(total)}
            </p>
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="min-h-0 flex-1">
          <Chart options={options} series={series} type="bar" height={280} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 dark:border-gray-800">
          No data available for this period
        </div>
      )}
    </div>
  );
}
