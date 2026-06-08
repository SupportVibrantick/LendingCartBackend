import { useEffect, useState } from "react";
import {
  Blocks,
  Building2,
  ChevronRight,
  Eye,
  FileText,
  Layers,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  Edit3,
  Sparkles,
  ToggleLeft,
} from "lucide-react";
import toast from "react-hot-toast";

type FieldType = "text" | "number" | "email" | "textarea" | "select" | "file";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type Broker = { id: string; name: string };
type AppItem = { id: string; name: string; isActive: boolean };
type ProductItem = {
  id: string;
  brokerApplicationId: string;
  loanProductCode: string;
  isActive: boolean;
};
type SectionItem = {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  fields: Record<string, unknown>[];
};

function getAuthHeaders() {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

type FormField = {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: { min?: number; max?: number };
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Server returned invalid response.");
  }
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-[#13538A] focus:outline-none focus:ring-2 focus:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  text: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  number: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  email: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  textarea: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  select: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  file: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function ApplicationBuilder() {
  const [applications, setApplications] = useState<AppItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [optionsInput, setOptionsInput] = useState("");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<FormField, "id">>({
    type: "text",
    label: "",
    placeholder: "",
    required: false,
    options: [],
    validation: {},
  });

  const fetchBrokers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/brokers/read`, { headers: getAuthHeaders() });
      const json = await res.json();
      setBrokers(json.data || []);
    } catch {
      toast.error("Failed to load brokers");
    }
  };

  const loadApplications = async (brokerId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/applications?brokerOrgId=${brokerId}`, {
        headers: getAuthHeaders(),
      });
      const json = await safeJson(res);
      if (!res.ok || json.success !== true) throw new Error(json.message);
      setApplications(json.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load applications");
    }
  };

  const loadProducts = async (appId: string, brokerId: string) => {
    try {
      setLoadingProducts(true);
      setProducts([]);
      setSelectedProductId("");
      const res = await fetch(
        `${API_BASE}/admin/applications/${appId}/products?brokerOrgId=${brokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);
      if (!res.ok || json.success !== true) throw new Error(json.message);
      setProducts(json.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const mapApiField = (f: Record<string, unknown>): FormField => ({
    id: String(f.id),
    type: String(f.fieldType).toLowerCase() as FieldType,
    label: String(f.label),
    placeholder: f.placeholder ? String(f.placeholder) : "",
    required: Boolean(f.isRequired),
    options: Array.isArray(f.options)
      ? (f.options as string[])
      : f.options
        ? String(f.options).split(",")
        : [],
    validation: (f.validation as FormField["validation"]) || {},
  });

  const loadFields = async (productId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/admin/applications/products/${productId}/fields?brokerOrgId=${selectedBrokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);
      if (!res.ok || json.success !== true) throw new Error(json.message);
      const apiSections = json.data || [];
      setSections(apiSections);
      if (apiSections.length > 0) {
        const first = apiSections[0];
        setSelectedSectionId(first.id);
        setFields((first.fields || []).map(mapApiField));
      } else {
        setSelectedSectionId("");
        setFields([]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load fields");
    }
  };

  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    const section = sections.find((s) => s.id === sectionId);
    setFields((section?.fields || []).map(mapApiField));
  };

  useEffect(() => { fetchBrokers(); }, []);

  useEffect(() => {
    if (!selectedBrokerId) {
      setApplications([]);
      setProducts([]);
      setFields([]);
      setSelectedAppId("");
      setSelectedProductId("");
      return;
    }
    loadApplications(selectedBrokerId);
  }, [selectedBrokerId]);

  useEffect(() => {
    if (selectedAppId && selectedBrokerId) loadProducts(selectedAppId, selectedBrokerId);
  }, [selectedAppId, selectedBrokerId]);

  useEffect(() => {
    if (selectedProductId) loadFields(selectedProductId);
  }, [selectedProductId]);

  async function saveFieldToServer(field: FormField, isUpdate: boolean) {
    const payload: Record<string, unknown> = {
      fieldKey: field.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
      label: field.label,
      fieldType: field.type.toUpperCase(),
      isRequired: field.required,
      brokerOrgId: selectedBrokerId,
    };
    if (!isUpdate) {
      payload.sectionId = selectedSectionId;
      payload.sortOrder = fields.length + 1;
    }
    if (field.placeholder) payload.placeholder = field.placeholder;
    if (field.type === "select") payload.options = (field.options || []).join(",");
    if (field.type === "number" && field.validation) {
      payload.validation = {};
      if (field.validation.min !== undefined) {
        (payload.validation as Record<string, number>).min = field.validation.min;
      }
      if (field.validation.max !== undefined) {
        (payload.validation as Record<string, number>).max = field.validation.max;
      }
    }
    const url = isUpdate
      ? `${API_BASE}/admin/applications/fields/${field.id}`
      : `${API_BASE}/admin/applications/products/${selectedProductId}/fields`;
    const res = await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok || json.success !== true) throw new Error(json.message);
    return json;
  }

  async function deleteFieldFromServer(fieldId: string) {
    const res = await fetch(
      `${API_BASE}/admin/applications/fields/${fieldId}?brokerOrgId=${selectedBrokerId}`,
      { method: "DELETE", headers: getAuthHeaders() }
    );
    const json = await safeJson(res);
    if (!res.ok || json.success !== true) throw new Error(json.message);
  }

  const resetForm = () => {
    setEditingId(null);
    setForm({ type: "text", label: "", placeholder: "", required: false, options: [], validation: {} });
    setOptionsInput("");
  };

  const handleAddOrUpdate = async () => {
    if (!form.label.trim()) { toast.error("Field label is required"); return; }
    if (!selectedSectionId) {
      toast.error("Please select a section first. Create one from Add Sections if needed.");
      return;
    }
    let finalOptions: string[] = [];
    if (form.type === "select") {
      finalOptions = optionsInput.split(",").map((s) => s.trim()).filter(Boolean);
      if (finalOptions.length === 0) { toast.error("Please add at least one dropdown option"); return; }
    }
    if (form.type === "number") {
      const min = form.validation?.min;
      const max = form.validation?.max;
      if (min !== undefined && max !== undefined && min > max) {
        toast.error("Min value cannot be greater than Max value");
        return;
      }
    }
    const newField: FormField = {
      id: editingId || Date.now().toString(),
      ...form,
      validation: form.type === "number" ? form.validation : undefined,
      options: form.type === "select" ? finalOptions : [],
    };
    setSaving(true);
    try {
      await saveFieldToServer(newField, Boolean(editingId));
      toast.success(editingId ? "Field updated" : "Field saved");
      loadFields(selectedProductId);
      resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save field");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (!window.confirm("Delete this field?")) return;
    try {
      await deleteFieldFromServer(fieldId);
      toast.success("Field deleted");
      if (editingId === fieldId) resetForm();
      loadFields(selectedProductId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete field");
    }
  };

  const handleEdit = (f: FormField) => {
    setEditingId(f.id);
    setForm({
      type: f.type,
      label: f.label,
      placeholder: f.placeholder,
      required: f.required,
      options: Array.isArray(f.options) ? f.options : [],
      validation: f.validation || {},
    });
    if (f.type === "select") setOptionsInput((f.options || []).join(", "));
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const previewInputClass = `${inputClass} text-xs`;

  return (
    <div className="space-y-6 px-4 py-6 md:px-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#13538A] via-[#1a6aad] to-[#2d8de0] p-6 md:p-8 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Blocks size={14} />
            Form Builder
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">Application Form Builder</h1>
          <p className="mt-1 max-w-2xl text-sm text-blue-100">
            Design dynamic form fields per section and product. Changes reflect in the live application.
          </p>
        </div>
      </div>

      {/* Step selectors */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Configuration Steps
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Building2 size={13} /> Broker
            </label>
            <select
              className={inputClass}
              value={selectedBrokerId}
              onChange={(e) => {
                setSelectedBrokerId(e.target.value);
                setSelectedAppId("");
                setSelectedProductId("");
                setProducts([]);
                setFields([]);
              }}
            >
              <option value="">Select Broker</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {selectedBrokerId && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <FileText size={13} /> Application
              </label>
              <select className={inputClass} value={selectedAppId} onChange={(e) => setSelectedAppId(e.target.value)}>
                <option value="">Select Application</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedAppId && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <Package size={13} /> Product
                {loadingProducts && <Loader2 size={12} className="animate-spin" />}
              </label>
              <select className={inputClass} value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                <option value="">{loadingProducts ? "Loading..." : "Select Product"}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.loanProductCode}</option>
                ))}
              </select>
            </div>
          )}

          {selectedProductId && sections.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <Layers size={13} /> Section
              </label>
              <select className={inputClass} value={selectedSectionId} onChange={(e) => handleSectionChange(e.target.value)}>
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedBrokerId && selectedAppId && selectedProductId && selectedSection && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
              {brokers.find((b) => b.id === selectedBrokerId)?.name}
            </span>
            <ChevronRight size={12} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
              {applications.find((a) => a.id === selectedAppId)?.name}
            </span>
            <ChevronRight size={12} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
              {products.find((p) => p.id === selectedProductId)?.loanProductCode}
            </span>
            <ChevronRight size={12} />
            <span className="rounded-full bg-[#13538A]/10 px-2.5 py-1 text-[#13538A]">
              {selectedSection.name}
            </span>
          </div>
        )}
      </div>

      {!selectedAppId || !selectedProductId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
            <Sparkles className="text-blue-500" size={28} />
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">No Configuration Selected</h3>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Select a broker, application, and product above to start building your form.
          </p>
        </div>
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-20 text-center dark:border-amber-800 dark:bg-amber-900/10">
          <Layers className="mb-4 text-amber-500" size={36} />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">No sections yet</h3>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Create at least one section from <strong>Add Sections</strong> before adding fields.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
          {/* Field editor */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
                  {editingId ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    {editingId ? "Edit Field" : "Add Field"}
                  </h2>
                  <p className="text-xs text-slate-500">{fields.length} field{fields.length !== 1 ? "s" : ""} in section</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Field Type</label>
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as FieldType })}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Dropdown</option>
                  <option value="file">File Upload</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Label</label>
                <input
                  className={inputClass}
                  placeholder="Field label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>

              {form.type !== "select" && form.type !== "file" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Placeholder</label>
                  <input
                    className={inputClass}
                    placeholder="Placeholder text"
                    value={form.placeholder || ""}
                    onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                  />
                </div>
              )}

              {form.type === "number" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Min</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={form.validation?.min ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          validation: {
                            ...form.validation,
                            min: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Max</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={form.validation?.max ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          validation: {
                            ...form.validation,
                            max: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {form.type === "select" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Options (comma separated)</label>
                  <input
                    className={inputClass}
                    placeholder="Yes, No, Maybe"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                  />
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="rounded accent-[#13538A]"
                />
                <ToggleLeft size={16} className="text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Required field</span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={handleAddOrUpdate}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#13538A] py-2.5 text-sm font-semibold text-white hover:bg-[#1a6aad] disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingId ? "Save Changes" : "Add Field"}
                </button>
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Field list */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Section Fields</p>
                <div className="custom-scrollbar max-h-[280px] space-y-2 overflow-y-auto">
                  {fields.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">No fields yet</p>
                  ) : (
                    fields.map((f) => (
                      <div
                        key={f.id}
                        className={`flex items-center justify-between rounded-xl border p-3 transition ${
                          editingId === f.id
                            ? "border-[#13538A]/40 bg-[#13538A]/5"
                            : "border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{f.label}</p>
                          <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${FIELD_TYPE_COLORS[f.type]}`}>
                            {f.type}
                          </span>
                        </div>
                        <div className="ml-2 flex gap-1">
                          <button
                            onClick={() => handleEdit(f)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-[#13538A] dark:hover:bg-slate-700"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(f.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                  <Eye size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Live Preview</h2>
                  <p className="text-xs text-slate-500">How fields appear to applicants</p>
                </div>
              </div>
            </div>

            <form className="space-y-4 p-5">
              {fields.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">Add fields to see preview</p>
              ) : (
                fields.map((f) => (
                  <div key={f.id}>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      {f.label}
                      {f.required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    {["text", "number", "email"].includes(f.type) && (
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        min={f.type === "number" ? f.validation?.min : undefined}
                        max={f.type === "number" ? f.validation?.max : undefined}
                        className={previewInputClass}
                      />
                    )}
                    {f.type === "textarea" && (
                      <textarea placeholder={f.placeholder} rows={3} className={previewInputClass} />
                    )}
                    {f.type === "select" && (
                      <select className={previewInputClass}>
                        <option value="">Please Select</option>
                        {f.options?.map((o, i) => (
                          <option key={i} value={o}>{o}</option>
                        ))}
                      </select>
                    )}
                    {f.type === "file" && <input type="file" className={previewInputClass} />}
                  </div>
                ))
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
