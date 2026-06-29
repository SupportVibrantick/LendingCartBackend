import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/subBroker/components/Sidebar";
import CoBrokerHeader from "./CoBrokerHeader";
import {
  exitCoBrokerImpersonation,
  isCoBrokerImpersonationSession,
} from "../lib/coBrokerPortal";

export default function SubBrokerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isImpersonation = isCoBrokerImpersonationSession();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
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

        <CoBrokerHeader
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
