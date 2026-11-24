import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ClipboardList,
  FileSignature,
  LayoutGrid,
  Lock,
  Menu,
  Receipt,
  X,
} from "lucide-react";
import {
  FiLogOut,
  FiMessageCircle,
  FiUploadCloud,
  FiFileText,
} from "react-icons/fi";
import { Pencil } from "lucide-react";
import "./clientPortalTheme.css";

export const CP = {
  sidebar: "#FFFFFF",
  workspace: "#F7F9FC",
  card: "#FFFFFF",
  primary: "#4C78F5",
  text: "#111827",
  secondary: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

export const LOAN_AUTOMATION_LOGO = "/loanAutomation.jpeg";

export type ApplicationWorkspaceTab =
  | "application"
  | "documents"
  | "termSheet"
  | "signForms"
  | "feeAgreement"
  | "chat";

type WorkspaceNavIcon = React.ComponentType<{
  size?: number;
  className?: string;
  strokeWidth?: number;
}>;

export const APPLICATION_WORKSPACE_SECTIONS: Array<{
  id: string;
  label: string;
  items: Array<{
    key: ApplicationWorkspaceTab;
    label: string;
    icon: WorkspaceNavIcon;
  }>;
}> = [
  {
    id: "application",
    label: "Application",
    items: [
      { key: "application", label: "Loan Application", icon: LayoutGrid },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    items: [
      { key: "documents", label: "Upload Documents", icon: FiUploadCloud },
      { key: "termSheet", label: "Term Sheet", icon: FileSignature },
      { key: "signForms", label: "Fill & Sign Forms", icon: ClipboardList },
      { key: "feeAgreement", label: "Fee Agreement", icon: Receipt },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [{ key: "chat", label: "Chat", icon: FiMessageCircle }],
  },
];

type ClientPortalChromeProps = {
  mode: "applications" | "workspace";
  activeTab?: ApplicationWorkspaceTab;
  onTabChange?: (tab: ApplicationWorkspaceTab) => void;
  onBackToApplications?: () => void;
  chatEnabled?: boolean;
  displayName: string;
  displayEmail: string;
  clientInitials: string;
  isImpersonation?: boolean;
  onLogout: () => void;
  onEditProfile?: () => void;
  notifications?: ReactNode;
  searchSlot?: ReactNode;
  applicationNumber?: string;
  statusChip?: ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  secureBadge?: boolean;
  compact?: boolean;
  children: ReactNode;
};

export default function ClientPortalChrome({
  mode,
  activeTab,
  onTabChange,
  onBackToApplications,
  chatEnabled = true,
  displayName,
  clientInitials,
  isImpersonation = false,
  onLogout,
  onEditProfile,
  notifications,
  searchSlot,
  applicationNumber,
  statusChip,
  pageTitle,
  pageSubtitle,
  secureBadge = true,
  compact = false,
  children,
}: ClientPortalChromeProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [mode, activeTab]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const workspaceSections = APPLICATION_WORKSPACE_SECTIONS.filter(
    (section) => chatEnabled || section.id !== "communication",
  );

  const renderWorkspaceNav = (opts?: { compact?: boolean }) =>
    workspaceSections.map((section, sectionIndex) => (
      <div
        key={section.id}
        className={
          opts?.compact ? "contents" : sectionIndex > 0 ? "mt-6" : ""
        }
      >
        {!opts?.compact ? (
          <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            {section.label}
          </h2>
        ) : null}
        <ul
          className={
            opts?.compact ? "flex gap-1.5" : "flex flex-col gap-1"
          }
        >
          {section.items.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <li
                key={tab.key}
                className={opts?.compact ? "shrink-0" : undefined}
              >
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onTabChange?.(tab.key)}
                  className={
                    opts?.compact
                      ? `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          isActive
                            ? "bg-[#4C78F5] text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`
                      : `relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-[#4C78F5] text-white shadow-sm"
                            : "text-[#64748B] hover:bg-[#F7F9FC] hover:text-[#111827]"
                        }`
                  }
                >
                  <Icon
                    size={opts?.compact ? 14 : 18}
                    strokeWidth={2.1}
                    className={`shrink-0 ${
                      opts?.compact
                        ? ""
                        : isActive
                          ? "text-white"
                          : "text-[#94A3B8]"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                    {tab.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    ));

  const sidebarContent = (
    <>
      <div className="shrink-0 border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4C78F5] ring-1 ring-[#E2E8F0]">
            <img
              src={LOAN_AUTOMATION_LOGO}
              alt="Loan Automation"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight text-[#111827]">
              LoanAutomation
            </p>
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
              Client Portal
            </p>
          </div>
        </div>
      </div>

      <nav
        aria-label="Client portal navigation"
        className="cp-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3"
      >
        {mode === "applications" ? (
          <div className="flex min-h-full flex-col">
            <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
              My Loans
            </h2>
            <ul className="flex flex-col gap-1">
              <li>
                <button
                  type="button"
                  aria-current="page"
                  className="relative flex w-full items-center gap-3 rounded-lg bg-[#4C78F5] px-3 py-2.5 text-left text-[14px] font-medium text-white shadow-sm"
                >
                  <FiFileText size={18} className="shrink-0" />
                  <span>Applications</span>
                </button>
              </li>
            </ul>

            {/* Fills empty sidebar space with useful guidance */}
            <div className="mt-5 rounded-[10px] border border-[#E2E8F0] bg-[#F7F9FC] p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4C78F5]">
                Inside each loan
              </p>
              <ul className="mt-3 space-y-2.5">
                {[
                  { icon: FiUploadCloud, label: "Upload documents" },
                  { icon: FileSignature, label: "Review term sheet" },
                  { icon: ClipboardList, label: "Fill & sign forms" },
                  { icon: Receipt, label: "Fee agreement" },
                  { icon: FiMessageCircle, label: "Chat with your broker" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.label}
                      className="flex items-center gap-2.5 text-[12px] text-[#64748B]"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[#4C78F5] ring-1 ring-[#E2E8F0]">
                        <Icon size={13} />
                      </span>
                      <span className="leading-snug">{item.label}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-[#94A3B8]">
                Open an application to access these tools.
              </p>
            </div>

            <div className="mt-auto pt-4">
              <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                    <Lock size={12} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#111827]">
                      Secure access
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
                      Signed in as{" "}
                      <span className="font-medium text-[#111827]">
                        {displayName}
                      </span>
                      . Contact your broker if you need help.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          renderWorkspaceNav()
        )}
      </nav>

      {mode === "workspace" && onBackToApplications ? (
        <div className="shrink-0 border-t border-[#E2E8F0] bg-white p-3">
          <button
            type="button"
            onClick={onBackToApplications}
            className="relative flex w-full items-center justify-center gap-2 rounded-lg bg-[#4C78F5] px-3 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#3B66E0]"
          >
            <ChevronLeft size={18} className="shrink-0" strokeWidth={2.4} />
            <span className="truncate">Back to Applications</span>
          </button>
        </div>
      ) : null}
    </>
  );

  const resolvedTitle =
    pageTitle ||
    (mode === "applications" ? "Borrower Portal" : "Loan Application");

  return (
    <div className="client-portal flex h-dvh w-full overflow-hidden bg-[#F7F9FC]">
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-[#E2E8F0] bg-white lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-[#E2E8F0] bg-white shadow-2xl">
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-[#64748B] hover:bg-[#F7F9FC] hover:text-[#111827]"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header — compact */}
        <header className="z-20 flex h-11 shrink-0 items-center gap-2 border-b border-[#E2E8F0] bg-white px-3 sm:gap-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-slate-600 transition hover:bg-slate-50 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>

          <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
            <span className="truncate text-[13px] font-semibold text-[#111827]">
              LoanAutomation
            </span>
            <span className="hidden text-[#E2E8F0] md:inline">|</span>
            <span className="hidden truncate text-[12px] text-[#64748B] md:inline">
              Client Portal
            </span>
          </div>

          <div className="mx-auto hidden w-full max-w-md flex-1 md:block">
            {searchSlot}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {notifications}
            {onEditProfile ? (
              <button
                type="button"
                onClick={onEditProfile}
                className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2 text-left transition hover:bg-slate-50"
                title="Edit profile"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4C78F5]/10 text-[10px] font-bold text-[#4C78F5]">
                  {clientInitials}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="max-w-[110px] truncate text-[12px] font-semibold leading-none text-[#111827]">
                    {displayName}
                  </p>
                </div>
                <Pencil size={12} className="hidden text-slate-400 sm:block" />
              </button>
            ) : (
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4C78F5]/10 text-[10px] font-bold text-[#4C78F5]">
                  {clientInitials}
                </div>
                <span className="hidden max-w-[110px] truncate text-[12px] font-semibold text-[#111827] sm:inline">
                  {displayName}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[12px] font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <FiLogOut size={14} />
              <span className="hidden sm:inline">
                {isImpersonation ? "Close tab" : "Logout"}
              </span>
            </button>
          </div>
        </header>

        {/* Mobile workspace tabs */}
        {mode === "workspace" ? (
          <div className="border-b border-[#E2E8F0] bg-white lg:hidden">
            <div className="overflow-x-auto px-2 py-2">
              <div className="flex gap-1.5">
                {renderWorkspaceNav({ compact: true })}
              </div>
            </div>
          </div>
        ) : null}

        {searchSlot ? (
          <div className="border-b border-[#E2E8F0] bg-white px-3 py-2 md:hidden">
            {searchSlot}
          </div>
        ) : null}

        <div
          className={`cp-scroll min-h-0 flex-1 ${
            compact ? "flex flex-col overflow-hidden" : "overflow-y-auto"
          }`}
        >
          <div
            className={`w-full ${
              compact
                ? "flex min-h-0 flex-1 flex-col overflow-hidden p-2.5 sm:p-3 lg:p-3.5"
                : "space-y-3 p-2.5 sm:p-3 md:p-4 lg:pl-3 lg:pr-4"
            }`}
          >
            {!compact ? (
              <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-2.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h1 className="text-[18px] font-semibold leading-tight tracking-tight text-[#111827] sm:text-[20px]">
                        {resolvedTitle}
                      </h1>
                      {mode === "workspace" ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {applicationNumber ? (
                            <span className="rounded-md bg-[#4C78F5]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#4C78F5]">
                              {applicationNumber}
                            </span>
                          ) : null}
                          {statusChip}
                          {displayName ? (
                            <span className="truncate rounded-md bg-[#F7F9FC] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                              {displayName}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {pageSubtitle ? (
                      <p className="mt-0.5 text-[12px] text-[#64748B]">
                        {pageSubtitle}
                      </p>
                    ) : null}
                  </div>
                  {secureBadge ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      <Lock size={11} className="text-emerald-600" />
                      Secure magic-link access
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              className={
                compact ? "min-h-0 flex-1 overflow-hidden" : "min-w-0"
              }
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
