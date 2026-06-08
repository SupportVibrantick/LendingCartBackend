import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { TrendingUp, Send, BadgeDollarSign } from "lucide-react";

interface MonthlyTrendPoint {
  label: string;
  applications: number;
  submitted: number;
  approved: number;
  funded: number;
  fundedVolume: number;
}

interface BrokerStats {
  totalApplications: number;
  totalSubmitted: number;
  totalApproved: number;
  totalFunded: number;
  totalVolumeFunded: number;
  conversion: {
    submissionRate: number;
    approvalRate: number;
    fundingRate: number;
  };
  monthlyTrend: MonthlyTrendPoint[];
}

interface Props {
  stats: BrokerStats | null;
  loading: boolean;
}

function formatCurrency(value: number) {
  if (!value) {
    return "$0";
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`; 
  }

  return `$${Math.round(value)}`;
}

export default function StatisticsChart({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-slate-500">
          Loading pipeline performance... 
        </p>
      </div>
    );
  }

  if (!stats) return null;

  const trend = stats.monthlyTrend || [];

  const series = [
    {
      name: "Applications",
      type: "column" as const,
      data: trend.map((item) => item.applications),
    },
    {
      name: "Submitted",
      type: "column" as const, 
      data: trend.map((item) => item.submitted),
    },
    {
      name: "Funded Volume",
      type: "line" as const,
      data: trend.map((item) => item.fundedVolume),
    },
  ];

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      stacked: false,
    },
    colors: ["#1D4ED8", "#0EA5E9", "#0F766E"],
    stroke: {
      width: [0, 0, 3],
      curve: "smooth",
    }, 
    plotOptions: {
      bar: {
        columnWidth: "42%",
        borderRadius: 8,
      },
    },
    dataLabels: {
      enabled: false,
    },
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 4,
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
    },
    xaxis: {
      categories: trend.map((item) => item.label),
      labels: {
        style: {
          colors: "#64748B",
        },
      },
    },
    yaxis: [
      {
        title: {
          text: "Applications",
        },
        labels: {
          formatter: (value) => Math.round(value).toString(),
        },
      },
      {
        opposite: true,
        title: {
          text: "Funded Volume",
        },
        labels: {
          formatter: (value) => formatCurrency(value),
        },
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value, context) =>
          context.seriesIndex === 2
            ? formatCurrency(value)
            : Math.round(value).toString(),
      },
    },
  };

  const performanceCards = [
    {
      label: "Submission Rate",
      value: `${stats.conversion.submissionRate}%`,
      helper: `${stats.totalSubmitted} of ${stats.totalApplications} applications moved forward`,
      icon: <Send className="h-5 w-5 text-sky-600" />,
    },
    {
      label: "Approval Rate",
      value: `${stats.conversion.approvalRate}%`,
      helper: `${stats.totalApproved} approvals from submitted applications`,
      icon: <TrendingUp className="h-5 w-5 text-emerald-600" />,
    },
    {
      label: "Funding Rate",
      value: `${stats.conversion.fundingRate}%`,
      helper: `${stats.totalFunded} approvals converted into funding`,
      icon: <BadgeDollarSign className="h-5 w-5 text-indigo-600" />,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-600">
            Pipeline Momentum
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            Monthly application flow and funded volume
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            A six month snapshot of origination activity across your broker
            pipeline.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Total Funded Volume
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            {formatCurrency(stats.totalVolumeFunded)}
          </p>
        </div>
      </div>

      <Chart options={options} series={series} type="line" height={360} />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {performanceCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {card.label}
              </p>
              {card.icon}
            </div>
            <p className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{card.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
