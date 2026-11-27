import { useMemo, useState } from "react";
import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_ROLE_LABEL,
  clearCoBrokerSession,
  exitCoBrokerImpersonation,
  isCoBrokerImpersonationSession,
} from "../../lib/coBrokerPortal";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";

type CoBrokerDropdownUser = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImage?: string | null;
  organizationName?: string | null;
  organization?: { name?: string | null } | null;
  user?: CoBrokerDropdownUser;
};

function toTitleCase(value?: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getInitials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function resolveUser(user: CoBrokerDropdownUser | null) {
  if (!user) return null;
  if ((user.firstName || user.lastName || user.name || user.email) && !user.user) {
    return user;
  }
  return user.user || user;
}

export default function CoBrokerUserDropdown({
  user,
}: {
  user: CoBrokerDropdownUser | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const source = resolveUser(user);

  const displayName = useMemo(() => {
    if (!source) return CO_BROKER_ROLE_LABEL;
    if (source.name?.trim()) return source.name.trim();
    const combined = `${source.firstName || ""} ${source.lastName || ""}`.trim();
    return combined || CO_BROKER_ROLE_LABEL;
  }, [source]);

  const titledName = toTitleCase(displayName);
  const displayEmail = source?.email || "";
  const orgName =
    user?.organizationName ||
    user?.organization?.name ||
    source?.organizationName ||
    source?.organization?.name ||
    "";
  const initials = getInitials(titledName);

  const remoteAvatar = buildApiPublicFileUrl(
    CO_BROKER_API_BASE,
    source?.profileImage || undefined,
  );
  const avatarSrc = remoteAvatar
    ? `${remoteAvatar}${remoteAvatar.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(source?.profileImage || ""))}`
    : null;

  function closeDropdown() {
    setIsOpen(false);
  }

  function handleLogout() {
    closeDropdown();
    if (isCoBrokerImpersonationSession()) {
      exitCoBrokerImpersonation();
      return;
    }
    clearCoBrokerSession();
    navigate("/sub-broker/login");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`dropdown-toggle inline-flex h-9 items-center gap-2 rounded-lg border bg-white pl-1 pr-2 text-text-primary transition ${
          isOpen
            ? "border-[#4C78F5]/40 bg-[#4C78F5]/5"
            : "border-border hover:border-[#4C78F5]/30 hover:bg-surface"
        } dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {avatarSrc ? (
          <span className="h-7 w-7 overflow-hidden rounded-full bg-[#4C78F5]/10 ring-2 ring-[#4C78F5]/10">
            <img
              src={avatarSrc}
              alt={titledName}
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-bold tracking-wide text-white">
            {initials}
          </span>
        )}

        <span className="hidden max-w-[120px] truncate text-[13px] font-semibold sm:block">
          {titledName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-text-secondary transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#4C78F5]" : ""
          }`}
          aria-hidden
        />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-2 flex w-[280px] flex-col overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="border-b border-border px-3.5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {avatarSrc ? (
              <span className="h-10 w-10 overflow-hidden rounded-full bg-[#4C78F5]/10 ring-2 ring-[#4C78F5]/10">
                <img
                  src={avatarSrc}
                  alt={titledName}
                  className="h-full w-full object-cover"
                />
              </span>
            ) : (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#4C78F5] text-sm font-bold text-white">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary dark:text-white">
                {titledName}
              </p>
              {displayEmail ? (
                <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                  {displayEmail}
                </p>
              ) : null}
              {orgName ? (
                <p className="mt-1 truncate text-[11px] font-medium text-[#4C78F5]">
                  {orgName}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-0.5 p-2">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/sub-broker/profile"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-text-primary transition hover:bg-[#4C78F5]/5 hover:text-[#4C78F5] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                <UserRound className="h-4 w-4" />
              </span>
              Edit profile
            </DropdownItem>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                closeDropdown();
                navigate("/sub-broker/profile#password", {
                  replace: false,
                  state: { focusPassword: true, t: Date.now() },
                });
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-text-primary transition hover:bg-[#4C78F5]/5 hover:text-[#4C78F5] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                <KeyRound className="h-4 w-4" />
              </span>
              Change password
            </button>
          </li>
        </ul>

        <div className="border-t border-border p-2 dark:border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <LogOut className="h-4 w-4" />
            </span>
            Sign out
          </button>
        </div>
      </Dropdown>
    </div>
  );
}
