import { useEffect, useMemo, useState } from "react";
import { Send, RefreshCcw, Search } from "lucide-react";

/* ================= TYPES ================= */

type Lender = {
  id: string;
  name: string;
  email: string;
};

type Meta = {
  page: number;
  limit: number;
  total: number;
};

/* ================= DUMMY DATA ================= */

const DUMMY_LENDERS: Lender[] = [
  { id: "1", name: "HDFC Bank", email: "support@hdfc.com" },
  { id: "2", name: "ICICI Bank", email: "contact@icici.com" },
  { id: "3", name: "Axis Finance", email: "hello@axisfinance.com" },
  { id: "4", name: "Bajaj Finserv", email: "support@bajajfinserv.in" },
  { id: "5", name: "Tata Capital", email: "info@tatacapital.com" },
  { id: "6", name: "Kotak Mahindra", email: "kotak@bank.com" },
  { id: "7", name: "Yes Bank", email: "yes@bank.com" },
  { id: "8", name: "IDFC First Bank", email: "idfc@bank.com" },
  { id: "9", name: "IndusInd Bank", email: "indus@bank.com" },
  { id: "10", name: "Piramal Finance", email: "piramal@finance.com" },
  { id: "11", name: "Aditya Birla Finance", email: "ab@finance.com" },
];

/* ================= PAGE ================= */

export default function FindLenders() {
  const [allLenders, setAllLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  /* ================= LOAD DUMMY DATA ================= */

  useEffect(() => {
    fakeFetch();
  }, []);

  function fakeFetch() {
    setLoading(true);
    setTimeout(() => {
      setAllLenders(DUMMY_LENDERS);
      setLoading(false);
    }, 500);
  }

  /* ================= SEARCH ================= */

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return allLenders;

    return allLenders.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.email.toLowerCase().includes(query)
    );
  }, [allLenders, q]);

  /* ================= PAGINATION ================= */

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const paginated = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [q, limit]);

  const meta: Meta = {
    page,
    limit,
    total,
  };

  /* ================= INVITE (FRONTEND ONLY) ================= */

  function inviteLender(lenderId: string) {
    setInvitingId(lenderId);

    setTimeout(() => {
      // remove invited lender from list
      setAllLenders((prev) => prev.filter((l) => l.id !== lenderId));
      setInvitingId(null);
    }, 600);
  }

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Title */}
      <div className="mb-6 rounded-xl p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border dark:border-slate-700">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-white">
          🏦 Find Lenders
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Discover, invite and grow your lender network
        </p>
      </div>


      {/* Filters */}
      <div className="mb-6 rounded-xl border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
        <div className="flex flex-wrap justify-end gap-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-2.5 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Search lenders by name or email"
              className="w-72 pl-10 pr-3 py-2 border rounded-lg
      bg-white dark:bg-slate-800
      border-gray-300 dark:border-slate-600
      focus:ring-2 focus:ring-blue-500 focus:outline-none
      transition"
            />
          </div>

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
            onClick={fakeFetch}
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
        <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 mt-4 overflow-hidden">
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
                  <th className="p-4 text-left">Lender Name</th>
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="p-4 font-medium">{b.name}</td>
                    <td className="p-4">{b.email}</td>
                    <td className="p-4">
                      <button
                        onClick={() => inviteLender(b.id)}
                        disabled={invitingId === b.id}
                        className="inline-flex items-center gap-2
  px-4 py-2 rounded-lg text-sm font-medium
  bg-[#2857FA] text-white
  hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02]
  transition-all
  disabled:opacity-60"
                      >
                        <Send size={16} />
                        {invitingId === b.id ? "Inviting..." : "Invite"}
                      </button>
                    </td>
                  </tr>
                ))}

                {paginated.length === 0 && !loading && (
                  <tr className="border-t dark:border-slate-800 
  hover:bg-blue-50/50 dark:hover:bg-slate-800/40 
  transition-colors">
                    <td colSpan={3} className="p-10 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-4xl">🏦</div>
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          No Lenders Found
                        </div>
                        <div className="text-sm text-slate-400">
                          All available lenders a
                          re already invited or none match your search.
                        </div>
                      </div>
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
