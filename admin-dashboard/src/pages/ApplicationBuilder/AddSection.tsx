import React, { useEffect, useState } from "react";
import { Layers, Loader2, PlusCircle } from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Broker = { id: string; name: string };

type AppItem = {
    id: string;
    name: string;
};

type ProductItem = {
    id: string;
    loanProductCode: string;
};

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

/* ================= PAGE ================= */

const AddSectionAdmin: React.FC = () => {
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [applications, setApplications] = useState<AppItem[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);

    const [selectedBrokerId, setSelectedBrokerId] = useState("");
    const [selectedAppId, setSelectedAppId] = useState("");
    const [productId, setProductId] = useState("");

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [sortOrder, setSortOrder] = useState(1);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    /* ================= LOAD BROKERS ================= */

    const fetchBrokers = async () => {
        try {
            const res = await fetch(`${API_BASE}/admin/brokers/read`, {
                headers: getAuthHeaders(),
            });
            const json = await safeJson(res);
            setBrokers(json.data || []);
        } catch {
            toast.error("Failed to load brokers");
        }
    };

    /* ================= LOAD APPLICATIONS ================= */

    const loadApplications = async (brokerId: string) => {
        try {
            const res = await fetch(
                `${API_BASE}/admin/applications?brokerOrgId=${brokerId}`,
                { headers: getAuthHeaders() }
            );
            const json = await safeJson(res);
            setApplications(json.data || []);
        } catch {
            toast.error("Failed to load applications");
        }
    };

    /* ================= LOAD PRODUCTS ================= */

    const loadProducts = async (appId: string) => {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_BASE}/admin/applications/${appId}/products?brokerOrgId=${selectedBrokerId}`,
                { headers: getAuthHeaders() }
            );
            const json = await safeJson(res);
            setProducts(json.data || []);
        } catch {
            toast.error("Failed to load products");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBrokers();
    }, []);

    useEffect(() => {
        if (selectedBrokerId) {
            loadApplications(selectedBrokerId);
        } else {
            setApplications([]);
            setProducts([]);
        }
        setSelectedAppId("");
        setProductId("");
    }, [selectedBrokerId]);

    useEffect(() => {
        if (selectedAppId) {
            loadProducts(selectedAppId);
        } else {
            setProducts([]);
            setProductId("");
        }
    }, [selectedAppId]);

    /* ================= SUBMIT ================= */

    const handleSubmit = async () => {
        if (!selectedBrokerId || !productId || !name.trim()) {
            toast.error("Please fill all required fields");
            return;
        }

        try {
            setSaving(true);

            const res = await fetch(
                `${API_BASE}/admin/applications/products/${productId}/sections`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        brokerOrgId: selectedBrokerId,
                        name,
                        description,
                        sortOrder: Number(sortOrder),
                    }),
                }
            );

            const json = await safeJson(res);

            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Failed to create section");
            }

            toast.success("Section created successfully");

            setName("");
            setDescription("");
            setSortOrder(1);
        } catch (e: any) {
            toast.error(e.message || "Failed to create section");
        } finally {
            setSaving(false);
        }
    };

    /* ================= UI ================= */

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 py-20 px-6">
            <div className="max-w-4xl mx-auto">

                {/* ===== Header ===== */}
                <div className="flex flex-col items-center mb-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
                        <Layers className="text-indigo-500" size={16} />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Add Section
                        </span>
                    </div>

                    <h1 className="text-4xl font-black mb-4 text-slate-900 dark:text-white">
                        Create{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                            Application Section
                        </span>
                    </h1>

                    <p className="text-slate-500 dark:text-slate-400">
                        Sections help group fields like "Personal Info", "Business Info", etc.
                    </p>
                </div>

                {/* ===== Card ===== */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">

                    {/* Broker */}
                    <select
                        className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 dark:text-white"
                        value={selectedBrokerId}
                        onChange={(e) => setSelectedBrokerId(e.target.value)}
                    >
                        {loading ? <option value="">Loading...</option> : <option value="">Select Broker</option>}
                        {!loading && brokers.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    {/* Application */}
                    {selectedBrokerId && (
                        <select
                            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 dark:text-white"
                            value={selectedAppId}
                            onChange={(e) => setSelectedAppId(e.target.value)}
                        >
                            {loading ? <option value="">Loading...</option> : <option value="">Select Application</option>}
                            {!loading && applications.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Product */}
                    {selectedAppId && (
                        <select
                            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 dark:text-white"
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                        >
                            {loading ? <option value="">Loading...</option> : <option value="">Select Product</option>}
                            {!loading && products.map((p) => (
                                <option key={p.id} value={p.id}>{p.loanProductCode}</option>
                            ))}
                        </select>
                    )}

                    {/* Section Name */}
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Section Name"
                        className="w-full rounded-xl border px-3 py-2 dark:text-white"
                    />

                    {/* Description */}
                    <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description"
                        className="w-full rounded-xl border px-3 py-2 dark:text-white"
                    />

                    {/* Sort Order */}
                    <input
                        type="number"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(Number(e.target.value))}
                        className="w-full rounded-xl border px-3 py-2 dark:text-white"
                    />

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        {saving ? <Loader2 className="animate-spin" /> : <PlusCircle size={18} />}
                        Create Section
                    </button>

                </div>
            </div>
        </div>
    );
};

export default AddSectionAdmin;
