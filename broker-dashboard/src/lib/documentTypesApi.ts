import { getPortalAuthHeaders } from "./portalAuth";
import {
  filterLenderCatalogProducts,
  resolveLenderOfferedProductCode,
} from "./canonicalLoanProducts";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type BrokerCustomDocumentLoanProduct = {
  id: string | null;
  code: string;
  name: string;
};

export type BrokerCustomDocument = {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
  isProtected?: boolean;
  loanProducts?: BrokerCustomDocumentLoanProduct[];
  loanProductIds?: string[];
};

export type BrokerCustomDocumentsResponse = {
  success: boolean;
  data: BrokerCustomDocument[];
  meta?: {
    search?: string | null;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
  message?: string;
};

export type LoanProductOption = {
  id: string;
  code: string;
  name: string;
};

/**
 * Residential 1-4 and CRE variants share the same loan type in the UI.
 * Keep one selectable option, but persist links to every code in the group.
 */
const LOAN_PRODUCT_ALIAS_GROUPS: string[][] = [
  ["BRIDGE_LOAN", "BRIDGE_LOAN_1_TO_4_UNITS"],
  ["CONSTRUCTION_LOAN", "CONSTRUCTION_LOAN_1_TO_4_UNITS"],
];

function aliasGroupForCode(code: string): string[] {
  return (
    LOAN_PRODUCT_ALIAS_GROUPS.find((group) => group.includes(code)) || [code]
  );
}

function aliasGroupKey(code: string): string {
  return aliasGroupForCode(code)[0];
}

/**
 * Same selectable catalog as lender Add Loan Product:
 * hide residential Bridge/Construction duplicates.
 */
export function collapseLoanProductsForSelect(
  products: LoanProductOption[],
): LoanProductOption[] {
  return filterLenderCatalogProducts(products);
}

/** Expand a selected representative product to all alias product IDs. */
export function expandLoanProductIds(
  selectedIds: string[],
  products: LoanProductOption[],
): string[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const byCode = new Map(products.map((product) => [product.code, product]));
  const expanded = new Set<string>();

  for (const id of selectedIds) {
    const product = byId.get(id);
    if (!product) {
      expanded.add(id);
      continue;
    }

    for (const code of aliasGroupForCode(product.code)) {
      const match = byCode.get(code);
      if (match) expanded.add(match.id);
    }
  }

  return [...expanded];
}

/** Collapse stored product IDs down to the canonical catalog option. */
export function collapseLoanProductIds(
  selectedIds: string[],
  products: LoanProductOption[],
): string[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const byCode = new Map(products.map((product) => [product.code, product]));
  const seen = new Set<string>();
  const collapsed: string[] = [];

  for (const id of selectedIds) {
    const product = byId.get(id);
    if (!product) {
      if (!seen.has(id)) {
        seen.add(id);
        collapsed.push(id);
      }
      continue;
    }

    const canonicalCode = resolveLenderOfferedProductCode(product.code);
    if (seen.has(canonicalCode)) continue;
    seen.add(canonicalCode);

    const preferred = byCode.get(canonicalCode) || product;
    collapsed.push(preferred.id);
  }

  return collapsed;
}

/** Deduplicate product chips that belong to the same Bridge/Construction family. */
export function collapseLoanProductLabels(
  products: BrokerCustomDocumentLoanProduct[] = [],
): BrokerCustomDocumentLoanProduct[] {
  const seen = new Set<string>();
  const collapsed: BrokerCustomDocumentLoanProduct[] = [];

  for (const product of products) {
    const key = aliasGroupKey(product.code);
    if (seen.has(key)) continue;
    seen.add(key);

    const preferred =
      products.find((row) => row.code === key) || product;

    collapsed.push({
      ...preferred,
      code: key,
      name: preferred.name || preferred.code,
    });
  }

  return collapsed;
}

function getAuthHeaders(): Record<string, string> {
  return getPortalAuthHeaders();
}

export async function fetchLoanProductOptions(options?: {
  signal?: AbortSignal;
}): Promise<LoanProductOption[]> {
  const res = await fetch(
    `${API_BASE}/common/loan-products/loan-product-code`,
    { signal: options?.signal },
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load loan products");
  }

  const mapped = (json.data || []).map((product: any) => ({
    id: String(product.id),
    code: String(product.code || ""),
    name: String(product.name || product.code || "Loan product"),
  }));

  // Keep full catalog in memory for alias expansion; callers filter for UI.
  return mapped;
}

export async function fetchBrokerCustomDocuments(
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    loanProductId?: string;
    usage?: "all" | "used" | "unused";
    includeInactive?: boolean;
  },
  options?: { signal?: AbortSignal },
) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.loanProductId) query.set("loanProductId", params.loanProductId);
  if (params?.usage && params.usage !== "all") query.set("usage", params.usage);
  if (params?.includeInactive) query.set("includeInactive", "true");

  const res = await fetch(
    `${API_BASE}/broker/document-types?${query.toString()}`,
    {
      headers: getAuthHeaders(),
      signal: options?.signal,
    },
  );
  const json = (await res.json()) as BrokerCustomDocumentsResponse;
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load custom documents");
  }
  return json;
}

export async function createBrokerCustomDocument(payload: {
  name: string;
  description?: string;
  loanProductIds: string[];
}) {
  const res = await fetch(`${API_BASE}/broker/document-types`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to create custom document");
  }
  return json.data as BrokerCustomDocument;
}

export async function updateBrokerCustomDocument(
  id: string,
  payload: {
    name?: string;
    description?: string;
    loanProductIds?: string[];
  },
) {
  const res = await fetch(`${API_BASE}/broker/document-types/${id}`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to update custom document");
  }
  return json.data as BrokerCustomDocument;
}

export async function deactivateBrokerCustomDocument(id: string) {
  const res = await fetch(
    `${API_BASE}/broker/document-types/${id}/deactivate`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
    },
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to remove custom document");
  }
  return json;
}

// ===========================================================================
// Wizard document-type selection
// ===========================================================================

/**
 * One row in the loan-application wizard's "Documents to Request from Client"
 * checkbox grid. Stable across both repos because the wizard vocabulary is
 * owned by the backend (see backend/prisma/admin/documentTypes.seed.js).
 */
export type WizardDocumentTypeOption = {
  id: string;
  code: string;
  label: string;
  name: string;
  description: string | null;
};

/**
 * Fetches the canonical 23-option document-type list used by Step 6 of the
 * loan application wizard. Each entry is keyed by `code` and includes both
 * a friendly `label` (what the wizard UI shows) and the DB row's `name`.
 */
export async function fetchWizardDocumentTypeOptions(options?: {
  signal?: AbortSignal;
}): Promise<WizardDocumentTypeOption[]> {
  const res = await fetch(`${API_BASE}/document-types/wizard-options`, {
    headers: getAuthHeaders(),
    signal: options?.signal,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load wizard document types");
  }
  return (json.data || []) as WizardDocumentTypeOption[];
}

export type AvailableDocumentTypesResponse = {
  fallback: boolean;
  labels: string[];
  types: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  }[];
};

/**
 * Returns the document types the broker pre-selected during the loan
 * application wizard, scoped to a specific loan. When the loan is legacy
 * (no selection captured), the backend returns `fallback: true` so the
 * caller can render today's full-catalog UI without breaking anything.
 */
export async function fetchAvailableDocumentTypes(
  applicationId: string,
  options?: { signal?: AbortSignal },
): Promise<AvailableDocumentTypesResponse> {
  const res = await fetch(
    `${API_BASE}/broker/applications/${applicationId}/available-document-types`,
    {
      headers: getAuthHeaders(),
      signal: options?.signal,
    },
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load available document types");
  }
  return json.data as AvailableDocumentTypesResponse;
}
