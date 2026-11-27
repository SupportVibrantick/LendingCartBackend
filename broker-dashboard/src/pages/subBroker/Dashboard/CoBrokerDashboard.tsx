import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Building2,
  Contact,
  ExternalLink,
  FilePlus,
  FileText,
  Plus,
  RefreshCw,
  SearchX,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import EcommerceMetrics from "../../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../../components/ecommerce/StatisticsChart";
import StatusDistributionChart from "../../../components/ecommerce/StatusDistributionChart";
import ProductVolumeChart from "../../../components/ecommerce/ProductVolumeChart";
import ApplicationStatusChart from "../../../components/ecommerce/ApplicationStatusChart";
import PipelineValueChart from "../../../components/ecommerce/PipelineValueChart";
import ConversionFunnelChart from "../../../components/ecommerce/ConversionFunnelChart";
import ConversionRatesChart from "../../../components/ecommerce/ConversionRatesChart";
import CommissionSummaryChart from "../../../components/commissions/CommissionSummaryChart";
import CommissionStatusChart from "../../../components/commissions/CommissionStatusChart";
import PageMeta from "../../../components/common/PageMeta";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_USER_KEY,
  checkCoBrokerResponse,
  getCoBrokerAuthHeaders,
} from "../../../lib/coBrokerPortal";
import {
  hasPermission,
  ORG_ENTITLEMENTS_UPDATED_EVENT,
  type PermissionKey,
} from "../../../lib/brokerPermissions";
import { hydrateOrgEntitlements } from "../../../lib/brokerEntitlements";
import { isSessionExpiredError } from "../../../lib/sessionExpiry";
import { formatUsDate } from "../../../lib/usDateFormat";
import {
  formatCommissionCurrency,
  type CommissionSummary,
} from "../../../lib/commissionApi";
import {
  type BrokerStats,
  type DashboardPeriod,
} from "../../../lib/brokerDashboardStats";

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-text-primary dark:text-white">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-text-secondary">{description}</p>
      </div>
      {action}
    </div>
  );
}

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

const QUICK_ACTIONS: Array<{
  label: string;
  path: string;
  icon: typeof FilePlus;
  tone: string;
  permission?: PermissionKey;
  always?: boolean;
}> = [
  {
    label: "New App",
    path: "/sub-broker/loan-application",
    icon: FilePlus,
    tone: "bg-sky-50 text-sky-600",
    permission: "CREATE_APPLICATION",
  },
  {
    label: "Pipeline",
    path: "/sub-broker/loan-pipeline",
    icon: TrendingUp,
    tone: "bg-indigo-50 text-indigo-600",
    permission: "VIEW_APPLICATIONS",
  },
  {
    label: "Commissions",
    path: "/sub-broker/commissions",
    icon: Wallet,
    tone: "bg-emerald-50 text-emerald-600",
    permission: "VIEW_COMMISSIONS",
  },
  {
    label: "Invoices",
    path: "/sub-broker/invoices",
    icon: FileText,
    tone: "bg-violet-50 text-violet-600",
    permission: "VIEW_INVOICES",
  },
  {
    label: "Borrowers",
    path: "/sub-broker/borrowers",
    icon: UserRound,
    tone: "bg-rose-50 text-rose-600",
    permission: "VIEW_BORROWERS",
  },
  {
    label: "Contacts",
    path: "/sub-broker/contacts",
    icon: Contact,
    tone: "bg-cyan-50 text-cyan-700",
    permission: "VIEW_CONTACTS",
  },
];

function getCoBrokerFirstName() {
  try {
    const user = JSON.parse(sessionStorage.getItem(CO_BROKER_USER_KEY) || "{}");
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
    case "sent":
    case "selected":
    case "lender_selected":
    case "in_review":
    case "submitted":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "pending":
    case "conditional":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "client_pending":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "updated":
      return "bg-[#4C78F5]/10 text-[#3B66E0] ring-[#4C78F5]/25";
    case "approved":
    case "auto_approved":
    case "lender_approved":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "declined":
    case "rejected":
    case "auto_declined":
    case "withdrawn":
    case "lender_declined":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "draft":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "incomplete":
    case "superseded":
    case "suspended":
      return "bg-orange-100 text-orange-700 ring-orange-200";
    case "completed":
    case "funded":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function dealInitials(value?: string | null) {
  const name = (value || "").trim() || "A";
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
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

function formatRecentAmount(value: number) {
  if (!value || !Number.isFinite(value)) return "$0";
  const num = Number(value);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function pipelineHref(status?: string) {
  if (!status) return "/sub-broker/loan-pipeline";
  return `/sub-broker/loan-pipeline?status=${encodeURIComponent(status)}`;
}

export default function CoBrokerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [commissionSummary, setCommissionSummary] =
    useState<CommissionSummary | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("12m");
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [permTick, setPermTick] = useState(0);

  useEffect(() => {
    void hydrateOrgEntitlements();
    const refresh = () => setPermTick((n) => n + 1);
    window.addEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, refresh);
    };
  }, []);

  const canViewCommissions = hasPermission("VIEW_COMMISSIONS", "coBroker");
  const canCreateApp = hasPermission("CREATE_APPLICATION", "coBroker");
  const canViewPipeline = hasPermission("VIEW_APPLICATIONS", "coBroker");

  const firstName = useMemo(() => getCoBrokerFirstName(), []);
  const greeting = useMemo(() => getGreeting(), []);

  const actions = useMemo(
    () =>
      QUICK_ACTIONS.filter(
        (action) =>
          action.always ||
          (action.permission
            ? hasPermission(action.permission, "coBroker")
            : true),
      ),
    [permTick],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getCoBrokerAuthHeaders();

      const requests: Promise<Response>[] = [
        fetch(
          `${CO_BROKER_API_BASE}/subbroker/loan-pipeline/pipeline-stats?period=${period}`,
          { headers },
        ),
        fetch(`${CO_BROKER_API_BASE}/subbroker/loan-pipeline?limit=8`, {
          headers,
        }),
      ];

      if (canViewCommissions) {
        setCommissionLoading(true);
        requests.push(
          fetch(
            `${CO_BROKER_API_BASE}/subbroker/commissions/summary?months=6`,
            { headers },
          ),
        );
      }

      const [statsRes, listRes, commissionRes] = await Promise.all(requests);
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
              lenderCount: lenders.length,
            };
          }),
        );
      } else {
        setRecent([]);
      }

      if (canViewCommissions && commissionRes) {
        const commissionJson = await commissionRes.json().catch(() => null);
        if (commissionRes.ok && commissionJson?.success) {
          setCommissionSummary(commissionJson.data);
        } else {
          setCommissionSummary(null);
        }
      } else {
        setCommissionSummary(null);
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
      setCommissionLoading(false);
    }
  }, [canViewCommissions, period]);

  useEffect(() => {
    load();
  }, [load]);

  const openPipeline = (status?: string) => {
    if (!canViewPipeline) return;
    navigate(pipelineHref(status));
  };

  const openRecent = (row: RecentApp) => {
    navigate("/sub-broker/loan-pipeline-preview", {
      state: {
        submissionId: row.submissionId,
        applicationId: row.applicationId,
      },
    });
  };

  return (
    <>
      <PageMeta
        title="Dashboard | Co-Broker Portal"
        description="Co-broker pipeline and commission overview"
      />

      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-brand-500">
                {greeting}, {firstName}
              </p>
              <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-text-primary dark:text-white">
                Pipeline overview
              </h1>
              <p className="mt-1 text-[13px] text-text-secondary">
                Assigned application analytics for{" "}
                {PERIOD_OPTIONS.find(
                  (option) => option.value === period,
                )?.label?.toLowerCase()}
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border dark:bg-slate-800 dark:ring-slate-700">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      period === option.value
                        ? "bg-brand-500 text-white"
                        : "text-text-secondary hover:text-text-primary dark:text-slate-300"
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-text-secondary transition hover:bg-surface disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              {canCreateApp ? (
                <Link
                  to="/sub-broker/loan-application"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
                >
                  <Plus className="h-4 w-4" />
                  New application
                </Link>
              ) : null}
            </div>
          </div>

          {actions.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {actions.map((action) => (
                <Link
                  key={action.path}
                  to={action.path}
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:border-brand-200 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${action.tone}`}
                  >
                    <action.icon className="h-4 w-4" />
                  </span>
                  <span className="truncate text-[13px] font-semibold text-text-primary dark:text-slate-200">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
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

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Pipeline"
            title="Application performance"
            description="Volume, conversion, and status movement across your assigned pipeline."
            action={
              canViewPipeline ? (
                <Link
                  to="/sub-broker/loan-pipeline"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-500 hover:underline"
                >
                  Open pipeline
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : undefined
            }
          />

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
          </div>
        </section>

        {canViewCommissions ? (
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Commissions"
              title="Earnings and payouts"
              description="Track pending dollars, paid volume, and deal counts over the last six months."
              action={
                <Link
                  to="/sub-broker/commissions"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-500 hover:underline"
                >
                  View commissions
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4 xl:col-span-3">
                <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-semibold leading-tight text-text-primary dark:text-white">
                        Commission snapshot
                      </h3>
                      <p className="mt-1 text-[13px] text-text-secondary">
                        This period
                      </p>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Wallet className="h-4 w-4" />
                    </span>
                  </div>

                  {commissionLoading ? (
                    <div className="mt-5 flex flex-1 animate-pulse rounded-xl bg-surface dark:bg-slate-800" />
                  ) : (
                    <div className="mt-4 flex flex-1 flex-col">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                        Pending
                      </p>
                      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-text-primary dark:text-white">
                        {formatCommissionCurrency(
                          commissionSummary?.totals.pending || 0,
                        )}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border bg-emerald-50/70 p-3 dark:border-slate-700 dark:bg-emerald-950/30">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Paid
                          </p>
                          <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                            {formatCommissionCurrency(
                              commissionSummary?.totals.paid || 0,
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-surface p-3 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                            Total
                          </p>
                          <p className="mt-1 text-sm font-bold text-text-primary dark:text-white">
                            {formatCommissionCurrency(
                              commissionSummary?.totals.all || 0,
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl border border-border py-2 dark:border-slate-700">
                          <p className="font-bold text-text-primary dark:text-white">
                            {commissionSummary?.counts?.pending ?? 0}
                          </p>
                          <p className="text-text-secondary">Open</p>
                        </div>
                        <div className="rounded-xl border border-border py-2 dark:border-slate-700">
                          <p className="font-bold text-text-primary dark:text-white">
                            {commissionSummary?.counts?.paid ?? 0}
                          </p>
                          <p className="text-text-secondary">Paid</p>
                        </div>
                        <div className="rounded-xl border border-border py-2 dark:border-slate-700">
                          <p className="font-bold text-text-primary dark:text-white">
                            {commissionSummary?.counts?.total ?? 0}
                          </p>
                          <p className="text-text-secondary">Deals</p>
                        </div>
                      </div>
                      <Link
                        to="/sub-broker/commissions"
                        className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand-500 hover:underline"
                      >
                        View commissions
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-12 md:col-span-8 xl:col-span-5">
                <CommissionSummaryChart
                  summary={commissionSummary}
                  loading={commissionLoading}
                  title="Commission over time"
                />
              </div>
              <div className="col-span-12 xl:col-span-4">
                <CommissionStatusChart
                  summary={commissionSummary}
                  loading={commissionLoading}
                />
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Pipeline"
            title="Recent applications"
            description="Latest files assigned to you."
            action={
              canViewPipeline ? (
                <Link
                  to="/sub-broker/loan-pipeline"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-500 hover:underline"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : undefined
            }
          />
          <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
            {loading ? (
              <div className="overflow-x-auto">
                <table className="ds-table min-w-[900px] w-full">
                  <thead>
                    <tr>
                      {[
                        "Deal",
                        "Program",
                        "Amount",
                        "Lender",
                        "Stage",
                        "Received",
                        "Portal",
                      ].map((label) => (
                        <th
                          key={label}
                          className={
                            label === "Portal" ? "!text-right" : undefined
                          }
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((__, cell) => (
                          <td key={cell}>
                            <div className="h-4 animate-pulse rounded bg-surface" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : recent.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                  <SearchX className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  No applications yet
                </p>
                <p className="mt-1.5 text-xs text-text-secondary">
                  Start a new loan file to see it here.
                </p>
                {canCreateApp ? (
                  <button
                    type="button"
                    onClick={() => navigate("/sub-broker/loan-application")}
                    className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                  >
                    Create application
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ds-table min-w-[900px] w-full">
                  <thead>
                    <tr>
                      {[
                        "Deal",
                        "Program",
                        "Amount",
                        "Lender",
                        "Stage",
                        "Received",
                        "Portal",
                      ].map((label) => (
                        <th
                          key={label}
                          className={
                            label === "Portal" ? "!text-right" : undefined
                          }
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((row) => {
                      const product = formatProductLabel(row.loanInfo);

                      return (
                        <tr
                          key={row.submissionId}
                          className="cursor-pointer"
                          onClick={() => openRecent(row)}
                        >
                          <td
                            title={`${row.borrower || "Untitled"} · ${row.applicationNumber || ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-bold tracking-wide text-white">
                                {dealInitials(row.borrower)}
                              </span>
                              <div className="min-w-0">
                                <p className="ds-table-title">
                                  {row.borrower || "Untitled"}
                                </p>
                                <p className="ds-table-meta">
                                  {row.applicationNumber || (
                                    <span className="italic text-text-secondary/70">
                                      Not provided
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td title={product}>
                            {product === "—" ? (
                              <span className="text-[12px] font-medium italic text-text-secondary/70">
                                Not set
                              </span>
                            ) : (
                              <span className="inline-flex max-w-[180px] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium lowercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {product}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="ds-table-amount">
                              {formatRecentAmount(row.amount)}
                            </span>
                          </td>
                          <td>
                            {row.lenderCount > 0 && row.lenderName ? (
                              <div
                                className="flex min-w-0 items-center gap-1.5"
                                title={row.lenderName}
                              >
                                <Building2 className="h-3.5 w-3.5 shrink-0 text-[#4C78F5]" />
                                <span className="truncate text-[13px] font-medium text-text-primary">
                                  {row.lenderName}
                                </span>
                                {row.lenderCount > 1 ? (
                                  <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#4C78F5]/10 px-1.5 text-[10px] font-semibold text-[#4C78F5]">
                                    +{row.lenderCount - 1}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-[12px] font-medium italic text-text-secondary/70">
                                Not sent
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                          </td>
                          <td className="ds-table-muted whitespace-nowrap">
                            {row.submittedOn
                              ? formatUsDate(row.submittedOn)
                              : "—"}
                          </td>
                          <td
                            className="!text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              title="Open application"
                              onClick={() => openRecent(row)}
                              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#4C78F5] transition hover:text-[#3B66E0] hover:underline"
                            >
                              Open
                              <ExternalLink size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
