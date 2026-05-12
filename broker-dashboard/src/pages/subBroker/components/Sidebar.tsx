import { BriefcaseBusiness, UserPen, LogOut } from "lucide-react";

import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const navItems = [
    {
      label: "Loan Pipeline",
      icon: BriefcaseBusiness,
      path: "/sub-broker/loan-pipeline",
    },

    {
      label: "Profile",
      icon: UserPen,
      path: "/sub-broker/profile",
    },
  ];

  /* USER */
  const storedUser = JSON.parse(
    sessionStorage.getItem("sub_broker_user") || "{}",
  );

  const displayName =
    storedUser?.name ||
    `${storedUser?.firstName || ""} ${storedUser?.lastName || ""}`.trim() ||
    "Sub Broker";

  const profileImage = storedUser?.profileImage;

  return (
    <aside className="hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col dark:border-slate-800 dark:bg-[#020817]">
      {/* LOGO */}
      <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800">
        <div className="flex items-center justify-center">
          <img
            src="/ACOM_LOGO.jpeg"
            alt="ACOM Logo"
            className="h-16 w-auto object-contain"
          />
        </div>
      </div>

      {/* USER INFO */}
      <div className="border-b border-slate-200 px-4 py-5 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
          {/* AVATAR */}
          <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <img
              src={
                profileImage
                  ? profileImage.startsWith("http")
                    ? profileImage
                    : `${import.meta.env.VITE_API_BASE}${profileImage}`
                  : `https://ui-avatars.com/api/?name=${displayName}&background=0f172a&color=ffffff`
              }
              alt={displayName}
              className="h-full w-full object-cover"
            />
          </div>

          {/* TEXT */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-white">
              {displayName}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sub Broker
            </p>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 space-y-2 px-3 py-5">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `
relative flex items-center gap-3
rounded-r-2xl rounded-l-xl
px-5 py-3
text-sm font-semibold
transition-all duration-200

${
  isActive
    ? `
bg-[#dbeafe]
text-[#2563eb]

before:absolute
before:left-0
before:top-1/2
before:h-[70%]
before:w-1
before:-translate-y-1/2
before:rounded-r-full
before:bg-[#2563eb]
`
    : `
text-slate-600
hover:bg-slate-100
hover:text-slate-900

dark:text-slate-300
dark:hover:bg-slate-800
dark:hover:text-white
`
}
`
              }
            >
              <Icon size={18} strokeWidth={2.2} />

              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <button
          onClick={() => {
            sessionStorage.removeItem("sub_broker_token");

            sessionStorage.removeItem("sub_broker_user");

            window.location.href = "/sub-broker/login";
          }}
          className="
w-full rounded-2xl
border border-red-200
bg-red-50
px-4 py-3
text-sm font-semibold
text-red-600
transition-all duration-200

hover:bg-red-100
hover:border-red-300

active:scale-[0.98]

dark:border-red-500/20
dark:bg-red-500/10
dark:text-red-400
dark:hover:bg-red-500/20
"
        >
          <div className="flex items-center justify-center gap-2">
            <LogOut size={16} />
            Logout
          </div>
        </button>
      </div>
    </aside>
  );
}
