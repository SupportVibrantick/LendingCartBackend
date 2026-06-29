export const CO_BROKER_TOKEN_KEY = "sub_broker_token";
export const CO_BROKER_USER_KEY = "sub_broker_user";
export const CO_BROKER_BRANDING_KEY = "co_broker_branding";
export const BROKER_IMPERSONATOR_TOKEN_KEY = "broker_impersonator_token";
export const BROKER_IMPERSONATOR_USER_KEY = "broker_impersonator_user";

export const CO_BROKER_API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:4000";

export const DEFAULT_CO_BROKER_LOGO = "/loanAutomation.jpeg";
export const CO_BROKER_PORTAL_LABEL = "Co-Broker Portal";
export const CO_BROKER_ROLE_LABEL = "Co-Broker";

export type CoBrokerBranding = {
  logoUrl: string;
  brandName: string | null;
  portalLabel?: string;
  defaultLogoUrl?: string;
};

export function getCoBrokerAuthHeaders(
  contentType = "application/json",
): HeadersInit {
  const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function resolveCoBrokerLogoUrl(
  logoUrl?: string | null,
  apiBase = CO_BROKER_API_BASE,
): string {
  if (!logoUrl) return DEFAULT_CO_BROKER_LOGO;

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

export function readStoredCoBrokerBranding(): CoBrokerBranding {
  try {
    const raw = sessionStorage.getItem(CO_BROKER_BRANDING_KEY);
    if (!raw) {
      return { logoUrl: DEFAULT_CO_BROKER_LOGO, brandName: null };
    }
    return JSON.parse(raw) as CoBrokerBranding;
  } catch {
    return { logoUrl: DEFAULT_CO_BROKER_LOGO, brandName: null };
  }
}

export function storeCoBrokerBranding(branding: CoBrokerBranding) {
  sessionStorage.setItem(CO_BROKER_BRANDING_KEY, JSON.stringify(branding));
}

export async function fetchCoBrokerBranding(): Promise<CoBrokerBranding> {
  const fallback: CoBrokerBranding = {
    logoUrl: DEFAULT_CO_BROKER_LOGO,
    brandName: null,
    portalLabel: CO_BROKER_PORTAL_LABEL,
  };

  const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);
  if (!token) return fallback;

  try {
    const res = await fetch(`${CO_BROKER_API_BASE}/subbroker/auth/branding`, {
      headers: getCoBrokerAuthHeaders(),
    });

    const json = await res.json();

    if (!res.ok || !json.ok) return fallback;

    const branding: CoBrokerBranding = {
      logoUrl: json.data?.logoUrl || DEFAULT_CO_BROKER_LOGO,
      brandName: json.data?.brandName || null,
      portalLabel: json.data?.portalLabel || CO_BROKER_PORTAL_LABEL,
    };

    storeCoBrokerBranding(branding);
    return branding;
  } catch {
    return readStoredCoBrokerBranding();
  }
}

export function clearCoBrokerSession() {
  sessionStorage.removeItem(CO_BROKER_TOKEN_KEY);
  sessionStorage.removeItem(CO_BROKER_USER_KEY);
  sessionStorage.removeItem(CO_BROKER_BRANDING_KEY);
  sessionStorage.removeItem(BROKER_IMPERSONATOR_TOKEN_KEY);
  sessionStorage.removeItem(BROKER_IMPERSONATOR_USER_KEY);
}

type CoBrokerTokenPayload = {
  impersonatedBy?: string;
};

export function decodeCoBrokerToken(token: string): CoBrokerTokenPayload | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    return JSON.parse(
      atob(base64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as CoBrokerTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyCoBrokerSession(token: string): Promise<boolean> {
  const res = await fetch(`${CO_BROKER_API_BASE}/subbroker/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export function isCoBrokerImpersonationSession() {
  const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);
  if (!token) {
    return Boolean(sessionStorage.getItem(BROKER_IMPERSONATOR_TOKEN_KEY));
  }
  return Boolean(decodeCoBrokerToken(token)?.impersonatedBy);
}

export function exitCoBrokerImpersonation() {
  clearCoBrokerSession();
  window.close();
  window.setTimeout(() => {
    window.location.href = "/sub-broker/login";
  }, 150);
}

export function stashBrokerSessionForCoBrokerImpersonation() {
  const brokerToken = sessionStorage.getItem("broker_token");
  if (!brokerToken) {
    throw new Error("Broker session not found");
  }

  sessionStorage.setItem(BROKER_IMPERSONATOR_TOKEN_KEY, brokerToken);

  const brokerUser = sessionStorage.getItem("broker_user");
  if (brokerUser) {
    sessionStorage.setItem(BROKER_IMPERSONATOR_USER_KEY, brokerUser);
  }
}

export function restoreBrokerSessionFromCoBrokerImpersonation() {
  const brokerToken = sessionStorage.getItem(BROKER_IMPERSONATOR_TOKEN_KEY);
  if (!brokerToken) {
    throw new Error("Broker impersonation session not found");
  }

  clearCoBrokerSession();

  sessionStorage.setItem("broker_token", brokerToken);
  sessionStorage.removeItem(BROKER_IMPERSONATOR_TOKEN_KEY);

  const brokerUser = sessionStorage.getItem(BROKER_IMPERSONATOR_USER_KEY);
  if (brokerUser) {
    sessionStorage.setItem("broker_user", brokerUser);
    sessionStorage.removeItem(BROKER_IMPERSONATOR_USER_KEY);
  }

  window.location.href = "/sub-brokers";
}

export type CoBrokerImpersonationPayload = {
  token: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    organizationId?: string | null;
    organizationName?: string | null;
  };
  branding?: CoBrokerBranding;
  redirectTo?: string;
};

export function startCoBrokerImpersonationSession(
  payload: CoBrokerImpersonationPayload,
) {
  stashBrokerSessionForCoBrokerImpersonation();

  sessionStorage.setItem(CO_BROKER_TOKEN_KEY, payload.token);
  sessionStorage.setItem(
    CO_BROKER_USER_KEY,
    JSON.stringify({
      ...payload.user,
      name: `${payload.user.firstName || ""} ${payload.user.lastName || ""}`.trim(),
    }),
  );

  if (payload.branding) {
    storeCoBrokerBranding(payload.branding);
  }

  window.location.href = payload.redirectTo || "/sub-broker/loan-pipeline";
}
