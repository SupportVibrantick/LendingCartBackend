import { Link, useLocation } from "react-router-dom";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import { SUBSCRIBER_DETAIL_PATH } from "../../lib/subscriberNavigation";

const TABS = [
  { label: "Packages", path: "/all-subscriptions", permission: "VIEW_SUBSCRIPTIONS" },
  { label: "Subscribers", path: "/subscription-subscribers", permission: "VIEW_SUBSCRIBERS" },
  { label: "Invoices", path: "/subscription-invoices", permission: "VIEW_SUBSCRIPTION_INVOICES" },
] as const;

export default function SubscriptionNav() {
  const location = useLocation();
  const { can } = useAdminPermissions();

  const visibleTabs = TABS.filter((tab) => can(tab.permission));

  if (visibleTabs.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {visibleTabs.map((tab) => {
        const active =
          location.pathname === tab.path ||
          (tab.path === "/subscription-subscribers" &&
            location.pathname === SUBSCRIBER_DETAIL_PATH);

        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              active
                ? "bg-[#13538A] text-white shadow-sm"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
