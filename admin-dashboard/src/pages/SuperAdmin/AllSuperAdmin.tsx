import { ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit } from "react-icons/md";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const ADMIN_BASE = `${API_BASE}/admin/admin-user`;

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
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300";
}

function formatPermission(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const AllSuperadmin: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);

  const [form, setForm] = useState<AdminUserForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    accessLevel: "CUSTOM",
    permissions: [],
  });

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  };

  const resetForm = () => {
    setEditingAdminId(null);
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

  const fetchAdmins = async () => {
    try {
      setLoadingList(true);
      const res = await fetch(`${ADMIN_BASE}/read`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const items = (json.data || json.users || []) as AdminUser[];
      setAdmins(items);
    } catch (err) {
      console.error("Failed to load admins", err);
    } finally {
      setLoadingList(false);
    }
  };

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
          toast.error(json.message || json.errors?.fieldErrors?.permissions?.[0] || "Failed to create admin");
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
    const isFull = admin.accessLevel === "FULL" || admin.permissions?.includes("*");
    setForm({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      password: "",
      accessLevel: isFull ? "FULL" : "CUSTOM",
      permissions: isFull ? [] : admin.permissions || [],
    });
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    try {
      if (!admin.id) return;
      setTogglingId(admin.id);
      const isActive = (admin.status || "").toUpperCase() === "ACTIVE";

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
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchPermissionGroups();
  }, []);

  return (
    <div className="px-4 py-6 md:px-6 text-gray-900 dark:text-gray-100">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#13538A] dark:text-indigo-400">
          Super Admin Users
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create admins and assign what they can access on the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1 font-semibold text-slate-900 dark:text-white">
            {editingAdminId ? "Edit Admin User" : "Add Admin User"}
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            {editingAdminId ? "Update details and permissions" : "Create a new platform admin"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">First Name *</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Last Name *</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email *</label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={saving}
              />
            </div>

            {!editingAdminId && (
              <div>
                <label className="mb-1 block text-sm font-medium">Password *</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  disabled={saving}
                />
              </div>
            )}

            {/* Access level */}
            <div>
              <label className="mb-2 block text-sm font-medium">Access Level *</label>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <input
                    type="radio"
                    name="accessLevel"
                    checked={form.accessLevel === "FULL"}
                    onChange={() => setForm((f) => ({ ...f, accessLevel: "FULL", permissions: [] }))}
                  />
                  <span className="text-sm">Full Access — all permissions</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <input
                    type="radio"
                    name="accessLevel"
                    checked={form.accessLevel === "CUSTOM"}
                    onChange={() => setForm((f) => ({ ...f, accessLevel: "CUSTOM" }))}
                  />
                  <span className="text-sm">Custom — select permissions below</span>
                </label>
              </div>
            </div>

            {/* Permissions */}
            {form.accessLevel === "CUSTOM" && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Permissions * ({form.permissions.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-[#13538A] hover:underline"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          permissions: permissionGroups.flatMap((g) =>
                            g.permissions.map((p) => p.key)
                          ),
                        }))
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-500 hover:underline"
                      onClick={() => setForm((f) => ({ ...f, permissions: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {loadingPermissions ? (
                  <p className="text-xs text-slate-400">Loading permissions...</p>
                ) : (
                  <div className="custom-scrollbar max-h-52 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    {permissionGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {group.label}
                        </p>
                        <div className="space-y-1">
                          {group.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 rounded accent-[#13538A]"
                                checked={form.permissions.includes(perm.key)}
                                onChange={() => togglePermission(perm.key)}
                              />
                              <span className="text-xs text-slate-700 dark:text-slate-300">
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
                className="rounded-lg bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad] disabled:opacity-60"
              >
                {saving ? "Saving..." : editingAdminId ? "Save Changes" : "Create Admin"}
              </button>
              {editingAdminId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">All Admin Users</h2>
              <p className="text-xs text-slate-500">{admins.length} admin(s)</p>
            </div>
            <button
              type="button"
              onClick={fetchAdmins}
              disabled={loadingList}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700"
            >
              {loadingList ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Access</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <div className="flex flex-col items-center text-center">
                        <ShieldCheck className="mb-3 text-slate-300" size={32} />
                        <p className="font-medium text-slate-600 dark:text-slate-300">
                          No Admin Users Found
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Create an admin using the form on the left.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  admins.map((a) => {
                    const isFull = a.accessLevel === "FULL" || a.permissions?.includes("*");
                    const permPreview = isFull
                      ? "Full Access"
                      : `${a.permissions?.length ?? 0} permissions`;

                    return (
                      <tr
                        key={a.id}
                        className="border-b border-slate-50 last:border-0 dark:border-slate-800"
                      >
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {a.firstName} {a.lastName}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">{a.email}</td>
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              isFull
                                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}
                            title={
                              isFull
                                ? "Full access"
                                : a.permissions?.map(formatPermission).join(", ")
                            }
                          >
                            {permPreview}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            onClick={() => !togglingId && handleToggleStatus(a)}
                            disabled={togglingId === a.id}
                            className={`rounded-full border px-2.5 py-0.5 text-xs ${statusClass(a.status)}`}
                          >
                            {togglingId === a.id
                              ? "..."
                              : (a.status || "UNKNOWN").toUpperCase() === "DISABLED"
                                ? "INACTIVE"
                                : (a.status || "UNKNOWN").toUpperCase()}
                          </button>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap text-slate-500">
                          {formatDate(a.createdAt)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEdit(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700"
                          >
                            <MdModeEdit />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllSuperadmin;
