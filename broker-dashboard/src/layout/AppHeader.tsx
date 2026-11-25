import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { CalendarClock, Menu, MoreHorizontal, X } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { jwtDecode } from "jwt-decode";
import { BROKER_API_BASE, getBrokerAuthHeaders } from "../lib/brokerApi";
import { handleBrokerUnauthorized } from "../lib/brokerSession";
import BrokerPlanBadge from "../components/subscription/BrokerPlanBadge";

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

function resolvePageTitle(pathname: string) {
  if (pathname === "/" || pathname === "") return "Dashboard";
  if (
    pathname.startsWith("/submit-applications") ||
    pathname.startsWith("/loan-preview") ||
    pathname.startsWith("/loi-")
  )
    return "Loan Pipeline";
  if (pathname.startsWith("/loan-application")) return "New Application";
  if (
    pathname.startsWith("/lender-marketplace") ||
    pathname.startsWith("/find-lender") ||
    pathname.startsWith("/my-lenders") ||
    pathname.startsWith("/invited-lenders")
  )
    return "Lender Marketplace";
  if (pathname.startsWith("/loan-officers")) return "Loan Officers";
  if (pathname.startsWith("/sub-brokers") || pathname.startsWith("/co-brokers"))
    return "Co Brokers";
  if (pathname.startsWith("/borrowers")) return "Borrowers";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname.startsWith("/commissions")) return "Commissions";
  if (pathname.startsWith("/payments/banking")) return "Banking";
  if (pathname.startsWith("/payments/invoices")) return "Invoices";
  if (pathname.startsWith("/payments/commissions")) return "Commissions";
  if (pathname.startsWith("/payments")) return "Payments";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/email-marketing")) return "Email Marketing";
  if (pathname.startsWith("/documents") || pathname.startsWith("/sign-form"))
    return "Documents";
  if (
    pathname.startsWith("/application") ||
    pathname.startsWith("/active-application") ||
    pathname.startsWith("/templates")
  )
    return "Applications";
  if (pathname.startsWith("/settings/branding")) return "Branding";
  if (pathname.startsWith("/settings/plan")) return "Plan & Add-ons";
  if (pathname.startsWith("/settings") || pathname.startsWith("/integrations"))
    return "Settings";
  if (pathname.startsWith("/profile") || pathname.startsWith("/account"))
    return "Profile";
  if (pathname.startsWith("/admin-logs")) return "Admin Logs";
  if (pathname.startsWith("/website-builder")) return "Website Builder";
  return "Broker Portal";
}

function formatHeaderDateTime(now: Date) {
  const day = now.getDate();
  const month = now.toLocaleString("en-US", { month: "short" });
  const year = now.getFullYear();
  const clock = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${month} ${year} · ${clock}`;
}

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [dateTime, setDateTime] = useState(() =>
    formatHeaderDateTime(new Date()),
  );

  const location = useLocation();
  const pageTitle = resolvePageTitle(location.pathname);
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
    const tick = () => setDateTime(formatHeaderDateTime(new Date()));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setApplicationMenuOpen(false);
  }, [location.pathname]);

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
  const contextLabel = orgName || `Welcome ${welcomeName}`;

  return (
    <header className="relative z-40 flex h-14 w-full shrink-0 border-b border-border bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex w-full items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
              isMobileOpen
                ? "bg-[#4C78F5] text-white"
                : "border border-border text-text-secondary hover:border-[#4C78F5]/30 hover:bg-[#4C78F5]/5 hover:text-[#4C78F5] dark:border-slate-700 dark:text-slate-300"
            }`}
            onClick={handleToggle}
            aria-label="Toggle sidebar"
          >
            {isMobileOpen ? <X size={17} /> : <Menu size={17} />}
          </button>

          <Link to="/" className="shrink-0 lg:hidden">
            <img
              src="/loanAutomation.jpeg"
              alt="Logo"
              className="h-8 w-8 rounded-full object-cover ring-2 ring-[#4C78F5]/15"
            />
          </Link>

          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-text-primary dark:text-white">
              {pageTitle}
            </h1>

            <span
              className="hidden h-4 w-px shrink-0 bg-border sm:block dark:bg-slate-700"
              aria-hidden
            />

            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <BrokerPlanBadge autoLoad />
              <span className="truncate text-[12px] font-medium text-text-secondary">
                {contextLabel}
              </span>
            </div>
          </div>

          {isImpersonation ? (
            <button
              type="button"
              onClick={handleExitView}
              className="ml-1 hidden h-8 items-center rounded-lg bg-rose-500 px-3 text-[11px] font-semibold text-white transition hover:bg-rose-600 sm:inline-flex"
            >
              Exit view mode
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setApplicationMenuOpen((open) => !open)}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition lg:hidden ${
            isApplicationMenuOpen
              ? "bg-[#4C78F5]/10 text-[#4C78F5]"
              : "text-text-secondary hover:bg-surface"
          }`}
          aria-label="Open header menu"
          aria-expanded={isApplicationMenuOpen}
        >
          <MoreHorizontal size={18} />
        </button>

        <div
          className={`${
            isApplicationMenuOpen ? "flex" : "hidden"
          } absolute top-14 right-3 left-3 z-50 flex-col gap-3 rounded-2xl border border-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between lg:static lg:flex lg:flex-row lg:items-center lg:justify-end lg:gap-2.5 lg:border-0 lg:bg-transparent lg:p-0 dark:lg:bg-transparent`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:hidden">
            <BrokerPlanBadge autoLoad />
            <span className="truncate text-[12px] font-medium text-text-secondary">
              {contextLabel}
            </span>
          </div>

          <div className="hidden h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[12px] font-medium text-text-secondary sm:inline-flex dark:border-slate-700 dark:bg-slate-950">
            <CalendarClock
              className="h-3.5 w-3.5 shrink-0 text-[#4C78F5]"
              strokeWidth={1.75}
            />
            <time
              dateTime={new Date().toISOString()}
              className="whitespace-nowrap tabular-nums"
            >
              {dateTime}
            </time>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggleButton />
            <NotificationDropdown />
            <UserDropdown user={user} />
          </div>

          {isImpersonation ? (
            <button
              type="button"
              onClick={handleExitView}
              className="h-9 rounded-lg bg-rose-500 px-3 text-[11px] font-semibold text-white transition hover:bg-rose-600 sm:hidden"
            >
              Exit view mode
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
