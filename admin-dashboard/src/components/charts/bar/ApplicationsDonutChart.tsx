import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";

interface Props {
  stats: any;
}

export default function ApplicationsDonutChart({ stats }: Props) {
  if (!stats) return null;

  const getCount = (status: string) =>
    stats.applications.breakdown.find((s: any) => s.status === status)
      ?._count || 0;

  const approved = getCount("LENDER_APPROVED");
  const declined = getCount("LENDER_DECLINED");
  const inReview = getCount("IN_REVIEW");
  const total = stats.applications.total;

  const approvedPct = total ? ((approved / total) * 100).toFixed(1) : 0;
  const declinedPct = total ? ((declined / total) * 100).toFixed(1) : 0;

  const options: ApexOptions = {
    chart: {
      type: "donut",
      toolbar: { show: false },
    },
    labels: ["Approved", "Declined", "In Review"],
    colors: [
      "#36A2EB", // Approved - Emerald
      "#FFCD56", // Declined - Rose
      "#FF5479", // In Review - Indigo
    ],
    stroke: {
      width: 3,
      colors: ["#ffffff"],
    },
    legend: {
      position: "bottom",
      fontSize: "14px",
      fontWeight: 500,
      markers: {
        size: 10,
        strokeWidth: 0,
        shape: "circle",
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (val: number) => `${val} Applications`,
      },
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
              fontSize: "14px",
              fontWeight: 600,
              color: "#36A2EB",
              formatter: () => `${total}`,
            },
          },
        },
      },
    },
  };

  const series = [approved, declined, inReview];

  return (
    <div className="w-full h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col dark:border-slate-800 dark:bg-[#0F172A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Application Status
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Approval performance overview
          </p>
        </div>

        {/* KPI Summary */}
        <div className="flex gap-6 mt-4 sm:mt-0">
          <div>
            <p className="text-xs text-slate-500">Approval Rate</p>
            <p className="text-sm font-semibold text-green-600">
              {approvedPct}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Decline Rate</p>
            <p className="text-sm font-semibold text-red-600">{declinedPct}%</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <Chart options={options} series={series} type="donut" height={260} />
    </div>
  );
}
