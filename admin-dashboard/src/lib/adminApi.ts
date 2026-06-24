import { handleAdminUnauthorized } from "./adminSession";

export const ADMIN_API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

export function getAdminAuthHeaders(json = false): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function handleAuthFailure(res: Response, json: Record<string, unknown>) {
  if (res.status === 401) {
    throw handleAdminUnauthorized(
      typeof json.message === "string"
        ? json.message
        : "Session expired. Please sign in again.",
    );
  }
}

export async function adminFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAdminAuthHeaders(hasBody),
      ...(options.headers || {}),
    },
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 401) {
    handleAuthFailure(res, json);
  }

  if (!res.ok || json.success === false) {
    throw new Error(
      (typeof json.message === "string" ? json.message : undefined) ||
        `Request failed (${res.status})`,
    );
  }

  return json as T;
}

export async function adminFetchMultipart<T = unknown>(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST",
): Promise<T> {
  const token = sessionStorage.getItem("admin_token");
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
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

  if (!res.ok || json.success === false) {
    throw new Error(
      (typeof json.message === "string" ? json.message : undefined) ||
        `Request failed (${res.status})`,
    );
  }

  return json as T;
}

export type PaginatedResponse<T> = {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
