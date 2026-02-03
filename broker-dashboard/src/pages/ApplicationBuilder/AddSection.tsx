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
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 py-20 px-6">

            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* LEFT – FORM (UNCHANGED UI) */}
                    <div>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border p-8 space-y-6">
                            <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">
                                Add Application Sections
                            </h2>
                            <select
                                className="w-full rounded-xl border px-3 py-2"
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
                                    className="w-full rounded-xl border px-3 py-2"
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
                                className="w-full rounded-xl border px-3 py-2"
                            />

                            <textarea
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description"
                                className="w-full rounded-xl border px-3 py-2"
                            />

                            <input
                                type="number"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(Number(e.target.value))}
                                className="w-full rounded-xl border px-3 py-2"
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
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border p-6">
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
                            <div className="flex items-center gap-2 text-slate-500">
                                <Loader2 className="animate-spin" size={16} />
                                Loading sections...
                            </div>
                        ) : (
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800">
                                        <th className="p-2 text-left border">Name</th>
                                        <th className="p-2 text-left border">Description</th>
                                        <th className="p-2 text-left border">Active</th>
                                        <th className="p-2 text-center border">Details</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {tableSections.map((s) => (
                                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <td className="p-2 border font-medium">{s.name}</td>
                                            <td className="p-2 border text-slate-500">
                                                {s.description || "-"}
                                            </td>
                                            <td className="p-2 border">
                                                {s.isActive ? (
                                                    <span className="text-green-600 font-semibold">Yes</span>
                                                ) : (
                                                    <span className="text-red-500 font-semibold">No</span>
                                                )}
                                            </td>
                                            <td className="p-2 border text-center">
                                                {/* 👁 ACTION ICON – LOGIC LATER */}
                                                <button className="text-slate-600 hover:text-indigo-600">
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
        </div>
    );
};

export default AddSectionAdmin;
