import { Outlet } from "react-router-dom";
import Sidebar from "../pages/subBroker/components/Sidebar";

export default function SubBrokerLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0b1120]">
      {/* SIDEBAR */}
      <Sidebar />

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen p-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}