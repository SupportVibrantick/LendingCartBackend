import React, { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Box } from "@mui/material";

// React Icons (consistent visual style)
import {
  BiUser,
  BiBuilding,
  BiEnvelope,
  BiShieldQuarter,
  BiShield,
} from "react-icons/bi";

const settingLinks = [
  {
    label: "Account Settings",
    path: "/settings/account",
    icon: BiUser,
  },
  {
    label: "Company Settings",
    path: "/settings/company",
    icon: BiBuilding,
  },
  {
    label: "Two Factor",
    path: "/settings/twofactor",
    icon: BiShieldQuarter,
  },
  {
    label: "Email Settings",
    path: "/settings/email",
    icon: BiEnvelope,
  },
  {
    label: "Captcha Settings",
    path: "/settings/captcha",
    icon: BiShield,
  },
];

const SettingsLayout: React.FC = () => {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const darkActive = document.documentElement.classList.contains("dark");
      setIsDark(darkActive);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "270px 1fr" },
        gap: 3,
        mt: 2,
        alignItems: "flex-start",
      }}
    >
      {/* Sidebar */}
      <aside
        className={`rounded-xl border ${
          isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"
        } shadow-sm p-4 transition-colors duration-300`}
      >
        <h2
          className={`text-lg font-semibold mb-4 ${
            isDark ? "text-gray-100" : "text-gray-900"
          }`}
        >
          Settings
        </h2>

        <ul className="flex flex-col gap-1">
          {settingLinks.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => {
                    const activeBg = isDark
                      ? "bg-violet-600 text-white"
                      : "bg-violet-100 text-violet-700";
                    const inactiveBg = isDark
                      ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                      : "text-gray-700 hover:bg-gray-100";

                    return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? activeBg : inactiveBg
                    }`;
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex items-center justify-center w-5 h-5 transition-colors duration-200 ${
                          isActive
                            ? isDark
                              ? "text-white"
                              : "text-violet-700"
                            : isDark
                            ? "text-gray-300"
                            : "text-gray-600"
                        }`}
                      >
                        <Icon className="text-[18px]" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Content Area */}
      <Box
        className={`transition-colors duration-300 ${
          isDark ? "bg-gray-950 text-gray-100" : "text-gray-900"
        }`}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default SettingsLayout;
