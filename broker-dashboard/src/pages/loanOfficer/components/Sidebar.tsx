import {
  BriefcaseBusiness,
  UserPen,
  LogOut,
  FilePlus,
  Users,
  X,
  LayoutDashboard,
  // MessageSquare,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { LO_TOKEN_KEY, LO_USER_KEY, LO_API_BASE } from "../../../lib/loanOfficerApi";

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/loan-officer/dashboard",
    },
    {
      label: "Loan Pipeline",
      icon: BriefcaseBusiness,
      path: "/loan-officer/loan-pipeline",
    },
    {
      label: "New Application",
      icon: FilePlus,
      path: "/loan-officer/loan-application",
    },
    // {
    //   label: "Messages",
    //   icon: MessageSquare,
    //   path: "/loan-officer/messages",
    // },
    {
      label: "My Contacts",
      icon: Users,
      path: "/loan-officer/contacts",
    },
    {
      label: "Profile",
      icon: UserPen,
      path: "/loan-officer/profile",
    },
  ];

  const storedUser = JSON.parse(sessionStorage.getItem(LO_USER_KEY) || "{}");

  const displayName =
    storedUser?.name ||
    `${storedUser?.firstName || ""} ${storedUser?.lastName || ""}`.trim() ||
    "Loan Officer";

  const profileImage = storedUser?.profileImage;

  const handleNavClick = () => {
    onMobileClose?.();
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-800 dark:bg-gray-950 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-5 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <img
              src="/loanAutomation.jpeg"
              alt="Loan Automation"
              className="h-10 w-10 rounded-full ring-2 ring-[#13538A]/15"
            />
            <div>
              <p className="text-sm font-bold text-[#13538A]">Loan Automation</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                Officer Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onMobileClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden dark:hover:bg-gray-800"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
            <div className="h-11 w-11 overflow-hidden rounded-xl ring-2 ring-[#13538A]/10">
              <img
                src={
                  profileImage
                    ? profileImage.startsWith("http")
                      ? profileImage
                      : `${LO_API_BASE}${profileImage}`
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=13538A&color=ffffff`
                }
                alt={displayName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {displayName}
              </h3>
              <p className="text-xs text-[#13538A]">Loan Officer</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-[#13538A] text-white shadow-sm shadow-[#13538A]/20"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(LO_TOKEN_KEY);
              sessionStorage.removeItem(LO_USER_KEY);
              window.location.href = "/loan-officer/login";
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
