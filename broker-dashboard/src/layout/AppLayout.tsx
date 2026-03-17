import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className="shrink-0">
        <AppSidebar />
        <Backdrop />
      </div>

      {/* Main */}
      <div
        className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out
        ${isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"}
        ${isMobileOpen ? "ml-0" : ""}`}
      >
        {/* HEADER FIXED */}
        <AppHeader />

        {/* SCROLL AREA */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3 mx-auto max-w-(--breakpoint-2xl)">
            <Outlet />
          </div>
        </div>
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
