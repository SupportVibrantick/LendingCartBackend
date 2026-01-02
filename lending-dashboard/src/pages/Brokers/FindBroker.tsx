import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Send, RefreshCcw } from "lucide-react";

type Broker = {
    id: string;
    name: string;
    email: string;
};

type Meta = {
    page: number;
    limit: number;
    total: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export default function FindBroker() {
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [meta, setMeta] = useState<Meta>({ page: 1, limit: 10, total: 0 });

    const [loading, setLoading] = useState(false);
    const [invitingId, setInvitingId] = useState<string | null>(null);

    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    function getAuthHeaders(): HeadersInit {
        const token = sessionStorage.getItem("lender_token");
        return {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        };
    }

    // ================= FETCH =================
    useEffect(() => {
        fetchBrokers();
    }, [page, limit, q]);

    async function fetchBrokers() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                ...(q && { q }),
            });

            const res = await fetch(
                `${API_BASE}/lender/brokers/find?${params.toString()}`,
                { headers: getAuthHeaders() }
            );

            const json = await res.json();
            setBrokers(json.data || []);
            setMeta(json.meta);
        } catch {
            toast.error("Failed to load brokers");
        } finally {
            setLoading(false);
        }
    }

    // ================= INVITE =================
    async function inviteBroker(brokerId: string) {
        setInvitingId(brokerId);
        try {
            const res = await fetch(`${API_BASE}/lender/brokers/invite`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ brokerOrgId: brokerId }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            toast.success("Invite sent successfully");

            // remove invited broker from current page
            setBrokers((prev) => prev.filter((b) => b.id !== brokerId));
        } catch (e: any) {
            toast.error(e.message || "Invite failed");
        } finally {
            setInvitingId(null);
        }
    }

    const totalPages = Math.max(
        1,
        Math.ceil(meta.total / meta.limit)
    );

    return (
        <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
            {/* Title */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold">Find Brokers</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    Invite and manage brokers
                </p>
            </div>

            {/* Filters */}
            <div className="mb-6 rounded-xl border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
                <div className="flex justify-end gap-3">
                    <input
                        value={q}
                        onChange={(e) => {
                            setPage(1);
                            setQ(e.target.value);
                        }}
                        placeholder="Search by name or email"
                        className="w-64 px-3 py-2 border rounded
                        bg-white dark:bg-slate-800
                        border-gray-300 dark:border-slate-600"
                    />

                    <select
                        value={limit}
                        onChange={(e) => {
                            setPage(1);
                            setLimit(Number(e.target.value));
                        }}
                        className="w-28 px-2 py-2 border rounded
                        bg-white dark:bg-slate-800
                        border-gray-300 dark:border-slate-600"
                    >
                        <option value={5}>5 / page</option>
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={fetchBrokers}
                        disabled={loading}
                        title="Refresh"
                        className="inline-flex items-center justify-center
            w-10 h-10 rounded-md border
            bg-white dark:bg-slate-800
            border-gray-300 dark:border-slate-600
            hover:bg-gray-100 dark:hover:bg-slate-700
            disabled:opacity-50"
                    >
                        <RefreshCcw
                            size={18}
                            className={loading ? "animate-spin" : ""}
                        />
                    </button>
                </div>


                {/* Table */}
                <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 mt-4">
                    {loading ? (
                        <div className="p-8 space-y-3 animate-pulse">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="h-4 bg-gray-200 rounded dark:bg-slate-700"
                                />
                            ))}
                        </div>
                    ) : (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-slate-800">
                                <tr className="text-xs uppercase text-gray-500 dark:text-slate-400">
                                    <th className="p-4 text-left">Name</th>
                                    <th className="p-4 text-left">Email</th>
                                    <th className="p-4 text-left">Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {brokers.map((b) => (
                                    <tr key={b.id} className="border-t dark:border-slate-800">
                                        <td className="p-4 font-medium">{b.name}</td>
                                        <td className="p-4">
                                            {b.email}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => inviteBroker(b.id)}
                                                disabled={invitingId === b.id}
                                                className="inline-flex items-center gap-2
                                            px-4 py-2 rounded-md text-sm font-medium
                                            bg-[#2857FA] text-white hover:bg-blue-700
                                            disabled:opacity-60"
                                            >
                                                <Send size={16} />
                                                {invitingId === b.id ? "Inviting..." : "Invite"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {brokers.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={3} className="p-6 text-center text-gray-500">
                                            No brokers found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-3 py-1 border rounded disabled:opacity-40 dark:border-slate-700"
                    >
                        Prev
                    </button>

                    <span className="px-2 py-1 text-sm">
                        Page {meta.page} of {totalPages}
                    </span>

                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1 border rounded disabled:opacity-40 dark:border-slate-700"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
