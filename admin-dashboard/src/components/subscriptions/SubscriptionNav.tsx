import { Link, useLocation } from "react-router-dom";
import { FiFileText, FiLayers, FiUsers, FiZap } from "react-icons/fi";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import {
  SUBSCRIBER_DETAIL_PATH,
  SUBSCRIBER_PERMISSIONS_PATH,
} from "../../lib/subscriberNavigation";

const TABS = [
  {
    label: "Packages",
    path: "/all-subscriptions",
    permission: "VIEW_SUBSCRIPTIONS",
    icon: FiLayers,
  },
  {
    label: "Loan AI Signups",
    path: "/loan-ai-signups",
    permission: "VIEW_SUBSCRIBERS",
    icon: FiZap,
  },
  {
    label: "Subscribers",
    path: "/subscription-subscribers",
    permission: "VIEW_SUBSCRIBERS",
    icon: FiUsers,
  },
  {
    label: "Invoices",
    path: "/subscription-invoices",
    permission: "VIEW_SUBSCRIPTION_INVOICES",
    icon: FiFileText,
  },
] as const;

export default function SubscriptionNav() {
  const location = useLocation();
  const { can } = useAdminPermissions();

  const visibleTabs = TABS.filter((tab) => can(tab.permission));

  if (visibleTabs.length <= 1) return null;

  return (
    <nav
      aria-label="Subscription sections"
      className="mb-6 overflow-x-auto"
    >
      <div className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 sm:min-w-0">
        {visibleTabs.map((tab) => {
          const active =
            location.pathname === tab.path ||
            (tab.path === "/subscription-subscribers" &&
              (location.pathname === SUBSCRIBER_DETAIL_PATH ||
                location.pathname === SUBSCRIBER_PERMISSIONS_PATH ||
                location.pathname.startsWith(
                  "/subscription-subscribers/",
                )));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition sm:px-4 ${
                active
                  ? "bg-[#13538A] text-white dark:bg-indigo-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
            >
              <Icon
                size={15}
                className={active ? "opacity-95" : "opacity-70"}
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
