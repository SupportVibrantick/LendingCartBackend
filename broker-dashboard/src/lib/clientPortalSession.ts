const PLACEHOLDER_CLIENT_NAMES = new Set([
  "applicant",
  "client",
  "customer",
  "individual applicant",
  "individual",
]);

export function isPlaceholderClientName(name?: string | null) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_CLIENT_NAMES.has(normalized);
}

export type ClientPortalProfile = {
  clientName?: string;
  email?: string;
  clientId?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function resolveClientProfileFromSession(): ClientPortalProfile | null {
  const stored = sessionStorage.getItem("client_user");
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as ClientPortalProfile & {
        name?: string;
      };
      return {
        clientName:
          parsed.clientName && !isPlaceholderClientName(parsed.clientName)
            ? parsed.clientName
            : parsed.name && !isPlaceholderClientName(parsed.name)
              ? parsed.name
              : undefined,
        email: parsed.email,
        clientId: parsed.clientId,
      };
    } catch {
      /* fall through to JWT decode */
    }
  }

  const token = sessionStorage.getItem("client_token");
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  return {
    clientName:
      typeof payload.clientName === "string" &&
      !isPlaceholderClientName(payload.clientName)
        ? payload.clientName
        : undefined,
    email:
      (typeof payload.clientEmail === "string" && payload.clientEmail) ||
      (typeof payload.email === "string" && payload.email) ||
      undefined,
    clientId:
      (typeof payload.clientId === "string" && payload.clientId) || undefined,
  };
}

export function saveClientPortalSession(
  token: string,
  user?: {
    clientName?: string;
    email?: string;
    clientId?: string;
  },
) {
  sessionStorage.setItem("client_token", token);

  if (user) {
    sessionStorage.setItem(
      "client_user",
      JSON.stringify({
        clientName: user.clientName,
        email: user.email,
        clientId: user.clientId,
      }),
    );
  }
}

export function clearClientPortalSession() {
  sessionStorage.removeItem("client_token");
  sessionStorage.removeItem("client_user");
}

export function isClientPortalImpersonationSession() {
  const token = sessionStorage.getItem("client_token");
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  return Boolean(payload?.impersonatedBy);
}

export async function verifyClientPortalSession(
  token: string,
): Promise<boolean> {
  const apiBase =
    import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

  const res = await fetch(
    `${apiBase}/client-portal/applications?page=1&limit=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return res.ok;
}

export function exitClientPortalImpersonation() {
  clearClientPortalSession();
  window.close();
  window.setTimeout(() => {
    window.location.href = "/client-upload";
  }, 150);
}
