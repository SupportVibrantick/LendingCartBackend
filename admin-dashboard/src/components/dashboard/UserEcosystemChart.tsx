import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Loader2, Users } from "lucide-react";

type Props = {
  stats: {
    users?: { total?: number; loanOfficers?: number; subBrokers?: number };
    clients?: { total?: number; active?: number };
  } | null;
};

export default function UserEcosystemChart({ stats }: Props) {
  if (!stats) {
    return (
      <div className="flex h-[340px] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-6 w-6 animate-spin text-[#13538A]" />
      </div>
    );
  }

  const loanOfficers = stats.users?.loanOfficers ?? 0;
  const subBrokers = stats.users?.subBrokers ?? 0;
  const clients = stats.clients?.total ?? 0;
  const totalUsers = stats.users?.total ?? 0;
  const otherUsers = Math.max(totalUsers - loanOfficers - subBrokers, 0);

  const options: ApexOptions = {
    chart: {
      type: "donut",
      toolbar: { show: false },
    },
    labels: ["Loan Officers", "Sub-Brokers", "Clients", "Other Users"],
    colors: ["#7C3AED", "#F59E0B", "#06B6D4", "#64748B"],
    stroke: { width: 3, colors: ["#ffffff"] },
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontWeight: 500,
    },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Platform",
              fontSize: "13px",
              fontWeight: 600,
              formatter: () => `${totalUsers + clients}`,
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (val: number) => `${val} users` },
    },
  };

  const series = [loanOfficers, subBrokers, clients, otherUsers];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            User Ecosystem
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Platform participants breakdown
          </p>
        </div>
      </div>

      <Chart options={options} series={series} type="donut" height={260} />

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Loan Officers", value: loanOfficers },
          { label: "Sub-Brokers", value: subBrokers },
          { label: "Clients", value: clients },
          { label: "Active Clients", value: stats.clients?.active ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
            <p className="text-[10px] text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
