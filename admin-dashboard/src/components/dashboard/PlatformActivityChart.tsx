import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Building2 } from "lucide-react";
import {
  formatCompactCurrency,
  type AdminAnalytics,
} from "../../lib/adminDashboardStats";

type Props = {
  analytics: AdminAnalytics | null | undefined;
  loading?: boolean;
};

function productLabel(code?: string) {
  if (!code || code === "UNSPECIFIED") return "Unspecified";
  return code.replace(/_/g, " ");
}

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-[240px] rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function PlatformActivityChart({
  analytics,
  loading = false,
}: Props) {
  if (loading) return <ChartSkeleton />;

  const products = analytics?.productWiseApprovedVolume || [];

  if (!analytics || products.length === 0) {
    return (
      <div className="flex h-full min-h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Top products by volume
            </h3>
            <p className="text-sm text-slate-500">Approved / funded amount</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No product volume in this period.
        </div>
      </div>
    );
  }

  const ranked = [...products]
    .sort((a, b) => b.totalApprovedAmount - a.totalApprovedAmount)
    .slice(0, 5);

  const maxAmount = Math.max(
    ...ranked.map((item) => item.totalApprovedAmount),
    1,
  );

  const options: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    colors: ["#13538A"],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: "55%",
        distributed: false,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => formatCompactCurrency(val),
      style: { fontSize: "11px", fontWeight: 600, colors: ["#0f172a"] },
      offsetX: 4,
    },
    legend: { show: false },
    xaxis: {
      categories: ranked.map((item) => productLabel(item.product)),
      max: Math.ceil(maxAmount * 1.15),
      labels: {
        formatter: (val) => formatCompactCurrency(Number(val)),
        style: { colors: "#64748B", fontSize: "11px" },
      },
    },
    yaxis: {
      labels: {
        style: { colors: "#64748B", fontSize: "11px", fontWeight: 500 },
        maxWidth: 140,
      },
    },
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: "light",
      cssClass: "!bg-white !text-slate-700",
      y: {
        formatter: (val: number) => formatCompactCurrency(val),
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Top products by volume
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Approved / funded amount in period
            </p>
          </div>
        </div>
      </div>

      <Chart
        options={options}
        series={[
          {
            name: "Volume",
            data: ranked.map((item) => item.totalApprovedAmount),
          },
        ]}
        type="bar"
        height={Math.max(ranked.length * 52, 220)}
      />
    </div>
  );
}
