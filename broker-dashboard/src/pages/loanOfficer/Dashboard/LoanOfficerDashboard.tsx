import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  BriefcaseBusiness,
  FilePlus,
  FolderOpen,
  Mail,
  RefreshCw,
  Store,
  UserRound,
  Users,
  Contact,
} from "lucide-react";
import { LO_API_BASE, loAuthHeaders, checkLoanOfficerResponse } from "../../../lib/loanOfficerApi";
import { isSessionExpiredError } from "../../../lib/sessionExpiry";
import StaffCommissionOverview from "../../../components/commissions/StaffCommissionOverview";
import {
  hasAnyPermission,
  hasPermission,
  LO_PERMISSIONS_UPDATED_EVENT,
  type PermissionKey,
} from "../../../lib/brokerPermissions";

type PipelineStats = {
  totalVolume: number;
  totalApplications: number;
  submitted: number;
  clientPending: number;
  approved: number;
  rejected: number;
  inReview: number;
  draft: number;
};

type RecentApp = {
  submissionId: string;
  applicationId: string;
  applicationNumber?: string;
  borrower: string;
  amount: string;
  status: string;
  submittedOn: string;
};

function formatCompactAmount(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function statusLabel(status: string) {
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  return status.replace(/_/g, " ");
}

export default function LoanOfficerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PipelineStats>({
    totalVolume: 0,
    totalApplications: 0,
    submitted: 0,
    clientPending: 0,
    approved: 0,
    rejected: 0,
    inReview: 0,
    draft: 0,
  });
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [permTick, setPermTick] = useState(0);

  useEffect(() => {
    const refresh = () => setPermTick((value) => value + 1);
    window.addEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
  }, []);

  const load = async () => {
    try {
      setLoading(true);

      const canViewStats = hasPermission("VIEW_DASHBOARD_STATS", "loanOfficer");
      const canViewRecent = hasPermission("VIEW_DASHBOARD_RECENT", "loanOfficer");

      const requests: Promise<Response | null>[] = [
        canViewStats
          ? fetch(`${LO_API_BASE}/loanofficer/dashboard/stats`, {
              headers: loAuthHeaders(),
            })
          : Promise.resolve(null),
        canViewRecent
          ? fetch(
              `${LO_API_BASE}/loanofficer/dashboard/recent-applications?limit=5`,
              { headers: loAuthHeaders() },
            )
          : Promise.resolve(null),
      ];

      const [statsRes, listRes] = await Promise.all(requests);

      if (statsRes) {
        const statsJson = await statsRes.json();
        checkLoanOfficerResponse(statsRes, statsJson);
        if (statsRes.ok && statsJson.success) {
          setStats(statsJson.data);
        }
      } else {
        setStats({
          totalVolume: 0,
          totalApplications: 0,
          submitted: 0,
          clientPending: 0,
          approved: 0,
          rejected: 0,
          inReview: 0,
          draft: 0,
        });
      }

      if (listRes) {
        const listJson = await listRes.json();
        checkLoanOfficerResponse(listRes, listJson);
        if (listRes.ok && Array.isArray(listJson.data)) {
          setRecent(listJson.data);
        }
      } else {
        setRecent([]);
      }
    } catch (err) {
      if (isSessionExpiredError(err)) return;
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [permTick]);

  const statCards = [
    {
      label: "Total Applications",
      value: stats.totalApplications,
      color: "text-[#13538A]",
    },
    {
      label: "Total Volume",
      value: formatCompactAmount(stats.totalVolume),
      color: "text-indigo-600",
    },
    { label: "In Review", value: stats.inReview, color: "text-amber-600" },
    {
      label: "Client Pending",
      value: stats.clientPending,
      color: "text-rose-600",
    },
    { label: "Approved", value: stats.approved, color: "text-emerald-600" },
    { label: "Draft", value: stats.draft, color: "text-gray-600" },
  ];

  const quickActions = [
    {
      label: "New Application",
      desc: "Start a new loan file",
      icon: FilePlus,
      to: "/loan-officer/loan-application",
      color: "bg-[#13538A]",
      permission: "CREATE_APPLICATION" as PermissionKey,
    },
    {
      label: "Loan Pipeline",
      desc: "View all assigned deals",
      icon: BriefcaseBusiness,
      to: "/loan-officer/loan-pipeline",
      color: "bg-[#1a6aad]",
      permission: "VIEW_APPLICATIONS" as PermissionKey,
    },
    {
      label: "Co-Brokers",
      desc: "Manage your co-broker team",
      icon: Users,
      to: "/loan-officer/co-brokers",
      color: "bg-violet-600",
      permission: "VIEW_CO_BROKERS" as PermissionKey,
    },
    {
      label: "Contacts",
      desc: "Manage your directory",
      icon: Contact,
      to: "/loan-officer/contacts",
      color: "bg-slate-700",
      permission: "VIEW_CONTACTS" as PermissionKey,
    },
    {
      label: "Borrowers",
      desc: "View borrower records",
      icon: UserRound,
      to: "/loan-officer/borrowers",
      color: "bg-orange-600",
      permission: "VIEW_BORROWERS" as PermissionKey,
    },
    {
      label: "Lender Marketplace",
      desc: "Discover and connect lenders",
      icon: Store,
      to: "/loan-officer/lender-marketplace",
      color: "bg-emerald-600",
      permission: "VIEW_MARKETPLACE" as PermissionKey,
    },
    {
      label: "Custom Documents",
      desc: "Manage document templates",
      icon: FolderOpen,
      to: "/loan-officer/documents/custom",
      color: "bg-amber-600",
      permission: ["MANAGE_CUSTOM_DOCUMENTS", "VIEW_CUSTOM_DOCUMENTS"] as PermissionKey[],
    },
    {
      label: "Email Marketing",
      desc: "Run email campaigns",
      icon: Mail,
      to: "/loan-officer/email-marketing",
      color: "bg-rose-600",
      permission: "SEND_EMAILS" as PermissionKey,
    },
  ].filter((action) => {
    void permTick;
    const required = Array.isArray(action.permission)
      ? action.permission
      : [action.permission];
    return hasAnyPermission(required, "loanOfficer");
  });

  const canViewStats = hasPermission("VIEW_DASHBOARD_STATS", "loanOfficer");
  const canViewRecent = hasPermission("VIEW_DASHBOARD_RECENT", "loanOfficer");
  const canViewPipeline = hasPermission("VIEW_APPLICATIONS", "loanOfficer");

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              Officer Portal
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Dashboard</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Your assigned pipeline, volume, and recent activity at a glance.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {canViewStats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {card.label}
              </p>
              <p className={`mt-2 text-2xl font-bold ${card.color}`}>
                {loading ? "—" : card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {hasPermission("VIEW_COMMISSIONS", "loanOfficer") && (
        <StaffCommissionOverview
          apiBase={LO_API_BASE}
          summaryPath="/loanofficer/commissions/summary"
          listPath="/loanofficer/commissions"
          getHeaders={() => loAuthHeaders(false)}
          portal="loanofficer"
          title="My Commission Earnings"
          invoicesHref="/loan-officer/invoices"
          commissionsHref="/loan-officer/commissions"
        />
      )}

      {quickActions.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Quick Actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#13538A]/30 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${action.color}`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {action.label}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{action.desc}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-[#13538A]" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {canViewRecent && (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Recent Applications
          </h2>
          {canViewPipeline ? (
          <Link
            to="/loan-officer/loan-pipeline"
            className="text-sm font-medium text-[#13538A] hover:underline"
          >
            View all
          </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse bg-gray-50 dark:bg-gray-800/50"
              />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BriefcaseBusiness className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-700 dark:text-gray-200">
              No applications yet
            </p>
            <button
              type="button"
              onClick={() => navigate("/loan-officer/loan-application")}
              className="mt-3 text-sm font-medium text-[#13538A] hover:underline"
            >
              Create your first application
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-800">
                <tr>
                  <th className="px-5 py-3">Borrower</th>
                  <th className="px-5 py-3">App No.</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recent.map((row) => (
                  <tr
                    key={row.submissionId}
                    className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    onClick={() =>
                      navigate("/loan-officer/loan-pipeline-preview", {
                        state: { submissionId: row.submissionId },
                      })
                    }
                  >
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                      {row.borrower}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {row.applicationNumber || "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-700">
                      {formatCompactAmount(Number(row.amount) || 0)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-[#13538A]/10 px-2.5 py-0.5 text-xs font-medium text-[#13538A]">
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {row.submittedOn
                        ? new Date(row.submittedOn).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
