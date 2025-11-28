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

const API_BASE = import.meta.env.VITE_API_BASE || "";

const API = {
  BROKERS: `${API_BASE}/admin/brokers/read`,
  BROKER_BY_ID: `${API_BASE}/admin/brokers/read/`,
  UPDATE_ADMIN: `${API_BASE}/admin/brokers/admin/update/`, // PATCH /:adminId
  DELETE_ADMIN: `${API_BASE}/admin/brokers/admin/delete/`, // DELETE /:adminId
};

const AllBrokersAdmin: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerOrg[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<string>("");

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [fetchError, setFetchError] = useState<string | null>(null);

  // EDIT MODAL STATE
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
      setLoadingBrokers(true);
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(API.BROKERS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      const list = json.data || [];

      const mapped = list.map((o: any) => ({
        id: o.id,
        name: o.name,
      }));

      setBrokers(mapped);
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch brokers");
    } finally {
      setLoadingBrokers(false);
    }
  }, []);

  useEffect(() => {
    fetchBrokers();
  }, [fetchBrokers]);

  // ---------------------------
  // Fetch admins of a broker
  // ---------------------------
  const fetchAdmins = async (id: string) => {
    try {
      setLoadingAdmins(true);
      setAdmins([]);

      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(`${API.BROKER_BY_ID}${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      const adminList = json.data?.admins || [];

      const mapped = adminList.map((a: any) => ({
        ...a,
        firstName: a.firstName || "",
        lastName: a.lastName || "",
      }));

      setAdmins(mapped);
    } catch {
      toast.error("Failed to load admins");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleSelect = (value: string) => {
    setSelectedBroker(value);
    fetchAdmins(value);
  };

  // ---------------------------
  // Delete admin
  // ---------------------------
  const deleteAdmin = async (adminId: string) => {
    if (!window.confirm("Are you sure you want to delete this admin?")) return;

    try {
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(`${API.DELETE_ADMIN}${adminId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error("Failed to delete admin");

      toast.success("Admin deleted");
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    } catch {
      toast.error("Delete failed");
    }
  };

  // ---------------------------
  // Edit Admin - Save
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error("Failed to update admin");

      toast.success("Admin updated successfully");

      // Update UI
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === editingAdmin.id ? { ...a, ...editForm } : a
        )
      );

      setEditingAdmin(null);
    } catch {
      toast.error("Update failed");
    } finally {
      setSavingEdit(false);
    }
  };

  // ---------------------------
  // Open edit modal
  // ---------------------------
  const openEditModal = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditForm({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone || "",
    });
  };

  return (
    <div className="px-6 py-6">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Broker Admins</h1>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border p-6 max-w-4xl space-y-6">

        {/* Dropdown */}
        <div>
          <label className="text-sm font-medium text-gray-700">Broker</label>
          <select
            value={selectedBroker}
            onChange={(e) => handleSelect(e.target.value)}
            className="block w-full border px-3 py-2 rounded-lg"
          >
            <option value="">Select Broker</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Admin Table */}
        {selectedBroker && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Admins</h2>

            {loadingAdmins ? (
              <div className="text-center py-10">Loading...</div>
            ) : admins.length === 0 ? (
              <div className="text-center py-10">No admins found.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-gray-500">
                    <th className="py-2 text-left">Name</th>
                    <th className="py-2 text-left">Email</th>
                    <th className="py-2 text-left">Phone</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="py-3">
                        {a.firstName} {a.lastName}
                      </td>
                      <td>{a.email}</td>
                      <td>{a.phone || "-"}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(a)}
                            className="h-8 w-8 flex justify-center items-center rounded-full border"
                          >
                            <MdModeEdit />
                          </button>

                          <button
                            onClick={() => deleteAdmin(a.id)}
                            className="h-8 w-8 flex justify-center items-center rounded-full border border-red-300 text-red-600"
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* EDIT ADMIN MODAL */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-5000000 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">

            <h2 className="text-lg font-semibold mb-4">Edit Admin</h2>

            <div className="space-y-3">
              <input
                value={editForm.firstName}
                onChange={(e) =>
                  setEditForm({ ...editForm, firstName: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
                placeholder="First Name"
              />

              <input
                value={editForm.lastName}
                onChange={(e) =>
                  setEditForm({ ...editForm, lastName: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
                placeholder="Last Name"
              />

              <input
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
                placeholder="Email"
              />

              <input
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
                placeholder="Phone"
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setEditingAdmin(null)}
                className="px-4 py-2 bg-gray-100 rounded"
              >
                Cancel
              </button>

              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AllBrokersAdmin;
