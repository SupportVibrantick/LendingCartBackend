import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";

import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";

import { MdEmail, MdWeb } from "react-icons/md";
import { FaAppStore } from "react-icons/fa6";
import { MdOutlineDocumentScanner } from "react-icons/md";
import { FaUsersBetweenLines, FaUserGroup } from "react-icons/fa6";
import { PiSecurityCameraFill } from "react-icons/pi";
import {
   TrendingUp,
  //  MessageSquare
 } from "lucide-react";
import { MdSettings } from "react-icons/md";
import { CgProfile } from "react-icons/cg";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  subItems?: NavItem[];
};

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isSubBroker, setIsSubBroker] = useState(false);

  useEffect(() => {
    const updateRole = () => {
      try {
        const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
        setIsSubBroker(user?.userType === "SUB_BROKER");
      } catch {
        setIsSubBroker(false);
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
      },
      // {
      //   icon: <MessageSquare />,
      //   name: "Messages",
      //   path: "/messages",
      // },
      ...(!isSubBroker
        ? [
            {
              icon: <MdWeb />,
              name: "Website Builder",
              subItems: [
                {
                  name: "Config Website",
                  path: "/broker-website-dashboard/config-website",
                },
              ],
            },
          ]
        : []),
      ...(!isSubBroker
        ? [
            {
              icon: <MdOutlineDocumentScanner />,
              name: "New Loan Application",
              path: "/active-application",
            },
          ]
        : []),
      ...(!isSubBroker
        ? [
            {
              icon: <FaUserGroup />,
              name: "CRM",
              subItems: [
                { name: "Sub Brokers", path: "/sub-brokers" },
                { name: "Loan Officers", path: "/loan-officers" },
                { name: "LO Activity", path: "/loan-officer-activity" },
                { name: "Contacts", path: "/contacts-list" },
              ],
            },
          ]
        : []),
      ...(!isSubBroker
        ? [
            {
              icon: <FaUsersBetweenLines />,
              name: "Lender Marketplace",
              subItems: [
                { name: "My Lenders", path: "/my-lenders" },
                { name: "Invited Lenders", path: "/invited-lenders" },
                { name: "Find Lenders", path: "/find-lenders" },
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
                  icon: <FaAppStore />,
                  name: "Application Builder",
                  subItems: [
                    { name: "Create Application", path: "/create-application" },
                    {
                      name: "Loan Application Config",
                      path: "/application-config",
                    },
                    { name: "Add Sections", path: "/add-section" },
                    { name: "Application Builder", path: "/application" },
                  ],
                },
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
            },
          ]
        : []),
      {
        icon: <CgProfile />,
        name: "Profile",
        path: "/profile",
      },
    ],
    [isSubBroker]
  );

  const isActive = useCallback(
    (path?: string) => {
      if (!path) return false;
      if (path === "/") return location.pathname === "/";
      return location.pathname.startsWith(path);
    },
    [location.pathname]
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
      parentKey = ""
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

    setOpenMenus(findActiveMenus(navItems));
  }, [location.pathname, navItems]);

  const renderMenuItems = (
    items: NavItem[],
    menuType: "main" = "main",
    level = 0,
    parentKey = ""
  ) => (
    <ul
      className={`flex flex-col gap-0.5 ${level > 0 ? "ml-3 mt-1 border-l-2 border-gray-100 pl-3 dark:border-gray-800" : ""}`}
    >
      {items.map((nav, index) => {
        const key = parentKey ? `${parentKey}-${index}` : `${menuType}-${index}`;
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
                    childActive || isOpen ? "menu-item-active" : "menu-item-inactive"
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
                    {renderMenuItems(nav.subItems, menuType, level + 1, key)}
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
                        linkActive ? "menu-item-icon-active" : "menu-item-icon-inactive"
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

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-[calc(100vh-4rem)] flex-col border-r border-gray-200 bg-white text-gray-800 shadow-sm transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 lg:mt-0 lg:h-screen
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
        className={`shrink-0 border-b border-gray-100 px-4 py-5 dark:border-gray-800 ${
          !isExpanded && !isHovered ? "lg:flex lg:justify-center" : ""
        }`}
      >
        <Link to="/" className="block">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-[#13538A]/15">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  Loan Automation
                </p>
                <p className="truncate text-[11px] font-medium text-[#13538A]">
                  Broker Portal
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2 ring-[#13538A]/15">
              <img
                src="/loanAutomation.jpeg"
                alt="Logo"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </Link>
      </div>

      <div className="sidebar-scrollbar-light min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <nav className="pb-4">
          <h2
            className={`mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 ${
              !isExpanded && !isHovered ? "lg:text-center" : ""
            }`}
          >
            {isExpanded || isHovered || isMobileOpen ? (
              "Menu"
            ) : (
              <HorizontaLDots className="mx-auto size-5 text-gray-300" />
            )}
          </h2>

          {renderMenuItems(navItems)}
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
