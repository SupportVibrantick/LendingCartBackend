import { useEffect, useState } from "react";
import { Trash2, Edit3 } from "lucide-react";
import toast from "react-hot-toast";

/* ================= TYPES ================= */

type FieldType = "text" | "number" | "email" | "textarea" | "select" | "file";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type AppItem = {
    id: string;
    name: string;
    isActive: boolean;
};

type ProductItem = {
    id: string;
    brokerApplicationId: string;
    loanProductCode: string;
    isActive: boolean;
};

function getAuthHeaders() {
    const token = sessionStorage.getItem("broker_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

type Validation = {
    min?: number;
    max?: number;
};

type FormField = {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    options?: string[];
    validation?: {
        min?: number;
        max?: number;
    };
};

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        console.error("RAW RESPONSE:", text);
        throw new Error("Server returned invalid response.");
    }
}

/* ================= PAGE ================= */

export default function ApplicationBuilder() {
    const [applications, setApplications] = useState<AppItem[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    const [optionsInput, setOptionsInput] = useState("");
    const [minVal, setMinVal] = useState("");
    const [maxVal, setMaxVal] = useState("");

    const [selectedAppId, setSelectedAppId] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");

    const [fields, setFields] = useState<FormField[]>([]);

    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<Omit<FormField, "id">>({
        type: "text",
        label: "",
        placeholder: "",
        required: false,
        options: [],
        validation: {},
    });


    /* ================= LOAD APPLICATIONS ================= */
    const loadApplications = async () => {
        try {
            const res = await fetch(`${API_BASE}/broker/applications`, {
                headers: getAuthHeaders(),
            });
            const json = await safeJson(res);
            if (!res.ok || json.success !== true) throw new Error(json.message);
            setApplications(json.data || []);
        } catch (err: any) {
            toast.error(err.message || "Failed to load applications");
        }
    };

    /* ================= LOAD PRODUCTS ================= */
    const loadProducts = async (appId: string) => {
        try {
            setLoadingProducts(true);
            setProducts([]);
            setSelectedProductId("");

            const res = await fetch(
                `${API_BASE}/broker/applications/${appId}/products`,
                { headers: getAuthHeaders() }
            );

            const json = await safeJson(res);
            if (!res.ok || json.success !== true) throw new Error(json.message);

            setProducts(json.data || []);
        } catch (err: any) {
            toast.error(err.message || "Failed to load products");
        } finally {
            setLoadingProducts(false);
        }
    };

    /* ================= LOAD FIELDS (LIST API) ================= */
    const loadFields = async (productId: string) => {
        try {
            const res = await fetch(
                `${API_BASE}/broker/applications/products/${productId}/fields`,
                { headers: getAuthHeaders() }
            );

            const json = await safeJson(res);
            if (!res.ok || json.success !== true) throw new Error(json.message);

            const mapped: FormField[] = (json.data || []).map((f: any) => ({
                id: f.fieldId || crypto.randomUUID(),
                type: f.fieldType.toLowerCase(),
                label: f.label,
                placeholder: f.placeholder || "",
                required: f.isRequired,
                options: f.options ? String(f.options).split(",") : [],
                validation: f.validation || {},
            }));

            setFields(mapped);
        } catch (err: any) {
            toast.error(err.message || "Failed to load fields");
        }
    };

    useEffect(() => {
        loadApplications();
    }, []);

    useEffect(() => {
        if (selectedAppId) loadProducts(selectedAppId);
    }, [selectedAppId]);

    useEffect(() => {
        if (selectedProductId) loadFields(selectedProductId);
    }, [selectedProductId]);

    /* ================= SAVE FIELD API ================= */
    async function saveFieldToServer(field: FormField) {
        const payload: any = {
            fieldKey: field.label
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^a-z0-9_]/g, ""),
            label: field.label,
            fieldType: field.type.toUpperCase(),
            isRequired: field.required,
        };

        if (field.placeholder) payload.placeholder = field.placeholder;
        if (field.type === "select") payload.options = (field.options || []).join(",");

        if (field.type === "number" && field.validation) {
            payload.validation = {};
            if (field.validation.min !== undefined) payload.validation.min = field.validation.min;
            if (field.validation.max !== undefined) payload.validation.max = field.validation.max;
        }

        const res = await fetch(
            `${API_BASE}/broker/applications/products/${selectedProductId}/fields`,
            {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            }
        );

        const json = await safeJson(res);
        if (!res.ok || json.success !== true) throw new Error(json.message);

        return json;
    }

    const resetForm = () => {
        setEditingId(null);
        setForm({
            type: "text",
            label: "",
            placeholder: "",
            required: false,
            options: [],
            validation: {},
        });
        setOptionsInput("");
    };


    /* ================= ADD ================= */
    const handleAddOrUpdate = async () => {
        let finalOptions: string[] = [];

        if (form.type === "select") {
            finalOptions = optionsInput.split(",").map((s) => s.trim()).filter(Boolean);
            if (finalOptions.length === 0) return alert("Please add at least one option");
        }

        if (form.type === "number") {
            const min = form.validation?.min;
            const max = form.validation?.max;

            if (min !== undefined && max !== undefined && min > max) {
                alert("Min value cannot be greater than Max value");
                return;
            }
        }

        const validation: Validation = {};
        if (form.type === "number") {
            if (minVal !== "") validation.min = Number(minVal);
            if (maxVal !== "") validation.max = Number(maxVal);
        }

        const newField: FormField = {
            id: editingId || Date.now().toString(),
            ...form,
            validation: form.type === "number" ? form.validation : undefined,
            options: form.type === "select" ? finalOptions : [],

        };

        try {
            await saveFieldToServer(newField);
            toast.success("Field saved");
            loadFields(selectedProductId);
            resetForm();
        } catch (err: any) {
            toast.error(err.message || "Failed to save field");
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
        if (f.type === "number") {
            setMinVal(f.validation?.min?.toString() || "");
            setMaxVal(f.validation?.max?.toString() || "");
        }
    };

    // const handleDelete = (id: string) => {
    //     alert("Delete API later");
    // };


    /* ================= UI ================= */

    return (
        <div className="min-h-screen p-6 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                Application Form Builder
            </h1>

            {/* ================= SELECT ================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* APPLICATION */}
                <select
                    className="border rounded-lg px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                >
                    <option value="">Select Application</option>
                    {applications.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name}
                        </option>
                    ))}
                </select>

                {/* PRODUCT (only show if app selected) */}
                {selectedAppId && (
                    <select
                        className="border rounded-lg px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                        <option value="">
                            {loadingProducts ? "Loading products..." : "Select Product"}
                        </option>
                        {products.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.loanProductCode}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {!selectedAppId || !selectedProductId ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">

                    {/* Icon */}
                    <div className="h-16 w-16 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-5 shadow-sm">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.6}
                                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                            />
                        </svg>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        No Configuration Selected
                    </h3>

                    {/* Subtitle */}
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md">
                        Please select an <span className="font-medium text-slate-700 dark:text-slate-200">Application </span>
                        and a <span className="font-medium text-slate-700 dark:text-slate-200">Product</span> from above to start building your dynamic form.
                    </p>

                    {/* Hint */}
                    <div className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 5l7 7-7 7M5 12h14"
                            />
                        </svg>
                        Select Application & Product to continue
                    </div>
                </div>

            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
                    {/* ================= LEFT ================= */}
                    <div className="border rounded-xl p-5 space-y-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <h2 className="text-lg font-semibold">
                            {editingId ? "Edit Field" : "Add Field"}
                        </h2>

                        <select
                            className="w-full border rounded px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                            value={form.type}
                            onChange={(e) =>
                                setForm({ ...form, type: e.target.value as FieldType })
                            }
                        >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="email">Email</option>
                            <option value="textarea">Textarea</option>
                            <option value="select">Dropdown</option>
                            <option value="file">File Upload</option>
                        </select>

                        <input
                            className="w-full border rounded px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                            placeholder="Label"
                            value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                        />

                        {/* Placeholder */}
                        {form.type !== "select" && form.type !== "file" && (
                            <input
                                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                                placeholder="Placeholder"
                                value={form.placeholder || ""}
                                onChange={(e) =>
                                    setForm({ ...form, placeholder: e.target.value })
                                }
                            />
                        )}

                        {/* Min / Max for Number */}
                        {form.type === "number" && (
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="number"
                                    placeholder="Min value"
                                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
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

                                <input
                                    type="number"
                                    placeholder="Max value"
                                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
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
                        )}


                        {/* Options for Select */}
                        {form.type === "select" && (
                            <input
                                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                                placeholder="Yes, No, Maybe"
                                value={optionsInput}
                                onChange={(e) => setOptionsInput(e.target.value)}
                            />
                        )}

                        <button
                            onClick={handleAddOrUpdate}
                            className="bg-blue-600 text-white px-4 py-2 rounded"
                        >
                            {editingId ? "Save Field" : "Add Field"}
                        </button>

                        {/* FIELD LIST */}
                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                            {fields.map((f) => (
                                <div
                                    key={f.id}
                                    className="flex justify-between border p-2 rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                >
                                    <div>
                                        {f.label}
                                        <div className="text-xs text-slate-400">
                                            {f.type}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(f)}>
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            // onClick={() => handleDelete(f.id)}
                                            className="text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ================= RIGHT PREVIEW ================= */}
                    <div className="border rounded-xl p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <h2 className="text-lg font-semibold mb-4">Live Preview</h2>

                        <form className="space-y-4">
                            {fields.map((f) => (
                                <div key={f.id}>
                                    <label className="block text-sm mb-1">
                                        {f.label} {f.required && <span className="text-red-500">*</span>}
                                    </label>

                                    {/* TEXT / NUMBER / EMAIL */}
                                    {["text", "number", "email"].includes(f.type) && (
                                        <input
                                            type={f.type}
                                            placeholder={f.placeholder}
                                            min={f.type === "number" ? f.validation?.min : undefined}
                                            max={f.type === "number" ? f.validation?.max : undefined}
                                            className="w-full border rounded px-3 py-2 ..."
                                        />
                                    )}


                                    {/* TEXTAREA */}
                                    {f.type === "textarea" && (
                                        <textarea
                                            placeholder={f.placeholder}
                                            className="w-full border rounded px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                                        />
                                    )}

                                    {/* SELECT */}
                                    {f.type === "select" && (
                                        <select className="w-full border rounded px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600">
                                            <option value="">Please Select</option>
                                            {f.options?.map((o, i) => (
                                                <option key={i} value={o}>
                                                    {o}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {/* FILE */}
                                    {f.type === "file" && (
                                        <input
                                            type="file"
                                            className="w-full border rounded px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                                        />
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                className="bg-blue-600 text-white px-6 py-2 rounded"
                            >
                                Submit Application
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
