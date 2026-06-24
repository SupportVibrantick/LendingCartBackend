export function isLenderTokenExpired(token: string): boolean {
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

export function getLenderToken(): string | null {
  const token = sessionStorage.getItem("lender_token");
  if (!token || isLenderTokenExpired(token)) return null;
  return token;
}

export function clearLenderSession() {
  sessionStorage.removeItem("lender_token");
  sessionStorage.removeItem("lender_refresh");
  sessionStorage.removeItem("lender_user");
  sessionStorage.removeItem("roles");
  sessionStorage.removeItem("permissions");
  void import("./chatSocketManager").then(({ disconnectChatSocket }) =>
    disconnectChatSocket(),
  );
}

export function handleLenderUnauthorized(message?: string) {
  clearLenderSession();

  const onSignIn =
    window.location.pathname === "/signin" ||
    window.location.pathname === "/impersonate";

  if (!onSignIn) {
    window.location.href = "/signin";
  }

  return new Error(message || "Session expired. Please sign in again.");
}

export async function verifyLenderSession(token: string): Promise<boolean> {
  const { LENDER_API_BASE } = await import("./lenderApi");
  const res = await fetch(`${LENDER_API_BASE}/lender/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export function saveLenderSession(
  token: string,
  user?: Record<string, unknown> | null,
) {
  sessionStorage.setItem("lender_token", token);

  if (user) {
    sessionStorage.setItem("lender_user", JSON.stringify(user));
    if (Array.isArray(user.roles)) {
      sessionStorage.setItem("roles", JSON.stringify(user.roles));
    }
  }
}
