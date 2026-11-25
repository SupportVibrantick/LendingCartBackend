import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import Sidebar from "../pages/subBroker/components/Sidebar";
import CoBrokerHeader from "./CoBrokerHeader";
import Backdrop from "./Backdrop";
import {
  exitCoBrokerImpersonation,
  isCoBrokerImpersonationSession,
} from "../lib/coBrokerPortal";
import { hydrateOrgEntitlements } from "../lib/brokerEntitlements";
import { useCoBrokerSessionMonitor } from "../hooks/useSessionMonitor";

function LayoutContent() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const isImpersonation = isCoBrokerImpersonationSession();

  useCoBrokerSessionMonitor();

  useEffect(() => {
    document.documentElement.classList.add("dashboard-scroll-lock");
    return () => {
      document.documentElement.classList.remove("dashboard-scroll-lock");
    };
  }, []);

  useEffect(() => {
    void hydrateOrgEntitlements();
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
              You are viewing this co-broker portal as a broker admin.
            </span>
            <button
              type="button"
              onClick={exitCoBrokerImpersonation}
              className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              Close portal tab
            </button>
          </div>
        )}

        <CoBrokerHeader />

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-surface">
          <div className="mx-auto w-full max-w-(--breakpoint-2xl) p-3 md:p-4 lg:p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SubBrokerLayout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
