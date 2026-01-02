import React, { useEffect, useState } from "react";

export type Broker = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt?: string;
};

type Props = {
  isOpen: boolean;
  broker: Broker | null;
  onClose: () => void;
  onSave: (updated: Broker) => void;
};

export default function EditBrokerModal({ isOpen, broker, onClose, onSave }: Props) {
  const [form, setForm] = useState<{ name: string; email: string; phone: string }>({
    name: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (broker) {
      setForm({ name: broker.name || "", email: broker.email || "", phone: broker.phone || "" });
      setError(null);
    }
  }, [broker]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setSaving(true);
    try {
      // NOTE: This component only returns the edited broker object.
      // Perform API update in the parent if you want server-side persistence.
      const updated: Broker = {
        id: broker!.id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        createdAt: broker!.createdAt,
      };

      // small artificial delay for UX (optional)
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
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Broker</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Close</button>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-3">
          <label className="block">
            <span className="text-sm text-gray-700">Organization / Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 mt-1 border rounded-md"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Email</span>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 mt-1 border rounded-md"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Phone</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 mt-1 border rounded-md"
            />
          </label>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
