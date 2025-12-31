import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";

type Broker = {
  id: string;
  profile?: string | null;
  name: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  assignedAt: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export default function BrokerList() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // search + pagination
  const [search, setSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  function getAuthHeaders(): HeadersInit {
    try {
      const token = sessionStorage.getItem("lender_token");
      if (token) {
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
      }
    } catch {
      /* ignore */
    }
    return { "Content-Type": "application/json" };
  }

  // ================= FETCH =================
  useEffect(() => {
    fetchBrokers();
  }, []);

  async function fetchBrokers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/lender/brokers/list`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      // ✅ handle both response styles
      const list = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json)
          ? json
          : [];

      setBrokers(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load brokers");
      setBrokers([]);
    } finally {
      setLoading(false);
    }
  }

  // ================= SEARCH =================
  const filteredBrokers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brokers;

    return brokers.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q)
    );
  }, [brokers, search]);

  // ================= PAGINATION =================
  const totalPages = Math.max(
    1,
    Math.ceil(filteredBrokers.length / pageSize)
  );

  const paginatedBrokers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBrokers.slice(start, start + pageSize);
  }, [filteredBrokers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  // ================= UI =================
  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold dark:text-white">
            Brokers
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Manage assigned brokers
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search broker..."
            className="px-3 py-2 border rounded-md text-sm
              bg-white border-gray-300
              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
          />

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-2 border rounded-md text-sm
              bg-white border-gray-300
              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
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
          <div className="py-6 text-center text-gray-500 dark:text-slate-400">
            Loading brokers...
          </div>
        ) : paginatedBrokers.length === 0 ? (
          <div className="py-6 text-center text-gray-500 dark:text-slate-400">
            No brokers found
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500 dark:text-slate-400 dark:border-slate-700">
                <th className="py-2 text-left">Profile</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Phone</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Assigned At</th>
              </tr>
            </thead>

            <tbody>
              {paginatedBrokers.map((b) => (
                <tr
                  key={b.id}
                  className="border-b last:border-0 dark:border-slate-800"
                >
                  <td className="py-3">
                    <img
                      src={b.profile?.trim() || "/broker-icon.jpg"}
                      alt={b.name}
                      className="h-10 w-10 rounded-full border object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/broker-icon.jpg";
                      }}
                    />
                  </td>

                  <td className="py-3">{b.name}</td>
                  <td className="py-3">{b.email}</td>
                  <td className="py-3">{b.phone}</td>

                  <td className="py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${b.status === "ACTIVE"
                        ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-slate-600/30 dark:text-slate-300"
                        }`}
                    >
                      {b.status}
                    </span>
                  </td>

                  <td className="py-3">
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
            className="px-3 py-1 border rounded disabled:opacity-40 dark:border-slate-700"
          >
            Prev
          </button>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40 dark:border-slate-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
