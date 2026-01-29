import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Loader2, LayoutTemplate, Boxes, ListChecks, Layers } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Template = {
    id: string;
    name: string;
    products: TemplateProduct[];
};

type TemplateProduct = {
    id: string;
    loanProductCode: string;
};

type Section = {
    id: string;
    name: string;
};

type FieldType = "TEXT" | "NUMBER" | "EMAIL" | "TEXTAREA" | "SELECT" | "FILE";

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

const AdminTemplateFieldBuilder: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [products, setProducts] = useState<TemplateProduct[]>([]);
    const [selectedProductId, setSelectedProductId] = useState("");

    const [sections, setSections] = useState<Section[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState("");

    const [saving, setSaving] = useState(false);
    const [options, setOptions] = useState("");

    /* ================= FIELD FORM ================= */

    const [label, setLabel] = useState("");
    const [placeholder, setPlaceholder] = useState("");
    const [type, setType] = useState<FieldType>("TEXT");
    const [isRequired, setIsRequired] = useState(true);
    const [sortOrder, setSortOrder] = useState(1);

    /* ================= LOAD TEMPLATES ================= */

    const loadTemplates = async () => {
        try {
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
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    /* ================= ON TEMPLATE CHANGE ================= */

    useEffect(() => {
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        setProducts(tpl?.products || []);
        setSelectedProductId("");
        setSections([]);
        setSelectedSectionId("");
    }, [selectedTemplateId, templates]);

    /* ================= LOAD SECTIONS WHEN PRODUCT CHANGES ================= */

    useEffect(() => {
        if (!selectedTemplateId || !selectedProductId) {
            setSections([]);
            setSelectedSectionId("");
            return;
        }

        (async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/admin/applications/templates/${selectedTemplateId}/products/${selectedProductId}/sections`,
                    { headers: getAuthHeaders() }
                );
                const json = await safeJson(res);

                if (!res.ok || json.success !== true) {
                    throw new Error("Failed to load sections");
                }

                setSections(json.data || []);
                setSelectedSectionId(json.data?.[0]?.id || "");
            } catch (e: any) {
                toast.error(e.message || "Failed to load sections");
            }
        })();
    }, [selectedTemplateId, selectedProductId]);

    /* ================= ADD FIELD ================= */

    const handleAddField = async () => {
        if (type === "SELECT" && !options.trim()) {
            toast.error("Please enter options for dropdown field");
            return;
        }

        if (!selectedTemplateId || !selectedProductId || !selectedSectionId || !label) {
            toast.error("Please select template, product, section and enter label");
            return;
        }

        const fieldKey = label
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");

        try {
            setSaving(true);

            const res = await fetch(
                `${API_BASE}/admin/applications/templates/${selectedTemplateId}/products/${selectedProductId}/fields`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        fieldKey,
                        label,
                        placeholder: placeholder || null,
                        fieldType: type,
                        isRequired,
                        sortOrder,
                        sectionId: selectedSectionId,
                        options: type === "SELECT" ? options : null,
                    }),
                }
            );

            const json = await safeJson(res);

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Failed to add field");
            }

            toast.success("Field added successfully");

            setLabel("");
            setPlaceholder("");
            setType("TEXT");
            setIsRequired(true);
            setSortOrder((s) => s + 1);
        } catch (err: any) {
            toast.error(err.message || "Failed to add field");
        } finally {
            setSaving(false);
        }
    };

    /* ================= UI ================= */

    return (
        <div className="max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                <ListChecks className="text-indigo-500" />
                Template Field Builder (Admin)
            </div>

            {/* ================= TEMPLATE SELECT ================= */}
            <div>
                <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
                    Select Template
                </label>
                <div className="relative">
                    <LayoutTemplate className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full pl-9 rounded-lg border px-3 py-2 bg-white dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                    >
                        <option value="">Select Template</option>
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ================= PRODUCT SELECT ================= */}
            {selectedTemplateId && (
                <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
                        Select Product
                    </label>
                    <div className="relative">
                        <Boxes className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full pl-9 rounded-lg border px-3 py-2 bg-white dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                        >
                            <option value="">Select Product</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.loanProductCode}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* ================= SECTION SELECT (NEW) ================= */}
            {selectedProductId && (
                <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
                        Select Section
                    </label>
                    <div className="relative">
                        <Layers className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <select
                            value={selectedSectionId}
                            onChange={(e) => setSelectedSectionId(e.target.value)}
                            className="w-full pl-9 rounded-lg border px-3 py-2 bg-white dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                        >
                            <option value="">Select Section</option>
                            {sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* ================= FIELD FORM ================= */}
            {selectedSectionId && (
                <div className="border-t pt-5 space-y-4">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Add New Field
                    </div>

                    <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Field Label (e.g. Annual Revenue)"
                        className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                    />

                    <input
                        value={placeholder}
                        onChange={(e) => setPlaceholder(e.target.value)}
                        placeholder="Placeholder (optional)"
                        className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as FieldType)}
                            className="border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                        >
                            <option value="TEXT">Text</option>
                            <option value="NUMBER">Number</option>
                            <option value="EMAIL">Email</option>
                            <option value="TEXTAREA">Textarea</option>
                            <option value="SELECT">Dropdown</option>
                            <option value="FILE">File</option>
                        </select>

                        <input
                            type="number"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(Number(e.target.value))}
                            placeholder="Sort Order"
                            className="border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                        />
                        {type === "SELECT" && (
                            <div>
                                <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
                                    Options (comma separated)
                                </label>
                                <input
                                    value={options}
                                    onChange={(e) => setOptions(e.target.value)}
                                    placeholder="e.g. Self Employed,Business,Freelancer,Other"
                                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                                />
                            </div>
                        )}
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={isRequired}
                            onChange={(e) => setIsRequired(e.target.checked)}
                            className="accent-indigo-600"
                        />
                        Required Field
                    </label>

                    <button
                        onClick={handleAddField}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="animate-spin" size={18} /> Saving...
                            </>
                        ) : (
                            <>
                                <Plus size={18} /> Add Field
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminTemplateFieldBuilder;
