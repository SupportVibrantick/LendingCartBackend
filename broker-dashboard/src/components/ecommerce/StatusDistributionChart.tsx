import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { BrokerStats } from "../../lib/brokerDashboardStats";
import DashboardWidget from "./DashboardWidget";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
  onStatusClick?: (statusKey: string) => void;
}

const STATUS_META = [
  { key: "DRAFT", label: "Draft", color: "#94A3B8" },
  { key: "INCOMPLETE", label: "Incomplete", color: "#F5B942" },
  { key: "CLIENT_PENDING", label: "Client Pending", color: "#FB923C" },
  { key: "SUBMITTED", label: "Submitted", color: "#38BDF8" },
  { key: "IN_REVIEW", label: "In Review", color: "#818CF8" },
  { key: "LENDER_SELECTED", label: "Lender Selected", color: "#A78BFA" },
  { key: "LENDER_APPROVED", label: "Approved", color: "#34D399" },
  { key: "LENDER_DECLINED", label: "Declined", color: "#F87171" },
  { key: "FUNDED", label: "Funded", color: "#0EA5E9" },
  { key: "WITHDRAWN", label: "Withdrawn", color: "#E11D48" },
  { key: "SUSPENDED", label: "Suspended", color: "#64748B" },
];

export default function StatusDistributionChart({
  stats,
  loading,
  onStatusClick,
}: Props) {
  const allRows = STATUS_META.map((status) => ({
    ...status,
    count: Number(stats?.applicationsByStatus?.[status.key] || 0),
  }));
  const active = allRows.filter((row) => row.count > 0);
  const total = allRows.reduce((sum, row) => sum + row.count, 0);
  const chartRows = active.length > 0 ? active : allRows.slice(0, 1);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _ctx, config) => {
          const statusKey = chartRows[config.dataPointIndex]?.key;
          if (statusKey && onStatusClick) onStatusClick(statusKey);
        },
      },
    },
    labels: chartRows.map((row) => row.label),
    colors: chartRows.map((row) => row.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { colors: ["#FFFFFF"], width: 2 },
    tooltip: {
      theme: "light",
      y: {
        formatter: (value) => {
          const pct = total ? ((value / total) * 100).toFixed(2) : "0.00";
          return `${Math.round(value)} apps (${pct}%)`;
        },
      },
    },
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
  };

  return (
    <DashboardWidget title="Stages Distribution" subtitle="This period" loading={loading}>
      <div className="flex min-h-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {total > 0 ? (
            <Chart
              options={options}
              series={chartRows.map((row) => row.count)}
              type="donut"
              height={230}
            />
          ) : (
            <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-[14px] border-[#eef2f6] text-[28px] font-semibold text-[#1f2328] dark:border-gray-700 dark:text-white">
              0
            </div>
          )}
        </div>
        <ul className="max-h-[240px] w-[148px] shrink-0 space-y-1.5 overflow-y-auto pr-1">
          {allRows.map((row) => {
            const pct = total ? ((row.count / total) * 100).toFixed(2) : "0.00";
            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onStatusClick?.(row.key)}
                  className="flex w-full items-start gap-2 text-left hover:opacity-80"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-[#4b5563] dark:text-gray-300">
                      {row.label}
                    </span>
                    <span className="block text-[11px] text-[#9aa0a6]">
                      {pct}% · {row.count}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </DashboardWidget>
  );
}
