import { Link } from "react-router";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  ArrowRight,
  Building2,
  Contact,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import {
  formatCompactCount,
  type BrokerNetworkStats,
  type BrokerStats,
} from "../../lib/brokerDashboardStats";
import DashboardWidget from "./DashboardWidget";

type Portal = "broker" | "loanOfficer";

type Props = {
  stats: BrokerStats | null;
  loading: boolean;
  portal?: Portal;
  showMetricStrip?: boolean;
};

function portalPaths(portal: Portal) {
  if (portal === "loanOfficer") {
    return {
      lenders: "/loan-officer/lender-marketplace",
      officers: "/loan-officer/dashboard",
      coBrokers: "/loan-officer/co-brokers",
      borrowers: "/loan-officer/borrowers",
      contacts: "/loan-officer/contacts",
    };
  }
  return {
    lenders: "/lender-marketplace",
    officers: "/loan-officers",
    coBrokers: "/sub-brokers",
    borrowers: "/borrowers",
    contacts: "/contacts-list",
  };
}

const BRAND = "#4C78F5";
const TEAL = "#14B8A6";
const AMBER = "#F59E0B";
const ROSE = "#F43F5E";
const VIOLET = "#8B5CF6";
const SLATE = "#94A3B8";

function formatContactType(type?: string) {
  if (!type) return "Other";
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptyNetwork(): BrokerNetworkStats {
  return {
    lenders: { connected: 0, inactive: 0, total: 0 },
    officers: { total: 0, active: 0, disabled: 0 },
    coBrokers: { total: 0, active: 0, disabled: 0 },
    borrowers: { total: 0, portalReady: 0, pendingLink: 0, clients: 0 },
    contacts: { total: 0, byType: [] },
    topOfficers: [],
  };
}

function MetricStrip({
  network,
  portal,
}: {
  network: BrokerNetworkStats;
  portal: Portal;
}) {
  const paths = portalPaths(portal);
  const items = [
    {
      label: "Lenders",
      value: network.lenders.connected,
      hint: `${network.lenders.inactive} inactive`,
      to: paths.lenders,
      icon: Store,
      tone: "bg-teal-50 text-teal-700",
    },
    ...(portal === "broker"
      ? [
          {
            label: "Officers",
            value: network.officers.active,
            hint: `${network.officers.total} total`,
            to: paths.officers,
            icon: Users,
            tone: "bg-violet-50 text-violet-600",
          },
        ]
      : []),
    {
      label: "Co-Brokers",
      value: network.coBrokers.active,
      hint: `${network.coBrokers.total} total`,
      to: paths.coBrokers,
      icon: Building2,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Borrowers",
      value: network.borrowers.clients || network.borrowers.portalReady,
      hint: `${network.borrowers.pendingLink} pending link`,
      to: paths.borrowers,
      icon: UserRound,
      tone: "bg-rose-50 text-rose-600",
    },
    {
      label: "Contacts",
      value: network.contacts.total,
      hint: `${network.contacts.byType.length || 0} types`,
      to: paths.contacts,
      icon: Contact,
      tone: "bg-cyan-50 text-cyan-700",
    },
  ];

  const stripCols =
    portal === "loanOfficer"
      ? "grid grid-cols-2 gap-3 md:grid-cols-4"
      : "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5";

  return (
    <div className={stripCols}>
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className="group rounded-2xl border border-border bg-white p-4 transition hover:border-brand-200 hover:bg-surface dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                {item.label}
              </p>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-text-primary dark:text-white">
                {formatCompactCount(item.value)}
              </p>
              <p className="mt-2 truncate text-[12px] text-text-secondary">
                {item.hint}
              </p>
            </div>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
            >
              <item.icon className="h-4 w-4" />
            </span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-500 opacity-0 transition group-hover:opacity-100">
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}

function NetworkMixChart({
  network,
  portal,
}: {
  network: BrokerNetworkStats;
  portal: Portal;
}) {
  const rows = [
    { label: "Lenders", value: network.lenders.connected, color: TEAL },
    ...(portal === "broker"
      ? [{ label: "Officers", value: network.officers.total, color: VIOLET }]
      : []),
    { label: "Co-Brokers", value: network.coBrokers.total, color: AMBER },
    {
      label: "Borrowers",
      value: network.borrowers.clients || network.borrowers.total,
      color: ROSE,
    },
    { label: "Contacts", value: network.contacts.total, color: BRAND },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 8,
        barHeight: "62%",
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
      padding: { left: 4, right: 12, top: -8, bottom: -8 },
    },
    xaxis: {
      categories: rows.map((row) => row.label),
      min: 0,
      max: Math.max(1, Math.ceil(max * 1.15)),
      labels: {
        style: { colors: "#9aa0a6", fontSize: "11px" },
        formatter: (value) => String(Math.round(Number(value))),
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: "#6b7280", fontSize: "12px" } },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(Number(value))} records` },
    },
  };

  return (
    <DashboardWidget
      title="Network mix"
      subtitle="People and partners across your org"
      minHeight="340px"
    >
      <Chart
        options={options}
        series={[{ name: "Count", data: rows.map((row) => row.value) }]}
        type="bar"
        height={250}
      />
    </DashboardWidget>
  );
}

function TeamHealthChart({
  network,
  portal,
}: {
  network: BrokerNetworkStats;
  portal: Portal;
}) {
  const paths = portalPaths(portal);
  const categories =
    portal === "loanOfficer" ? ["Co-Brokers"] : ["Officers", "Co-Brokers"];
  const active =
    portal === "loanOfficer"
      ? [network.coBrokers.active]
      : [network.officers.active, network.coBrokers.active];
  const disabled =
    portal === "loanOfficer"
      ? [network.coBrokers.disabled]
      : [network.officers.disabled, network.coBrokers.disabled];

  const options: ApexOptions = {
    chart: {
      stacked: true,
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    colors: [BRAND, SLATE],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "42%",
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      markers: { size: 7 },
    },
    grid: {
      borderColor: "#EEF2F6",
      strokeDashArray: 3,
      padding: { left: 4, right: 4 },
    },
    xaxis: {
      categories,
      labels: { style: { colors: "#64748b", fontSize: "12px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      tickAmount: 4,
      labels: {
        style: { colors: "#94a3b8", fontSize: "11px" },
        formatter: (value) => String(Math.round(Number(value))),
      },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(Number(value))} people` },
    },
  };

  return (
    <DashboardWidget
      title="Team health"
      subtitle="Active vs disabled seats"
      minHeight="340px"
      right={
        <Link
          to={portal === "loanOfficer" ? paths.coBrokers : paths.officers}
          className="text-[12px] font-semibold text-brand-500 hover:underline"
        >
          Manage
        </Link>
      }
    >
      <Chart
        options={options}
        series={[
          { name: "Active", data: active },
          { name: "Disabled", data: disabled },
        ]}
        type="bar"
        height={250}
      />
    </DashboardWidget>
  );
}

function BorrowerPortalChart({
  network,
  portal,
}: {
  network: BrokerNetworkStats;
  portal: Portal;
}) {
  const paths = portalPaths(portal);
  const ready = network.borrowers.portalReady;
  const pending = network.borrowers.pendingLink;
  const total = ready + pending || network.borrowers.total;
  const slices = [
    { label: "Portal ready", count: ready, color: TEAL },
    { label: "Pending link", count: pending, color: AMBER },
  ].filter((slice) => slice.count > 0);
  const series = slices.length
    ? slices.map((slice) => slice.count)
    : [0];
  const labels = slices.length
    ? slices.map((slice) => slice.label)
    : ["No borrowers"];
  const colors = slices.length ? slices.map((slice) => slice.color) : [SLATE];

  const options: ApexOptions = {
    chart: {
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    labels,
    colors,
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
              fontSize: "26px",
              fontWeight: 600,
              color: "#1f2328",
              offsetY: 8,
            },
            total: {
              show: true,
              showAlways: true,
              label: "",
              fontSize: "26px",
              fontWeight: 600,
              color: "#1f2328",
              formatter: () => String(total),
            },
          },
        },
      },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(Number(value))} borrowers` },
    },
  };

  return (
    <DashboardWidget
      title="Borrower portals"
      subtitle="Client access readiness"
      minHeight="340px"
      right={
        <Link
          to={paths.borrowers}
          className="text-[12px] font-semibold text-brand-500 hover:underline"
        >
          View
        </Link>
      }
    >
      <div className="flex min-h-0 flex-1 items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <Chart options={options} series={series} type="donut" height={220} />
        </div>
        <ul className="w-[128px] shrink-0 space-y-2">
          {(slices.length ? slices : [{ label: "None", count: 0, color: SLATE }]).map(
            (slice) => (
              <li
                key={slice.label}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-800"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate text-[12px] font-medium text-slate-600 dark:text-slate-300">
                    {slice.label}
                  </span>
                </span>
                <span className="text-[12px] font-bold text-slate-800 dark:text-white">
                  {slice.count}
                </span>
              </li>
            ),
          )}
          <li className="rounded-xl border border-border px-2.5 py-2 text-[11px] text-text-secondary dark:border-slate-700">
            {network.borrowers.clients} unique clients
          </li>
        </ul>
      </div>
    </DashboardWidget>
  );
}

function ContactTypesChart({
  network,
  portal,
}: {
  network: BrokerNetworkStats;
  portal: Portal;
}) {
  const paths = portalPaths(portal);
  const rows = [...(network.contacts.byType || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const hasData = rows.some((row) => row.count > 0);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
    },
    colors: [BRAND],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "48%",
        distributed: false,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: "#EEF2F6",
      strokeDashArray: 3,
      padding: { left: 4, right: 4 },
    },
    xaxis: {
      categories: rows.map((row) => formatContactType(row.type)),
      labels: {
        rotate: -25,
        style: { colors: "#64748b", fontSize: "10px" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      tickAmount: 4,
      labels: {
        style: { colors: "#94a3b8", fontSize: "11px" },
        formatter: (value) => String(Math.round(Number(value))),
      },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(Number(value))} contacts` },
    },
  };

  return (
    <DashboardWidget
      title="Contacts by type"
      subtitle={`${formatCompactCount(network.contacts.total)} in CRM`}
      minHeight="340px"
      right={
        <Link
          to={paths.contacts}
          className="text-[12px] font-semibold text-brand-500 hover:underline"
        >
          CRM
        </Link>
      }
    >
      {hasData ? (
        <Chart
          options={options}
          series={[{ name: "Contacts", data: rows.map((row) => row.count) }]}
          type="bar"
          height={250}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-secondary dark:border-slate-700">
          No contacts yet
        </div>
      )}
    </DashboardWidget>
  );
}

function TopOfficersChart({
  network,
  portal,
}: {
  network: BrokerNetworkStats;
  portal: Portal;
}) {
  const paths = portalPaths(portal);
  const rows = [...(network.topOfficers || [])].filter(
    (row) => row.applications > 0,
  );
  const max = Math.max(...rows.map((row) => row.applications), 1);

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
    colors: [VIOLET, BRAND, TEAL, AMBER, ROSE, SLATE].slice(0, Math.max(rows.length, 1)),
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
      padding: { left: 4, right: 12, top: -8, bottom: -8 },
    },
    xaxis: {
      categories: rows.map((row) => row.name),
      min: 0,
      max: Math.max(1, Math.ceil(max * 1.15)),
      labels: {
        style: { colors: "#9aa0a6", fontSize: "11px" },
        formatter: (value) => String(Math.round(Number(value))),
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#6b7280", fontSize: "11px" },
        maxWidth: 120,
      },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => `${Math.round(Number(value))} applications` },
    },
  };

  return (
    <DashboardWidget
      title="Officer pipeline load"
      subtitle="Applications assigned per loan officer"
      minHeight="340px"
      right={
        <Link
          to={paths.officers}
          className="text-[12px] font-semibold text-brand-500 hover:underline"
        >
          Officers
        </Link>
      }
    >
      {rows.length ? (
        <Chart
          options={options}
          series={[
            {
              name: "Applications",
              data: rows.map((row) => row.applications),
            },
          ]}
          type="bar"
          height={250}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-secondary dark:border-slate-700">
          No officer assignments yet
        </div>
      )}
    </DashboardWidget>
  );
}

function LenderCoverageCard({
  network,
  uniqueLendersAccessed,
  portal,
}: {
  network: BrokerNetworkStats;
  uniqueLendersAccessed: number;
  portal: Portal;
}) {
  const paths = portalPaths(portal);
  const connected = network.lenders.connected;
  const coverage =
    connected > 0
      ? Math.min(100, Math.round((uniqueLendersAccessed / connected) * 100))
      : 0;

  return (
    <DashboardWidget
      title="Lender coverage"
      subtitle="Connected marketplace reach"
      minHeight="340px"
      right={
        <Link
          to={paths.lenders}
          className="text-[12px] font-semibold text-brand-500 hover:underline"
        >
          Marketplace
        </Link>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-teal-50/70 p-3 dark:border-slate-700 dark:bg-teal-950/20">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
              Connected
            </p>
            <p className="mt-1 text-2xl font-bold text-teal-800 dark:text-teal-300">
              {formatCompactCount(connected)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              Used this period
            </p>
            <p className="mt-1 text-2xl font-bold text-text-primary dark:text-white">
              {formatCompactCount(uniqueLendersAccessed)}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span className="font-medium text-text-secondary">
              Period utilization
            </span>
            <span className="font-bold text-text-primary dark:text-white">
              {coverage}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${coverage}%` }}
            />
          </div>
          <p className="mt-3 text-[12px] leading-5 text-text-secondary">
            {network.lenders.inactive > 0
              ? `${network.lenders.inactive} inactive lender link${network.lenders.inactive === 1 ? "" : "s"} on file.`
              : "All connected lender links are active."}
          </p>
        </div>
      </div>
    </DashboardWidget>
  );
}

export default function NetworkAnalyticsCharts({
  stats,
  loading,
  portal = "broker",
  showMetricStrip = true,
}: Props) {
  const network = stats?.network || emptyNetwork();
  const stripCount = portal === "loanOfficer" ? 4 : 5;

  if (loading) {
    return (
      <div className="space-y-4">
        {showMetricStrip ? (
          <div
            className={
              portal === "loanOfficer"
                ? "grid grid-cols-2 gap-3 md:grid-cols-4"
                : "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
            }
          >
            {Array.from({ length: stripCount }).map((_, index) => (
              <div
                key={index}
                className="h-[118px] animate-pulse rounded-2xl border border-border bg-white dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-12 gap-4">
          {Array.from({ length: portal === "loanOfficer" ? 3 : 4 }).map(
            (_, index) => (
              <div
                key={index}
                className="col-span-12 h-[340px] animate-pulse rounded-2xl border border-border bg-white md:col-span-6 xl:col-span-4 dark:border-slate-800 dark:bg-slate-900"
              />
            ),
          )}
        </div>
      </div>
    );
  }

  if (portal === "loanOfficer") {
    return (
      <div className="space-y-4">
        {showMetricStrip ? (
          <MetricStrip network={network} portal={portal} />
        ) : null}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-4">
            <NetworkMixChart network={network} portal={portal} />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <TeamHealthChart network={network} portal={portal} />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <BorrowerPortalChart network={network} portal={portal} />
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <ContactTypesChart network={network} portal={portal} />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <LenderCoverageCard
              network={network}
              uniqueLendersAccessed={Number(stats?.uniqueLendersAccessed || 0)}
              portal={portal}
            />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <DashboardWidget
              title="New applications"
              subtitle="Assigned files opened this period"
              minHeight="340px"
              right={
                <Link
                  to="/loan-officer/loan-application"
                  className="text-[12px] font-semibold text-brand-500 hover:underline"
                >
                  New app
                </Link>
              }
            >
              <div className="flex flex-1 flex-col justify-center gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    Applications
                  </p>
                  <p className="mt-2 text-[36px] font-bold leading-none tracking-tight text-text-primary dark:text-white">
                    {formatCompactCount(Number(stats?.totalApplications || 0))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-sky-50/70 p-3 dark:border-slate-700 dark:bg-sky-950/20">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                      Submitted
                    </p>
                    <p className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-300">
                      {formatCompactCount(Number(stats?.totalSubmitted || 0))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-3 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                      Incomplete
                    </p>
                    <p className="mt-1 text-xl font-bold text-text-primary dark:text-white">
                      {formatCompactCount(Number(stats?.totalIncomplete || 0))}
                    </p>
                  </div>
                </div>
              </div>
            </DashboardWidget>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MetricStrip network={network} portal={portal} />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-5">
          <NetworkMixChart network={network} portal={portal} />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <TeamHealthChart network={network} portal={portal} />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <BorrowerPortalChart network={network} portal={portal} />
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <TopOfficersChart network={network} portal={portal} />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <ContactTypesChart network={network} portal={portal} />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <LenderCoverageCard
            network={network}
            uniqueLendersAccessed={Number(stats?.uniqueLendersAccessed || 0)}
            portal={portal}
          />
        </div>
      </div>
    </div>
  );
}
