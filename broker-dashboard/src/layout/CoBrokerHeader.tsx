import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_PROFILE_UPDATED_EVENT,
  CO_BROKER_ROLE_LABEL,
  CO_BROKER_USER_KEY,
  getCoBrokerAuthHeaders,
  readStoredCoBrokerBranding,
  resolveCoBrokerLogoUrl,
} from "../lib/coBrokerPortal";
import { useSidebar } from "../context/SidebarContext";
import CoBrokerNotificationDropdown from "../components/header/CoBrokerNotificationDropdown";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";

type CoBrokerHeaderUser = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
  organization?: { name?: string | null } | null;
  user?: CoBrokerHeaderUser;
};

function toTitleCase(value?: string) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveDisplayName(user: CoBrokerHeaderUser | null) {
  if (!user) return CO_BROKER_ROLE_LABEL;
  const source =
    user.user && !(user.firstName || user.lastName || user.name)
      ? user.user
      : user;
  if (source.name?.trim()) return source.name.trim();
  const combined = `${source.firstName || ""} ${source.lastName || ""}`.trim();
  return combined || CO_BROKER_ROLE_LABEL;
}

function readStoredUser(): CoBrokerHeaderUser | null {
  try {
    const raw = sessionStorage.getItem(CO_BROKER_USER_KEY);
    return raw ? (JSON.parse(raw) as CoBrokerHeaderUser) : null;
  } catch {
    return null;
  }
}

export default function CoBrokerHeader() {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const branding = readStoredCoBrokerBranding();
  const [user, setUser] = useState<CoBrokerHeaderUser | null>(() =>
    readStoredUser(),
  );
  const [time, setTime] = useState("");

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const fetchAuthUser = useCallback(async () => {
    try {
      const res = await fetch(`${CO_BROKER_API_BASE}/subbroker/auth/me`, {
        method: "GET",
        headers: getCoBrokerAuthHeaders(""),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.data) return;

      const payload = json.data;
      const apiUser = (payload.user || payload) as CoBrokerHeaderUser;
      const orgName =
        payload.organization?.name ||
        apiUser.organizationName ||
        apiUser.organization?.name ||
        branding.brandName ||
        null;

      const nextUser: CoBrokerHeaderUser = {
        ...apiUser,
        organizationName: orgName,
        organization: payload.organization || apiUser.organization || null,
      };

      setUser(nextUser);
      try {
        const existing = readStoredUser() || {};
        sessionStorage.setItem(
          CO_BROKER_USER_KEY,
          JSON.stringify({ ...existing, ...nextUser }),
        );
      } catch {
        /* ignore */
      }
    } catch {
      /* keep stored user */
    }
  }, [branding.brandName]);

  useEffect(() => {
    void fetchAuthUser();

    const onProfileUpdated = () => {
      setUser(readStoredUser());
      void fetchAuthUser();
    };

    window.addEventListener(CO_BROKER_PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () =>
      window.removeEventListener(
        CO_BROKER_PROFILE_UPDATED_EVENT,
        onProfileUpdated,
      );
  }, [fetchAuthUser]);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleString("en-US", { month: "short" });
      const year = now.getFullYear();
      const clock = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      setTime(`${day} ${month} ${year} , ${clock}`);
    };

    updateDateTime();
    const interval = window.setInterval(updateDateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const welcomeName = toTitleCase(resolveDisplayName(user));
  const orgName =
    user?.organizationName ||
    user?.organization?.name ||
    branding.brandName ||
    CO_BROKER_ROLE_LABEL;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-14 items-center gap-3 px-4 lg:h-16 lg:px-6">
        <button
          type="button"
          onClick={handleToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          aria-label={isMobileOpen ? "Close menu" : "Open menu"}
        >
          <Menu size={18} />
        </button>

        <img
          src={resolveCoBrokerLogoUrl(branding.logoUrl)}
          alt={branding.brandName || "Portal logo"}
          className="h-8 w-8 rounded-lg object-cover ring-2 ring-[#13538A]/15 lg:hidden"
        />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white lg:text-lg">
            Welcome{" "}
            <span className="text-[#3e86b7] dark:text-[#5ba8d4]">
              {welcomeName}
            </span>
          </h1>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {orgName}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden whitespace-nowrap text-sm font-semibold text-[#3e86b7] dark:text-[#5ba8d4] sm:inline">
            {time}
          </span>
          <ThemeToggleButton />
          <CoBrokerNotificationDropdown />
        </div>
      </div>
    </header>
  );
}
