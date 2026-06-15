import React, { useEffect, useState } from "react";
import { Building2, Pencil, X } from "lucide-react";

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

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition-colors focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export default function EditBrokerModal({ isOpen, broker, onClose, onSave }: Props) {
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
        "Organization name, email, phone, and admin name/email are required.",
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
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400 opacity-80" />

        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A]">
              <Pencil size={13} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Edit Broker</h2>
              <p className="text-[10px] text-slate-500">Organization and primary admin details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="overflow-y-auto px-4 py-3 space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Building2 size={12} className="text-[#13538A]" />
              Organization
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Name" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  autoFocus
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" required>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`${inputClass} sm:col-span-2`}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Primary admin
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="First name" required>
                <input
                  value={form.adminFirstName}
                  onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Last name" required>
                <input
                  value={form.adminLastName}
                  onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Password (optional)">
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  className={inputClass}
                  placeholder="Keep blank to retain"
                />
              </Field>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#13538A] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0f426d] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
