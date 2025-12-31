import React, { useEffect, useState } from "react";

export type RuleSet = {
  id: string;
  name: string;
  description?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
  createdAt: string;
  lenderProductId: string;
};

type RuleForm = {
  name: string;
  description: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

type Props = {
  isOpen: boolean;
  ruleSet: RuleSet | null;
  onClose: () => void;
  onSave: (updated: RuleSet) => void;
};


export default function EditBrokerModal({
  isOpen,
  ruleSet,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<RuleForm>({
    name: "",
    description: "",
    effectiveFrom: null,
    effectiveTo: null,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toDateInputValue(value?: string | null) {
    if (!value) return "";
    return value.split("T")[0]; // YYYY-MM-DD
  }

  useEffect(() => {
    if (ruleSet) {
      setForm({
        name: ruleSet.name ?? "",
        description: ruleSet.description ?? "",
        effectiveFrom: toDateInputValue(ruleSet.effectiveFrom),
        effectiveTo: toDateInputValue(ruleSet.effectiveTo),
      });
      setError(null);
    }
  }, [ruleSet]);

  if (!isOpen || !ruleSet) return null;

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const updated: RuleSet = {
        ...ruleSet,
        name: form.name.trim(),
        description: form.description.trim(),
        effectiveFrom: form.effectiveFrom
          ? new Date(form.effectiveFrom).toISOString()
          : null,
        effectiveTo: form.effectiveTo
          ? new Date(form.effectiveTo).toISOString()
          : null,
      };

      await new Promise((r) => setTimeout(r, 300)); // optional UX delay
      onSave(updated);
    } catch (err: any) {
      console.error(err);
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Rule Set
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-slate-300"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-3">
          {/* Name */}
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Name
            </span>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full rounded-lg border px-3 py-2 text-sm
                border-gray-300 bg-white text-gray-900
                focus:ring-2 focus:ring-blue-500
                dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              autoFocus
            />
          </label>

          {/* Description */}
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Description
            </span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="w-full rounded-lg border px-3 py-2 text-sm
                border-gray-300 bg-white text-gray-900
                focus:ring-2 focus:ring-blue-500
                dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            />
          </label>

          {/* Effective From */}
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Effective From
            </span>
            <input
              type="date"
              value={form.effectiveFrom ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  effectiveFrom: e.target.value || null,
                }))
              }
              className="w-full rounded-lg border px-3 py-2 text-sm
                border-gray-300 bg-white text-gray-900
                focus:ring-2 focus:ring-blue-500
                dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            />
          </label>

          {/* Effective To */}
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Effective To
            </span>
            <input
              type="date"
              min={form.effectiveFrom || undefined}
              value={form.effectiveTo ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  effectiveTo: e.target.value || null,
                }))
              }
              className="w-full rounded-lg border px-3 py-2 text-sm
                border-gray-300 bg-white text-gray-900
                focus:ring-2 focus:ring-blue-500
                dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
