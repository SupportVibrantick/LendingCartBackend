import { BriefcaseBusiness, LogOut, UserPen, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_PORTAL_LABEL,
  CO_BROKER_ROLE_LABEL,
  CO_BROKER_USER_KEY,
  clearCoBrokerSession,
  exitCoBrokerImpersonation,
  fetchCoBrokerBranding,
  isCoBrokerImpersonationSession,
  readStoredCoBrokerBranding,
  resolveCoBrokerLogoUrl,
  type CoBrokerBranding,
} from "../../../lib/coBrokerPortal";

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
};

const workspaceNav: NavItem[] = [
  {
    label: "Loan Pipeline",
    icon: BriefcaseBusiness,
    path: "/sub-broker/loan-pipeline",
  },
];

const accountNav: NavItem[] = [
  { label: "Profile", icon: UserPen, path: "/sub-broker/profile" },
];

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="mb-1.5 px-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#13538A]/10 text-[#13538A] shadow-[inset_2px_0_0_0_#13538A] dark:bg-[#13538A]/20 dark:text-cyan-300"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                      isActive
                        ? "bg-[#13538A]/12 text-[#13538A] dark:bg-[#13538A]/25 dark:text-cyan-300"
                        : "text-gray-400 group-hover:text-[#13538A] dark:text-gray-500 dark:group-hover:text-cyan-400"
                    }`}
                  >
                    <Icon size={14} strokeWidth={2} />
                  </span>
                  <span className="truncate leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [branding, setBranding] = useState<CoBrokerBranding>(
    readStoredCoBrokerBranding(),
  );

  const storedUser = JSON.parse(sessionStorage.getItem(CO_BROKER_USER_KEY) || "{}");

  const displayName =
    storedUser?.name ||
    `${storedUser?.firstName || ""} ${storedUser?.lastName || ""}`.trim() ||
    CO_BROKER_ROLE_LABEL;

  const profileImage = storedUser?.profileImage;
  const brandTitle = branding.brandName || "Loan Automation";
  const isImpersonation = isCoBrokerImpersonationSession();

  useEffect(() => {
    fetchCoBrokerBranding().then(setBranding);
  }, []);

  const handleNavClick = () => {
    onMobileClose?.();
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } transition-transform duration-300 ease-out`}
      >
        <div className="relative shrink-0 border-b border-gray-100 px-3.5 py-3 dark:border-gray-800">
          <div className="absolute inset-0 bg-gradient-to-br from-[#13538A]/6 via-transparent to-[#2C92D5]/8 dark:from-[#13538A]/12 dark:to-[#2C92D5]/10" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src={resolveCoBrokerLogoUrl(branding.logoUrl)}
                alt={brandTitle}
                className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-700"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold leading-tight text-gray-900 dark:text-white">
                  {brandTitle}
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#13538A] dark:text-cyan-400">
                  {CO_BROKER_PORTAL_LABEL}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 lg:hidden dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
          <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-[#13538A]/15">
              <img
                src={
                  profileImage
                    ? profileImage.startsWith("http")
                      ? profileImage
                      : `${CO_BROKER_API_BASE}${profileImage}`
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=13538A&color=ffffff&size=64`
                }
                alt={displayName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-tight text-gray-900 dark:text-white">
                {displayName}
              </p>
              <p className="truncate text-[10px] text-[#13538A] dark:text-cyan-400">
                {CO_BROKER_ROLE_LABEL}
              </p>
            </div>
          </div>
        </div>

        <nav className="sidebar-scrollbar-light min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2.5 py-3">
          <NavSection title="Workspace" items={workspaceNav} onNavigate={handleNavClick} />
          <NavSection title="Account" items={accountNav} onNavigate={handleNavClick} />
        </nav>

        <div className="shrink-0 border-t border-gray-100 px-3 py-2.5 dark:border-gray-800">
          <button
            type="button"
            onClick={() => {
              if (isImpersonation) {
                exitCoBrokerImpersonation();
                return;
              }

              clearCoBrokerSession();
              window.location.href = "/sub-broker/login";
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200/70 bg-red-50/70 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
          >
            <LogOut size={13} />
            {isImpersonation ? "Close portal tab" : "Logout"}
          </button>
          <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600">
            LendingCart · v1
          </p>
        </div>
      </aside>
    </>
  );
}
