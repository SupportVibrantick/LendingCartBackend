import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { CalendarClock, Menu, MoreHorizontal, X } from "lucide-react";
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
  const [dateTime, setDateTime] = useState(() =>
    formatHeaderDateTime(new Date()),
  );
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
  const orgName = user?.organization?.name;

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

  useEffect(() => {
    setApplicationMenuOpen(false);
  }, [location.pathname]);

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
              className="h-8 w-8 rounded-full object-cover ring-2 ring-[#4C78F5]/15"
              src="/loanAutomation.jpeg"
              alt="Logo"
            />
          </Link>

          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-text-primary dark:text-white">
              {pageTitle}
            </h1>

            {(roleOption || orgName) && (
              <>
                <span
                  className="hidden h-4 w-px shrink-0 bg-border sm:block dark:bg-slate-700"
                  aria-hidden
                />
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  {roleOption ? (
                    <span
                      title={roleOption.description}
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${roleBadgeClass(primaryRole)}`}
                    >
                      {roleOption.label}
                    </span>
                  ) : null}
                  {orgName ? (
                    <span className="truncate text-[12px] font-medium text-text-secondary">
                      {orgName}
                    </span>
                  ) : null}
                </div>
              </>
            )}
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
          {(roleOption || orgName) && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:hidden">
              {roleOption ? (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${roleBadgeClass(primaryRole)}`}
                >
                  {roleOption.label}
                </span>
              ) : null}
              {orgName ? (
                <span className="truncate text-[12px] font-medium text-text-secondary">
                  {orgName}
                </span>
              ) : null}
            </div>
          )}

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
