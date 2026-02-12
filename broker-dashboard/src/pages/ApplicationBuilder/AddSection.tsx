import React, { useCallback, useEffect, useState } from "react";
import { Loader2, PlusCircle } from "lucide-react";

import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type AppItem = {
    id: string;
    name: string;
    isActive: boolean;
};

type ProductItem = {
    id: string;
    loanProductCode: string;
};

type SectionField = {
    id: string;
    fieldKey: string;
    label: string;
    placeholder: string;
    fieldType: string;
    isRequired: boolean;
};

type ApplicationSection = {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    fields: SectionField[];
};

type ApiResponse<T> = {
    success: boolean;
    data: T;
    message?: string;
};

/* ================= AUTH ================= */

function getAuthHeaders(): HeadersInit {
    const token = sessionStorage.getItem("broker_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

async function safeJson<T>(res: Response): Promise<ApiResponse<T>> {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error("Invalid server response");
    }
}

/* ================= PAGE ================= */

const AddSectionAdmin: React.FC = () => {
    const [applications, setApplications] = useState<AppItem[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    // const [sections, setSections] = useState<ApplicationSection[]>([]);
    const [selectedSection, setSelectedSection] = useState<ApplicationSection | null>(null);
    const [showModal, setShowModal] = useState(false);

    const [selectedAppId, setSelectedAppId] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [sortOrder, setSortOrder] = useState<number>(1);

    const [loadingApps, setLoadingApps] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    // const [loadingSections, setLoadingSections] = useState(false);
    const [saving, setSaving] = useState(false);

    // ===== TABLE FILTER STATES =====
    const [tableApplications, setTableApplications] = useState<AppItem[]>([]);
    const [tableProducts, setTableProducts] = useState<ProductItem[]>([]);
    const [tableSections, setTableSections] = useState<ApplicationSection[]>([]);

    const [tableAppId, setTableAppId] = useState("");
    const [tableProductId, setTableProductId] = useState("");

    const [loadingTableApps, setLoadingTableApps] = useState(false);
    const [loadingTableProducts, setLoadingTableProducts] = useState(false);
    const [loadingTableSections, setLoadingTableSections] = useState(false);


    /* ================= LOAD APPLICATIONS ================= */

    const loadApplications = useCallback(async () => {
        try {
            setLoadingApps(true);
            const res = await fetch(`${API_BASE}/broker/applications`, {
                headers: getAuthHeaders(),
            });
            const json = await safeJson<AppItem[]>(res);
            if (!res.ok || !json.success) throw new Error(json.message);
            setApplications(json.data);
        } catch (err: any) {
            toast.error(err.message || "Failed to load applications");
        } finally {
            setLoadingApps(false);
        }
    }, []);

    /* ================= LOAD PRODUCTS ================= */

    const loadProducts = useCallback(async (appId: string) => {
        try {
            setLoadingProducts(true);
            setProducts([]);
            setSelectedProductId("");

            const res = await fetch(
                `${API_BASE}/broker/applications/${appId}/products`,
                { headers: getAuthHeaders() }
            );
            const json = await safeJson<ProductItem[]>(res);
            if (!res.ok || !json.success) throw new Error(json.message);
            setProducts(json.data);
        } catch (err: any) {
            toast.error(err.message || "Failed to load products");
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    /* ================= LOAD SECTIONS ================= */

    // const loadSections = useCallback(async (productId: string) => {
    //     if (!productId) return;
    //     try {
    //         setLoadingSections(true);
    //         const res = await fetch(
    //             `${API_BASE}/broker/applications/products/${productId}/sections`,
    //             { headers: getAuthHeaders() }
    //         );
    //         const json = await safeJson<ApplicationSection[]>(res);
    //         if (!res.ok || !json.success) throw new Error(json.message);
    //         setSections(json.data);
    //     } catch (err: any) {
    //         toast.error(err.message || "Failed to load sections");
    //     } finally {
    //         setLoadingSections(false);
    //     }
    // }, []);

    const loadTableApplications = useCallback(async () => {
        try {
            setLoadingTableApps(true);
            const res = await fetch(`${API_BASE}/broker/applications`, {
                headers: getAuthHeaders(),
            });
            const json = await safeJson<AppItem[]>(res);
            if (!res.ok || !json.success) throw new Error(json.message);
            setTableApplications(json.data);
        } catch (e: any) {
            toast.error(e.message || "Failed to load applications");
        } finally {
            setLoadingTableApps(false);
        }
    }, []);

    const loadTableProducts = useCallback(async (appId: string) => {
        try {
            setLoadingTableProducts(true);
            setTableProducts([]);
            setTableProductId("");

            const res = await fetch(
                `${API_BASE}/broker/applications/${appId}/products`,
                { headers: getAuthHeaders() }
            );
            const json = await safeJson<ProductItem[]>(res);
            if (!res.ok || !json.success) throw new Error(json.message);
            setTableProducts(json.data);
        } catch (e: any) {
            toast.error(e.message || "Failed to load products");
        } finally {
            setLoadingTableProducts(false);
        }
    }, []);

    const loadTableSections = useCallback(async (productId: string) => {
        if (!productId) return;
        try {
            setLoadingTableSections(true);
            const res = await fetch(
                `${API_BASE}/broker/applications/products/${productId}/sections`,
                { headers: getAuthHeaders() }
            );
            const json = await safeJson<ApplicationSection[]>(res);
            if (!res.ok || !json.success) throw new Error(json.message);
            setTableSections(json.data);
        } catch (e: any) {
            toast.error(e.message || "Failed to load sections");
        } finally {
            setLoadingTableSections(false);
        }
    }, []);

    /* ================= EFFECTS ================= */

    useEffect(() => {
        loadApplications();
    }, [loadApplications]);

    useEffect(() => {
        if (selectedAppId) {
            loadProducts(selectedAppId);
        } else {
            setProducts([]);
            setSelectedProductId("");
            // setSections([]);
        }
    }, [selectedAppId, loadProducts]);

    // useEffect(() => {
    //     if (selectedProductId) {
    //         loadSections(selectedProductId);
    //     } else {
    //         setSections([]);
    //     }
    // }, [selectedProductId, loadSections]);

    useEffect(() => {
        loadTableApplications();
    }, [loadTableApplications]);

    useEffect(() => {
        if (tableAppId) {
            loadTableProducts(tableAppId);
        } else {
            setTableProducts([]);
            setTableProductId("");
            setTableSections([]);
        }
    }, [tableAppId, loadTableProducts]);

    useEffect(() => {
        if (tableProductId) {
            loadTableSections(tableProductId);
        } else {
            setTableSections([]);
        }
    }, [tableProductId, loadTableSections]);


    /* ================= SUBMIT ================= */

    const handleSubmit = async () => {
        if (!selectedProductId || !name.trim()) {
            toast.error("Please fill all required fields");
            return;
        }

        try {
            setSaving(true);

            const res = await fetch(
                `${API_BASE}/broker/applications/products/${selectedProductId}/sections`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        name,
                        description,
                        sortOrder,
                    }),
                }
            );

            const json = await safeJson<ApplicationSection>(res);

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to create section");
            }

            toast.success("Section created successfully");

            setName("");
            setDescription("");
            setSortOrder(1);
        } catch (err: any) {
            toast.error(err.message || "Failed to create section");
        } finally {
            setSaving(false);
        }
    };

    /* ================= UI ================= */

    return (
        <div className="min-h-screen bg-gray-2 dark:bg-boxdark-2 py-10 px-6">

            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* LEFT – FORM (UNCHANGED UI) */}
                    <div>
                        <div className="bg-white dark:bg-[#0F172B] rounded-xl shadow-default border dark:border-slate-700 dark:border-strokedark p-8 space-y-6">
                            <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">
                                Add Application Sections
                            </h2>
                            <select
                                className="w-full rounded-lg border border-stroke bg-transparent px-5 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input dark:focus:border-primary"
                                value={selectedAppId}
                                onChange={(e) => setSelectedAppId(e.target.value)}
                            >
                                <option value="">
                                    {loadingApps ? "Loading..." : "Select Application"}
                                </option>
                                {applications.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>

                            {selectedAppId && (
                                <select
                                    className="w-full rounded-lg bg-transparent px-5 py-3 outline-none border dark:border-slate-700"
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                >
                                    <option value="">
                                        {loadingProducts ? "Loading..." : "Select Product"}
                                    </option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.loanProductCode}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Section Name"
                                className="w-full rounded-lg border border-stroke bg-transparent px-5 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input dark:focus:border-primary"
                            />

                            <textarea
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description"
                                className="w-full rounded-lg border border-stroke bg-transparent px-5 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input dark:focus:border-primary"
                            />

                            <input
                                type="number"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(Number(e.target.value))}
                                className="w-full rounded-lg border border-stroke bg-transparent px-5 py-3 outline-none focus:border-primary dark:border-strokedark dark:bg-form-input dark:focus:border-primary"
                            />

                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                                {saving ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                                Create Section
                            </button>
                        </div>
                    </div>

                    {/* RIGHT – TABLE */}
                    {/* ================= RIGHT – TABLE ================= */}
                    <div className="bg-white dark:bg-[#0F172B] rounded-xl shadow-default border border-stroke dark:border-strokedark p-6">
                        <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">
                            Application Sections
                        </h2>

                        {/* ===== TABLE SELECT BOXES ===== */}
                        <div className="space-y-3 mb-6">
                            <select
                                className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-900 dark:text-white"
                                value={tableAppId}
                                onChange={(e) => setTableAppId(e.target.value)}
                            >
                                <option value="">
                                    {loadingTableApps ? "Loading applications..." : "Select Application"}
                                </option>
                                {tableApplications.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-slate-900 dark:text-white"
                                value={tableProductId}
                                onChange={(e) => setTableProductId(e.target.value)}
                                disabled={!tableAppId}
                            >
                                <option value="">
                                    {loadingTableProducts ? "Loading products..." : "Select Product"}
                                </option>
                                {tableProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.loanProductCode}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ===== TABLE ===== */}
                        {loadingTableSections ? (
                            <div className="flex items-center gap-2 text-slate-500 dark:text-white">
                                <Loader2 className="animate-spin" size={16} />
                                Loading sections...
                            </div>
                        ) : (
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-2 dark:bg-meta-4">
                                        <th className="px-4 py-3 text-left font-medium text-black dark:text-white border border-stroke dark:border-strokedark">Name</th>
                                        <th className="px-4 py-3 text-left font-medium text-black dark:text-white border border-stroke dark:border-strokedark">Description</th>
                                        <th className="px-4 py-3 text-left font-medium text-black dark:text-white border border-stroke dark:border-strokedark">Active</th>
                                        <th className="px-4 py-3 text-left font-medium text-black dark:text-white border border-stroke dark:border-strokedark">Details</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {tableSections.map((s) => (
                                        <tr key={s.id} className="border-b border-stroke dark:border-strokedark hover:bg-gray-1 dark:hover:bg-meta-4">
                                            <td className="px-4 py-3 text-black dark:text-white">{s.name}</td>
                                            <td className="px-4 py-3 text-body dark:text-white">
                                                {s.description || "-"}
                                            </td>
                                            <td className="p-2 border">
                                                {s.isActive ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Yes</span>
                                                ) : (
                                                    <span className="text-red-600 dark:text-red-400 font-semibold">No</span>
                                                )}
                                            </td>
                                            <td className="p-2 border text-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedSection(s);
                                                        setShowModal(true);
                                                    }}
                                                    className="text-slate-600 hover:text-indigo-600 text-lg"
                                                >
                                                    👁
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {tableSections.length === 0 && tableProductId && (
                                        <tr>
                                            <td colSpan={4} className="p-4 text-center text-slate-500">
                                                No sections found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
            {/* ================= SECTION DETAILS MODAL ================= */}
            {showModal && selectedSection && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-[700px] max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-6 relative">

                        {/* Close Button */}
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-3 right-4 text-xl text-slate-500 hover:text-red-500"
                        >
                            ✕
                        </button>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {selectedSection.name}
                        </h3>

                        {selectedSection.description && (
                            <p className="text-slate-500 dark:text-slate-400">
                                {selectedSection.description}
                            </p>
                        )}

                        <div className="space-y-4">
                            {selectedSection.fields.map((field) => (
                                <div
                                    key={field.id}
                                    className="border rounded-xl p-4 bg-slate-50 dark:bg-slate-800"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-white">
                                                {field.label}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Placeholder: {field?.placeholder?.trim() || `Enter ${field.label}`}
                                            </p>
                                        </div>

                                        <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                                            {field.fieldType}
                                        </span>
                                    </div>

                                    <div className="text-sm text-slate-600 dark:text-slate-300">
                                        Required:{" "}
                                        {field.isRequired ? (
                                            <span className="text-green-600 font-semibold">Yes</span>
                                        ) : (
                                            <span className="text-red-500 font-semibold">No</span>
                                        )}
                                    </div>

                                    {/* Show Options if exist */}
                                    {"options" in field && (field as any).options && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-slate-500 mb-1">
                                                Options:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {(field as any).options.map((opt: string, i: number) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-1 text-xs rounded-full bg-slate-200 dark:bg-slate-700"
                                                    >
                                                        {opt}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AddSectionAdmin;
