import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { BrokerStats } from "../../lib/brokerDashboardStats";
import DashboardWidget from "./DashboardWidget";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onSliceClick?: (key: "OPEN" | "FUNDED" | "LOST") => void;
}

const OPEN_KEYS = [
  "DRAFT",
  "INCOMPLETE",
  "CLIENT_PENDING",
  "SUBMITTED",
  "IN_REVIEW",
  "LENDER_SELECTED",
  "LENDER_APPROVED",
];
const LOST_KEYS = ["LENDER_DECLINED", "WITHDRAWN", "SUSPENDED"];

function buckets(stats: BrokerStats | null) {
  const by = stats?.applicationsByStatus || {};
  const open = OPEN_KEYS.reduce((sum, key) => sum + Number(by[key] || 0), 0);
  const funded = Number(by.FUNDED || 0);
  const lost = LOST_KEYS.reduce((sum, key) => sum + Number(by[key] || 0), 0);
  return {
    open,
    funded,
    lost,
    total: open + funded + lost || Number(stats?.totalApplications || 0),
  };
}

export default function ApplicationStatusChart({
  stats,
  loading,
  onSliceClick,
}: Props) {
  const { open, funded, lost, total } = buckets(stats);
  const slices = [
    { key: "OPEN" as const, label: "Open", count: open, color: "#13538A" },
    { key: "FUNDED" as const, label: "Funded", count: funded, color: "#14B8A6" },
    { key: "LOST" as const, label: "Lost", count: lost, color: "#F43F5E" },
  ].filter((slice) => slice.count > 0 || slice.key !== "LOST");

  const series = slices.map((slice) => slice.count);
  const hasData = series.some((value) => value > 0);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _ctx, config) => {
          const key = slices[config.dataPointIndex]?.key;
          if (key) onSliceClick?.(key);
        },
      },
    },
    labels: slices.map((slice) => slice.label),
    colors: slices.map((slice) => slice.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { colors: ["#FFFFFF"], width: 2 },
    plotOptions: {
      pie: {
        donut: {
          size: "78%",
          labels: {
            show: true,
            name: { show: false },
            value: {
              show: true,
              fontSize: "28px",
              fontWeight: 600,
              color: "#1f2328",
              offsetY: 8,
            },
            total: {
              show: true,
              showAlways: true,
              label: "",
              fontSize: "28px",
              fontWeight: 600,
              color: "#1f2328",
              formatter: () => String(total),
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (value) => `${Math.round(value)} apps` },
    },
  };

  return (
    <DashboardWidget title="Application Status" subtitle="This period" loading={loading}>
      <div className="flex min-h-0 flex-1 items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {hasData ? (
            <Chart options={options} series={series} type="donut" height={220} />
          ) : (
            <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-[14px] border-[#eef2f6] text-[28px] font-semibold text-[#1f2328] dark:border-gray-700 dark:text-white">
              0
            </div>
          )}
        </div>
        <ul className="w-[128px] shrink-0 space-y-2">
          {slices.map((slice) => (
            <li key={slice.key}>
              <button
                type="button"
                onClick={() => onSliceClick?.(slice.key)}
                className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-2.5 py-2 text-left transition hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate text-[13px] font-medium text-slate-600 dark:text-gray-300">
                    {slice.label}
                  </span>
                </span>
                <span className="text-[13px] font-bold text-slate-900 dark:text-white">
                  {slice.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DashboardWidget>
  );
}
