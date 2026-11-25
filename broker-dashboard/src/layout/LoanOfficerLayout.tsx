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
import { hydrateOrgEntitlements } from "../lib/brokerEntitlements";
import { useLoanOfficerSessionMonitor } from "../hooks/useSessionMonitor";

function LayoutContent() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const isImpersonation = isLoanOfficerImpersonationSession();

  useLoanOfficerSessionMonitor();

  useEffect(() => {
    document.documentElement.classList.add("dashboard-scroll-lock");
    return () => {
      document.documentElement.classList.remove("dashboard-scroll-lock");
    };
  }, []);

  useEffect(() => {
    void hydrateOrgEntitlements();
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

  const mainOffset =
    isExpanded || isHovered || isMobileOpen ? "lg:pl-[260px]" : "lg:pl-[84px]";

  return (
    <div className="flex h-full overflow-hidden bg-surface dark:bg-gray-950">
      <Sidebar />
      <Backdrop />

      <div
        className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${mainOffset} ${
          isMobileOpen ? "pl-0" : ""
        }`}
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

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-surface">
          <div className="mx-auto w-full max-w-(--breakpoint-2xl) p-3 md:p-4 lg:p-4">
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
