const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type BillingCycle = "MONTHLY" | "YEARLY";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
export type InvoiceStatus = "DRAFT" | "PENDING" | "PAID" | "FAILED" | "VOID";
export type UsageMetric =
  | "LOAN_APPLICATIONS"
  | "ACTIVE_USERS"
  | "LOAN_OFFICERS"
  | "LENDER_CONNECTIONS"
  | "CO_BROKERS";

export type UsageLimits = Partial<Record<UsageMetric, number>>;

export type OrgUsageMetricRow = {
  metric: UsageMetric;
  label: string;
  usedValue: number;
  limitValue: number | null;
  packageDefault: number | null;
  isCustom: boolean;
};

export type OrgUsageLimitsPayload = {
  usageLimitOverrides?: UsageLimits | null;
  packageDefaults?: UsageLimits | null;
  effective?: UsageLimits | null;
  metrics: OrgUsageMetricRow[];
};

export type SubscriptionPackage = {
  id: string;
  name: string;
  code: string;
  priceMonthly: number | string;
  priceYearly?: number | string | null;
  description?: string | null;
  features?: string | null;
  usageLimits?: UsageLimits | null;
  sortOrder: number;
  isActive: boolean;
  isPopular: boolean;
  createdAt?: string;
};

export type SubscriberRow = {
  organizationId: string;
  organizationName: string;
  organizationEmail?: string | null;
  organizationStatus: string;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt?: string | null;
    cancelAtPeriodEnd: boolean;
    package: {
      id: string;
      name: string;
      code: string;
      priceMonthly: number | string;
      priceYearly?: number | string | null;
    } | null;
  } | null;
};

export type SubscriptionUsageRecord = {
  id: string;
  metric: UsageMetric;
  limitValue?: number | null;
  usedValue: number;
  periodStart: string;
  periodEnd: string;
};

export type SubscriptionInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number | string;
  currency: string;
  billingCycle: BillingCycle;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  organization?: { id: string; name: string; email?: string | null };
  organizationSubscription?: {
    package?: { id: string; name: string; code: string };
  };
};

export type FeatureCatalogItem = {
  key: string;
  label: string;
  description?: string;
};

export type FeatureCatalogGroup = {
  id: string;
  title: string;
  description?: string;
  items: FeatureCatalogItem[];
};

export type OrgFeaturesPayload = {
  enabledFeatures: string[];
  isCustom: boolean;
  packageDefaults?: string[];
  permissions: string[];
  loanCategories: string[];
  loanTypes: string[];
  all?: string[];
};

export type SubscriberDetail = {
  organization: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    status: string;
    createdAt: string;
  };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt?: string | null;
    cancelAtPeriodEnd: boolean;
    notes?: string | null;
    package: SubscriptionPackage;
    usageRecords: SubscriptionUsageRecord[];
    invoices: SubscriptionInvoice[];
    enabledFeatures?: string[] | null;
  } | null;
  history: Array<{
    id: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    createdAt: string;
    package: { id: string; name: string; code: string };
  }>;
  featureCatalog?: FeatureCatalogGroup[];
  orgFeatures?: OrgFeaturesPayload;
  orgUsageLimits?: OrgUsageLimitsPayload | null;
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

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  });
  return res.json();
}

export async function fetchPackages(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (typeof params?.isActive === "boolean") q.set("isActive", String(params.isActive));
  return request<SubscriptionPackage[]>(`${API_BASE}/admin/subscriptions/read?${q}`);
}

export async function createPackage(payload: Record<string, unknown>) {
  return request<SubscriptionPackage>(`${API_BASE}/admin/subscriptions/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePackage(payload: Record<string, unknown>) {
  return request<SubscriptionPackage>(`${API_BASE}/admin/subscriptions/update`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function togglePackageStatus(id: string, isActive: boolean) {
  return request<SubscriptionPackage>(`${API_BASE}/admin/subscriptions/status`, {
    method: "PATCH",
    body: JSON.stringify({ id, isActive }),
  });
}

export async function deletePackage(id: string) {
  return request<void>(`${API_BASE}/admin/subscriptions/delete`, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

export type BrokerOption = {
  id: string;
  name: string;
  email?: string | null;
};

export async function fetchBrokerOptions(limit = 100) {
  const json = await request<BrokerOption[]>(
    `${API_BASE}/admin/brokers/read?page=1&limit=${limit}`,
  );
  return json;
}

export async function fetchSubscribers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  packageId?: string;
  billingCycle?: BillingCycle;
  hasSubscription?: "true" | "false";
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.packageId) q.set("packageId", params.packageId);
  if (params?.billingCycle) q.set("billingCycle", params.billingCycle);
  if (params?.hasSubscription) q.set("hasSubscription", params.hasSubscription);
  return request<SubscriberRow[]>(`${API_BASE}/admin/subscriptions/subscribers/read?${q}`);
}

export async function fetchSubscriberDetail(orgId: string) {
  return request<SubscriberDetail>(`${API_BASE}/admin/subscriptions/subscribers/${orgId}`);
}

export async function updateSubscriberFeatures(orgId: string, features: string[]) {
  return request<OrgFeaturesPayload>(
    `${API_BASE}/admin/subscriptions/subscribers/${orgId}/features`,
    {
      method: "PUT",
      body: JSON.stringify({ features }),
    },
  );
}

export async function updateSubscriberUsageLimits(
  orgId: string,
  payload: { limits?: UsageLimits; resetToPackage?: boolean },
) {
  return request<OrgUsageLimitsPayload>(
    `${API_BASE}/admin/subscriptions/subscribers/${orgId}/usage-limits`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function assignSubscription(payload: {
  organizationId: string;
  packageId: string;
  billingCycle?: BillingCycle;
  trialDays?: number;
  notes?: string;
  generateInvoice?: boolean;
}) {
  return request<unknown>(`${API_BASE}/admin/subscriptions/subscribers/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function changeSubscriptionPlan(payload: {
  organizationId: string;
  packageId: string;
  billingCycle?: BillingCycle;
  notes?: string;
  generateInvoice?: boolean;
}) {
  return request<unknown>(`${API_BASE}/admin/subscriptions/subscribers/change-plan`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function cancelSubscription(payload: {
  organizationId: string;
  immediate?: boolean;
}) {
  return request<unknown>(`${API_BASE}/admin/subscriptions/subscribers/cancel`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function runSubscriptionBillingCycle() {
  return request<{ expiredTrials: number; pastDue: number }>(
    `${API_BASE}/admin/subscriptions/subscribers/process-billing`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function refreshSubscriptionUsage(payload?: {
  organizationId?: string;
  organizationSubscriptionId?: string;
}) {
  return request<SubscriptionUsageRecord[]>(
    `${API_BASE}/admin/subscriptions/subscribers/refresh-usage`,
    {
      method: "POST",
      body: JSON.stringify(payload || {}),
    },
  );
}

export async function fetchInvoices(params?: {
  page?: number;
  limit?: number;
  orgId?: string;
  status?: InvoiceStatus;
  search?: string;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.orgId) q.set("orgId", params.orgId);
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  return request<SubscriptionInvoice[]>(`${API_BASE}/admin/subscriptions/invoices/read?${q}`);
}

export async function generateInvoice(payload: {
  organizationSubscriptionId: string;
  notes?: string;
}) {
  return request<SubscriptionInvoice>(`${API_BASE}/admin/subscriptions/invoices/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markInvoicePaid(id: string) {
  return request<SubscriptionInvoice>(`${API_BASE}/admin/subscriptions/invoices/mark-paid`, {
    method: "PATCH",
    body: JSON.stringify({ id }),
  });
}

export function formatPrice(value: number | string | null | undefined) {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Feature group items may be plain strings or dropdown objects:
 * `{ label: "1-4 unit Residential", children: ["Bridge Loans", ...] }`
 */
function formatFeatureItem(item: unknown): string[] {
  if (item == null) return [];

  if (typeof item === "string") {
    const text = item.trim();
    return text ? [text] : [];
  }

  if (typeof item === "object") {
    const obj = item as {
      label?: unknown;
      name?: unknown;
      title?: unknown;
      children?: unknown[];
      items?: unknown[];
      subItems?: unknown[];
    };
    const label = String(obj.label || obj.name || obj.title || "").trim();
    if (!label) return [];

    const rawChildren = obj.children || obj.items || obj.subItems || [];
    const children = Array.isArray(rawChildren)
      ? rawChildren.map((child) => String(child).trim()).filter(Boolean)
      : [];

    return [label, ...children.map((child) => `· ${child}`)];
  }

  const fallback = String(item).trim();
  if (!fallback || fallback === "[object Object]") return [];
  return [fallback];
}

function flattenFeatureGroupItems(items: unknown[] = []): string[] {
  return items.flatMap(formatFeatureItem);
}

export type FeaturesPayload = {
  badge?: string | null;
  usersLabel?: string | null;
  includedUsers?: number | null;
  maxUsers?: number | null;
  extraUserPrice?: number | null;
  groups?: unknown[];
  features?: string[];
};

/** Parse stored features JSON into a structured payload (or null for legacy text). */
export function parseFeaturesPayload(
  features?: string | null,
): FeaturesPayload | null {
  if (!features?.trim()) return null;
  const text = features.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { groups: parsed };
    }
    if (parsed && typeof parsed === "object") {
      return {
        badge: parsed.badge ?? null,
        usersLabel: parsed.usersLabel ?? null,
        includedUsers:
          parsed.includedUsers != null ? Number(parsed.includedUsers) : null,
        maxUsers: parsed.maxUsers != null ? Number(parsed.maxUsers) : null,
        extraUserPrice:
          parsed.extraUserPrice != null ? Number(parsed.extraUserPrice) : null,
        groups: parsed.groups || parsed.featureGroups || [],
        features: Array.isArray(parsed.features) ? parsed.features : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Pretty-print features for the Edit Package textarea. */
export function featuresToEditableText(features?: string | null): string {
  if (!features?.trim()) return "";
  const text = features.trim();
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

/**
 * Build the `features` DB string from the edit form.
 * Preserves structured JSON (including dropdown children) when valid.
 * Plain line/comma lists stay as legacy newline storage.
 */
export function buildFeaturesStorage(input: {
  featuresText: string;
  badge?: string;
  usersLabel?: string;
  includedUsers?: string;
  maxUsers?: string;
  extraUserPrice?: string;
}): string | undefined {
  const text = input.featuresText.trim();
  if (!text) {
    // Still allow saving user-limit meta alone as a minimal payload
    const hasMeta =
      input.badge?.trim() ||
      input.usersLabel?.trim() ||
      input.includedUsers?.trim() ||
      input.maxUsers?.trim() ||
      input.extraUserPrice?.trim();
    if (!hasMeta) return undefined;
  }

  const toNum = (raw?: string) => {
    if (raw == null || !String(raw).trim()) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const meta = {
    badge: input.badge?.trim() || null,
    usersLabel: input.usersLabel?.trim() || null,
    includedUsers: toNum(input.includedUsers),
    maxUsers: toNum(input.maxUsers),
    extraUserPrice: toNum(input.extraUserPrice),
  };

  if (text.startsWith("{") || text.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Features must be valid JSON");
    }

    if (Array.isArray(parsed)) {
      return JSON.stringify({
        ...meta,
        groups: parsed,
      });
    }

    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      return JSON.stringify({
        ...obj,
        badge: meta.badge ?? obj.badge ?? null,
        usersLabel: meta.usersLabel ?? obj.usersLabel ?? null,
        includedUsers:
          meta.includedUsers ??
          (obj.includedUsers != null ? Number(obj.includedUsers) : null),
        maxUsers:
          meta.maxUsers ?? (obj.maxUsers != null ? Number(obj.maxUsers) : null),
        extraUserPrice:
          meta.extraUserPrice ??
          (obj.extraUserPrice != null ? Number(obj.extraUserPrice) : null),
        groups: obj.groups || obj.featureGroups || [],
      });
    }

    throw new Error("Features JSON must be an object or array");
  }

  // Legacy plain text — keep as newline list, but attach meta if provided
  const lines = text.includes("\n")
    ? text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : text
        .split(/[,;|]/)
        .map((line) => line.trim())
        .filter(Boolean);

  const hasMeta =
    meta.badge ||
    meta.usersLabel ||
    meta.includedUsers != null ||
    meta.maxUsers != null ||
    meta.extraUserPrice != null;

  if (!hasMeta) {
    return lines.join("\n") || undefined;
  }

  return JSON.stringify({
    ...meta,
    groups: lines.length
      ? [{ heading: null, variant: "default", items: lines }]
      : [],
  });
}

export function parseFeatures(features?: string | null) {
  if (!features?.trim()) return [];
  const text = features.trim();

  // Structured JSON payload from seed (feature groups + marketing meta)
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        if (parsed.every((item) => typeof item === "string")) {
          return parsed.map((s) => String(s).trim()).filter(Boolean);
        }
        return parsed.flatMap(
          (group: { items?: unknown[]; heading?: string }) => {
            const items = Array.isArray(group?.items) ? group.items : [];
            const heading = group?.heading ? String(group.heading).trim() : "";
            return [
              ...(heading ? [`▸ ${heading}`] : []),
              ...flattenFeatureGroupItems(items),
            ];
          },
        );
      }
      if (parsed && typeof parsed === "object") {
        const groups = parsed.groups || parsed.featureGroups || [];
        if (Array.isArray(groups) && groups.length > 0) {
          return groups.flatMap(
            (group: { items?: unknown[]; heading?: string }) => {
              const items = Array.isArray(group?.items) ? group.items : [];
              const heading = group?.heading ? String(group.heading).trim() : "";
              return [
                ...(heading ? [`▸ ${heading}`] : []),
                ...flattenFeatureGroupItems(items),
              ];
            },
          );
        }
      }
    } catch {
      // fall through
    }
  }

  if (text.includes("\n")) {
    return text
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  }
  return text
    .split(/[,;|]/)
    .map((f) => f.trim())
    .filter(Boolean);
}

export const USAGE_METRIC_LABELS: Record<UsageMetric, string> = {
  LOAN_APPLICATIONS: "Loan Applications",
  ACTIVE_USERS: "Active Users",
  LOAN_OFFICERS: "Loan Officers",
  LENDER_CONNECTIONS: "Lenders Network",
  CO_BROKERS: "Co-Brokers",
};

export const ADMIN_USAGE_LIMIT_METRICS: UsageMetric[] = [
  "LOAN_OFFICERS",
  "CO_BROKERS",
  "LENDER_CONNECTIONS",
  "LOAN_APPLICATIONS",
];

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  TRIAL: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  PAST_DUE: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  EXPIRED: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  VOID: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
};
