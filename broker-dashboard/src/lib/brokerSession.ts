import {
  SESSION_EXPIRED_MESSAGE,
  beginSessionLogout,
  showSessionExpiredToast,
} from "./sessionExpiry";

export function isBrokerTokenExpired(token: string): boolean {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return true;
    const payload = JSON.parse(
      atob(base64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function getBrokerToken(): string | null {
  const token = sessionStorage.getItem("broker_token");
  if (!token || isBrokerTokenExpired(token)) return null;
  return token;
}

export function clearBrokerSession() {
  sessionStorage.removeItem("broker_token");
  sessionStorage.removeItem("broker_refresh");
  sessionStorage.removeItem("broker_user");
  sessionStorage.removeItem("broker_user_name");
  sessionStorage.removeItem("broker_user_email");
  sessionStorage.removeItem("roles");
  sessionStorage.removeItem("permissions");
  void import("./chatSocketManager").then(({ disconnectChatSocket }) =>
    disconnectChatSocket(),
  );
}

export function handleBrokerUnauthorized(_message?: string) {
  const isFirst = beginSessionLogout("broker");
  clearBrokerSession();

  const onSignIn =
    window.location.pathname === "/signin" ||
    window.location.pathname === "/impersonate";

  if (isFirst && !onSignIn) {
    showSessionExpiredToast();
    window.location.href = "/signin";
  }

  return new Error(SESSION_EXPIRED_MESSAGE);
}

export function checkBrokerResponse(
  res: Response,
  _json?: Record<string, unknown>,
): void {
  if (res.status === 401) {
    throw handleBrokerUnauthorized();
  }
}

export async function verifyBrokerSession(token: string): Promise<boolean> {
  const { BROKER_API_BASE } = await import("./brokerApi");
  const res = await fetch(`${BROKER_API_BASE}/broker/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export function saveBrokerSession(
  token: string,
  user?: {
    roles?: string[];
    permissions?: string[];
    [key: string]: unknown;
  } | null,
) {
  sessionStorage.setItem("broker_token", token);

  if (user) {
    sessionStorage.setItem("broker_user", JSON.stringify(user));
    sessionStorage.setItem("roles", JSON.stringify(user.roles || []));
    sessionStorage.setItem(
      "permissions",
      JSON.stringify(user.permissions || []),
    );
  }
}
