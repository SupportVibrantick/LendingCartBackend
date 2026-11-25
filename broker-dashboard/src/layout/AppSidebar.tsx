import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";

import { MdEmail } from "react-icons/md";
// import { FaAppStore } from "react-icons/fa6";
import { MdOutlineDocumentScanner } from "react-icons/md";
import { FaUsersBetweenLines, FaUserGroup } from "react-icons/fa6";
import { PiSecurityCameraFill } from "react-icons/pi";
import {
  ChevronDown,
  FolderOpen,
  LogOut,
  PanelLeftOpen,
  PlugZap,
  TrendingUp,
  //  MessageSquare
  Wallet,
} from "lucide-react";
import { MdSettings } from "react-icons/md";
import { CgProfile } from "react-icons/cg";
import {
  hasAnyPermission,
  isBrokerAdmin as sessionIsBrokerAdmin,
  ORG_ENTITLEMENTS_UPDATED_EVENT,
  type PermissionKey,
} from "../lib/brokerPermissions";
import { hydrateOrgEntitlements } from "../lib/brokerEntitlements";
import { clearBrokerSession } from "../lib/brokerSession";

function getUserInitials(
  firstName?: string,
  lastName?: string,
  fallback = "U",
) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return String(fallback || "U").slice(0, 2).toUpperCase();
}

function toTitleCase(value?: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveBrokerRoleLabel(roles: string[], isSubBroker: boolean) {
  if (roles.includes("BROKER_ADMIN")) return "Admin";
  if (roles.includes("BROKER_OFFICER")) return "Loan Officer";
  if (roles.includes("SUB_BROKER") || isSubBroker) return "Co-Broker";
  if (roles.includes("BROKER")) return "Broker";
  return "Member";
}

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  subItems?: NavItem[];
  permission?: PermissionKey | PermissionKey[];
  adminOnly?: boolean;
};

const filterBrokerNavItems = (items: NavItem[]): NavItem[] => {
  return items
    .map((item) => {
      if (item.adminOnly && !sessionIsBrokerAdmin("broker")) {
        return null;
      }

      if (item.subItems?.length) {
        const subItems = filterBrokerNavItems(item.subItems);
        if (!subItems.length) {
          return null;
        }

        return { ...item, subItems };
      }

      if (item.permission) {
        const required = Array.isArray(item.permission)
          ? item.permission
          : [item.permission];

        if (!hasAnyPermission(required, "broker")) {
          return null;
        }
      }

      return item;
    })
    .filter((item): item is NavItem => item !== null);
};

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
  const [isSubBroker, setIsSubBroker] = useState(false);
  const [isBrokerAdmin, setIsBrokerAdmin] = useState(false);
  const [entitlementsTick, setEntitlementsTick] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [userTick, setUserTick] = useState(0);

  useEffect(() => {
    void hydrateOrgEntitlements().then(() => {
      setEntitlementsTick((n) => n + 1);
    });
    const onEntitlements = () => setEntitlementsTick((n) => n + 1);
    const onProfileUpdated = () => setUserTick((n) => n + 1);
    window.addEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, onEntitlements);
    window.addEventListener("broker-profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, onEntitlements);
      window.removeEventListener("broker-profile-updated", onProfileUpdated);
    };
  }, []);

  useEffect(() => {
    const updateRole = () => {
      try {
        const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
        setIsSubBroker(user?.userType === "SUB_BROKER");
        try {
          const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
          setIsBrokerAdmin(roles.includes("BROKER_ADMIN"));
        } catch {
          setIsBrokerAdmin(false);
        }
      } catch {
        setIsSubBroker(false);
        setIsBrokerAdmin(false);
      }
    };

    updateRole();
    window.addEventListener("storage", updateRole);
    window.addEventListener("broker-profile-updated", updateRole);
    return () => {
      window.removeEventListener("storage", updateRole);
      window.removeEventListener("broker-profile-updated", updateRole);
    };
  }, []);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        icon: <GridIcon />,
        name: "Dashboard",
        path: "/",
      },
      {
        icon: <TrendingUp />,
        name: "Loan Pipeline",
        path: "/submit-applications",
        permission: "VIEW_PIPELINE",
      },
      // {
      //   icon: <MessageSquare />,
      //   name: "Messages",
      //   path: "/messages",
      // },
      ...(!isSubBroker
        ? [
          {
            icon: <MdOutlineDocumentScanner />,
            name: "New Loan Application",
            path: "/loan-application",
            permission: "CREATE_APPLICATION",
          },
        ]
        : []),
      ...(!isSubBroker
        ? [
          {
            icon: <PlugZap size={18} />,
            name: "GoHighLevel",
            path: "/settings/integrations/ghl",
            permission: "ACCESS_GOHIGHLEVEL",
          },
        ]
        : []),
     
      ...(isBrokerAdmin
        ? [
          {
            icon: <FaUserGroup />,
            name: "User Management",
            adminOnly: true,
            subItems: [
              {
                name: "Loan Officers",
                path: "/loan-officers",
                permission: "VIEW_LOAN_OFFICERS" as PermissionKey,
              },
              {
                name: "Co Brokers",
                path: "/sub-brokers",
                permission: "VIEW_CO_BROKERS" as PermissionKey,
              },
              {
                name: "Borrowers",
                path: "/borrowers",
                permission: "VIEW_BORROWERS" as PermissionKey,
              },
              {
                name: "Contacts",
                path: "/contacts-list",
                permission: "VIEW_CONTACTS" as PermissionKey,
              },
            ],
          },
        ]
        : []),
      ...(!isSubBroker
        ? [
          {
            icon: <FaUsersBetweenLines />,
            name: "Lender Marketplace",
            path: "/lender-marketplace",
            permission: "VIEW_LENDERS",
          },
        ]
        : []),
      ...(!isSubBroker
        ? [
          {
            icon: <FolderOpen size={18} />,
            name: "Documents",
            permission: "VIEW_TEMPLATES",
            subItems: [
              {
                name: "Custom Documents",
                path: "/documents/custom",
              },
            ],
          },
        ]
        : []),
      ...(!isSubBroker
        ? [
          {
            icon: <MdEmail />,
            name: "Email Marketing",
            path: "/email-marketing",
            permission: "MANAGE_SETTINGS",
          },
        ]
        : []),
        ...(!isSubBroker && isBrokerAdmin
          ? [
              {
                icon: <Wallet />,
                name: "Payments",
                adminOnly: true,
                subItems: [
                  {
                    name: "Commissions",
                    path: "/payments/commissions",
                    permission: "VIEW_COMMISSIONS" as PermissionKey,
                  },
                  {
                    name: "Invoices",
                    path: "/payments/invoices",
                    permission: "VIEW_INVOICES" as PermissionKey,
                  },
                  {
                    name: "Banking",
                    path: "/payments/banking",
                    permission: "VIEW_COMMISSIONS" as PermissionKey,
                  },
                ],
              },
            ]
          : []),
      ...(!isSubBroker
        ? [
          {
            icon: <MdSettings />,
            name: "Settings",
            subItems: [
              {
                name: "Branding",
                path: "/settings/branding",
                permission: "MANAGE_BRANDING" as PermissionKey,
              },
              {
                name: "Plan & Add-ons",
                path: "/settings/plan",
              },
              // {
              //   icon: <FaAppStore />,
              //   name: "Application Builder",
              //   subItems: [
              //     { name: "Create Application", path: "/create-application" },
              //     {
              //       name: "Loan Application Config",
              //       path: "/application-config",
              //     },
              //     { name: "Add Sections", path: "/add-section" },
              //     { name: "Application Builder", path: "/application" },
              //   ],
              // },
            ],
          },
        ]
        : []),
      ...(!isSubBroker
        ? [
          {
            icon: <PiSecurityCameraFill />,
            name: "Dashboard Logs",
            path: "/admin-logs",
            permission: "VIEW_DASHBOARD_LOGS",
          },
        ]
        : []),
      {
        icon: <CgProfile />,
        name: "Profile",
        path: "/profile",
      },
    ] as NavItem[],
    [isSubBroker, isBrokerAdmin],
  );

  const visibleNavItems = useMemo(
    () => filterBrokerNavItems(navItems),
    // Recompute when org package entitlements hydrate / change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navItems, entitlementsTick],
  );

  const isActive = useCallback(
    (path?: string) => {
      if (!path) return false;
      if (path === "/") return location.pathname === "/";
      return location.pathname.startsWith(path);
    },
    [location.pathname],
  );

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const hasActiveChild = (items?: NavItem[]): boolean => {
    if (!items) return false;

    return items.some((item) => {
      if (item.path && isActive(item.path)) return true;
      if (item.subItems) return hasActiveChild(item.subItems);
      return false;
    });
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
  }, [location.pathname, visibleNavItems]);

  const renderMenuItems = (
    items: NavItem[],
    menuType: "main" = "main",
    level = 0,
    parentKey = "",
  ) => (
    <ul
      className={`flex flex-col gap-0.5 ${level > 0 ? "ml-2 mt-1 border-l border-[#4C78F5]/15 pl-2.5 dark:border-[#4C78F5]/25" : ""}`}
    >
      {items.map((nav, index) => {
        const key = parentKey
          ? `${parentKey}-${index}`
          : `${menuType}-${index}`;
        const isOpen = openMenus[key];
        const childActive = nav.subItems ? hasActiveChild(nav.subItems) : false;
        const linkActive = nav.path ? isActive(nav.path) : false;

        return (
          <li key={key}>
            {nav.subItems ? (
              <>
                <button
                  type="button"
                  onClick={() => toggleMenu(key)}
                  className={`menu-item group ${childActive || isOpen
                      ? "menu-item-active"
                      : "menu-item-inactive"
                    }`}
                >
                  {nav.icon && (
                    <span
                      className={`menu-item-icon-size ${childActive || isOpen
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                        }`}
                    >
                      {nav.icon}
                    </span>
                  )}

                  {(isExpanded || isHovered || isMobileOpen) && (
                    <span className="menu-item-text">{nav.name}</span>
                  )}

                  {(isExpanded || isHovered || isMobileOpen) && (
                    <ChevronDownIcon
                      className={`ml-auto h-4 w-4 transition-all duration-200 ${isOpen
                          ? "rotate-180 text-[#4C78F5]"
                          : "text-gray-400 group-hover:text-gray-600"
                        }`}
                    />
                  )}
                </button>

                {(isExpanded || isHovered || isMobileOpen) && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${isOpen ? "mt-1 max-h-[1000px]" : "max-h-0"
                      }`}
                  >
                    {renderMenuItems(nav.subItems, menuType, level + 1, key)}
                  </div>
                )}
              </>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  className={`menu-item group ${linkActive ? "menu-item-active" : "menu-item-inactive"
                    } ${level > 0 ? "menu-item-nested" : ""}`}
                >
                  {nav.icon ? (
                    <span
                      className={`menu-item-icon-size ${linkActive
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                        }`}
                    >
                      {nav.icon}
                    </span>
                  ) : (
                    level > 0 && (
                      <span
                        className={`ml-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          linkActive ? "bg-brand-500" : "bg-brand-500/35"
                        }`}
                      />
                    )
                  )}

                  {(isExpanded || isHovered || isMobileOpen) && (
                    <span className="menu-item-text">{nav.name}</span>
                  )}
                </Link>
              )
            )}
          </li>
        );
      })}
    </ul>
  );

  const showLabels = isExpanded || isHovered || isMobileOpen;

  const sidebarUser = useMemo(() => {
    let stored: any = {};
    try {
      stored = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
    } catch {
      stored = {};
    }

    const user = stored?.user || stored || {};
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const name =
      `${firstName} ${lastName}`.trim() ||
      user.name ||
      sessionStorage.getItem("broker_user_name") ||
      "Broker User";

    let roles: string[] = [];
    try {
      roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
    } catch {
      roles = Array.isArray(user.roles) ? user.roles : [];
    }

    const orgName =
      stored?.organization?.name ||
      user?.organization?.name ||
      "Broker Portal";

    return {
      name: toTitleCase(name),
      orgName,
      roleLabel: resolveBrokerRoleLabel(roles, isSubBroker),
      initials: getUserInitials(firstName, lastName, name.charAt(0) || "B"),
    };
  }, [location.pathname, isSubBroker, userTick]);

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
      clearBrokerSession();
    } catch {
      // ignore storage errors
    }
    navigate("/signin");
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-[calc(100vh-4rem)] flex-col border-r border-border bg-white text-text-primary transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 lg:mt-0 lg:h-screen
        ${showLabels ? "w-[260px]" : "w-[84px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setUserMenuOpen(false);
      }}
    >
      <div
        className={`flex shrink-0 items-center border-b border-border dark:border-gray-800 ${
          showLabels ? "gap-2 px-3 py-4" : "justify-center px-2 py-4"
        }`}
      >
        <Link to="/" className={`min-w-0 ${showLabels ? "flex-1" : ""}`}>
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
                <p className="truncate text-[14px] font-semibold tracking-tight text-text-primary dark:text-white">
                  LoanAutomation
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Broker Suite
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
      </div>

      <div className="sidebar-scrollbar-light min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3">
        <nav>
          <h2
            className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary ${
              !showLabels ? "lg:text-center" : ""
            }`}
          >
            {showLabels ? (
              "Broker Workspace"
            ) : (
              <HorizontaLDots className="mx-auto size-5 text-slate-300" />
            )}
          </h2>

          {renderMenuItems(visibleNavItems)}
        </nav>
      </div>

      <div
        ref={userMenuRef}
        className={`relative shrink-0 border-t border-border dark:border-gray-800 ${
          showLabels ? "p-3" : "px-2 py-3"
        }`}
      >
        {userMenuOpen ? (
          <div
            className={`absolute bottom-[calc(100%-2px)] z-50 overflow-hidden rounded-xl border border-border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
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
              <span className="block truncate text-[13px] font-semibold text-text-primary dark:text-white">
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
