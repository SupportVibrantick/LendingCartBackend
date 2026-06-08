export const ADMIN_API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

export function getAdminAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function adminFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAdminAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (${res.status})`);
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
