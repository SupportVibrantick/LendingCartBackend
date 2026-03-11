import React, { useEffect, useState } from "react";
import { Layers, Loader2, PlusCircle } from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

interface Product {
  id: string;
  loanProductCode: string;
}

interface Template {
  id: string;
  name: string;
  products: Product[];
}

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
    throw new Error("Invalid server response");
  }
}

/* ================= PAGE ================= */

const AddSectionAdmin: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [templateId, setTemplateId] = useState("");
  const [productId, setProductId] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(1);

  const [saving, setSaving] = useState(false);

  /* ================= LOAD TEMPLATES ================= */

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/applications/templates`, {
          headers: getAuthHeaders(),
        });
        const json = await safeJson(res);

        if (!json.success) throw new Error("Failed to load templates");

        setTemplates(json.data || []);
      } catch (e: any) {
        toast.error(e.message || "Failed to load templates");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  /* ================= SUBMIT ================= */

  const handleSubmit = async () => {
    if (!templateId || !productId || !name.trim()) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        `${API_BASE}/admin/applications/templates/${templateId}/products/${productId}/sections`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name,
            description,
            sortOrder: Number(sortOrder),
          }),
        },
      );

      const json = await safeJson(res);

      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to create section");
      }

      toast.success("Section created successfully");

      // Reset
      setName("");
      setDescription("");
      setSortOrder(1);
    } catch (e: any) {
      toast.error(e.message || "Failed to create section");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 py-20 px-6">
      <div className="max-w-4xl mx-auto">
        {/* ===== Header ===== */}
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
            <Layers className="text-[#13538A] drop-shadow-sm" size={16} />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Add Section
            </span>
          </div>

          <h1 className="text-4xl font-black mb-4 text-slate-900 dark:text-white">
            Create{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#13538A] via-[#1b72be] to-[#2d8de0]">
  Application Section
</span>
          </h1>

          <p className="text-slate-500 dark:text-slate-400">
            Sections help group fields like "Personal Info", "Business Info",
            etc.
          </p>
        </div>

        {/* ===== Card ===== */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
          {loading ? (
            <div className="flex justify-center py-10 text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Template Select */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Select Template <span className="text-red-500">*</span>
                </label>
                <select
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    setProductId("");
                  }}
                  className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Select Template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Select */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Select Loan Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={!templateId}
                  className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                >
                  <option value="">-- Select Product --</option>
                  {selectedTemplate?.products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.loanProductCode}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Name */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Personal Information"
                  className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Submit */}
              <div className="pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold 
  bg-[#13538A] text-white hover:bg-[#1b72be] transition 
  disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Creating...
                    </>
                  ) : (
                    <>
                      <PlusCircle size={18} /> Create Section
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddSectionAdmin;
