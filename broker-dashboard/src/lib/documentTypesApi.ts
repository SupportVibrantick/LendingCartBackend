import { getPortalAuthHeaders } from "./portalAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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

function getAuthHeaders(): Record<string, string> {
  return getPortalAuthHeaders();
}

export async function fetchBrokerCustomDocuments(
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
  },
  options?: { signal?: AbortSignal },
) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
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
  payload: { name?: string; description?: string },
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
