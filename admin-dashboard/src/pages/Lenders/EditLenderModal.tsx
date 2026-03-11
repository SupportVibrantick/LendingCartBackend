import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import EditLenderAssignProduct from "./EditLenderAssignProduct";

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

  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
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

    adminFirstName?: string;
    adminLastName?: string;
    adminEmail?: string;
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

    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
  });

  const [activeTab, setActiveTab] = useState<"details" | "products">("details");

  useEffect(() => {
    if (lender) {
      setForm({
        name: lender.name || "",
        email: lender.email || "",
        phone: lender.phone || "",
        brokerOrgId: lender.brokerOrgId || "",

        adminFirstName: lender.adminFirstName || "",
        adminLastName: lender.adminLastName || "",
        adminEmail: lender.adminEmail || "",
      });
    }
  }, [lender]);

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!lender) return;

    await onSave({
      id: lender.id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      brokerOrgId: form.brokerOrgId || null,

      adminFirstName: form.adminFirstName,
      adminLastName: form.adminLastName,
      adminEmail: form.adminEmail,
    });
  }

  if (!isOpen || !lender) return null;

  return (
    <div className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl p-6 w-full max-w-4xl shadow-lg 
dark:bg-slate-900 dark:border dark:border-slate-700
max-h-[90vh] overflow-y-auto"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Lender
          </h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-500"
          >
            Close
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-3 mb-6 border-b dark:border-slate-700 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 rounded-md text-sm font-medium
            ${
              activeTab === "details"
                ? "bg-[#13538A] text-white"
                : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            Lender Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-md text-sm font-medium
            ${
              activeTab === "products"
                ? "bg-[#13538A] text-white"
                : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            Assign Products
          </button>
        </div>

        {/* ================= LENDER DETAILS TAB ================= */}

        {activeTab === "details" && (
          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Organization Name
                </span>

                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 mt-1 border rounded-md
                  bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                />
              </label>

              <label>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Organization Email
                </span>

                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 mt-1 border rounded-md
                  bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                />
              </label>

              <label>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Organization Phone
                </span>

                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 mt-1 border rounded-md
                  bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                />
              </label>
            </div>

            {/* BROKER */}
            <label>
              <span className="text-sm text-gray-700 dark:text-slate-200">
                Assign Broker
              </span>

              <select
                value={form.brokerOrgId}
                onChange={(e) =>
                  setForm({ ...form, brokerOrgId: e.target.value })
                }
                className="w-full px-3 py-2 mt-1 border rounded-md
                bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
              >
                <option value="">No broker</option>

                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <label>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Admin First Name
                </span>

                <input
                  value={form.adminFirstName}
                  onChange={(e) =>
                    setForm({ ...form, adminFirstName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                />
              </label>

              <label>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Admin Last Name
                </span>

                <input
                  value={form.adminLastName}
                  onChange={(e) =>
                    setForm({ ...form, adminLastName: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                />
              </label>

              <label>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Admin Email
                </span>

                <input
                  value={form.adminEmail}
                  onChange={(e) =>
                    setForm({ ...form, adminEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-[#13538A] text-white rounded-md"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* ================= ASSIGN PRODUCTS TAB ================= */}

        {activeTab === "products" && (
          <div className="mt-2">
            <EditLenderAssignProduct
              lenderId={lender.id}
              onSuccess={() => {
                toast.success("Lender products updated successfully");
              }}
             onClose={onClose}
            />
          </div>
        )}
      </div>
    </div>
  );
}
