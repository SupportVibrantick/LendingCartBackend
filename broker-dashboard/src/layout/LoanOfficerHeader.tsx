import { Menu } from "lucide-react";
import { LO_USER_KEY } from "../lib/loanOfficerApi";
import LoanOfficerNotificationDropdown from "../components/header/LoanOfficerNotificationDropdown";
import { useSidebar } from "../context/SidebarContext";
import { hasPermission } from "../lib/brokerPermissions";

export default function LoanOfficerHeader() {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const storedUser = JSON.parse(sessionStorage.getItem(LO_USER_KEY) || "{}");

  const displayName =
    storedUser?.name ||
    `${storedUser?.firstName || ""} ${storedUser?.lastName || ""}`.trim() ||
    "Loan Officer";

  const orgName = storedUser?.organizationName || storedUser?.organization?.name;

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95">
      <div className="flex h-14 items-center gap-3 px-4 lg:h-16 lg:px-6">
        <button
          type="button"
          onClick={handleToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          aria-label={isMobileOpen ? "Close menu" : "Open menu"}
        >
          <Menu size={18} />
        </button>

        <img
          src="/loanAutomation.jpeg"
          alt="Logo"
          className="h-8 w-8 rounded-full ring-2 ring-[#13538A]/15 lg:hidden"
        />

        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {displayName}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {orgName || "Loan Officer Portal"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasPermission("SEND_NOTIFICATIONS", "loanOfficer") ? (
            <LoanOfficerNotificationDropdown />
          ) : null}
        </div>
      </div>
    </header>
  );
}
