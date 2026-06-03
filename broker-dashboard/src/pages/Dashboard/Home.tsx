import { useEffect, useState } from "react";
import { Activity, Building2, CircleDollarSign } from "lucide-react";
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

export default function Home() {
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetch(`${API_BASE}/broker/stats`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success) {
          setStats(json.data);
        }
      })
      .catch((err) => console.error("Dashboard stats error:", err))
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const spotlightCards = [
    {
      title: "Submission Momentum",
      value: `${stats?.conversion.submissionRate ?? 0}%`,
      helper: "Applications that progressed beyond draft stage",
      icon: <Activity className="h-5 w-5 text-sky-600" />,
    },
    {
      title: "Lender Reach",
      value: stats?.uniqueLendersAccessed ?? 0,
      helper: "Distinct lenders touched across your active pipeline",
      icon: <Building2 className="h-5 w-5 text-emerald-600" />,
    },
    {
      title: "Funded Outcomes",
      value: stats?.totalFunded ?? 0,
      helper: "Applications that have already closed successfully",
      icon: <CircleDollarSign className="h-5 w-5 text-indigo-600" />,
    },
  ];

  return (
    <>
      <PageMeta
        title="Lendingcart Dashboard"
        description="Welcome to lending cart dashboard"
      />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(135deg,_#f8fbff_0%,_#ffffff_48%,_#ecfeff_100%)] p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.26em] text-sky-600">
                Broker Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
                Track volume, conversion, and product performance from one view.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                This dashboard now pulls live stats, pipeline distribution, and approved
                product volume directly from the broker analytics API.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 xl:min-w-[540px]">
              {spotlightCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {card.title}
                    </p>
                    {card.icon}
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">
                    {loading ? "--" : card.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{card.helper}</p>
                </div>
              ))}
            </div>
          </div>
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
