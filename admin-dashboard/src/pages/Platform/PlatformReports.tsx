import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import ApplicationsDonutChart from "../../components/charts/bar/ApplicationsDonutChart";
import LatestApplicationsTable from "../../components/ecommerce/LatestApplicationsTable";
import { adminFetch } from "../../lib/adminApi";

export default function PlatformReports() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    adminFetch<{ data: any }>("/admin/stats")
      .then((json) => setStats(json.data))
      .catch(console.error);
  }, []);

  return (
    <>
      <PageMeta title="Platform Reports" description="System reports and analytics" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Platform-wide metrics for super administrators.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12">
            <EcommerceMetrics stats={stats} />
          </div>
          <div className="col-span-12 grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <ApplicationsDonutChart stats={stats} />
            </div>
            <div className="col-span-12 lg:col-span-6">
              <StatisticsChart stats={stats} />
            </div>
          </div>
          <div className="col-span-12">
            <LatestApplicationsTable applications={stats?.latestApplications || []} />
          </div>
        </div>
      </div>
    </>
  );
}
