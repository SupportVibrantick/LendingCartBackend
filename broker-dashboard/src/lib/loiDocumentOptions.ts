const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type LoiDocumentCatalog = {
  names: string[];
  /** Broker-private custom document type names (isCustom + this org). */
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

async function fetchActiveDocumentNames(
  getAuthHeaders: () => HeadersInit | Record<string, string>,
  options?: { loanProductCode?: string },
) {
  const params = new URLSearchParams({ all: "true" });
  if (options?.loanProductCode) {
    params.set("loanProductCode", options.loanProductCode);
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
  return {
    names: mergeLoiDocumentNames(
      catalogRows.map((doc: { name?: string }) => doc.name || ""),
    ),
    customNames: mergeLoiDocumentNames(
      catalogRows
        .filter((doc: { isCustom?: boolean }) => Boolean(doc.isCustom))
        .map((doc: { name?: string }) => doc.name || ""),
    ),
  };
}

/**
 * Fetch document catalog scoped to this broker org + application product.
 * Other brokers' custom docs never appear (enforced by /document-types/active).
 */
export async function fetchLoiDocumentCatalog(
  getAuthHeaders: () => HeadersInit | Record<string, string>,
  options?: {
    loanProductCode?: string | null;
    includeProductConfig?: boolean;
  },
): Promise<LoiDocumentCatalog> {
  const loanProductCode = options?.loanProductCode?.trim() || "";

  // Always load the full org-visible catalog so search works even when a
  // product has few/no ProductDocumentRequirement rows.
  const fullCatalog = await fetchActiveDocumentNames(getAuthHeaders);

  let names = fullCatalog.names;
  let customNames = fullCatalog.customNames;
  let productRequired: string[] = [];

  if (loanProductCode) {
    try {
      const productCatalog = await fetchActiveDocumentNames(getAuthHeaders, {
        loanProductCode,
      });
      names = mergeLoiDocumentNames(names, productCatalog.names);
      customNames = mergeLoiDocumentNames(
        customNames,
        productCatalog.customNames,
      );
    } catch {
      /* product-scoped list is optional when full catalog already loaded */
    }
  }

  if (options?.includeProductConfig && loanProductCode) {
    try {
      // Prefer broker-owned custom docs for this product (org-scoped list).
      const brokerCustomRes = await fetch(
        `${API_BASE}/broker/document-types?loanProductCode=${encodeURIComponent(loanProductCode)}&limit=100`,
        { headers: getAuthHeaders() },
      );
      const brokerCustomJson = await brokerCustomRes.json().catch(() => ({}));
      if (brokerCustomRes.ok && brokerCustomJson?.success) {
        const brokerCustom = mergeLoiDocumentNames(
          (Array.isArray(brokerCustomJson.data) ? brokerCustomJson.data : []).map(
            (doc: { name?: string }) => doc.name || "",
          ),
        );
        customNames = mergeLoiDocumentNames(customNames, brokerCustom);
        names = mergeLoiDocumentNames(names, brokerCustom);
      }
    } catch {
      /* optional broker custom list */
    }

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
        names = mergeLoiDocumentNames(names, productNames);
      }
    } catch {
      /* optional product config */
    }
  }

  return {
    names,
    customNames,
    productRequired,
  };
}

/**
 * Persist a broker-private custom document linked to the application product.
 * Other brokerages cannot see this document type.
 */
export async function createLoiCustomDocument(
  getAuthHeaders: () => HeadersInit | Record<string, string>,
  options: {
    name: string;
    loanProductCode?: string | null;
  },
): Promise<{ name: string; id?: string; reused?: boolean }> {
  const name = normalizeName(options.name);
  if (name.length < 2) {
    throw new Error("Custom document name must be at least 2 characters");
  }

  const loanProductCode = options.loanProductCode?.trim() || "";
  if (!loanProductCode) {
    throw new Error("Loan product is required to save a custom document");
  }

  const res = await fetch(`${API_BASE}/broker/document-types`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      loanProductCode,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to add custom document");
  }

  return {
    id: json?.data?.id,
    name: json?.data?.name || name,
    reused: Boolean(json?.data?.reused),
  };
}
