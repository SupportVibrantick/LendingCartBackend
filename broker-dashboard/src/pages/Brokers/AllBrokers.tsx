import React, { useEffect, useMemo, useState } from "react";
import { MdModeEdit } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import EditBrokerModal from "./EditBrokerModal"; // adjust path if needed

type Broker = {
  id: string;
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

function statusClass(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    case "SUSPENDED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

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

  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Admins modal & editing state
  const [showAdminsFor, setShowAdminsFor] = useState<Broker | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  // Admin inline-edit state
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [adminEditForm, setAdminEditForm] = useState<Admin>({});
  const [adminSaving, setAdminSaving] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

  useEffect(() => {
    fetchBrokers();
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
    } catch (e) {
      // ignore
    }
    return { "Content-Type": "application/json" };
  }

  async function fetchBrokers() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/brokers/read/`, {
        method: "GET",
        headers,
      });

      if (!res.ok) throw new Error(`Failed to fetch brokers: ${res.status}`);

      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];

      const normalized: Broker[] = list.map((o: any) => ({
        id: String(o.id),
        name: o.name ?? "",
        email: o.email ?? "",
        phone: o.phone ?? "",
        status: o.status ?? "UNKNOWN",
        createdAt: o.createdAt ?? null,
      }));

      setBrokers(normalized);
    } catch (err: any) {
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
        "Please fill required fields: organization name, organization email, admin email and password.",
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

      const res = await fetch(`${API_BASE}/admin/brokers/create`, {
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
      await fetchBrokers();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brokers;
    return brokers.filter((b) => {
      return (
        (b.name || "").toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.status || "").toLowerCase().includes(q)
      );
    });
  }, [brokers, query]);

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

  const openEditModal = (b: Broker) => {
    setEditingBroker(b);
  };

  const handleEditSave = async (updated: Broker) => {
    // optimistic
    setBrokers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingBroker(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(
        `${API_BASE}/admin/brokers/update/${updated.id}`,
        {
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
        },
      );

      const json = await res.json().catch(() => ({}) as any);

      if (res.ok && json?.data?.organization) {
        const org = json.data.organization;
        setBrokers((prev) =>
          prev.map((b) =>
            b.id === updated.id
              ? {
                  ...b,
                  name: org.name ?? b.name,
                  email: org.email ?? b.email,
                  phone: org.phone ?? b.phone,
                  status: org.status ?? b.status,
                  createdAt: org.createdAt ?? b.createdAt,
                }
              : b,
          ),
        );
      } else if (!res.ok) {
        console.error("Broker update error:", json);
      }
    } catch (err) {
      console.error("Failed to persist broker update:", err);
    }
  };

  const changeStatusFor = async (broker: Broker) => {
    if (!broker?.id) return;

    const cur = (broker.status || "INACTIVE").toUpperCase();
    const next = cur === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const prevStatus = broker.status;

    // optimistic update in UI
    setBrokers((prev) =>
      prev.map((b) => (b.id === broker.id ? { ...b, status: next } : b)),
    );
    setRowLoadingId(broker.id);

    const token = sessionStorage.getItem("admin_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const toActive = next === "ACTIVE";
      const statusUrl = `${API_BASE}/admin/brokers/status/${
        toActive ? "activate" : "deactivate"
      }/${broker.id}`;

      let res = await fetch(statusUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({}),
      });

      if (res.status === 404 || res.status === 405) {
        const updateUrl = `${API_BASE}/admin/brokers/update/${broker.id}`;
        res = await fetch(updateUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: next }),
        });
      }

      if (!res.ok) {
        throw new Error(`Status update failed: ${res.status}`);
      }

      const json = await res.json().catch(() => ({}) as any);

      if (json?.data) {
        if (json.data.status) {
          const serverStatus = json.data.status;
          setBrokers((prev) =>
            prev.map((b) =>
              b.id === broker.id ? { ...b, status: serverStatus } : b,
            ),
          );
        } else if (json.data.organization?.status) {
          const orgStatus = json.data.organization.status;
          setBrokers((prev) =>
            prev.map((b) =>
              b.id === broker.id ? { ...b, status: orgStatus } : b,
            ),
          );
        }
      }
    } catch (err) {
      console.error("changeStatusFor error:", err);
      setBrokers((prev) =>
        prev.map((b) =>
          b.id === broker.id ? { ...b, status: prevStatus } : b,
        ),
      );
      alert("Failed to update status. Please try again.");
    } finally {
      setRowLoadingId(null);
    }
  };

  async function fetchAdmins(brokerId: string) {
    setLoadingAdmins(true);
    setAdmins([]);
    setAdminsError(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(`${API_BASE}/admin/brokers/read/${brokerId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error(`Failed to load admins: ${res.status}`);

      const json = await res.json().catch(() => ({}) as any);

      const adminList = json?.data?.admins || [];
      const normalized: Admin[] = (
        Array.isArray(adminList) ? adminList : []
      ).map((a: any) => ({
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

  const openAdminsFor = async (broker: Broker) => {
    setShowAdminsFor(broker);
    setEditingAdminId(null);
    setAdminEditForm({});
    await fetchAdmins(broker.id);
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
    if (!showAdminsFor?.id)
      return alert("No broker selected for this admin edit.");

    if (
      !(
        adminEditForm.firstName ||
        adminEditForm.lastName ||
        adminEditForm.email
      )
    ) {
      return alert(
        "Please provide at least one field to update (first name / last name / email).",
      );
    }

    setAdminSaving(true);

    setAdmins((prev) =>
      prev.map((p) => (p.id === adminId ? { ...p, ...adminEditForm } : p)),
    );

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(
        `${API_BASE}/admin/brokers/update/${showAdminsFor.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            admin: {
              id: adminId,
              firstName: adminEditForm.firstName,
              lastName: adminEditForm.lastName,
              email: adminEditForm.email,
            },
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      const json = await res.json().catch(() => ({}) as any);
      if (json && json.data && json.data.admin) {
        const serverAdmin = json.data.admin;
        setAdmins((prev) =>
          prev.map((p) => (p.id === adminId ? { ...p, ...serverAdmin } : p)),
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
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 text-gray-900 dark:text-gray-100">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            All Brokers
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage broker organizations and their admins.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-1 sm:flex-none items-center gap-2">
            <input
              placeholder="Search by name, email, phone or status"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md text-sm sm:text-base
                         focus:outline-none focus:ring-1 focus:ring-blue-500
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-slate-400"
              aria-label="Search brokers"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-2 border rounded-md bg-white text-gray-900 text-sm
                         border-gray-300
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              aria-label="Page size"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
            </select>
          </div>

          <button
            onClick={openAdd}
            className="inline-flex items-center justify-center sm:justify-start whitespace-nowrap px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base"
            type="button"
            aria-label="Add Broker"
          >
            <TiPlus className="mr-2" />
            Add Broker
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 dark:bg-slate-900 dark:border-slate-700">
        {loading ? (
          <div className="py-12 sm:py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading brokers...
          </div>
        ) : total === 0 ? (
          <div className="py-12 sm:py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            No brokers found.
          </div>
        ) : (
          <>
            <div className="-mx-4 sm:mx-0 overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="py-2 pl-4 pr-4 text-left sm:pl-0">
                      Organization
                    </th>
                    <th className="py-2 pr-4 text-left hidden sm:table-cell">
                      Email
                    </th>
                    <th className="py-2 pr-4 text-left hidden md:table-cell">
                      Phone
                    </th>
                    <th className="py-2 pr-4 text-left hidden md:table-cell">
                      Status
                    </th>
                    <th className="py-2 pr-4 text-left hidden lg:table-cell">
                      Created
                    </th>
                    <th className="py-2 pr-4 text-right w-24 sm:w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => {
                    const isLoading = rowLoadingId === b.id;
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40
                                   dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        {/* Organization + mobile details */}
                        <td className="py-3 pl-4 pr-4 text-gray-900 whitespace-nowrap align-top sm:pl-0 dark:text-gray-100">
                          <button
                            onClick={() => openAdminsFor(b)}
                            className="text-left underline text-blue-600 hover:text-blue-800
                                       dark:text-blue-300 dark:hover:text-blue-200 break-words"
                            aria-label={`View admins for ${b.name}`}
                          >
                            {b.name}
                          </button>

                          {/* Extra info for small screens (stacked) */}
                          <div className="mt-1 space-y-0.5 text-[11px] text-gray-500 sm:hidden dark:text-slate-300">
                            <div>
                              <span className="font-medium">Email:</span>{" "}
                              {b.email || "-"}
                            </div>
                            <div>
                              <span className="font-medium">Phone:</span>{" "}
                              {b.phone || "-"}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Status:</span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${statusClass(
                                  b.status,
                                )}`}
                              >
                                {b.status ?? "UNKNOWN"}
                              </span>
                            </div>
                            {b.createdAt && (
                              <div>
                                <span className="font-medium">Created:</span>{" "}
                                {new Date(b.createdAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Desktop / tablet columns */}
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap hidden sm:table-cell dark:text-slate-300">
                          {b.email}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap hidden md:table-cell dark:text-slate-300">
                          {b.phone}
                        </td>

                        <td className="py-3 pr-4 whitespace-nowrap hidden md:table-cell">
                          <button
                            onClick={() => !isLoading && changeStatusFor(b)}
                            disabled={isLoading}
                            className={`inline-flex items-center gap-2 px-3 py-1 text-[11px] font-medium rounded-full border ${statusClass(
                              b.status,
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

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap hidden lg:table-cell dark:text-slate-300">
                          {b.createdAt
                            ? new Date(b.createdAt).toLocaleDateString()
                            : "-"}
                        </td>

                        {/* Actions */}
                        <td className="py-3 pr-4 align-top">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <button
                              disabled={isLoading}
                              onClick={() => openEditModal(b)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40
                                         dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                              aria-label={`Edit ${b.name}`}
                            >
                              <MdModeEdit />
                            </button>

                            <button
                              onClick={() => openAdminsFor(b)}
                              disabled={isLoading}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40
                                         dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              aria-label={`More actions for ${b.name}`}
                              title="More actions"
                            >
                              <span className="text-lg leading-none select-none sm:text-xl">
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

            {/* Pagination */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="text-gray-600 dark:text-slate-300">
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
                  className="px-3 py-1 border rounded-md disabled:opacity-40 text-xs sm:text-sm
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                          className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm ${
                            page === currentPage
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    },
                  )}
                </div>

                <button
                  onClick={() => gotoPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-md disabled:opacity-40 text-xs sm:text-sm
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Broker Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Create Broker
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 text-sm sm:text-base"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Organization Name
                </span>
                <input
                  value={form.organizationName}
                  onChange={(e) =>
                    setForm({ ...form, organizationName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md text-sm
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Organization Email
                </span>
                <input
                  value={form.organizationEmail}
                  onChange={(e) =>
                    setForm({ ...form, organizationEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md text-sm
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Organization Phone
                </span>
                <input
                  value={form.organizationPhone}
                  onChange={(e) =>
                    setForm({ ...form, organizationPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md text-sm
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Admin First Name
                </span>
                <input
                  value={form.adminFirstName}
                  onChange={(e) =>
                    setForm({ ...form, adminFirstName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md text-sm
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Admin Last Name
                </span>
                <input
                  value={form.adminLastName}
                  onChange={(e) =>
                    setForm({ ...form, adminLastName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md text-sm
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Admin Email
                </span>
                <input
                  value={form.adminEmail}
                  onChange={(e) =>
                    setForm({ ...form, adminEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md text-sm
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Admin Password
                </span>
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) =>
                    setForm({ ...form, adminPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md text-sm
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              {formError && (
                <div className="text-sm text-red-600 col-span-1 md:col-span-2">
                  {formError}
                </div>
              )}

              <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md
                             dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-70"
                >
                  {submitting ? "Creating..." : "Create Broker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Broker Modal */}
      {editingBroker && (
        <EditBrokerModal
          isOpen={Boolean(editingBroker)}
          broker={editingBroker}
          onClose={() => setEditingBroker(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Admins Modal */}
      {showAdminsFor && (
        <div className="fixed inset-0 z-[600000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Admins for {showAdminsFor.name}
              </h2>
              <button
                onClick={closeAdmins}
                className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 text-sm sm:text-base"
              >
                Close
              </button>
            </div>

            <div>
              {loadingAdmins ? (
                <div className="py-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                  Loading admins...
                </div>
              ) : adminsError ? (
                <div className="py-8 text-center text-red-600 dark:text-red-400 text-sm">
                  {adminsError}
                </div>
              ) : admins.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                  No admins found for this broker.
                </div>
              ) : (
                <div className="space-y-2">
                  {admins.map((a, idx) => (
                    <div
                      key={a.id ?? idx}
                      className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3
                                 border-gray-200 bg-white
                                 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {/* left: details / edit fields */}
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
                              className="px-2 py-1 border rounded text-sm
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
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
                              className="px-2 py-1 border rounded text-sm
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
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
                              className="px-2 py-1 border rounded text-sm col-span-1 md:col-span-1
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
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
                              className="px-2 py-1 border rounded text-sm
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                              placeholder="Phone"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {(a.firstName || "") +
                                (a.lastName ? ` ${a.lastName}` : "") || "—"}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300">
                              {a.email || "-"}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* right: phone + actions */}
                      <div className="flex items-center gap-2 justify-between md:justify-end">
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300">
                          {a.phone || "-"}
                        </div>

                        {editingAdminId === a.id ? (
                          <>
                            <button
                              onClick={saveAdminEdit}
                              disabled={adminSaving}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md disabled:opacity-70 text-xs sm:text-sm"
                            >
                              {adminSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditAdmin}
                              disabled={adminSaving}
                              className="px-3 py-1 border rounded-md text-xs sm:text-sm
                                         border-gray-300 bg-white text-gray-800
                                         dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEditAdmin(a)}
                            className="px-2 py-1 border rounded-md text-xs sm:text-sm
                                       border-gray-300 bg-white text-gray-800
                                       dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            Edit
                          </button>
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
                className="px-4 py-2 bg-gray-100 rounded-md text-sm
                           dark:bg-slate-800 dark:text-slate-100"
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
