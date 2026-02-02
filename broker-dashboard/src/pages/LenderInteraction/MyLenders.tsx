import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Broker = {
  id: string;
  profileImage?: string | null;
  name: string;
  email: string;
  phone: string;
  brokerStatus: "ACTIVE" | "INACTIVE";
  connectionStatus: "CONNECTED" | "PENDING" | "DISABLED";
  source: string;
  assignedAt: string;
};

/* ================= HELPERS ================= */

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

// function getInitialAvatar(name: string) {
//   const letter = name?.charAt(0)?.toUpperCase() || "?";

//   const colors = [
//     "bg-red-500",
//     "bg-green-500",
//     "bg-blue-500",
//     "bg-purple-500",
//     "bg-pink-500",
//     "bg-orange-500",
//     "bg-teal-500",
//     "bg-indigo-500",
//   ];

//   const color = colors[name.charCodeAt(0) % colors.length];

//   return { letter, color };
// }

/* ================= PAGE ================= */

export default function MyLenders() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  // const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  /* ================= FETCH API ================= */

  useEffect(() => {
    fetchConnectedLenders();
  }, []);

  async function fetchConnectedLenders() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/broker/lenders/connected`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load lenders");
      }

      const mapped: Broker[] = (json.data || []).map((l: any) => ({
        id: l.lenderId,
        profileImage: null,
        name: l.lenderName,
        email: l.lenderEmail,
        phone: "",
        brokerStatus: "ACTIVE",
        connectionStatus: "CONNECTED",
        source: "API",
        assignedAt: l.connectedAt,
      }));

      setBrokers(mapped);
    } catch (err: any) {
      console.error(err);
      Swal.fire("Error", err.message || "Failed to load lenders", "error");
      setBrokers([]);
    } finally {
      setLoading(false);
    }
  }

  /* ================= SEARCH ================= */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brokers;
    return brokers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q)
    );
  }, [brokers, search]);

  /* ================= PAGINATION ================= */

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  const isSearchEmpty = search.trim() !== "" && filtered.length === 0;
  const isTotalEmpty = brokers.length === 0;

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Lenders</h1>
        </div>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lender..."
            className="px-3 py-2 border rounded-md text-sm
              bg-white border-gray-300
              dark:bg-slate-800 dark:border-slate-600"
          />
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-2 border rounded-md text-sm
              bg-white border-gray-300
              dark:bg-slate-800 dark:border-slate-600"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl p-4 dark:bg-slate-900 dark:border-slate-700">
        {loading ? (
          (
            <div className="p-4 animate-pulse">
              {/* Header skeleton */}
              <div className="grid grid-cols-4 gap-4 pb-3 border-b border-slate-200 dark:border-slate-700 text-xs uppercase">
                <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700"></div>
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700"></div>
                <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700"></div>
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700"></div>
              </div>

              {/* Rows skeleton */}
              <div className="space-y-4 mt-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="grid grid-cols-4 gap-4 items-center py-3 border-b border-slate-100 dark:border-slate-800"
                  >
                    {/* Avatar */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    </div>

                    {/* Name */}
                    <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700"></div>

                    {/* Email */}
                    <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-700"></div>

                    {/* Date */}
                    <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700"></div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : isTotalEmpty ? (
          /* ================= NO LENDERS AT ALL ================= */
          <div className="py-14 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">

            {/* Icon */}
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                  d="M12 4c4.418 0 8 1.79 8 4v8c0 2.21-3.582 4-8 4s-8-1.79-8-4V8c0-2.21 3.582-4 8-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                  d="M4 8c0 2.21 3.582 4 8 4s8-1.79 8-4" />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              No Lenders Connected Yet
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              You haven’t connected any lenders yet. Once lenders are added, they will appear here.
            </p>
          </div>

        ) : isSearchEmpty ? (
          /* ================= NO SEARCH RESULTS ================= */
          <div className="py-14 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">

            {/* Search Icon */}
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-4 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35m1.85-5.4a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              No Results Found
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              We couldn’t find any lenders matching <span className="font-medium">"{search}"</span>.
              Try a different keyword.
            </p>
          </div>

        )
          /* ================= TABLE ================= */
          : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-gray-500 dark:border-slate-700">
                  <th className="py-2 text-left">Profile</th>
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Connected At</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((b) => (
                  <tr key={b.id} className="border-b dark:border-slate-800">
                    <td className="py-3">
                      <img
                        src={b.profileImage ? `${API_BASE}/public${b.profileImage}` : "/circle_logo.png"}
                        onError={(e: any) => {
                          e.currentTarget.src = "/circle_logo.png";
                        }}
                        className="h-12 w-12 rounded-full object-cover ring-4 ring-slate-50 dark:ring-slate-800 shadow-inner"
                      />
                    </td>

                    <td>{b.name}</td>
                    <td>{b.email}</td>

                    <td>
                      {new Date(b.assignedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
