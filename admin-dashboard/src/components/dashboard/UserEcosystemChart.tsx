import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Users } from "lucide-react";
import { orgCount, type AdminStats } from "../../lib/adminDashboardStats";

type Props = {
  stats: AdminStats | null;
  loading?: boolean;
};

function ChartSkeleton() {
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mx-auto h-[220px] w-[220px] rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function UserEcosystemChart({ stats, loading = false }: Props) {
  if (loading) return <ChartSkeleton />;
  if (!stats) {
    return (
      <div className="flex h-full min-h-[340px] items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        No ecosystem data available.
      </div>
    );
  }

  const brokers = orgCount(stats.organizations?.breakdown, "BROKER");
  const lenders = orgCount(stats.organizations?.breakdown, "LENDER");
  const loanOfficers = stats.users?.loanOfficers ?? 0;
  const subBrokers = stats.users?.subBrokers ?? 0;
  const clients = stats.clients?.total ?? 0;
  const totalUsers = stats.users?.total ?? 0;
  const otherUsers = Math.max(totalUsers - loanOfficers - subBrokers, 0);

  const slices = [
    { label: "Brokers", value: brokers, color: "#13538A" },
    { label: "Lenders", value: lenders, color: "#10B981" },
    { label: "Loan Officers", value: loanOfficers, color: "#7C3AED" },
    { label: "Co-Brokers", value: subBrokers, color: "#F59E0B" },
    { label: "Clients", value: clients, color: "#06B6D4" },
    { label: "Other Users", value: otherUsers, color: "#64748B" },
  ].filter((item) => item.value > 0);

  const platformTotal = slices.reduce((sum, item) => sum + item.value, 0);

  const options: ApexOptions = {
    chart: { type: "donut", toolbar: { show: false } },
    labels: slices.map((item) => item.label),
    colors: slices.map((item) => item.color),
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
              formatter: () => `${platformTotal}`,
            },
          },
        },
      },
    },
    tooltip: {
      theme: "light",
      cssClass: "!bg-white !text-slate-700",
      y: { formatter: (val: number) => `${val} participants` },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Platform ecosystem
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Orgs, officers, co-brokers & clients
          </p>
        </div>
      </div>

      {platformTotal === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No ecosystem participants yet.
        </div>
      ) : (
        <Chart
          options={options}
          series={slices.map((item) => item.value)}
          type="donut"
          height={260}
        />
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { label: "Brokers", value: brokers },
          { label: "Lenders", value: lenders },
          { label: "Loan Officers", value: loanOfficers },
          { label: "Co-Brokers", value: subBrokers },
          { label: "Clients", value: clients },
          { label: "Active Clients", value: stats.clients?.active ?? 0 },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg bg-slate-50 px-2 py-1.5 text-center dark:bg-slate-800/50"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {item.value}
            </p>
            <p className="text-[10px] text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
