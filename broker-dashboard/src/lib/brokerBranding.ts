import { BROKER_API_BASE } from "./brokerApi";
import { getPortalAuthHeaders, isLoanOfficerPortalPath } from "./portalAuth";

export const DEFAULT_BROKER_LOGO = "/loanAutomation.jpeg";
export const BROKER_BRANDING_KEY = "broker_branding";
export const LO_BRANDING_KEY = "loan_officer_branding";
export const BROKER_BRANDING_UPDATED_EVENT = "broker-branding-updated";

export type BrokerPortalKind = "broker" | "loan-officer";

export type BrokerPortalBranding = {
  logoUrl: string;
  brandName: string | null;
  portalLabel?: string;
  defaultLogoUrl?: string;
};

const DEFAULT_LABELS: Record<BrokerPortalKind, string> = {
  broker: "Broker Suite",
  "loan-officer": "Loan Officer",
};

function brandingStorageKey(portal: BrokerPortalKind) {
  return portal === "loan-officer" ? LO_BRANDING_KEY : BROKER_BRANDING_KEY;
}

function brandingEndpoint(portal: BrokerPortalKind) {
  return portal === "loan-officer"
    ? `${BROKER_API_BASE}/loanofficer/auth/branding`
    : `${BROKER_API_BASE}/broker/auth/branding`;
}

export function resolveBrokerLogoUrl(
  logoUrl?: string | null,
  apiBase = BROKER_API_BASE,
): string {
  if (!logoUrl) return DEFAULT_BROKER_LOGO;

  if (
    logoUrl.startsWith("http://") ||
    logoUrl.startsWith("https://") ||
    logoUrl.startsWith("data:")
  ) {
    return logoUrl;
  }

  if (logoUrl.startsWith("/") && !logoUrl.startsWith("/uploads")) {
    return logoUrl;
  }

  return `${apiBase}${logoUrl.startsWith("/") ? logoUrl : `/${logoUrl}`}`;
}

export function readStoredBrokerBranding(
  portal: BrokerPortalKind = "broker",
): BrokerPortalBranding {
  try {
    const raw = sessionStorage.getItem(brandingStorageKey(portal));
    if (!raw) {
      return {
        logoUrl: DEFAULT_BROKER_LOGO,
        brandName: null,
        portalLabel: DEFAULT_LABELS[portal],
      };
    }
    return JSON.parse(raw) as BrokerPortalBranding;
  } catch {
    return {
      logoUrl: DEFAULT_BROKER_LOGO,
      brandName: null,
      portalLabel: DEFAULT_LABELS[portal],
    };
  }
}

export function storeBrokerBranding(
  branding: BrokerPortalBranding,
  portal: BrokerPortalKind = "broker",
) {
  sessionStorage.setItem(brandingStorageKey(portal), JSON.stringify(branding));
}

export function clearStoredBrokerBranding(portal?: BrokerPortalKind) {
  if (portal) {
    sessionStorage.removeItem(brandingStorageKey(portal));
    return;
  }
  sessionStorage.removeItem(BROKER_BRANDING_KEY);
  sessionStorage.removeItem(LO_BRANDING_KEY);
}

export function emitBrokerBrandingUpdated(
  branding: BrokerPortalBranding,
  portal: BrokerPortalKind = "broker",
) {
  storeBrokerBranding(branding, portal);
  window.dispatchEvent(
    new CustomEvent(BROKER_BRANDING_UPDATED_EVENT, {
      detail: { branding, portal },
    }),
  );
}

export function detectBrokerPortalKind(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): BrokerPortalKind {
  return isLoanOfficerPortalPath(pathname) ? "loan-officer" : "broker";
}

export async function fetchBrokerPortalBranding(
  portal: BrokerPortalKind = detectBrokerPortalKind(),
): Promise<BrokerPortalBranding> {
  const fallback: BrokerPortalBranding = {
    logoUrl: DEFAULT_BROKER_LOGO,
    brandName: null,
    portalLabel: DEFAULT_LABELS[portal],
  };

  try {
    const res = await fetch(brandingEndpoint(portal), {
      headers: getPortalAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      return readStoredBrokerBranding(portal).brandName
        ? readStoredBrokerBranding(portal)
        : fallback;
    }

    const branding: BrokerPortalBranding = {
      logoUrl: json.data?.logoUrl || DEFAULT_BROKER_LOGO,
      brandName: json.data?.brandName || null,
      portalLabel: json.data?.portalLabel || DEFAULT_LABELS[portal],
      defaultLogoUrl: json.data?.defaultLogoUrl || DEFAULT_BROKER_LOGO,
    };

    storeBrokerBranding(branding, portal);
    return branding;
  } catch {
    const stored = readStoredBrokerBranding(portal);
    return stored.brandName || stored.logoUrl !== DEFAULT_BROKER_LOGO
      ? stored
      : fallback;
  }
}
