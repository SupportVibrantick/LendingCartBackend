import { getLenderAuthHeaders, LENDER_API_BASE } from "./lenderApi";

type TtlCacheEntry<T> = { promise: Promise<T>; expiresAt: number };

const TTL_MS = 8_000;
const applicationDetailsCache = new Map<string, TtlCacheEntry<any>>();
const loanProductsListCache = new Map<string, TtlCacheEntry<any[]>>();

function getTtlCachedPromise<T>(
  cache: Map<string, TtlCacheEntry<T>>,
  key: string,
  factory: () => Promise<T>,
  ttlMs = TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.promise;

  const promise = factory().catch((error) => {
    const current = cache.get(key);
    if (current?.promise === promise) cache.delete(key);
    throw error;
  });

  cache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

export async function fetchLenderApplicationDetailShared(
  applicationLenderId: string,
  options?: { force?: boolean },
): Promise<any> {
  if (options?.force) {
    applicationDetailsCache.delete(applicationLenderId);
  }

  return getTtlCachedPromise(
    applicationDetailsCache,
    applicationLenderId,
    async () => {
      const res = await fetch(
        `${LENDER_API_BASE}/lender/loan-pipeline/${applicationLenderId}`,
        { headers: getLenderAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load application");
      }
      return json.data;
    },
  );
}

export async function fetchLenderLoanProductsSummaryShared(options?: {
  force?: boolean;
  limit?: number;
}): Promise<any[]> {
  const limit = options?.limit ?? 100;
  const key = `summary:${limit}`;
  if (options?.force) {
    loanProductsListCache.delete(key);
  }

  return getTtlCachedPromise(loanProductsListCache, key, async () => {
    const res = await fetch(
      `${LENDER_API_BASE}/lender/loan-products/list?limit=${limit}&summary=true`,
      { headers: getLenderAuthHeaders() },
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to fetch loan products");
    }
    return Array.isArray(json.data) ? json.data : [];
  });
}

export function invalidateLenderApplicationDetailCache(
  applicationLenderId?: string,
) {
  if (!applicationLenderId) {
    applicationDetailsCache.clear();
    return;
  }
  applicationDetailsCache.delete(applicationLenderId);
}
