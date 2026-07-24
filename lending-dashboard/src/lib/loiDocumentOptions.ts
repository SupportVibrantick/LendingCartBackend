const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type LoiDocumentCatalog = {
  names: string[];
  productRequired: string[];
};

function normalizeName(name: string) {
  return String(name || "").trim();
}

function normalizeNameKey(name: string) {
  return normalizeName(name).toLowerCase();
}

export function mergeLoiDocumentNames(
  ...groups: Array<string[] | undefined | null>
) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const group of groups) {
    for (const raw of group || []) {
      const name = normalizeName(raw);
      if (!name) continue;
      const key = normalizeNameKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(name);
    }
  }

  return merged.sort((a, b) => a.localeCompare(b));
}

export async function fetchLoiDocumentCatalog(
  getAuthHeaders: () => Record<string, string>,
  options?: {
    loanProductCode?: string | null;
    includeProductConfig?: boolean;
  },
): Promise<LoiDocumentCatalog> {
  const res = await fetch(`${API_BASE}/document-types/active?all=true`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load document catalog");
  }

  const platformAndCustom = mergeLoiDocumentNames(
    (json.data || []).map((doc: { name?: string }) => doc.name || ""),
  );

  let productRequired: string[] = [];
  const loanProductCode = options?.loanProductCode?.trim();
  if (options?.includeProductConfig && loanProductCode) {
    try {
      const configRes = await fetch(
        `${API_BASE}/lender/document-config/list?loanProductCode=${encodeURIComponent(loanProductCode)}&all=true`,
        { headers: getAuthHeaders() },
      );
      const configJson = await configRes.json();
      if (configRes.ok && configJson.success) {
        const docs = Array.isArray(configJson.data) ? configJson.data : [];
        const productNames = mergeLoiDocumentNames(
          docs.map((doc: { documentName?: string }) => doc.documentName || ""),
        );
        productRequired = mergeLoiDocumentNames(
          docs
            .filter((doc: { isRequired?: boolean }) => doc.isRequired)
            .map((doc: { documentName?: string }) => doc.documentName || ""),
        );
        return {
          names: mergeLoiDocumentNames(platformAndCustom, productNames),
          productRequired,
        };
      }
    } catch {
      /* optional product config */
    }
  }

  return {
    names: platformAndCustom,
    productRequired,
  };
}
