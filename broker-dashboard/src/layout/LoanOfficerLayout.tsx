import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/loanOfficer/components/Sidebar";
import LoanOfficerHeader from "./LoanOfficerHeader";

export default function LoanOfficerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <LoanOfficerHeader
          mobileOpen={mobileOpen}
          onMenuClick={() => setMobileOpen((open) => !open)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
