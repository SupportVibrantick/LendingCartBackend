import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  BriefcaseBusiness,
  Contact,
  DollarSign,
  FilePlus,
  FileText,
  RefreshCw,
  TrendingUp,
  UserPen,
  UserRound,
} from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import StaffCommissionOverview from "../../../components/commissions/StaffCommissionOverview";
import EcommerceMetrics from "../../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../../components/ecommerce/StatisticsChart";
import StatusDistributionChart from "../../../components/ecommerce/StatusDistributionChart";
import ProductVolumeChart from "../../../components/ecommerce/ProductVolumeChart";
import ApplicationPipeline from "../../../components/ecommerce/ApplicationPipeline";
import ConversionFunnelChart from "../../../components/ecommerce/ConversionFunnelChart";
import ConversionRatesChart from "../../../components/ecommerce/ConversionRatesChart";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_USER_KEY,
  checkCoBrokerResponse,
  getCoBrokerAuthHeaders,
} from "../../../lib/coBrokerPortal";
import { isSessionExpiredError } from "../../../lib/sessionExpiry";
import {
  formatCompactCurrency,
  type BrokerStats,
  type DashboardPeriod,
} from "../../../lib/brokerDashboardStats";

type RecentApp = {
  submissionId: string;
  applicationId: string;
  applicationNumber?: string;
  borrower: string;
  amount: number;
  status: string;
  submittedOn: string;
  loanInfo?: string;
  lenderName?: string;
};

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
];

const STATUS_TO_PIPELINE: Record<string, string> = {
  DRAFT: "DRAFT",
  CLIENT_PENDING: "CLIENT_PENDING",
  SUBMITTED: "SUBMITTED",
  IN_REVIEW: "IN_REVIEW",
  LENDER_SELECTED: "IN_REVIEW",
  LENDER_APPROVED: "APPROVED",
  LENDER_DECLINED: "DECLINED",
  FUNDED: "FUNDED",
  WITHDRAWN: "WITHDRAWN",
  SUSPENDED: "SUSPENDED",
};

const METRIC_TO_PIPELINE: Record<string, string | undefined> = {
  totalApplications: undefined,
  totalSubmitted: "SUBMITTED",
  totalInReview: "IN_REVIEW",
  totalApproved: "APPROVED",
  totalDeclined: "DECLINED",
  totalFunded: "FUNDED",
  totalVolumeFunded: "FUNDED",
};

function getCoBrokerFirstName() {
  try {
    const user = JSON.parse(sessionStorage.getItem(CO_BROKER_USER_KEY) || "{}");
    const first =
      user.firstName ||
      user.name?.split(/\s+/)[0] ||
      user.email?.split("@")[0] ||
      "Partner";
    return String(first);
  } catch {
    return "Partner";
  }
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function statusLabel(status: string) {
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  if (status === "DECLINED" || status === "LENDER_DECLINED") return "Declined";
  if (status === "APPROVED" || status === "LENDER_APPROVED") return "Approved";
  if (status === "LENDER_SELECTED") return "Lender Selected";
  return status.replace(/_/g, " ");
}

function statusBadgeClass(status: string) {
  const key = status.toUpperCase();
  if (key === "FUNDED") return "bg-teal-50 text-teal-700 ring-teal-100";
  if (key === "APPROVED" || key === "LENDER_APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
  if (key === "DECLINED" || key === "LENDER_DECLINED") {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }
  if (key === "IN_REVIEW" || key === "LENDER_SELECTED") {
    return "bg-indigo-50 text-indigo-700 ring-indigo-100";
  }
  if (key === "SUBMITTED") return "bg-sky-50 text-sky-700 ring-sky-100";
  if (key === "CLIENT_PENDING") {
    return "bg-orange-50 text-orange-700 ring-orange-100";
  }
  if (key === "DRAFT") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-[#13538A]/10 text-[#13538A] ring-[#13538A]/10";
}

function productLabel(code?: string) {
  if (!code) return "—";
  return code.replace(/_/g, " ");
}

function pipelineHref(status?: string) {
  if (!status) return "/sub-broker/loan-pipeline";
  return `/sub-broker/loan-pipeline?status=${encodeURIComponent(status)}`;
}

const QUICK_ACTIONS = [
  {
    label: "New App",
    path: "/sub-broker/loan-application",
    icon: FilePlus,
  },
  {
    label: "Pipeline",
    path: "/sub-broker/loan-pipeline",
    icon: TrendingUp,
  },
  {
    label: "Commissions",
    path: "/sub-broker/commissions",
    icon: DollarSign,
  },
  {
    label: "Invoices",
    path: "/sub-broker/invoices",
    icon: FileText,
  },
  {
    label: "Borrowers",
    path: "/sub-broker/borrowers",
    icon: UserRound,
  },
  {
    label: "Contacts",
    path: "/sub-broker/contacts",
    icon: Contact,
  },
  {
    label: "Profile",
    path: "/sub-broker/profile",
    icon: UserPen,
  },
];

export default function CoBrokerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [period, setPeriod] = useState<DashboardPeriod>("12m");

  const firstName = useMemo(() => getCoBrokerFirstName(), []);
  const greeting = useMemo(() => getGreeting(), []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getCoBrokerAuthHeaders();

      const [statsRes, listRes] = await Promise.all([
        fetch(
          `${CO_BROKER_API_BASE}/subbroker/loan-pipeline/pipeline-stats?period=${period}`,
          { headers },
        ),
        fetch(`${CO_BROKER_API_BASE}/subbroker/loan-pipeline?limit=8`, {
          headers,
        }),
      ]);

      const statsJson = await statsRes.json();
      const listJson = await listRes.json();

      checkCoBrokerResponse(statsRes, statsJson);
      checkCoBrokerResponse(listRes, listJson);

      if (listRes.ok && listJson.success && Array.isArray(listJson.data)) {
        setRecent(
          listJson.data.slice(0, 8).map((item: Record<string, unknown>) => {
            const lenders = Array.isArray(item.submittedToLenders)
              ? (item.submittedToLenders as Array<Record<string, unknown>>)
              : [];
            const primaryLender =
              lenders.find((lender) => lender.status === "APPROVED") ||
              lenders[0];

            return {
              submissionId: String(item.submissionId || ""),
              applicationId: String(item.applicationId || ""),
              applicationNumber: item.applicationNumber
                ? String(item.applicationNumber)
                : undefined,
              borrower: String(
                item.borrower || item.borrowerName || "Applicant",
              ),
              amount: Number(item.amount || 0),
              status: String(item.status || ""),
              submittedOn: String(item.submittedOn || item.createdAt || ""),
              loanInfo: item.loanInfo
                ? String(item.loanInfo)
                : item.loanProductCode
                  ? String(item.loanProductCode)
                  : undefined,
              lenderName: primaryLender?.lenderName
                ? String(primaryLender.lenderName)
                : undefined,
            };
          }),
        );
      } else {
        setRecent([]);
      }

      if (statsRes.ok && statsJson.success) {
        setStats(statsJson.data);
      } else {
        setStats(null);
        throw new Error(statsJson.message || "Failed to load dashboard stats");
      }
    } catch (err) {
      if (isSessionExpiredError(err)) return;
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const openPipeline = (status?: string) => {
    navigate(pipelineHref(status));
  };

  return (
    <>
      <PageMeta
        title="Dashboard | Co-Broker Portal"
        description="Co-broker pipeline and commission overview"
      />

      <div className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-[#13538A]/20 bg-gradient-to-r from-[#13538A] via-[#1a6aad] to-[#2C92D5] px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Co-Broker Dashboard
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
                {greeting}, {firstName}
              </h1>
              <p className="mt-0.5 text-sm text-white/80">
                Your assigned pipeline analytics ·{" "}
                {PERIOD_OPTIONS.find((p) => p.value === period)?.label} window
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5 backdrop-blur-sm">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                      period === option.value
                        ? "bg-white text-[#13538A] shadow-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        {error && !loading ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>Unable to load analytics. {error}</p>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 self-start rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          </div>
        ) : null}

        <EcommerceMetrics
          stats={stats}
          loading={loading}
          onStatClick={(key) => openPipeline(METRIC_TO_PIPELINE[key])}
        />

        <ApplicationPipeline
          stats={stats}
          loading={loading}
          onStageClick={(statusKey) =>
            openPipeline(STATUS_TO_PIPELINE[statusKey])
          }
        />

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-8">
            <StatisticsChart stats={stats} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <StatusDistributionChart
              stats={stats}
              loading={loading}
              onStatusClick={(statusKey) =>
                openPipeline(STATUS_TO_PIPELINE[statusKey])
              }
            />
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <ConversionFunnelChart
              stats={stats}
              loading={loading}
              onStageClick={(statusKey) =>
                openPipeline(STATUS_TO_PIPELINE[statusKey])
              }
            />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <ConversionRatesChart stats={stats} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <ProductVolumeChart stats={stats} loading={loading} />
          </div>
        </div>

        <StaffCommissionOverview
          apiBase={CO_BROKER_API_BASE}
          summaryPath="/subbroker/commissions/summary"
          listPath="/subbroker/commissions"
          getHeaders={() => getCoBrokerAuthHeaders()}
          portal="subbroker"
          title="My Commission Earnings"
          invoicesHref="/sub-broker/invoices"
          commissionsHref="/sub-broker/commissions"
        />

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Recent Applications
              </h2>
              <p className="text-xs text-gray-500">
                Latest files assigned to you
              </p>
            </div>
            <Link
              to="/sub-broker/loan-pipeline"
              className="text-xs font-semibold text-[#13538A] hover:underline"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse bg-gray-50 dark:bg-gray-800/50"
                />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <BriefcaseBusiness className="mx-auto mb-2 h-9 w-9 text-gray-300" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                No applications yet
              </p>
              <button
                type="button"
                onClick={() => navigate("/sub-broker/loan-application")}
                className="mt-2 text-sm font-semibold text-[#13538A] hover:underline"
              >
                Create your first application
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2.5 sm:px-5">Borrower</th>
                    <th className="px-4 py-2.5 sm:px-5">Loan Type</th>
                    <th className="px-4 py-2.5 sm:px-5">Amount</th>
                    <th className="px-4 py-2.5 sm:px-5">Lender</th>
                    <th className="px-4 py-2.5 sm:px-5">Status</th>
                    <th className="px-4 py-2.5 sm:px-5">Submitted</th>
                    <th className="px-4 py-2.5 sm:px-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recent.map((row) => (
                    <tr
                      key={row.submissionId}
                      className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      onClick={() =>
                        navigate("/sub-broker/loan-pipeline-preview", {
                          state: { submissionId: row.submissionId },
                        })
                      }
                    >
                      <td className="px-4 py-2.5 sm:px-5">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {row.borrower}
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.applicationNumber || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 capitalize text-gray-600 sm:px-5">
                        {productLabel(row.loanInfo).toLowerCase()}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-100 sm:px-5">
                        {formatCompactCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 sm:px-5">
                        {row.lenderName || "—"}
                      </td>
                      <td className="px-4 py-2.5 sm:px-5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 sm:px-5">
                        {row.submittedOn
                          ? new Date(row.submittedOn).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right sm:px-5">
                        <ArrowRight className="ml-auto h-4 w-4 text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
