import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

/* ------------------ TYPES ------------------ */
type LenderInvite = {
    inviteId: string;
    lenderId: string;
    lenderName: string;
    lenderEmail: string;
    invitedAt: string;
    profileUrl?: string | null;
};

// const DUMMY_INVITES: LenderInvite[] = [
//     { 
//         inviteId: "inv-1001",
//         lenderId: "len-9a8b7c",
//         lenderName: "Asian Lenders Pvt Ltd",
//         lenderEmail: "asianlenders@gmail.com",
//          invitedAt: "2026-01-08T07:51:31.439Z", 
//          profileUrl: null,
//           },
// ]

/* ------------------ SKELETON LOADER ------------------ */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="p-4">
            <div className="animate-pulse space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="grid grid-cols-5 gap-4 items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-slate-700" />
                        <div className="h-4 rounded bg-gray-200 dark:bg-slate-700" />
                        <div className="h-4 rounded bg-gray-200 dark:bg-slate-700" />
                        <div className="h-4 rounded bg-gray-200 dark:bg-slate-700" />
                        <div className="h-8 rounded bg-gray-200 dark:bg-slate-700" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ------------------ AVATAR HELPER ------------------ */
function getAvatar(name?: string, profileUrl?: string | null) {
    if (profileUrl && profileUrl.startsWith("http")) return profileUrl;
    const safeName = name && name.trim() ? name : "User";
    return `https://ui-avatars.com/api/?background=2563eb&color=fff&name=${encodeURIComponent(
        safeName
    )}`;
}

export default function LenderInvitesPage() {
    const [invites, setInvites] = useState<LenderInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /* ------------------ SEARCH + PAGINATION ------------------ */
    const [query, setQuery] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    /* ------------------ AUTH HEADERS ------------------ */
    function getAuthHeaders() {
        const token = sessionStorage.getItem("broker_token");
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }

    /* ------------------ FETCH INVITES ------------------ */
    async function fetchInvites() {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/broker/lenders/invites`, {
                method: "GET",
                headers: getAuthHeaders(),
            });

            const text = await res.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                console.error("INVALID JSON:", text);
                throw new Error("Server returned invalid response");
            }

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load invites");
            }

            const list: any[] = Array.isArray(json.data) ? json.data : [];

            const normalized: LenderInvite[] = list.map((i) => ({
                inviteId: String(i.inviteId),
                lenderId: String(i.lenderId),
                lenderName: i.lenderName || "Unknown",
                lenderEmail: i.lenderEmail || "-",
                invitedAt: i.invitedAt || new Date().toISOString(),
                profileUrl: i.profileUrl || null,
            }));

            setInvites(normalized);
            // setInvites(DUMMY_INVITES);
        } catch (err: any) {
            console.error("FETCH INVITES ERROR:", err);
            setError(err.message || "Failed to fetch invites");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchInvites();
    }, []);

    /* ------------------ FILTER ------------------ */
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return invites;
        return invites.filter(
            (i) =>
                i.lenderName.toLowerCase().includes(q) ||
                i.lenderEmail.toLowerCase().includes(q) ||
                i.lenderId.toLowerCase().includes(q)
        );
    }, [invites, query]);

    /* ------------------ PAGINATION ------------------ */
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        setCurrentPage(1);
    }, [query, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    function gotoPage(p: number) {
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        setCurrentPage(p);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /* ------------------ ACCEPT INVITE ------------------ */
    async function acceptInvite(inviteId: string) {
        setRowLoadingId(inviteId);
        const toastId = toast.loading("Accepting invite...");

        try {
            const res = await fetch(
                `${API_BASE}/broker/lenders/accept/${inviteId}`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({}),
                }
            );

            const json = await res.json().catch(() => ({}));

            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Failed to accept invite");
            }

            toast.success("Invite accepted!", { id: toastId });
            setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
        } catch (err: any) {
            console.error("ACCEPT ERROR:", err);
            toast.error(err.message || "Failed to accept invite", { id: toastId });
        } finally {
            setRowLoadingId(null);
        }
    }

    /* ------------------ REJECT INVITE ------------------ */
    async function rejectInvite(inviteId: string) {
        if (!window.confirm("Are you sure you want to reject this invite?")) return;

        setRowLoadingId(inviteId);
        const toastId = toast.loading("Rejecting invite...");

        try {
            const res = await fetch(
                `${API_BASE}/broker/lenders/reject/${inviteId}`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({}),
                }
            );

            const json = await res.json().catch(() => ({}));

            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Failed to reject invite");
            }

            toast.success("Invite rejected", { id: toastId });
            setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
        } catch (err: any) {
            console.error("REJECT ERROR:", err);
            toast.error(err.message || "Failed to reject invite", { id: toastId });
        } finally {
            setRowLoadingId(null);
        }
    }

    /* ------------------ UI ------------------ */
    return (
        <div className="p-4 sm:p-6 text-gray-900 dark:text-gray-100">

            {/* Header + Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold">
                        Lender Invites
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                        Invitations received from lenders
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        placeholder="Search..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="px-3 py-2 border rounded-md text-sm
                       border-gray-300 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    />

                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="px-2 py-2 border rounded-md text-sm
                       border-gray-300 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    >
                        <option value={5}>5 / page</option>
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                    </select>
                </div>
            </div>

            {/* Card */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">

                {loading ? (
                    <TableSkeleton rows={pageSize} />
                ) : error ? (
                    <div className="p-8 text-center text-red-600 dark:text-red-400">
                        {error}
                    </div>
                ) : paginated.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                        No invites found
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                        <th className="px-4 py-3">Profile</th>
                                        <th className="px-4 py-3">Lender</th>
                                        <th className="px-4 py-3">Email</th>
                                        <th className="px-4 py-3">Invited On</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {paginated.map((i) => {
                                        const isRowLoading = rowLoadingId === i.inviteId;
                                        const avatar = getAvatar(i.lenderName, i.profileUrl);

                                        return (
                                            <tr
                                                key={i.inviteId}
                                                className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                                            >
                                                <td className="px-4 py-3">
                                                    <img
                                                        src={avatar}
                                                        onError={(e) => {
                                                            (e.currentTarget as HTMLImageElement).src =
                                                                getAvatar("User");
                                                        }}
                                                        className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                                                    />
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{i.lenderName}</div>
                                                </td>

                                                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                                                    {i.lenderEmail}
                                                </td>

                                                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                                                    {new Date(i.invitedAt).toLocaleDateString("en-IN")}{" "}
                                                    {new Date(i.invitedAt).toLocaleTimeString("en-IN", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        hour12: true,
                                                    })}
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            disabled={isRowLoading}
                                                            onClick={() => acceptInvite(i.inviteId)}
                                                            className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                                                        >
                                                            {isRowLoading ? "..." : "Accept"}
                                                        </button>
                                                        <button
                                                            disabled={isRowLoading}
                                                            onClick={() => rejectInvite(i.inviteId)}
                                                            className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-between items-center p-4 text-sm text-gray-700 dark:text-slate-300">
                            <div>
                                Showing {(currentPage - 1) * pageSize + 1} -{" "}
                                {Math.min(currentPage * pageSize, total)} of {total}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => gotoPage(currentPage - 1)}
                                    className="px-3 py-1 border rounded disabled:opacity-40
                             border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                                >
                                    Prev
                                </button>

                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => gotoPage(currentPage + 1)}
                                    className="px-3 py-1 border rounded disabled:opacity-40
                             border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


