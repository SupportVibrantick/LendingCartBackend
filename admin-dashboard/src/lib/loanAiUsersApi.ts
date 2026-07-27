const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type LoanAiUserRow = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  hasBrokerSubscription: boolean;
  brokerOrganizationId?: string | null;
  organization?: {
    id: string;
    name: string;
    email?: string | null;
    status: string;
  } | null;
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    package?: { id: string; name: string; code: string } | null;
    purchasedAddOns?: Array<{ code: string; name: string; priceMonthly: number }> | null;
  } | null;
};

export type LoanAiUserStats = {
  total: number;
  subscribed: number;
  pending: number;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  meta?: { total: number; page: number; limit: number };
};

function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

export async function fetchLoanAiUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  hasSubscription?: "true" | "false";
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.hasSubscription) q.set("hasSubscription", params.hasSubscription);

  const res = await fetch(`${API_BASE}/admin/loan-ai-users/read?${q}`, {
    headers: getAuthHeaders(),
  });
  return res.json() as Promise<ApiResponse<LoanAiUserRow[]>>;
}

export async function fetchLoanAiUserStats() {
  const res = await fetch(`${API_BASE}/admin/loan-ai-users/stats`, {
    headers: getAuthHeaders(),
  });
  return res.json() as Promise<ApiResponse<LoanAiUserStats>>;
}

export function formatUserName(row: LoanAiUserRow) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return name || "—";
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
