// src/pages/LoanProducts/AllLoanProducts.tsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit } from "react-icons/md";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

type Document = {
    id: string;
    name: string;
};

type Lender = {
    id: string;
    loanProductCode: string;
}

type DocumentForm = {
    lenderProductId: string;
    documentTypeId: string;

    isRequired?: boolean;

    minFiles: number;
    maxFiles: number;

    notes: string;
    sortOrder: number;
};

type DocumentConfig = {
    id: string;

    lenderProductId: string;
    lenderProductCode?: string;

    documentTypeId: string;
    documentName?: string;

    isRequired: boolean;

    minFiles: number;
    maxFiles: number;

    notes?: string;
    sortOrder?: number;

    createdAt?: string;
};

// same as BrokersPage
function getAuthHeaders(): Record<string, string> {
    try {
        const token = sessionStorage.getItem("lender_token");
        if (token) {
            return {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            };
        }
    } catch {
        /* ignore */
    }
    return { "Content-Type": "application/json" };
}


const AllLoanProducts: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [lenders, setLenders] = useState<Lender[]>([]);
    const [documentConfig, setDocumentConfig] = useState<DocumentConfig[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [form, setForm] = useState<DocumentForm>({
        lenderProductId: "",
        documentTypeId: "",
        isRequired: undefined,
        minFiles: 0,
        maxFiles: 0,
        notes: "",
        sortOrder: 0,
    });

    // ===== Helpers =====
    const formatDate = (value?: string) => {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleDateString();
    };

    const resetForm = () => {
        setEditingProductId(null);
        setForm({
            lenderProductId: "",
            documentTypeId: "",
            isRequired: undefined,
            minFiles: 0,
            maxFiles: 0,
            notes: "",
            sortOrder: 0,
        });
    };

    // ===== API Calls =====
    const fetchDocuments = async () => {
        try {
            setLoadingList(true);

            const res = await fetch(`${API_BASE}/document-types/active`, {
                method: "GET",
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                console.error("Failed to load documents:", res.status);
                return;
            }

            const json = await res.json();
            if (!json.success) {
                console.error("Failed to load documents:", json.message);
                toast.error(json.message || "Failed to load documents")
                return;
            }

            const items = (json.data || []) as any[];

            const mapped: Document[] = items.map((p) => ({
                id: p.id,
                name: p.name ?? "",
            }));

            setDocuments(mapped);
        } catch (err) {
            console.error("Failed to load documents", err);
        } finally {
            setLoadingList(false);
        }
    };

    const fetchLenderProducts = async () => {
        try {
            setLoadingList(true);
            const headers = getAuthHeaders();
            const res = await fetch(`${API_BASE}/lender/loan-products/list/`, {
                method: "GET",
                headers,
            });

            if (!res.ok) {
                console.error("Failed to load loan products:", res.status);
                return;
            }

            const json = await res.json();
            if (!json.success) {
                console.error("Failed to load loan products:", json.message);
                toast.error(json.message || "Failed to load loan products")
                return;
            }

            const items = (json.data || []) as any[];

            const mapped: Lender[] = items.map((p) => ({
                id: p.id,
                loanProductCode: String(p.loanProductCode),
            }));
            setLenders(mapped);
        } catch (err) {
            console.error("Failed to load lender products", err);
        } finally {
            setLoadingList(false);
        }
    };


    const fetchDocumentConfigs = async () => {
        try {
            setLoadingList(true);

            const res = await fetch(`${API_BASE}/lender/document-config/list`, {
                method: "GET",
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                toast.error(`Failed to load document configs (${res.status})`);
                return;
            }

            const json = await res.json();

            if (!json.success) {
                toast.error(json.message || "Failed to load document configs");
                return;
            }

            const items = Array.isArray(json.data) ? json.data : [];

            const mapped: DocumentConfig[] = items.map((p: any) => ({
                id: p.id,

                lenderProductId: p.lenderProductId,
                lenderProductCode: p.lenderProduct?.loanProductCode ?? "",

                documentTypeId: p.documentTypeId,
                documentName: p.documentType?.name ?? "",

                isRequired: Boolean(p.isRequired),

                minFiles: Number(p.minFiles ?? 0),
                maxFiles: Number(p.maxFiles ?? 0),

                notes: p.notes ?? "",
                sortOrder: p.sortOrder ?? 0,

                createdAt: p.createdAt,
            }));

            setDocumentConfig(mapped);
        } catch (err) {
            console.error("Failed to load document configs", err);
            toast.error("Something went wrong while loading document configs");
        } finally {
            setLoadingList(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.lenderProductId || !form.documentTypeId) {
            toast.error("Please select lender product and document");
            return;
        }

        try {
            setSaving(true);

            if (editingProductId) {
                const updatePayload = {
                    lenderProductId: form.lenderProductId,
                    documentTypeId: form.documentTypeId,

                    isRequired: form.isRequired,

                    minFiles: form.minFiles,
                    maxFiles: form.maxFiles,

                    notes: form.notes || undefined,
                    sortOrder: form.sortOrder,
                };

                const res = await fetch(
                    `${API_BASE}/lender/document-config/update/${editingProductId}`,
                    {
                        method: "PUT",
                        headers: getAuthHeaders(),
                        body: JSON.stringify(updatePayload),
                    }
                );

                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.message || "Failed to update document config");
                    return;
                }

                toast.success("Document config updated");

            } else {
                const createPayload = {
                    lenderProductId: form.lenderProductId,
                    documentTypeId: form.documentTypeId,
                    isRequired: form.isRequired === undefined ? false : form.isRequired
                };

                const res = await fetch(
                    `${API_BASE}/lender/document-config/create`,
                    {
                        method: "POST",
                        headers: getAuthHeaders(),
                        body: JSON.stringify(createPayload),
                    }
                );

                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.message || "Failed to create document config");
                    return;
                }

                toast.success("Document mapped successfully");
            }

            await fetchDocumentConfigs();
            resetForm();

        } catch (err) {
            console.error("Error saving document", err);
            toast.error("Something went wrong");
        } finally {
            setSaving(false);
        }
    };


    const handleEdit = (config: DocumentConfig) => {
        setEditingProductId(config.id);

        setForm({
            lenderProductId: config.lenderProductId,
            documentTypeId: config.documentTypeId,

            isRequired: config.isRequired,

            minFiles: config.minFiles,
            maxFiles: config.maxFiles,

            notes: config.notes || "",
            sortOrder: config.sortOrder ?? 0,
        });
    };


    // ===== Effects =====
    useEffect(() => {
        fetchDocuments();
        fetchLenderProducts();
        fetchDocumentConfigs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== UI =====
    return (
        <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
            {/* Heading */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        All Documents
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
                        Manage documents available on the platform.
                    </p>
                </div>
            </div>

            {/* 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
                {/* LEFT CARD – Create / Edit product */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {editingProductId ? "Edit Document" : "Add Document"}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Product Ids */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                Select Loan Product
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                value={form.lenderProductId}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, lenderProductId: e.target.value }))
                                }
                                disabled={!!editingProductId || saving}
                            >
                                <option value="">Select a loan product</option>
                                {lenders.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.loanProductCode}
                                    </option>
                                ))}
                            </select>
                            {editingProductId && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                    Code cannot be changed for existing products.
                                </p>
                            )}
                        </div>

                        {/* Document Ids */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                Select Document Name
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                value={form.documentTypeId}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, documentTypeId: e.target.value }))
                                }
                                disabled={!!editingProductId || saving}
                            >
                                <option value="">Select a document name</option>
                                {documents.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.name}
                                    </option>
                                ))}
                            </select>

                            {editingProductId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                        Min Files
                                    </label>
                                    <input
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                        type="number"
                                        value={form.minFiles}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, minFiles: Number(e.target.value) }))
                                        }
                                        placeholder="Enter min files"
                                        disabled={saving}
                                    />
                                </div>
                            )}

                            {editingProductId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                        Max Files
                                    </label>
                                    <input
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                        type="number"
                                        value={form.maxFiles}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, maxFiles: Number(e.target.value) }))
                                        }
                                        placeholder="Enter max files"
                                        disabled={saving}
                                    />
                                </div>
                            )}

                            {
                                editingProductId && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                            Notes
                                        </label>
                                        <textarea
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                            value={form.notes}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, notes: e.target.value }))
                                            }
                                            rows={2}
                                        />
                                    </div>
                                )
                            }

                            {
                                editingProductId && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                            Sort Order
                                        </label>
                                        <input
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                            type="number"
                                            value={form.sortOrder}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))
                                            }

                                        />
                                    </div>
                                )
                            }




                        </div>

                        {/* Is Mandatory */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                Is Mandatory
                            </label>

                            <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                value={form.isRequired === undefined ? "" : String(form.isRequired)}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        isRequired:
                                            e.target.value === ""
                                                ? undefined
                                                : e.target.value === "true",
                                    }))
                                }
                            >
                                <option value="">None</option>
                                <option value="true">Required</option>
                                <option value="false">Optional</option>
                            </select>
                            {editingProductId && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                    Code cannot be changed for existing products.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                           dark:bg-blue-500 dark:hover:bg-blue-600"
                            >
                                {saving
                                    ? editingProductId
                                        ? "Saving..."
                                        : "Creating..."
                                    : editingProductId
                                        ? "Save Changes"
                                        : "Create Document"}
                            </button>

                            {editingProductId && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    disabled={saving}
                                    className="text-xs text-gray-500 hover:text-gray-700 underline dark:text-slate-400 dark:hover:text-slate-200"
                                >
                                    Cancel edit
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* RIGHT CARD – Products table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                All Documents
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                                Platform-wide documents configured by Super Admin.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={fetchDocuments}
                            disabled={loadingList}
                            className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed
                         dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            {loadingList ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>

                    <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                                    <th className="py-2 pr-4 text-left">Loan Product</th>
                                    <th className="py-2 pr-4 text-left">Document</th>
                                    <th className="py-2 pr-4 text-left">Required</th>
                                    <th className="py-2 pr-4 text-left">Files</th>
                                    <th className="py-2 pr-4 text-left">Notes</th>
                                    <th className="py-2 pr-4 text-left">Created</th>
                                    <th className="py-2 pr-4 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {loadingList ? (
                                    <tr>
                                        <td colSpan={7} className="py-6 text-center text-gray-500 dark:text-slate-400">
                                            Loading document configs...
                                        </td>
                                    </tr>
                                ) : documentConfig.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-6 text-center text-gray-500 dark:text-slate-400">
                                            No document configs found.
                                        </td>
                                    </tr>
                                ) : (
                                    documentConfig.map((p) => (
                                        <tr
                                            key={p.id}
                                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                                        >
                                            {/* Loan Product */}
                                            <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                                                {p.lenderProductCode || "-"}
                                            </td>

                                            {/* Document Name */}
                                            <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                                                {p.documentName}
                                            </td>

                                            {/* Required / Optional */}
                                            <td className="py-3 pr-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-3 py-1 rounded-full border text-xs
                                                                                            ${p.isRequired
                                                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40"
                                                            : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-600/30 dark:text-slate-200 dark:border-slate-500"
                                                        }`}
                                                >
                                                    {p.isRequired ? "REQUIRED" : "OPTIONAL"}
                                                </span>
                                            </td>

                                            {/* Min / Max Files */}
                                            <td className="py-3 pr-4 text-gray-600 dark:text-slate-300 whitespace-nowrap">
                                                {p.minFiles || 0} – {p.maxFiles || 0}
                                            </td>

                                            {/* Notes */}
                                            <td className="py-3 pr-4 text-gray-600 dark:text-slate-300">
                                                {p.notes || "-"}
                                            </td>

                                            {/* Created */}
                                            <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                                                {formatDate(p.createdAt)}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 pr-4 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(p)} // 👈 optional edit
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100
                       dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                >
                                                    <MdModeEdit />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>

                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AllLoanProducts;
