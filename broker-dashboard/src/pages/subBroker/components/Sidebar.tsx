import {
  LayoutDashboard,
  BriefcaseBusiness,
} from "lucide-react";

import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/sub-broker/dashboard",
    },
    {
      label: "Loan Pipeline",
      icon: BriefcaseBusiness,
      path: "/sub-broker/loan-pipeline",
    },
  ];

  return (
    <aside className="hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col dark:border-slate-800 dark:bg-[#020817]">
      {/* LOGO */}
      <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          Sub Broker
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Affiliate Portal
        </p>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <Icon size={18} />

              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <button
          onClick={() => {
            sessionStorage.removeItem("sub_broker_token");
            sessionStorage.removeItem("sub_broker_user");

            window.location.href = "/sub-broker/login";
          }}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}