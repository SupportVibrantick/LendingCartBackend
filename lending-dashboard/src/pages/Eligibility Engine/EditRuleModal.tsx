import { useEffect, useState } from "react";

type Rule = {
  id: string;
  ruleSetId: string;
  fieldName: string;
  comparisonOperator: string;
  value: string;
  severity: string;
  message: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  isOpen: boolean;
  rule: Rule | null;
  onClose: () => void;
  onSave: (updated: Rule) => Promise<void> | void;
};

const comparisonOperators = ["GT", "GTE", "LT", "LTE", "EQ", "NEQ", "IN", "NOT_IN"];
const severities = ["HARD_FAIL", "SOFT_FAIL"];

export default function EditRuleModal({
  isOpen,
  rule,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rule) {
      setForm({ ...rule });
      setError(null);
    }
  }, [rule]);

  if (!isOpen || !form) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fieldName || !form.comparisonOperator || !form.severity) {
      setError("Please fill all required fields");
      return;
    }

    setSaving(true);
    try {
      onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm ">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-lg dark:border dark:border-slate-700">
        <h2 className="text-lg font-semibold mb-4">Edit Rule</h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Field Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Field Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.fieldName}
              onChange={(e) =>
                setForm(f => f && ({ ...f, fieldName: e.target.value }))
              }
              placeholder="Enter field name"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Comparison Operator */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Comparison Operator <span className="text-red-500">*</span>
            </label>
            <select
              value={form.comparisonOperator}
              onChange={(e) =>
                setForm(f => f && ({ ...f, comparisonOperator: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-gray-900 dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            >
              <option value="">Select Operator</option>
              {comparisonOperators.map(op => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.value}
              min={0}
              onChange={(e) =>
                setForm(f => f && ({ ...f, value: e.target.value }))
              }
              placeholder="Enter value"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Severity <span className="text-red-500">*</span>
            </label>
            <select
              value={form.severity}
              onChange={(e) =>
                setForm(f => f && ({ ...f, severity: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-gray-900 dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            >
              <option value="">Select Severity</option>
              {severities.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Message
            </label>
            <textarea
              value={form.message}
              onChange={(e) =>
                setForm(f => f && ({ ...f, message: e.target.value }))
              }
              placeholder="Enter validation message"
              className="w-full border rounded px-3 py-2"
              rows={3}
            />
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Sort Order <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) =>
                setForm(f => f && ({ ...f, sortOrder: Number(e.target.value) }))
              }
              placeholder="Enter sort order"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
