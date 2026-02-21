import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { Building2 } from "lucide-react";

interface Props {
  stats: any;
}

export default function StatisticsChart({ stats }: Props) {
  if (!stats) return null;

  const getOrgCount = (type: string) =>
    stats.organizations.breakdown.find((o: any) => o.type === type)?._count ||
    0;

  const brokers = getOrgCount("BROKER");
  const lenders = getOrgCount("LENDER");
  const platform = getOrgCount("PLATFORM");
  const total = brokers + lenders + platform;

  const options: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "'Inter', sans-serif",
    },

    //  Beautiful SaaS Colors
    colors: [
      "#6366F1", // Indigo - Brokers
      "#22C55E", // Emerald - Lenders
      "#F59E0B", // Amber - Platform
    ],

    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: "45%",
        distributed: true, // Important (gives each bar different color)
      },
    },

    dataLabels: {
      enabled: false,
    },

    xaxis: {
      categories: ["Brokers", "Lenders", "Platform"],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: "#64748B",
          fontSize: "13px",
          fontWeight: 500,
        },
      },
    },

    yaxis: {
      labels: {
        style: {
          colors: "#94A3B8",
        },
      },
    },

    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 4,
    },

    tooltip: {
      theme: "light",
      y: {
        formatter: (val: number) => `${val} Organizations`,
      },
    },
  };

  const series = [
    {
      name: "Organizations",
      data: [brokers, lenders, platform],
    },
  ];

  return (
    <div className="w-full h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col dark:border-slate-800 dark:bg-[#0F172A]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center 
                rounded-xl bg-white text-blue-600 shadow-sm"
          >
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Organization Distribution
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ecosystem partner breakdown
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Total
          </p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white">
            {total}
          </p>
        </div>
      </div>

      {/* Chart */}
      <Chart options={options} series={series} type="bar" height={260} />

      {/* Footer Summary */}
      <div className="mt-8 grid grid-cols-3 gap-6 border-t border-slate-100 pt-6 dark:border-slate-800">
        {[
          { label: "Brokers", val: brokers },
          { label: "Lenders", val: lenders },
          { label: "Platform", val: platform },
        ].map((item, i) => (
          <div key={i} className="text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {item.val}
            </p>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
