import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Loader2, PackageCheck, LayoutTemplate } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Template = {
  id: string;
  name: string;
};

type LoanProduct = {
  id: string;
  code: string;
  name: string;
};

/* ================= AUTH ================= */

function getAuthHeaders() {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("RAW RESPONSE:", text);
    throw new Error("Invalid server response");
  }
}

/* ================= COMPONENT ================= */

const AddTemplateProducts: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ================= LOAD TEMPLATES ================= */

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetch(`${API_BASE}/admin/applications/templates`, {
        headers: getAuthHeaders(),
      });
      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error("Failed to load templates");
      }

      setTemplates(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  /* ================= LOAD PRODUCTS ================= */

  const loadLoanProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch(
        `${API_BASE}/common/loan-products/loan-product-code`,
      );
      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error("Failed to load loan products");
      }

      setProducts(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load loan products");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadLoanProducts();
  }, []);

  /* ================= TOGGLE ================= */

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  /* ================= SAVE ================= */

  const handleAdd = async () => {
    if (!selectedTemplateId) {
      toast.error("Please select template");
      return;
    }

    if (selectedCodes.length === 0) {
      toast.error("Please select at least one loan product");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        `${API_BASE}/admin/applications/templates/${selectedTemplateId}/products`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            loanProductCodes: selectedCodes,
          }),
        },
      );

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to add products");
      }

      toast.success("Loan products added to template");
      setSelectedCodes([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to add loan products");
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5 max-w-xl w-full">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold">
          <PackageCheck className="text-[#13538A] drop-shadow-sm" size={20} />
          <span className="tracking-tight">Add Loan Products to Template</span>
        </div>
        {/* ================= TEMPLATE SELECT ================= */}
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400">
            Select Template
          </label>

          <div className="relative">
            <LayoutTemplate
              size={16}
              className="absolute left-3 top-2.5 text-slate-400"
            />
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                setSelectedCodes([]); // reset selection
              }}
              disabled={loadingTemplates}
              className="w-full pl-9 rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300
                       dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            >
              <option value="">
                {loadingTemplates ? "Loading templates..." : "Select Template"}
              </option>

              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ================= CHECKBOX LIST ================= */}
        <div>
          <label className="block text-sm mb-2 text-slate-600 dark:text-slate-400">
            Select Loan Products
          </label>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto border rounded-xl p-3
                        bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          >
            {loadingProducts ? (
              <div className="text-sm text-slate-400">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="text-sm text-slate-400">No products found</div>
            ) : (
              products.map((p) => {
                const checked = selectedCodes.includes(p.code);

                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition
                    ${
                      checked
                        ? "bg-indigo-50 border-indigo-300 dark:bg-indigo-500/10 dark:border-indigo-500"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCode(p.code)}
                      className="accent-indigo-600"
                    />

                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {p.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {p.code}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ================= BUTTON ================= */}
        <button
          onClick={handleAdd}
          disabled={saving || !selectedTemplateId || selectedCodes.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-[#13538A] hover:bg-[#1b72be]
  text-white py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Adding Products...
            </>
          ) : (
            <>
              <Plus size={18} />
              Add Selected Products
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AddTemplateProducts;
