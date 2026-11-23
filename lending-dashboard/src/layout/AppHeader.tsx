import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { CalendarClock } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import { UserDropdown } from "../components/header/UserDropdown";
import { jwtDecode } from "jwt-decode";
import { API_BASE, fetchLenderAuthMe } from "../lib/lenderApi";
import { handleLenderUnauthorized } from "../lib/lenderSession";
import {
  getLenderRoles,
  getRoleOption,
  roleBadgeClass,
  type LenderTeamRole,
} from "../lib/lenderTeamMembers";

const ROLE_PRIORITY: LenderTeamRole[] = [
  "LENDER_ADMIN",
  "LENDER_UNDERWRITER",
  "LENDER_ANALYST",
  "LENDER_VIEWER",
];

function resolvePrimaryRole(roles?: string[] | null): LenderTeamRole | null {
  const list = Array.isArray(roles) && roles.length ? roles : getLenderRoles();
  for (const role of ROLE_PRIORITY) {
    if (list.includes(role)) return role;
  }
  const first = list.find((role) => role.startsWith("LENDER_"));
  return (first as LenderTeamRole) || null;
}

function resolvePageTitle(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (
    pathname.startsWith("/loan-pipeline") ||
    pathname.startsWith("/loan-preview") ||
    pathname.startsWith("/loi-")
  )
    return "Loan Pipeline";
  if (
    pathname.startsWith("/all-loan-products") ||
    pathname.startsWith("/add-loan-product") ||
    pathname.startsWith("/update-loan-product") ||
    pathname.startsWith("/assigned-products") ||
    pathname.startsWith("/lender-assigned")
  )
    return "Loan Programs";
  if (
    pathname.startsWith("/brokers") ||
    pathname.startsWith("/broker") ||
    pathname.startsWith("/find-broker") ||
    pathname.startsWith("/my-broker")
  )
    return "Brokers";
  if (pathname.startsWith("/documents") || pathname.startsWith("/sign-form"))
    return "Documents";
  if (pathname.startsWith("/team-members")) return "Users";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/account")) return "Account";
  return "Lender Portal";
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
  const [dateTime, setDateTime] = useState(() => formatHeaderDateTime(new Date()));
  const location = useLocation();
  const pageTitle = resolvePageTitle(location.pathname);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const token = sessionStorage.getItem("lender_token");
  const decoded: any = token ? jwtDecode(token) : null;
  const isImpersonation = decoded?.impersonatedBy;

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  const fetchAuthUser = async (isActive?: () => boolean) => {
    try {
      const result = await fetchLenderAuthMe();
      if (isActive && !isActive()) return;

      if (result.status === 401) {
        handleLenderUnauthorized(
          typeof result.json.message === "string"
            ? result.json.message
            : undefined,
        );
        return;
      }

      if (!result.ok) {
        console.error("Failed to load user:", result.status);
        return;
      }

      const payload = result.data;
      setUser(payload);

      const roles = payload?.user?.roles;
      if (Array.isArray(roles)) {
        sessionStorage.setItem("roles", JSON.stringify(roles));
      }
      if (payload?.user) {
        sessionStorage.setItem("lender_user", JSON.stringify(payload.user));
      }
    } catch (err) {
      if (isActive && !isActive()) return;
      console.error("Failed to load user:", err);
    }
  };

  const primaryRole = useMemo(
    () => resolvePrimaryRole(user?.user?.roles),
    [user?.user?.roles],
  );
  const roleOption = getRoleOption(primaryRole);

  useEffect(() => {
    let active = true;
    void fetchAuthUser(() => active);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const tick = () => setDateTime(formatHeaderDateTime(new Date()));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleExitView = async () => {
    try {
      const impersonationToken = sessionStorage.getItem("lender_token");
      if (impersonationToken) {
        const lenderStop = await fetch(
          `${API_BASE}/lender/auth/stop-impersonation`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${impersonationToken}`,
            },
          },
        );

        if (lenderStop.ok) {
          const json = await lenderStop.json().catch(() => ({}));
          if (json?.token) {
            sessionStorage.setItem("lender_token", json.token);
            if (json.user) {
              sessionStorage.setItem("lender_user", JSON.stringify(json.user));
              if (Array.isArray(json.user.roles)) {
                sessionStorage.setItem(
                  "roles",
                  JSON.stringify(json.user.roles),
                );
              }
            }
            window.location.replace(json.redirectTo || "/team-members");
            return;
          }
        }

        await fetch(`${API_BASE}/admin/auth/stop-impersonation`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${impersonationToken}`,
          },
        }).catch(() => null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      sessionStorage.removeItem("lender_token");
      sessionStorage.removeItem("lender_user");
      sessionStorage.removeItem("roles");
      sessionStorage.removeItem("permissions");
      window.close();
      window.setTimeout(() => {
        window.location.replace("/signin");
      }, 150);
    }
  };

  return (
    <header className="relative z-40 flex h-16 w-full shrink-0 border-b border-border bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex w-full items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface dark:border-gray-700 dark:text-gray-300"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.22 7.28a.75.75 0 0 1 1.06-1.06L12 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L13.06 12l4.72 4.72a.75.75 0 1 1-1.06 1.06L12 13.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L10.94 12 6.22 7.28Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg width="18" height="14" viewBox="0 0 16 12" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0.58 1C0.58 0.59 0.92 0.25 1.33 0.25H14.67C15.08 0.25 15.42 0.59 15.42 1C15.42 1.41 15.08 1.75 14.67 1.75H1.33C0.92 1.75 0.58 1.41 0.58 1ZM0.58 11C0.58 10.59 0.92 10.25 1.33 10.25H14.67C15.08 10.25 15.42 10.59 15.42 11C15.42 11.41 15.08 11.75 14.67 11.75H1.33C0.92 11.75 0.58 11.41 0.58 11ZM1.33 5.25C0.92 5.25 0.58 5.59 0.58 6C0.58 6.41 0.92 6.75 1.33 6.75H8C8.41 6.75 8.75 6.41 8.75 6C8.75 5.59 8.41 5.25 8 5.25H1.33Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>

          <Link to="/" className="lg:hidden">
            <img
              className="h-9 w-9 rounded-full object-cover"
              src="/loanAutomation.jpeg"
              alt="Logo"
            />
          </Link>

          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-text-primary dark:text-white sm:text-base">
              {pageTitle}
            </h1>
            {roleOption || user?.organization?.name ? (
              <div className="mt-0.5 hidden items-center gap-2 sm:flex">
                {roleOption ? (
                  <span
                    title={roleOption.description}
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${roleBadgeClass(primaryRole)}`}
                  >
                    {roleOption.label}
                  </span>
                ) : null}
                {user?.organization?.name ? (
                  <span className="truncate text-[12px] text-text-secondary">
                    {user.organization.name}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {isImpersonation ? (
            <button
              onClick={handleExitView}
              className="ml-1 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600"
            >
              Exit View Mode
            </button>
          ) : null}
        </div>

        <button
          onClick={toggleApplicationMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary hover:bg-surface lg:hidden"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M6 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
              fill="currentColor"
            />
          </svg>
        </button>

        <div
          className={`${
            isApplicationMenuOpen ? "flex" : "hidden"
          } absolute top-16 right-3 left-3 z-50 items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 shadow-lg lg:static lg:flex lg:justify-end lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-brand-500 sm:text-[13px]">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <time dateTime={new Date().toISOString()} className="whitespace-nowrap tabular-nums">
              {dateTime}
            </time>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <ThemeToggleButton />
            <NotificationDropdown />
            <UserDropdown user={user} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
