import React, { useEffect, useState } from "react";

type LoanProduct = {
  id: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  regionsSupported: string[];
  industriesSupported: string[];
  isActive: boolean;
  createdAt: string;
};

type Props = {
  isOpen: boolean;
  loanProduct: LoanProduct | null;
  onClose: () => void;
  onSave: (updated: LoanProduct) => void;
};

export default function EditLoanProductModal({
  isOpen,
  loanProduct,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<LoanProduct>({
    id: "",
    minLoanAmount: 0,
    maxLoanAmount: 0,
    minTermMonths: 0,
    maxTermMonths: 0,
    regionsSupported: [],
    industriesSupported: [],
    isActive: true,
    createdAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeParseArray = (value: any): string[] => {
    if (Array.isArray(value)) return value;

    if (typeof value !== "string") return [];

    try {
      let parsed = JSON.parse(value);

      // handle double-stringified case
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (loanProduct) {
      setForm({
        id: loanProduct.id,
        minLoanAmount: loanProduct.minLoanAmount || 0,
        maxLoanAmount: loanProduct.maxLoanAmount || 0,
        minTermMonths: loanProduct.minTermMonths || 0,
        maxTermMonths: loanProduct.maxTermMonths || 0,
        regionsSupported: Array.isArray(loanProduct.regionsSupported)
          ? loanProduct.regionsSupported
          : safeParseArray(loanProduct.regionsSupported),
        industriesSupported: Array.isArray(loanProduct.industriesSupported)
          ? loanProduct.industriesSupported
          : safeParseArray(loanProduct.industriesSupported),
        isActive: true,
        createdAt: loanProduct.createdAt,
      });
      setError(null);
    }
  }, [loanProduct]);

  if (!isOpen) return null;

  function toggleChip(
    key: "regionsSupported" | "industriesSupported",
    value: string,
  ) {
    setForm((prev) => {
      const set = new Set(prev[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  }

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (
      !form.minLoanAmount ||
      !form.maxLoanAmount ||
      !form.minTermMonths ||
      !form.maxTermMonths ||
      !form.regionsSupported ||
      !form.industriesSupported
    ) {
      setError("Please fill required fields.");
      return;
    }

    setSaving(true);
    try {
      // NOTE: This component only returns the edited broker object.
      // Perform API update in the parent if you want server-side persistence.
      const updated: LoanProduct = {
        id: loanProduct!.id,
        minLoanAmount: form.minLoanAmount,
        maxLoanAmount: form.maxLoanAmount,
        minTermMonths: form.minTermMonths,
        maxTermMonths: form.maxTermMonths,
        regionsSupported: form.regionsSupported,
        industriesSupported: form.industriesSupported,
        createdAt: loanProduct!.createdAt,
        isActive: loanProduct!.isActive,
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
    <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm ">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Loan Product</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-3">
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Min Loan Amount
            </span>
            <input
              type="number"
              min={0}
              max={form.maxLoanAmount || undefined}
              required
              value={form.minLoanAmount}
              onChange={(e) =>
                setForm({ ...form, minLoanAmount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Max Loan Amount
            </span>
            <input
              type="number"
              value={form.maxLoanAmount}
              min={form.minLoanAmount || 0}
              required
              onChange={(e) =>
                setForm({ ...form, maxLoanAmount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Min Term Months
            </span>
            <input
              type="number"
              min={0}
              max={form.maxTermMonths || undefined}
              required
              value={form.minTermMonths}
              onChange={(e) =>
                setForm({ ...form, minTermMonths: Number(e.target.value) })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200">
              Max Term Months
            </span>
            <input
              type="number"
              min={form.minTermMonths || 0}
              required
              value={form.maxTermMonths}
              onChange={(e) =>
                setForm({ ...form, maxTermMonths: Number(e.target.value) })
              }
              className="w-full px-3 py-2 mt-1 border rounded-md"
            />
          </label>

          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-200">
              Regions Supported
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["CA", "TX", "FL", "NY", "NJ"].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => toggleChip("regionsSupported", r)}
                  className={`px-3 py-1 rounded-full border ${form.regionsSupported.includes(r) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 dark:text-slate-200">
              Industries Supported
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Real Estate", "Hospitality"].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => toggleChip("industriesSupported", r)}
                  className={`px-3 py-1 rounded-full border ${form.industriesSupported.includes(r) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#3e86b7] text-white rounded-md hover:bg-[#2e6f99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
