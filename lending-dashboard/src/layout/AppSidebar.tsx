import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, LayoutDashboard, Layers, TrendingUp, UserCircle } from "lucide-react";
import { HorizontaLDots } from "../icons";
import { useSidebar } from "../context/SidebarContext";

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
    matchPaths: ["/loan-pipeline", "/loan-preview", "/loi-preview"],
  },
  {
    icon: Layers,
    name: "Loan Products",
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
    icon: UserCircle,
    name: "Profile",
    description: "Lender information",
    path: "/profile",
    matchPaths: ["/profile"],
  },
];

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

  useEffect(() => {
    let matchedIndex: number | null = null;

    navItems.forEach((nav, index) => {
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
            ? "bg-[#0F766E] text-white shadow-md ring-1 ring-white/15"
            : "text-white/85 hover:bg-white/10 hover:text-white"
        } ${!showLabels ? "lg:justify-center lg:px-2" : ""}`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 hidden h-7 w-1 -translate-y-1/2 rounded-r-full bg-white lg:block" />
        )}
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            active
              ? "bg-white/15 text-white"
              : "bg-white/8 text-white/90 group-hover:bg-white/12"
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
                  active ? "text-white/70" : "text-white/45"
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
      {navItems.map((nav, index) => {
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
                      ? "bg-[#0F766E] text-white shadow-md ring-1 ring-white/15"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  } ${!showLabels ? "lg:justify-center lg:px-2" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active || isOpen
                        ? "bg-white/15"
                        : "bg-white/8 group-hover:bg-white/12"
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
                          isOpen ? "rotate-180" : ""
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
                    <ul className="ml-12 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                      {nav.subItems.map((subItem) => {
                        const subActive = location.pathname === subItem.path;
                        return (
                          <li key={subItem.name}>
                            <Link
                              to={subItem.path}
                              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                                subActive
                                  ? "bg-white/15 font-medium text-white"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
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
      className={`fixed top-0 left-0 z-50 mt-16 flex h-[calc(100vh-4rem)] flex-col border-r border-[#0F766E]/80 bg-gradient-to-b from-[#134E4A] to-[#0f3f3c] text-white shadow-xl transition-all duration-300 ease-in-out lg:mt-0 lg:h-screen dark:border-gray-800 dark:from-gray-900 dark:to-gray-950 ${
        isExpanded || isMobileOpen
          ? "w-[280px]"
          : isHovered
            ? "w-[280px]"
            : "w-[84px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={`shrink-0 border-b border-white/10 px-4 py-4 ${
          !showLabels ? "lg:flex lg:justify-center" : ""
        }`}
      >
        <Link to="/" className="block">
          {showLabels ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/20 shadow-md">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-white">
                  Loan Automation
                </p>
                <p className="truncate text-[11px] text-teal-100/60">
                  Lender Portal
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-2 ring-white/20">
              <img
                src="/loanAutomation.jpeg"
                alt="Loan Automation"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <nav>
          <h2
            className={`mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/40 ${
              !showLabels ? "lg:text-center" : ""
            }`}
          >
            {showLabels ? (
              "Main Menu"
            ) : (
              <HorizontaLDots className="mx-auto size-5 opacity-60" />
            )}
          </h2>
          {renderMenuItems()}
        </nav>
      </div>

      {/* Footer */}
      <div
        className={`shrink-0 border-t border-white/10 p-3 ${
          !showLabels ? "lg:flex lg:justify-center" : ""
        }`}
      >
        {showLabels ? (
          <Link
            to="/profile"
            className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
              location.pathname === "/profile"
                ? "bg-white/12 ring-1 ring-white/15"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <UserCircle size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                Lender Profile
              </p>
              <p className="truncate text-[10px] text-white/50">
                Update your lending details
              </p>
            </div>
            <ChevronDown className="ml-auto size-4 -rotate-90 text-white/40" />
          </Link>
        ) : (
          <Link
            to="/profile"
            title="Profile"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              location.pathname === "/profile"
                ? "bg-white/15 text-white"
                : "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
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
