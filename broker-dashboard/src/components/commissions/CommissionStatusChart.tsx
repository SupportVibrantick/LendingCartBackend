import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { CommissionSummary } from "../../lib/commissionApi";
import { formatCommissionCurrency } from "../../lib/commissionApi";
import DashboardWidget from "../ecommerce/DashboardWidget";

type Props = {
  summary: CommissionSummary | null;
  loading?: boolean;
};

export default function CommissionStatusChart({
  summary,
  loading = false,
}: Props) {
  const pending = Number(summary?.totals.pending || 0);
  const paid = Number(summary?.totals.paid || 0);
  const total = pending + paid;
  const slices = [
    { label: "Pending", value: pending, color: "#F59E0B" },
    { label: "Paid", value: paid, color: "#059669" },
  ].filter((slice) => slice.value > 0);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    labels: slices.map((slice) => slice.label),
    colors: slices.map((slice) => slice.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { colors: ["#FFFFFF"], width: 2 },
    plotOptions: {
      pie: {
        donut: {
          size: "76%",
          labels: {
            show: true,
            name: { show: false },
            value: {
              show: true,
              fontSize: "18px",
              fontWeight: 700,
              color: "#1f2328",
              offsetY: 6,
              formatter: (val) => formatCommissionCurrency(Number(val)),
            },
            total: {
              show: true,
              showAlways: true,
              label: "Total",
              fontSize: "11px",
              fontWeight: 600,
              color: "#64748b",
              formatter: () => formatCommissionCurrency(total),
            },
          },
        },
      },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => formatCommissionCurrency(Number(value)) },
    },
  };

  return (
    <DashboardWidget
      title="Payout mix"
      subtitle="Pending vs paid dollars"
      loading={loading}
      minHeight="320px"
    >
      {slices.length ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center">
            <Chart
              options={options}
              series={slices.map((slice) => slice.value)}
              type="donut"
              height={210}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {slices.map((slice) => (
              <div
                key={slice.label}
                className="rounded-xl border border-border px-3 py-2 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    {slice.label}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-text-primary dark:text-white">
                  {formatCommissionCurrency(slice.value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-secondary dark:border-slate-700">
          No commission dollars yet
        </div>
      )}
    </DashboardWidget>
  );
}
