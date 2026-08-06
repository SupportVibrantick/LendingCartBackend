import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  BriefcaseBusiness,
  DollarSign,
  FilePlus,
  FileText,
  UserRound,
  Contact,
  RefreshCw,
  TrendingUp,
  UserPen,
} from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import StaffCommissionOverview from "../../../components/commissions/StaffCommissionOverview";
import {
  CO_BROKER_API_BASE,
  checkCoBrokerResponse,
  getCoBrokerAuthHeaders,
} from "../../../lib/coBrokerPortal";
import { isSessionExpiredError } from "../../../lib/sessionExpiry";

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
  amount: number;
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
  if (status === "DECLINED") return "Rejected";
  return status.replace(/_/g, " ");
}

export default function CoBrokerDashboard() {
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

  const load = async () => {
    try {
      setLoading(true);
      const headers = getCoBrokerAuthHeaders();
      const [statsRes, listRes] = await Promise.all([
        fetch(`${CO_BROKER_API_BASE}/subbroker/loan-pipeline/pipeline-stats`, {
          headers,
        }),
        fetch(`${CO_BROKER_API_BASE}/subbroker/loan-pipeline?limit=5`, {
          headers,
        }),
      ]);

      const statsJson = await statsRes.json();
      const listJson = await listRes.json();

      checkCoBrokerResponse(statsRes, statsJson);
      checkCoBrokerResponse(listRes, listJson);

      if (statsRes.ok && statsJson.success) {
        setStats(statsJson.data);
      }

      if (listRes.ok && listJson.success && Array.isArray(listJson.data)) {
        setRecent(
          listJson.data.slice(0, 5).map((item: any) => ({
            submissionId: item.submissionId,
            applicationId: item.applicationId,
            applicationNumber: item.applicationNumber,
            borrower: item.borrower || item.borrowerName || "Applicant",
            amount: Number(item.amount || 0),
            status: item.status,
            submittedOn: item.submittedOn || item.createdAt,
          })),
        );
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
  }, []);

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
      to: "/sub-broker/loan-application",
      color: "bg-[#13538A]",
    },
    {
      label: "Loan Pipeline",
      desc: "View all assigned deals",
      icon: TrendingUp,
      to: "/sub-broker/loan-pipeline",
      color: "bg-[#13538A]",
    },
    {
      label: "Commissions",
      desc: "Track your earnings",
      icon: DollarSign,
      to: "/sub-broker/commissions",
      color: "bg-emerald-600",
    },
    {
      label: "Invoices",
      desc: "View payment invoices",
      icon: FileText,
      to: "/sub-broker/invoices",
      color: "bg-violet-600",
    },
    {
      label: "Borrowers",
      desc: "View assigned borrower records",
      icon: UserRound,
      to: "/sub-broker/borrowers",
      color: "bg-orange-600",
    },
    {
      label: "Contacts",
      desc: "Manage your directory",
      icon: Contact,
      to: "/sub-broker/contacts",
      color: "bg-slate-700",
    },
    {
      label: "Profile",
      desc: "Update your account",
      icon: UserPen,
      to: "/sub-broker/profile",
      color: "bg-slate-700",
    },
  ];

  return (
    <>
      <PageMeta
        title="Dashboard | Co-Broker Portal"
        description="Co-broker pipeline and commission overview"
      />

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                Co-Broker Portal
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Dashboard</h1>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Your assigned pipeline, commission earnings, and recent activity.
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

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Recent Applications
            </h2>
            <Link
              to="/sub-broker/loan-pipeline"
              className="text-sm font-medium text-[#13538A] hover:underline"
            >
              View all
            </Link>
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
                onClick={() => navigate("/sub-broker/loan-pipeline")}
                className="mt-3 text-sm font-medium text-[#13538A] hover:underline"
              >
                Open loan pipeline
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
                    <th className="px-5 py-3" />
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
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {row.borrower}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {row.applicationNumber || "—"}
                      </td>
                      <td className="px-5 py-3 font-mono text-gray-700">
                        {formatCompactAmount(row.amount)}
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
                      <td className="px-5 py-3 text-right">
                        <ArrowRight className="ml-auto h-4 w-4 text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
