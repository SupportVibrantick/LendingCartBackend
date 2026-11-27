import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ChevronDown,
  FolderOpen,
  LogOut,
  PanelLeftOpen,
  // MessageSquare,
  PlugZap,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { MdOutlineDocumentScanner, MdSettings } from "react-icons/md";
// import { MdEmail } from "react-icons/md";
import { CgProfile } from "react-icons/cg";
import { FaUsersBetweenLines, FaUserGroup } from "react-icons/fa6";
import { PiSecurityCameraFill } from "react-icons/pi";
import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../../../icons";
import { useSidebar } from "../../../context/SidebarContext";
import {
  filterLoanOfficerNavItems,
  LO_PERMISSIONS_UPDATED_EVENT,
  ORG_ENTITLEMENTS_UPDATED_EVENT,
  type LoanOfficerNavItem,
} from "../../../lib/brokerPermissions";
import {
  clearLoanOfficerSession,
  exitLoanOfficerImpersonation,
  isLoanOfficerImpersonationSession,
  LO_PROFILE_UPDATED_EVENT,
  LO_USER_KEY,
} from "../../../lib/loanOfficerApi";
import { hydrateOrgEntitlements } from "../../../lib/brokerEntitlements";
import {
  BROKER_BRANDING_UPDATED_EVENT,
  fetchBrokerPortalBranding,
  readStoredBrokerBranding,
  resolveBrokerLogoUrl,
  type BrokerPortalBranding,
} from "../../../lib/brokerBranding";

type NavItem = LoanOfficerNavItem & {
  icon?: React.ReactNode;
};

function getUserInitials(
  firstName?: string,
  lastName?: string,
  fallback = "LO",
) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return String(fallback || "LO").slice(0, 2).toUpperCase();
}

function toTitleCase(value?: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveLoanOfficerRoleLabel(roles: string[]) {
  if (roles.includes("BROKER_OFFICER") || roles.includes("LOAN_OFFICER")) {
    return "Officer";
  }
  if (roles[0]) return roles[0].replace(/_/g, " ");
  return "Officer";
}

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/loan-officer/dashboard",
    always: true,
  },
  {
    icon: <TrendingUp />,
    name: "Loan Pipeline",
    path: "/loan-officer/loan-pipeline",
    permission: "VIEW_APPLICATIONS",
  },
  {
    icon: <MdOutlineDocumentScanner />,
    name: "New Loan Application",
    path: "/loan-officer/loan-application",
    permission: "CREATE_APPLICATION",
  },
  {
    icon: <PlugZap size={18} />,
    name: "GoHighLevel",
    path: "/loan-officer/settings/integrations/ghl",
    permission: "ACCESS_GOHIGHLEVEL",
  },
  {
    icon: <FaUserGroup />,
    name: "Users",
    subItems: [
      {
        name: "Co-Brokers",
        path: "/loan-officer/co-brokers",
        permission: "VIEW_CO_BROKERS",
      },
      {
        name: "Borrowers",
        path: "/loan-officer/borrowers",
        permission: "VIEW_BORROWERS",
      },
      {
        name: "Contacts",
        path: "/loan-officer/contacts",
        permission: "VIEW_CONTACTS",
      },
    ],
  },
  {
    icon: <FaUsersBetweenLines />,
    name: "Lender Marketplace",
    path: "/loan-officer/lender-marketplace",
    permission: "VIEW_MARKETPLACE",
  },
  {
    icon: <FolderOpen size={18} />,
    name: "Documents",
    subItems: [
      {
        name: "Custom Documents",
        path: "/loan-officer/documents/custom",
        permission: ["MANAGE_CUSTOM_DOCUMENTS", "VIEW_CUSTOM_DOCUMENTS"],
      },
    ],
  },
  // {
  //   icon: <MdEmail />,
  //   name: "Email Marketing",
  //   path: "/loan-officer/email-marketing",
  //   permission: "SEND_EMAILS",
  // },
  {
    icon: <Wallet />,
    name: "Payments",
    subItems: [
      {
        name: "Invoices",
        path: "/loan-officer/invoices",
        permission: "VIEW_INVOICES",
      },
      {
        name: "Commissions",
        path: "/loan-officer/commissions",
        permission: "VIEW_COMMISSIONS",
      },
      {
        name: "Banking",
        path: "/loan-officer/banking",
        always: true,
      },
    ],
  },
  {
    icon: <MdSettings />,
    name: "Settings",
    subItems: [
      {
        name: "Branding & Domain",
        path: "/loan-officer/settings/branding",
        permission: "MANAGE_BRANDING",
      },
    ],
  },
  {
    icon: <PiSecurityCameraFill />,
    name: "Dashboard Logs",
    path: "/loan-officer/admin-logs",
    permission: "VIEW_DASHBOARD_LOGS",
  },
  {
    icon: <CgProfile />,
    name: "Profile",
    path: "/loan-officer/profile",
    always: true,
  },
];

export default function Sidebar() {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
    toggleSidebar,
  } = useSidebar();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const isImpersonation = isLoanOfficerImpersonationSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [userTick, setUserTick] = useState(0);
  const [permTick, setPermTick] = useState(0);
  const [branding, setBranding] = useState<BrokerPortalBranding>(
    readStoredBrokerBranding("loan-officer"),
  );

  const brandTitle = branding.brandName || "Loan Automation";
  const portalLabel = branding.portalLabel || "Loan Officer";

  useEffect(() => {
    void hydrateOrgEntitlements();
    const refresh = () => setPermTick((value) => value + 1);
    const onProfileUpdated = () => setUserTick((value) => value + 1);
    const onBrandingUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { branding?: BrokerPortalBranding; portal?: string }
        | undefined;
      if (detail?.portal && detail.portal !== "loan-officer") return;
      if (detail?.branding) {
        setBranding(detail.branding);
        return;
      }
      setBranding(readStoredBrokerBranding("loan-officer"));
    };
    window.addEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
    window.addEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, refresh);
    window.addEventListener(LO_PROFILE_UPDATED_EVENT, onProfileUpdated);
    window.addEventListener(BROKER_BRANDING_UPDATED_EVENT, onBrandingUpdated);
    return () => {
      window.removeEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
      window.removeEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, refresh);
      window.removeEventListener(LO_PROFILE_UPDATED_EVENT, onProfileUpdated);
      window.removeEventListener(
        BROKER_BRANDING_UPDATED_EVENT,
        onBrandingUpdated,
      );
    };
  }, []);

  useEffect(() => {
    void fetchBrokerPortalBranding("loan-officer").then(setBranding);
  }, []);

  const visibleNavItems = useMemo(
    () => filterLoanOfficerNavItems(navItems, "loanOfficer"),
    [permTick],
  );

  const isActive = useCallback(
    (path?: string) => {
      if (!path) return false;
      return location.pathname.startsWith(path);
    },
    [location.pathname],
  );

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasActiveChild = useCallback(
    (items?: NavItem[]): boolean => {
      if (!items) return false;

      return items.some((item) => {
        if (item.path && isActive(item.path)) return true;
        if (item.subItems) return hasActiveChild(item.subItems);
        return false;
      });
    },
    [isActive],
  );

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
  }, [location.pathname, hasActiveChild, visibleNavItems]);

  const renderMenuItems = (
    items: NavItem[],
    level = 0,
    parentKey = "",
  ) => (
    <ul
      className={`flex flex-col gap-0.5 ${level > 0 ? "ml-2 mt-1 border-l border-[#4C78F5]/15 pl-2.5 dark:border-[#4C78F5]/25" : ""}`}
    >
      {items.map((nav, index) => {
        const key = parentKey ? `${parentKey}-${index}` : `main-${index}`;
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
                  className={`menu-item group ${
                    childActive || isOpen
                      ? "menu-item-active"
                      : "menu-item-inactive"
                  }`}
                >
                  {nav.icon && (
                    <span
                      className={`menu-item-icon-size ${
                        childActive || isOpen
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
                      className={`ml-auto h-4 w-4 transition-all duration-200 ${
                        isOpen
                          ? "rotate-180 text-[#4C78F5]"
                          : "text-gray-400 group-hover:text-gray-600"
                      }`}
                    />
                  )}
                </button>

                {(isExpanded || isHovered || isMobileOpen) && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen ? "mt-1 max-h-[1000px]" : "max-h-0"
                    }`}
                  >
                    {renderMenuItems(nav.subItems, level + 1, key)}
                  </div>
                )}
              </>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  className={`menu-item group ${
                    linkActive ? "menu-item-active" : "menu-item-inactive"
                  } ${level > 0 ? "menu-item-nested" : ""}`}
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
                  ) : (
                    level > 0 && (
                      <span
                        className={`ml-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          linkActive ? "bg-[#4C78F5]" : "bg-gray-300"
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

  const handleLogout = () => {
    setUserMenuOpen(false);
    if (isImpersonation) {
      exitLoanOfficerImpersonation();
      return;
    }
    clearLoanOfficerSession();
    window.location.href = "/loan-officer/login";
  };

  const showLabels = isExpanded || isHovered || isMobileOpen;

  const sidebarUser = useMemo(() => {
    let stored: any = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(LO_USER_KEY) || "{}");
    } catch {
      stored = {};
    }

    const user = stored?.user || stored || {};
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const name =
      `${firstName} ${lastName}`.trim() ||
      user.name ||
      "Loan Officer";

    let roles: string[] = [];
    try {
      roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
    } catch {
      roles = Array.isArray(user.roles) ? user.roles : [];
    }

    const orgName =
      stored?.organization?.name ||
      user?.organization?.name ||
      user?.organizationName ||
      "Loan Officer Portal";

    return {
      name: toTitleCase(name) || "Loan Officer",
      orgName,
      roleLabel: resolveLoanOfficerRoleLabel(roles),
      initials: getUserInitials(firstName, lastName, name.charAt(0) || "L"),
    };
  }, [location.pathname, userTick]);

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

  return (
    <aside
      className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-border bg-white text-text-primary transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100
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
        <Link
          to="/loan-officer/dashboard"
          className={`min-w-0 ${showLabels ? "flex-1" : ""}`}
        >
          {showLabels ? (
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500 ring-2 ring-brand-100">
                <img
                  src={resolveBrokerLogoUrl(branding.logoUrl)}
                  alt={brandTitle}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold tracking-tight text-text-primary dark:text-white">
                  {brandTitle}
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {portalLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-500 ring-2 ring-brand-100">
              <img
                src={resolveBrokerLogoUrl(branding.logoUrl)}
                alt={brandTitle}
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
              "Workspace"
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
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogOut size={15} strokeWidth={1.75} />
              {isImpersonation ? "Close portal tab" : "Sign out"}
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
}
