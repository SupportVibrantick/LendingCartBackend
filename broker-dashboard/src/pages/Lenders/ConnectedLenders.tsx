import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

type ConnectedLender = {
  lenderId: string;
  lenderName: string;
  lenderEmail: string;
  connectedAt: string;
  profileUrl?: string | null;
};

// const DUMMY_LENDERS: ConnectedLender[] = [
//   {
//     lenderId: "c8a9c07f-9c6f-4349-b2ec-61f68b99cd2a",
//     lenderName: "Testing Finance",
//     lenderEmail: "testingfinance@gmail.com",
//     connectedAt: "2026-01-08T07:51:31.439Z",
//     profileUrl: null,
//   },
//   {
//     lenderId: "77b5f3e3-7316-4619-82fe-d9c9a350cd2e",
//     lenderName: "Asian Lenders",
//     lenderEmail: "asianlenders@gmail.com",
//     connectedAt: "2025-12-30T07:11:51.279Z",
//     profileUrl: null,
//   },
//   {
//     lenderId: "4008dae6-c636-4bfd-a7b1-b8b667ab6bb8",
//     lenderName: "HelloHola Capital",
//     lenderEmail: "hello12@gmail.com",
//     connectedAt: "2025-12-04T05:48:42.335Z",
//     profileUrl: null,
//   },
//   {
//     lenderId: "9aa1dae6-c636-4bfd-a7b1-b8b667ab1234",
//     lenderName: "Prime Finance",
//     lenderEmail: "prime@finance.com",
//     connectedAt: "2025-11-21T10:22:11.100Z",
//     profileUrl: null,
//   },
// ];

/* ---------------- Skeleton Loader ---------------- */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 items-center">
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="h-4 rounded bg-gray-200 dark:bg-slate-700" />
            <div className="h-4 rounded bg-gray-200 dark:bg-slate-700" />
            <div className="h-4 rounded bg-gray-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConnectedLendersTable() {
  const [lenders, setLenders] = useState<ConnectedLender[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- SEARCH + PAGINATION ---------------- */
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchLenders();
  }, []);

  async function fetchLenders() {
    setLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(`${API_BASE}/broker/lenders/connected`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load connected lenders");
      }

      setLenders(Array.isArray(json.data) ? json.data : []);
      // setLenders(DUMMY_LENDERS);
    } catch (err: any) {
      console.error("FETCH LENDERS ERROR:", err);
      setError(err.message || "Failed to fetch lenders");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- FILTER ---------------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lenders;
    return lenders.filter(
      (l) =>
        l.lenderName.toLowerCase().includes(q) ||
        l.lenderEmail.toLowerCase().includes(q) ||
        l.lenderId.toLowerCase().includes(q),
    );
  }, [lenders, query]);

  /* ---------------- PAGINATION ---------------- */
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function gotoPage(p: number) {
    if (p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    setCurrentPage(p);
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header + Right Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            Connected Lenders
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            All lenders currently connected to your account
          </p>
        </div>

        {/* Right Controls */}
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
            No connected lenders found.
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
                    <th className="px-4 py-3">Connected On</th>
                  </tr>
                </thead>

                <tbody>
                  {paginated.map((l) => {
                    const avatar =
                      l.profileUrl ||
                      `https://ui-avatars.com/api/?background=2563eb&color=fff&name=${encodeURIComponent(
                        l.lenderName || "User",
                      )}`;

                    return (
                      <tr
                        key={l.lenderId}
                        className="border-b last:border-0 border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-3">
                          <img
                            src={avatar}
                            alt={l.lenderName}
                            className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {l.lenderName}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                          {l.lenderEmail}
                        </td>

                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                          {new Date(l.connectedAt).toLocaleDateString("en-IN")}{" "}
                          <span className="text-xs">
                            {new Date(l.connectedAt).toLocaleTimeString(
                              "en-IN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )}
                          </span>
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
