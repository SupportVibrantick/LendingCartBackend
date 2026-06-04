import React, { useEffect, useState } from "react";

export type Broker = {
  id: string;
  name: string;
  email: string;
  phone: string;

  adminId?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminStatus?: string;

  status?: string;
  createdAt?: string;
};

type Props = {
  isOpen: boolean;
  broker: Broker | null;
  onClose: () => void;
  onSave: (updated: Broker) => void;
};

export default function EditBrokerModal({
  isOpen,
  broker,
  onClose,
  onSave,
}: Props) {
const [form, setForm] = useState({
  name: "",
  email: "",
  phone: "",

  adminId: "",
  adminStatus: "",

  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPassword: "",
});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (broker) {
setForm({
  name: broker.name || "",
  email: broker.email || "",
  phone: broker.phone || "",

  adminId: broker.adminId || "",
  adminStatus: broker.adminStatus || "",

  adminFirstName: broker.adminFirstName || "",
  adminLastName: broker.adminLastName || "",
  adminEmail: broker.adminEmail || "",
  adminPassword: "",
});

      setError(null);
    }
  }, [broker]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

if (
  !form.name.trim() ||
  !form.email.trim() ||
  !form.phone.trim() ||
  !form.adminFirstName.trim() ||
  !form.adminLastName.trim() ||
  !form.adminEmail.trim()
) {
  setError(
    "Organization Name, Organization Email, Organization Phone, Admin First Name, Admin Last Name and Admin Email are required."
  );
  return;
}

    setSaving(true);

    try {
const updated: Broker = {
  id: broker!.id,

  name: form.name.trim(),
  email: form.email.trim(),
  phone: form.phone.trim(),

  adminId: form.adminId,
  adminStatus: form.adminStatus,

  adminFirstName: form.adminFirstName.trim(),
  adminLastName: form.adminLastName.trim(),
  adminEmail: form.adminEmail.trim(),
  adminPassword: form.adminPassword.trim(),

  status: broker?.status,
  createdAt: broker!.createdAt,
};

      await new Promise((r) => setTimeout(r, 300));

      onSave(updated);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Broker</h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* ================= ORGANIZATION DETAILS ================= */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">
              Organization Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-gray-700">
                   Organization Name <span className="text-red-500">*</span>
                </span>

                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">
                  Organization Email <span className="text-red-500">*</span>
                </span>

                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">
                  Organization Phone <span className="text-red-500">*</span>
                </span>

                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>
            </div>
          </div>

          {/* ================= ADMIN DETAILS ================= */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              Admin Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-gray-700">
                  Admin First Name <span className="text-red-500">*</span>
                </span>

                <input
                  value={form.adminFirstName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adminFirstName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">
                  Admin Last Name <span className="text-red-500">*</span>
                </span>

                <input
                  value={form.adminLastName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adminLastName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">
                  Admin Email <span className="text-red-500">*</span>
                </span>

                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adminEmail: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">
                  Admin Password (Optional)
                </span>

                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adminPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md"
                  placeholder="Leave blank to keep existing password"
                />
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}