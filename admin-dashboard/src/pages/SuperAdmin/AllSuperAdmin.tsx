import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const ADMIN_BASE = `${API_BASE}/admin/admin-user`;
const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [4, 8, 12, 16, 20] as const;
const SEARCH_DEBOUNCE_MS = 300;

type PermissionItem = { key: string; label: string; description?: string };
type PermissionGroup = { label: string; permissions: PermissionItem[] };

type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId?: string | null;
  status?: string;
  createdAt?: string;
  accessLevel?: "FULL" | "CUSTOM";
  permissions?: string[];
};

type AdminUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  accessLevel: "FULL" | "CUSTOM";
  permissions: string[];
};

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function statusClass(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
  }
  return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
}

function formatPermission(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isActiveStatus(status?: string) {
  return (status || "").toUpperCase() === "ACTIVE";
}

function isFullAccess(admin: AdminUser) {
  return admin.accessLevel === "FULL" || admin.permissions?.includes("*");
}

const AllSuperadmin: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>(
    [],
  );
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const MENU_WIDTH = 168;

  const [form, setForm] = useState<AdminUserForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    accessLevel: "CUSTOM",
    permissions: [],
  });

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  const resetForm = () => {
    setEditingAdminId(null);
    setShowPassword(false);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      accessLevel: "CUSTOM",
      permissions: [],
    });
  };

  const fetchPermissionGroups = async () => {
    try {
      setLoadingPermissions(true);
      const res = await fetch(`${ADMIN_BASE}/permissions`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        setPermissionGroups(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load permissions", err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const fetchAdmins = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await fetch(`${ADMIN_BASE}/read`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        toast.error("Failed to load admin users");
        return;
      }
      const json = await res.json();
      const items = (json.data || json.users || []) as AdminUser[];
      setAdmins(items);
    } catch (err) {
      console.error("Failed to load admins", err);
      toast.error("Failed to load admin users");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const togglePermission = (key: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName || !form.lastName || !form.email) {
      toast.error("First name, last name and email are required.");
      return;
    }

    if (!editingAdminId && !form.password) {
      toast.error("Password is required for new admins.");
      return;
    }

    if (form.accessLevel === "CUSTOM" && form.permissions.length === 0) {
      toast.error("Select at least one permission for custom access.");
      return;
    }

    try {
      setSaving(true);

      if (editingAdminId) {
        const res = await fetch(`${ADMIN_BASE}/update/${editingAdminId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            accessLevel: form.accessLevel,
            permissions: form.accessLevel === "FULL" ? [] : form.permissions,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          toast.error(json.message || "Failed to update admin");
          return;
        }
        toast.success("Admin updated successfully");
      } else {
        const res = await fetch(`${ADMIN_BASE}/create`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            password: form.password,
            accessLevel: form.accessLevel,
            permissions: form.accessLevel === "FULL" ? [] : form.permissions,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          toast.error(
            json.message ||
              json.errors?.fieldErrors?.permissions?.[0] ||
              "Failed to create admin",
          );
          return;
        }
        toast.success("Admin created successfully");
      }

      await fetchAdmins();
      resetForm();
    } catch (err) {
      console.error("Error saving admin", err);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (admin: AdminUser) => {
    setEditingAdminId(admin.id);
    const full = isFullAccess(admin);
    setForm({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      password: "",
      accessLevel: full ? "FULL" : "CUSTOM",
      permissions: full ? [] : admin.permissions || [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    try {
      if (!admin.id) return;
      setTogglingId(admin.id);
      const isActive = isActiveStatus(admin.status);

      const res = await fetch(`${ADMIN_BASE}/status/${admin.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: isActive ? "INACTIVE" : "ACTIVE" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        toast.error(json.message || "Failed to update status");
        return;
      }
      toast.success("Status updated");
      await fetchAdmins();
    } catch (err) {
      console.error("Failed to toggle status", err);
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchPermissionGroups();
  }, [fetchAdmins]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!openMenuId) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest?.("[data-admin-menu-trigger]")) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpenMenuId(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    const onRepositionClose = () => setOpenMenuId(null);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onRepositionClose);
    window.addEventListener("scroll", onRepositionClose, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onRepositionClose);
      window.removeEventListener("scroll", onRepositionClose, true);
    };
  }, [openMenuId]);

  const filteredAdmins = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return admins;
    return admins.filter((a) => {
      const name = `${a.firstName} ${a.lastName}`.toLowerCase();
      const email = (a.email || "").toLowerCase();
      const access = isFullAccess(a) ? "full access" : "custom";
      const status = (a.status || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        access.includes(q) ||
        status.includes(q)
      );
    });
  }, [admins, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const pagedAdmins = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAdmins.slice(start, start + pageSize);
  }, [filteredAdmins, safePage, pageSize]);

  useEffect(() => {
    if (currentPage !== safePage) setCurrentPage(safePage);
  }, [currentPage, safePage]);

  const showingFrom =
    filteredAdmins.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, filteredAdmins.length);

  const totalAdmins = admins.length;
  const activeAdmins = admins.filter((a) => isActiveStatus(a.status)).length;
  const inactiveAdmins = Math.max(totalAdmins - activeAdmins, 0);
  const fullAccessAdmins = admins.filter((a) => isFullAccess(a)).length;

  const openRowMenu = (adminId: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const estimatedHeight = 64;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 8;
    const top = openUp
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setMenuPos({ top, left });
    setOpenMenuId((prev) => (prev === adminId ? null : adminId));
  };

  const activeMenuAdmin = useMemo(
    () => admins.find((a) => a.id === openMenuId) || null,
    [admins, openMenuId],
  );

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100";

  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] px-5 py-5 text-white sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Platform access
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Super Admin Users
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Create admins and control what they can access across the
              platform.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchAdmins()}
            disabled={loadingList}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
            />
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total admins",
            value: totalAdmins,
            icon: Users,
            iconWrap:
              "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
          },
          {
            label: "Active",
            value: activeAdmins,
            icon: CheckCircle2,
            iconWrap:
              "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
          },
          {
            label: "Inactive",
            value: inactiveAdmins,
            icon: Ban,
            iconWrap:
              "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          },
          {
            label: "Full access",
            value: fullAccessAdmins,
            icon: KeyRound,
            iconWrap:
              "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {loadingList ? "—" : stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Form */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {editingAdminId ? "Edit admin user" : "Add admin user"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              {editingAdminId
                ? "Update details and permissions."
                : "Create a new platform admin."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                  First name *
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  disabled={saving}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                  Last name *
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Email *
              </label>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                disabled={saving}
              />
            </div>

            {!editingAdminId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputClass} pr-10`}
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Access level *
              </label>
              <div className="space-y-2">
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                    form.accessLevel === "FULL"
                      ? "border-[#13538A]/40 bg-[#13538A]/5 dark:border-sky-500/40 dark:bg-sky-500/10"
                      : "border-gray-200 dark:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    checked={form.accessLevel === "FULL"}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        accessLevel: "FULL",
                        permissions: [],
                      }))
                    }
                    className="accent-[#13538A]"
                  />
                  <span className="text-sm text-gray-800 dark:text-slate-200">
                    Full access — all permissions
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                    form.accessLevel === "CUSTOM"
                      ? "border-[#13538A]/40 bg-[#13538A]/5 dark:border-sky-500/40 dark:bg-sky-500/10"
                      : "border-gray-200 dark:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    checked={form.accessLevel === "CUSTOM"}
                    onChange={() =>
                      setForm((f) => ({ ...f, accessLevel: "CUSTOM" }))
                    }
                    className="accent-[#13538A]"
                  />
                  <span className="text-sm text-gray-800 dark:text-slate-200">
                    Custom — select permissions below
                  </span>
                </label>
              </div>
            </div>

            {form.accessLevel === "CUSTOM" && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                    Permissions * ({form.permissions.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-[#13538A] hover:underline dark:text-sky-400"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          permissions: permissionGroups.flatMap((g) =>
                            g.permissions.map((p) => p.key),
                          ),
                        }))
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-gray-500 hover:underline dark:text-slate-400"
                      onClick={() =>
                        setForm((f) => ({ ...f, permissions: [] }))
                      }
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {loadingPermissions ? (
                  <p className="text-xs text-gray-400">Loading permissions...</p>
                ) : (
                  <div className="custom-scrollbar max-h-52 space-y-3 overflow-y-auto rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                    {permissionGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                          {group.label}
                        </p>
                        <div className="space-y-1">
                          {group.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 rounded accent-[#13538A]"
                                checked={form.permissions.includes(perm.key)}
                                onChange={() => togglePermission(perm.key)}
                              />
                              <span className="text-xs text-gray-700 dark:text-slate-300">
                                {perm.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b72be] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingAdminId
                    ? "Save changes"
                    : "Create admin"}
              </button>
              {editingAdminId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                All admin users
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                {filteredAdmins.length} admin
                {filteredAdmins.length === 1 ? "" : "s"}
                {debouncedSearch ? " matching search" : " on the platform"}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search admins..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2 self-end text-xs text-gray-500 sm:self-auto dark:text-slate-400">
                Per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2.5 pr-4">Name</th>
                  <th className="py-2.5 pr-4">Email</th>
                  <th className="py-2.5 pr-4">Access</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Created</th>
                  <th className="w-[72px] py-2.5 pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-gray-500 dark:text-slate-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading admins...
                      </div>
                    </td>
                  </tr>
                ) : pagedAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-slate-800 dark:text-slate-500">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                          {debouncedSearch
                            ? "No results found"
                            : "No admin users yet"}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-slate-400">
                          {debouncedSearch
                            ? `Nothing matched "${debouncedSearch}". Try a different search.`
                            : "Create an admin using the form on the left."}
                        </p>
                        {debouncedSearch && (
                          <button
                            type="button"
                            onClick={() => setSearchInput("")}
                            className="mt-3 text-sm font-medium text-[#13538A] hover:underline dark:text-sky-400"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedAdmins.map((a) => {
                    const full = isFullAccess(a);
                    const permPreview = full
                      ? "Full access"
                      : `${a.permissions?.length ?? 0} permissions`;
                    const statusLabel = (() => {
                      const s = (a.status || "UNKNOWN").toUpperCase();
                      return s === "DISABLED" ? "INACTIVE" : s;
                    })();

                    return (
                      <tr
                        key={a.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {a.firstName} {a.lastName}
                          </div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-600 dark:text-slate-300">
                          {a.email}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              full
                                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                            }`}
                            title={
                              full
                                ? "Full access"
                                : a.permissions?.map(formatPermission).join(", ")
                            }
                          >
                            {permPreview}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => !togglingId && handleToggleStatus(a)}
                            disabled={togglingId === a.id}
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${statusClass(
                              a.status,
                            )}`}
                          >
                            {togglingId === a.id ? "Updating..." : statusLabel}
                          </button>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-600 dark:text-slate-300">
                          {formatDate(a.createdAt)}
                        </td>
                        <td className="py-3 pr-0 text-right whitespace-nowrap">
                          <button
                            type="button"
                            data-admin-menu-trigger="true"
                            title="More actions"
                            aria-label="More actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRowMenu(a.id, e.currentTarget);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredAdmins.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-medium text-gray-700 dark:text-slate-200">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700 dark:text-slate-200">
                  {filteredAdmins.length}
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safePage <= 1 || loadingList}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      disabled={loadingList}
                      className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                        safePage === page
                          ? "border-[#13538A] bg-[#13538A] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(p + 1, totalPages))
                  }
                  disabled={safePage >= totalPages || loadingList}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeMenuAdmin &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: MENU_WIDTH,
            }}
            className="z-[9999] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                handleEdit(activeMenuAdmin);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default AllSuperadmin;
