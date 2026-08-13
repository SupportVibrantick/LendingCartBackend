const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type LoiDocumentCatalog = {
  names: string[];
  /** Lender/broker private document type names (isCustom). */
  customNames: string[];
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
  const loanProductCode = options?.loanProductCode?.trim() || "";
  const params = new URLSearchParams({ all: "true" });
  if (loanProductCode) {
    params.set("loanProductCode", loanProductCode);
  }

  const res = await fetch(
    `${API_BASE}/document-types/active?${params.toString()}`,
    { headers: getAuthHeaders() },
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load document catalog");
  }

  const catalogRows = Array.isArray(json.data) ? json.data : [];
  const platformAndCustom = mergeLoiDocumentNames(
    catalogRows.map((doc: { name?: string }) => doc.name || ""),
  );
  let customNames = mergeLoiDocumentNames(
    catalogRows
      .filter((doc: { isCustom?: boolean }) => Boolean(doc.isCustom))
      .map((doc: { name?: string }) => doc.name || ""),
  );

  let productRequired: string[] = [];
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
        const productCustomNames = mergeLoiDocumentNames(
          docs
            .filter((doc: { isCustom?: boolean }) => Boolean(doc.isCustom))
            .map((doc: { documentName?: string }) => doc.documentName || ""),
        );
        customNames = mergeLoiDocumentNames(customNames, productCustomNames);
        productRequired = mergeLoiDocumentNames(
          docs
            .filter((doc: { isRequired?: boolean }) => doc.isRequired)
            .map((doc: { documentName?: string }) => doc.documentName || ""),
        );
        return {
          names: mergeLoiDocumentNames(platformAndCustom, productNames),
          customNames,
          productRequired,
        };
      }
    } catch {
      /* optional product config */
    }
  }

  return {
    names: platformAndCustom,
    customNames,
    productRequired,
  };
}

/**
 * Persist a lender-private custom document for a loan product.
 * Other lenders cannot see this document type.
 */
export async function createLoiCustomDocument(
  getAuthHeaders: () => Record<string, string>,
  options: {
    name: string;
    loanProductCode?: string | null;
  },
): Promise<{ name: string; id?: string }> {
  const name = normalizeName(options.name);
  if (name.length < 2) {
    throw new Error("Custom document name must be at least 2 characters");
  }

  const loanProductCode = options.loanProductCode?.trim() || "";
  if (!loanProductCode) {
    throw new Error("Loan product is required to save a custom document");
  }

  const res = await fetch(
    `${API_BASE}/lender/document-config/create-custom-document-type`,
    {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        loanProductCode,
      }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to add custom document");
  }

  return {
    id: json?.data?.id,
    name: json?.data?.name || name,
  };
}
