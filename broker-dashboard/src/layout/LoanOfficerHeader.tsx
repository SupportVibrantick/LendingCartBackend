import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { CalendarClock, Menu, MoreHorizontal, X } from "lucide-react";
import {
  LO_API_BASE,
  LO_PROFILE_UPDATED_EVENT,
  LO_USER_KEY,
  exitLoanOfficerImpersonation,
  isLoanOfficerImpersonationSession,
  loAuthHeaders,
} from "../lib/loanOfficerApi";
import LoanOfficerNotificationDropdown from "../components/header/LoanOfficerNotificationDropdown";
import LoanOfficerUserDropdown from "../components/header/LoanOfficerUserDropdown";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import { useSidebar } from "../context/SidebarContext";
import { hasPermission } from "../lib/brokerPermissions";

type LoHeaderUser = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImage?: string | null;
  organizationName?: string | null;
  organization?: { name?: string | null } | null;
  user?: LoHeaderUser;
};

function toTitleCase(value?: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveDisplayName(user: LoHeaderUser | null) {
  if (!user) return "Loan Officer";
  const source =
    user.user && !(user.firstName || user.lastName || user.name)
      ? user.user
      : user;
  if (source.name?.trim()) return source.name.trim();
  const combined = `${source.firstName || ""} ${source.lastName || ""}`.trim();
  return combined || "Loan Officer";
}

function readStoredUser(): LoHeaderUser | null {
  try {
    const raw = sessionStorage.getItem(LO_USER_KEY);
    return raw ? (JSON.parse(raw) as LoHeaderUser) : null;
  } catch {
    return null;
  }
}

function resolvePageTitle(pathname: string) {
  if (
    pathname === "/loan-officer" ||
    pathname === "/loan-officer/" ||
    pathname.startsWith("/loan-officer/dashboard")
  ) {
    return "Dashboard";
  }
  if (
    pathname.startsWith("/loan-officer/loan-pipeline") ||
    pathname.startsWith("/loan-officer/loan-pipeline-preview")
  ) {
    return "Loan Pipeline";
  }
  if (pathname.startsWith("/loan-officer/loan-application")) {
    return "New Application";
  }
  if (pathname.startsWith("/loan-officer/lender-marketplace")) {
    return "Lender Marketplace";
  }
  if (pathname.startsWith("/loan-officer/co-brokers")) return "Co Brokers";
  if (pathname.startsWith("/loan-officer/borrowers")) return "Borrowers";
  if (pathname.startsWith("/loan-officer/contacts")) return "Contacts";
  if (pathname.startsWith("/loan-officer/documents")) return "Documents";
  if (pathname.startsWith("/loan-officer/commissions")) return "Commissions";
  if (pathname.startsWith("/loan-officer/invoices")) return "Invoices";
  if (pathname.startsWith("/loan-officer/banking")) return "Banking";
  if (pathname.startsWith("/loan-officer/messages")) return "Messages";
  if (pathname.startsWith("/loan-officer/email-marketing")) {
    return "Email Marketing";
  }
  if (pathname.startsWith("/loan-officer/settings/branding")) return "Branding";
  if (pathname.startsWith("/loan-officer/settings/integrations")) {
    return "Integrations";
  }
  if (pathname.startsWith("/loan-officer/settings")) return "Settings";
  if (pathname.startsWith("/loan-officer/admin-logs")) return "Admin Logs";
  if (pathname.startsWith("/loan-officer/profile")) return "Profile";
  return "Officer Portal";
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

export default function LoanOfficerHeader() {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [user, setUser] = useState<LoHeaderUser | null>(() => readStoredUser());
  const [dateTime, setDateTime] = useState(() =>
    formatHeaderDateTime(new Date()),
  );

  const location = useLocation();
  const pageTitle = resolvePageTitle(location.pathname);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const isImpersonation = isLoanOfficerImpersonationSession();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const fetchAuthUser = useCallback(async () => {
    try {
      const res = await fetch(`${LO_API_BASE}/loanofficer/auth/me`, {
        method: "GET",
        headers: loAuthHeaders(false),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.data) return;

      const payload = json.data;
      const apiUser = (payload.user || payload) as LoHeaderUser;
      const orgName =
        payload.organization?.name ||
        apiUser.organizationName ||
        apiUser.organization?.name ||
        null;

      const nextUser: LoHeaderUser = {
        ...apiUser,
        organizationName: orgName,
        organization: payload.organization || apiUser.organization || null,
      };

      setUser(nextUser);
      try {
        const existing = readStoredUser() || {};
        sessionStorage.setItem(
          LO_USER_KEY,
          JSON.stringify({ ...existing, ...nextUser }),
        );
      } catch {
        /* ignore */
      }
    } catch {
      /* keep stored user */
    }
  }, []);

  useEffect(() => {
    void fetchAuthUser();

    const onProfileUpdated = () => {
      setUser(readStoredUser());
      void fetchAuthUser();
    };

    window.addEventListener(LO_PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () =>
      window.removeEventListener(LO_PROFILE_UPDATED_EVENT, onProfileUpdated);
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

  const welcomeName = toTitleCase(resolveDisplayName(user));
  const orgName =
    user?.organizationName || user?.organization?.name || null;
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

          <Link to="/loan-officer/dashboard" className="shrink-0 lg:hidden">
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
              <span className="inline-flex shrink-0 items-center rounded-full border border-[#4C78F5]/20 bg-[#4C78F5]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4C78F5]">
                Officer
              </span>
              <span className="truncate text-[12px] font-medium text-text-secondary">
                {contextLabel}
              </span>
            </div>
          </div>

          {isImpersonation ? (
            <button
              type="button"
              onClick={exitLoanOfficerImpersonation}
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
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#4C78F5]/20 bg-[#4C78F5]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4C78F5]">
              Officer
            </span>
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
            {hasPermission("SEND_NOTIFICATIONS", "loanOfficer") ? (
              <LoanOfficerNotificationDropdown />
            ) : null}
            <LoanOfficerUserDropdown user={user} />
          </div>

          {isImpersonation ? (
            <button
              type="button"
              onClick={exitLoanOfficerImpersonation}
              className="h-9 rounded-lg bg-rose-500 px-3 text-[11px] font-semibold text-white transition hover:bg-rose-600 sm:hidden"
            >
              Exit view mode
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
