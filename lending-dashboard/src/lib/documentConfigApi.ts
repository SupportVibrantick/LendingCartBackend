import { getLenderAuthHeaders, LENDER_API_BASE } from "./lenderApi";

type CleanupResult = {
  deactivatedCount?: number;
  deactivatedIds?: string[];
};

const CLEANUP_CACHE_TTL_MS = 5 * 60 * 1000;

let inflightCleanup: Promise<CleanupResult> | null = null;
let lastCleanupAt = 0;
let lastCleanupResult: CleanupResult | null = null;

/**
 * Deactivate unused lender custom document types.
 * Coalesced + short-TTL cached so Strict Mode / remounts do not POST twice.
 */
export async function cleanupOrphanedCustomDocumentTypes(options?: {
  force?: boolean;
}) {
  const now = Date.now();
  if (
    !options?.force &&
    lastCleanupResult &&
    now - lastCleanupAt < CLEANUP_CACHE_TTL_MS
  ) {
    return lastCleanupResult;
  }

  if (inflightCleanup) {
    return inflightCleanup;
  }

  inflightCleanup = (async () => {
    const res = await fetch(
      `${LENDER_API_BASE}/lender/document-config/cleanup-orphaned-custom-types`,
      {
        method: "POST",
        headers: getLenderAuthHeaders(),
      },
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(
        json.message || "Failed to clean up unused custom documents",
      );
    }

    const data = (json.data || {
      deactivatedCount: 0,
      deactivatedIds: [],
    }) as CleanupResult;

    lastCleanupAt = Date.now();
    lastCleanupResult = data;
    return data;
  })().finally(() => {
    inflightCleanup = null;
  });

  return inflightCleanup;
}
