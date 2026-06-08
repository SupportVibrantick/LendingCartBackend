import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { AdminPermissionsProvider } from "../context/AdminPermissionsContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import PermissionGuard from "../components/auth/PermissionGuard";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex">
      <div className="shrink-0">
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <main className="mx-auto w-full max-w-(--breakpoint-2xl) flex-1 p-3 md:p-4 lg:p-6">
          <PermissionGuard>
            <Outlet />
          </PermissionGuard>
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <AdminPermissionsProvider>
      <SidebarProvider>
        <LayoutContent />
      </SidebarProvider>
    </AdminPermissionsProvider>
  );
};

export default AppLayout;
