import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import Sidebar from "../pages/loanOfficer/components/Sidebar";
import LoanOfficerHeader from "./LoanOfficerHeader";
import Backdrop from "./Backdrop";
import {
  exitLoanOfficerImpersonation,
  isLoanOfficerImpersonationSession,
  LO_API_BASE,
  loAuthHeaders,
  checkLoanOfficerResponse,
} from "../lib/loanOfficerApi";
import { setSessionPermissions } from "../lib/brokerPermissions";
import { useLoanOfficerSessionMonitor } from "../hooks/useSessionMonitor";

function LayoutContent() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const isImpersonation = isLoanOfficerImpersonationSession();

  useLoanOfficerSessionMonitor();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${LO_API_BASE}/loanofficer/auth/me`, {
          headers: loAuthHeaders(),
        });
        const json = await res.json();
        checkLoanOfficerResponse(res, json);
        const permissions = json?.data?.user?.permissions;
        if (Array.isArray(permissions)) {
          setSessionPermissions(permissions);
        }
      } catch {
        // ignore sync errors; session still works from login token
      }
    })();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="shrink-0">
        <Sidebar />
        <Backdrop />
      </div>

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out
        ${isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"}
        ${isMobileOpen ? "ml-0" : ""}`}
      >
        {isImpersonation && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
            <span>
              You are viewing this loan officer portal as a broker admin.
            </span>
            <button
              type="button"
              onClick={exitLoanOfficerImpersonation}
              className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              Close portal tab
            </button>
          </div>
        )}

        <LoanOfficerHeader />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LoanOfficerLayout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
