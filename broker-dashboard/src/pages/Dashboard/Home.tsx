import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Contact,
  FilePlus,
  RefreshCw,
  Store,
  TrendingUp,
  Users,
  UserRound,
} from "lucide-react";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import StatusDistributionChart from "../../components/ecommerce/StatusDistributionChart";
import ProductVolumeChart from "../../components/ecommerce/ProductVolumeChart";
import PageMeta from "../../components/common/PageMeta";
import { isSessionExpiredError } from "../../lib/sessionExpiry";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface BrokerStats {
  totalApplications: number;
  totalSubmitted: number;
  totalInReview: number;
  totalApproved: number;
  totalDeclined: number;
  totalFunded: number;
  totalWithdrawn: number;
  totalVolumeFunded: number;
  uniqueLendersAccessed: number;
  applicationsByStatus: Record<string, number>;
  conversion: {
    submissionRate: number;
    approvalRate: number;
    fundingRate: number;
  };
  monthlyTrend: {
    label: string;
    applications: number;
    submitted: number;
    approved: number;
    funded: number;
    fundedVolume: number;
  }[];
  productWiseApprovedVolume: {
    product: string;
    totalApprovedAmount: number;
  }[];
}

type RecentApp = {
  submissionId: string;
  applicationId: string;
  applicationNumber?: string;
  borrower: string;
  amount: number;
  status: string;
  submittedOn: string;
};

const STATUS_TO_PIPELINE: Record<string, string> = {
  DRAFT: "DRAFT",
  CLIENT_PENDING: "CLIENT_PENDING",
  SUBMITTED: "SUBMITTED",
  IN_REVIEW: "IN_REVIEW",
  LENDER_APPROVED: "APPROVED",
  LENDER_DECLINED: "DECLINED",
  FUNDED: "FUNDED",
};

const METRIC_TO_PIPELINE: Record<string, string | undefined> = {
  totalApplications: undefined,
  totalSubmitted: "SUBMITTED",
  totalInReview: "IN_REVIEW",
  totalApproved: "APPROVED",
  totalDeclined: "DECLINED",
  totalFunded: "FUNDED",
  totalWithdrawn: undefined,
  totalVolumeFunded: "FUNDED",
  uniqueLendersAccessed: undefined,
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function formatCompactAmount(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function statusLabel(status: string) {
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  if (status === "DECLINED" || status === "LENDER_DECLINED") return "Rejected";
  if (status === "LENDER_APPROVED") return "Approved";
  return status.replace(/_/g, " ");
}

function pipelineHref(status?: string) {
  if (!status) return "/submit-applications";
  return `/submit-applications?status=${encodeURIComponent(status)}`;
}

const quickActions = [
  {
    label: "New Application",
    desc: "Start a loan file",
    path: "/loan-application",
    icon: FilePlus,
    color: "bg-[#13538A]",
  },
  {
    label: "Loan Pipeline",
    desc: "Track active applications",
    path: "/submit-applications",
    icon: TrendingUp,
    color: "bg-[#1a6aad]",
  },
  {
    label: "Lender Marketplace",
    desc: "Discover & connect lenders",
    path: "/lender-marketplace",
    icon: Store,
    color: "bg-emerald-600",
  },
  {
    label: "Loan Officers",
    desc: "Manage your officer team",
    path: "/loan-officers",
    icon: Users,
    color: "bg-violet-600",
  },
  {
    label: "Co-Brokers",
    desc: "Manage co-broker partners",
    path: "/sub-brokers",
    icon: Building2,
    color: "bg-indigo-600",
  },
  {
    label: "Borrowers",
    desc: "View borrower records",
    path: "/borrowers",
    icon: UserRound,
    color: "bg-orange-600",
  },
  {
    label: "Contacts",
    desc: "Manage your directory",
    path: "/contacts-list",
    icon: Contact,
    color: "bg-slate-700",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const [statsRes, listRes] = await Promise.all([
        fetch(`${API_BASE}/broker/stats`, { headers }),
        fetch(`${API_BASE}/broker/loan-pipeline/submissions?limit=5`, {
          headers,
        }),
      ]);

      const statsJson = await statsRes.json();
      const listJson = await listRes.json();

      if (statsRes.ok && statsJson.success) {
        setStats(statsJson.data);
      } else if (!statsRes.ok) {
        throw new Error(statsJson.message || "Failed to load dashboard stats");
      }

      if (listRes.ok && Array.isArray(listJson.data)) {
        setRecent(
          listJson.data.slice(0, 5).map((item: Record<string, unknown>) => ({
            submissionId: String(item.submissionId || ""),
            applicationId: String(item.applicationId || ""),
            applicationNumber: item.applicationNumber
              ? String(item.applicationNumber)
              : undefined,
            borrower: String(item.borrower || "Applicant"),
            amount: Number(item.amount || 0),
            status: String(item.status || ""),
            submittedOn: String(item.submittedOn || ""),
          })),
        );
      } else {
        setRecent([]);
      }
    } catch (err) {
      if (isSessionExpiredError(err)) return;
      console.error("Dashboard load error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPipeline = (status?: string) => {
    navigate(pipelineHref(status));
  };

  const spotlightCards = [
    {
      title: "Submission Rate",
      value: `${stats?.conversion.submissionRate ?? 0}%`,
      helper: "Beyond draft stage",
      icon: Activity,
      tone: "bg-sky-50 text-sky-600",
      onClick: () => openPipeline("SUBMITTED"),
    },
    {
      title: "Lenders Reached",
      value: stats?.uniqueLendersAccessed ?? 0,
      helper: "Active pipeline lenders",
      icon: Building2,
      tone: "bg-emerald-50 text-emerald-600",
      onClick: () => navigate("/lender-marketplace"),
    },
    {
      title: "Funded Deals",
      value: stats?.totalFunded ?? 0,
      helper: "Successfully closed",
      icon: CircleDollarSign,
      tone: "bg-violet-50 text-violet-600",
      onClick: () => openPipeline("FUNDED"),
    },
  ];

  return (
    <>
      <PageMeta
        title="Broker Dashboard | Loan Automation"
        description="Broker analytics dashboard"
      />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="bg-gradient-to-r from-[#13538A] to-[#1a6aad] px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Broker Dashboard
                </p>
                <h1 className="mt-2 max-w-2xl text-2xl font-semibold md:text-3xl">
                  Your pipeline, volume, and lender performance — all in one
                  place.
                </h1>
                <p className="mt-2 max-w-xl text-sm text-white/80">
                  Live stats from your broker analytics API. Monitor submissions,
                  conversions, and funded volume at a glance.
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-3 md:p-6">
            {spotlightCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={card.onClick}
                className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-left transition hover:border-[#13538A]/30 hover:bg-white hover:shadow-sm dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {card.title}
                  </p>
                  <span className={`rounded-lg p-2 ${card.tone}`}>
                    <card.icon size={16} />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? "—" : card.value}
                </p>
                <p className="mt-1 text-xs text-gray-500">{card.helper}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Quick Actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#13538A]/30 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${action.color}`}
                >
                  <action.icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {action.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{action.desc}</p>
                </div>
                <ArrowRight
                  size={16}
                  className="mt-1 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#13538A]"
                />
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12">
            <EcommerceMetrics
              stats={stats}
              loading={loading}
              onStatClick={(key) => openPipeline(METRIC_TO_PIPELINE[key])}
            />
          </div>
          <div className="col-span-12">
            <StatisticsChart stats={stats} loading={loading} />
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
          <div className="col-span-12 xl:col-span-7">
            <ProductVolumeChart stats={stats} loading={loading} />
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Recent Applications
            </h2>
            <Link
              to="/submit-applications"
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
                onClick={() => navigate("/loan-application")}
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
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recent.map((row) => (
                    <tr
                      key={row.submissionId}
                      className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      onClick={() =>
                        navigate("/loan-preview", {
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
        </section>
      </div>
    </>
  );
}
