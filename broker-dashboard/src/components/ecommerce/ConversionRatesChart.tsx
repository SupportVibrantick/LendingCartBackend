import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  formatCompactCurrency,
  type BrokerStats,
} from "../../lib/brokerDashboardStats";
import DashboardWidget from "./DashboardWidget";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
}

export default function ConversionRatesChart({ stats, loading }: Props) {
  const total = Number(stats?.totalApplications || 0);
  const funded = Number(stats?.totalFunded || 0);
  const conversionRate = total > 0 ? (funded / total) * 100 : 0;

  const options: ApexOptions = {
    chart: {
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    colors: ["#4C78F5"],
    plotOptions: {
      radialBar: {
        startAngle: 0,
        endAngle: 360,
        hollow: {
          size: "78%",
          background: "transparent",
        },
        track: {
          background: "#E8F1F8",
          strokeWidth: "100%",
          margin: 0,
        },
        dataLabels: {
          name: { show: false },
          value: {
            show: true,
            fontSize: "26px",
            fontWeight: 600,
            color: "#1f2328",
            offsetY: 8,
            formatter: () => `${conversionRate.toFixed(2)}%`,
          },
        },
      },
    },
    stroke: { lineCap: "round" },
  };

  return (
    <DashboardWidget title="Conversion Rate" subtitle="This period" loading={loading}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <Chart options={options} series={[conversionRate]} type="radialBar" height={220} />
        <p className="-mt-2 text-[13px] text-[#6b7280]">
          Funded volume{" "}
          <span className="font-semibold text-[#1f2328] dark:text-white">
            {formatCompactCurrency(Number(stats?.totalVolumeFunded || 0))}
          </span>
        </p>
      </div>
    </DashboardWidget>
  );
}
