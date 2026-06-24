import { handleLenderUnauthorized } from "./lenderSession";

export const LENDER_API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

/** @deprecated Use LENDER_API_BASE */
export const API_BASE = LENDER_API_BASE;

export function getLenderAuthHeaders(
  json = false,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = sessionStorage.getItem("lender_token");

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function handleAuthFailure(res: Response, json: Record<string, unknown>) {
  if (res.status === 401) {
    throw handleLenderUnauthorized(
      typeof json.message === "string"
        ? json.message
        : "Session expired. Please sign in again.",
    );
  }
}

export async function lenderFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${LENDER_API_BASE}${path}`, {
    ...options,
    headers: {
      ...getLenderAuthHeaders(hasBody),
      ...(options.headers || {}),
    },
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 401) {
    handleAuthFailure(res, json);
  }

  if (!res.ok || json.success === false || json.ok === false) {
    throw new Error(
      (typeof json.message === "string" ? json.message : undefined) ||
        `Request failed (${res.status})`,
    );
  }

  return json as T;
}

export async function lenderFetchMultipart<T = unknown>(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST",
): Promise<T> {
  const token = sessionStorage.getItem("lender_token");
  const res = await fetch(`${LENDER_API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 401) {
    handleAuthFailure(res, json);
  }

  if (!res.ok || json.success === false || json.ok === false) {
    throw new Error(
      (typeof json.message === "string" ? json.message : undefined) ||
        `Request failed (${res.status})`,
    );
  }

  return json as T;
}
