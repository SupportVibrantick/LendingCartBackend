import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
// import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
// import MonthlyTarget from "../../components/ecommerce/MonthlyTarget";
// import RecentOrders from "../../components/ecommerce/RecentOrders";
// import DemographicCard from "../../components/ecommerce/DemographicCard";
import PageMeta from "../../components/common/PageMeta";

import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Lendingcart Dashboard"
        description="Welcome to lending cart dashboard"
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">

        {/* Stats Cards */}
        <div className="col-span-12">
          <EcommerceMetrics  />
        </div>

        {/* Performance Chart */}
        <div className="col-span-12">
          <StatisticsChart  />
        </div>

        {/* <div className="col-span-12">
          <MonthlySalesChart />
        </div> */}

        {/* <div className="col-span-12">
          <MonthlyTarget />
        </div> */}

        {/* <div className="col-span-12 xl:col-span-5">
          <DemographicCard />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <RecentOrders />
        </div> */}

      </div>
    </>
  );
}
