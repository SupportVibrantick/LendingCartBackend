import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  FileText,
  Handshake,
  LayoutDashboard,
  Layers,
  Settings,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react";
import { HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { canManageTeam } from "../lib/lenderPermissions";

type NavItem = {
  name: string;
  description?: string;
  icon: LucideIcon;
  path?: string;
  matchPaths?: string[];
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    name: "Dashboard",
    description: "Overview & insights",
    path: "/",
    matchPaths: ["/"],
  },
  {
    icon: TrendingUp,
    name: "Loan Pipeline",
    description: "Applications & decisions",
    path: "/loan-pipeline",
    matchPaths: [
      "/loan-pipeline",
      "/loan-preview",
      "/loi-preview",
      "/loi-form",
    ],
  },
  {
    icon: Layers,
    name: "Loan Programs",
    description: "Programs & criteria",
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
    icon: Handshake,
    name: "Brokers",
    description: "Requests & connections",
    path: "/brokers",
    matchPaths: ["/brokers", "/broker-request", "/my-broker", "/find-broker"],
  },
  {
    icon: FileText,
    name: "Documents",
    description: "Required docs by product",
    path: "/documents",
    matchPaths: ["/documents", "/sign-form-templates"],
    subItems: [
      { name: "Product documents", path: "/documents" },
      { name: "Form templates", path: "/sign-form-templates" },
    ],
  },
  {
    icon: UserCircle,
    name: "Profile",
    description: "Lender information",
    path: "/profile",
    matchPaths: ["/profile", "/profile/edit", "/profile/guidelines"],
  },
];

const adminNavItems: NavItem[] = [
  {
    icon: Users,
    name: "Users",
    description: "Team members & access",
    path: "/team-members",
    matchPaths: ["/team-members"],
  },
];

const settingsNavItem: NavItem = {
  icon: Settings,
  name: "Settings",
  description: "Branding & preferences",
  matchPaths: ["/settings/branding"],
  subItems: [{ name: "Branding", path: "/settings/branding" }],
};

function getNavItems() {
  const documentsNavItem = navItems.find((item) => item.path === "/documents");
  const baseNavItems = navItems.filter((item) => item.path !== "/documents");

  if (!canManageTeam()) {
    return baseNavItems;
  }

  return [
    ...baseNavItems.slice(0, 3),
    adminNavItems[0],
    ...(documentsNavItem ? [documentsNavItem] : []),
    ...baseNavItems.slice(3),
    settingsNavItem,
  ];
}

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.subItems?.length) {
    return item.subItems.some((subItem) => pathname === subItem.path);
  }

  const paths = item.matchPaths || (item.path ? [item.path] : []);

  return paths.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const showLabels = isExpanded || isHovered || isMobileOpen;

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {},
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (item: NavItem) => isNavItemActive(location.pathname, item),
    [location.pathname],
  );

  const menuItems = getNavItems();

  useEffect(() => {
    let matchedIndex: number | null = null;

    menuItems.forEach((nav, index) => {
      if (nav.subItems?.some((subItem) => location.pathname === subItem.path)) {
        matchedIndex = index;
      }
    });

    setOpenSubmenu(matchedIndex);
  }, [location.pathname]);

  useEffect(() => {
    if (openSubmenu === null) return;

    const key = `main-${openSubmenu}`;
    if (subMenuRefs.current[key]) {
      setSubMenuHeight((prev) => ({
        ...prev,
        [key]: subMenuRefs.current[key]?.scrollHeight || 0,
      }));
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prev) => (prev === index ? null : index));
  };

  const renderNavLink = (nav: NavItem) => {
    const active = isActive(nav);
    const Icon = nav.icon;
    return (
      <Link
        to={nav.path!}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          active
            ? "bg-[#183B57]/10 text-[#183B57] shadow-[inset_3px_0_0_0_#183B57]"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
        } ${!showLabels ? "lg:justify-center lg:px-2" : ""}`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            active
              ? "bg-[#183B57]/10 text-[#183B57]"
              : "bg-gray-50 text-[#183B57]/70 group-hover:bg-[#183B57]/10 dark:bg-gray-800 dark:text-[#5ba8d4]"
          }`}
        >
          <Icon size={18} strokeWidth={active ? 2.25 : 2} />
        </span>
        {showLabels && (
          <span className="min-w-0 flex-1">
            <span className="block truncate leading-tight">{nav.name}</span>
            {nav.description && (
              <span
                className={`mt-0.5 block truncate text-[11px] font-normal ${
                  active
                    ? "text-[#183B57]/70"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {nav.description}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  };

  const renderMenuItems = () => (
    <ul className="space-y-1">
      {menuItems.map((nav, index) => {
        const active = isActive(nav);
        const Icon = nav.icon;
        const isOpen = openSubmenu === index;

        return (
          <li key={nav.name}>
            {nav.subItems ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSubmenuToggle(index)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    active || isOpen
                      ? "bg-[#183B57]/10 text-[#183B57] shadow-[inset_3px_0_0_0_#183B57]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                  } ${!showLabels ? "lg:justify-center lg:px-2" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active || isOpen
                        ? "bg-[#183B57]/10 text-[#183B57]"
                        : "bg-gray-50 text-[#183B57]/70 group-hover:bg-[#183B57]/10 dark:bg-gray-800 dark:text-[#5ba8d4]"
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  {showLabels && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {nav.name}
                      </span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
                          isOpen
                            ? "rotate-180 text-[#183B57]"
                            : "text-gray-400 group-hover:text-gray-600"
                        }`}
                      />
                    </>
                  )}
                </button>

                {showLabels && (
                  <div
                    ref={(el) => {
                      subMenuRefs.current[`main-${index}`] = el;
                    }}
                    className="overflow-hidden transition-all duration-300"
                    style={{
                      height: isOpen
                        ? `${subMenuHeight[`main-${index}`] || 0}px`
                        : "0px",
                    }}
                  >
                    <ul className="ml-12 mt-1 space-y-0.5 border-l border-[#183B57]/15 pl-3 dark:border-[#183B57]/30">
                      {nav.subItems.map((subItem) => {
                        const subActive = location.pathname === subItem.path;
                        return (
                          <li key={subItem.name}>
                            <Link
                              to={subItem.path}
                              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                                subActive
                                  ? "bg-[#183B57]/10 font-semibold text-[#183B57]"
                                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                              }`}
                            >
                              {subItem.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              nav.path && renderNavLink(nav)
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-[calc(100vh-4rem)] flex-col border-r border-gray-200 bg-white text-gray-800 shadow-[4px_0_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:shadow-none lg:mt-0 lg:h-screen ${
        isExpanded || isMobileOpen
          ? "w-[280px]"
          : isHovered
            ? "w-[280px]"
            : "w-[84px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`relative shrink-0 overflow-hidden border-b border-gray-100 dark:border-gray-800 ${
          !showLabels ? "lg:flex lg:justify-center lg:px-2 lg:py-4" : "px-4 py-5"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#183B57]/10 via-transparent to-[#183B57]/5 dark:from-[#183B57]/20 dark:to-[#183B57]/10" />
        <Link to="/" className="relative block">
          {showLabels ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-2 ring-white shadow-sm dark:ring-gray-800">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight text-gray-900 dark:text-white">
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
                alt="Loan Automation"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </Link>
      </div>

      <div className="sidebar-scrollbar-light min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <nav>
          <h2
            className={`mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 ${
              !showLabels ? "lg:text-center" : ""
            }`}
          >
            {showLabels ? (
              "Navigation"
            ) : (
              <HorizontaLDots className="mx-auto size-5 text-gray-300" />
            )}
          </h2>
          {renderMenuItems()}
        </nav>
      </div>

      <div
        className={`shrink-0 border-t border-gray-100 p-3 dark:border-gray-800 ${
          !showLabels ? "lg:flex lg:justify-center" : ""
        }`}
      >
        {showLabels ? (
          <Link
            to="/profile"
            className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
              location.pathname === "/profile"
                ? "border-[#183B57]/20 bg-[#183B57]/10"
                : "border-gray-100 bg-gray-50 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#183B57] text-white">
              <UserCircle size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                Lender Profile
              </p>
              <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                Update your lending details
              </p>
            </div>
            <ChevronDown className="ml-auto size-4 -rotate-90 text-gray-400" />
          </Link>
        ) : (
          <Link
            to="/profile"
            title="Profile"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              location.pathname === "/profile"
                ? "bg-[#183B57]/10 text-[#183B57]"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-[#183B57] dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            <UserCircle size={18} />
          </Link>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
