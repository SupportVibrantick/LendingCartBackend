import { Link } from "react-router-dom";
import { FiShield } from "react-icons/fi";
import { HiOutlineDocumentText } from "react-icons/hi2";
import {
  SUBSCRIBER_DETAIL_PATH,
  SUBSCRIBER_PERMISSIONS_PATH,
} from "../../lib/subscriberNavigation";

type Props = {
  organizationId: string;
  activeTab: "details" | "permissions";
};

export default function SubscriberSubNav({ organizationId, activeTab }: Props) {
  const navState = { organizationId };

  const tabs = [
    {
      id: "details" as const,
      label: "Details",
      path: SUBSCRIBER_DETAIL_PATH,
      icon: HiOutlineDocumentText,
    },
    {
      id: "permissions" as const,
      label: "Permissions",
      path: SUBSCRIBER_PERMISSIONS_PATH,
      icon: FiShield,
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <span className="hidden pr-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:inline">
          Subscriber
        </span>
        <nav
          aria-label="Subscriber sections"
          className="-mb-px flex flex-wrap gap-1"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                state={navState}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-[#13538A] text-[#13538A] dark:border-indigo-400 dark:text-indigo-300"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
