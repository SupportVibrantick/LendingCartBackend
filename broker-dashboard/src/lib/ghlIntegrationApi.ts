import { brokerFetch } from "./brokerApi";

export type GhlAgencyLocationStatus = {
  provisioned: boolean;
  status: string;
  packageCode?: string | null;
  ghlLocationId?: string | null;
  dashboardUrl?: string | null;
};

export type GhlConnectionStatus = {
  connected: boolean;
  status: string;
  ghlLocationId?: string | null;
  ghlCompanyId?: string | null;
  scopes?: string[];
  connectedAt?: string | null;
  connectedByUserId?: string | null;
  tokenExpiresAt?: string | null;
  lastError?: string | null;
  updatedAt?: string | null;
  agencyLocation?: GhlAgencyLocationStatus | null;
};

type StatusResponse = {
  success: boolean;
  data: GhlConnectionStatus;
};

type ConnectResponse = {
  success: boolean;
  data: {
    authorizationUrl: string;
    expiresInSec: number;
  };
};

type DisconnectResponse = {
  success: boolean;
  message?: string;
  data?: {
    disconnected?: boolean;
    ghlLocationId?: string | null;
  };
};

export function isBrokerAdmin(): boolean {
  try {
    const roles = JSON.parse(sessionStorage.getItem("roles") || "[]") as string[];
    return Array.isArray(roles) && roles.includes("BROKER_ADMIN");
  } catch {
    return false;
  }
}

export async function fetchGhlConnectionStatus(): Promise<GhlConnectionStatus> {
  const json = await brokerFetch<StatusResponse>("/broker/integrations/ghl/status");
  return json.data;
}

type AgencySyncResponse = {
  success: boolean;
  message?: string;
  code?: string;
  data?: {
    agencyLocation?: GhlAgencyLocationStatus | null;
    action?: string;
    usersProvisioned?: number | null;
  };
};

/**
 * Retry Agency CRM location create/sync for Pro/Elite orgs.
 */
export async function syncAgencyCrmLocation(): Promise<{
  agencyLocation?: GhlAgencyLocationStatus | null;
  message?: string;
}> {
  const json = await brokerFetch<AgencySyncResponse>(
    "/broker/integrations/ghl/agency/sync",
    { method: "POST" },
  );
  return {
    agencyLocation: json.data?.agencyLocation ?? null,
    message: json.message,
  };
}

export async function startGhlOAuthConnect(): Promise<string> {
  const json = await brokerFetch<ConnectResponse>("/broker/integrations/ghl/connect");
  const url = json.data?.authorizationUrl;
  if (!url) {
    throw new Error("Connect URL was not returned by the server");
  }
  return url;
}

export async function disconnectGhlIntegration(): Promise<void> {
  await brokerFetch<DisconnectResponse>("/broker/integrations/ghl/disconnect", {
    method: "DELETE",
  });
}

export function maskGhlLocationId(locationId?: string | null): string {
  if (!locationId) return "—";
  const value = String(locationId).trim();
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function formatGhlConnectionDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Strip technical/provider details from OAuth callback messages. */
export function sanitizeGhlCallbackMessage(message?: string | null): string {
  if (!message) return "Failed to connect GoHighLevel. Please try again.";
  const trimmed = String(message).trim();
  if (!trimmed) return "Failed to connect GoHighLevel. Please try again.";
  if (
    /GHL_|leadconnector|gohighlevel|Bearer |api key|access_token|refresh_token|secret|stack|ECONN|ETIMEDOUT/i.test(
      trimmed,
    )
  ) {
    return "Failed to connect GoHighLevel. Please try again.";
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}

export function formatGhlConnectionStatusLabel(status?: string | null): string {
  switch (String(status || "").toUpperCase()) {
    case "CONNECTED":
    case "ACTIVE":
      return "Connected";
    case "PENDING":
    case "NONE":
    case "INACTIVE":
      return "Pending setup";
    case "DISCONNECTED":
      return "Disconnected";
    case "ERROR":
      return "Error";
    case "REVOKED":
      return "Revoked";
    default:
      return status ? String(status) : "Unknown";
  }
}
