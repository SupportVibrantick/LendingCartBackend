import { useEffect } from "react";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  useEffect(() => {
    document.documentElement.classList.add("dashboard-scroll-lock");
    return () => {
      document.documentElement.classList.remove("dashboard-scroll-lock");
    };
  }, []);

  const mainOffset =
    isExpanded || isHovered || isMobileOpen ? "lg:pl-[280px]" : "lg:pl-[84px]";

  return (
    <div className="flex h-full overflow-hidden">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${mainOffset} ${
          isMobileOpen ? "pl-0" : ""
        }`}
      >
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full max-w-(--breakpoint-2xl) p-3">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
