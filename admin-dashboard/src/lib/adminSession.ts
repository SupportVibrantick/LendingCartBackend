import { clearAdminPermissionSession } from "./adminPermissions";

export function isAdminTokenExpired(token: string): boolean {
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

export function getAdminToken(): string | null {
  const token = sessionStorage.getItem("admin_token");
  if (!token || isAdminTokenExpired(token)) return null;
  return token;
}

export function clearAdminSession() {
  sessionStorage.removeItem("admin_token");
  sessionStorage.removeItem("admin_refresh");
  sessionStorage.removeItem("admin_user");
  clearAdminPermissionSession();
  void import("./adminSocket").then(({ disconnectAdminSocket }) =>
    disconnectAdminSocket(),
  );
}

/** Best-effort logout audit, then clear local session. */
export async function logoutAdminSession() {
  const token = sessionStorage.getItem("admin_token");
  if (token && !isAdminTokenExpired(token)) {
    try {
      const base =
        import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ||
        "http://localhost:4000";
      await fetch(`${base}/admin/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore — local logout still proceeds
    }
  }
  clearAdminSession();
}

export function handleAdminUnauthorized(message?: string) {
  clearAdminSession();

  const onSignIn = window.location.pathname === "/signin";
  if (!onSignIn) {
    window.location.href = "/signin";
  }

  return new Error(message || "Session expired. Please sign in again.");
}
