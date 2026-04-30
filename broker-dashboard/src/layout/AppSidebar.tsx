import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../icons";

import { useSidebar } from "../context/SidebarContext";

import { MdEmail, MdWeb } from "react-icons/md";
import { FaAppStore } from "react-icons/fa6";
import { MdOutlineDocumentScanner } from "react-icons/md";
import { FaUsersBetweenLines, FaUserGroup } from "react-icons/fa6";
import { PiSecurityCameraFill } from "react-icons/pi";
import { TbTemplate } from "react-icons/tb";
import { TrendingUp } from "lucide-react";
import { MdSettings } from "react-icons/md";

type NavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  subItems?: NavItem[];
};

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  // FIX: allow multiple open menus
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  // const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
  //   {},
  // );
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const storedPerms = sessionStorage.getItem("permissions");
    const storedRoles = sessionStorage.getItem("roles");

    if (storedPerms) setPermissions(JSON.parse(storedPerms));
    if (storedRoles) setRoles(JSON.parse(storedRoles));
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("permissions");
    if (stored) {
      setPermissions(JSON.parse(stored));
    }
  }, []);

  const hasAccess = (key: string) => {
    if (roles.includes("BROKER_ADMIN")) return true; // ✅ admin bypass
    return permissions.includes(key);
  };

  const navItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: "Dashboard",
      path: "/",
    },

    ...(hasAccess("VIEW_PIPELINE")
      ? [
          {
            icon: <TrendingUp />,
            name: "Loan Pipeline",
            path: "/submit-applications",
          },
        ]
      : []),

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

    {
      icon: <TbTemplate />,
      name: "Loan Application Templates",
      path: "/templates",
    },

    {
      icon: <MdOutlineDocumentScanner />,
      name: "Active Application",
      path: "/active-application",
    },
    {
      icon: <FaUserGroup />,
      name: "User Management",
      subItems: [
        { name: "Brokers", path: "/create-broker" },
        { name: "Loan Officer", path: "/loan-officer" },
        { name: "Contacts", path: "/contacts-list" },
      ],
    },

    {
      icon: <FaUsersBetweenLines />,
      name: "Lender Interactions",
      subItems: [
        { name: "My Lenders", path: "/my-lenders" },
        { name: "Invited Lenders", path: "/invited-lenders" },
        { name: "Find Lenders", path: "/find-lenders" },
      ],
    },

      {
      icon: <MdEmail />,
      name: "Email Marketing",
      path: "/email-marketing",
    },

    // SETTINGS WITH NESTED APPLICATION BUILDER
    {
      icon: <MdSettings />,
      name: "Settings",
      subItems: [
        {
          icon: <FaAppStore />,
          name: "Application Builder",
          subItems: [
            { name: "Create Application", path: "/create-application" },
            { name: "Loan Application Config", path: "/application-config" },
            { name: "Add Sections", path: "/add-section" },
            { name: "Application Builder", path: "/application" },
          ],
        },
      ],
    },

    {
      icon: <PiSecurityCameraFill />,
      name: "Dashboard Logs",
      path: "/admin-logs",
    },
  ];

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
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
      let result: Record<string, boolean> = {};

      items.forEach((item, index) => {
        const key = parentKey ? `${parentKey}-${index}` : `${index}`;

        if (item.subItems) {
          const childActive = hasActiveChild(item.subItems);

          if (childActive) {
            result[key] = true;
          }

          Object.assign(result, findActiveMenus(item.subItems, key));
        }
      });

      return result;
    };

    setOpenMenus(findActiveMenus(navItems));
  }, [location.pathname]);

  // useEffect(() => {
  //   Object.keys(openMenus).forEach((key) => {
  //     if (openMenus[key] && subMenuRefs.current[key]) {
  //       setSubMenuHeight((prev) => ({
  //         ...prev,
  //         [key]: subMenuRefs.current[key]?.scrollHeight || 0,
  //       }));
  //     }
  //   });
  // }, [openMenus]);

  const hasActiveChild = (items?: NavItem[]): boolean => {
    if (!items) return false;

    return items.some((item) => {
      if (item.path && isActive(item.path)) return true;
      if (item.subItems) return hasActiveChild(item.subItems);
      return false;
    });
  };

  const renderMenuItems = (items: NavItem[], level = 0, parentKey = "") => (
    <ul className={`flex flex-col gap-2 ${level > 0 ? "ml-4 mt-1" : ""}`}>
      {items.map((nav, index) => {
        const key = parentKey ? `${parentKey}-${index}` : `${index}`;
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
                    <span className="menu-item-text text-sm">{nav.name}</span>
                  )}

                  {(isExpanded || isHovered || isMobileOpen) && (
                    <ChevronDownIcon
                      className={`ml-auto w-5 h-5 transition-all duration-200 ${
                        isOpen
                          ? "rotate-180 text-white"
                          : "text-gray-400 group-hover:text-white"
                      }`}
                    />
                  )}
                </button>

                {(isExpanded || isHovered || isMobileOpen) && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen
                        ? "max-h-[1000px] opacity-100 mt-2"
                        : "max-h-0 opacity-0"
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
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white border-gray-200 dark:bg-gray-900 
text-gray-800 dark:text-gray-200 dark:border-gray-800 h-screen transition-all duration-300 ease-in-out z-50 border-r
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
          <h2
            className={`mb-4 text-xs uppercase flex text-gray-300 ${
              !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
            }`}
          >
            {isExpanded || isHovered || isMobileOpen ? (
              "Menu"
            ) : (
              <HorizontaLDots className="size-6" />
            )}
          </h2>

          {renderMenuItems(navItems)}
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
