// src/pages/AdminUsers/AllSuperadmin.tsx
import { ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit } from "react-icons/md";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
// Adjust this if your backend prefix is different
const ADMIN_BASE = `${API_BASE}/admin/admin-user`;

type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId?: string | null; // can still DISPLAY from backend, but we won't SEND anything
  status?: string; // e.g. "ACTIVE" | "INACTIVE"
  createdAt?: string;
};

type AdminUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

// same helper as BrokersPage / LoanProducts
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

// tiny helper for status pill
function statusClass(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

const AllSuperadmin: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminUserForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  // ===== Helpers =====
  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  const resetForm = () => {
    setEditingAdminId(null);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    });
  };

  // ===== API Calls =====
  const fetchAdmins = async () => {
    try {
      setLoadingList(true);

      const res = await fetch(`${ADMIN_BASE}/read`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        console.error("Failed to load admins:", res.status);
        return;
      }

      const json = await res.json();

      if (json.success === false) {
        console.error("Failed to load admins:", json.message);
        return;
      }

      const items = (json.data || json.users || []) as any[];

      const mapped: AdminUser[] = items.map((u) => ({
        id: String(u.id),
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        email: u.email ?? "",
        organizationId:
          u.organizationId !== undefined && u.organizationId !== null
            ? String(u.organizationId)
            : null,
        status: u.status ?? "ACTIVE",
        createdAt: u.createdAt ?? undefined,
      }));

      setAdmins(mapped);
    } catch (err) {
      console.error("Failed to load admins", err);
    } finally {
      setLoadingList(false);
    }
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

    try {
      setSaving(true);

      if (editingAdminId) {
        // UPDATE existing admin (no password or organizationId change here)
        const res = await fetch(`${ADMIN_BASE}/update/${editingAdminId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
          }),
        });

        if (!res.ok) {
          console.error("Failed to update admin:", res.status);
          const json = await res.json().catch(() => ({}));
          toast.error(json.message || "Failed to update admin");
          return;
        }

        const json = await res.json();
        if (json.success === false) {
          console.error("Failed to update admin:", json.message);
          toast.error(json.message || "Failed to update admin");
          return;
        }
      } else {
        // CREATE new admin
        // IMPORTANT: we are NOT sending organizationId from frontend
        const res = await fetch(`${ADMIN_BASE}/create`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            password: form.password,
          }),
        });

        if (!res.ok) {
          console.error("Failed to create admin:", res.status);
          const json = await res.json().catch(() => ({}));
          toast.error(json.message || "Failed to create admin");
          return;
        }

        const json = await res.json();
        if (json.success === false) {
          console.error("Failed to create admin:", json.message);
          toast.error(json.message || "Failed to create admin");
          return;
        }
      }

      await fetchAdmins();
      resetForm();
    } catch (err) {
      console.error("Error saving admin", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (admin: AdminUser) => {
    setEditingAdminId(admin.id);
    setForm({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      password: "", // not editable here
    });
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    try {
      if (!admin.id) return;
      setTogglingId(admin.id);

      const res = await fetch(`${ADMIN_BASE}/status/${admin.id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status:
            (admin.status || "").toUpperCase() === "ACTIVE"
              ? "INACTIVE"
              : "ACTIVE",
        }),
      });

      if (!res.ok) {
        console.error("Failed to update admin status:", res.status);
        const json = await res.json().catch(() => ({}));
        toast.error(json.message || "Failed to update admin status");
        return;
      }

      const json = await res.json();
      if (json.success === false) {
        console.error("Failed to update admin status:", json.message);
        toast.error(json.message || "Failed to update admin status");
        return;
      }

      await fetchAdmins();
    } catch (err) {
      console.error("Failed to toggle admin status", err);
    } finally {
      setTogglingId(null);
    }
  };

  // ===== Effects =====
  useEffect(() => {
    fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== UI =====
  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#13538A] dark:text-indigo-600">
            Super Admin Users
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage platform super admins and their basic details.
          </p>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        {/* LEFT CARD – Create / Edit admin */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {editingAdminId ? "Edit Admin User" : "Add Admin User"}
          </h2>
          <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
            Create and manage admin accounts for your lending platform.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                First Name
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                placeholder="First name"
                disabled={saving}
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Last Name
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                placeholder="Last name"
                disabled={saving}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="admin@example.com"
                disabled={saving}
              />
            </div>

            {/* Password (only for create) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                {editingAdminId ? "Password (not editable here)" : "Password"}
              </label>
              <input
                type="password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder={editingAdminId ? "********" : "Enter password"}
                disabled={saving || !!editingAdminId}
              />
              {editingAdminId && (
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Password cannot be changed from this screen.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md bg-[#13538A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1874c5] disabled:opacity-60 disabled:cursor-not-allowed
                           "
              >
                {saving
                  ? editingAdminId
                    ? "Saving..."
                    : "Creating..."
                  : editingAdminId
                    ? "Save Changes"
                    : "Create Admin"}
              </button>

              {editingAdminId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="text-xs text-gray-500 hover:text-gray-700 underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* RIGHT CARD – Admins table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Admin Users
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Super admins configured for the platform.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchAdmins}
              disabled={loadingList}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed
                         dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {loadingList ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-4 text-left">Name</th>
                  <th className="py-2 pr-4 text-left">Email</th>
                  <th className="py-2 pr-4 text-left">Org ID</th>
                  <th className="py-2 pr-4 text-left">Status</th>
                  <th className="py-2 pr-4 text-left">Created</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={6} className="py-14">
                      <div className="flex flex-col items-center justify-center text-center space-y-4">
                        {/* Spinner */}
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />

                        {/* Message */}
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          Loading admin users...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        {/* Icon Circle */}
                        <div
                          className="w-14 h-14 flex items-center justify-center
          rounded-full
          bg-blue-100 dark:bg-blue-900/30
          text-blue-600 dark:text-blue-400
          mb-4"
                        >
                          <ShieldCheck size={26} />
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-slate-800 dark:text-white">
                          No Admin Users Found
                        </h3>

                        {/* Subtitle */}
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                          There are currently no admin accounts available in the
                          system.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  admins.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                        {a.firstName} {a.lastName}
                      </td>
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                        {a.email}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                        {a.organizationId ?? "-"}
                      </td>

                      {/* Clickable status pill */}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (!togglingId) {
                              handleToggleStatus(a);
                            }
                          }}
                          disabled={togglingId === a.id}
                          className={`inline-flex items-center px-3 py-1 rounded-full border text-xs cursor-pointer
                                      ${statusClass(a.status)}
                                      disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {togglingId === a.id
                            ? "Updating..."
                            : (a.status || "UNKNOWN").toUpperCase()}
                        </button>
                      </td>

                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                        {formatDate(a.createdAt)}
                      </td>

                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100
                                       dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <MdModeEdit />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
