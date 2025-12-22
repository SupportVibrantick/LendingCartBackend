// src/pages/LoanProducts/AllLoanProducts.tsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit } from "react-icons/md";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

type Document = {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    createdAt?: string;
};

type DocumentForm = {
    code: string;
    name: string;
    description: string;
};

// same as BrokersPage
function getAuthHeaders(): Record<string, string> {
    try {
        const token = sessionStorage.getItem("admin_token");
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

// tiny helper for status pill
function statusClass(status?: string) {
    switch ((status || "").toUpperCase()) {
        case "ACTIVE":
            return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
        case "INACTIVE":
            return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
        default:
            return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
    }
}

// keep options in sync with Prisma enum LoanProductCode
const LOAN_PRODUCT_CODES: { value: string; label: string }[] = [
    { value: "SBA", label: "SBA" },
    { value: "USDA", label: "USDA" },
    { value: "BRIDGE", label: "Bridge" },
    { value: "DSCR", label: "DSCR" },
    { value: "CONSTRUCTION", label: "Construction" },
    { value: "EQUIPMENT", label: "Equipment" },
    { value: "ASSET_BASED", label: "Asset Based" },
    { value: "AR_AP", label: "AR/AP" },
    { value: "PO_FINANCE", label: "PO Finance" },
];

const AllLoanProducts: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [saving, setSaving] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [form, setForm] = useState<DocumentForm>({
        code: "",
        name: "",
        description: "",
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
            code: "",
            name: "",
            description: "",
        });
    };

    // ===== API Calls =====
    const fetchDocuments = async () => {
        try {
            setLoadingList(true);

            const res = await fetch(`${API_BASE}/admin/document-types/read`, {
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
                id: String(p.id),
                code: p.code,
                name: p.name ?? "",
                description: p.description ?? "",
                isActive: Boolean(p.isActive),
                createdAt: p.createdAt ?? undefined,
            }));

            setDocuments(mapped);
        } catch (err) {
            console.error("Failed to load documents", err);
        } finally {
            setLoadingList(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.code || !form.name) {
            toast.error("Code and Name are required.");
            return;
        }

        try {
            setSaving(true);

            if (editingProductId) {
                // Update existing (backend uses PUT)
                const res = await fetch(
                    `${API_BASE}/admin/document-types/update`,
                    {
                        method: "PUT",
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            id: editingProductId,
                            name: form.name,
                            description: form.description || undefined,
                        }),
                    }
                );

                const json = await res.json();
                if (!res.ok || !json.success) {
                    console.error("Failed to update document:", json.message || res.status);
                    toast.error(json.message || "Failed to update document");
                    return;
                }
                toast.success("Document Updated");
            } else {
                // Create new
                const res = await fetch(`${API_BASE}/admin/document-types/create`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        code: form.code,
                        name: form.name,
                        description: form.description || undefined,
                    }),
                });

                const json = await res.json();
                if (!res.ok || !json.success) {
                    console.error("Failed to create document:", json.message || res.status);
                    toast.error(json.message || "Failed to create document");
                    return;
                }
                toast.success("Document Created")
            }

            await fetchDocuments();
            resetForm();
        } catch (err) {
            console.error("Error saving document", err);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (document: Document) => {
        setEditingProductId(document.id);
        setForm({
            code: document.code, // code not editable in backend, so field disabled
            name: document.name,
            description: document.description || "",
        });
    };

    const handleToggleStatus = async (document: Document) => {
  try {
    setTogglingId(document.id);

    const res = await fetch(
      `${API_BASE}/admin/document-types/status`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: document.id,
          isActive: !document.isActive,
        }),
      }
    );

    const json = await res.json();

    if (!res.ok || !json.success) {
      toast.error(json.message || "Failed to update document status");
      return;
    }

    await fetchDocuments();
    toast.success("Status Updated");
  } catch (err) {
    console.error("Failed to toggle document status", err);
  } finally {
    setTogglingId(null);
  }
};




    // ===== Effects =====
    useEffect(() => {
        fetchDocuments();
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
                        {/* Code */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                Document Code
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                value={form.code}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, code: e.target.value }))
                                }
                                disabled={!!editingProductId || saving}
                            >
                                <option value="">Select a code</option>
                                {LOAN_PRODUCT_CODES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            {editingProductId && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                    Code cannot be changed for existing products.
                                </p>
                            )}
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                value={form.name}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, name: e.target.value }))
                                }
                                placeholder="e.g. SBA Loan, DSCR Loan"
                                disabled={saving}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                Description
                            </label>
                            <textarea
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                                rows={3}
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, description: e.target.value }))
                                }
                                placeholder="Short description of this document"
                                disabled={saving}
                            />
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
                                    <th className="py-2 pr-4 text-left">Code</th>
                                    <th className="py-2 pr-4 text-left">Name</th>
                                    <th className="py-2 pr-4 text-left">Description</th>
                                    <th className="py-2 pr-4 text-left">Status</th>
                                    <th className="py-2 pr-4 text-left">Created</th>
                                    <th className="py-2 pr-4 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {loadingList ? (
                                    <tr>
                                        <td
                                            className="py-6 text-center text-gray-500 dark:text-slate-400"
                                            colSpan={6}
                                        >
                                            Loading products...
                                        </td>
                                    </tr>
                                ) : documents.length === 0 ? (
                                    <tr>
                                        <td
                                            className="py-6 text-center text-gray-500 dark:text-slate-400"
                                            colSpan={6}
                                        >
                                            No Documents found.
                                        </td>
                                    </tr>
                                ) : (
                                    documents.map((p) => (
                                        <tr
                                            key={p.id}
                                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                                        >
                                            <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                                                {p.code}
                                            </td>
                                            <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                                                {p.name}
                                            </td>
                                            <td className="py-3 pr-4 text-gray-600 dark:text-slate-300">
                                                {p.description || "-"}
                                            </td>

                                            {/* Clickable status pill */}
                                            <td className="py-3 pr-4 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!togglingId) {
                                                            handleToggleStatus(p);
                                                        }
                                                    }}
                                                    disabled={togglingId === p.id}
                                                    className={`inline-flex items-center px-3 py-1 rounded-full border text-xs cursor-pointer
                                      ${statusClass(
                                                        p.isActive ? "ACTIVE" : "INACTIVE"
                                                    )}
                                      disabled:opacity-60 disabled:cursor-not-allowed`}
                                                >
                                                    {togglingId === p.id
                                                        ? "Updating..."
                                                        : p.isActive
                                                            ? "ACTIVE"
                                                            : "INACTIVE"}
                                                </button>
                                            </td>

                                            <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                                                {formatDate(p.createdAt)}
                                            </td>

                                            <td className="py-3 pr-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(p)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100
                                       dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        <MdModeEdit />
                                                    </button>


                                                </div>
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
