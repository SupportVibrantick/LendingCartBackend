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
import { MdEmail, MdSettings } from "react-icons/md";
import { CgProfile } from "react-icons/cg";
import { FaUserGroup } from "react-icons/fa6";
// import { PiSecurityCameraFill } from "react-icons/pi";
import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../../../icons";
import { useSidebar } from "../../../context/SidebarContext";
import {
  filterLoanOfficerNavItems,
  LO_PERMISSIONS_UPDATED_EVENT,
  type LoanOfficerNavItem,
} from "../../../lib/brokerPermissions";
import {
  LO_USER_KEY,
  clearLoanOfficerSession,
  exitLoanOfficerImpersonation,
  isLoanOfficerImpersonationSession,
} from "../../../lib/loanOfficerApi";

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
    always: true,
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
  {
    icon: <MdEmail />,
    name: "Email Marketing",
    path: "/loan-officer/email-marketing",
    permission: "SEND_EMAILS",
  },
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
    ],
  },
  {
    icon: <MdSettings />,
    name: "Settings",
    subItems: [
      {
        name: "Branding",
        path: "/loan-officer/settings/branding",
        permission: ["MANAGE_BRANDING", "VIEW_COMPANY_SETTINGS"],
      },
    ],
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
  const [displayName, setDisplayName] = useState("Loan Officer");
  const [userEmail, setUserEmail] = useState("");
  const isImpersonation = isLoanOfficerImpersonationSession();

  const [permTick, setPermTick] = useState(0);

  useEffect(() => {
    const refresh = () => setPermTick((value) => value + 1);
    window.addEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(LO_PERMISSIONS_UPDATED_EVENT, refresh);
  }, []);

  const visibleNavItems = useMemo(
    () => filterLoanOfficerNavItems(navItems, "loanOfficer"),
    [permTick],
  );

  useEffect(() => {
    const updateUser = () => {
      try {
        const user = JSON.parse(sessionStorage.getItem(LO_USER_KEY) || "{}");
        setDisplayName(
          user?.name ||
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            "Loan Officer",
        );
        setUserEmail(user?.email || "");
      } catch {
        setDisplayName("Loan Officer");
        setUserEmail("");
      }
    };

    updateUser();
    window.addEventListener("storage", updateUser);
    return () => window.removeEventListener("storage", updateUser);
  }, []);

  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase() || "LO",
    [displayName],
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
      className={`flex flex-col gap-0.5 ${level > 0 ? "ml-2 mt-1 border-l border-[#13538A]/15 pl-2.5 dark:border-[#13538A]/25" : ""}`}
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
                          ? "rotate-180 text-[#13538A]"
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
                          linkActive ? "bg-[#13538A]" : "bg-gray-300"
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

  return (
    <aside
      className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-gray-200 bg-white text-gray-800 shadow-[4px_0_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:shadow-none
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
              ? "w-[290px]"
              : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`relative shrink-0 overflow-hidden border-b border-gray-100 dark:border-gray-800 ${
          !isExpanded && !isHovered ? "lg:flex lg:justify-center lg:px-2 lg:py-4" : "px-4 py-5"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#13538A]/6 via-transparent to-[#2C92D5]/8 dark:from-[#13538A]/12 dark:to-[#2C92D5]/12" />
        <Link to="/loan-officer/dashboard" className="relative block">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-2 ring-white shadow-sm dark:ring-gray-800">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  Loan Automation
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#13538A] dark:text-cyan-400">
                  Loan Officer Portal
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-2 ring-[#13538A]/15">
              <img
                src="/loanAutomation.jpeg"
                alt="Loan Automation"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </Link>
      </div>

      {(isExpanded || isHovered || isMobileOpen) && (
        <div className="shrink-0 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <div className="overflow-hidden rounded-2xl border border-[#13538A]/10 bg-gradient-to-br from-[#13538A]/5 via-white to-[#2C92D5]/5 p-3 dark:border-[#13538A]/20 dark:from-[#13538A]/10 dark:via-gray-950 dark:to-[#2C92D5]/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A] text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {userEmail || "Loan Officer"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-scrollbar-light min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <nav className="pb-4">
          <h2
            className={`mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 ${
              !isExpanded && !isHovered ? "lg:text-center" : ""
            }`}
          >
            {isExpanded || isHovered || isMobileOpen ? (
              "Navigation"
            ) : (
              <HorizontaLDots className="mx-auto size-5 text-gray-300" />
            )}
          </h2>

          {renderMenuItems(visibleNavItems)}
        </nav>
      </div>

      {(isExpanded || isHovered || isMobileOpen) && (
        <div className="shrink-0 space-y-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-2.5 text-[13px] font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
          >
            <LogOut size={15} />
            {isImpersonation ? "Close portal tab" : "Logout"}
          </button>
          <p className="text-center text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600">
            LendingCart Officer
          </p>
        </div>
      )}
    </aside>
  );
}
