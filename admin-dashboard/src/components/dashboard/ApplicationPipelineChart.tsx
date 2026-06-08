import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { GitBranch, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  SUBMITTED: "Submitted",
  SENT_TO_LENDERS: "Sent to Lenders",
  LENDER_APPROVED: "Approved",
  LENDER_DECLINED: "Declined",
  LENDER_CONDITIONAL: "Conditional",
  FUNDED: "Funded",
  CLOSED: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94A3B8",
  IN_REVIEW: "#6366F1",
  SUBMITTED: "#3B82F6",
  SENT_TO_LENDERS: "#8B5CF6",
  LENDER_APPROVED: "#22C55E",
  LENDER_DECLINED: "#EF4444",
  LENDER_CONDITIONAL: "#F59E0B",
  FUNDED: "#14B8A6",
  CLOSED: "#64748B",
};

type Props = {
  stats: {
    applications?: {
      breakdown?: { status: string; _count: number }[];
    };
  } | null;
};

export default function ApplicationPipelineChart({ stats }: Props) {
  const breakdown = stats?.applications?.breakdown ?? [];

  if (!stats) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-6 w-6 animate-spin text-[#13538A]" />
      </div>
    );
  }

  if (breakdown.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500">No application pipeline data yet.</p>
      </div>
    );
  }

  const sorted = [...breakdown].sort((a, b) => b._count - a._count);
  const categories = sorted.map(
    (item) => STATUS_LABELS[item.status] || item.status.replace(/_/g, " "),
  );
  const values = sorted.map((item) => item._count);
  const colors = sorted.map(
    (item) => STATUS_COLORS[item.status] || "#13538A",
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
      labels: { style: { colors: "#64748B", fontSize: "12px", fontWeight: 500 } },
    },
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      y: { formatter: (val: number) => `${val} applications` },
    },
  };

  const series = [{ name: "Applications", data: values }];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
          <GitBranch className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Loan Pipeline by Status
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Full application lifecycle distribution
          </p>
        </div>
      </div>

      <Chart
        options={options}
        series={series}
        type="bar"
        height={Math.max(sorted.length * 48, 200)}
      />
    </div>
  );
}
