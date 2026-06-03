import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

interface BrokerStats {
  applicationsByStatus: Record<string, number>;
}

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
}

const STATUS_META = [
  { key: "DRAFT", label: "Draft", color: "#94A3B8" },
  { key: "CLIENT_PENDING", label: "Client Pending", color: "#F97316" },
  { key: "SUBMITTED", label: "Submitted", color: "#0EA5E9" },
  { key: "IN_REVIEW", label: "In Review", color: "#6366F1" },
  { key: "LENDER_APPROVED", label: "Approved", color: "#10B981" },
  { key: "LENDER_DECLINED", label: "Declined", color: "#EF4444" },
  { key: "FUNDED", label: "Funded", color: "#0F766E" },
  { key: "WITHDRAWN", label: "Withdrawn", color: "#E11D48" },
];

export default function StatusDistributionChart({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-white/[0.03]">
        <p className="text-sm text-slate-500">Loading status mix...</p>
      </div>
    );
  }

  if (!stats) return null;

  const statusData = STATUS_META.filter(
    (status) => Number(stats.applicationsByStatus?.[status.key] || 0) > 0,
  );

  const series = statusData.map((status) => Number(stats.applicationsByStatus?.[status.key] || 0));
  const labels = statusData.map((status) => status.label);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
    },
    labels,
    colors: statusData.map((status) => status.color),
    legend: {
      position: "bottom",
      fontSize: "13px",
    },
    dataLabels: {
      enabled: true,
      formatter: (_value, opts) => String(series[opts.seriesIndex] || 0),
    },
    stroke: {
      colors: ["#FFFFFF"],
    },
    tooltip: {
      y: {
        formatter: (value) => `${Math.round(value)} applications`,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Applications",
              formatter: () => String(series.reduce((sum, value) => sum + value, 0)),
            },
          },
        },
      },
    },
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-white/[0.03]">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-600">
          Status Mix
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
          Where applications are sitting right now
        </h3>
      </div>

      {series.length > 0 ? (
        <Chart options={options} series={series} type="donut" height={340} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800">
          Status distribution will appear here once applications enter the pipeline.
        </div>
      )}
    </div>
  );
}
