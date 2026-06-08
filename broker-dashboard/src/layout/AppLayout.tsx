import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="shrink-0">
        <AppSidebar />
        <Backdrop />
      </div>

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out
        ${isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"}
        ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1480px] p-4 md:p-6 lg:px-8">
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
