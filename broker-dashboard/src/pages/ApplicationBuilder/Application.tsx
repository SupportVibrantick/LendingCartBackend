import { useState } from "react";
import { Trash2, Edit3 } from "lucide-react";

type FieldType = "text" | "number" | "email" | "textarea" | "select" | "file";

type FormField = {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    options?: string[]; // for select
};

export default function ApplicationBuilder() {
    const [fields, setFields] = useState<FormField[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<Omit<FormField, "id">>({
        type: "text",
        label: "",
        placeholder: "",
        required: false,
        options: [],
    });

    const resetForm = () => {
        setEditingId(null);
        setForm({
            type: "text",
            label: "",
            placeholder: "",
            required: false,
            options: [],
        });
    };

    const handleAddOrUpdate = () => {
        if (!form.label.trim()) return alert("Label is required");

        if (editingId) {
            setFields((prev) =>
                prev.map((f) => (f.id === editingId ? { ...f, ...form } : f))
            );
        } else {
            setFields((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    ...form,
                },
            ]);
        }

        resetForm();
    };

    const handleEdit = (f: FormField) => {
        setEditingId(f.id);
        setForm({
            type: f.type,
            label: f.label,
            placeholder: f.placeholder,
            required: f.required,
            options: f.options || [],
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Remove this field?")) return;
        setFields((prev) => prev.filter((f) => f.id !== id));
    };

    return (
        <div className="min-h-screen dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
            <h1 className="text-2xl font-bold mb-6">Application Form Builder</h1>

            <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6">
                {/* ================= LEFT: EDITOR ================= */}
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5 space-y-4">
                    <h2 className="text-lg font-semibold">
                        {editingId ? "Edit Field" : "Add Field"}
                    </h2>

                    {/* Field Type */}
                    <div>
                        <label className="text-sm">Field Type</label>
                        <select
                            className="w-full mt-1 border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
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
                    </div>

                    {/* Label */}
                    <div>
                        <label className="text-sm">Label</label>
                        <input
                            className="w-full mt-1 border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                            value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                            placeholder="e.g. Business Name"
                        />
                    </div>

                    {/* Placeholder */}
                    {form.type !== "select" && form.type !== "file" && (
                        <div>
                            <label className="text-sm">Placeholder</label>
                            <input
                                className="w-full mt-1 border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                                value={form.placeholder}
                                onChange={(e) =>
                                    setForm({ ...form, placeholder: e.target.value })
                                }
                                placeholder="Enter value..."
                            />
                        </div>
                    )}

                    {/* Dropdown Options */}
                    {form.type === "select" && (
                        <div>
                            <label className="text-sm">Options (comma separated)</label>
                            <input
                                className="w-full mt-1 border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                                value={form.options?.join(",") || ""}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        options: e.target.value.split(",").map((s) => s.trim()),
                                    })
                                }
                                placeholder="Yes,No,Maybe"
                            />
                        </div>
                    )}

                    {/* Required */}
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.required}
                            onChange={(e) =>
                                setForm({ ...form, required: e.target.checked })
                            }
                        />
                        Required field
                    </label>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleAddOrUpdate}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                        >
                            {editingId ? "Save Field" : "Add Field"}
                        </button>

                        {editingId && (
                            <button
                                onClick={resetForm}
                                className="text-sm underline text-slate-500"
                            >
                                Cancel
                            </button>
                        )}
                    </div>

                    {/* Field List */}
                    <div className="pt-4 border-t dark:border-slate-700">
                        <h3 className="text-sm font-semibold mb-2">Fields</h3>

                        <div className="pt-4 border-t dark:border-slate-700">
                            <h3 className="text-sm font-semibold mb-2">Fields</h3>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                {fields.length === 0 && (
                                    <div className="text-sm text-slate-400">No fields added yet</div>
                                )}

                                {fields.map((f) => (
                                    <div
                                        key={f.id}
                                        className="flex items-center justify-between border dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <div>
                                            {f.label}{" "}
                                            {f.required && <span className="text-red-500">*</span>}
                                            <div className="text-xs text-slate-400">{f.type}</div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(f)}
                                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(f.id)}
                                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* ================= RIGHT: PREVIEW ================= */}
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Live Preview</h2>

                    {fields.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                            <div className="h-14 w-14 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4">
                                {/* You can change icon */}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-7 w-7"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                            </div>

                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                No fields added yet
                            </h3>

                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                                Start building your form by adding fields from the left panel. They will appear here in real time.
                            </p>

                            <div className="mt-4 text-xs text-blue-600 dark:text-blue-400">
                                ← Use the left panel to add fields
                            </div>
                        </div>

                    ) : (
                        <form className="space-y-4">
                            {fields.map((f) => (
                                <div key={f.id}>
                                    <label className="block text-sm mb-1">
                                        {f.label}{" "}
                                        {f.required && <span className="text-red-500">*</span>}
                                    </label>

                                    {f.type === "textarea" && (
                                        <textarea
                                            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                                            placeholder={f.placeholder}
                                        />
                                    )}

                                    {f.type === "select" && (
                                        <select className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600">
                                            <option value="">Select</option>
                                            {f.options?.map((opt, i) => (
                                                <option key={i} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {["text", "number", "email"].includes(f.type) && (
                                        <input
                                            type={f.type}
                                            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                                            placeholder={f.placeholder}
                                        />
                                    )}
                                    {f.type === "file" && (
                                        <input
                                            type="file"
                                            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-600"
                                        />
                                    )}
                                </div>
                            ))}

                            <button
                                type="button"
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm"
                            >
                                Submit Application
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
