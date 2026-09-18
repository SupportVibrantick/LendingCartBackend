import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { jwtDecode } from "jwt-decode";
import { Menu, MoreHorizontal, X } from "lucide-react";
import { BROKER_API_BASE, getBrokerAuthHeaders } from "../lib/brokerApi";
import { handleBrokerUnauthorized } from "../lib/brokerSession";

const API_BASE = BROKER_API_BASE;

function getAuthHeaders(): Record<string, string> {
  return getBrokerAuthHeaders(true);
}

function toTitleCase(value?: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const AppHeader: React.FC = () => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [time, setTime] = useState("");

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const token = sessionStorage.getItem("broker_token");
  const decoded: any = token ? jwtDecode(token) : null;
  const isImpersonation = Boolean(decoded?.impersonatedBy);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const fetchAuthUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/broker/auth/me`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const json = await res.json();
      if (res.status === 401) {
        handleBrokerUnauthorized();
        return;
      }
      if (!res.ok || json.ok !== true) return;

      setUser(json.data);
    } catch (err) {
      console.error("Failed to load user:", err);
    }
  }, []);

  useEffect(() => {
    fetchAuthUser();

    const onProfileUpdated = () => fetchAuthUser();
    window.addEventListener("broker-profile-updated", onProfileUpdated);

    return () => {
      window.removeEventListener("broker-profile-updated", onProfileUpdated);
    };
  }, [fetchAuthUser]);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleString("en-US", { month: "short" });
      const year = now.getFullYear();
      const clock = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      setTime(`${day} ${month} ${year} , ${clock}`);
    };

    updateDateTime();
    const interval = window.setInterval(updateDateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleExitView = async () => {
    try {
      const impersonationToken = sessionStorage.getItem("broker_token");
      if (impersonationToken) {
        await fetch(`${API_BASE}/admin/auth/stop-impersonation`, {
          method: "POST",
          headers: { Authorization: `Bearer ${impersonationToken}` },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      sessionStorage.removeItem("broker_token");
      sessionStorage.removeItem("broker_user");
      sessionStorage.removeItem("roles");
      sessionStorage.removeItem("permissions");
      window.close();
      window.location.replace("about:blank");
    }
  };

  const displayName =
    user?.user?.firstName && user?.user?.lastName
      ? `${user.user.firstName} ${user.user.lastName}`
      : user?.user?.name || "Broker Admin";

  const orgName = user?.organization?.name;
  const welcomeName = toTitleCase(displayName);

  return (
    <header className="sticky top-0 z-[999] w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-16 items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 lg:h-10 lg:w-10"
            onClick={handleToggle}
            aria-label="Toggle sidebar"
          >
            {isMobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link to="/" className="shrink-0 lg:hidden">
            <img
              src="/loanAutomation.jpeg"
              alt="Logo"
              className="h-9 w-9 rounded-full ring-2 ring-[#13538A]/15"
            />
          </Link>

          <div className="hidden min-w-0 lg:block">
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
              Welcome{" "}
              <span className="text-[#3e86b7] dark:text-[#5ba8d4]">
                {welcomeName}
              </span>
            </h1>
            {orgName ? (
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {orgName}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
            aria-label="Open header menu"
            aria-expanded={isMobileMenuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:gap-3 lg:flex">
          {isImpersonation ? (
            <button
              type="button"
              onClick={handleExitView}
              className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600"
            >
              Exit view
            </button>
          ) : null}

          <span className="whitespace-nowrap text-sm font-semibold text-[#3e86b7] dark:text-[#5ba8d4]">
            {time}
          </span>

          <ThemeToggleButton />
          <NotificationDropdown />
          <UserDropdown user={user} compact />
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 dark:border-gray-800 lg:hidden">
          <div className="mb-2.5">
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">
              Welcome{" "}
              <span className="text-[#3e86b7] dark:text-[#5ba8d4]">
                {welcomeName}
              </span>
            </h1>
            {orgName ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{orgName}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#3e86b7] dark:text-[#5ba8d4]">
              {time}
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggleButton />
              <NotificationDropdown />
              <UserDropdown user={user} compact />
            </div>
          </div>

          {isImpersonation ? (
            <button
              type="button"
              onClick={handleExitView}
              className="mt-2.5 w-full rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
            >
              Exit view mode
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
};

export default AppHeader;
