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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function FindBroker() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 10, total: 0 });

  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

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
        { headers: getAuthHeaders() },
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

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Find <span className="text-[#3e86b7]">Brokers</span>
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Invite and manage brokers
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center justify-end gap-3">
          {/* Search */}
          <div className="relative">
            <input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Search by name or email"
              className="w-64 h-10 pl-9 pr-3 rounded-md border text-sm
      bg-white dark:bg-slate-800
      border-gray-300 dark:border-slate-600
      text-gray-800 dark:text-slate-100
      placeholder:text-gray-400
      focus:outline-none focus:ring-2 focus:ring-[#3e86b7]/30 focus:border-[#3e86b7]"
            />

            {/* Search Icon */}
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Page Size */}
          <select
            value={limit}
            onChange={(e) => {
              setPage(1);
              setLimit(Number(e.target.value));
            }}
            className="h-10 w-28 px-2 rounded-md border text-sm
    bg-white dark:bg-slate-800
    border-gray-300 dark:border-slate-600
    text-gray-800 dark:text-slate-100
    focus:outline-none focus:ring-2 focus:ring-[#3e86b7]/30 focus:border-[#3e86b7]"
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
            className="flex items-center justify-center
    w-10 h-10 rounded-md border
    bg-white dark:bg-slate-800
    border-gray-300 dark:border-slate-600
    hover:bg-gray-100 dark:hover:bg-slate-700
    transition disabled:opacity-50"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
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
                    <td className="p-4">{b.email}</td>
                    <td className="p-4">
                      <button
                        onClick={() => inviteBroker(b.id)}
                        disabled={invitingId === b.id}
                        className="inline-flex items-center gap-2
    px-4 py-2 rounded-md text-sm font-medium
    bg-[#3e86b7] text-white hover:bg-[#2e6f99]
    transition disabled:opacity-60 disabled:cursor-not-allowed"
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
        <div className="mt-6 flex items-center justify-between border-t pt-4 dark:border-slate-700">
          {/* Showing info */}
          <div className="text-sm text-gray-500 dark:text-slate-400">
            Showing{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {(meta.page - 1) * meta.limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {Math.min(meta.page * meta.limit, meta.total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {meta.total}
            </span>{" "}
            brokers
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Prev */}
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded-md border text-sm
        border-gray-300 bg-white text-gray-800
        hover:bg-gray-50
        dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100
        disabled:opacity-40"
            >
              Prev
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;

              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-md text-sm border
            ${
              page === p
                ? "bg-[#3e86b7] text-white border-[#3e86b7]"
                : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            }`}
                >
                  {p}
                </button>
              );
            })}

            {/* Next */}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-md border text-sm
        border-gray-300 bg-white text-gray-800
        hover:bg-gray-50
        dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100
        disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
