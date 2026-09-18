import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { GitBranch } from "lucide-react";
import type { AdminAnalytics } from "../../lib/adminDashboardStats";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  CLIENT_PENDING: "Client Pending",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  LENDER_SELECTED: "Lender Selected",
  LENDER_APPROVED: "Approved",
  LENDER_DECLINED: "Declined",
  FUNDED: "Funded",
  WITHDRAWN: "Withdrawn",
  SUSPENDED: "Suspended",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94A3B8",
  CLIENT_PENDING: "#F59E0B",
  SUBMITTED: "#3B82F6",
  IN_REVIEW: "#6366F1",
  LENDER_SELECTED: "#8B5CF6",
  LENDER_APPROVED: "#22C55E",
  LENDER_DECLINED: "#EF4444",
  FUNDED: "#14B8A6",
  WITHDRAWN: "#64748B",
  SUSPENDED: "#78716C",
};

type Props = {
  analytics: AdminAnalytics | null | undefined;
  loading?: boolean;
};

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-[240px] rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function ApplicationPipelineChart({
  analytics,
  loading = false,
}: Props) {
  if (loading) return <ChartSkeleton />;

  const byStatus = analytics?.applicationsByStatus || {};
  const entries = Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!analytics || entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500">
          No application pipeline data for this period.
        </p>
      </div>
    );
  }

  const categories = entries.map(
    ([status]) => STATUS_LABELS[status] || status.replace(/_/g, " "),
  );
  const values = entries.map(([, count]) => count);
  const colors = entries.map(
    ([status]) => STATUS_COLORS[status] || "#13538A",
  );

  const options: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    colors,
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: "62%",
        distributed: true,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val}`,
      style: { fontSize: "11px", fontWeight: 600 },
    },
    legend: { show: false },
    xaxis: {
      categories,
      labels: { style: { colors: "#64748B", fontSize: "12px" } },
    },
    yaxis: {
      labels: {
        style: { colors: "#64748B", fontSize: "12px", fontWeight: 500 },
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
      y: { formatter: (val: number) => `${val} applications` },
    },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
          <GitBranch className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Loan pipeline by status
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Full application lifecycle for the selected period
          </p>
        </div>
      </div>

      <Chart
        options={options}
        series={[{ name: "Applications", data: values }]}
        type="bar"
        height={Math.max(entries.length * 48, 200)}
      />
    </div>
  );
}
