import { useEffect, useState } from "react";

/* ================= TYPES ================= */

type Broker = {
  id: string;
  name: string;
  email?: string;
};

type Lender = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  brokerOrgId?: string | null;
};

type EditLenderProps = {
  isOpen: boolean;
  lender: Lender | null;
  brokers: Broker[];
  onClose: () => void;
  onSave: (payload: {
    id: string;
    name: string;
    email: string;
    phone: string;
    brokerOrgId: string | null;
  }) => void | Promise<void>;
};

/* ================= COMPONENT ================= */

export default function EditLender({
  isOpen,
  lender,
  brokers,
  onClose,
  onSave,
}: EditLenderProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    brokerOrgId: "",
  });

  useEffect(() => {
    if (lender) {
      setForm({
        name: lender.name || "",
        email: lender.email || "",
        phone: lender.phone || "",
        brokerOrgId: lender.brokerOrgId || "",
      });
    }
  }, [lender]);

  if (!isOpen || !lender) return null;

  return (
    <div className="fixed inset-0 z-[600000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-lg shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Lender
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Organization Name
            </span>
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Organization Email
            </span>
            <input
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Organization Phone
            </span>
            <input
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            />
          </label>

          {/* Broker reassignment */}
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Assign Broker
            </span>
            <select
              value={form.brokerOrgId}
              onChange={(e) =>
                setForm({ ...form, brokerOrgId: e.target.value })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            >
              <option value="">No broker (unassigned)</option>
              {brokers.map((b: Broker) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.email ? ` (${b.email})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md
                       border border-gray-300 text-gray-700
                       hover:bg-gray-100
                       dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            onClick={() =>
              onSave({
                id: lender.id,
                name: form.name,
                email: form.email,
                phone: form.phone,
                brokerOrgId: form.brokerOrgId || null,
              })
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
