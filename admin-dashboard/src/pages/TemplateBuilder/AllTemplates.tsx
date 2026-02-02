import React, { useEffect, useState } from "react";
import { Layers, LayoutTemplate, Loader2, X } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

interface Field {
    id: string;
    fieldKey: string;
    label: string;
    placeholder: string | null;
    fieldType: "TEXT" | "NUMBER" | "TEXTAREA" | "SELECT" | "FILE";
    isRequired: boolean;
    options: string | null;
    validation: { min?: number; max?: number } | null;
    sortOrder: number;
}

interface Product {
    id: string;
    loanProductCode: string;
    fields: Field[];
}

interface TemplateFull {
    id: string;
    name: string;
    code: string;
    description: string;
    version: number;
    isActive: boolean;
    products: Product[];
}

interface Template {
    id: string;
    name: string;
    code: string;
    description: string;
    version: number;
    isActive: boolean;
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

const parseOptions = (opt: string | null): string[] => {
    if (!opt) return [];
    return String(opt).split(",").map((s) => s.trim()).filter(Boolean);
};

/* ================= CARD ================= */

const TemplateCard: React.FC<{
    template: Template;
    onToggle: (id: string, next: boolean) => Promise<void>;
    onManage: (tpl: Template) => void;
}> = ({ template, onToggle, onManage }) => {
    const [toggling, setToggling] = useState(false);

    const handleToggle = async () => {
        if (toggling) return;
        setToggling(true);
        await onToggle(template.id, !template.isActive);
        setToggling(false);
    };

    return (
        <div
            className="group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-2 shadow-sm transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/40"
        >
              <div className="bg-slate-50 dark:bg-slate-800 rounded-[22px] p-6 h-full flex flex-col border border-transparent group-hover:border-white dark:group-hover:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-900 transition-all duration-500">
            <div className="flex justify-between items-start mb-6">
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                    Version v{template.version}
                </span>

                <button
                    onClick={handleToggle}
                    className={`text-xs px-3 py-1 rounded-full border ${template.isActive
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                        }`}
                >
                    {toggling && <Loader2 size={12} className="inline animate-spin mr-1" />}
                    {template.isActive ? "ACTIVE" : "INACTIVE"}
                </button>
            </div>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {template.name}
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {template.description}
            </p>

            <span className="text-xs font-mono border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                Code: {template.code}
            </span>

            <button
                onClick={() => onManage(template)}
                className="py-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 mt-5 w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-500"
            >
                Manage Template
            </button>
        </div>
        </div>
    );
};

/* ================= MODAL ================= */

const TemplateDetailsModal: React.FC<{
    templateId: string;
    onClose: () => void;
}> = ({ templateId, onClose }) => {
    const [data, setData] = useState<TemplateFull | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeProductId, setActiveProductId] = useState("");

    useEffect(() => {
        (async () => {
            const res = await fetch(`${API_BASE}/admin/applications/templates`, {
                headers: getAuthHeaders(),
            });
            const json = await safeJson(res);
            const tpl = json.data.find((x: any) => x.id === templateId);
            setData(tpl);
            if (tpl?.products?.length) setActiveProductId(tpl.products[0].id);
            setLoading(false);
        })();
    }, [templateId]);

    const activeProduct = data?.products.find((p) => p.id === activeProductId);

    return (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-lg flex items-center justify-center p-4" style={{ backdropFilter: "blur(12px)" }}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                            Template Preview
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Select product to preview form
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                        <X className="text-slate-600 dark:text-slate-300" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">

                    {loading && (
                        <div className="flex flex-col items-center py-20 text-slate-400">
                            <Loader2 className="animate-spin mb-3" />
                            Loading template details...
                        </div>
                    )}

                    {!loading && data && (
                        <>
                            <div className="mb-6 max-w-sm">
                                <select
                                    value={activeProductId}
                                    onChange={(e) => setActiveProductId(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                                >
                                    {data.products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.loanProductCode}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {!activeProduct || activeProduct.fields.length === 0 ? (
                                <div className="flex flex-col items-center py-16 border-2 border-dashed rounded-2xl border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                                    <Layers className="h-10 w-10 text-indigo-500 mb-3" />
                                    <div className="font-semibold text-slate-700 dark:text-slate-200">
                                        No fields configured
                                    </div>
                                </div>
                            ) : (
                                <div className="border rounded-xl p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                    <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
                                        Preview
                                    </h2>

                                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {activeProduct.fields
                                            .sort((a, b) => a.sortOrder - b.sortOrder)
                                            .map((f) => (
                                                <div key={f.id}>
                                                    <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">
                                                        {f.label}{" "}
                                                        {f.isRequired && <span className="text-red-500">*</span>}
                                                    </label>

                                                    {f.fieldType === "TEXT" && (
                                                        <input className="w-full border rounded px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                                                    )}

                                                    {f.fieldType === "NUMBER" && (
                                                        <input type="number" className="w-full border rounded px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                                                    )}

                                                    {f.fieldType === "TEXTAREA" && (
                                                        <textarea className="w-full border rounded px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                                                    )}

                                                    {f.fieldType === "FILE" && (
                                                        <input type="file" className="w-full border rounded px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400" />
                                                    )}

                                                    {f.fieldType === "SELECT" && (
                                                        <select className="w-full border rounded px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                                                            <option value="">Select</option>
                                                            {parseOptions(f.options).map((o, i) => (
                                                                <option key={i}>{o}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            ))}
                                    </form>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ================= PAGE ================= */

export default function AdminTemplateList() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

    const loadTemplates = async () => {
        const res = await fetch(`${API_BASE}/admin/applications/templates`, {
            headers: getAuthHeaders(),
        });
        const json = await safeJson(res);
        setTemplates(json.data || []);
    };

    const toggleTemplate = async (id: string, next: boolean) => {
        await fetch(`${API_BASE}/admin/applications/templates/${id}/status`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ isActive: next }),
        });
        loadTemplates();
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);

    return (
        <>
            <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-10">
                {/* Header */}
                <div className="flex flex-col items-center mb-16 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
                        <LayoutTemplate size={16} className="text-indigo-500" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Admin Templates
                        </span>
                    </div>

                    <h1 className="text-4xl font-black mb-4 text-slate-900 dark:text-white">
                        All{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                            Application Templates
                        </span>
                    </h1>

                    <p className="text-slate-500 dark:text-slate-400">
                        Manage and maintain all application templates.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {templates.map((t) => (
                        <TemplateCard
                            key={t.id}
                            template={t}
                            onToggle={toggleTemplate}
                            onManage={(tpl) => setSelectedTemplateId(tpl.id)}
                        />
                    ))}
                </div>
            </div>

            {selectedTemplateId && (
                <TemplateDetailsModal
                    templateId={selectedTemplateId}
                    onClose={() => setSelectedTemplateId(null)}
                />
            )}
        </>
    );
}
