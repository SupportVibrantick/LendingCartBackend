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

export type LenderAuthMeResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
  data: any;
};

type LenderAuthMeCacheEntry = {
  key: string;
  promise: Promise<LenderAuthMeResult>;
  expiresAt: number;
};

let lenderAuthMeCache: LenderAuthMeCacheEntry | null = null;
const LENDER_AUTH_ME_TTL_MS = 15_000;

/** Shared /lender/auth/me with short TTL (covers Strict Mode remounts). */
export async function fetchLenderAuthMe(options?: {
  force?: boolean;
  query?: string;
}): Promise<LenderAuthMeResult> {
  const query = options?.query?.replace(/^\?/, "") || "";
  const cacheKey = query || "default";
  const now = Date.now();

  if (
    !options?.force &&
    lenderAuthMeCache &&
    lenderAuthMeCache.key === cacheKey &&
    lenderAuthMeCache.expiresAt > now
  ) {
    return lenderAuthMeCache.promise;
  }

  const promise = (async (): Promise<LenderAuthMeResult> => {
    const path = query
      ? `${LENDER_API_BASE}/lender/auth/me?${query}`
      : `${LENDER_API_BASE}/lender/auth/me`;

    const res = await fetch(path, {
      method: "GET",
      headers: getLenderAuthHeaders(true),
    });
    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    return {
      ok: res.ok && json.success !== false && json.ok !== false,
      status: res.status,
      json,
      data: (json as any).data ?? json,
    };
  })().catch((error) => {
    if (lenderAuthMeCache?.promise === promise) {
      lenderAuthMeCache = null;
    }
    throw error;
  });

  lenderAuthMeCache = {
    key: cacheKey,
    promise,
    expiresAt: now + LENDER_AUTH_ME_TTL_MS,
  };

  return promise;
}

export function invalidateLenderAuthMeCache() {
  lenderAuthMeCache = null;
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
