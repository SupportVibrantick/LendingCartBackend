import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Invite = {
    inviteId: string;
    brokerId: string;
    name: string;
    email: string;
    inviteStatus: "PENDING" | "ACCEPTED" | "REJECTED";
    invitedAt: string;
};

type Stats = {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export default function BrokerInvites() {
    const [invites, setInvites] = useState<Invite[]>([]);
    const [stats, setStats] = useState<Stats>({
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
    });
    const [loading, setLoading] = useState(false);

    function getAuthHeaders(): HeadersInit {
        const token = sessionStorage.getItem("lender_token");
        return {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        };
    }

    useEffect(() => {
        fetchInvites();
    }, []);

    async function fetchInvites() {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/lender/brokers/invites`, {
                headers: getAuthHeaders(),
            });
            const json = await res.json();

            setInvites(json.data || []);
            setStats(json.stats || {});
        } catch {
            toast.error("Failed to load broker requests");
        } finally {
            setLoading(false);
        }
    }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

    return (
        <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold">Invited Brokers</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    Manage broker invite requests
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Total", value: stats.total },
                    { label: "Pending", value: stats.pending },
                    { label: "Accepted", value: stats.accepted },
                    { label: "Rejected", value: stats.rejected },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="rounded-xl border p-4 bg-white
                        dark:bg-slate-900 dark:border-slate-700"
                    >
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            {s.label}
                        </p>
                        <p className="text-2xl font-semibold">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700">
                {loading ? (
                    <div className="p-8 space-y-3 animate-pulse">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="h-4 rounded bg-gray-200 dark:bg-slate-700"
                            />
                        ))}
                    </div>
                ) : (
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-slate-800">
                            <tr className="text-xs uppercase text-gray-500 dark:text-slate-400">
                                <th className="p-4 text-left">Name</th>
                                <th className="p-4 text-left">Email</th>
                                <th className="p-4 text-left">Status</th>
                                <th className="p-4 text-left">Invited At</th>
                            </tr>
                        </thead>

                        <tbody>
                            {invites.map((i) => (
                                <tr
                                    key={i.inviteId}
                                    className="border-t dark:border-slate-800"
                                >
                                    <td className="p-4 font-medium">{i.name}</td>
                                    <td className="p-4">
                                        {i.email}
                                    </td>

                                    <td className="p-4">
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs
                                            ${i.inviteStatus === "PENDING"
                                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300"
                                                    : i.inviteStatus === "ACCEPTED"
                                                        ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                                                        : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                                                }`}
                                        >
                                            {i.inviteStatus}
                                        </span>
                                    </td>

                                    <td className="p-4">
                                        {formatDateTime(i.invitedAt)}
                                    </td>

                                   
                                </tr>
                            ))}

                            {invites.length === 0 && !loading && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="p-6 text-center text-gray-500"
                                    >
                                        No broker requests found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
