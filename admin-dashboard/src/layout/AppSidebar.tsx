import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAdminPermissions } from "../context/AdminPermissionsContext";
import { filterNavItems } from "../lib/adminPermissions";

// Assume these icons are imported from an icon library
import {
  // BoxCubeIcon,
  // CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  // ListIcon,
  // PageIcon,
  // PieChartIcon,
  // PlugInIcon,
  // TableIcon,
  // UserCircleIcon,
} from "../icons";

// import { FaAppStore } from "react-icons/fa6";
import { useSidebar } from "../context/SidebarContext";
// import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import { PiSecurityCameraFill } from "react-icons/pi";
import { GrDocumentText } from "react-icons/gr";
import { RiExternalLinkLine } from "react-icons/ri";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import { 
  // Mail, 
  MessageSquare,
   BarChart3,
    TrendingUp,
     } from "lucide-react";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  subItems?: NavItem[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
  },
    {
    icon: <BarChart3 />,
    name: "Loan Pipeline",
    path: "/loan-pipeline",
  },
  {
    icon: <GroupsOutlinedIcon />,
    name: "Broker Database",
    path: "/all-brokers-database",
  },
  {
    icon: <AccountBalanceOutlinedIcon />,
    name: "Lender Database",
    path: "/all-lenders-Organization",
  },
  // {
  //   icon: <GroupsOutlinedIcon />,
  //   name: "Broker Organizations",
  //   subItems: [
  //     { name: "Brokers Organization", path: "/all-brokers-Organization" },
  //     { name: "Broker Assigned Lenders", path: "/all-brokers-lenders" },
  //   ],
  // },
  // {
  //   icon: <FaAppStore />,
  //   name: "Application Builder",
  //   subItems: [
  //     { name: "Create Application", path: "/create-application" },
  //     { name: "Loan Application Config", path: "/loan-application-config" },
  //     { name: "Add Sections", path: "/add-app-sections" },
  //     { name: "Application Builder", path: "/application-builder" },
  //     { name: "Active Application", path: "/active-application" },
  //   ],
  // },
  {
    icon: <CurrencyExchangeOutlinedIcon />,
    name: "Loan Products",
    path: "/all-loan-products",
  },
  // {
  //   icon: <GroupOutlinedIcon />,
  //   name: "Manage User",
  //   subItems: [{ name: "Add User", path: "/add-user" },{ name: "All User", path: "/all-user" }],
  // },

  // {
  //   icon: <BarChart3 />,
  //   name: "Loan Pipeline",
  //   path: "/loan-pipeline",
  // },
  {
    icon: <GrDocumentText />,
    name: "Document Type",
    path: "/all-documents",
  },
  {
    icon: <AdminPanelSettingsOutlinedIcon />,
    name: "Admin Users",
    path: "/all-super-admins",
  },
  {
    icon: <ContactsOutlinedIcon />,
    name: "All Leads",
    path: "/all-landing-pages-leads",
  },
  // {
  //   icon: <Mail />,
  //   name: "Email Marketing",
  //   path: "/email-marketing",
  // },
  {
    icon: <MessageSquare />,
    name: "Communications",
    path: "/all-communications",
  },
  {
    icon: <CurrencyExchangeOutlinedIcon />,
    name: "Subscriptions",
    subItems: [
      { name: "Packages", path: "/all-subscriptions" },
      { name: "Subscribers", path: "/subscription-subscribers" },
      { name: "Invoices", path: "/subscription-invoices" },
    ],
  },
  {
    icon: <AdminPanelSettingsOutlinedIcon />,
    name: "Settings",
    subItems: [
      {
        name: "Template Builder",
        subItems: [
          { name: "Create Templates", path: "/create-template" },
          { name: "All Templates", path: "/all-templates" },
          { name: "Add Loan Products", path: "/add-loan-product" },
          { name: "Add Sections", path: "/add-sections" },
          { name: "Add Fields", path: "/add-fields" },
        ],
      },
      // {
      //   // icon: <FaAppStore />,
      //   name: "Application Builder",
      //   subItems: [
      //     { name: "Create Application", path: "/create-application" },
      //     { name: "Loan Application Config", path: "/loan-application-config" },
      //     { name: "Add Sections", path: "/add-app-sections" },
      //     { name: "Application Builder", path: "/application-builder" },
      //     { name: "Active Application", path: "/active-application" },
      //   ],
      // },
      {
        name: "System Settings",
        path: "/system-settings",
      },
    ],
  },
    {
    icon: <TrendingUp />,
    name: "Reports & Analytics",
    path: "/platform-reports",
  },
  {
    icon: <PiSecurityCameraFill />,
    name: "Dashboard Logs",
    path: "/admin-logs",
  },
  // {
  //   icon: <CalenderIcon />,
  //   name: "Calendar",
  //   path: "/calendar",
  // },
  // {
  //   icon: <UserCircleIcon />,
  //   name: "User Profile",
  //   path: "/profile",
  // },
  // {
  //   name: "Forms",
  //   icon: <ListIcon />,
  //   subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  // },
  // {
  //   name: "Tables",
  //   icon: <TableIcon />,
  //   subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  // },
  // {
  //   name: "Pages",
  //   icon: <PageIcon />,
  //   subItems: [
  //     { name: "Blank Page", path: "/blank", pro: false },
  //     { name: "404 Error", path: "/error-404", pro: false },
  //   ],
  // },
];

const othersItems: NavItem[] = [
  {
    icon: <RiExternalLinkLine />,
    name: "Broker Portal",
    path: "/broker-portal",
  },
  {
    icon: <RiExternalLinkLine />,
    name: "Lender Portal",
    path: "/lender-portal",
  },
  // {
  //   icon: <PieChartIcon />,
  //   name: "Charts",
  //   subItems: [
  //     { name: "Line Chart", path: "/line-chart", pro: false },
  //     { name: "Bar Chart", path: "/bar-chart", pro: false },
  //   ],
  // },
  // {
  //   icon: <BoxCubeIcon />,
  //   name: "UI Elements",
  //   subItems: [
  //     { name: "Alerts", path: "/alerts", pro: false },
  //     { name: "Avatar", path: "/avatars", pro: false },
  //     { name: "Badge", path: "/badge", pro: false },
  //     { name: "Buttons", path: "/buttons", pro: false },
  //     { name: "Images", path: "/images", pro: false },
  //     { name: "Videos", path: "/videos", pro: false },
  //   ],
  // },
  // {
  //   icon: <PlugInIcon />,
  //   name: "Authentication",
  //   subItems: [
  //     { name: "Sign In", path: "/signin", pro: false },
  //     { name: "Sign Up", path: "/signup", pro: false },
  //   ],
  // },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const { permissions, hasFullAccess, loading } = useAdminPermissions();

  const visibleNavItems = useMemo(
    () => (loading ? navItems : filterNavItems(navItems, permissions, hasFullAccess)),
    [permissions, hasFullAccess, loading]
  );

  const visibleOthersItems = useMemo(
    () => (loading ? othersItems : filterNavItems(othersItems, permissions, hasFullAccess)),
    [permissions, hasFullAccess, loading]
  );

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  // const isActive = (path: string) => location.pathname === path;
  const isActive = useCallback(
    (path?: string) => {
      if (!path) return false;

      if (path === "/") {
        return location.pathname === "/";
      }

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

  const hasActiveChild = (items?: any[]): boolean => {
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
      let result: Record<string, boolean> = {};

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
    menuType: "main" | "others",
    level = 0,
    parentKey = "",
  ) => (
    <ul className={`flex flex-col gap-1 ${level > 0 ? "ml-4 mt-1 border-l border-white/10 pl-3" : ""}`}>
      {items.map((nav, index) => {
        const key = parentKey
          ? `${parentKey}-${index}`
          : `${menuType}-${index}`;
        const isOpen = openMenus[key];

        return (
          <li key={key}>
            {nav.subItems ? (
              <>
                <button
                  onClick={() => toggleMenu(key)}
                  className={`menu-item group ${
                    hasActiveChild(nav.subItems) || isOpen
                      ? "menu-item-active shadow-sm ring-1 ring-white/15"
                      : "menu-item-inactive"
                  }`}
                >
                  {nav.icon && (
                    <span className="menu-item-icon-size">{nav.icon}</span>
                  )}

                  {(isExpanded || isHovered || isMobileOpen) && (
                    <span className="menu-item-text">{nav.name}</span>
                  )}

                  {(isExpanded || isHovered || isMobileOpen) && (
                    <ChevronDownIcon
                      className={`ml-auto w-5 h-5 transition-all ${
                        isOpen ? "rotate-180 text-brand-500" : ""
                      }`}
                    />
                  )}
                </button>

                {(isExpanded || isHovered || isMobileOpen) && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen ? "max-h-[1000px] mt-2" : "max-h-0"
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
                    isActive(nav.path)
                      ? "menu-item-active shadow-sm ring-1 ring-white/15"
                      : "menu-item-inactive"
                  }`}
                >
                  {nav.icon && (
                    <span className="menu-item-icon-size">{nav.icon}</span>
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
      className={`fixed top-0 left-0 z-50 mt-16 flex h-[calc(100vh-4rem)] flex-col border-r border-[#5D28A8] bg-[#13538A] text-white transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:mt-0 lg:h-screen
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
        className={`shrink-0 border-b border-white/10 px-4 py-4 ${
          !isExpanded && !isHovered ? "lg:flex lg:justify-center" : ""
        }`}
      >
        <Link to="/" className="block">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">Loan Automation</p>
                <p className="truncate text-[11px] text-white/60">Super Admin Portal</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/20">
              <img
                src="/loanAutomation.jpeg"
                alt="Logo"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </Link>
      </div>

      <div className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <nav className="space-y-6 pb-4">
          <div>
            <h2
              className={`mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/45 ${
                !isExpanded && !isHovered ? "lg:text-center" : ""
              }`}
            >
              {isExpanded || isHovered || isMobileOpen ? (
                "Menu"
              ) : (
                <HorizontaLDots className="mx-auto size-5" />
              )}
            </h2>
            {renderMenuItems(visibleNavItems, "main")}
          </div>

          <div>
            <h2
              className={`mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/45 ${
                !isExpanded && !isHovered ? "lg:text-center" : ""
              }`}
            >
              {isExpanded || isHovered || isMobileOpen ? (
                "Other Portals"
              ) : (
                <HorizontaLDots className="mx-auto size-5" />
              )}
            </h2>
            {renderMenuItems(visibleOthersItems, "others")}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
