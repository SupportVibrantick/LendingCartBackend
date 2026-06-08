import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Activity, Loader2 } from "lucide-react";

type Props = {
  stats: {
    applications?: {
      total?: number;
      last7Days?: number;
      last30Days?: number;
    };
  } | null;
};

export default function PlatformActivityChart({ stats }: Props) {
  if (!stats?.applications) {
    return (
      <div className="flex h-[340px] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-6 w-6 animate-spin text-[#13538A]" />
      </div>
    );
  }

  const last7 = stats.applications.last7Days ?? 0;
  const last30 = stats.applications.last30Days ?? 0;
  const prior23 = Math.max(last30 - last7, 0);
  const total = stats.applications.total ?? 0;

  const options: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    colors: ["#13538A", "#5D28A8", "#94A3B8"],
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: "48%",
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: ["Last 7 days", "Days 8–30", "All time"],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: "#64748B", fontSize: "12px", fontWeight: 500 } },
    },
    yaxis: {
      labels: { style: { colors: "#94A3B8" } },
      tickAmount: 4,
    },
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 4,
    },
    tooltip: {
      theme: "light",
      y: { formatter: (val: number) => `${val} applications` },
    },
  };

  const series = [{ name: "Applications", data: [last7, prior23, total] }];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Application Activity
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Submission volume over time
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">7-day</p>
          <p className="text-xl font-semibold text-[#13538A] dark:text-blue-300">{last7}</p>
        </div>
      </div>

      <Chart options={options} series={series} type="bar" height={260} />

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        {[
          { label: "7 days", value: last7 },
          { label: "30 days", value: last30 },
          { label: "Total", value: total },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2 text-center dark:bg-slate-800/50">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{item.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
