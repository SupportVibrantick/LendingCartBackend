import { useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIconLine,
  GroupIcon,
} from "../../icons";
import Badge from "../ui/badge/Badge";

type AdminStats = {
  brokers: number;
  lenders: number;
};

// Same as other pages: base URL from env
const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function EcommerceMetrics() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const token = sessionStorage.getItem("broker_token");

        const headers: Record<string, string> = {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const res = await fetch(`${API_BASE}/admin/stats`, {
          method: "GET",
          headers,
          // note: no credentials: "include" here, same as BrokersPage
        });

        if (!res.ok) {
          console.error(
            "Failed to fetch admin stats",
            res.status,
            await res.text().catch(() => "")
          );
          return;
        }

        const json = await res.json();
        console.log("admin stats response:", json);

        if (json?.success && json?.data && isMounted) {
          const orgs = json.data.organizations || {};
          setStats({
            brokers: orgs.brokers ?? 0,
            lenders: orgs.lenders ?? 0,
          });
        }
      } catch (err) {
        console.error("Error fetching admin stats", err);
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const brokersCount = stats?.brokers ?? 0;
  const lendersCount = stats?.lenders ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Brokers
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {brokersCount.toLocaleString()}
            </h4>
          </div>
          <Badge color="success">
            <ArrowUpIcon />
            11.01%
          </Badge>
        </div>
      </div>

      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Lenders
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {lendersCount.toLocaleString()}
            </h4>
          </div>

          <Badge color="error">
            <ArrowDownIcon />
            9.05%
          </Badge>
        </div>
      </div>
    </div>
  );
}
