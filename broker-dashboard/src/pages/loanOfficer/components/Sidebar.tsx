import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  FilePlus,
  FolderOpen,
  LogOut,
  // MessageSquare,
  PlugZap,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { MdSettings } from "react-icons/md";
import { CgProfile } from "react-icons/cg";
import { FaUserGroup } from "react-icons/fa6";
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
} from "../../../lib/loanOfficerApi";
import { hydrateOrgEntitlements } from "../../../lib/brokerEntitlements";

type NavItem = LoanOfficerNavItem & {
  icon?: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/loan-officer/dashboard",
    always: true,
  },
  {
    icon: <TrendingUp size={18} />,
    name: "Loan Pipeline",
    path: "/loan-officer/loan-pipeline",
    permission: "VIEW_APPLICATIONS",
  },
  {
    icon: <FilePlus size={18} />,
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
    name: "User Management",
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
    icon: <Store size={18} />,
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
    icon: <Wallet size={18} />,
    name: "Payments",
    subItems: [
      {
        name: "Commissions",
        path: "/loan-officer/commissions",
        permission: "VIEW_COMMISSIONS",
      },
      {
        name: "Invoices",
        path: "/loan-officer/invoices",
        permission: "VIEW_INVOICES",
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
        name: "Branding",
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
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const isImpersonation = isLoanOfficerImpersonationSession();

  const [permTick, setPermTick] = useState(0);

  useEffect(() => {
    void hydrateOrgEntitlements();
    const refresh = () => setPermTick((value) => value + 1);
    window.addEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
    window.addEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
      window.removeEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, refresh);
    };
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
    if (isImpersonation) {
      exitLoanOfficerImpersonation();
      return;
    }
    clearLoanOfficerSession();
    window.location.href = "/loan-officer/login";
  };

  const showLabels = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-border bg-white text-text-primary transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100
        ${showLabels ? "w-[260px]" : "w-[84px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold tracking-tight text-text-primary dark:text-white">
                  LoanAutomation
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Loan Officer
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-500 ring-2 ring-brand-100">
              <img
                src="/loanAutomation.jpeg"
                alt="Loan Automation"
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

      {showLabels ? (
        <div className="shrink-0 border-t border-border px-3 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-2.5 text-[13px] font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
          >
            <LogOut size={15} />
            {isImpersonation ? "Close portal tab" : "Logout"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
