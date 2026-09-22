import { Link, useLocation } from "react-router-dom";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import {
  SUBSCRIBER_DETAIL_PATH,
  SUBSCRIBER_PERMISSIONS_PATH,
} from "../../lib/subscriberNavigation";

const TABS = [
  { label: "Packages", path: "/all-subscriptions", permission: "VIEW_SUBSCRIPTIONS" },
  { label: "Loan AI Signups", path: "/loan-ai-signups", permission: "VIEW_SUBSCRIBERS" },
  { label: "Subscribers", path: "/subscription-subscribers", permission: "VIEW_SUBSCRIBERS" },
  { label: "Invoices", path: "/subscription-invoices", permission: "VIEW_SUBSCRIPTION_INVOICES" },
] as const;

export default function SubscriptionNav() {
  const location = useLocation();
  const { can } = useAdminPermissions();

  const visibleTabs = TABS.filter((tab) => can(tab.permission));

  if (visibleTabs.length <= 1) return null;

  return (
    <nav
      aria-label="Subscription sections"
      className="mb-5 flex w-full max-w-full flex-wrap gap-1 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {visibleTabs.map((tab) => {
        const active =
          location.pathname === tab.path ||
          (tab.path === "/subscription-subscribers" &&
            (location.pathname === SUBSCRIBER_DETAIL_PATH ||
              location.pathname === SUBSCRIBER_PERMISSIONS_PATH));

        return (
          <Link
            key={tab.path}
            to={tab.path}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-[#13538A] text-white shadow-sm dark:bg-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
