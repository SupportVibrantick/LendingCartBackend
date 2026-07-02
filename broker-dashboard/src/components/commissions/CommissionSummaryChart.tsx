import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { CommissionSummary } from "../../lib/commissionApi";

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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-6 h-[280px] animate-pulse rounded-xl bg-slate-50" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-4 text-sm text-slate-500">No commission data yet.</p>
      </div>
    );
  }

  const options: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    colors: ["#f59e0b", "#059669"],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "48%",
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: summary.months,
      labels: { style: { colors: "#64748b", fontSize: "12px" } },
    },
    yaxis: {
      labels: {
        formatter: (value) => `$${Number(value).toLocaleString()}`,
        style: { colors: "#64748b", fontSize: "12px" },
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
    },
    grid: {
      borderColor: "#e2e8f0",
      strokeDashArray: 4,
    },
    tooltip: {
      y: {
        formatter: (value) => `$${Number(value).toLocaleString()}`,
      },
    },
  };

  const series = [
    { name: "Pending", data: summary.pending },
    { name: "Paid", data: summary.paid },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">
            Closing commission splits over the last {summary.months.length} months
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-slate-500">Pending</p>
            <p className="font-semibold text-amber-600">
              ${summary.totals.pending.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Paid</p>
            <p className="font-semibold text-emerald-600">
              ${summary.totals.paid.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <Chart options={options} series={series} type="bar" height={300} />
    </div>
  );
}
