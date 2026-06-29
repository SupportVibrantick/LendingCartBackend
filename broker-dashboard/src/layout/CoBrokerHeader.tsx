import { Menu, X } from "lucide-react";
import {
  CO_BROKER_ROLE_LABEL,
  CO_BROKER_USER_KEY,
  readStoredCoBrokerBranding,
  resolveCoBrokerLogoUrl,
} from "../lib/coBrokerPortal";

type CoBrokerHeaderProps = {
  onMenuClick: () => void;
  mobileOpen: boolean;
};

export default function CoBrokerHeader({
  onMenuClick,
  mobileOpen,
}: CoBrokerHeaderProps) {
  const storedUser = JSON.parse(sessionStorage.getItem(CO_BROKER_USER_KEY) || "{}");
  const branding = readStoredCoBrokerBranding();

  const displayName =
    storedUser?.name ||
    `${storedUser?.firstName || ""} ${storedUser?.lastName || ""}`.trim() ||
    CO_BROKER_ROLE_LABEL;

  const orgName = storedUser?.organizationName || branding.brandName;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95 lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <img
          src={resolveCoBrokerLogoUrl(branding.logoUrl)}
          alt={branding.brandName || "Portal logo"}
          className="h-8 w-8 rounded-lg object-cover ring-2 ring-[#13538A]/15"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {displayName}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {orgName || CO_BROKER_ROLE_LABEL}
          </p>
        </div>
      </div>
    </header>
  );
}
