import { NavLink, Outlet } from "react-router";

const tabs = [
  { label: "Invoices", to: "/payments/invoices" },
  { label: "Commissions", to: "/payments/commissions" },
];

export default function PaymentsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage commission invoices, payouts, and payment records. 
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-b-2 border-[#13538A] text-[#13538A]"
                    : "text-slate-500 hover:text-slate-800"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
