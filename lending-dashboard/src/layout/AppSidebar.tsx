import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ChevronDown,
  FileText,
  Handshake,
  LayoutDashboard,
  Layers,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { canManageTeam } from "../lib/lenderPermissions";
import { clearLenderSession } from "../lib/lenderSession";
import {
  getLenderRoles,
  getRoleOption,
  type LenderTeamRole,
} from "../lib/lenderTeamMembers";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  matchPaths?: string[];
  subItems?: NavItem[];
  adminOnly?: boolean;
};

const allNavItems: NavItem[] = [
  {
    icon: <LayoutDashboard size={18} strokeWidth={1.75} />,
    name: "Dashboard",
    path: "/",
    matchPaths: ["/"],
  },
  {
    icon: <TrendingUp size={18} strokeWidth={1.75} />,
    name: "Loan Pipeline",
    path: "/loan-pipeline",
    matchPaths: [
      "/loan-pipeline",
      "/loan-preview",
      "/loi-preview",
      "/loi-form",
    ],
  },
  {
    icon: <Layers size={18} strokeWidth={1.75} />,
    name: "Loan Programs",
    path: "/all-loan-products",
    matchPaths: [
      "/all-loan-products",
      "/add-loan-product",
      "/update-loan-product",
      "/lender-assigned-products",
      "/assigned-products",
    ],
  },
  {
    icon: <Handshake size={18} strokeWidth={1.75} />,
    name: "Brokers",
    path: "/brokers",
    matchPaths: ["/brokers", "/broker-request", "/my-broker", "/find-broker"],
  },
  {
    icon: <FileText size={18} strokeWidth={1.75} />,
    name: "Documents",
    adminOnly: true,
    matchPaths: ["/documents", "/sign-form-templates"],
    subItems: [
      { name: "Product documents", path: "/documents" },
      { name: "Form templates", path: "/sign-form-templates" },
    ],
  },
  {
    icon: <Users size={18} strokeWidth={1.75} />,
    name: "Users",
    path: "/team-members",
    adminOnly: true,
    matchPaths: ["/team-members"],
  },
  {
    icon: <Settings size={18} strokeWidth={1.75} />,
    name: "Settings",
    adminOnly: true,
    matchPaths: ["/settings/branding"],
    subItems: [{ name: "Branding", path: "/settings/branding" }],
  },
  {
    icon: <UserRound size={18} strokeWidth={1.75} />,
    name: "Profile",
    path: "/profile",
    matchPaths: ["/profile", "/profile/edit", "/profile/guidelines"],
  },
];

const filterLenderNavItems = (items: NavItem[]): NavItem[] => {
  const isAdmin = canManageTeam();

  return items
    .map((item) => {
      if (item.adminOnly && !isAdmin) return null;

      if (item.subItems?.length) {
        const subItems = filterLenderNavItems(item.subItems);
        if (!subItems.length) return null;
        return { ...item, subItems };
      }

      return item;
    })
    .filter((item): item is NavItem => item !== null);
};

const ROLE_PRIORITY: LenderTeamRole[] = [
  "LENDER_ADMIN",
  "LENDER_UNDERWRITER",
  "LENDER_ANALYST",
  "LENDER_VIEWER",
];

function readSidebarUser() {
  try {
    const raw = sessionStorage.getItem("lender_user");
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return null;
  }
}

function resolvePrimaryRole(roles?: string[] | null): LenderTeamRole | null {
  const list = Array.isArray(roles) && roles.length ? roles : getLenderRoles();
  for (const role of ROLE_PRIORITY) {
    if (list.includes(role)) return role;
  }
  const first = list.find((role) => role.startsWith("LENDER_"));
  return (first as LenderTeamRole) || null;
}

function getUserInitials(firstName?: string, lastName?: string, fallback = "U") {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return `${first}${last}`.toUpperCase() || fallback;
}

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
    toggleSidebar,
  } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const visibleNavItems = useMemo(() => filterLenderNavItems(allNavItems), []);

  const sidebarUser = useMemo(() => {
    const stored = readSidebarUser();
    const firstName = stored?.firstName || stored?.user?.firstName || "";
    const lastName = stored?.lastName || stored?.user?.lastName || "";
    const name =
      `${firstName} ${lastName}`.trim() ||
      stored?.name ||
      stored?.user?.name ||
      "Lender User";
    const orgName =
      stored?.organization?.name ||
      stored?.organizationName ||
      stored?.user?.organization?.name ||
      "Lender Portal";
    const roles = Array.isArray(stored?.roles)
      ? stored.roles
      : Array.isArray(stored?.user?.roles)
        ? stored.user.roles
        : getLenderRoles();
    const primaryRole = resolvePrimaryRole(roles);
    const roleLabel = getRoleOption(primaryRole)?.label || "Member";

    return {
      name,
      orgName,
      roleLabel,
      initials: getUserInitials(firstName, lastName, name.charAt(0) || "U"),
    };
  }, [location.pathname]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [userMenuOpen]);

  const handleSignOut = () => {
    setUserMenuOpen(false);
    try {
      clearLenderSession();
    } catch {
      // ignore storage errors
    }
    navigate("/signin");
  };

  const isPathActive = useCallback(
    (path?: string, matchPaths?: string[]) => {
      const paths = matchPaths?.length ? matchPaths : path ? [path] : [];

      return paths.some((candidate) => {
        if (candidate === "/") return location.pathname === "/";
        return (
          location.pathname === candidate ||
          location.pathname.startsWith(`${candidate}/`)
        );
      });
    },
    [location.pathname],
  );

  const hasActiveChild = useCallback(
    (items?: NavItem[]): boolean => {
      if (!items) return false;
      return items.some((item) => {
        if (isPathActive(item.path, item.matchPaths)) return true;
        if (item.subItems) return hasActiveChild(item.subItems);
        return false;
      });
    },
    [isPathActive],
  );

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    const findActiveMenus = (
      items: NavItem[],
      parentKey = "",
    ): Record<string, boolean> => {
      const result: Record<string, boolean> = {};

      items.forEach((item, index) => {
        const key = parentKey ? `${parentKey}-${index}` : `main-${index}`;

        if (item.subItems) {
          if (hasActiveChild(item.subItems)) {
            result[key] = true;
          }
          Object.assign(result, findActiveMenus(item.subItems, key));
        }
      });

      return result;
    };

    setOpenMenus(findActiveMenus(visibleNavItems));
  }, [location.pathname, visibleNavItems, hasActiveChild]);

  const showLabels = isExpanded || isHovered || isMobileOpen;
  const isDesktopCollapsed = !isExpanded && !isMobileOpen;

  const renderMenuItems = (
    items: NavItem[],
    menuType: "main" = "main",
    level = 0,
    parentKey = "",
  ) => (
    <ul
      className={`flex flex-col gap-0.5 ${
        level > 0 ? "ml-3 mt-1 border-l border-border pl-2" : ""
      }`}
    >
      {items.map((nav, index) => {
        const key = parentKey
          ? `${parentKey}-${index}`
          : `${menuType}-${index}`;
        const isOpen = openMenus[key];
        const childActive = nav.subItems ? hasActiveChild(nav.subItems) : false;
        const linkActive = isPathActive(nav.path, nav.matchPaths);

        return (
          <li key={key}>
            {nav.subItems ? (
              <>
                <button
                  type="button"
                  onClick={() => toggleMenu(key)}
                  title={!showLabels ? nav.name : undefined}
                  className={`menu-item group ${
                    childActive
                      ? "bg-brand-50 text-brand-600 hover:bg-brand-50 dark:bg-brand-500/15 dark:text-brand-300"
                      : isOpen
                        ? "bg-surface text-text-primary"
                        : "menu-item-inactive"
                  } ${!showLabels ? "justify-center px-2" : ""}`}
                >
                  {nav.icon ? (
                    <span
                      className={`menu-item-icon-size ${
                        childActive
                          ? "text-brand-600 dark:text-brand-300"
                          : "menu-item-icon-inactive"
                      }`}
                    >
                      {nav.icon}
                    </span>
                  ) : null}

                  {showLabels ? (
                    <>
                      <span className="menu-item-text">{nav.name}</span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        } ${
                          childActive
                            ? "text-brand-500"
                            : "text-text-secondary"
                        }`}
                      />
                    </>
                  ) : null}
                </button>

                {showLabels ? (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen ? "mt-0.5 max-h-[1000px]" : "max-h-0"
                    }`}
                  >
                    {renderMenuItems(nav.subItems, menuType, level + 1, key)}
                  </div>
                ) : null}
              </>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  title={!showLabels ? nav.name : undefined}
                  className={`menu-item group ${
                    linkActive ? "menu-item-active" : "menu-item-inactive"
                  } ${level > 0 ? "menu-item-nested" : ""} ${
                    !showLabels && level === 0 ? "justify-center px-2" : ""
                  }`}
                >
                  {nav.icon ? (
                    <span
                      className={`menu-item-icon-size ${
                        linkActive
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                      }`}
                    >
                      {nav.icon}
                    </span>
                  ) : level > 0 ? (
                    <span
                      className={`ml-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        linkActive ? "bg-white" : "bg-brand-500/40"
                      }`}
                    />
                  ) : null}

                  {showLabels ? (
                    <span className="menu-item-text">{nav.name}</span>
                  ) : null}
                </Link>
              )
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-[calc(100vh-4rem)] flex-col border-r border-border bg-white text-text-primary transition-all duration-300 ease-in-out lg:mt-0 lg:h-screen
        ${
          isExpanded || isMobileOpen
            ? "w-[260px]"
            : isHovered
              ? "w-[260px]"
              : "w-[84px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => {
        if (isDesktopCollapsed) setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex shrink-0 items-center border-b border-border ${
          showLabels ? "gap-2 px-3 py-4" : "justify-center px-2 py-4"
        }`}
      >
        <Link
          to="/"
          className={`min-w-0 ${showLabels ? "flex-1" : ""}`}
          title="LoanAutomation Lender Suite"
        >
          {showLabels ? (
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500 ring-2 ring-brand-100">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold tracking-tight text-text-primary">
                  LoanAutomation
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Lender Suite
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-500 ring-2 ring-brand-100">
              <img
                src="/loanAutomation.jpeg"
                alt="Logo"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </Link>

        {showLabels ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsHovered(false);
              toggleSidebar();
            }}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:bg-surface hover:text-brand-500 lg:inline-flex"
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? (
              <PanelLeftClose size={16} strokeWidth={1.75} />
            ) : (
              <PanelLeftOpen size={16} strokeWidth={1.75} />
            )}
          </button>
        ) : null}
      </div>

      <div className="sidebar-scrollbar-light min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3">
        <nav>
          <h2
            className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary ${
              !showLabels ? "lg:text-center" : ""
            }`}
          >
            {showLabels ? (
              "Lender Workspace"
            ) : (
              <HorizontaLDots className="mx-auto size-5 text-slate-300" />
            )}
          </h2>

          {renderMenuItems(visibleNavItems)}
        </nav>
      </div>

      <div
        ref={userMenuRef}
        className={`relative shrink-0 border-t border-border ${
          showLabels ? "p-3" : "px-2 py-3"
        }`}
      >
        {userMenuOpen ? (
          <div
            className={`absolute bottom-[calc(100%-2px)] z-50 overflow-hidden rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900 ${
              showLabels
                ? "right-3 left-3"
                : "left-1/2 w-40 -translate-x-1/2"
            }`}
          >
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogOut size={15} strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        ) : null}

        {showLabels ? (
          <button
            type="button"
            onClick={() => setUserMenuOpen((open) => !open)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-white px-2.5 py-2 text-left transition hover:bg-surface dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
              {sidebarUser.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-text-primary">
                {sidebarUser.name}
              </span>
              <span className="block truncate text-[11px] text-text-secondary">
                {sidebarUser.roleLabel} · {sidebarUser.orgName}
              </span>
            </span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-text-secondary transition ${
                userMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white"
              title={sidebarUser.name}
              aria-label="Account menu"
              aria-expanded={userMenuOpen}
            >
              {sidebarUser.initials}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsHovered(false);
                toggleSidebar();
              }}
              className="hidden h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:bg-surface hover:text-brand-500 lg:flex"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={16} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
