import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";

import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";

import { MdEmail } from "react-icons/md";
// import { FaAppStore } from "react-icons/fa6";
import { MdOutlineDocumentScanner } from "react-icons/md";
import { FaUsersBetweenLines, FaUserGroup } from "react-icons/fa6";
import { PiSecurityCameraFill } from "react-icons/pi";
import {
  FolderOpen,
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
  type PermissionKey,
} from "../lib/brokerPermissions";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  subItems?: NavItem[];
  permission?: PermissionKey | PermissionKey[];
  adminOnly?: boolean;
};

const filterBrokerNavItems = (items: NavItem[]): NavItem[] => {
  if (sessionIsBrokerAdmin("broker")) {
    return items;
  }

  return items
    .map((item) => {
      if (item.adminOnly) {
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
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isSubBroker, setIsSubBroker] = useState(false);
  const [isBrokerAdmin, setIsBrokerAdmin] = useState(false);
  const [displayName, setDisplayName] = useState("Broker Admin");
  const [userEmail, setUserEmail] = useState("");

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
        setDisplayName(
          user?.name ||
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          "Broker Admin",
        );
        setUserEmail(user?.email || "");
      } catch {
        setIsSubBroker(false);
        setDisplayName("Broker Admin");
        setUserEmail("");
      }
    };

    updateRole();
    window.addEventListener("storage", updateRole);
    return () => window.removeEventListener("storage", updateRole);
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
            permission: "VIEW_SETTINGS",
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
              { name: "Loan Officers", path: "/loan-officers" },
              { name: "Co Brokers", path: "/sub-brokers" },
              { name: "Borrowers", path: "/borrowers" },
              { name: "Contacts", path: "/contacts-list" },
              { name: "Loan Officer Activity", path: "/loan-officer-activity" },
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
                  { name: "Commissions", path: "/payments/commissions" },
                  { name: "Invoices", path: "/payments/invoices" },
                ],
              },
            ]
          : []),
      ...(!isSubBroker
        ? [
          {
            icon: <MdSettings />,
            name: "Settings",
            permission: "VIEW_SETTINGS",
            subItems: [
              {
                name: "Branding",
                path: "/settings/branding",
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
            permission: "VIEW_LOGS",
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
    [navItems],
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
      className={`flex flex-col gap-0.5 ${level > 0 ? "ml-2 mt-1 border-l border-[#13538A]/15 pl-2.5 dark:border-[#13538A]/25" : ""}`}
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
                          ? "rotate-180 text-[#13538A]"
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
                        className={`ml-1 h-1.5 w-1.5 shrink-0 rounded-full ${linkActive ? "bg-[#13538A]" : "bg-gray-300"
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

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-[calc(100vh-4rem)] flex-col border-r border-gray-200 bg-white text-gray-800 shadow-[4px_0_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:shadow-none lg:mt-0 lg:h-screen
        ${isExpanded || isMobileOpen
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
        className={`relative shrink-0 overflow-hidden border-b border-gray-100 dark:border-gray-800 ${!isExpanded && !isHovered ? "lg:flex lg:justify-center lg:px-2 lg:py-4" : "px-4 py-5"
          }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#13538A]/6 via-transparent to-[#2C92D5]/8 dark:from-[#13538A]/12 dark:to-[#2C92D5]/12" />
        <Link to="/" className="relative block">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-2 ring-white shadow-sm dark:ring-gray-800">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  Loan Automation
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#13538A] dark:text-cyan-400">
                  Broker Portal
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-2 ring-[#13538A]/15">
              <img
                src="/loanAutomation.jpeg"
                alt="Logo"
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
                {displayName
                  .split(" ")
                  .map((part) => part.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "BA"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {userEmail || (isSubBroker ? "Sub Broker" : "Broker Admin")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-scrollbar-light min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <nav className="pb-4">
          <h2
            className={`mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 ${!isExpanded && !isHovered ? "lg:text-center" : ""
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
        <div className="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-center text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600">
            LendingCart Broker
          </p>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
