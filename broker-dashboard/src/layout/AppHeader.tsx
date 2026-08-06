import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import {
  GlobalSearchField,
  GlobalSearchProvider,
} from "../components/header/GlobalSearch";
import { jwtDecode } from "jwt-decode";
import { CalendarDays, Menu, Search, X } from "lucide-react";
import { BROKER_API_BASE, getBrokerAuthHeaders } from "../lib/brokerApi";
import {
  handleBrokerUnauthorized,
} from "../lib/brokerSession";

const API_BASE = BROKER_API_BASE;
const ADMIN_URI = import.meta.env.VITE_ADMIN_URI || "http://localhost:5174";

function getAuthHeaders(): Record<string, string> {
  return getBrokerAuthHeaders(true);
}

const AppHeader: React.FC = () => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [timeLabel, setTimeLabel] = useState("");

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const token = sessionStorage.getItem("broker_token");
  const decoded: any = token ? jwtDecode(token) : null;
  const isImpersonation = decoded?.impersonatedBy;

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

  const toTitleCase = (value?: string) =>
    value
      ? value
          .toLowerCase()
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "";

  useEffect(() => {
    fetchAuthUser();

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        const target =
          window.innerWidth >= 1024 ? inputRef.current : mobileInputRef.current;
        target?.focus();
      }
    };

    const onProfileUpdated = () => fetchAuthUser();

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("broker-profile-updated", onProfileUpdated);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("broker-profile-updated", onProfileUpdated);
    };
  }, [fetchAuthUser]);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setDateLabel(
        now.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      );
      setTimeLabel(
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleExitView = async () => {
    try {
      const impersonationToken = sessionStorage.getItem("broker_token");
      const res = await fetch(`${API_BASE}/admin/auth/stop-impersonation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${impersonationToken}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error("Failed to stop impersonation");
      }

      sessionStorage.removeItem("broker_token");
      sessionStorage.removeItem("broker_user");
      sessionStorage.removeItem("roles");
      sessionStorage.removeItem("permissions");
      sessionStorage.setItem("admin_token", json.token);
      window.location.href = `${ADMIN_URI}`;
    } catch (err) {
      console.error(err);
    }
  };

  const displayName =
    user?.user?.firstName && user?.user?.lastName
      ? `${user.user.firstName} ${user.user.lastName}`
      : user?.user?.name || "Broker Admin";

  const orgName = user?.organization?.name;

  return (
    <GlobalSearchProvider>
    <header className="sticky top-0 z-[999] w-full border-b border-gray-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 dark:border-gray-800 dark:bg-gray-900/95 dark:shadow-none">
      <div className="flex h-16 items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        {/* Left: sidebar + greeting */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 lg:h-10 lg:w-10"
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
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              Welcome back
            </p>
            <p className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-white">
              {toTitleCase(displayName)}
            </p>
            {orgName && (
              <p className="truncate text-xs leading-tight text-gray-500 dark:text-gray-400">
                {orgName}
              </p>
            )}
          </div>
        </div>

        {/* Center: search (desktop) */}
        <form
          className="mx-auto hidden min-w-0 flex-1 lg:block lg:max-w-xl xl:max-w-2xl"
          onSubmit={(e) => e.preventDefault()}
        >
          <GlobalSearchField inputRef={inputRef} />
        </form>

        {/* Right: actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
          {isImpersonation && (
            <button
              type="button"
              onClick={handleExitView}
              className="hidden rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 sm:inline-flex"
            >
              Exit view
            </button>
          )}

          <div
            className="hidden items-center gap-2 rounded-xl border border-gray-200/80 bg-gray-50/70 px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800/70 xl:flex"
            title={`${dateLabel} ${timeLabel}`}
          >
            <CalendarDays size={15} className="shrink-0 text-[#13538A]" />
            <div className="leading-none">
              <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                {dateLabel}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">{timeLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-gray-200/80 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="[&>button]:h-9 [&>button]:w-9 [&>button]:rounded-lg [&>button]:border-0 [&>button]:bg-transparent [&>button]:shadow-none [&>button]:hover:bg-gray-100 dark:[&>button]:hover:bg-gray-800">
              <ThemeToggleButton />
            </div>
            <div className="[&>div>button]:h-9 [&>div>button]:w-9 [&>div>button]:rounded-lg [&>div>button]:border-0 [&>div>button]:bg-transparent [&>div>button]:shadow-none [&>div>button]:hover:bg-gray-100 dark:[&>div>button]:hover:bg-gray-800 [&_button.dropdown-toggle]:h-9 [&_button.dropdown-toggle]:w-9 [&_button.dropdown-toggle]:rounded-lg [&_button.dropdown-toggle]:border-0 [&_button.dropdown-toggle]:bg-transparent">
              <NotificationDropdown />
            </div>
          </div>

          <UserDropdown user={user} compact />

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
            aria-label="Open header menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* Mobile: greeting + search panel */}
      {isMobileMenuOpen && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 dark:border-gray-800 lg:hidden">
          <div className="mb-2.5 lg:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              Welcome back
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {toTitleCase(displayName)}
            </p>
            {orgName && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{orgName}</p>
            )}
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            <GlobalSearchField inputRef={mobileInputRef} />
          </form>

          {isImpersonation && (
            <button
              type="button"
              onClick={handleExitView}
              className="mt-2.5 w-full rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600 sm:hidden"
            >
              Exit view mode
            </button>
          )}
        </div>
      )}
    </header>
    </GlobalSearchProvider>
  );
};

export default AppHeader;
