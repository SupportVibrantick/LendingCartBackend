import { useEffect, useState } from "react";
import { Trash2, Edit3 } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

export enum ApiFieldType {
    TEXT = "TEXT",
    TEXTAREA = "TEXTAREA",
    NUMBER = "NUMBER",
    EMAIL = "EMAIL",
    PHONE = "PHONE",
    PASSWORD = "PASSWORD",
    DATE = "DATE",
    TIME = "TIME",
    DATETIME = "DATETIME",

    SELECT = "SELECT",
    MULTI_SELECT = "MULTI_SELECT",
    RADIO = "RADIO",
    CHECKBOX = "CHECKBOX",
    CHECKBOX_GROUP = "CHECKBOX_GROUP",

    BOOLEAN = "BOOLEAN",
    TOGGLE = "TOGGLE",

    FILE = "FILE",
    FILE_MULTIPLE = "FILE_MULTIPLE",
    IMAGE = "IMAGE",

    CURRENCY = "CURRENCY",
    PERCENTAGE = "PERCENTAGE",
    SLIDER = "SLIDER",
    RANGE = "RANGE",
}

/* ================= TYPES ================= */

type FieldType = "text" | "number" | "email" | "textarea" | "select" | "file" | "radio" | "boolean" | "date" | "range" | "checkbox";

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

type ApiField = {
    id: string;
    label: string;
    fieldType: ApiFieldType;
    placeholder?: string | null;
    isRequired: boolean;
    options?: string[] | null;
    validation?: {
        min?: number;
        max?: number;
    };
};

type ApiSection = {
    id: string;
    name: string;
    description?: string;
    sortOrder: number;
    isActive: boolean;
    fields: ApiField[];
};

type ListFieldsResponse = {
    applicationId: string;
    productId: string;
    sections: ApiSection[];
    unsectionedFields: ApiField[];
};


function getAuthHeaders() {
    const token = sessionStorage.getItem("broker_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

// type Validation = {
//     min?: number;
//     max?: number;
// };

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



function mapApiFieldTypeToUI(type: ApiFieldType): FieldType {
    switch (type) {
        case ApiFieldType.TEXT:
        case ApiFieldType.PHONE:
        case ApiFieldType.PASSWORD:
            return "text";

        case ApiFieldType.EMAIL:
            return "email";

        case ApiFieldType.NUMBER:
        case ApiFieldType.CURRENCY:
        case ApiFieldType.PERCENTAGE:
            return "number";

        case ApiFieldType.TEXTAREA:
            return "textarea";

        case ApiFieldType.SELECT:
        case ApiFieldType.MULTI_SELECT:
            return "select";

        case ApiFieldType.RADIO:
            return "radio";

        case ApiFieldType.CHECKBOX_GROUP:
            return "checkbox";

        case ApiFieldType.CHECKBOX:
        case ApiFieldType.BOOLEAN:
        case ApiFieldType.TOGGLE:
            return "boolean";

        case ApiFieldType.DATE:
        case ApiFieldType.TIME:
        case ApiFieldType.DATETIME:
            return "date";

        case ApiFieldType.FILE:
        case ApiFieldType.FILE_MULTIPLE:
        case ApiFieldType.IMAGE:
            return "file";

        case ApiFieldType.RANGE:
        case ApiFieldType.SLIDER:
            return "range";

        default:
            return "text";
    }
}

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        console.error("RAW RESPONSE:", text);
        throw new Error("Server returned invalid response.");
    }
}

function renderDynamicField(
    field: ApiField,
    actions?: {
        onEdit?: (f: FormField) => void;
        onDelete?: (id: string) => void;
    }
) {
    const uiType = mapApiFieldTypeToUI(field.fieldType);

    return (
        <div className="flex justify-between items-center border p-2 rounded bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            {/* LEFT INFO */}
            <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                    {field.label}
                </div>
                <div className="text-xs text-slate-400">
                    {uiType}
                </div>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() =>
                        actions?.onEdit?.({
                            id: field.id,
                            type: uiType,
                            label: field.label,
                            placeholder: field.placeholder || "",
                            required: field.isRequired,
                            options: field.options || [],
                            validation: field.validation || {},
                        })
                    }
                    className="text-slate-600 hover:text-blue-600"
                >
                    <Edit3 size={16} />
                </button>

                <button
                    type="button"
                    onClick={() => actions?.onDelete?.(field.id)}
                    className="text-red-500 hover:text-red-600"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}

/* ================= PAGE ================= */

export default function ApplicationBuilder() {
    const [applications, setApplications] = useState<AppItem[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingSections, setLoadingSections] = useState(false);
    const [selectedSectionId, setSelectedSectionId] = useState("");

    const [optionsInput, setOptionsInput] = useState("");
    // const [minVal, setMinVal] = useState("");
    // const [maxVal, setMaxVal] = useState("");

    const [selectedAppId, setSelectedAppId] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");

    const [sections, setSections] = useState<ApiSection[]>([]);
    const [unsectionedFields, setUnsectionedFields] = useState<ApiField[]>([]);

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

    /* ================= LOAD FIELDS (SECTION-WISE) ================= */
    const loadFields = async (productId: string) => {
        try {
            const res = await fetch(
                `${API_BASE}/broker/applications/products/${productId}/fields`,
                { headers: getAuthHeaders() }
            );

            const json = await safeJson(res);
            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Failed to load fields");
            }

            const data: ListFieldsResponse = json.data;

            setSections(data.sections || []);

            setUnsectionedFields(data.unsectionedFields || []);

        } catch (err: any) {
            toast.error(err.message || "Failed to load fields");
        }
    };

    const loadSections = async (productId: string) => {
        try {
            setLoadingSections(true);
            setSections([]);
            setSelectedSectionId("");

            const res = await fetch(
                `${API_BASE}/broker/applications/products/${productId}/sections`,
                { headers: getAuthHeaders() }
            );

            const json = await safeJson(res);
            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Failed to load sections");
            }

            setSections(json.data || []);
        } catch (err: any) {
            toast.error(err.message || "Failed to load sections");
        } finally {
            setLoadingSections(false);
        }
    };

    useEffect(() => {
        if (selectedProductId) {
            loadSections(selectedProductId);
            loadFields(selectedProductId); // existing call
        }
    }, [selectedProductId]);

    useEffect(() => {
        loadApplications();
    }, []);

    useEffect(() => {
        if (selectedAppId) loadProducts(selectedAppId);
    }, [selectedAppId]);

    useEffect(() => {
        if (selectedProductId) loadFields(selectedProductId);
    }, [selectedProductId]);

    function mapUITypeToApi(type: FieldType): ApiFieldType {
        switch (type) {
            case "select":
                return ApiFieldType.SELECT;

            case "radio":
                return ApiFieldType.RADIO;

            case "checkbox":
                return ApiFieldType.CHECKBOX_GROUP; // ⭐ IMPORTANT

            case "boolean":
                return ApiFieldType.BOOLEAN;

            case "number":
                return ApiFieldType.NUMBER;

            case "email":
                return ApiFieldType.EMAIL;

            case "date":
                return ApiFieldType.DATE;

            case "file":
                return ApiFieldType.FILE;

            case "range":
                return ApiFieldType.RANGE;

            default:
                return ApiFieldType.TEXT;
        }
    }

    /* ================= SAVE FIELD API ================= */
    async function saveFieldToServer(field: FormField) {
        const payload: any = {
            sectionId: selectedSectionId,
            fieldKey: field.label
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^a-z0-9_]/g, ""),
            label: field.label,
            fieldType: mapUITypeToApi(field.type),
            isRequired: field.required,
        };

        if (["select", "radio", "checkbox"].includes(field.type)) {
            const opts = (field.options || []).filter(Boolean);

            if (opts.length === 0) {
                throw new Error("Options required for this field type");
            }

            payload.options = opts;
        }

        if (field.placeholder) payload.placeholder = field.placeholder;
        // if (field.type === "select") payload.options = (field.options || []).join(",");

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

        if (["select", "radio", "checkbox"].includes(form.type)) {
            finalOptions = optionsInput
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            if (finalOptions.length === 0) {
                toast.error("Please add at least one option");
                return;
            }
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
            options: ["select", "radio", "checkbox"].includes(form.type)
                ? finalOptions
                : [],
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

        if (["select", "radio", "checkbox"].includes(f.type)) {
            setOptionsInput((f.options || []).join(", "));
        }

        // if (f.type === "number") {
        //     setMinVal(f.validation?.min?.toString() || "");
        //     setMaxVal(f.validation?.max?.toString() || "");
        // }
    };

    const handleDelete = async (id: string) => {
        if (!id) {
            toast.error("Invalid field id");
            return;
        }

        const result = await Swal.fire({
            title: "Delete Field?",
            text: "This field will be permanently removed.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, delete it",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
        });

        if (!result.isConfirmed) return;

        try {
            const token = sessionStorage.getItem("broker_token");

            const res = await fetch(
                `${API_BASE}/broker/applications/fields/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const json = await res.json();

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Failed to delete field");
            }

            await Swal.fire({
                title: "Deleted!",
                text: "Field has been deleted successfully.",
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
            });

            // Reload fields list
            loadFields(selectedProductId);

        } catch (err: any) {
            console.error("Delete field error:", err);

            Swal.fire({
                title: "Error",
                text: err.message || "Failed to delete field",
                icon: "error",
            });
        }
    };


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

                {/* SECTION SELECT */}
                {selectedProductId && (
                    <select
                        className="w-full border rounded px-3 py-2 bg-white text-slate-900 border-slate-300
                   dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(e.target.value)}
                    >
                        <option value="">
                            {loadingSections ? "Loading sections..." : "Select Section (Optional)"}
                        </option>

                        {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
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
                            <option value="date">Date</option>
                            <option value="checkbox">checkbox</option>
                            <option value="radio">Radio</option>
                            <option value="range">Range</option>
                            {/* <option value="file">File Upload</option> */}
                        </select>

                        <input
                            className="w-full border rounded px-3 py-2 bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                            placeholder="Label"
                            value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                        />

                        {/* Required Toggle */}
                        <div className="flex items-center gap-3 mt-2">
                            <input
                                id="required"
                                type="checkbox"
                                checked={form.required}
                                onChange={(e) =>
                                    setForm({ ...form, required: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                                htmlFor="required"
                                className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                                Required Field
                            </label>
                        </div>


                        {/* Placeholder */}
                        {form.type !== "select" && form.type !== "file" && form.type !== "radio" && form.type !== "range" && form.type !== "date" && form.type !== "boolean" && form.type !== "checkbox" && (
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
                        {["select", "radio", "checkbox"].includes(form.type) && (
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

                        {/* ================= FIELD LIST (SECTION-WISE) ================= */}
                        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar border rounded-lg bg-yellow-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700">

                            {sections.map((section) => (
                                <div key={section.id} className="space-y-2">
                                    <h3 className="px-3 py-2 border-b text-sm font-semibold text-blue-900 dark:text-blue-300">
                                        {section.name}
                                    </h3>

                                    {section.fields.map((f) =>
                                        renderDynamicField(f, {
                                            onEdit: handleEdit,
                                            onDelete: handleDelete,
                                        })
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                            {/* UNSECTIONED FIELDS */}
                            {unsectionedFields.length > 0 && (
                                <div className="border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
                                    <div className="px-3 py-2 border-b text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                                        Unsectioned Fields
                                    </div>

                                    <div className="space-y-2 p-2">
                                        {unsectionedFields.map((f) => (
                                            <div
                                                key={f.id}
                                                className="flex justify-between items-center border p-2 rounded bg-white dark:bg-slate-900"
                                            >
                                                <div>
                                                    {f.label}
                                                    <div className="text-xs text-slate-400">
                                                        {mapApiFieldTypeToUI(f.fieldType)}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() =>
                                                            handleEdit({
                                                                id: f.id,
                                                                type: mapApiFieldTypeToUI(f.fieldType),
                                                                label: f.label,
                                                                placeholder: f.placeholder || "",
                                                                required: f.isRequired,
                                                                options: f.options || [],
                                                                validation: f.validation || {},
                                                            })
                                                        }
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(f.id)}
                                                        className="text-red-500"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ================= LIVE PREVIEW (SECTION-WISE) ================= */}
                    <form className="border rounded-xl p-5 space-y-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">

                        {sections.map((section) => (
                            <div key={section.id}>
                                <h3 className="text-sm font-semibold mb-4 text-slate-700 dark:text-slate-200">
                                    {section.name}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {section.fields.map((f) => {
                                        const uiType = mapApiFieldTypeToUI(f.fieldType);
                                        const isFullWidth = uiType === "range";

                                        return (
                                            <div
                                                key={f.id}
                                                className={isFullWidth ? "md:col-span-2" : ""}
                                            >
                                                <label className="block text-sm font-medium mb-2">
                                                    {f.label}
                                                    {f.isRequired && (
                                                        <span className="text-red-500 ml-1">*</span>
                                                    )}
                                                </label>

                                                {/* -------- RADIO -------- */}
                                                {uiType === "radio" && (
                                                    <div className="space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-800">
                                                        {f.options?.map((opt, i) => (
                                                            <label
                                                                key={i}
                                                                className="flex items-center gap-2 text-sm cursor-pointer"
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={f.id}
                                                                    className="accent-blue-600"
                                                                    readOnly
                                                                />
                                                                <span>{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* -------- CHECKBOX -------- */}
                                                {uiType === "checkbox" && (
                                                    <div className="space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-800">
                                                        {f.options?.map((opt, i) => (
                                                            <label
                                                                key={i}
                                                                className="flex items-center gap-2 text-sm cursor-pointer"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="accent-blue-600"
                                                                    readOnly
                                                                />
                                                                <span>{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* -------- SELECT -------- */}
                                                {uiType === "select" && (
                                                    <select
                                                        disabled
                                                        className="w-full rounded-lg border px-3 py-2 text-sm
               bg-white text-slate-900 border-slate-300
               dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                                                    >
                                                        <option value="">
                                                            {f.placeholder || "Select option"}
                                                        </option>

                                                        {f.options?.map((opt, i) => (
                                                            <option key={i}>{opt}</option>
                                                        ))}
                                                    </select>
                                                )}

                                                {/* -------- FILE -------- */}
                                                {uiType === "file" && (
                                                    <div className="w-full rounded-lg border px-3 py-2 text-sm
                  bg-slate-50 border-slate-300
                  dark:bg-slate-800 dark:border-slate-600">
                                                        <input
                                                            type="file"
                                                            disabled
                                                            className="w-full text-xs text-slate-500
                 file:mr-3 file:py-1 file:px-3
                 file:rounded file:border-0
                 file:bg-slate-200 file:text-slate-700
                 dark:file:bg-slate-700 dark:file:text-slate-200"
                                                        />
                                                    </div>
                                                )}

                                                {/* -------- TEXTAREA -------- */}
                                                {uiType === "textarea" && (
                                                    <textarea
                                                        rows={4}
                                                        readOnly
                                                        placeholder={f.placeholder || "Enter text"}
                                                        className="w-full rounded-lg border px-3 py-2 text-sm
               bg-white text-slate-900 border-slate-300
               dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600
               resize-none"
                                                    />
                                                )}



                                                {/* -------- RANGE (FIXED) -------- */}
                                                {uiType === "range" && (
                                                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800 space-y-3">
                                                        <input
                                                            type="range"
                                                            min={f.validation?.min ?? 0}
                                                            max={f.validation?.max ?? 100}
                                                            defaultValue={f.validation?.min ?? 0}
                                                            className="w-full accent-blue-600"
                                                        />

                                                        <div className="flex justify-between text-xs text-slate-500">
                                                            <span>Min: {f.validation?.min ?? 0}</span>
                                                            <span>Max: {f.validation?.max ?? 100}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* -------- BASIC INPUTS -------- */}
                                                {["text", "email", "number", "date"].includes(uiType) && (
                                                    <input
                                                        type={uiType}
                                                        readOnly
                                                        placeholder={f.placeholder || ""}
                                                        className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* -------- UNSECTIONED -------- */}
                        {/* -------- UNSECTIONED (FIXED) -------- */}
                        {unsectionedFields.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-4 text-slate-500">
                                    Other Information
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {unsectionedFields.map((f) => {
                                        const uiType = mapApiFieldTypeToUI(f.fieldType);
                                        const isFullWidth = uiType === "range";

                                        return (
                                            <div
                                                key={f.id}
                                                className={isFullWidth ? "md:col-span-2" : ""}
                                            >
                                                <label className="block text-sm font-medium mb-2">
                                                    {f.label}
                                                    {f.isRequired && (
                                                        <span className="text-red-500 ml-1">*</span>
                                                    )}
                                                </label>

                                                {/* RADIO */}
                                                {uiType === "radio" && (
                                                    <div className="space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-800">
                                                        {f.options?.map((opt, i) => (
                                                            <label key={i} className="flex items-center gap-2 text-sm">
                                                                <input type="radio" readOnly />
                                                                <span>{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* CHECKBOX */}
                                                {uiType === "checkbox" && (
                                                    <div className="space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-800">
                                                        {f.options?.map((opt, i) => (
                                                            <label key={i} className="flex items-center gap-2 text-sm">
                                                                <input type="checkbox" readOnly />
                                                                <span>{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* -------- SELECT -------- */}
                                                {uiType === "select" && (
                                                    <select
                                                        disabled
                                                        className="w-full rounded-lg border px-3 py-2 text-sm
               bg-white text-slate-900 border-slate-300
               dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                                                    >
                                                        <option value="">
                                                            {f.placeholder || "Select option"}
                                                        </option>

                                                        {f.options?.map((opt, i) => (
                                                            <option key={i}>{opt}</option>
                                                        ))}
                                                    </select>
                                                )}

                                                {/* -------- FILE -------- */}
                                                {uiType === "file" && (
                                                    <div className="w-full rounded-lg border px-3 py-2 text-sm
                  bg-slate-50 border-slate-300
                  dark:bg-slate-800 dark:border-slate-600">
                                                        <input
                                                            type="file"
                                                            disabled
                                                            className="w-full text-xs text-slate-500
                 file:mr-3 file:py-1 file:px-3
                 file:rounded file:border-0
                 file:bg-slate-200 file:text-slate-700
                 dark:file:bg-slate-700 dark:file:text-slate-200"
                                                        />
                                                    </div>
                                                )}

                                                {/* -------- TEXTAREA -------- */}
                                                {uiType === "textarea" && (
                                                    <textarea
                                                        rows={4}
                                                        readOnly
                                                        placeholder={f.placeholder || "Enter text"}
                                                        className="w-full rounded-lg border px-3 py-2 text-sm
               bg-white text-slate-900 border-slate-300
               dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600
               resize-none"
                                                    />
                                                )}


                                                {/* RANGE */}
                                                {uiType === "range" && (
                                                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800 space-y-3">
                                                        <input
                                                            type="range"
                                                            min={f.validation?.min ?? 0}
                                                            max={f.validation?.max ?? 100}
                                                            defaultValue={f.validation?.min ?? 0}
                                                            className="w-full accent-blue-600"
                                                        />
                                                        <div className="flex justify-between text-xs text-slate-500">
                                                            <span>{f.validation?.min ?? 0}</span>
                                                            <span>{f.validation?.max ?? 100}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* BASIC INPUT */}
                                                {["text", "email", "number", "date"].includes(uiType) && (
                                                    <input
                                                        type={uiType}
                                                        readOnly
                                                        placeholder={f.placeholder || ""}
                                                        className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-800"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </form>
                </div>
            )}
        </div>
    );
}
