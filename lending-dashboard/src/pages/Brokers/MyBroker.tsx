import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

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

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3001";

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
      const res = await fetch(
        `${API_BASE}/lender/brokers/list`,
        { headers: getAuthHeaders() }
      );
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
        b.phone.includes(q)
    );
  }, [brokers, search]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

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
        }
      );

      const json = await res.json();

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Update failed");
      }


      setBrokers((prev) =>
        prev.map((b) =>
          b.id === broker.id
            ? { ...b, connectionStatus: nextStatus }
            : b
        )
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
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Brokers</h1>
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
          <div className="py-6 text-center text-gray-500">
            Loading brokers…
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-6 text-center text-gray-500">
            No brokers found
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500 dark:border-slate-700">
                <th className="py-2 text-left">Profile</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Phone</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Connection</th>
                <th className="py-2 text-left">Assigned At</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((b) => (
                <tr key={b.id} className="border-b dark:border-slate-800">
                  <td className="py-3">
                    <img
                      src={b.profile || "/broker-icon.jpg"}
                      className="h-10 w-10 rounded-full border object-cover"
                    />
                  </td>
                  <td>{b.name}</td>
                  <td>{b.email}</td>
                  <td>{b.phone}</td>

                  {/* STATUS (READ ONLY) */}
                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium`}
                    >
                      {b.brokerStatus}
                    </span>
                  </td>

                  {/* CONNECTION (CLICKABLE) */}
                  <td>
                    <td className="py-3">
                      <button
                        disabled={updatingId === b.id}
                        onClick={() => handleConnectionToggle(b)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition
      ${b.connectionStatus === "CONNECTED"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                          }
      ${updatingId === b.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
    `}
                        title="Click to toggle connection"
                      >
                        {updatingId === b.id ? "Updating..." : b.connectionStatus}
                      </button>
                    </td>

                  </td>

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
            onClick={() =>
              setCurrentPage((p) => Math.max(1, p - 1))
            }
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={() =>
              setCurrentPage((p) =>
                Math.min(totalPages, p + 1)
              )
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
