import React, { useEffect, useState } from "react";
import {
  AlignLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Hash,
  Layers,
  LayoutTemplate,
  Loader2,
  Package,
  // PlusCircle,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface Product {
  id: string;
  loanProductCode: string;
}

interface Template {
  id: string;
  name: string;
  products: Product[];
}

const SECTION_SUGGESTIONS = [
  "Personal Information",
  "Business Information",
  "Financial Details",
  "Property Details",
  "Documents",
];

const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge Loan",
  SBA_7A: "SBA 7A",
  CMBS: "CMBS",
  CRE_PERMANENT_LOAN: "CRE Permanent",
};

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

function formatProductCode(code: string) {
  return PRODUCT_LABELS[code] ?? code.replace(/_/g, " ");
}

const AddSectionAdmin: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(1);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/applications/templates`, {
          headers: getAuthHeaders(),
        });
        const json = await safeJson(res);
        if (!json.success) throw new Error("Failed to load templates");
        setTemplates(json.data || []);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const selectedProduct = selectedTemplate?.products?.find((p) => p.id === productId);

  const handleSubmit = async () => {
    if (!templateId || !productId || !name.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/applications/templates/${templateId}/products/${productId}/sections`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, description, sortOrder: Number(sortOrder) }),
        }
      );
      const json = await safeJson(res);
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to create section");
      }
      toast.success("Section created successfully");
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
      setName("");
      setDescription("");
      setSortOrder(1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create section");
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { label: "Template", done: Boolean(templateId) },
    { label: "Product", done: Boolean(productId) },
    { label: "Section", done: Boolean(name.trim()) },
  ];
  const completedSteps = steps.filter((s) => s.done).length;

  return (
    <div className="relative min-h-[calc(100vh-80px)] bg-[#F8FAFC] p-4 dark:bg-slate-950 md:p-6">
      {/* Ambient background */}
      <div className="pointer-events-none fixed left-16 top-24 h-64 w-64 animate-pulse rounded-full bg-violet-200 opacity-50 blur-[100px] dark:bg-violet-500/20" />
      <div className="pointer-events-none fixed bottom-16 right-16 h-64 w-64 rounded-full bg-indigo-200 opacity-50 blur-[100px] dark:bg-indigo-500/20" />

      <div className="relative mx-auto max-w-6xl space-y-5">
        {/* Top bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              <Sparkles size={12} />
              TEMPLATE BUILDER
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Add Application Section
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Organize template fields into logical groups for each loan product.
            </p>
          </div>
          {!loading && templates.length > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Templates</p>
                <p className="text-lg font-bold text-violet-600">{templates.length}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Progress</p>
                <p className="text-lg font-bold text-violet-600">{completedSteps}/3</p>
              </div>
            </div>
          )}
        </div>

        {/* Main card — split layout */}
        <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/80 md:flex md:min-h-[560px]">
          {/* LEFT — Form */}
          <div className="flex-1 border-b border-slate-100 p-6 dark:border-slate-800 md:border-b-0 md:border-r md:p-10 lg:p-12">
            {/* Step indicator */}
            <div className="mb-8 flex items-center gap-1">
              {steps.map((step, i) => (
                <React.Fragment key={step.label}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        step.done
                          ? "bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/40"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                      }`}
                    >
                      {step.done ? <Check size={13} /> : i + 1}
                    </div>
                    <span
                      className={`hidden text-xs font-semibold sm:inline ${
                        step.done ? "text-violet-700 dark:text-violet-400" : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight size={14} className="mx-1 text-slate-300 dark:text-slate-600" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <Loader2 className="animate-spin text-violet-500" size={32} />
                <p className="text-sm font-medium">Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
                  <LayoutTemplate className="text-violet-500" size={28} />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">No Templates Found</h3>
                <p className="mt-2 max-w-xs text-sm text-slate-500">
                  Create a template first, then come back to add sections.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Template */}
                <div className="group">
                  <label className="mb-3 block text-[11px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-violet-600">
                    1. Select Template *
                  </label>
                  <div className="custom-scrollbar grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTemplateId(t.id);
                          setProductId("");
                        }}
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          templateId === t.id
                            ? "border-violet-400 bg-violet-50 shadow-sm ring-2 ring-violet-400/30 dark:border-violet-600 dark:bg-violet-900/20"
                            : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-violet-800"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            templateId === t.id
                              ? "bg-violet-600 text-white"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-700"
                          }`}
                        >
                          <LayoutTemplate size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {t.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {t.products?.length ?? 0} product{(t.products?.length ?? 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product pills */}
                {selectedTemplate && (
                  <div className="group">
                    <label className="mb-3 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                      2. Select Loan Product *
                    </label>
                    {(selectedTemplate.products?.length ?? 0) === 0 ? (
                      <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        No products in this template. Add loan products first.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.products.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProductId(p.id)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all ${
                              productId === p.id
                                ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/30"
                                : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <Package size={14} />
                            {formatProductCode(p.loanProductCode)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section name */}
                <div className="group">
                  <label className="mb-3 block text-[11px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-violet-600">
                    3. Section Name *
                  </label>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {SECTION_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setName(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          name === s
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 text-slate-400 shadow-sm group-focus-within:border-violet-300 group-focus-within:text-violet-500 dark:border-slate-700 dark:bg-slate-800">
                      <Layers size={16} />
                    </div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Personal Information"
                      className="flex-1 border-b border-slate-200 bg-transparent pb-2 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-500 dark:border-slate-700 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="group">
                  <label className="mb-3 block text-[11px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-violet-600">
                    Description
                  </label>
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <AlignLeft size={16} />
                    </div>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional — describe what fields belong here..."
                      className="flex-1 resize-none border-b border-slate-200 bg-transparent pb-2 text-sm text-slate-600 outline-none placeholder:text-slate-400 focus:border-violet-500 dark:border-slate-700 dark:text-slate-300"
                    />
                  </div>
                </div>

                {/* Sort order */}
                <div className="group">
                  <label className="mb-3 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Sort Order
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <Hash size={16} />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={sortOrder}
                      onChange={(e) => setSortOrder(Number(e.target.value))}
                      className="w-24 border-b border-slate-200 bg-transparent pb-2 text-sm font-medium text-slate-800 outline-none focus:border-violet-500 dark:border-slate-700 dark:text-slate-100"
                    />
                    <span className="text-xs text-slate-400">Lower = appears first</span>
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={saving || !templateId || !productId || !name.trim()}
                  className="group relative w-full overflow-hidden rounded-2xl bg-violet-600 px-8 py-4 font-bold text-white transition-all hover:shadow-[0_20px_40px_-12px_rgba(124,58,237,0.5)] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 text-sm">
                    {saving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Creating...
                      </>
                    ) : isSaved ? (
                      <>
                        Created <Check size={18} />
                      </>
                    ) : (
                      <>
                        Create Section
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-violet-700 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — Live preview */}
          <div className="flex flex-1 items-center justify-center bg-slate-50/80 p-8 dark:bg-slate-950/40 md:p-10">
            <div className="relative w-full max-w-[340px]">
              <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-tr from-violet-500 to-indigo-500 opacity-10 blur-2xl" />

              <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Section Preview
                  </span>
                </div>

                <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  <LayoutTemplate size={11} />
                  {selectedTemplate?.name || "Select template"}
                </div>

                {selectedProduct && (
                  <div className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    <Package size={11} />
                    {formatProductCode(selectedProduct.loanProductCode)}
                  </div>
                )}

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-[11px] font-bold text-white">
                      {sortOrder}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {name || "Section Title"}
                    </h3>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {description || "Section description will appear here. Use this to explain what information belongs in this group."}
                  </p>

                  <div className="mt-4 space-y-2.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="space-y-1.5">
                        <div className="h-2.5 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="h-9 rounded-xl bg-white shadow-sm dark:bg-slate-900" />
                      </div>
                    ))}
                    <p className="pt-1 text-center text-[10px] text-slate-400">
                      Fields will be added here
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="text-xs text-slate-400">Sort order</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    #{sortOrder}
                  </span>
                </div>
              </div>

              {/* Success overlay */}
              {isSaved && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[2.5rem] bg-white/90 backdrop-blur-md dark:bg-slate-900/90">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check size={32} strokeWidth={3} />
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-100">Section Created!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSectionAdmin;
