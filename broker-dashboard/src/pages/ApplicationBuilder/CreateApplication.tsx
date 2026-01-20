import React, { useEffect, useState } from "react";
import { MdModeEdit } from "react-icons/md";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type AppItem = {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
};

function getAuthHeaders() {
    const token = sessionStorage.getItem("broker_token");
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
        throw new Error("Server returned invalid response. Please login again.");
    }
}

const CreateApplication: React.FC = () => {
    const [items, setItems] = useState<AppItem[]>([]);
    const [loading, setLoading] = useState(false);

    const [, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        isActive: true,
    });

    /* ================= LOAD LIST ================= */
    const loadApplications = async () => {
        try {
            setLoading(true);

            const res = await fetch(`${API_BASE}/broker/applications`, {
                headers: getAuthHeaders(),
            });

            const json = await safeJson(res);

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Failed to load applications");
            }

            setItems(json.data || []);
        } catch (err: any) {
            console.error("LOAD ERROR:", err);
            toast.error(err.message || "Failed to load applications");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadApplications();
    }, []);

    /* ================= CREATE ================= */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name.trim()) {
            toast.error("Application name is required");
            return;
        }

        const loadingToast = toast.loading("Creating application...");

        try {
            const res = await fetch(`${API_BASE}/broker/applications`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ name: form.name }),
            });

            const json = await safeJson(res);

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Create failed");
            }

            toast.success("Application created successfully");
            setForm({ name: "", isActive: true });

            loadApplications();
        } catch (err: any) {
            console.error("CREATE ERROR:", err);
            toast.error(err.message || "Could not create application");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    /* ================= EDIT ================= */
    const handleEdit = (item: AppItem) => {
        setEditingId(item.id);
        setForm({
            name: item.name,
            isActive: item.isActive,
        });
    };

    /* ================= TOGGLE STATUS ================= */
    const toggleStatus = async (e: React.MouseEvent, item: AppItem) => {
        e.preventDefault();

        const loadingToast = toast.loading("Updating status...");

        try {
            const res = await fetch(
                `${API_BASE}/broker/applications/${item.id}/status`,
                {
                    method: "PATCH",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ isActive: !item.isActive }),
                }
            );

            const json = await safeJson(res);

            if (!res.ok || json.success !== true) {
                throw new Error(json.message || "Status update failed");
            }

            toast.success(
                `Application ${!item.isActive ? "activated" : "deactivated"}`
            );

            loadApplications();
        } catch (err: any) {
            console.error("STATUS ERROR:", err);
            toast.error(err.message || "Could not update status");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    return (
        <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold dark:text-white">
                    Application Builder
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    Create & manage application flows
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
                {/* LEFT */}
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
                    <h2 className="text-lg font-semibold mb-4">
                        Create Application
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm mb-1">
                                Application Name
                            </label>
                            <input
                                className="w-full rounded-md border px-3 py-2 text-sm dark:bg-slate-800"
                                placeholder="e.g. Main Loan Application"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                            />
                        </div>

                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md"
                        >
                            Create Application
                        </button>
                    </form>
                </div>

                {/* RIGHT */}
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
                    <h2 className="text-lg font-semibold mb-4">Applications</h2>

                    {loading ? (
                        <div className="text-sm text-slate-400">Loading...</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b dark:border-slate-700 text-xs uppercase text-gray-500">
                                        <th className="py-2 text-left">Name</th>
                                        <th className="py-2 text-left">Status</th>
                                        <th className="py-2 text-right">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {items.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="border-b dark:border-slate-800"
                                        >
                                            <td className="py-3">
                                                {item.name}
                                            </td>

                                            <td className="py-3">
                                                <button
                                                    onClick={(e) =>
                                                        toggleStatus(e, item)
                                                    }
                                                    className={`px-3 py-1 rounded-full text-xs border ${item.isActive
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : "bg-gray-100 text-gray-700"
                                                        }`}
                                                >
                                                    {item.isActive
                                                        ? "ACTIVE"
                                                        : "INACTIVE"}
                                                </button>
                                            </td>

                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={() =>
                                                        handleEdit(item)
                                                    }
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                                                >
                                                    <MdModeEdit />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {items.length === 0 && (
                                <div className="text-sm text-slate-400 pt-4">
                                    No applications found
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateApplication;
