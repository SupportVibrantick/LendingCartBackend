import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Building2,
  Contact,
  Eye,
  FilePlus,
  Plus,
  RefreshCw,
  SearchX,
  Store,
  TrendingUp,
  Users,
  UserRound,
  Wallet,
} from "lucide-react";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import StatusDistributionChart from "../../components/ecommerce/StatusDistributionChart";
import ProductVolumeChart from "../../components/ecommerce/ProductVolumeChart";
import ApplicationStatusChart from "../../components/ecommerce/ApplicationStatusChart";
import PipelineValueChart from "../../components/ecommerce/PipelineValueChart";
import ConversionFunnelChart from "../../components/ecommerce/ConversionFunnelChart";
import ConversionRatesChart from "../../components/ecommerce/ConversionRatesChart";
import CommissionSummaryChart from "../../components/commissions/CommissionSummaryChart";
import PageMeta from "../../components/common/PageMeta";
import { formatUsDate } from "../../lib/usDateFormat";
import { isSessionExpiredError } from "../../lib/sessionExpiry";
import {
  formatCommissionCurrency,
  type CommissionSummary,
} from "../../lib/commissionApi";
import {
  type BrokerStats,
  type DashboardPeriod,
} from "../../lib/brokerDashboardStats";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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
  lenderCount: number;
};

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string; short: string }[] =
  [
    { value: "7d", label: "Last 7 days", short: "7D" },
    { value: "30d", label: "Last 30 days", short: "30D" },
    { value: "90d", label: "Last 90 days", short: "90D" },
    { value: "12m", label: "Last 12 months", short: "12M" },
  ];

const STATUS_TO_PIPELINE: Record<string, string> = {
  DRAFT: "DRAFT",
  INCOMPLETE: "INCOMPLETE",
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
  totalIncomplete: "INCOMPLETE",
  totalInReview: "IN_REVIEW",
  totalApproved: "APPROVED",
  totalDeclined: "DECLINED",
  totalFunded: "FUNDED",
  totalVolumeFunded: "FUNDED",
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function getBrokerFirstName() {
  try {
    const storedName = sessionStorage.getItem("broker_user_name");
    if (storedName?.trim()) return storedName.trim().split(/\s+/)[0];

    const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
    const first =
      user.firstName ||
      user.name?.split(/\s+/)[0] ||
      user.email?.split("@")[0] ||
      "there";
    return String(first);
  } catch {
    return "there";
  }
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function isBrokerAdmin() {
  try {
    const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
    return Array.isArray(roles) && roles.includes("BROKER_ADMIN");
  } catch {
    return false;
  }
}

function statusLabel(status: string) {
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  if (status === "DECLINED" || status === "LENDER_DECLINED") return "Declined";
  if (status === "APPROVED" || status === "LENDER_APPROVED") return "Approved";
  if (status === "LENDER_SELECTED") return "Lender Selected";
  return status.replace(/_/g, " ");
}

function statusBadgeClass(status?: string) {
  const s = status?.toLowerCase();

  switch (s) {
    case "new":
      return "bg-[#13538A] text-white";
    case "pending":
      return "bg-amber-500 text-white";
    case "client_pending":
      return "bg-rose-500 text-white";
    case "submitted":
      return "bg-[#1a6aad] text-white";
    case "sent":
    case "lender_selected":
      return "bg-[#13538A] text-white";
    case "updated":
      return "bg-[#0e3d66] text-white";
    case "approved":
    case "auto_approved":
      return "bg-emerald-600 text-white";
    case "lender_approved":
      return "bg-green-600 text-white";
    case "declined":
    case "rejected":
    case "auto_declined":
    case "withdrawn":
      return "bg-red-600 text-white";
    case "lender_declined":
      return "bg-rose-700 text-white";
    case "in_review":
      return "bg-[#13538A] text-white";
    case "draft":
      return "bg-slate-500 text-white";
    case "incomplete":
    case "superseded":
    case "suspended":
      return "bg-orange-500 text-white";
    case "completed":
      return "bg-teal-600 text-white";
    case "funded":
      return "bg-emerald-700 text-white";
    default:
      return "bg-slate-600 text-white";
  }
}

function getInitials(name?: string) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatProductLabel(code?: string) {
  if (!code) return "—";
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Matches Submit Applications table: $2M not $2.00M */
function formatRecentAmount(value: number) {
  if (!value || !Number.isFinite(value)) return "$0";
  const num = Number(value);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function pipelineHref(status?: string) {
  if (!status) return "/submit-applications";
  return `/submit-applications?status=${encodeURIComponent(status)}`;
}

const quickActions = [
  {
    label: "New App",
    path: "/loan-application",
    icon: FilePlus,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    label: "Pipeline",
    path: "/submit-applications",
    icon: TrendingUp,
    tone: "bg-indigo-50 text-indigo-600",
  },
  {
    label: "Lenders",
    path: "/lender-marketplace",
    icon: Store,
    tone: "bg-teal-50 text-teal-700",
  },
  {
    label: "Officers",
    path: "/loan-officers",
    icon: Users,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    label: "Co-Brokers",
    path: "/sub-brokers",
    icon: Building2,
    tone: "bg-amber-50 text-amber-600",
  },
  {
    label: "Borrowers",
    path: "/borrowers",
    icon: UserRound,
    tone: "bg-rose-50 text-rose-600",
  },
  {
    label: "Contacts",
    path: "/contacts-list",
    icon: Contact,
    tone: "bg-cyan-50 text-cyan-700",
  },
  {
    label: "Commissions",
    path: "/commissions",
    icon: Wallet,
    tone: "bg-emerald-50 text-emerald-600",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [commissionSummary, setCommissionSummary] =
    useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("12m");
  const [commissionLoading, setCommissionLoading] = useState(false);
  const showCommissions = useMemo(() => isBrokerAdmin(), []);
  const firstName = useMemo(() => getBrokerFirstName(), []);
  const greeting = useMemo(() => getGreeting(), []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeaders();

      const requests: Promise<Response>[] = [
        fetch(`${API_BASE}/broker/stats?period=${period}`, { headers }),
        fetch(`${API_BASE}/broker/loan-pipeline/submissions?limit=8`, {
          headers,
        }),
      ];

      if (showCommissions) {
        setCommissionLoading(true);
        requests.push(
          fetch(`${API_BASE}/broker/commissions/summary?months=6`, { headers }),
        );
      }

      const [statsRes, listRes, commissionRes] = await Promise.all(requests);
      const statsJson = await statsRes.json();
      const listJson = await listRes.json();

      if (listRes.ok && Array.isArray(listJson.data)) {
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
              borrower: String(item.borrower || "Applicant"),
              amount: Number(item.amount || 0),
              status: String(item.status || ""),
              submittedOn: String(item.submittedOn || ""),
              loanInfo: item.loanInfo ? String(item.loanInfo) : undefined,
              lenderName: primaryLender?.lenderName
                ? String(primaryLender.lenderName)
                : undefined,
              lenderCount: lenders.length,
            };
          }),
        );
      } else {
        setRecent([]);
      }

      if (showCommissions && commissionRes) {
        const commissionJson = await commissionRes.json();
        if (commissionRes.ok && commissionJson.success) {
          setCommissionSummary(commissionJson.data);
        } else {
          setCommissionSummary(null);
        }
      }

      if (statsRes.ok && statsJson.success) {
        setStats(statsJson.data);
      } else {
        setStats(null);
        throw new Error(statsJson.message || "Failed to load dashboard stats");
      }
    } catch (err) {
      if (isSessionExpiredError(err)) return;
      console.error("Dashboard load error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setCommissionLoading(false);
    }
  }, [period, showCommissions]);

  useEffect(() => {
    load();
  }, [load]);

  const openPipeline = (status?: string) => {
    navigate(pipelineHref(status));
  };

  const actions = showCommissions
    ? quickActions
    : quickActions.filter((action) => action.path !== "/commissions");

  return (
    <>
      <PageMeta
        title="Broker Dashboard | Loan Automation"
        description="Broker analytics dashboard"
      />

      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-3xl border border-[#13538A]/10 bg-white shadow-[0_18px_40px_rgba(19,83,138,0.08)] dark:border-[#13538A]/30 dark:bg-gray-900">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_-10%_-30%,rgba(19,83,138,0.16),transparent_55%),radial-gradient(700px_circle_at_110%_120%,rgba(14,165,233,0.14),transparent_50%)]" />
          <div className="relative px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-[#13538A]">
                  {greeting}, {firstName}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Pipeline overview
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Live application analytics for{" "}
                  {PERIOD_OPTIONS.find((option) => option.value === period)?.label?.toLowerCase()}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-gray-800 dark:ring-gray-700">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPeriod(option.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        period === option.value
                          ? "bg-[#13538A] text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:text-gray-300"
                      }`}
                    >
                      {option.short}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  title="Refresh"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </button>
                <Link
                  to="/loan-application"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#13538A] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(19,83,138,0.28)] transition hover:bg-[#0e3d66]"
                >
                  <Plus className="h-4 w-4" />
                  New application
                </Link>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Link
                  key={action.path}
                  to={action.path}
                  className="group inline-flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/70 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#13538A]/20 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/80"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${action.tone}`}
                  >
                    <action.icon className="h-4 w-4" />
                  </span>
                  <span className="whitespace-nowrap text-[13px] font-semibold text-slate-700 dark:text-gray-200">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {error && !loading ? (
          <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
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

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4">
            <ApplicationStatusChart
              stats={stats}
              loading={loading}
              onSliceClick={(key) =>
                openPipeline(
                  key === "OPEN"
                    ? undefined
                    : key === "FUNDED"
                      ? "FUNDED"
                      : "DECLINED",
                )
              }
            />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <PipelineValueChart stats={stats} loading={loading} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <ConversionRatesChart stats={stats} loading={loading} />
          </div>

          <div className="col-span-12 xl:col-span-7">
            <ConversionFunnelChart
              stats={stats}
              loading={loading}
              onStageClick={(statusKey) =>
                openPipeline(STATUS_TO_PIPELINE[statusKey])
              }
            />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <StatusDistributionChart
              stats={stats}
              loading={loading}
              onStatusClick={(statusKey) =>
                openPipeline(STATUS_TO_PIPELINE[statusKey])
              }
            />
          </div>

          <div className="col-span-12 xl:col-span-8">
            <StatisticsChart stats={stats} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <ProductVolumeChart stats={stats} loading={loading} />
          </div>

          {showCommissions ? (
            <>
              <div className="col-span-12 md:col-span-4 xl:col-span-3">
                <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#13538A] to-[#38BDF8]" />
                        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                          Commission snapshot
                        </h3>
                      </div>
                      <p className="pl-3 text-[12px] text-slate-400">This period</p>
                    </div>
                    <span className="rounded-md bg-amber-50 p-2 text-amber-600">
                      <Wallet className="h-4 w-4" />
                    </span>
                  </div>

                  {commissionLoading ? (
                    <div className="mt-5 animate-pulse space-y-3">
                      <div className="h-8 w-28 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-16 rounded bg-gray-100 dark:bg-gray-800" />
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-1 flex-col">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Pending
                      </p>
                      <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
                        {formatCommissionCurrency(
                          commissionSummary?.totals.pending || 0,
                        )}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                          <p className="text-[10px] font-semibold uppercase text-emerald-700">
                            Paid
                          </p>
                          <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                            {formatCommissionCurrency(
                              commissionSummary?.totals.paid || 0,
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 dark:bg-gray-800">
                          <p className="text-[10px] font-semibold uppercase text-gray-500">
                            Total
                          </p>
                          <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                            {formatCommissionCurrency(
                              commissionSummary?.totals.all || 0,
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-gray-100 py-2 dark:border-gray-800">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {commissionSummary?.counts?.pending ?? 0}
                          </p>
                          <p className="text-gray-500">Open</p>
                        </div>
                        <div className="rounded-lg border border-gray-100 py-2 dark:border-gray-800">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {commissionSummary?.counts?.paid ?? 0}
                          </p>
                          <p className="text-gray-500">Paid</p>
                        </div>
                        <div className="rounded-lg border border-gray-100 py-2 dark:border-gray-800">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {commissionSummary?.counts?.total ?? 0}
                          </p>
                          <p className="text-gray-500">Deals</p>
                        </div>
                      </div>
                      <Link
                        to="/commissions"
                        className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-[#13538A] hover:underline"
                      >
                        View commissions
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-12 md:col-span-8 xl:col-span-9">
                <CommissionSummaryChart
                  summary={commissionSummary}
                  loading={commissionLoading}
                  title="Commission over time"
                />
              </div>
            </>
          ) : null}

          <div className="col-span-12">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-gray-800 lg:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                      Recent Applications
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-[#f3f5f7] px-2 py-0.5 text-[11px] font-medium text-[#6b7280] dark:bg-gray-800 dark:text-gray-300">
                      {loading ? "…" : recent.length}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#9aa0a6]">
                    {loading
                      ? "Loading pipeline…"
                      : "Latest files in your broker pipeline"}
                  </p>
                </div>
                <Link
                  to="/submit-applications"
                  className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#13538A] hover:underline"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="divide-y divide-[#eef2f6] dark:divide-gray-800">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 lg:px-6">
                      <div className="h-8 animate-pulse rounded-lg bg-[#f3f5f7] dark:bg-gray-800" />
                    </div>
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A] dark:bg-[#13538A]/20">
                    <SearchX className="h-6 w-6" />
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    No applications yet
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Start a new loan file to see it here.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/loan-application")}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e3d66]"
                  >
                    Create application
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="min-w-0 overflow-hidden">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-[1] bg-[#f8fafc] text-[#6b7280] dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        {[
                          "Borrower",
                          "Loan Type",
                          "Amount",
                          "Lender",
                          "Status",
                          "Submitted",
                          "Actions",
                        ].map((label) => (
                          <th
                            key={label}
                            className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider first:pl-5 last:pr-5 lg:first:pl-6 lg:last:pr-6 ${
                              label === "Amount" || label === "Actions"
                                ? "text-right"
                                : "text-left"
                            }`}
                          >
                            <span className="block truncate">{label}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef2f6] dark:divide-gray-800">
                      {recent.map((row) => (
                        <tr
                          key={row.submissionId}
                          className="group cursor-pointer transition hover:bg-[#f8fafc] dark:hover:bg-gray-800/60"
                          onClick={() =>
                            navigate("/loan-preview", {
                              state: { submissionId: row.submissionId },
                            })
                          }
                        >
                          <td
                            className="px-3 py-3.5 align-middle first:pl-5 lg:first:pl-6"
                            title={`${row.borrower} · ${row.applicationNumber || ""}`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#13538A] text-[11px] font-semibold text-white shadow-sm">
                                {getInitials(row.borrower)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                  {row.borrower || "Untitled"}
                                </p>
                                <span className="mt-0.5 inline-flex max-w-full truncate rounded-md bg-[#13538A]/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#9fd0f0]">
                                  {row.applicationNumber || "—"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td
                            className="px-3 py-3.5 align-middle"
                            title={formatProductLabel(row.loanInfo)}
                          >
                            <span className="inline-flex max-w-full truncate rounded-full bg-[#13538A]/10 px-2 py-0.5 text-xs font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#9fd0f0]">
                              {formatProductLabel(row.loanInfo)}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 align-middle text-right">
                            <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                              {formatRecentAmount(row.amount)}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 align-middle">
                            {row.lenderCount > 0 && row.lenderName ? (
                              <div
                                className="flex min-w-0 items-center gap-1.5"
                                title={row.lenderName}
                              >
                                <span className="inline-flex max-w-full truncate rounded-full bg-[#13538A]/10 px-2 py-0.5 text-xs font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#9fd0f0]">
                                  {row.lenderName}
                                </span>
                                {row.lenderCount > 1 ? (
                                  <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#13538A] px-1.5 text-[10px] font-semibold text-white">
                                    +{row.lenderCount - 1}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#13538A]/25 px-2 py-0.5 text-[11px] text-[#13538A]/55">
                                <Building2 className="h-3 w-3" />
                                Not sent
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 align-middle">
                            <span
                              className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 align-middle text-sm text-slate-500 dark:text-slate-400">
                            {row.submittedOn
                              ? formatUsDate(row.submittedOn)
                              : "—"}
                          </td>
                          <td
                            className="px-2 py-3.5 pr-5 text-right align-middle lg:pr-6"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              title="View application"
                              onClick={() =>
                                navigate("/loan-preview", {
                                  state: { submissionId: row.submissionId },
                                })
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#13538A] text-white shadow-sm transition hover:bg-[#0e3d66]"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
