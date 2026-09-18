import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { AdminAnalytics } from "../../../lib/adminDashboardStats";

type Props = {
  analytics: AdminAnalytics | null | undefined;
  loading?: boolean;
};

const STATUS_ORDER = [
  "FUNDED",
  "LENDER_APPROVED",
  "IN_REVIEW",
  "SUBMITTED",
  "LENDER_DECLINED",
  "CLIENT_PENDING",
  "DRAFT",
  "WITHDRAWN",
] as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  FUNDED: { label: "Funded", color: "#14B8A6" },
  LENDER_APPROVED: { label: "Approved", color: "#22C55E" },
  IN_REVIEW: { label: "In Review", color: "#6366F1" },
  SUBMITTED: { label: "Submitted", color: "#0EA5E9" },
  LENDER_DECLINED: { label: "Declined", color: "#EF4444" },
  CLIENT_PENDING: { label: "Client Pending", color: "#F59E0B" },
  DRAFT: { label: "Draft", color: "#94A3B8" },
  WITHDRAWN: { label: "Withdrawn", color: "#64748B" },
  LENDER_SELECTED: { label: "Lender Selected", color: "#8B5CF6" },
  SUSPENDED: { label: "Suspended", color: "#78716C" },
};

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-6 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mx-auto h-[220px] w-[220px] rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function ApplicationsDonutChart({
  analytics,
  loading = false,
}: Props) {
  if (loading) return <ChartSkeleton />;
  if (!analytics) {
    return (
      <div className="flex h-full min-h-[340px] items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        No status data available.
      </div>
    );
  }

  const byStatus = analytics.applicationsByStatus || {};
  const slices = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_META[status]?.label || status,
    color: STATUS_META[status]?.color || "#13538A",
    value: byStatus[status] || 0,
  })).filter((item) => item.value > 0);

  const total = slices.reduce((sum, item) => sum + item.value, 0);
  const approved = (byStatus.LENDER_APPROVED || 0) + (byStatus.FUNDED || 0);
  const declined = byStatus.LENDER_DECLINED || 0;
  const approvedPct = total ? ((approved / total) * 100).toFixed(1) : "0.0";
  const declinedPct = total ? ((declined / total) * 100).toFixed(1) : "0.0";

  if (!total) {
    return (
      <div className="flex h-full min-h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
            Status mix
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
            Application status
          </h3>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No applications in this period.
        </div>
      </div>
    );
  }

  const options: ApexOptions = {
    chart: { type: "donut", toolbar: { show: false } },
    labels: slices.map((item) => item.label),
    colors: slices.map((item) => item.color),
    stroke: { width: 3, colors: ["#ffffff"] },
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontWeight: 500,
      markers: { size: 8, strokeWidth: 0, shape: "circle" },
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: "light",
      cssClass: "!bg-white !text-slate-700",
      y: { formatter: (val: number) => `${val} applications` },
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: "72%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              fontSize: "13px",
              fontWeight: 600,
              color: "#13538A",
              formatter: () => `${total}`,
            },
          },
        },
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
            Status mix
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
            Application status
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Period distribution across the loan lifecycle
          </p>
        </div>
        <div className="flex gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Approval
            </p>
            <p className="text-sm font-semibold text-emerald-600">{approvedPct}%</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Decline
            </p>
            <p className="text-sm font-semibold text-rose-600">{declinedPct}%</p>
          </div>
        </div>
      </div>

      <Chart
        options={options}
        series={slices.map((item) => item.value)}
        type="donut"
        height={260}
      />
    </div>
  );
}
