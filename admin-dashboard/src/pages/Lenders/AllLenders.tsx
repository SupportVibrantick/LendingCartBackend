import React, { useEffect, useMemo, useState } from "react";
import { MdModeEdit, MdDelete } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import EditBrokerModal from "../Brokers/EditBrokerModal"; // you can reuse this for lenders too

type Lender = {
  id: any; // keep flexible because API returns UUID string; UI can still treat as string/number
  name: string;
  email: string;
  phone: string;
  status?: string;
  createdAt?: string;
};

type Admin = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

const STATUS_ORDER = ["ACTIVE", "INACTIVE"]; // keep real backend enum

function statusClass(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800 border-green-200";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function AllLendersPage() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<any | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingLender, setEditingLender] = useState<Lender | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Admins modal & editing state
  const [showAdminsFor, setShowAdminsFor] = useState<Lender | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  // Admin inline-edit state
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [adminEditForm, setAdminEditForm] = useState<Admin>({});
  const [adminSaving, setAdminSaving] = useState(false);

  const API_BASE = "http://localhost:3001"; // adjust if needed

  useEffect(() => {
    fetchLenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

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
      // ignore
    }
    return { "Content-Type": "application/json" };
  }

  async function fetchLenders() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/lenders/read/`, {
        method: "GET",
        headers,
      });

      if (!res.ok) throw new Error(`Failed to fetch lenders: ${res.status}`);

      const json = await res.json();
      // your lenders list API: { success, data: { total, page, limit, results: [...] } }
      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];

      const normalized: Lender[] = (list as any[]).map((o: any, idx: number) => {
        const id = o.id ?? idx + 1;
        return {
          id,
          name: o.name ?? o.organizationName ?? "",
          email: o.email ?? o.organizationEmail ?? "",
          phone: o.phone ?? o.organizationPhone ?? "",
          status: o.status ?? "UNKNOWN",
          createdAt: o.createdAt,
        };
      });

      setLenders(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openAdd = () => {
    setForm({
      organizationName: "",
      organizationEmail: "",
      organizationPhone: "",
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: "",
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleDelete = async (lender: Lender) => {
    if (!window.confirm(`Delete lender "${lender.name}"?`)) return;
    // you likely want a soft-delete API here later
    setRowLoadingId(lender.id);
    await new Promise((r) => setTimeout(r, 600));
    setLenders((prev) => prev.filter((b) => b.id !== lender.id));
    setRowLoadingId(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (
      !form.organizationName.trim() ||
      !form.organizationEmail.trim() ||
      !form.adminEmail.trim() ||
      !form.adminPassword.trim()
    ) {
      setFormError(
        "Please fill required fields: organization name, organization email, admin email and password."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        organizationName: form.organizationName,
        organizationEmail: form.organizationEmail,
        organizationPhone: form.organizationPhone,
        adminFirstName: form.adminFirstName,
        adminLastName: form.adminLastName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      };

      const headers = getAuthHeaders();

      const res = await fetch(`${API_BASE}/admin/lenders/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.message || `Server returned ${res.status}`);
        return;
      }

      setIsAddOpen(false);
      await fetchLenders();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lenders;
    return lenders.filter((b) => {
      return (
        (b.name || "").toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.status || "").toLowerCase().includes(q)
      );
    });
  }, [lenders, query]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function gotoPage(page: number) {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const openEditModal = (b: Lender) => {
    setEditingLender(b);
  };

  const handleEditSave = async (updated: Lender) => {
    setLenders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingLender(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      await fetch(`${API_BASE}/admin/lenders/update/${updated.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
        }),
      });
    } catch (err) {
      console.error("Failed to persist lender update:", err);
    }
  };

  const changeStatusFor = async (lender: Lender) => {
    if (!lender?.id) return;
    const cur = (lender.status || "UNKNOWN").toUpperCase();
    const idx = STATUS_ORDER.indexOf(cur);
    const next = idx === -1 ? "ACTIVE" : STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];

    const prevStatus = lender.status;
    setLenders((prev) =>
      prev.map((b) => (b.id === lender.id ? { ...b, status: next } : b))
    );
    setRowLoadingId(lender.id);

    try {
      const token = sessionStorage.getItem("admin_token");

      // use dedicated lender status routes with broker-guard logic
      const path =
        next === "ACTIVE"
          ? `${API_BASE}/admin/lenders/status/activate/${lender.id}`
          : `${API_BASE}/admin/lenders/status/deactivate/${lender.id}`;

      const res = await fetch(path, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        // If blocked by broker or any error -> rollback
        const msg =
          json?.message ||
          (res.status === 400
            ? "Cannot change status for this lender (likely assigned to brokers)."
            : `Status update failed: ${res.status}`);
        throw new Error(msg);
      }

      // If server returns canonical data, merge
      if (json && json.data) {
        const serverObj = json.data;
        setLenders((prev) =>
          prev.map((b) =>
            b.id === lender.id
              ? {
                  ...b,
                  name: serverObj.name ?? b.name,
                  status: serverObj.status ?? next,
                }
              : b
          )
        );
      }
    } catch (err: any) {
      console.error(err);
      setLenders((prev) =>
        prev.map((b) =>
          b.id === lender.id ? { ...b, status: prevStatus } : b
        )
      );
      alert(err?.message || "Failed to update status. Please try again.");
    } finally {
      setRowLoadingId(null);
    }
  };

  // ------------------------------
  // Fetch admins for a lender id
  // ------------------------------
  async function fetchAdmins(lenderId: any) {
    setLoadingAdmins(true);
    setAdmins([]);
    setAdminsError(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(`${API_BASE}/admin/lenders/read/${lenderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error(`Failed to load lender admins: ${res.status}`);

      const json = await res.json().catch(() => ({}));
      const org = json?.data?.organization;
      const adminUser = json?.data?.adminUser;

      let adminList: any[] = [];

      if (Array.isArray(org?.users) && org.users.length > 0) {
        adminList = org.users;
      } else if (adminUser) {
        adminList = [adminUser];
      }

      const normalized: Admin[] = adminList.map((a: any) => ({
        id: a.id,
        firstName: a.firstName ?? "",
        lastName: a.lastName ?? "",
        email: a.email ?? "",
        phone: a.phone ?? "",
      }));

      setAdmins(normalized);
    } catch (err: any) {
      console.error("fetchAdmins error:", err);
      setAdminsError(err?.message || "Failed to load admins");
    } finally {
      setLoadingAdmins(false);
    }
  }

  const openAdminsFor = async (lender: Lender) => {
    setShowAdminsFor(lender);
    setEditingAdminId(null);
    setAdminEditForm({});
    await fetchAdmins(lender.id);
  };

  const closeAdmins = () => {
    setShowAdminsFor(null);
    setAdmins([]);
    setAdminsError(null);
    setEditingAdminId(null);
    setAdminEditForm({});
  };

  const startEditAdmin = (a: Admin) => {
    setEditingAdminId(a.id ?? null);
    setAdminEditForm({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      phone: a.phone,
    });
  };

  const cancelEditAdmin = () => {
    setEditingAdminId(null);
    setAdminEditForm({});
  };

  const saveAdminEdit = async () => {
    const adminId = editingAdminId;
    if (!adminId) return alert("No admin selected for edit.");

    if (
      !(
        adminEditForm.firstName ||
        adminEditForm.lastName ||
        adminEditForm.email
      )
    ) {
      return alert(
        "Please provide at least one field to update (first name / last name / email)."
      );
    }

    setAdminSaving(true);

    setAdmins((prev) =>
      prev.map((p) => (p.id === adminId ? { ...p, ...adminEditForm } : p))
    );

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(
        `${API_BASE}/admin/lenders/admin/update/${adminId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            firstName: adminEditForm.firstName,
            lastName: adminEditForm.lastName,
            email: adminEditForm.email,
            phone: adminEditForm.phone,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      const json = await res.json().catch(() => ({}));
      if (json && json.data) {
        const serverObj = json.data;
        setAdmins((prev) =>
          prev.map((p) => (p.id === adminId ? { ...p, ...serverObj } : p))
        );
      }

      setEditingAdminId(null);
      setAdminEditForm({});
    } catch (err: any) {
      console.error("saveAdminEdit error:", err);
      alert(err?.message || "Failed to save admin. Changes rolled back.");
      if (showAdminsFor?.id) {
        await fetchAdmins(showAdminsFor.id);
      }
    } finally {
      setAdminSaving(false);
    }
  };

  return (
    <div className="px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Lenders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage lender organizations and their admin users.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search by name, email, phone or status"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-2 border rounded-md w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search lenders"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-2 border rounded-md bg-white"
              aria-label="Page size"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
            </select>
          </div>

          <button
            onClick={openAdd}
            className="inline-flex items-center whitespace-nowrap px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            type="button"
            aria-label="Add Lender"
          >
            <TiPlus className="mr-2" />
            Add Lender
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">
            Loading lenders...
          </div>
        ) : total === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            No lenders found.
          </div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="py-2 pr-4 text-left">Organization</th>
                    <th className="py-2 pr-4 text-left">Email</th>
                    <th className="py-2 pr-4 text-left">Phone</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-left">Created</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => {
                    const isLoading = rowLoadingId === b.id;
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40"
                      >
                        <td className="py-3 pr-4 text-gray-900 whitespace-nowrap">
                          <button
                            onClick={() => openAdminsFor(b)}
                            className="text-left underline text-blue-600 hover:text-blue-800"
                            aria-label={`View admin for ${b.name}`}
                          >
                            {b.name}
                          </button>
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                          {b.email}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                          {b.phone}
                        </td>

                        <td className="py-3 pr-4 whitespace-nowrap">
                          <button
                            onClick={() => !isLoading && changeStatusFor(b)}
                            disabled={isLoading}
                            className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full border ${statusClass(
                              b.status
                            )} disabled:opacity-60`}
                            title="Click to change status"
                            aria-label={`Change status for ${b.name}`}
                          >
                            {isLoading ? (
                              <svg
                                className="h-3 w-3 animate-spin"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="none"
                                  className="opacity-25"
                                ></circle>
                                <path
                                  fill="currentColor"
                                  className="opacity-75"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                            ) : null}
                            <span>{b.status ?? "UNKNOWN"}</span>
                          </button>
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                          {b.createdAt
                            ? new Date(b.createdAt).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={isLoading}
                              onClick={() => openEditModal(b)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40"
                              aria-label={`Edit ${b.name}`}
                            >
                              <MdModeEdit />
                            </button>

                            <button
                              disabled={isLoading}
                              onClick={() => handleDelete(b)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                              aria-label={`Delete ${b.name}`}
                            >
                              {isLoading ? (
                                <svg
                                  className="h-4 w-4 animate-spin"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    className="opacity-25"
                                    fill="none"
                                  ></circle>
                                  <path
                                    fill="currentColor"
                                    className="opacity-75"
                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                  />
                                </svg>
                              ) : (
                                <MdDelete />
                              )}
                            </button>

                            <button
                              onClick={() => openAdminsFor(b)}
                              disabled={isLoading}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                              aria-label={`More actions for ${b.name}`}
                              title="More actions"
                            >
                              <span className="text-xl leading-none select-none">
                                ⋮
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                Showing{" "}
                <span className="font-medium">
                  {(currentPage - 1) * pageSize + 1}
                </span>{" "}
                -{" "}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, total)}
                </span>{" "}
                of <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => gotoPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-md disabled:opacity-40"
                >
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }).map(
                    (_, i) => {
                      const half = Math.floor(5 / 2);
                      let start = 1;
                      if (totalPages <= 5) start = 1;
                      else if (currentPage <= half + 1) start = 1;
                      else if (currentPage >= totalPages - half)
                        start = totalPages - 4;
                      else start = currentPage - half;

                      const page = start + i;
                      if (page > totalPages) return null;
                      return (
                        <button
                          key={page}
                          onClick={() => gotoPage(page)}
                          className={`px-3 py-1 rounded-md ${
                            page === currentPage
                              ? "bg-blue-600 text-white"
                              : "border"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    }
                  )}
                </div>

                <button
                  onClick={() => gotoPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-md disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Lender Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Lender</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              <label className="block">
                <span className="text-sm text-gray-700">
                  Organization Name
                </span>
                <input
                  value={form.organizationName}
                  onChange={(e) =>
                    setForm({ ...form, organizationName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">
                  Organization Email
                </span>
                <input
                  value={form.organizationEmail}
                  onChange={(e) =>
                    setForm({ ...form, organizationEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">
                  Organization Phone
                </span>
                <input
                  value={form.organizationPhone}
                  onChange={(e) =>
                    setForm({ ...form, organizationPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">Admin First Name</span>
                <input
                  value={form.adminFirstName}
                  onChange={(e) =>
                    setForm({ ...form, adminFirstName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">Admin Last Name</span>
                <input
                  value={form.adminLastName}
                  onChange={(e) =>
                    setForm({ ...form, adminLastName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">Admin Email</span>
                <input
                  value={form.adminEmail}
                  onChange={(e) =>
                    setForm({ ...form, adminEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">Admin Password</span>
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) =>
                    setForm({ ...form, adminPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              {formError && (
                <div className="text-sm text-red-600 col-span-2">
                  {formError}
                </div>
              )}

              <div className="col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {submitting ? "Creating..." : "Create Lender"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lender Modal (reusing EditBrokerModal for now) */}
      {editingLender && (
        <EditBrokerModal
          isOpen={Boolean(editingLender)}
          broker={editingLender as any}
          onClose={() => setEditingLender(null)}
          onSave={handleEditSave as any}
        />
      )}

      {/* Admins Modal (with inline edit) */}
      {showAdminsFor && (
        <div className="fixed inset-0 z-600000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Admins for {showAdminsFor.name}
              </h2>
              <button
                onClick={closeAdmins}
                className="text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>

            <div>
              {loadingAdmins ? (
                <div className="py-8 text-center text-gray-500">
                  Loading admins...
                </div>
              ) : adminsError ? (
                <div className="py-8 text-center text-red-600">
                  {adminsError}
                </div>
              ) : admins.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No admins found for this lender.
                </div>
              ) : (
                <div className="space-y-2">
                  {admins.map((a, idx) => (
                    <div
                      key={a.id ?? idx}
                      className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div className="flex-1">
                        {editingAdminId === a.id ? (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              value={adminEditForm.firstName || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  firstName: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded"
                              placeholder="First name"
                            />
                            <input
                              value={adminEditForm.lastName || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  lastName: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded"
                              placeholder="Last name"
                            />
                            <input
                              value={adminEditForm.email || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  email: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded col-span-1 md:col-span-1"
                              placeholder="Email"
                            />
                            <input
                              value={adminEditForm.phone || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  phone: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded"
                              placeholder="Phone"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-gray-900">
                              {(a.firstName || "") +
                                (a.lastName ? ` ${a.lastName}` : "") ||
                                "—"}
                            </div>
                            <div className="text-sm text-gray-600">
                              {a.email || "-"}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-600">
                          {a.phone || "-"}
                        </div>

                        {editingAdminId === a.id ? (
                          <>
                            <button
                              onClick={saveAdminEdit}
                              disabled={adminSaving}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md"
                            >
                              {adminSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditAdmin}
                              disabled={adminSaving}
                              className="px-3 py-1 border rounded-md"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditAdmin(a)}
                              className="px-2 py-1 border rounded-md text-sm"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={closeAdmins}
                className="px-4 py-2 bg-gray-100 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
