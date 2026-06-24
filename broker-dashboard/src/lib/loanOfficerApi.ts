export const LO_API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

export const LO_TOKEN_KEY = "loan_officer_token";
export const LO_USER_KEY = "loan_officer_user";

export function isLoanOfficerTokenExpired(token: string): boolean {
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

export const getLoanOfficerToken = () => {
  const token = sessionStorage.getItem(LO_TOKEN_KEY);
  if (!token || isLoanOfficerTokenExpired(token)) return null;
  return token;
};

export function clearLoanOfficerSession() {
  sessionStorage.removeItem(LO_TOKEN_KEY);
  sessionStorage.removeItem(LO_USER_KEY);
  sessionStorage.removeItem("roles");
  sessionStorage.removeItem("permissions");
  void import("./chatSocketManager").then(({ disconnectChatSocket }) =>
    disconnectChatSocket(),
  );
}

export function handleLoanOfficerUnauthorized(message?: string) {
  clearLoanOfficerSession();

  const onSignIn = window.location.pathname === "/loan-officer/login";
  if (!onSignIn) {
    window.location.href = "/loan-officer/login";
  }

  return new Error(message || "Session expired. Please sign in again.");
}

export const loAuthHeaders = (json = true) => {
  const headers: Record<string, string> = {};
  const token = getLoanOfficerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
};

export async function loFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${LO_API_BASE}${path}`, {
    ...options,
    headers: {
      ...loAuthHeaders(hasBody),
      ...(options.headers || {}),
    },
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 401) {
    throw handleLoanOfficerUnauthorized(
      typeof json.message === "string"
        ? json.message
        : "Session expired. Please sign in again.",
    );
  }

  if (!res.ok || json.success === false) {
    throw new Error(
      (typeof json.message === "string" ? json.message : undefined) ||
        `Request failed (${res.status})`,
    );
  }

  return json as T;
}

export async function verifyLoanOfficerSession(token: string): Promise<boolean> {
  const res = await fetch(`${LO_API_BASE}/loanofficer/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}
