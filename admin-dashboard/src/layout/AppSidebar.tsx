import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

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

import { FaAppStore } from "react-icons/fa6";
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
import { Mail, TrendingUp } from "lucide-react";

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
    icon: <GroupsOutlinedIcon />,
    name: "Broker Database",
    path: "/all-brokers-database",
  },
  // {
  //   icon: <GroupsOutlinedIcon />,
  //   name: "Broker Organizations",
  //   subItems: [
  //     { name: "Brokers Organization", path: "/all-brokers-Organization" },
  //     { name: "Broker Assigned Lenders", path: "/all-brokers-lenders" },
  //   ],
  // },
  {
    icon: <FaAppStore />,
    name: "Application Builder",
    subItems: [
      { name: "Create Application", path: "/create-application" },
      { name: "Loan Application Config", path: "/loan-application-config" },
      { name: "Add Sections", path: "/add-app-sections" },
      { name: "Application Builder", path: "/application-builder" },
      { name: "Active Application", path: "/active-application" },
    ],
  },
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
  {
    icon: <AccountBalanceOutlinedIcon />,
    name: "Lender Database",
    path: "/all-lenders-Organization",
  },

  {
    icon: <TrendingUp />,
    name: "Loan Pipeline",
    path: "/loan-pipeline",
  },

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
  {
    icon: <Mail />,
    name: "Email Marketing",
    path: "/email-marketing",
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
      {
        name: "System Settings",
        path: "/system-settings",
      },
    ],
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

    setOpenMenus(findActiveMenus(navItems));
  }, [location.pathname]);

  const renderMenuItems = (
    items: NavItem[],
    menuType: "main" | "others",
    level = 0,
    parentKey = "",
  ) => (
    <ul className={`flex flex-col gap-4 ${level > 0 ? "ml-6 mt-2" : ""}`}>
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
                      ? "menu-item-active"
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
                      ? "menu-item-active"
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
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-[#13538A] text-white dark:bg-gray-900 dark:border-gray-800  h-screen transition-all duration-300 ease-in-out z-50 border-r border-[#5D28A8]
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
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="bg-white px-3 py-2 rounded">
              <img
                src="/ACOM_LOGO.png"
                alt="Logo"
                width={217}
                height={53}
                className="object-contain"
              />
            </div>
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others Portals"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        {/* {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null} */}
      </div>
    </aside>
  );
};

export default AppSidebar;
