import { useEffect, useState } from "react";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import MonthlyTarget from "../../components/ecommerce/MonthlyTarget";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import DemographicCard from "../../components/ecommerce/DemographicCard";
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
  applicationsByStatus: {
    SUBMITTED: number;
    IN_REVIEW: number;
    LENDER_APPROVED: number;
    LENDER_DECLINED: number;
    FUNDED: number;
    WITHDRAWN: number;
  };
}

export default function Home() {
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("broker_token");

    fetch(`${API_BASE}/broker/stats`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setStats(json.data);
        }
      })
      .catch((err) => console.error("Stats error:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageMeta
        title="Lendingcart Dashboard"
        description="Welcome to lending cart dashboard"
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">

        {/* Stats Cards */}
        <div className="col-span-12">
          <EcommerceMetrics stats={stats} loading={loading} />
        </div>

        {/* Performance Chart */}
        <div className="col-span-12">
          <StatisticsChart stats={stats} loading={loading} />
        </div>

        <div className="col-span-12">
          <MonthlySalesChart />
        </div>

        <div className="col-span-12">
          <MonthlyTarget />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <DemographicCard />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <RecentOrders />
        </div>

      </div>
    </>
  );
}
