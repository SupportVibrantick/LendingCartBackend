import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { CommissionSummary } from "../../lib/commissionApi";
import { formatCommissionCurrency } from "../../lib/commissionApi";

type Props = {
  summary: CommissionSummary | null;
  loading?: boolean;
  title?: string;
};

export default function CommissionSummaryChart({
  summary,
  loading = false,
  title = "Commission Overview",
}: Props) {
  if (loading) {
    return (
      <div className="h-full rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-40 animate-pulse rounded bg-surface dark:bg-slate-800" />
        <div className="mt-4 h-[240px] animate-pulse rounded-xl bg-surface dark:bg-slate-800" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-[16px] font-semibold text-text-primary dark:text-white">
          {title}
        </h3>
        <p className="mt-4 text-sm text-text-secondary">No commission data yet.</p>
      </div>
    );
  }

  const hasBars = [...summary.pending, ...summary.paid].some((v) => v > 0);

  const options: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
    },
    colors: ["#F59E0B", "#059669"],
    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: "42%",
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    fill: { opacity: 1 },
    xaxis: {
      categories: summary.months,
      labels: { style: { colors: "#64748b", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (value) => formatCommissionCurrency(value),
        style: { colors: "#64748b", fontSize: "11px" },
      },
      min: 0,
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      markers: { size: 7 },
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 3,
      padding: { left: 4, right: 4 },
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (value) => formatCommissionCurrency(value),
      },
    },
  };

  const series = [
    { name: "Pending", data: summary.pending },
    { name: "Paid", data: summary.paid },
  ];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold leading-tight text-text-primary dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-[13px] text-text-secondary">
            Last {summary.months.length} months
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-secondary">
              Pending
            </p>
            <p className="font-semibold text-amber-600">
              {formatCommissionCurrency(summary.totals.pending)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-secondary">
              Paid
            </p>
            <p className="font-semibold text-emerald-600">
              {formatCommissionCurrency(summary.totals.paid)}
            </p>
          </div>
        </div>
      </div>

      {hasBars ? (
        <Chart options={options} series={series} type="bar" height={260} />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 dark:border-gray-800">
          No commission activity in this window
        </div>
      )}
    </div>
  );
}
