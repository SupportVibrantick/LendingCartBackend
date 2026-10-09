import { getAdminAuthHeaders } from "../../lib/adminApi";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
export const ADMIN_USER_BASE = `${API_BASE}/admin/admin-user`;

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 50] as const;
export const SEARCH_DEBOUNCE_MS = 350;

export type PermissionItem = {
  key: string;
  label: string;
  description?: string;
  module?: string;
  action?: string;
};

export type PermissionGroup = {
  id?: string;
  label: string;
  order?: number;
  permissions: PermissionItem[];
};

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId?: string | null;
  status?: string;
  createdAt?: string;
  lastLoginAt?: string | null;
  accessLevel?: "FULL" | "CUSTOM";
  permissions?: string[];
  permissionCount?: number | null;
};

export type AdminStats = {
  total: number;
  active: number;
  inactive: number;
  fullAccess: number;
  customAccess: number;
};

export type AdminUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  accessLevel: "FULL" | "CUSTOM";
  permissions: string[];
};

export type ListAdminsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  accessLevel?: "ALL" | "FULL" | "CUSTOM";
};

export function emptyAdminForm(): AdminUserForm {
  return {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    accessLevel: "CUSTOM",
    permissions: [],
  };
}

export function getAuthHeaders(): Record<string, string> {
  return getAdminAuthHeaders(true);
}

export function isActiveStatus(status?: string) {
  return (status || "").toUpperCase() === "ACTIVE";
}

export function isFullAccess(admin: Pick<AdminUser, "accessLevel" | "permissions">) {
  return admin.accessLevel === "FULL" || admin.permissions?.includes("*");
}

export function displayStatus(status?: string) {
  return isActiveStatus(status) ? "Active" : "Inactive";
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function getInitials(firstName?: string, lastName?: string) {
  const a = (firstName || "").trim().charAt(0);
  const b = (lastName || "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

export function getCurrentAdminId(): string | null {
  try {
    const raw = sessionStorage.getItem("admin_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id || user?.userId || null;
  } catch {
    return null;
  }
}

export function passwordStrengthHint(password: string) {
  const rules = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(password), label: "Uppercase" },
    { ok: /[a-z]/.test(password), label: "Lowercase" },
    { ok: /[0-9]/.test(password), label: "Number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "Special character" },
  ];
  return rules;
}

export async function fetchPermissionGroups(): Promise<PermissionGroup[]> {
  const res = await fetch(`${ADMIN_USER_BASE}/permissions`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to load permissions");
  }
  return (json.data || []) as PermissionGroup[];
}

export async function fetchAdmins(
  params: ListAdminsParams = {},
  signal?: AbortSignal,
) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE);

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const search = params.search?.trim();
  if (search) qs.set("search", search);
  if (params.status && params.status !== "ALL") qs.set("status", params.status);
  if (params.accessLevel && params.accessLevel !== "ALL") {
    qs.set("accessLevel", params.accessLevel);
  }

  const res = await fetch(`${ADMIN_USER_BASE}/read?${qs.toString()}`, {
    headers: getAuthHeaders(),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to load admin users");
  }

  return {
    data: (json.data || []) as AdminUser[],
    stats: (json.stats || {
      total: 0,
      active: 0,
      inactive: 0,
      fullAccess: 0,
      customAccess: 0,
    }) as AdminStats,
    pagination: {
      total: Number(json.pagination?.total) || 0,
      page: Number(json.pagination?.page) || page,
      limit: Number(json.pagination?.limit) || limit,
      totalPages: Math.max(1, Number(json.pagination?.totalPages) || 1),
      hasMore: Boolean(json.pagination?.hasMore),
    },
  };
}

export async function fetchAdminById(id: string): Promise<AdminUser> {
  const res = await fetch(`${ADMIN_USER_BASE}/read/${id}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to load admin user");
  }
  return json.data as AdminUser;
}

export async function createAdmin(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  accessLevel: "FULL" | "CUSTOM";
  permissions: string[];
}): Promise<{ success: boolean; message?: string; emailQueued?: boolean }> {
  const res = await fetch(`${ADMIN_USER_BASE}/create`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const fieldError =
      json.errors?.fieldErrors?.permissions?.[0] ||
      json.errors?.fieldErrors?.password?.[0] ||
      json.errors?.fieldErrors?.email?.[0];
    throw new Error(fieldError || json.message || "Failed to create admin");
  }
  return json;
}

export async function updateAdmin(
  id: string,
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    accessLevel: "FULL" | "CUSTOM";
    permissions: string[];
  },
) {
  const res = await fetch(`${ADMIN_USER_BASE}/update/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to update admin");
  }
  return json;
}

export async function updateAdminStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  const res = await fetch(`${ADMIN_USER_BASE}/status/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to update status");
  }
  return json;
}

export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100";
