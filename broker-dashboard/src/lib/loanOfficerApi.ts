import {
  SESSION_EXPIRED_MESSAGE,
  beginSessionLogout,
  showSessionExpiredToast,
} from "./sessionExpiry";

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

export function handleLoanOfficerUnauthorized(_message?: string) {
  const isFirst = beginSessionLogout("loanOfficer");
  clearLoanOfficerSession();

  const onSignIn =
    window.location.pathname === "/loan-officer/login" ||
    window.location.pathname === "/loan-officer/impersonate";

  if (isFirst && !onSignIn) {
    showSessionExpiredToast();
    window.location.href = "/loan-officer/login";
  }

  return new Error(SESSION_EXPIRED_MESSAGE);
}

export function checkLoanOfficerResponse(
  res: Response,
  _json?: Record<string, unknown>,
): void {
  if (res.status === 401) {
    throw handleLoanOfficerUnauthorized();
  }
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

  checkLoanOfficerResponse(res, json);

  if (!res.ok || json.success === false) {
    throw new Error(
      (typeof json.message === "string" ? json.message : undefined) ||
        `Request failed (${res.status})`,
    );
  }

  return json as T;
}

export async function loFetchAbsolute<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {},
): Promise<{ res: Response; json: T }> {
  const hasJsonBody =
    options.body !== undefined &&
    options.body !== null &&
    !(options.body instanceof FormData);
  const res = await fetch(url, {
    ...options,
    headers: {
      ...loAuthHeaders(hasJsonBody),
      ...(options.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T;
  checkLoanOfficerResponse(res, json as Record<string, unknown>);
  return { res, json };
}

export async function verifyLoanOfficerSession(token: string): Promise<boolean> {
  const res = await fetch(`${LO_API_BASE}/loanofficer/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

type LoanOfficerTokenPayload = {
  impersonatedBy?: string;
};

export function decodeLoanOfficerToken(
  token: string,
): LoanOfficerTokenPayload | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    return JSON.parse(
      atob(base64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as LoanOfficerTokenPayload;
  } catch {
    return null;
  }
}

export function isLoanOfficerImpersonationSession() {
  const token = sessionStorage.getItem(LO_TOKEN_KEY);
  if (!token) return false;
  return Boolean(decodeLoanOfficerToken(token)?.impersonatedBy);
}

export function exitLoanOfficerImpersonation() {
  clearLoanOfficerSession();
  window.close();
  window.setTimeout(() => {
    window.location.href = "/loan-officer/login";
  }, 150);
}
