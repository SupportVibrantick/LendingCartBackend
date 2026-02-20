import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import MonthlyTarget from "../../components/ecommerce/MonthlyTarget";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import DemographicCard from "../../components/ecommerce/DemographicCard";
import PageMeta from "../../components/common/PageMeta";
import { useEffect, useState } from "react";
import ApplicationsDonutChart from "../../components/charts/bar/ApplicationsDonutChart";
import LatestApplicationsTable from "../../components/ecommerce/LatestApplicationsTable";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Home() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/stats`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
          },
        });

        console.log(res);
        if (!res.ok) {
          throw new Error("Failed to fetch stats");
        }

        const data = await res.json();

        setStats(data.data);
      } catch (err) {
        console.error("Stats error:", err);
      }
    };

    fetchStats();
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
          <EcommerceMetrics stats={stats} />
        </div>

        {/* Performance Chart */}
        <div className="col-span-12 grid grid-cols-12 gap-4">
          {/* Smaller Donut */}
          <div className="col-span-12 lg:col-span-6">
            <ApplicationsDonutChart stats={stats} />
          </div>

          {/* Larger Performance Chart */}
          <div className="col-span-12 lg:col-span-6">
            <StatisticsChart stats={stats} />
          </div>
        </div>

        <div className="col-span-12">
          <LatestApplicationsTable
            applications={stats?.latestApplications || []}
          />
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
