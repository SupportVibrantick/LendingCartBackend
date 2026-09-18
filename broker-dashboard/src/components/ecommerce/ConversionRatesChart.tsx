import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { BrokerStats } from "../../lib/brokerDashboardStats";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
}

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-[260px] rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export default function ConversionRatesChart({ stats, loading }: Props) {
  if (loading) return <ChartSkeleton />;
  if (!stats) return null;

  const rates = [
    {
      label: "Submission",
      value: stats.conversion.submissionRate,
      helper: `${stats.totalSubmitted}/${stats.totalApplications}`,
      color: "#0EA5E9",
    },
    {
      label: "Approval",
      value: stats.conversion.approvalRate,
      helper: `${stats.totalApproved}/${stats.totalSubmitted || 0}`,
      color: "#10B981",
    },
    {
      label: "Funding",
      value: stats.conversion.fundingRate,
      helper: `${stats.applicationsByStatus?.FUNDED || 0}/${stats.totalApproved || 0}`,
      color: "#13538A",
    },
  ];

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      sparkline: { enabled: false },
    },
    plotOptions: {
      radialBar: {
        offsetY: 8,
        startAngle: -120,
        endAngle: 120,
        hollow: { size: "28%" },
        track: {
          background: "#F1F5F9",
          strokeWidth: "100%",
          margin: 8,
        },
        dataLabels: {
          name: {
            fontSize: "12px",
            color: "#64748B",
            offsetY: 28,
          },
          value: {
            fontSize: "18px",
            fontWeight: 700,
            color: "#0F172A",
            offsetY: -8,
            formatter: (val) => `${Math.round(val)}%`,
          },
        },
      },
    },
    colors: rates.map((rate) => rate.color),
    labels: rates.map((rate) => rate.label),
    legend: {
      show: true,
      position: "bottom",
      fontSize: "12px",
      markers: { size: 7 },
      itemMargin: { horizontal: 10 },
    },
    stroke: { lineCap: "round" },
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
          Conversion Rates
        </p>
        <h3 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
          Pipeline efficiency
        </h3>
      </div>

      <div className="min-h-0 flex-1">
        <Chart
          options={options}
          series={rates.map((rate) => rate.value)}
          type="radialBar"
          height={280}
        />
      </div>

      <div className="mt-1 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        {rates.map((rate) => (
          <div key={rate.label} className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {rate.label}
            </p>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
              {rate.helper}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
