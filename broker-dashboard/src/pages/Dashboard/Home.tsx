import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Building2,
  Contact,
  Eye,
  FilePlus,
  FileText,
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
import ApplicationPipeline from "../../components/ecommerce/ApplicationPipeline";
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
  { label: "New App", path: "/loan-application", icon: FilePlus },
  { label: "Pipeline", path: "/submit-applications", icon: TrendingUp },
  { label: "Lenders", path: "/lender-marketplace", icon: Store },
  { label: "Officers", path: "/loan-officers", icon: Users },
  { label: "Co-Brokers", path: "/sub-brokers", icon: Building2 },
  { label: "Borrowers", path: "/borrowers", icon: UserRound },
  { label: "Contacts", path: "/contacts-list", icon: Contact },
  { label: "Commissions", path: "/commissions", icon: Wallet },
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

      <div className="space-y-4">
        {/* Header */}
        <section className="overflow-hidden rounded-xl border border-[#13538A]/20 bg-gradient-to-r from-[#13538A] via-[#1a6aad] to-[#2C92D5] px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Broker Dashboard
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
                {greeting}, {firstName}
              </h1>
              <p className="mt-0.5 text-sm text-white/80">
                Live pipeline analytics ·{" "}
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
            {actions.map((action) => (
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

        {/* KPIs */}
        <EcommerceMetrics
          stats={stats}
          loading={loading}
          onStatClick={(key) => openPipeline(METRIC_TO_PIPELINE[key])}
        />

        {/* Pipeline strip */}
        <ApplicationPipeline
          stats={stats}
          loading={loading}
          onStageClick={(statusKey) =>
            openPipeline(STATUS_TO_PIPELINE[statusKey])
          }
        />

        {/* Charts grid */}
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

          {showCommissions ? (
            <>
              <div className="col-span-12 md:col-span-4 xl:col-span-3">
                <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
                        Earnings
                      </p>
                      <h3 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
                        Commission snapshot
                      </h3>
                    </div>
                    <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
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

          {/* Recent applications */}
          <div className="col-span-12">
            <section className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-white shadow-sm dark:border-[#13538A]/30 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3 border-b border-[#13538A]/10 bg-[#13538A]/[0.04] px-5 py-3.5 dark:border-[#13538A]/20 dark:bg-[#13538A]/10 lg:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A] text-white shadow-sm">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-[#13538A] dark:text-[#9fd0f0]">
                        Recent Applications
                      </h2>
                      <span className="inline-flex items-center rounded-full bg-[#13538A] px-2.5 py-1 text-[11px] font-semibold text-white">
                        {loading ? "…" : recent.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#13538A]/70 dark:text-[#9fd0f0]/80">
                      {loading
                        ? "Loading pipeline…"
                        : "Latest files in your broker pipeline"}
                    </p>
                  </div>
                </div>
                <Link
                  to="/submit-applications"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#13538A] hover:underline dark:text-[#9fd0f0]"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="divide-y divide-[#13538A]/10 dark:divide-[#13538A]/20">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 lg:px-6">
                      <div className="h-8 animate-pulse rounded-lg bg-[#13538A]/10 dark:bg-[#13538A]/20" />
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
                    <thead className="sticky top-0 z-[1] bg-[#13538A] text-white">
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
                            className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wider first:pl-5 last:pr-5 lg:first:pl-6 lg:last:pr-6 ${
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
                    <tbody className="divide-y divide-[#13538A]/10 dark:divide-[#13538A]/20">
                      {recent.map((row) => (
                        <tr
                          key={row.submissionId}
                          className="group cursor-pointer border-l-2 border-transparent transition hover:border-l-[#13538A] hover:bg-[#13538A]/[0.045] dark:hover:bg-[#13538A]/15"
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
