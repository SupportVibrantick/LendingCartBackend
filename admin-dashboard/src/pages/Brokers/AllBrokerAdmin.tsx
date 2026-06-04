import React, { useEffect, useState, useCallback } from "react";
import { Toaster, toast } from "react-hot-toast";
import { MdModeEdit, MdDelete } from "react-icons/md";

type BrokerOrg = {
  id: string;
  name: string;
};

type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const API = {
  BROKERS: `${API_BASE}/admin/brokers/read`,
  BROKER_BY_ID: `${API_BASE}/admin/brokers/read/`, 
  UPDATE_ADMIN: `${API_BASE}/admin/brokers/admin/update/`,
  DELETE_ADMIN: `${API_BASE}/admin/brokers/admin/delete/`,
};

const AllBrokersAdmin: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerOrg[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Edit Admin
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // ---------------------------
  // Fetch Brokers
  // ---------------------------
  const fetchBrokers = useCallback(async () => {
    try {
      setFetchError(null);
      setLoadingBrokers(true);
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(API.BROKERS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!res.ok) throw new Error(`Failed to fetch brokers (${res.status})`);

      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];

      const mapped = list.map((o: any) => ({
        id: String(o.id),
        name: o.name || "",
      }));

      setBrokers(mapped);
    } catch (err: any) {
      const msg = err?.message || "Failed to fetch brokers";
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoadingBrokers(false);
    }
  }, []);

  useEffect(() => {
    fetchBrokers();
  }, [fetchBrokers]);

  // ---------------------------
  // Fetch Admins for Broker
  // ---------------------------
  const fetchAdmins = async (brokerId: string) => {
    try {
      setLoadingAdmins(true);
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(`${API.BROKER_BY_ID}${brokerId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!res.ok) throw new Error(`Failed to fetch admins (${res.status})`);

      const json = await res.json();
      const adminList = json?.data?.admins || [];

      const mapped: AdminUser[] = adminList.map((a: any) => ({
        id: String(a.id),
        firstName: a.firstName || "",
        lastName: a.lastName || "",
        email: a.email || "",
        phone: a.phone || "",
        createdAt: a.createdAt,
      }));

      setAdmins(mapped);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load admins");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleSelect = (value: string) => {
    setSelectedBroker(value);
    if (value) fetchAdmins(value);
    else setAdmins([]);
  };

  // ---------------------------
  // Delete Admin
  // ---------------------------
  const deleteAdmin = async (adminId: string) => {
    if (!window.confirm("Are you sure you want to delete this admin?")) return;

    try {
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(`${API.DELETE_ADMIN}${adminId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Admin deleted");
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  // ---------------------------
  // Save Edited Admin
  // ---------------------------
  const saveEdit = async () => {
    if (!editingAdmin) return;

    try {
      setSavingEdit(true);
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(`${API.UPDATE_ADMIN}${editingAdmin.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error("Update failed");

      toast.success("Admin updated");

      setAdmins((prev) =>
        prev.map((a) => (a.id === editingAdmin.id ? { ...a, ...editForm } : a)),
      );

      setEditingAdmin(null);
    } catch (err: any) {
      toast.error(err?.message || "Update failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditModal = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditForm({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone || "",
    });
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  return (
    <div className="px-6 py-6">
      <Toaster />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Broker Admins
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View, edit and manage admin users for each broker organization.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchBrokers}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Header / Controls */}
        <div className="border-b border-slate-200 px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:w-1/2">
            <label className="block text-xs font-semibold tracking-wide text-slate-500 uppercase mb-1">
              Select Broker
            </label>
            <select
              value={selectedBroker}
              onChange={(e) => handleSelect(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">
                {loadingBrokers ? "Loading brokers..." : "Choose a broker"}
              </option>
              {!loadingBrokers &&
                brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Showing admins for the selected broker organization.
            </p>
          </div>

          {selectedBroker && (
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
              <div className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1">
                <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500" />
                {admins.length} admin{admins.length !== 1 && "s"}
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="px-6 py-4">
          {!selectedBroker ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Select a broker to view its admin users.
            </div>
          ) : loadingAdmins ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading admins...
            </div>
          ) : admins.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No admins found for this broker.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Name
                    </th>
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email
                    </th>
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Phone
                    </th>
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Created
                    </th>
                    <th className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {admins.map((a) => (
                    <tr
                      key={a.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="font-medium text-slate-900">
                          {a.firstName} {a.lastName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ID: {a.id}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span
                          className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                          title={a.email}
                        >
                          {a.email}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle text-slate-700">
                        {a.phone || "-"}
                      </td>

                      <td className="px-4 py-3 align-middle text-slate-700">
                        {formatDate(a.createdAt)}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                            title="Edit admin"
                          >
                            <MdModeEdit size={16} />
                          </button>

                          <button
                            onClick={() => deleteAdmin(a.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-sm hover:bg-red-100"
                            title="Delete admin"
                          >
                            <MdDelete size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Edit Admin
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Update basic details for{" "}
              <span className="font-medium">
                {editingAdmin.firstName} {editingAdmin.lastName}
              </span>
              .
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  First name
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editForm.firstName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, firstName: e.target.value })
                  }
                  placeholder="First name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Last name
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editForm.lastName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lastName: e.target.value })
                  }
                  placeholder="Last name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Email
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  placeholder="Email"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Phone
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  placeholder="Phone"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingAdmin(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {savingEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllBrokersAdmin;
