import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  ArrowRight,
  Building2,
  CircleDollarSign,
  FilePlus,
  TrendingUp,
} from "lucide-react";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import StatusDistributionChart from "../../components/ecommerce/StatusDistributionChart";
import ProductVolumeChart from "../../components/ecommerce/ProductVolumeChart";
import PageMeta from "../../components/common/PageMeta";

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

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

const quickActions = [
  {
    label: "Loan Pipeline",
    desc: "Track active applications",
    path: "/submit-applications",
    icon: TrendingUp,
  },
  {
    label: "New Application",
    desc: "Start a loan file",
    path: "/loan-application",
    icon: FilePlus,
  },
  {
    label: "Lender Marketplace",
    desc: "Discover & connect lenders",
    path: "/lender-marketplace",
    icon: Building2,
  },
];

export default function Home() {
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetch(`${API_BASE}/broker/stats`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success) setStats(json.data);
      })
      .catch((err) => console.error("Dashboard stats error:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const spotlightCards = [
    {
      title: "Submission Rate",
      value: `${stats?.conversion.submissionRate ?? 0}%`,
      helper: "Beyond draft stage",
      icon: Activity,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      title: "Lenders Reached",
      value: stats?.uniqueLendersAccessed ?? 0,
      helper: "Active pipeline lenders",
      icon: Building2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Funded Deals",
      value: stats?.totalFunded ?? 0,
      helper: "Successfully closed",
      icon: CircleDollarSign,
      tone: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <>
      <PageMeta title="Broker Dashboard | Loan Automation" description="Broker analytics dashboard" />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="bg-gradient-to-r from-[#13538A] to-[#1a6aad] px-6 py-8 text-white md:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Broker Dashboard
            </p>
            <h1 className="mt-2 max-w-2xl text-2xl font-semibold md:text-3xl">
              Your pipeline, volume, and lender performance — all in one place.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Live stats from your broker analytics API. Monitor submissions, conversions, and
              funded volume at a glance.
            </p>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-3 md:p-6">
            {spotlightCards.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/50"
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
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#13538A]/30 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
                  <action.icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {action.label}
                  </p>
                  <p className="text-xs text-gray-500">{action.desc}</p>
                </div>
              </div>
              <ArrowRight
                size={16}
                className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#13538A]"
              />
            </Link>
          ))}
        </section>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12">
            <EcommerceMetrics stats={stats} loading={loading} />
          </div>
          <div className="col-span-12">
            <StatisticsChart stats={stats} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <StatusDistributionChart stats={stats} loading={loading} />
          </div>
          <div className="col-span-12 xl:col-span-7">
            <ProductVolumeChart stats={stats} loading={loading} />
          </div>
        </div>
      </div>
    </>
  );
}
