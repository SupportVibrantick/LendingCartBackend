import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { Loader2, Users } from "lucide-react";

type Broker = {
  id: string;
  profile?: string | null;
  name: string;
  email: string;
  phone: string;
  brokerStatus: "ACTIVE" | "INACTIVE";
  connectionStatus: "CONNECTED" | "PENDING" | "DISABLED";
  source: string;
  assignedAt: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function MyBrokers() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  /* ================= AUTH ================= */
  function getAuthHeaders(): HeadersInit {
    const token = sessionStorage.getItem("lender_token");
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  }

  /* ================= FETCH ================= */
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
      setBrokers(Array.isArray(json.data) ? json.data : []);
    } catch {
      toast.error("Failed to load brokers");
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
        b.email.toLowerCase().includes(q) ||
        b.phone.includes(q),
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

  /* ================= CONNECTION TOGGLE ================= */
  async function handleConnectionToggle(broker: Broker) {
    // 🔁 toggle logic
    const isActive = broker.connectionStatus === "DISABLED";
    const nextStatus = isActive ? "CONNECTED" : "DISABLED";

    const result = await Swal.fire({
      title: "Change connection?",
      text: `Set connection to ${nextStatus}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, update",
      confirmButtonColor: "#2563eb",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    setUpdatingId(broker.id);

    try {
      const res = await fetch(
        `${API_BASE}/lender/brokers/${broker.id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            isActive,
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Update failed");
      }

      setBrokers((prev) =>
        prev.map((b) =>
          b.id === broker.id ? { ...b, connectionStatus: nextStatus } : b,
        ),
      );

      Swal.fire({
        icon: "success",
        title: "Connection updated",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Update failed",
        text: err.message || "Please try again",
      });

      // 🔄 keep UI in sync
      fetchBrokers();
    } finally {
      setUpdatingId(null);
    }
  }

  /* ================= UI ================= */
  return (
    <div className="text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            My <span className="text-[#102C41]">Brokers</span>
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
            className="px-3 border rounded-md text-sm
      bg-white border-gray-300 text-gray-900
      focus:outline-none focus:ring-2 focus:ring-[#102C41]/40 focus:border-[#102C41]
      dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
          />

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 border rounded-md text-sm
      bg-white border-gray-300 text-gray-900
      focus:outline-none focus:ring-2 focus:ring-[#102C41]/40 focus:border-[#102C41]
      dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>
      </div>

      <div className="ds-table-wrap dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-14 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-sm font-medium text-text-secondary">
              Loading brokers...
            </p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Users size={26} />
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">
              No Brokers Found
            </h3>

            {/* Subtitle */}
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              You currently don’t have any brokers assigned. Once brokers are
              added, they will appear here.
            </p>
          </div>
        ) : (
          <table className="ds-table min-w-full">
            <thead>
              <tr>
                <th>Broker</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Connection</th>
                <th>Assigned At</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <img
                        src={b.profile || "/broker-icon.jpg"}
                        alt=""
                        className="h-9 w-9 rounded-full border border-border object-cover"
                      />
                      <span className="ds-table-title">{b.name}</span>
                    </div>
                  </td>
                  <td className="ds-table-muted">{b.email}</td>
                  <td className="ds-table-muted">{b.phone || "—"}</td>
                  <td>
                    <span className="inline-flex rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                      {b.brokerStatus}
                    </span>
                  </td>
                  <td>
                    <button
                      disabled={updatingId === b.id}
                      onClick={() => handleConnectionToggle(b)}
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        b.connectionStatus === "CONNECTED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      } ${updatingId === b.id ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                      title="Click to toggle connection"
                    >
                      {updatingId === b.id
                        ? "Updating..."
                        : b.connectionStatus}
                    </button>
                  </td>
                  <td className="ds-table-muted">
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
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
