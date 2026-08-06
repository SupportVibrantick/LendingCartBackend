import {
  getPortalAuthHeaders,
  getPortalToken,
  handlePortalUnauthorized,
} from "./portalAuth";

export const BROKER_API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

export function getBrokerAuthHeaders(json = false): Record<string, string> {
  return getPortalAuthHeaders(json);
}

function handleAuthFailure(res: Response, _json: Record<string, unknown>) {
  if (res.status === 401) {
    throw handlePortalUnauthorized();
  }
}

export async function brokerFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${BROKER_API_BASE}${path}`, {
    ...options,
    headers: {
      ...getBrokerAuthHeaders(hasBody),
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

export async function brokerFetchMultipart<T = unknown>(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST",
): Promise<T> {
  const token = getPortalToken();
  const res = await fetch(`${BROKER_API_BASE}${path}`, {
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
