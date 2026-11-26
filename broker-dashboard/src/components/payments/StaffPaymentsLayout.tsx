import { NavLink, Outlet } from "react-router";
import { Building2, FileText, Wallet } from "lucide-react";

type Props = {
  basePath: string;
  pageDescription?: string;
};

export default function StaffPaymentsLayout({
  basePath,
  pageDescription = "Manage commission invoices, payouts, banking, and payment records.",
}: Props) {
  const tabs = [
    { label: "Invoices", to: `${basePath}/invoices`, icon: FileText },
    { label: "Commissions", to: `${basePath}/commissions`, icon: Wallet },
    { label: "Banking", to: `${basePath}/banking`, icon: Building2 },
  ];

  return (
    <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary dark:text-slate-100">
      <div>
        <h1 className="ds-page-title">Payments</h1>
        <p className="ds-page-subtitle">{pageDescription}</p>
      </div>

      <div className="inline-flex w-full gap-1 rounded-xl border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-950 sm:w-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition sm:flex-none ${
                  isActive
                    ? "bg-[#4C78F5] text-white"
                    : "text-text-secondary hover:bg-surface hover:text-[#4C78F5] dark:text-slate-300 dark:hover:bg-slate-900"
                }`
              }
            >
              <Icon size={14} />
              {tab.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
