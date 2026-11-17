import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  FileText,
  Handshake,
  Layers,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { CgProfile } from "react-icons/cg";
import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { canManageTeam } from "../lib/lenderPermissions";

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
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
    matchPaths: ["/"],
  },
  {
    icon: <TrendingUp size={18} />,
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
    icon: <Layers size={18} />,
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
    icon: <Handshake size={18} />,
    name: "Brokers",
    path: "/brokers",
    matchPaths: ["/brokers", "/broker-request", "/my-broker", "/find-broker"],
  },
  {
    icon: <FileText size={18} />,
    name: "Documents",
    adminOnly: true,
    matchPaths: ["/documents", "/sign-form-templates"],
    subItems: [
      { name: "Product documents", path: "/documents" },
      { name: "Form templates", path: "/sign-form-templates" },
    ],
  },
  {
    icon: <Users size={18} />,
    name: "Users",
    path: "/team-members",
    adminOnly: true,
    matchPaths: ["/team-members"],
  },
  {
    icon: <Settings size={18} />,
    name: "Settings",
    adminOnly: true,
    matchPaths: ["/settings/branding"],
    subItems: [{ name: "Branding", path: "/settings/branding" }],
  },
  {
    icon: <CgProfile />,
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

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const visibleNavItems = useMemo(() => filterLenderNavItems(allNavItems), []);

  const isPathActive = useCallback(
    (path?: string, matchPaths?: string[]) => {
      const paths = matchPaths?.length
        ? matchPaths
        : path
          ? [path]
          : [];

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

  const renderMenuItems = (
    items: NavItem[],
    menuType: "main" = "main",
    level = 0,
    parentKey = "",
  ) => (
    <ul
      className={`flex flex-col gap-0.5 ${
        level > 0
          ? "ml-2 mt-1 border-l border-[#183B57]/15 pl-2.5 dark:border-[#183B57]/25"
          : ""
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
                          ? "rotate-180 text-[#183B57]"
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
                          linkActive ? "bg-[#183B57]" : "bg-[#183B57]/35"
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
          !isExpanded && !isHovered
            ? "lg:flex lg:justify-center lg:px-2 lg:py-4"
            : "px-4 py-5"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#183B57]/10 via-transparent to-[#183B57]/5 dark:from-[#183B57]/20 dark:to-[#183B57]/10" />
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
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#183B57] dark:text-cyan-400">
                  Lender Portal
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-2 ring-[#183B57]/15">
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
        <div className="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-center text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600">
            Loan Automation Lender
          </p>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
