import { getLenderAuthHeaders, LENDER_API_BASE } from "./lenderApi";

export async function cleanupOrphanedCustomDocumentTypes() {
  const res = await fetch(
    `${LENDER_API_BASE}/lender/document-config/cleanup-orphaned-custom-types`,
    {
      method: "POST",
      headers: getLenderAuthHeaders(),
    },
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to clean up unused custom documents");
  }

  return json.data as {
    deactivatedCount?: number;
    deactivatedIds?: string[];
  };
}
