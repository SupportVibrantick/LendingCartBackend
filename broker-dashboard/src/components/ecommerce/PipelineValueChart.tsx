import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  formatCompactCount,
  type BrokerStats,
} from "../../lib/brokerDashboardStats";
import DashboardWidget from "./DashboardWidget";

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
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

export default function PipelineValueChart({ stats, loading }: Props) {
  const by = stats?.applicationsByStatus || {};
  const open = OPEN_KEYS.reduce((sum, key) => sum + Number(by[key] || 0), 0);
  const funded = Number(by.FUNDED || 0);
  const lost = LOST_KEYS.reduce((sum, key) => sum + Number(by[key] || 0), 0);
  const rows = [
    { label: "Open", value: open, color: "#4C78F5" },
    { label: "Funded", value: funded, color: "#14B8A6" },
    ...(lost > 0 ? [{ label: "Lost", value: lost, color: "#F43F5E" }] : []),
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 8,
        barHeight: "58%",
        distributed: true,
      },
    },
    colors: rows.map((row) => row.color),
    dataLabels: {
      enabled: true,
      formatter: (val) => String(Math.round(Number(val))),
      style: { fontSize: "11px", fontWeight: 700, colors: ["#fff"] },
    },
    legend: { show: false },
    grid: {
      borderColor: "#EEF2F6",
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
      padding: { left: 8, right: 12, top: -8, bottom: -8 },
    },
    xaxis: {
      categories: rows.map((row) => row.label),
      min: 0,
      max: Math.max(1, Math.ceil(max * 1.15)),
      tickAmount: 5,
      labels: {
        style: { colors: "#9aa0a6", fontSize: "11px" },
        formatter: (value) => String(Math.round(Number(value))),
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#6b7280", fontSize: "12px" },
      },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(value)} applications` },
    },
  };

  return (
    <DashboardWidget title="Pipeline Value" subtitle="This period" loading={loading}>
      <div className="min-h-0 flex-1">
        <Chart
          options={options}
          series={[
            {
              name: "Applications",
              data: rows.map((row) => ({ x: row.label, y: row.value })),
            },
          ]}
          type="bar"
          height={200}
        />
      </div>
      <p className="mt-1 text-center text-[13px] text-[#6b7280]">
        Total applications{" "}
        <span className="font-semibold text-[#1f2328] dark:text-white">
          {formatCompactCount(total || Number(stats?.totalApplications || 0))}
        </span>
      </p>
    </DashboardWidget>
  );
}
